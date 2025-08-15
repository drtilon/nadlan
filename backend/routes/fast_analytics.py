# routes/fast_analytics.py - CLEANED VERSION with only needed endpoints

from flask import Blueprint, request, jsonify, current_app
from .auth import token_required, role_required
from extentions import db
from models.models import Apartment, Payment, Tenant, ContractPeriod
from datetime import datetime, date, timedelta
from sqlalchemy import func, text, and_, or_, case, desc, asc
from typing import Optional, Dict, List, Any, Union
import json
from decimal import Decimal
import math

fast_analytics_bp = Blueprint("fast_analytics_bp", __name__)

# Pagination constants
DEFAULT_PAGE_SIZE: int = 10
MAX_PAGE_SIZE: int = 100
PAGE_SIZE_OPTIONS: List[int] = [5, 10, 25, 50, 100]

def safe_decimal(value: Any, default: float = 0) -> Decimal:
    """Safely convert value to decimal"""
    try:
        if value is None:
            return Decimal(default)
        return Decimal(str(value))
    except:
        return Decimal(default)

def extract_payment_amount(payment: Payment) -> float:
    """Extract payment amount from either tenants JSON or amount field"""
    try:
        amount: float = 0
        if hasattr(payment, "amount") and payment.amount:
            amount = float(payment.amount)
        elif payment.tenants:
            tenants_data: List[Dict] = json.loads(payment.tenants)
            amount = sum(float(tenant.get("amountPaid", 0)) for tenant in tenants_data)
        return amount
    except:
        return 0

def calculate_apartment_profit(apartment: Apartment) -> float:
    """Calculate profit for apartment based on rent and model"""
    try:
        has_tenants: bool = apartment.tenants and len(apartment.tenants) > 0
        if not has_tenants:
            return 0.0

        monthly_rent: float = float(apartment.rent) if apartment.rent else 0.0
        if monthly_rent <= 0:
            return 0.0

        model: str = apartment.model.lower().strip() if apartment.model else "rental"

        if model in ["managementfee", "management_fee", "management", "percentage"]:
            management_fee_percentage: float = float(apartment.managementFee) if apartment.managementFee else 0.0
            profit: float = monthly_rent * (management_fee_percentage / 100.0)
        else:
            rent_cost: float = float(apartment.rentCost) if apartment.rentCost else 0.0
            profit = monthly_rent - rent_cost

        return max(0.0, profit)

    except Exception as e:
        current_app.logger.error(f"Error calculating profit for apartment {apartment.id}: {e}")
        return 0.0

