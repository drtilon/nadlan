# routes/fast_analytics.py - COMPLETE FIXED VERSION with proper relationships and field handling

from flask import Blueprint, request, jsonify, current_app
from .auth import token_required, role_required
from extentions import db
from models.models import Apartment, Payment, Tenant, ContractPeriod, ContractTenant
from datetime import datetime, date, timedelta
from sqlalchemy import func, text, and_, or_, case, desc, asc, extract
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
        elif hasattr(payment, "tenants") and payment.tenants:
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

def get_current_contract_for_apartment(apartment_id: int, target_date: date = None) -> Optional[ContractPeriod]:
    """Get the active contract for an apartment at a given date"""
    try:
        if target_date is None:
            target_date = date.today()

        contract = ContractPeriod.query.filter(
            ContractPeriod.apartment_id == apartment_id,
            ContractPeriod.start_date <= target_date,
            or_(
                ContractPeriod.end_date.is_(None),
                ContractPeriod.end_date >= target_date
            ),
            ContractPeriod.status == "active"
        ).first()

        return contract
    except Exception as e:
        current_app.logger.error(f"Error getting current contract for apartment {apartment_id}: {e}")
        return None

def get_apartment_tenants(apartment_id: int) -> List[str]:
    """FIXED: Get current tenants for an apartment through contract assignments"""
    try:
        current_date = date.today()

        # Get active contract tenants for this apartment
        tenant_assignments = db.session.query(ContractTenant).join(ContractPeriod).filter(
            ContractPeriod.apartment_id == apartment_id,
            ContractPeriod.status == "active",
            ContractPeriod.start_date <= current_date,
            or_(
                ContractPeriod.end_date.is_(None),
                ContractPeriod.end_date >= current_date
            ),
            or_(
                ContractTenant.move_out_date.is_(None),
                ContractTenant.move_out_date >= current_date
            )
        ).all()

        # Get unique tenant names
        tenant_names = []
        for assignment in tenant_assignments:
            if assignment.tenant and assignment.tenant.name:
                if assignment.tenant.name not in tenant_names:
                    tenant_names.append(assignment.tenant.name)

        return tenant_names if tenant_names else ["No tenants assigned"]

    except Exception as e:
        current_app.logger.error(f"Error getting tenants for apartment {apartment_id}: {e}")
        return ["Error loading tenants"]

def get_contract_payments(apartment_id: int, contract_id: int, start_date: date, end_date: date) -> List[Payment]:
    """Get payments for a contract within a date range"""
    try:
        # FIXED: Use proper field names and date filtering
        payments = Payment.query.filter(
            Payment.apartment_id == apartment_id,
            Payment.contract_period_id == contract_id,
            and_(
                Payment.year * 100 + Payment.month >= start_date.year * 100 + start_date.month,
                Payment.year * 100 + Payment.month <= end_date.year * 100 + end_date.month
            ),
            Payment.status.in_(["paid", "completed", "partial"])
        ).all()

        return payments
    except Exception as e:
        current_app.logger.error(f"Error getting contract payments: {e}")
        return []

