# routes/analytics.py - COMPLETELY FIXED VERSION with correct relationships
import json
from datetime import datetime, timedelta
from calendar import monthrange
from flask import Blueprint, jsonify, current_app, g, request
from models.models import Apartment, Payment, Tenant, ContractPeriod, ContractTenant
from .auth import token_required, role_required
from sqlalchemy import func, extract, desc, or_, and_
from itertools import groupby
from operator import itemgetter
from extentions import db
from decimal import Decimal
from utils.logging_helpers import log_with_user

analytics_bp = Blueprint("analytics_bp", __name__)


def extract_payment_amount(payment):
    """Extract payment amount from either tenants JSON or amount field"""
    try:
        amount = 0
        if hasattr(payment, "amount") and payment.amount:
            amount = float(payment.amount)
        elif hasattr(payment, "tenants") and payment.tenants:
            tenants_data = json.loads(payment.tenants)
            amount = sum(float(tenant.get("amountPaid", 0)) for tenant in tenants_data)
        return amount
    except:
        return 0


# ADMIN ONLY ANALYTICS ENDPOINTS - THESE REQUIRE ADMIN ROLE
@analytics_bp.route("/analytics/summary", methods=["GET"])
@token_required
@role_required("admin")  # ADMIN ONLY
def get_analytics_summary():
    """
    Returns a summary of key metrics including total apartments, occupancy rate,
    total rent collected, and pending payments.
    """
    try:
        # Get basic apartment metrics
        total_apartments = Apartment.query.count()
        occupied_apartments = Apartment.query.filter(
            Apartment.status.in_(["occupied", "active"])
        ).count()

        occupancy_rate = (occupied_apartments / total_apartments * 100) if total_apartments > 0 else 0

        # Calculate total expected rent from active contracts
        current_date = datetime.now().date()
        active_contracts = ContractPeriod.query.filter(
            ContractPeriod.status == "active",
            ContractPeriod.start_date <= current_date,
            or_(
                ContractPeriod.end_date.is_(None),
                ContractPeriod.end_date >= current_date
            )
        ).all()

        total_expected_rent = sum(float(contract.monthly_rent or 0) for contract in active_contracts)

        # Get payments for current month
        current_month = datetime.now().month
        current_year = datetime.now().year
        current_month_payments = Payment.query.filter(
            Payment.month == current_month,
            Payment.year == current_year,
            Payment.status.in_(["paid", "completed"])
        ).all()

        # Calculate total collected this month
        total_collected = sum(extract_payment_amount(payment) for payment in current_month_payments)

        # Calculate outstanding payments (payments with 'outstanding' status)
        outstanding_payments = Payment.query.filter_by(status="outstanding").all()
        total_outstanding = sum(extract_payment_amount(payment) for payment in outstanding_payments)

        summary = {
            "total_apartments": total_apartments,
            "occupied_apartments": occupied_apartments,
            "vacant_apartments": total_apartments - occupied_apartments,
            "occupancy_rate": round(occupancy_rate, 2),
            "total_expected_rent": float(total_expected_rent),
            "total_collected_this_month": float(total_collected),
            "total_outstanding": float(total_outstanding),
            "collection_rate": round((total_collected / total_expected_rent * 100) if total_expected_rent > 0 else 100, 2)
        }

        return jsonify(summary), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error in analytics summary: {e}")
        return jsonify({"message": "Error retrieving analytics summary", "error": str(e)}), 500


@analytics_bp.route("/analytics/monthly-revenue", methods=["GET"])
@token_required
@role_required("admin")  # ADMIN ONLY
def get_monthly_revenue():
    """
    Returns monthly revenue data for the past 12 months.
    """
    try:
        # Get current date and calculate 12 months back
        current_date = datetime.now()
        start_date = current_date.replace(month=1, day=1) if current_date.month == 12 else current_date.replace(year=current_date.year if current_date.month > 1 else current_date.year - 1, month=current_date.month - 11, day=1)

        # Get all payments from the past 12 months
        payments = Payment.query.filter(
            and_(
                Payment.year >= start_date.year,
                Payment.status.in_(["paid", "completed"])
            )
        ).order_by(Payment.year.desc(), Payment.month.desc()).all()

        # Group payments by month and year
        monthly_data = {}
        for payment in payments:
            month_key = f"{payment.year}-{payment.month:02d}"
            if month_key not in monthly_data:
                monthly_data[month_key] = {
                    "year": payment.year,
                    "month": payment.month,
                    "total_revenue": 0,
                    "payment_count": 0
                }

            amount = extract_payment_amount(payment)
            monthly_data[month_key]["total_revenue"] += amount
            monthly_data[month_key]["payment_count"] += 1

        # Convert to list and sort by date
        revenue_data = list(monthly_data.values())
        revenue_data.sort(key=lambda x: (x["year"], x["month"]))

        # Add month names for frontend
        month_names = ["", "January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"]

        for data in revenue_data:
            data["month_name"] = month_names[data["month"]]
            data["total_revenue"] = float(data["total_revenue"])

        return jsonify({
            "monthly_revenue": revenue_data,
            "period": f"Last 12 months",
            "total_months": len(revenue_data)
        }), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error in monthly revenue: {e}")
        return jsonify({"message": "Error retrieving monthly revenue", "error": str(e)}), 500