# ========== FINANCIAL OVERVIEW ENDPOINT ==========
@fast_analytics_bp.route("/analytics/financial-overview", methods=["GET"])
@token_required
@role_required("admin")
def get_financial_overview():
    """Get simplified financial overview"""
    try:
        current_date: datetime = datetime.now()
        current_year: int = request.args.get("year", current_date.year, type=int)
        current_month: int = current_date.month

        month_names: List[str] = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]

        # Get apartments with tenants
        apartments = Apartment.query.filter(Apartment.tenants.any()).all()

        # Calculate current month data
        current_month_start = date(current_year, current_month, 1)
        if current_month == 12:
            current_month_end = date(current_year + 1, 1, 1) - timedelta(days=1)
        else:
            current_month_end = date(current_year, current_month + 1, 1) - timedelta(days=1)

        current_month_payments = Payment.query.filter(
            Payment.paymentDate >= current_month_start,
            Payment.paymentDate <= current_month_end,
            Payment.status.in_(["paid", "completed"])
        ).all()

        current_month_collected = sum(extract_payment_amount(p) for p in current_month_payments)
        current_month_profit = sum(calculate_apartment_profit(apt) for apt in apartments)

        # Calculate outstanding for current month
        outstanding_query = db.session.query(
            func.sum(
                case(
                    (Payment.status.in_(["paid", "completed"]), 0),
                    else_=func.coalesce(Payment.amount, 0)
                )
            )
        ).filter(
            Payment.paymentDate >= current_month_start,
            Payment.paymentDate <= current_month_end
        ).scalar()

        current_month_outstanding = float(outstanding_query) if outstanding_query else 0

        # Get monthly breakdown for the year
        monthly_breakdown = []
        for month in range(1, 13):
            month_start = date(current_year, month, 1)
            if month == 12:
                month_end = date(current_year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(current_year, month + 1, 1) - timedelta(days=1)

            month_payments = Payment.query.filter(
                Payment.paymentDate >= month_start,
                Payment.paymentDate <= month_end,
                Payment.status.in_(["paid", "completed"])
            ).all()

            collected = sum(extract_payment_amount(p) for p in month_payments)

            monthly_breakdown.append({
                "month": month_names[month - 1],
                "collected": collected,
                "net_profit": current_month_profit  # Simplified - same for all months
            })

        response = {
            "current_month": {
                "collected": current_month_collected,
                "net_profit": current_month_profit,
                "outstanding": current_month_outstanding
            },
            "outstanding": {
                "total_amount": current_month_outstanding
            },
            "monthly_breakdown": monthly_breakdown
        }

        return jsonify(response), 200

    except Exception as e:
        current_app.logger.error(f"Error in financial overview: {e}")
        return jsonify({"message": "Error calculating financial overview", "error": str(e)}), 500

# ========== ENHANCED OUTSTANDING PAYMENTS ENDPOINT ==========
@fast_analytics_bp.route("/analytics/outstanding-payments", methods=["GET"])
@token_required
@role_required("admin")
def get_outstanding_payments():
    """Enhanced outstanding payments with period selection and detailed apartment data"""
    try:
        # Pagination parameters
        page = request.args.get("page", 1, type=int) - 1  # Convert to 0-based
        limit = request.args.get("limit", DEFAULT_PAGE_SIZE, type=int)
        page = max(0, page)
        limit = min(max(1, limit), MAX_PAGE_SIZE)
        offset = page * limit

        # Period selection parameters
        period_type = request.args.get("period_type", "current_month")
        contract_period_id = request.args.get("contract_period_id", type=int)
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")

        # Filter and sort parameters
        search_term = request.args.get("search", "").strip()
        sort_by = request.args.get("sort", "outstanding_desc")
        min_outstanding = request.args.get("min_outstanding", 0, type=float)

        current_date = datetime.now()
        current_year = current_date.year
        current_month = current_date.month

        # Determine the date range based on period type
        if period_type == "current_month":
            start_period = date(current_year, current_month, 1)
            if current_month == 12:
                end_period = date(current_year + 1, 1, 1) - timedelta(days=1)
            else:
                end_period = date(current_year, current_month + 1, 1) - timedelta(days=1)
            period_label = f"{current_date.strftime('%B %Y')}"

        elif period_type == "contract_period" and contract_period_id:
            contract = ContractPeriod.query.get(contract_period_id)
            if not contract:
                return jsonify({"error": "Contract period not found"}), 404
            start_period = contract.start_date
            end_period = contract.end_date or date.today()
            period_label = f"Contract {contract.contract_number}"

        elif period_type == "custom" and start_date_str and end_date_str:
            start_period = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_period = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            period_label = f"{start_period.strftime('%B %d, %Y')} - {end_period.strftime('%B %d, %Y')}"
        else:
            # Default to current month
            start_period = date(current_year, current_month, 1)
            if current_month == 12:
                end_period = date(current_year + 1, 1, 1) - timedelta(days=1)
            else:
                end_period = date(current_year, current_month + 1, 1) - timedelta(days=1)
            period_label = f"{current_date.strftime('%B %Y')}"

        # Helper function to calculate outstanding for period
        def calculate_outstanding_for_period(apartment_id, start_date, end_date):
            try:
                apartment = Apartment.query.get(apartment_id)
                if not apartment:
                    return 0, 0, []

                # Calculate expected vs paid
                monthly_rent = float(apartment.rent) if apartment.rent else 0
                months_diff = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month) + 1
                expected_total = monthly_rent * months_diff

                # Get all payments in the period
                payments = Payment.query.filter(
                    Payment.apartment_id == apartment_id,
                    Payment.paymentDate >= start_date,
                    Payment.paymentDate <= end_date
                ).all()

                total_paid = 0
                tenant_details = []

                for payment in payments:
                    if payment.tenants:
                        try:
                            tenants_data = json.loads(payment.tenants) if isinstance(payment.tenants, str) else payment.tenants
                            for tenant_data in tenants_data:
                                amount_paid = float(tenant_data.get("amountPaid", 0))
                                total_paid += amount_paid

                                tenant_details.append({
                                    "tenant_name": tenant_data.get("name", "Unknown"),
                                    "amount_paid": amount_paid,
                                    "amount_due": float(tenant_data.get("amountDue", 0)),
                                    "payment_date": payment.paymentDate.isoformat() if payment.paymentDate else None,
                                    "payment_id": payment.id,
                                    "status": payment.status
                                })
                        except (json.JSONDecodeError, TypeError):
                            continue

                outstanding = max(0, expected_total - total_paid)
                return expected_total, outstanding, tenant_details

            except Exception as e:
                current_app.logger.error(f"Error calculating outstanding for apartment {apartment_id}: {e}")
                return 0, 0, []

        # Get all apartments with tenants
        apartments_query = db.session.query(Apartment).filter(Apartment.tenants.any())

        # Apply search filter
        if search_term:
            apartments_query = apartments_query.filter(
                or_(
                    Apartment.address.ilike(f"%{search_term}%"),
                    Apartment.tenants.any(Tenant.name.ilike(f"%{search_term}%"))
                )
            )

        apartments = apartments_query.all()
        apartments_data = []

        for apartment in apartments:
            try:
                # Calculate outstanding for the selected period
                expected_amount, outstanding_amount, tenant_details = calculate_outstanding_for_period(
                    apartment.id, start_period, end_period
                )

                # Skip apartments below minimum outstanding threshold
                if outstanding_amount < min_outstanding:
                    continue

                tenant_names = [tenant.name for tenant in apartment.tenants] if apartment.tenants else []

                apartments_data.append({
                    "apartment_id": apartment.id,
                    "address": apartment.address,
                    "monthly_rent": float(apartment.rent) if apartment.rent else 0,
                    "tenants": tenant_names,
                    "tenant_count": len(tenant_names),
                    "expected_amount": expected_amount,
                    "total_outstanding": outstanding_amount,
                    "tenant_details": tenant_details,
                    "status": apartment.status,
                    "max_occupancy": apartment.maxOccupancy,
                    "landlord_id": apartment.landlord_id
                })

            except Exception as e:
                current_app.logger.error(f"Error processing apartment {apartment.id}: {e}")
                continue

        # Sort the data
        if sort_by == "outstanding_desc":
            apartments_data.sort(key=lambda x: x["total_outstanding"], reverse=True)
        elif sort_by == "outstanding_asc":
            apartments_data.sort(key=lambda x: x["total_outstanding"])
        elif sort_by == "address_asc":
            apartments_data.sort(key=lambda x: x["address"])
        elif sort_by == "address_desc":
            apartments_data.sort(key=lambda x: x["address"], reverse=True)
        elif sort_by == "rent_desc":
            apartments_data.sort(key=lambda x: x["monthly_rent"], reverse=True)
        elif sort_by == "rent_asc":
            apartments_data.sort(key=lambda x: x["monthly_rent"])

        # Pagination
        total_count = len(apartments_data)
        total_pages = (total_count + limit - 1) // limit
        has_next = page < total_pages - 1
        has_prev = page > 0

        paginated_apartments = apartments_data[offset:offset + limit]

        # Calculate summary statistics
        total_outstanding = sum(apt["total_outstanding"] for apt in apartments_data)
        total_expected = sum(apt["expected_amount"] for apt in apartments_data)
        apartments_with_debt = len([apt for apt in apartments_data if apt["total_outstanding"] > 0])

        response = {
            "apartments": paginated_apartments,
            "pagination": {
                "current_page": page + 1,  # Convert back to 1-based
                "total_pages": total_pages,
                "total_items": total_count,
                "items_per_page": limit,
                "has_next_page": has_next,
                "has_prev_page": has_prev,
                "start_index": offset + 1 if paginated_apartments else 0,
                "end_index": min(offset + limit, total_count),
                "page_size_options": PAGE_SIZE_OPTIONS,
            },
            "summary": {
                "period_label": period_label,
                "start_date": start_period.isoformat(),
                "end_date": end_period.isoformat(),
                "total_outstanding": total_outstanding,
                "total_expected": total_expected,
                "collection_rate": ((total_expected - total_outstanding) / total_expected * 100) if total_expected > 0 else 100,
                "apartments_with_debt": apartments_with_debt,
                "apartments_current": total_count - apartments_with_debt,
                "average_outstanding": total_outstanding / apartments_with_debt if apartments_with_debt > 0 else 0,
                "highest_outstanding": max([apt["total_outstanding"] for apt in apartments_data], default=0)
            },
            "filters": {
                "period_type": period_type,
                "contract_period_id": contract_period_id,
                "start_date": start_date_str,
                "end_date": end_date_str,
                "search": search_term,
                "sort_by": sort_by,
                "min_outstanding": min_outstanding
            }
        }

        return jsonify(response), 200

    except Exception as e:
        current_app.logger.error(f"Error in outstanding payments: {e}")
        return jsonify({"message": "Error retrieving outstanding payments", "error": str(e)}), 500

