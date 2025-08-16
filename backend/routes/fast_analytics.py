# routes/fast_analytics.py - COMPLETE FIXED VERSION with Contract Period Support

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

def get_current_contract_for_apartment(apartment_id: int) -> Optional[ContractPeriod]:
    """Get the currently active contract period for an apartment"""
    try:
        today = date.today()
        current_contract = ContractPeriod.query.filter(
            and_(
                ContractPeriod.apartment_id == apartment_id,
                ContractPeriod.start_date <= today,
                or_(
                    ContractPeriod.end_date.is_(None),
                    ContractPeriod.end_date >= today
                ),
                ContractPeriod.status == 'active'
            )
        ).first()
        return current_contract
    except Exception as e:
        current_app.logger.error(f"Error getting current contract for apartment {apartment_id}: {e}")
        return None

def get_contract_payments(apartment_id: int, contract_period_id: int, start_date: date, end_date: date) -> List[Payment]:
    """Get payments for a specific contract period within a date range"""
    try:
        # Get payments that belong to this contract period
        payments = Payment.query.filter(
            and_(
                Payment.apartment_id == apartment_id,
                Payment.contract_period_id == contract_period_id,
                Payment.paymentDate >= start_date,
                Payment.paymentDate <= end_date,
                Payment.status.in_(["paid", "completed"])
            )
        ).all()

        # Also include legacy payments (without contract_period_id) if they fall within the contract period dates
        legacy_payments = Payment.query.filter(
            and_(
                Payment.apartment_id == apartment_id,
                Payment.contract_period_id.is_(None),
                Payment.paymentDate >= start_date,
                Payment.paymentDate <= end_date,
                Payment.status.in_(["paid", "completed"])
            )
        ).all()

        return payments + legacy_payments
    except Exception as e:
        current_app.logger.error(f"Error getting contract payments: {e}")
        return []

def calculate_outstanding_for_contract(apartment: Apartment, contract: ContractPeriod, target_date: date) -> float:
    """Calculate outstanding amount for a specific contract up to a target date"""
    try:
        if not contract or not contract.monthly_rent:
            return 0.0

        # Calculate how many months of rent should have been paid by target_date
        months_elapsed = 0
        current_month = contract.start_date.replace(day=1)
        target_month = target_date.replace(day=1)

        while current_month <= target_month:
            months_elapsed += 1
            # Move to next month
            if current_month.month == 12:
                current_month = current_month.replace(year=current_month.year + 1, month=1)
            else:
                current_month = current_month.replace(month=current_month.month + 1)

        expected_total = float(contract.monthly_rent) * months_elapsed

        # Get actual payments for this contract
        payments = get_contract_payments(
            apartment.id,
            contract.id,
            contract.start_date,
            target_date
        )

        total_paid = sum(extract_payment_amount(p) for p in payments)
        outstanding = max(0, expected_total - total_paid)

        return outstanding
    except Exception as e:
        current_app.logger.error(f"Error calculating outstanding for contract: {e}")
        return 0.0

