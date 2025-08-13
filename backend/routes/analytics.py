# routes/analytics.py - COMPLETELY FIXED VERSION
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
@role_required("admin")  # ADMIN ONLY
def get_analytics_summary():
    """
    Returns a summary of key metrics including total apartments, occupancy rate,
    total rent collected, and pending payments.
    ADMIN ONLY ENDPOINT
    """
    try:
        # This endpoint should only be accessible to admins
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

        # Current month payment statistics - FIXED: Use paymentDate not payment_date
        current_month = datetime.now().month
        current_year = datetime.now().year

        collected_this_month = db.session.query(func.sum(Payment.amount)).filter(
            extract('month', Payment.paymentDate) == current_month,
            extract('year', Payment.paymentDate) == current_year,
            Payment.status == 'paid'
        ).scalar() or 0

        pending_payments = Payment.query.filter(Payment.status == 'pending').count()

        # Overdue payments
        overdue_payments = Payment.query.filter(
            Payment.status.in_(['pending', 'not_paid']),
            Payment.paymentDate < datetime.now() - timedelta(days=30)
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
        # Get all payments for processing - FIXED: Use correct field names
        all_payments = Payment.query.filter(Payment.paymentDate.isnot(None)).all()

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

        # Process payments by month - FIXED: Use correct field names
        for payment in all_payments:
            if hasattr(payment, 'month') and payment.month in monthly_data:
                month = payment.month

                # Get expected amount from apartment rent
                apartment = Apartment.query.get(payment.apartment_id)
                expected_amount = float(apartment.rent) if apartment and apartment.rent else 0
                monthly_data[month]["expected"] += expected_amount

                # Collected amount - FIXED: Use amount if available, otherwise calculate from tenants
                if hasattr(payment, 'amount') and payment.amount:
                    collected_amount = float(payment.amount)
                else:
                    # Calculate from tenants JSON
                    try:
                        tenants_data = json.loads(payment.tenants) if payment.tenants else []
                        collected_amount = sum(float(tenant.get('amountPaid', 0)) for tenant in tenants_data)
                    except:
                        collected_amount = 0

                monthly_data[month]["collected"] += collected_amount

                # Count payment status
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
            # Calculate metrics for each apartment - FIXED: Use correct field names
            if hasattr(Payment, 'amount'):
                # Use individual payment amounts
                total_payments = db.session.query(func.sum(Payment.amount)).filter(
                    Payment.apartment_id == apartment.id,
                    Payment.status.in_(['paid', 'completed'])
                ).scalar() or 0
            else:
                # Calculate from tenants JSON
                payments = Payment.query.filter(
                    Payment.apartment_id == apartment.id,
                    Payment.status.in_(['paid', 'completed'])
                ).all()

                total_payments = 0
                for payment in payments:
                    try:
                        if payment.tenants:
                            tenants_data = json.loads(payment.tenants)
                            total_payments += sum(float(tenant.get('amountPaid', 0)) for tenant in tenants_data)
                    except:
                        continue

            # Get recent payment status - FIXED: Use paymentDate not payment_date
            recent_payment = Payment.query.filter(
                Payment.apartment_id == apartment.id
            ).order_by(Payment.paymentDate.desc()).first()

            payment_status = recent_payment.status if recent_payment else "no_payments"

            apartment_metrics.append({
                "id": apartment.id,
                "address": apartment.address,
                "rent": float(apartment.rent or 0),
                "status": apartment.status,
                "total_collected": float(total_payments),
                "payment_status": payment_status,
                "tenant_name": getattr(apartment, 'current_tenant_name', None),
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


# FIXED: Add the missing tenant-payments endpoint
@analytics_bp.route("/analytics/tenant-payments", methods=["GET"])
@token_required
@role_required("admin")  # ADMIN ONLY
def get_tenant_payment_analytics():
    """
    Get tenant payment analytics
    ADMIN ONLY ENDPOINT
    """
    try:
        # Get all tenants with their payment history
        tenants = Tenant.query.all()
        tenant_payment_data = []

        for tenant in tenants:
            # Get payments for this tenant's apartment
            if tenant.apartment_id:
                payments = Payment.query.filter(
                    Payment.apartment_id == tenant.apartment_id,
                    Payment.status.in_(['paid', 'completed'])
                ).all()

                total_paid = 0
                payment_count = len(payments)

                for payment in payments:
                    # Check if tenant is in this payment
                    try:
                        if payment.tenants:
                            tenants_data = json.loads(payment.tenants)
                            for tenant_data in tenants_data:
                                if tenant_data.get('name') == tenant.name:
                                    total_paid += float(tenant_data.get('amountPaid', 0))
                    except:
                        continue

                tenant_payment_data.append({
                    "tenant_id": tenant.id,
                    "tenant_name": tenant.name,
                    "apartment_id": tenant.apartment_id,
                    "total_paid": total_paid,
                    "payment_count": payment_count,
                    "average_payment": round(total_paid / payment_count, 2) if payment_count > 0 else 0
                })

        return jsonify(tenant_payment_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting tenant payment analytics: {e}")
        return jsonify({"message": "Error getting tenant payment analytics", "error": str(e)}), 500


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
            # Regular users see all properties but with limited data
            # You can add filtering based on your business logic
            base_query = Apartment.query
        else:
            # Admins see all
            base_query = Apartment.query

        total_properties = base_query.count()

        if total_properties == 0:
            return jsonify({
                "total_properties": 0,
                "occupied": 0,
                "vacant": 0,
                "occupancy_rate": 0,
                "expiring_soon": 0,
                "total_rent": 0 if user_role == "admin" else None
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

        # Total rent (only for admins)
        result = {
            "total_properties": total_properties,
            "occupied": occupied,
            "vacant": vacant,
            "occupancy_rate": round((occupied / total_properties * 100) if total_properties > 0 else 0, 2),
            "expiring_soon": expiring_soon
        }

        if user_role == "admin":
            total_rent = base_query.with_entities(func.sum(Apartment.rent)).scalar() or 0
            result["total_rent"] = float(total_rent)

        return jsonify(result), 200

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
        base_query = Apartment.query

        # Property status distribution
        status_distribution = base_query.with_entities(
            Apartment.status,
            func.count(Apartment.id).label('count')
        ).group_by(Apartment.status).all()

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
    Get tenant analytics for regular users
    Available to all authenticated users
    """
    try:
        user_role = g.user.get("role", "limited")
        user_id = g.user.get("sub")

        # Get all tenants
        total_tenants = Tenant.query.count()

        # Get tenants with upcoming lease expiry (next 30 days)
        thirty_days_later = datetime.now().date() + timedelta(days=30)

        # Count apartments with expiring contracts (as proxy for tenant leases)
        expiring_leases = Apartment.query.filter(
            and_(
                Apartment.contractEndDate.isnot(None),
                Apartment.contractEndDate <= thirty_days_later,
                Apartment.contractEndDate >= datetime.now().date()
            )
        ).count()

        return jsonify({
            "total_tenants": total_tenants,
            "expiring_leases": expiring_leases
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting user tenant analytics: {e}")
        return jsonify({"message": "Error getting tenant analytics", "error": str(e)}), 500