# ========== APARTMENT OUTSTANDING DETAILS ENDPOINT ==========
@fast_analytics_bp.route("/analytics/apartment-outstanding-details/<int:apartment_id>", methods=["GET"])
@token_required
@role_required("admin")
def get_apartment_outstanding_details(apartment_id):
    """Get detailed outstanding information for a specific apartment"""
    try:
        # Period parameters (same as main endpoint)
        period_type = request.args.get("period_type", "current_month")
        contract_period_id = request.args.get("contract_period_id", type=int)
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")

        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"error": "Apartment not found"}), 404

        current_date = datetime.now()
        current_year = current_date.year
        current_month = current_date.month

        # Determine date range (same logic as main endpoint)
        if period_type == "current_month":
            start_period = date(current_year, current_month, 1)
            if current_month == 12:
                end_period = date(current_year + 1, 1, 1) - timedelta(days=1)
            else:
                end_period = date(current_year, current_month + 1, 1) - timedelta(days=1)
            period_label = f"{current_date.strftime('%B %Y')}"
        elif period_type == "contract_period" and contract_period_id:
            contract = ContractPeriod.query.get(contract_period_id)
            if not contract:
                return jsonify({"error": "Contract period not found"}), 404
            start_period = contract.start_date
            end_period = contract.end_date or date.today()
            period_label = f"Contract {contract.contract_number}"
        elif period_type == "custom" and start_date_str and end_date_str:
            start_period = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_period = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            period_label = f"{start_period.strftime('%B %d, %Y')} - {end_period.strftime('%B %d, %Y')}"
        else:
            start_period = date(current_year, current_month, 1)
            if current_month == 12:
                end_period = date(current_year + 1, 1, 1) - timedelta(days=1)
            else:
                end_period = date(current_year, current_month + 1, 1) - timedelta(days=1)
            period_label = f"{current_date.strftime('%B %Y')}"

        # Get detailed breakdown using same logic as main endpoint
        monthly_rent = float(apartment.rent) if apartment.rent else 0
        months_diff = (end_period.year - start_period.year) * 12 + (end_period.month - start_period.month) + 1
        expected_amount = monthly_rent * months_diff

        payments = Payment.query.filter(
            Payment.apartment_id == apartment_id,
            Payment.paymentDate >= start_period,
            Payment.paymentDate <= end_period
        ).all()

        total_paid = 0
        tenant_details = []

        for payment in payments:
            if payment.tenants:
                try:
                    tenants_data = json.loads(payment.tenants) if isinstance(payment.tenants, str) else payment.tenants
                    for tenant_data in tenants_data:
                        amount_paid = float(tenant_data.get("amountPaid", 0))
                        total_paid += amount_paid

                        tenant_details.append({
                            "tenant_name": tenant_data.get("name", "Unknown"),
                            "amount_paid": amount_paid,
                            "amount_due": float(tenant_data.get("amountDue", 0)),
                            "payment_date": payment.paymentDate.isoformat() if payment.paymentDate else None,
                            "payment_id": payment.id,
                            "status": payment.status
                        })
                except (json.JSONDecodeError, TypeError):
                    continue

        outstanding_amount = max(0, expected_amount - total_paid)

        # Group tenant details by tenant name
        from collections import defaultdict
        tenant_summary = defaultdict(lambda: {
            "total_paid": 0,
            "total_due": 0,
            "payments": []
        })

        for detail in tenant_details:
            tenant_name = detail["tenant_name"]
            tenant_summary[tenant_name]["total_paid"] += detail["amount_paid"]
            tenant_summary[tenant_name]["total_due"] += detail["amount_due"]
            tenant_summary[tenant_name]["payments"].append(detail)

        # Convert to list format
        tenant_breakdown = []
        for tenant_name, data in tenant_summary.items():
            outstanding = max(0, data["total_due"] - data["total_paid"])
            tenant_breakdown.append({
                "tenant_name": tenant_name,
                "total_paid": data["total_paid"],
                "total_due": data["total_due"],
                "outstanding": outstanding,
                "payment_count": len(data["payments"]),
                "payments": sorted(data["payments"], key=lambda x: x["payment_date"] or "", reverse=True)
            })

        response = {
            "apartment": {
                "id": apartment.id,
                "address": apartment.address,
                "monthly_rent": monthly_rent,
                "status": apartment.status,
                "max_occupancy": apartment.maxOccupancy,
                "current_tenants": [{"id": t.id, "name": t.name} for t in apartment.tenants] if apartment.tenants else []
            },
            "period": {
                "type": period_type,
                "label": period_label,
                "start_date": start_period.isoformat(),
                "end_date": end_period.isoformat()
            },
            "summary": {
                "expected_amount": expected_amount,
                "total_outstanding": outstanding_amount,
                "total_paid": total_paid,
                "collection_rate": ((expected_amount - outstanding_amount) / expected_amount * 100) if expected_amount > 0 else 100
            },
            "tenant_breakdown": tenant_breakdown
        }

        return jsonify(response), 200

    except Exception as e:
        current_app.logger.error(f"Error getting apartment outstanding details: {e}")
        return jsonify({"message": "Error getting apartment details", "error": str(e)}), 500

