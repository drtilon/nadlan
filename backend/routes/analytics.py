# routes/analytics.py
import json
from datetime import datetime, timedelta
from calendar import monthrange
from flask import Blueprint, jsonify, current_app, g
from models.models import Apartment, Payment, Tenant
from .auth import token_required, role_required
from sqlalchemy import func, extract, desc, or_, and_
from itertools import groupby
from operator import itemgetter
from extentions import db
from decimal import Decimal

analytics_bp = Blueprint("analytics_bp", __name__)


# ADMIN ONLY ANALYTICS ENDPOINTS - THESE REQUIRE ADMIN ROLE
@analytics_bp.route("/analytics/summary", methods=["GET"])
@token_required
@role_required("admin")  # ADMIN ONLY - This is the key fix
def get_analytics_summary():
    """
    Returns a summary of key metrics including total apartments, occupancy rate,
    total rent collected, and pending payments.
    ADMIN ONLY ENDPOINT
    """
    try:
        # This endpoint should only be accessible to admins
        # All apartments for admin analytics
        total_apartments = Apartment.query.count()

        if total_apartments == 0:
            return jsonify({
                "total_apartments": 0,
                "occupied_apartments": 0,
                "vacant_apartments": 0,
                "occupancy_rate": 0,
                "total_monthly_rent": 0,
                "collected_this_month": 0,
                "pending_payments": 0,
                "overdue_payments": 0
            }), 200

        # Occupancy statistics
        occupied_apartments = Apartment.query.filter(or_(
            Apartment.status == 'occupied',
            Apartment.status == 'משוכר',
            Apartment.status == 'Rented'
        )).count()

        vacant_apartments = total_apartments - occupied_apartments
        occupancy_rate = (occupied_apartments / total_apartments) * 100 if total_apartments > 0 else 0

        # Financial statistics
        total_monthly_rent = db.session.query(func.sum(Apartment.rent)).scalar() or 0

        # Current month payment statistics
        current_month = datetime.now().month
        current_year = datetime.now().year

        collected_this_month = db.session.query(func.sum(Payment.amount)).filter(
            extract('month', Payment.payment_date) == current_month,
            extract('year', Payment.payment_date) == current_year,
            Payment.status == 'completed'
        ).scalar() or 0

        pending_payments = Payment.query.filter(Payment.status == 'pending').count()

        # Overdue payments (assuming there's a due_date field)
        overdue_payments = Payment.query.filter(
            Payment.status == 'pending',
            Payment.due_date < datetime.now().date() if hasattr(Payment, 'due_date') else False
        ).count()

        return jsonify({
            "total_apartments": total_apartments,
            "occupied_apartments": occupied_apartments,
            "vacant_apartments": vacant_apartments,
            "occupancy_rate": round(occupancy_rate, 2),
            "total_monthly_rent": float(total_monthly_rent),
            "collected_this_month": float(collected_this_month),
            "pending_payments": pending_payments,
            "overdue_payments": overdue_payments
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting analytics summary: {e}")
        return jsonify({"message": "Error getting analytics summary", "error": str(e)}), 500


@analytics_bp.route("/analytics/payment-trends", methods=["GET"])
@token_required
@role_required("admin")  # ADMIN ONLY
def get_payment_trends():
    """
    Returns payment collection trends for the last 12 months including expected vs collected amounts.
    ADMIN ONLY ENDPOINT
    """
    try:
        # Get all payments for processing
        all_payments = Payment.query.all()

        # Prepare monthly data
        months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]

        # Get current month index (0-based)
        current_month_idx = datetime.now().month - 1

        # Reorder months to show the last 12 months
        last_12_months = months[current_month_idx:] + months[:current_month_idx]

        # Initialize monthly data structure
        monthly_data = {}
        for month in last_12_months:
            monthly_data[month] = {
                "expected": 0,
                "collected": 0,
                "count": {"paid": 0, "partial": 0, "not_paid": 0}
            }

        # Process payments by month
        for payment in all_payments:
            if hasattr(payment, 'month') and payment.month in monthly_data:
                month = payment.month

                # Expected amount (total rent for that month)
                expected_amount = float(payment.rent or 0)
                monthly_data[month]["expected"] += expected_amount

                # Collected amount
                collected_amount = float(payment.amount or 0)
                monthly_data[month]["collected"] += collected_amount

                # Count payment status
                if hasattr(payment, 'status'):
                    status = payment.status.lower() if payment.status else "not_paid"
                    if status in ["paid", "completed"]:
                        monthly_data[month]["count"]["paid"] += 1
                    elif status in ["partial", "partially_paid"]:
                        monthly_data[month]["count"]["partial"] += 1
                    else:
                        monthly_data[month]["count"]["not_paid"] += 1

        # Format for chart data
        chart_data = []
        for month in last_12_months:
            chart_data.append({
                "month": month,
                "expected": monthly_data[month]["expected"],
                "collected": monthly_data[month]["collected"],
                "paid": monthly_data[month]["count"]["paid"],
                "partial": monthly_data[month]["count"]["partial"],
                "not_paid": monthly_data[month]["count"]["not_paid"],
            })

        return jsonify(chart_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting payment trends: {e}")
        return jsonify({"message": "Error getting payment trends", "error": str(e)}), 500


@analytics_bp.route("/analytics/apartment-metrics", methods=["GET"])
@token_required
@role_required("admin")  # ADMIN ONLY
def get_apartment_metrics():
    """
    Returns metrics for individual apartments including occupancy status,
    rent collection, and net profit calculations.
    ADMIN ONLY ENDPOINT
    """
    try:
        apartments = Apartment.query.all()
        apartment_metrics = []

        for apartment in apartments:
            # Calculate metrics for each apartment
            total_payments = db.session.query(func.sum(Payment.amount)).filter(
                Payment.apartment_id == apartment.id,
                Payment.status == 'completed'
            ).scalar() or 0

            # Get recent payment status
            recent_payment = Payment.query.filter(
                Payment.apartment_id == apartment.id
            ).order_by(Payment.payment_date.desc()).first()

            payment_status = recent_payment.status if recent_payment else "no_payments"

            apartment_metrics.append({
                "id": apartment.id,
                "address": apartment.address,
                "rent": float(apartment.rent or 0),
                "status": apartment.status,
                "total_collected": float(total_payments),
                "payment_status": payment_status,
                "tenant_name": apartment.current_tenant_name if hasattr(apartment, 'current_tenant_name') else None,
                "contract_end_date": apartment.contractEndDate.isoformat() if apartment.contractEndDate else None
            })

        return jsonify(apartment_metrics), 200

    except Exception as e:
        current_app.logger.error(f"Error getting apartment metrics: {e}")
        return jsonify({"message": "Error getting apartment metrics", "error": str(e)}), 500


@analytics_bp.route("/analytics/expense-breakdown", methods=["GET"])
@token_required
@role_required("admin")  # ADMIN ONLY
def get_expense_breakdown():
    """
    Returns expense breakdown by category for the last 12 months.
    ADMIN ONLY ENDPOINT
    """
    try:
        # Get all payments for processing
        all_payments = Payment.query.all()

        # Prepare monthly data
        months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]

        # Get current month index (0-based)
        current_month_idx = datetime.now().month - 1

        # Reorder months to show the last 12 months
        last_12_months = months[current_month_idx:] + months[:current_month_idx]

        # Initialize data
        expense_data = []

        for month in last_12_months:
            month_payments = [p for p in all_payments if hasattr(p, 'month') and p.month == month]

            # Sum up expenses for the month
            internet_total = sum(float(p.internet or 0) for p in month_payments if hasattr(p, 'internet'))
            electricity_total = sum(float(p.electricity or 0) for p in month_payments if hasattr(p, 'electricity'))
            other_total = sum(float(p.other or 0) for p in month_payments if hasattr(p, 'other'))

            expense_data.append({
                "month": month,
                "internet": internet_total,
                "electricity": electricity_total,
                "other": other_total,
                "total": internet_total + electricity_total + other_total,
            })

        return jsonify(expense_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting expense analytics: {e}")
        return jsonify({"message": "Error getting expense analytics", "error": str(e)}), 500


# USER ANALYTICS ENDPOINTS - Available to all users but filtered by their access
@analytics_bp.route("/user-analytics/summary", methods=["GET"])
@token_required
def get_user_analytics_summary():
    """
    Get analytics summary for regular users (filtered by their access)
    Available to all authenticated users
    """
    try:
        user_role = g.user.get("role", "limited")
        user_id = g.user.get("sub")

        # Filter query based on user role
        if user_role != "admin":
            # Regular users only see their managed properties
            # Adjust these field names based on your actual database schema
            base_query = Apartment.query.filter(
                or_(
                    Apartment.manager_id == user_id,
                    Apartment.owner_id == user_id
                )
            )
        else:
            # Admins see all (but this endpoint is mainly for regular users)
            base_query = Apartment.query

        total_properties = base_query.count()

        if total_properties == 0:
            return jsonify({
                "total_properties": 0,
                "occupied": 0,
                "vacant": 0,
                "occupancy_rate": 0,
                "expiring_soon": 0,
                "total_rent": 0
            }), 200

        occupied = base_query.filter(or_(
            Apartment.status == 'occupied',
            Apartment.status == 'משוכר',
            Apartment.status == 'Rented'
        )).count()

        vacant = base_query.filter(or_(
            Apartment.status == 'vacant',
            Apartment.status == 'פנוי',
            Apartment.status == 'Available'
        )).count()

        # Contracts expiring in next 30 days
        thirty_days_later = datetime.now().date() + timedelta(days=30)
        expiring_soon = base_query.filter(
            and_(
                Apartment.contractEndDate.isnot(None),
                Apartment.contractEndDate <= thirty_days_later,
                Apartment.contractEndDate >= datetime.now().date()
            )
        ).count()

        # Total rent (for non-admin users, only their properties)
        total_rent = base_query.with_entities(func.sum(Apartment.rent)).scalar() or 0

        return jsonify({
            "total_properties": total_properties,
            "occupied": occupied,
            "vacant": vacant,
            "occupancy_rate": round((occupied / total_properties * 100) if total_properties > 0 else 0, 2),
            "expiring_soon": expiring_soon,
            "total_rent": float(total_rent)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting user analytics summary: {e}")
        return jsonify({"message": "Error getting analytics summary", "error": str(e)}), 500


@analytics_bp.route("/user-analytics/properties", methods=["GET"])
@token_required
def get_user_property_analytics():
    """
    Get property analytics for regular users (filtered by their access)
    Available to all authenticated users
    """
    try:
        user_role = g.user.get("role", "limited")
        user_id = g.user.get("sub")

        # Filter query based on user role
        if user_role != "admin":
            base_query = Apartment.query.filter(
                or_(
                    Apartment.manager_id == user_id,
                    Apartment.owner_id == user_id
                )
            )
        else:
            base_query = Apartment.query

        # Property status distribution
        status_distribution = db.session.query(
            Apartment.status,
            func.count(Apartment.id).label('count')
        )

        if user_role != "admin":
            status_distribution = status_distribution.filter(
                or_(
                    Apartment.manager_id == user_id,
                    Apartment.owner_id == user_id
                )
            )

        status_distribution = status_distribution.group_by(Apartment.status).all()

        property_data = []
        for status, count in status_distribution:
            property_data.append({
                "status": status,
                "count": count
            })

        return jsonify({
            "property_distribution": property_data
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting user property analytics: {e}")
        return jsonify({"message": "Error getting property analytics", "error": str(e)}), 500


@analytics_bp.route("/user-analytics/tenants", methods=["GET"])
@token_required
def get_user_tenant_analytics():
    """
    Get tenant analytics for regular users (filtered by their access)
    Available to all authenticated users
    """
    try:
        user_role = g.user.get("role", "limited")
        user_id = g.user.get("sub")

        # Base query for tenants associated with user's apartments
        if user_role != "admin":
            # Get tenants only for apartments managed by this user
            tenant_query = db.session.query(Tenant).join(
                Apartment, Tenant.apartment_id == Apartment.id
            ).filter(
                or_(
                    Apartment.manager_id == user_id,
                    Apartment.owner_id == user_id
                )
            )
        else:
            tenant_query = db.session.query(Tenant)

        total_tenants = tenant_query.count()

        # Get tenants with upcoming lease expiry (next 30 days)
        thirty_days_later = datetime.now().date() + timedelta(days=30)

        expiring_leases_query = tenant_query
        if hasattr(Tenant, 'lease_end_date'):
            expiring_leases_query = expiring_leases_query.filter(
                and_(
                    Tenant.lease_end_date.isnot(None),
                    Tenant.lease_end_date <= thirty_days_later,
                    Tenant.lease_end_date >= datetime.now().date()
                )
            )
            expiring_leases = expiring_leases_query.count()
        else:
            expiring_leases = 0

        return jsonify({
            "total_tenants": total_tenants,
            "expiring_leases": expiring_leases
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting user tenant analytics: {e}")
        return jsonify({"message": "Error getting tenant analytics", "error": str(e)}), 500


@analytics_bp.route("/user-analytics/payments", methods=["GET"])
@token_required
def get_user_payment_analytics():
    """
    Get payment analytics for regular users (filtered by their access)
    Available to all authenticated users
    """
    try:
        user_role = g.user.get("role", "limited")
        user_id = g.user.get("sub")

        # Base query for payments associated with user's apartments
        if user_role != "admin":
            payment_query = db.session.query(Payment).join(
                Apartment, Payment.apartment_id == Apartment.id
            ).filter(
                or_(
                    Apartment.manager_id == user_id,
                    Apartment.owner_id == user_id
                )
            )
        else:
            payment_query = db.session.query(Payment)

        # Payment status distribution
        payment_status_dist = payment_query.with_entities(
            Payment.status,
            func.count(Payment.id).label('count'),
            func.sum(Payment.amount).label('total')
        ).group_by(Payment.status).all()

        payment_distribution = []
        for status, count, total in payment_status_dist:
            payment_distribution.append({
                "status": status,
                "count": count,
                "total": float(total or 0)
            })

        # Recent payment trends (last 3 months for regular users)
        three_months_ago = datetime.now() - timedelta(days=90)

        recent_payments = payment_query.with_entities(
            extract('year', Payment.payment_date).label('year'),
            extract('month', Payment.payment_date).label('month'),
            func.count(Payment.id).label('payment_count'),
            func.sum(Payment.amount).label('total_amount')
        ).filter(
            Payment.payment_date >= three_months_ago
        ).group_by(
            extract('year', Payment.payment_date),
            extract('month', Payment.payment_date)
        ).order_by(
            extract('year', Payment.payment_date),
            extract('month', Payment.payment_date)
        ).all()

        payment_trends = []
        for year, month, count, total in recent_payments:
            payment_trends.append({
                "month": f"{int(year)}-{int(month):02d}",
                "payment_count": count,
                "total_amount": float(total or 0)
            })

        return jsonify({
            "payment_distribution": payment_distribution,
            "payment_trends": payment_trends
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting user payment analytics: {e}")
        return jsonify({"message": "Error getting payment analytics", "error": str(e)}), 500