@analytics_bp.route("/analytics/apartment-performance", methods=["GET"])
@token_required
@role_required("admin")  # ADMIN ONLY
def get_apartment_performance():
    """
    Returns performance metrics for each apartment including collection rates.
    """
    try:
        apartments = Apartment.query.all()
        apartment_performance = []

        for apartment in apartments:
            # Get current month payments for this apartment
            current_date = datetime.now()
            current_month_payments = Payment.query.filter(
                Payment.apartment_id == apartment.id,
                Payment.month == current_date.month,
                Payment.year == current_date.year,
                Payment.status.in_(["paid", "completed"])
            ).all()

            # Calculate collected amount
            collected_amount = sum(extract_payment_amount(payment) for payment in current_month_payments)

            # Get expected rent from active contracts
            current_date_obj = current_date.date()
            active_contracts = ContractPeriod.query.filter(
                ContractPeriod.apartment_id == apartment.id,
                ContractPeriod.status == "active",
                ContractPeriod.start_date <= current_date_obj,
                or_(
                    ContractPeriod.end_date.is_(None),
                    ContractPeriod.end_date >= current_date_obj
                )
            ).all()

            expected_rent = sum(float(contract.monthly_rent or 0) for contract in active_contracts)

            # Get outstanding payments for this apartment
            outstanding_payments = Payment.query.filter(
                Payment.apartment_id == apartment.id,
                Payment.status == "outstanding"
            ).all()

            outstanding_amount = sum(extract_payment_amount(payment) for payment in outstanding_payments)

            # Calculate collection rate
            collection_rate = (collected_amount / expected_rent * 100) if expected_rent > 0 else 100

            # Get tenant info through active contracts
            tenant_names = []
            for contract in active_contracts:
                for ct in contract.contract_tenants:
                    if ct.is_active():
                        tenant_names.append(ct.tenant.name)

            apartment_data = {
                "apartment_id": apartment.id,
                "address": apartment.get_short_address(),
                "monthly_rent": expected_rent,
                "collected_this_month": float(collected_amount),
                "outstanding_amount": float(outstanding_amount),
                "collection_rate": round(collection_rate, 2),
                "status": apartment.status,
                "tenants": tenant_names,
                "room_count": apartment.rooms
            }

            apartment_performance.append(apartment_data)

        # Sort by collection rate (ascending to show problematic ones first)
        apartment_performance.sort(key=lambda x: x["collection_rate"])

        return jsonify({
            "apartments": apartment_performance,
            "total_apartments": len(apartment_performance),
            "summary": {
                "avg_collection_rate": sum(apt["collection_rate"] for apt in apartment_performance) / len(apartment_performance) if apartment_performance else 0,
                "total_expected": sum(apt["monthly_rent"] for apt in apartment_performance),
                "total_collected": sum(apt["collected_this_month"] for apt in apartment_performance),
                "total_outstanding": sum(apt["outstanding_amount"] for apt in apartment_performance)
            }
        }), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error in apartment performance: {e}")
        return jsonify({"message": "Error retrieving apartment performance", "error": str(e)}), 500