# ========== CONTRACT PERIODS ENDPOINT ==========
@fast_analytics_bp.route("/analytics/contract-periods", methods=["GET"])
@token_required
@role_required("admin")
def get_analytics_contract_periods():
    """Get all contract periods for period selection"""
    try:
        contracts = ContractPeriod.query.filter(
            or_(
                ContractPeriod.status == 'active',
                and_(
                    ContractPeriod.end_date >= date.today() - timedelta(days=365),
                    ContractPeriod.status.in_(['active', 'completed'])
                )
            )
        ).order_by(desc(ContractPeriod.start_date)).all()

        contract_options = []
        for contract in contracts:
            contract_options.append({
                "id": contract.id,
                "contract_number": contract.contract_number,
                "apartment_address": contract.apartment.address if contract.apartment else "Unknown",
                "start_date": contract.start_date.isoformat() if contract.start_date else None,
                "end_date": contract.end_date.isoformat() if contract.end_date else None,
                "status": contract.status,
                "is_current": contract.start_date <= date.today() and (contract.end_date is None or contract.end_date >= date.today())
            })

        return jsonify({
            "contracts": contract_options,
            "total_count": len(contract_options)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting contract periods: {e}")
        return jsonify({"message": "Error getting contract periods", "error": str(e)}), 500

# ========== CONTRACT PERIODS ENDPOINT ==========
@fast_analytics_bp.route("/analytics/contract-periods", methods=["GET"])
@token_required
@role_required("admin")
def get_contract_periods():
    """Get all contract periods for period selection"""
    try:
        contracts = ContractPeriod.query.filter(
            or_(
                ContractPeriod.status == 'active',
                and_(
                    ContractPeriod.end_date >= date.today() - timedelta(days=365),
                    ContractPeriod.status.in_(['active', 'completed'])
                )
            )
        ).order_by(desc(ContractPeriod.start_date)).all()

        contract_options = []
        for contract in contracts:
            contract_options.append({
                "id": contract.id,
                "contract_number": contract.contract_number,
                "apartment_address": contract.apartment.address if contract.apartment else "Unknown",
                "start_date": contract.start_date.isoformat() if contract.start_date else None,
                "end_date": contract.end_date.isoformat() if contract.end_date else None,
                "status": contract.status,
                "is_current": contract.start_date <= date.today() and (contract.end_date is None or contract.end_date >= date.today())
            })

        return jsonify({
            "contracts": contract_options,
            "total_count": len(contract_options)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting contract periods: {e}")
        return jsonify({"message": "Error getting contract periods", "error": str(e)}), 500
@fast_analytics_bp.route("/analytics/net-profit-detailed", methods=["GET"])
@token_required
@role_required("admin")
def get_net_profit_detailed():
    """Get paginated net profit analysis for apartments"""
    try:
        # Pagination parameters
        page = request.args.get("page", 0, type=int)
        limit = request.args.get("limit", DEFAULT_PAGE_SIZE, type=int)
        page = max(0, page)
        limit = min(max(1, limit), MAX_PAGE_SIZE)
        offset = page * limit

        # Date parameters
        year = request.args.get("year", datetime.now().year, type=int)
        month = request.args.get("month", type=int)

        # Filter parameters
        search_term = request.args.get("search", "").strip()
        sort_by = request.args.get("sort", "profit_desc")
        min_profit = request.args.get("min_profit", type=float)
        status_filter = request.args.get("status", "").strip()

        # Get apartments with tenants
        apartments_query = Apartment.query.filter(Apartment.tenants.any())

        # Apply search filter
        if search_term:
            apartments_query = apartments_query.filter(
                or_(
                    Apartment.address.ilike(f"%{search_term}%"),
                    Apartment.tenants.any(Tenant.name.ilike(f"%{search_term}%"))
                )
            )

        # Apply status filter
        if status_filter:
            apartments_query = apartments_query.filter(Apartment.status.ilike(f"%{status_filter}%"))

        apartments = apartments_query.all()
        apartments_data = []

        for apartment in apartments:
            try:
                profit = calculate_apartment_profit(apartment)

                # Apply minimum profit filter
                if min_profit is not None and profit < min_profit:
                    continue

                tenant_names = [tenant.name for tenant in apartment.tenants] if apartment.tenants else []

                apartments_data.append({
                    "apartment_id": apartment.id,
                    "address": apartment.address,
                    "monthly_rent": float(apartment.rent) if apartment.rent else 0,
                    "monthly_profit": profit,
                    "tenants": tenant_names,
                    "tenant_count": len(tenant_names),
                    "status": apartment.status,
                    "model": apartment.model,
                    "management_fee": float(apartment.managementFee) if apartment.managementFee else 0,
                    "rent_cost": float(apartment.rentCost) if apartment.rentCost else 0
                })

            except Exception as e:
                current_app.logger.error(f"Error processing apartment {apartment.id}: {e}")
                continue

        # Sort the data
        if sort_by == "profit_desc":
            apartments_data.sort(key=lambda x: x["monthly_profit"], reverse=True)
        elif sort_by == "profit_asc":
            apartments_data.sort(key=lambda x: x["monthly_profit"])
        elif sort_by == "rent_desc":
            apartments_data.sort(key=lambda x: x["monthly_rent"], reverse=True)
        elif sort_by == "rent_asc":
            apartments_data.sort(key=lambda x: x["monthly_rent"])
        elif sort_by == "address_asc":
            apartments_data.sort(key=lambda x: x["address"])

        # Pagination
        total_count = len(apartments_data)
        total_pages = (total_count + limit - 1) // limit
        has_next = page < total_pages - 1
        has_prev = page > 0

        paginated_apartments = apartments_data[offset:offset + limit]

        # Calculate summary statistics
        total_rent = sum(apt["monthly_rent"] for apt in apartments_data)
        total_profit = sum(apt["monthly_profit"] for apt in apartments_data)

        response = {
            "apartments": paginated_apartments,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages,
                "total_items": total_count,
                "items_per_page": limit,
                "has_next_page": has_next,
                "has_prev_page": has_prev,
                "start_index": offset + 1 if paginated_apartments else 0,
                "end_index": min(offset + limit, total_count),
                "page_size_options": PAGE_SIZE_OPTIONS,
            },
            "summary": {
                "total_apartments": total_count,
                "total_monthly_rent": total_rent,
                "total_monthly_profit": total_profit,
                "average_profit": total_profit / total_count if total_count > 0 else 0,
                "profit_margin": (total_profit / total_rent * 100) if total_rent > 0 else 0
            },
            "filters": {
                "year": year,
                "month": month,
                "search": search_term,
                "sort_by": sort_by,
                "min_profit": min_profit,
                "status": status_filter,
            },
        }

        return jsonify(response), 200

    except Exception as e:
        current_app.logger.error(f"Error in detailed net profit calculation: {e}")
        return jsonify({"message": "Error calculating detailed net profit", "error": str(e)}), 500