# ========== FINANCIAL OVERVIEW ENDPOINT ==========
@fast_analytics_bp.route("/analytics/financial-overview", methods=["GET"])
@token_required
@role_required("admin")
def get_financial_overview():
    """Get simplified financial overview with contract period support"""
    try:
        current_date: datetime = datetime.now()
        current_year: int = request.args.get("year", current_date.year, type=int)
        current_month: int = current_date.month

        month_names: List[str] = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]

        # Get all apartments
        apartments = Apartment.query.all()

        # Calculate current month data
        current_month_start = date(current_year, current_month, 1)
        if current_month == 12:
            current_month_end = date(current_year + 1, 1, 1) - timedelta(days=1)
        else:
            current_month_end = date(current_year, current_month + 1, 1) - timedelta(days=1)

        # Calculate collected amount for current month (only from active contracts)
        current_month_collected = 0.0
        current_month_outstanding = 0.0
        apartments_with_contracts = 0
        apartments_with_payments = 0

        for apartment in apartments:
            # Get current active contract
            current_contract = get_current_contract_for_apartment(apartment.id)

            if current_contract:
                apartments_with_contracts += 1

                # Get payments for this contract in current month
                current_month_payments = get_contract_payments(
                    apartment.id,
                    current_contract.id,
                    current_month_start,
                    current_month_end
                )

                if current_month_payments:
                    apartments_with_payments += 1

                # Add to collected amount
                collected_this_month = sum(extract_payment_amount(p) for p in current_month_payments)
                current_month_collected += collected_this_month

                # Calculate outstanding for this contract
                outstanding = calculate_outstanding_for_contract(
                    apartment,
                    current_contract,
                    current_month_end
                )
                current_month_outstanding += outstanding

        # Calculate current month profit (same as before)
        current_month_profit = sum(calculate_apartment_profit(apt) for apt in apartments)

        # Get monthly breakdown for the year
        monthly_breakdown = []
        for month_idx, month in enumerate(month_names):
            month_start = date(current_year, month_idx + 1, 1)
            if month_idx == 11:  # December
                month_end = date(current_year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(current_year, month_idx + 2, 1) - timedelta(days=1)

            # Calculate collected for this month across all active contracts
            month_collected = 0.0

            for apartment in apartments:
                current_contract = get_current_contract_for_apartment(apartment.id)
                if current_contract:
                    month_payments = get_contract_payments(
                        apartment.id,
                        current_contract.id,
                        month_start,
                        month_end
                    )
                    month_collected += sum(extract_payment_amount(p) for p in month_payments)

            monthly_breakdown.append({
                "month": month,
                "collected": month_collected,
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
            "monthly_breakdown": monthly_breakdown,
            "debug_info": {
                "total_apartments": len(apartments),
                "apartments_with_contracts": apartments_with_contracts,
                "apartments_with_payments": apartments_with_payments,
                "year_queried": current_year,
                "current_month": month_names[current_month - 1]
            }
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
    """Enhanced outstanding payments with contract period support"""
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

        # Get all apartments
        apartments_query = db.session.query(Apartment)

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
                # Get current contract
                current_contract = get_current_contract_for_apartment(apartment.id)

                if not current_contract:
                    continue  # Skip apartments without active contracts

                # Calculate outstanding for this contract in the selected period
                outstanding_amount = calculate_outstanding_for_contract(
                    apartment,
                    current_contract,
                    end_period
                )

                # Skip apartments below minimum outstanding threshold
                if outstanding_amount < min_outstanding:
                    continue

                # Get contract payments in the period
                contract_payments = get_contract_payments(
                    apartment.id,
                    current_contract.id,
                    start_period,
                    end_period
                )

                # Calculate expected amount
                months_in_period = max(1, (end_period.year - start_period.year) * 12 + (end_period.month - start_period.month) + 1)
                expected_amount = float(current_contract.monthly_rent) * months_in_period

                # Get tenant details from contract
                tenant_names = [ct.tenant.name for ct in current_contract.contract_tenants if ct.tenant] if current_contract.contract_tenants else []

                apartments_data.append({
                    "apartment_id": apartment.id,
                    "address": apartment.address,
                    "monthly_rent": float(current_contract.monthly_rent),
                    "tenants": tenant_names,
                    "tenant_count": len(tenant_names),
                    "expected_amount": expected_amount,
                    "total_outstanding": outstanding_amount,
                    "contract_info": {
                        "id": current_contract.id,
                        "contract_number": current_contract.contract_number,
                        "start_date": current_contract.start_date.isoformat(),
                        "end_date": current_contract.end_date.isoformat() if current_contract.end_date else None,
                        "status": current_contract.status
                    },
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

# ========== NET PROFIT DETAILED ENDPOINT ==========
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

        # Get apartments
        apartments_query = Apartment.query

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

                # Get current contract info
                current_contract = get_current_contract_for_apartment(apartment.id)
                tenant_names = []

                if current_contract and current_contract.contract_tenants:
                    tenant_names = [ct.tenant.name for ct in current_contract.contract_tenants if ct.tenant]
                else:
                    # Fallback to legacy tenants
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
                    "rent_cost": float(apartment.rentCost) if apartment.rentCost else 0,
                    "contract_info": {
                        "id": current_contract.id,
                        "contract_number": current_contract.contract_number,
                        "status": current_contract.status
                    } if current_contract else None
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