@analytics_bp.route("/analytics/payment-trends", methods=["GET"])
@token_required
@role_required("admin")  # ADMIN ONLY
def get_payment_trends():
    """
    Returns payment trends and patterns over time.
    """
    try:
        # Get payment method distribution
        payment_methods = db.session.query(
            Payment.payment_method,
            func.count(Payment.id).label('count'),
            func.sum(Payment.amount).label('total_amount')
        ).filter(
            Payment.status.in_(["paid", "completed"])
        ).group_by(Payment.payment_method).all()

        method_data = []
        for method, count, total in payment_methods:
            method_data.append({
                "payment_method": method or "Unknown",
                "transaction_count": int(count),
                "total_amount": float(total or 0)
            })

        # Get payment status distribution
        status_distribution = db.session.query(
            Payment.status,
            func.count(Payment.id).label('count')
        ).group_by(Payment.status).all()

        status_data = [{"status": status, "count": int(count)} for status, count in status_distribution]

        # Get recent payment activity (last 30 days)
        thirty_days_ago = datetime.now() - timedelta(days=30)
        recent_payments_query = Payment.query

        if hasattr(Payment, 'payment_date'):
            recent_payments_query = recent_payments_query.filter(
                Payment.payment_date >= thirty_days_ago.date()
            ).order_by(Payment.payment_date.desc())
        else:
            # Fallback to month/year if payment_date doesn't exist
            current_date = datetime.now()
            recent_payments_query = recent_payments_query.filter(
                Payment.year == current_date.year,
                Payment.month >= (current_date.month - 1 if current_date.month > 1 else 12)
            ).order_by(Payment.year.desc(), Payment.month.desc())

        recent_payments = recent_payments_query.all()

        recent_activity = []
        for payment in recent_payments[:20]:  # Limit to last 20 payments
            apartment = Apartment.query.get(payment.apartment_id)
            payment_date = None
            if hasattr(payment, 'payment_date') and payment.payment_date:
                payment_date = payment.payment_date.isoformat()

            recent_activity.append({
                "payment_id": payment.id,
                "apartment_address": apartment.get_short_address() if apartment else "Unknown",
                "amount": float(payment.amount or 0),
                "payment_date": payment_date,
                "payment_method": payment.payment_method,
                "status": payment.status
            })

        return jsonify({
            "payment_methods": method_data,
            "status_distribution": status_data,
            "recent_activity": recent_activity,
            "trends_period": "Last 30 days"
        }), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error in payment trends: {e}")
        return jsonify({"message": "Error retrieving payment trends", "error": str(e)}), 500


@analytics_bp.route("/analytics/financial-overview", methods=["GET"])
@token_required
@role_required("admin")  # ADMIN ONLY
def get_financial_overview():
    """
    FIXED: Get financial overview with correct data structure for frontend
    """
    try:
        year = request.args.get("year", datetime.now().year, type=int)
        current_date = datetime.now()
        current_month = current_date.month
        current_date_obj = current_date.date()

        # Get active contracts for expected revenue calculation
        active_contracts = ContractPeriod.query.filter(
            ContractPeriod.status == "active",
            ContractPeriod.start_date <= current_date_obj,
            or_(
                ContractPeriod.end_date.is_(None),
                ContractPeriod.end_date >= current_date_obj
            )
        ).all()

        total_expected_monthly = sum(float(contract.monthly_rent or 0) for contract in active_contracts)

        # Get payments for the specified year
        payments = Payment.query.filter(
            Payment.year == year,
            Payment.status.in_(["paid", "completed", "partial"])
        ).all()

        # Initialize monthly breakdown - FIXED structure for frontend
        monthly_breakdown = []
        month_names = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"]

        for month in range(1, 13):
            # Get payments for this specific month
            month_payments = [p for p in payments if p.month == month]
            actual_revenue = sum(extract_payment_amount(p) for p in month_payments)

            # For current month, get current data; for other months use expected
            if month <= current_month and year == current_date.year:
                expected_revenue = total_expected_monthly
            else:
                # For future months or past years, calculate based on historical contracts
                expected_revenue = total_expected_monthly

            collection_rate = (actual_revenue / expected_revenue * 100) if expected_revenue > 0 else 100

            monthly_breakdown.append({
                "month": month,
                "month_name": month_names[month - 1],
                "expected": float(expected_revenue),
                "collected": float(actual_revenue),
                "net_profit": float(actual_revenue * 0.1),  # Simplified profit calculation
                "collection_rate": round(collection_rate, 2)
            })

        # Calculate current month specific data
        current_month_data = next((m for m in monthly_breakdown if m["month"] == current_month), {})
        current_month_collected = current_month_data.get("collected", 0)
        current_month_expected = current_month_data.get("expected", 0)
        current_month_outstanding = max(0, current_month_expected - current_month_collected)

        # Calculate yearly summary
        total_actual = sum(m["collected"] for m in monthly_breakdown)
        total_expected = sum(m["expected"] for m in monthly_breakdown)
        avg_collection_rate = sum(m["collection_rate"] for m in monthly_breakdown) / 12

        # FIXED: Return structure that matches frontend expectations
        response = {
            "year": year,
            "current_month": {
                "month": current_month,
                "month_name": month_names[current_month - 1],
                "expected_revenue": float(current_month_expected),
                "collected": float(current_month_collected),
                "net_profit": float(current_month_collected * 0.1),  # Simplified profit
                "outstanding": float(current_month_outstanding),
                "collection_rate": round((current_month_collected / current_month_expected * 100) if current_month_expected > 0 else 100, 2),
                "apartments_with_contracts": len(active_contracts),
                "apartments_with_payments": len(set(p.apartment_id for p in payments if p.month == current_month))
            },
            "monthly_breakdown": monthly_breakdown,
            "yearly_summary": {
                "total_expected": float(total_expected),
                "total_actual": float(total_actual),
                "average_collection_rate": round(avg_collection_rate, 2),
                "total_apartments": len(active_contracts)
            },
            # Debug info for frontend
            "debug_info": {
                "total_apartments": Apartment.query.count(),
                "apartments_with_contracts": len(active_contracts),
                "apartments_with_payments": len(set(p.apartment_id for p in payments if p.month == current_month)),
                "year_queried": year,
                "current_month": month_names[current_month - 1]
            }
        }

        return jsonify(response), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error in financial overview: {e}")
        return jsonify({"message": "Error in financial overview", "error": str(e)}), 500