def calculate_outstanding_for_contract(apartment: Apartment, contract: ContractPeriod, target_date: date = None) -> float:
    """Calculate outstanding amount for a specific contract"""
    try:
        if target_date is None:
            target_date = date.today()

        if contract.start_date > target_date:
            return 0.0

        # Calculate months elapsed
        months_elapsed = 0
        current_month = contract.start_date.replace(day=1)
        target_month = target_date.replace(day=1)

        while current_month <= target_month:
            months_elapsed += 1
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
    """FIXED: Get financial overview with proper field handling and frontend-compatible structure"""
    try:
        current_date: datetime = datetime.now()
        current_year: int = request.args.get("year", current_date.year, type=int)
        current_month: int = current_date.month
        current_date_obj = current_date.date()

        month_names: List[str] = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]

        # Get all apartments and active contracts
        apartments = Apartment.query.all()
        active_contracts = ContractPeriod.query.filter(
            ContractPeriod.status == "active",
            ContractPeriod.start_date <= current_date_obj,
            or_(
                ContractPeriod.end_date.is_(None),
                ContractPeriod.end_date >= current_date_obj
            )
        ).all()

        # Calculate current month data
        current_month_start = date(current_year, current_month, 1)
        if current_month == 12:
            current_month_end = date(current_year + 1, 1, 1) - timedelta(days=1)
        else:
            current_month_end = date(current_year, current_month + 1, 1) - timedelta(days=1)

        # FIXED: Get payments made THIS MONTH with proper field handling
        current_month_payments = Payment.query.filter(
            and_(
                Payment.month == current_month,
                Payment.year == current_year,
                Payment.status.in_(["paid", "completed", "partial"])
            )
        ).all()

        # Calculate total collected this month from ALL payments
        current_month_collected = 0.0
        for payment in current_month_payments:
            collected_amount = extract_payment_amount(payment)
            current_month_collected += collected_amount

        # Calculate outstanding from active contracts
        current_month_outstanding = 0.0
        apartments_with_contracts = len(active_contracts)
        apartments_with_payments = len(set(p.apartment_id for p in current_month_payments))

        for contract in active_contracts:
            apartment = contract.apartment
            if apartment:
                outstanding = calculate_outstanding_for_contract(apartment, contract, current_month_end)
                current_month_outstanding += outstanding

        # Calculate expected revenue (from active contracts)
        expected_revenue = sum(float(contract.monthly_rent) for contract in active_contracts)

        # Calculate collection rate
        collection_rate = (current_month_collected / expected_revenue * 100) if expected_revenue > 0 else 100

        # Calculate net profit (simplified calculation)
        current_month_net_profit = 0.0
        for apartment in apartments:
            profit = calculate_apartment_profit(apartment)
            current_month_net_profit += profit

        # Monthly breakdown for the year
        monthly_breakdown = []
        for month in range(1, 13):
            month_start = date(current_year, month, 1)
            if month == 12:
                month_end = date(current_year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(current_year, month + 1, 1) - timedelta(days=1)

            # Get payments for this month
            month_payments = Payment.query.filter(
                and_(
                    Payment.month == month,
                    Payment.year == current_year,
                    Payment.status.in_(["paid", "completed", "partial"])
                )
            ).all()

            month_collected = sum(extract_payment_amount(p) for p in month_payments)

            # Calculate expected for this month (contracts active during this month)
            month_expected = sum(
                float(contract.monthly_rent) for contract in ContractPeriod.query.filter(
                    ContractPeriod.status == "active",
                    ContractPeriod.start_date <= month_end,
                    or_(
                        ContractPeriod.end_date.is_(None),
                        ContractPeriod.end_date >= month_start
                    )
                ).all()
            )

            month_collection_rate = (month_collected / month_expected * 100) if month_expected > 0 else 100
            month_net_profit = current_month_net_profit  # Simplified - same for all months

            monthly_breakdown.append({
                "month": month,
                "month_name": month_names[month - 1],
                "expected": float(month_expected),
                "collected": float(month_collected),
                "net_profit": float(month_net_profit),
                "collection_rate": round(month_collection_rate, 2),
                "outstanding": float(month_expected - month_collected) if month_expected > month_collected else 0
            })

        # Summary calculations
        total_expected_year = sum(m["expected"] for m in monthly_breakdown)
        total_collected_year = sum(m["collected"] for m in monthly_breakdown)
        avg_collection_rate = (total_collected_year / total_expected_year * 100) if total_expected_year > 0 else 100

        # FIXED: Return structure that matches frontend expectations
        response = {
            "year": current_year,
            "current_month": {
                "month": current_month,
                "month_name": month_names[current_month - 1],
                "expected_revenue": float(expected_revenue),
                "collected": float(current_month_collected),
                "net_profit": float(current_month_net_profit),
                "outstanding": float(current_month_outstanding),
                "collection_rate": round(collection_rate, 2),
                "apartments_with_contracts": apartments_with_contracts,
                "apartments_with_payments": apartments_with_payments
            },
            "monthly_breakdown": monthly_breakdown,
            "yearly_summary": {
                "total_expected": float(total_expected_year),
                "total_actual": float(total_collected_year),
                "average_collection_rate": round(avg_collection_rate, 2),
                "total_apartments": len(apartments),
                "active_contracts": apartments_with_contracts
            },
            # Debug info for frontend
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
        return jsonify({"message": "Error in financial overview", "error": str(e)}), 500

@fast_analytics_bp.route("/analytics/outstanding-payments", methods=["GET"])
@token_required
@role_required("admin")
def get_outstanding_payments():
    """FIXED: Enhanced outstanding payments with proper tenant relationships"""
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

        # FIXED: Get all apartments with proper search filtering
        apartments_query = Apartment.query

        # Apply search filter - FIXED to not use non-existent tenant relationship
        if search_term:
            apartments_query = apartments_query.filter(
                or_(
                    Apartment.address.ilike(f"%{search_term}%"),
                    Apartment.street_name.ilike(f"%{search_term}%"),
                    Apartment.house_number.ilike(f"%{search_term}%"),
                    Apartment.full_address.ilike(f"%{search_term}%")
                )
            )

        apartments = apartments_query.all()
        apartments_data = []

        for apartment in apartments:
            try:
                # Get current active contract for the apartment
                current_contract = get_current_contract_for_apartment(apartment.id, end_period)

                if not current_contract:
                    continue  # Skip apartments without active contracts

                # Calculate outstanding amount
                outstanding = calculate_outstanding_for_contract(apartment, current_contract, end_period)

                # Apply minimum outstanding filter
                if outstanding < min_outstanding:
                    continue

                # Get payments made this month for "paid this month" column
                paid_this_month = Payment.query.filter(
                    Payment.apartment_id == apartment.id,
                    Payment.month == current_month,
                    Payment.year == current_year,
                    Payment.status.in_(["paid", "completed", "partial"])
                ).all()

                paid_amount_this_month = sum(extract_payment_amount(p) for p in paid_this_month)

                # FIXED: Get tenant information through proper relationship
                tenant_names = get_apartment_tenants(apartment.id)

                apartment_data = {
                    "apartment_id": apartment.id,
                    "address": apartment.get_short_address(),
                    "monthly_rent": float(current_contract.monthly_rent),
                    "total_outstanding": float(outstanding),
                    "paid_this_month": float(paid_amount_this_month),
                    "tenants": tenant_names,
                    "contract_number": current_contract.contract_number,
                    "contract_start": current_contract.start_date.isoformat(),
                    "contract_end": current_contract.end_date.isoformat() if current_contract.end_date else None,
                    "status": apartment.status,
                    "last_payment_date": None
                }

                # Get last payment date for this apartment - FIXED field handling
                last_payment = Payment.query.filter(
                    Payment.apartment_id == apartment.id,
                    Payment.status.in_(["paid", "completed", "partial"])
                ).order_by(Payment.year.desc(), Payment.month.desc()).first()

                if last_payment:
                    if hasattr(last_payment, 'payment_date') and last_payment.payment_date:
                        apartment_data["last_payment_date"] = last_payment.payment_date.isoformat()

                apartments_data.append(apartment_data)

            except Exception as e:
                current_app.logger.error(f"Error processing apartment {apartment.id}: {e}")
                continue

        # Apply sorting
        if sort_by == "outstanding_desc":
            apartments_data.sort(key=lambda x: x["total_outstanding"], reverse=True)
        elif sort_by == "outstanding_asc":
            apartments_data.sort(key=lambda x: x["total_outstanding"])
        elif sort_by == "address_asc":
            apartments_data.sort(key=lambda x: x["address"])
        elif sort_by == "rent_desc":
            apartments_data.sort(key=lambda x: x["monthly_rent"], reverse=True)
        elif sort_by == "paid_desc":
            apartments_data.sort(key=lambda x: x["paid_this_month"], reverse=True)
        elif sort_by == "paid_asc":
            apartments_data.sort(key=lambda x: x["paid_this_month"])

        # Pagination
        total_count = len(apartments_data)
        total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
        paginated_apartments = apartments_data[offset:offset + limit]

        # Calculate summary statistics
        total_outstanding = sum(apt["total_outstanding"] for apt in apartments_data)
        total_expected = sum(apt["monthly_rent"] for apt in apartments_data)
        total_paid_this_month = sum(apt["paid_this_month"] for apt in apartments_data)
        apartments_with_debt = len([apt for apt in apartments_data if apt["total_outstanding"] > 0])

        response = {
            "apartments": paginated_apartments,
            "pagination": {
                "current_page": page + 1,  # Convert back to 1-based
                "total_pages": total_pages,
                "total_items": total_count,
                "items_per_page": limit,
                "has_next_page": (page + 1) < total_pages,
                "has_prev_page": page > 0,
                "start_index": offset + 1 if paginated_apartments else 0,
                "end_index": min(offset + limit, total_count),
                "page_size_options": PAGE_SIZE_OPTIONS,
            },
            "period": {
                "type": period_type,
                "label": period_label,
                "start_date": start_period.isoformat(),
                "end_date": end_period.isoformat()
            },
            "summary": {
                "total_outstanding": total_outstanding,
                "total_expected": total_expected,
                "total_paid_this_month": total_paid_this_month,
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
    """FIXED: Get paginated net profit analysis for apartments"""
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

        # FIXED: Get apartments with proper search filtering
        apartments_query = Apartment.query

        # Apply search filter - FIXED to not use non-existent tenant relationship
        if search_term:
            apartments_query = apartments_query.filter(
                or_(
                    Apartment.address.ilike(f"%{search_term}%"),
                    Apartment.street_name.ilike(f"%{search_term}%"),
                    Apartment.house_number.ilike(f"%{search_term}%"),
                    Apartment.full_address.ilike(f"%{search_term}%")
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

                # FIXED: Get tenant information through proper relationship
                tenant_names = get_apartment_tenants(apartment.id)

                # Get payment information for the specified period
                payment_filters = [Payment.apartment_id == apartment.id, Payment.year == year]
                if month:
                    payment_filters.append(Payment.month == month)

                payments = Payment.query.filter(and_(*payment_filters)).all()
                total_collected = sum(extract_payment_amount(p) for p in payments)

                apartment_data = {
                    "apartment_id": apartment.id,
                    "address": apartment.get_short_address(),
                    "monthly_rent": float(apartment.rent or 0),
                    "monthly_profit": float(profit),
                    "profit_margin": (profit / float(apartment.rent) * 100) if apartment.rent and float(apartment.rent) > 0 else 0,
                    "model": apartment.model,
                    "rent_cost": float(apartment.rentCost or 0),
                    "management_fee": float(apartment.managementFee or 0),
                    "status": apartment.status,
                    "tenants": tenant_names,
                    "room_count": apartment.rooms,
                    "collected_amount": float(total_collected),
                }

                apartments_data.append(apartment_data)

            except Exception as e:
                current_app.logger.error(f"Error processing apartment {apartment.id}: {e}")
                continue

        # Apply sorting
        if sort_by == "profit_desc":
            apartments_data.sort(key=lambda x: x["monthly_profit"], reverse=True)
        elif sort_by == "profit_asc":
            apartments_data.sort(key=lambda x: x["monthly_profit"])
        elif sort_by == "rent_desc":
            apartments_data.sort(key=lambda x: x["monthly_rent"], reverse=True)
        elif sort_by == "margin_desc":
            apartments_data.sort(key=lambda x: x["profit_margin"], reverse=True)
        elif sort_by == "address":
            apartments_data.sort(key=lambda x: x["address"])

        # Pagination
        total_count = len(apartments_data)
        total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
        paginated_apartments = apartments_data[offset:offset + limit]
        has_next = (page + 1) < total_pages
        has_prev = page > 0

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

@fast_analytics_bp.route("/analytics/apartment-outstanding-details/<int:apartment_id>", methods=["GET"])
@token_required
@role_required("admin")
def get_apartment_outstanding_details(apartment_id):
    """FIXED: Get detailed outstanding payment information for a specific apartment"""
    try:
        # Period selection parameters
        period_type = request.args.get("period_type", "current_month")
        contract_period_id = request.args.get("contract_period_id", type=int)
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")

        # Get apartment
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"error": "Apartment not found"}), 404

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

        # Get current active contract
        current_contract = get_current_contract_for_apartment(apartment_id, end_period)

        if not current_contract:
            return jsonify({
                "apartment": {
                    "apartment_id": apartment_id,
                    "address": apartment.get_short_address(),
                    "status": apartment.status
                },
                "error": "No active contract found for this apartment",
                "period": {
                    "type": period_type,
                    "label": period_label,
                    "start_date": start_period.isoformat(),
                    "end_date": end_period.isoformat()
                }
            }), 404

        # Calculate outstanding amount
        outstanding = calculate_outstanding_for_contract(apartment, current_contract, end_period)

        # Get all payments for this contract within the period
        contract_payments = get_contract_payments(
            apartment_id,
            current_contract.id,
            current_contract.start_date,
            end_period
        )

        # Format payment details
        payment_details = []
        for payment in contract_payments:
            amount = extract_payment_amount(payment)

            # Get payment date with proper field handling
            payment_date = None
            if hasattr(payment, 'payment_date') and payment.payment_date:
                payment_date = payment.payment_date.isoformat()

            payment_details.append({
                "payment_id": payment.id,
                "amount": float(amount),
                "payment_date": payment_date,
                "payment_method": payment.payment_method,
                "status": payment.status,
                "month": payment.month,
                "year": payment.year
            })

        # Sort payments by date (most recent first)
        payment_details.sort(key=lambda x: (x["year"], x["month"]), reverse=True)

        # Calculate months elapsed and expected amount
        months_elapsed = 0
        current_month_calc = current_contract.start_date.replace(day=1)
        target_month = end_period.replace(day=1)

        while current_month_calc <= target_month:
            months_elapsed += 1
            if current_month_calc.month == 12:
                current_month_calc = current_month_calc.replace(year=current_month_calc.year + 1, month=1)
            else:
                current_month_calc = current_month_calc.replace(month=current_month_calc.month + 1)

        expected_total = float(current_contract.monthly_rent) * months_elapsed
        total_paid = sum(float(p["amount"]) for p in payment_details)

        # FIXED: Get tenant information through proper relationship
        tenant_names = get_apartment_tenants(apartment_id)

        # Create tenant breakdown for the details dialog
        tenant_breakdown = []
        if tenant_names and tenant_names != ["No tenants assigned"]:
            tenant_count = len(tenant_names)
            rent_per_tenant = float(current_contract.monthly_rent) / tenant_count if tenant_count > 0 else 0
            paid_per_tenant = total_paid / tenant_count if tenant_count > 0 else 0
            outstanding_per_tenant = max(0, rent_per_tenant - paid_per_tenant)

            for tenant_name in tenant_names:
                tenant_breakdown.append({
                    "tenant_id": None,  # We don't have direct tenant IDs in this context
                    "tenant_name": tenant_name,
                    "total_paid": paid_per_tenant,
                    "total_due": rent_per_tenant,
                    "outstanding": outstanding_per_tenant,
                    "payment_count": len(payment_details) if paid_per_tenant > 0 else 0,
                    "payments": payment_details if paid_per_tenant > 0 else []
                })

        response = {
            "apartment": {
                "apartment_id": apartment_id,
                "address": apartment.get_short_address(),
                "status": apartment.status,
                "tenants": tenant_names
            },
            "contract": {
                "contract_id": current_contract.id,
                "contract_number": current_contract.contract_number,
                "start_date": current_contract.start_date.isoformat(),
                "end_date": current_contract.end_date.isoformat() if current_contract.end_date else None,
                "monthly_rent": float(current_contract.monthly_rent),
                "status": current_contract.status
            },
            "summary": {
                "months_elapsed": months_elapsed,
                "expected_amount": float(expected_total),
                "total_paid": float(total_paid),
                "total_outstanding": float(outstanding),
                "collection_rate": (total_paid / expected_total * 100) if expected_total > 0 else 100,
                "payment_count": len(payment_details)
            },
            "tenant_breakdown": tenant_breakdown,
            "payments": payment_details,
            "period": {
                "type": period_type,
                "label": period_label,
                "start_date": start_period.isoformat(),
                "end_date": end_period.isoformat()
            }
        }

        return jsonify(response), 200

    except Exception as e:
        current_app.logger.error(f"Error getting apartment outstanding details: {e}")
        return jsonify({"message": "Error retrieving apartment details", "error": str(e)}), 500