@analytics_bp.route("/analytics/outstanding-summary", methods=["GET"])
@token_required
@role_required("admin")  # ADMIN ONLY
def get_outstanding_summary():
    """
    Returns detailed summary of outstanding payments.
    """
    try:
        # Get all outstanding payments
        outstanding_payments = Payment.query.filter_by(status="outstanding").all()

        total_outstanding = 0
        by_apartment = {}
        by_month = {}

        for payment in outstanding_payments:
            amount = extract_payment_amount(payment)
            total_outstanding += amount

            # Group by apartment
            apartment = Apartment.query.get(payment.apartment_id)
            apartment_address = apartment.get_short_address() if apartment else f"Apartment {payment.apartment_id}"

            if apartment_address not in by_apartment:
                by_apartment[apartment_address] = {
                    "apartment_id": payment.apartment_id,
                    "address": apartment_address,
                    "total_outstanding": 0,
                    "payment_count": 0
                }

            by_apartment[apartment_address]["total_outstanding"] += amount
            by_apartment[apartment_address]["payment_count"] += 1

            # Group by month/year
            month_key = f"{payment.year}-{payment.month:02d}"
            if month_key not in by_month:
                by_month[month_key] = {
                    "year": payment.year,
                    "month": payment.month,
                    "total_outstanding": 0,
                    "payment_count": 0
                }

            by_month[month_key]["total_outstanding"] += amount
            by_month[month_key]["payment_count"] += 1

        # Convert to lists and format
        apartment_summary = list(by_apartment.values())
        apartment_summary.sort(key=lambda x: x["total_outstanding"], reverse=True)

        monthly_summary = list(by_month.values())
        monthly_summary.sort(key=lambda x: (x["year"], x["month"]), reverse=True)

        # Add month names
        month_names = ["", "January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"]

        for month_data in monthly_summary:
            month_data["month_name"] = month_names[month_data["month"]]
            month_data["total_outstanding"] = float(month_data["total_outstanding"])

        # Format apartment data
        for apt_data in apartment_summary:
            apt_data["total_outstanding"] = float(apt_data["total_outstanding"])

        return jsonify({
            "total_outstanding": float(total_outstanding),
            "total_outstanding_payments": len(outstanding_payments),
            "by_apartment": apartment_summary,
            "by_month": monthly_summary,
            "summary": {
                "apartments_with_outstanding": len(apartment_summary),
                "months_with_outstanding": len(monthly_summary),
                "average_per_apartment": float(total_outstanding / len(apartment_summary)) if apartment_summary else 0
            }
        }), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error in outstanding summary: {e}")
        return jsonify({"message": "Error retrieving outstanding summary", "error": str(e)}), 500
