# routes/analytics.py
import json
from datetime import datetime, timedelta
from calendar import monthrange
from flask import Blueprint, jsonify, current_app
from models.models import Apartment, Payment
from .auth import token_required, role_required
from sqlalchemy import func, extract, desc
from itertools import groupby
from operator import itemgetter
from extentions import db
from decimal import Decimal

analytics_bp = Blueprint("analytics_bp", __name__)


@analytics_bp.route("/analytics/summary", methods=["GET"])
@token_required
def get_analytics_summary():
    """
    Returns a summary of key metrics including total apartments, occupancy rate,
    total rent collected, and pending payments.
    """
    try:
        # Get apartment stats
        total_apartments = Apartment.query.count()
        occupied_apartments = Apartment.query.filter(
            Apartment.status == "occupied"
        ).count()
        occupancy_rate = (
            (occupied_apartments / total_apartments * 100)
            if total_apartments > 0
            else 0
        )

        # Get apartments with contract end date in the next 30 days
        today = datetime.now().date()
        thirty_days_later = today + timedelta(days=30)
        expiring_soon = Apartment.query.filter(
            Apartment.contractEndDate.between(today, thirty_days_later)
        ).count()

        # Get financial metrics
        # Assuming current month's payments
        current_month = datetime.now().strftime("%B")  # e.g., "January"

        total_expected_rent = db.session.query(func.sum(Apartment.rent)).scalar() or 0

        # Count apartments with payments status="paid" for current month
        current_month_payments = Payment.query.filter_by(month=current_month).all()
        paid_count = sum(1 for p in current_month_payments if p.status == "paid")
        partial_count = sum(1 for p in current_month_payments if p.status == "partial")
        not_paid_count = sum(
            1 for p in current_month_payments if p.status == "not_paid"
        )

        # Count total tenants
        total_tenants = 0
        for apartment in Apartment.query.all():
            if apartment.tenants:
                # Handle both string and array formats
                if isinstance(apartment.tenants, str):
                    tenant_list = apartment.tenants.split(",")
                    total_tenants += len([t for t in tenant_list if t.strip()])
                elif isinstance(apartment.tenants, list):
                    total_tenants += len(apartment.tenants)

        return jsonify(
            {
                "total_apartments": total_apartments,
                "occupied_apartments": occupied_apartments,
                "occupancy_rate": round(occupancy_rate, 2),
                "expiring_soon": expiring_soon,
                "total_expected_rent": float(total_expected_rent),
                "payment_status": {
                    "paid": paid_count,
                    "partial": partial_count,
                    "not_paid": not_paid_count,
                },
                "total_tenants": total_tenants,
            }
        ), 200

    except Exception as e:
        current_app.logger.error(f"Error getting analytics summary: {e}")
        return jsonify(
            {"message": "Error getting analytics summary", "error": str(e)}
        ), 500


@analytics_bp.route("/analytics/payment-trends", methods=["GET"])
@token_required
def get_payment_trends():
    """
    Returns monthly payment trends for the last 12 months.
    """
    try:
        # Get all payments
        all_payments = Payment.query.all()

        # Prepare monthly data
        months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ]

        # Get current month index (0-based)
        current_month_idx = datetime.now().month - 1

        # Reorder months to show the last 12 months
        last_12_months = months[current_month_idx:] + months[:current_month_idx]

        # Initialize data structure
        monthly_data = {
            month: {
                "expected": 0,
                "collected": 0,
                "count": {"paid": 0, "partial": 0, "not_paid": 0},
            }
            for month in last_12_months
        }

        # Calculate the expected rent for each month
        all_apartments = Apartment.query.all()
        monthly_expected_rent = sum(
            float(apt.rent) for apt in all_apartments if apt.rent
        )

        # Populate data from payments
        for month in last_12_months:
            monthly_data[month]["expected"] = monthly_expected_rent

            # Find payments for this month
            month_payments = [p for p in all_payments if p.month == month]

            # Calculate collected rent
            collected = 0
            for payment in month_payments:
                if payment.tenants:
                    tenants = json.loads(payment.tenants)
                    collected += sum(
                        float(tenant.get("amountPaid", 0)) for tenant in tenants
                    )

            monthly_data[month]["collected"] = collected

            # Count status types
            monthly_data[month]["count"]["paid"] = sum(
                1 for p in month_payments if p.status == "paid"
            )
            monthly_data[month]["count"]["partial"] = sum(
                1 for p in month_payments if p.status == "partial"
            )
            monthly_data[month]["count"]["not_paid"] = sum(
                1 for p in month_payments if p.status == "not_paid"
            )

        # Format for chart data
        chart_data = []
        for month in last_12_months:
            chart_data.append(
                {
                    "month": month,
                    "expected": monthly_data[month]["expected"],
                    "collected": monthly_data[month]["collected"],
                    "paid": monthly_data[month]["count"]["paid"],
                    "partial": monthly_data[month]["count"]["partial"],
                    "not_paid": monthly_data[month]["count"]["not_paid"],
                }
            )

        return jsonify(chart_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting payment trends: {e}")
        return jsonify(
            {"message": "Error getting payment trends", "error": str(e)}
        ), 500


@analytics_bp.route("/analytics/apartment-metrics", methods=["GET"])
@token_required
def get_apartment_metrics():
    """
    Returns metrics for individual apartments including occupancy status,
    rent collection, and net profit calculations based on model type.
    """
    try:
        apartments = Apartment.query.all()
        current_month = datetime.now().strftime("%B")

        apartment_metrics = []
        for apt in apartments:
            # Get payment for current month
            payment = Payment.query.filter_by(
                apartment_id=apt.id, month=current_month
            ).first()

            # Calculate payment data
            payment_status = "not_paid"
            collected_amount = 0
            tenant_count = 0

            if payment:
                payment_status = payment.status
                if payment.tenants:
                    tenants = json.loads(payment.tenants)
                    tenant_count = len(tenants)
                    collected_amount = sum(
                        float(tenant.get("amountPaid", 0)) for tenant in tenants
                    )

            # Parse tenant data
            if apt.tenants:
                if isinstance(apt.tenants, str):
                    tenant_list = apt.tenants.split(",")
                    tenant_count = len([t for t in tenant_list if t.strip()])
                elif isinstance(apt.tenants, list):
                    tenant_count = len(apt.tenants)

            # Format contract dates
            move_in_date = apt.moveInDate.isoformat() if apt.moveInDate else None
            contract_end_date = (
                apt.contractEndDate.isoformat() if apt.contractEndDate else None
            )

            # Calculate days until contract expiration
            days_until_expiration = None
            if apt.contractEndDate:
                days_until_expiration = (
                    apt.contractEndDate - datetime.now().date()
                ).days

            # Calculate price per square meter
            price_per_meter = 0
            if apt.size and apt.size > 0 and apt.rent:
                price_per_meter = float(apt.rent) / float(apt.size)

            # Calculate net profit based on the apartment model
            net_profit = 0
            rent = float(apt.rent) if apt.rent else 0

            if apt.model == "rental":
                # For rental model: Net Profit = Rent - Rental Cost
                rent_cost = float(apt.rentCost) if apt.rentCost else 0
                net_profit = rent - rent_cost
            elif apt.model == "management":
                # For management model: Net Profit = Management Fee % of Rent
                management_fee = float(apt.managementFee) if apt.managementFee else 0
                net_profit = rent * (management_fee / 100)

            apartment_metrics.append(
                {
                    "id": apt.id,
                    "address": apt.address,
                    "status": apt.status,
                    "rent": rent,
                    "rentCost": float(apt.rentCost) if apt.rentCost else 0,
                    "managementFee": float(apt.managementFee)
                    if apt.managementFee
                    else 0,
                    "model": apt.model
                    or "management",  # Default to management if not specified
                    "collected": collected_amount,
                    "payment_status": payment_status,
                    "tenant_count": tenant_count,
                    "move_in_date": move_in_date,
                    "contract_end_date": contract_end_date,
                    "days_until_expiration": days_until_expiration,
                    "size": apt.size,
                    "pricePerMeter": round(price_per_meter, 2),
                    "netProfit": round(net_profit, 2),  # Add net profit calculation
                }
            )

        return jsonify(apartment_metrics), 200

    except Exception as e:
        current_app.logger.error(f"Error getting apartment metrics: {e}")
        return jsonify(
            {"message": "Error getting apartment metrics", "error": str(e)}
        ), 500


@analytics_bp.route("/analytics/tenant-payments", methods=["GET"])
@token_required
def get_tenant_payment_analytics():
    """
    Returns analytics about tenant payment behaviors.
    """
    try:
        # Get all payments for processing
        all_payments = Payment.query.all()

        tenant_data = {}

        # Process each payment record
        for payment in all_payments:
            if not payment.tenants:
                continue

            tenants = json.loads(payment.tenants)
            for tenant in tenants:
                tenant_name = tenant.get("name", "Unknown")

                if tenant_name not in tenant_data:
                    tenant_data[tenant_name] = {
                        "months_paid": 0,
                        "months_partial": 0,
                        "months_unpaid": 0,
                        "total_due": 0,
                        "total_paid": 0,
                        "payment_history": [],
                    }

                # Update tenant statistics
                amount_due = float(tenant.get("amountDue", 0))
                amount_paid = float(tenant.get("amountPaid", 0))
                is_paid = tenant.get("paid", False)

                tenant_data[tenant_name]["total_due"] += amount_due
                tenant_data[tenant_name]["total_paid"] += amount_paid

                # Record payment status
                if is_paid or amount_paid >= amount_due:
                    tenant_data[tenant_name]["months_paid"] += 1
                elif amount_paid > 0:
                    tenant_data[tenant_name]["months_partial"] += 1
                else:
                    tenant_data[tenant_name]["months_unpaid"] += 1

                # Add to payment history
                tenant_data[tenant_name]["payment_history"].append(
                    {
                        "month": payment.month,
                        "due": amount_due,
                        "paid": amount_paid,
                        "status": "paid"
                        if (is_paid or amount_paid >= amount_due)
                        else "partial"
                        if amount_paid > 0
                        else "unpaid",
                    }
                )

        # Convert to list format for response
        result = []
        for name, data in tenant_data.items():
            payment_ratio = (
                data["total_paid"] / data["total_due"] if data["total_due"] > 0 else 0
            )

            result.append(
                {
                    "name": name,
                    "months_paid": data["months_paid"],
                    "months_partial": data["months_partial"],
                    "months_unpaid": data["months_unpaid"],
                    "total_due": data["total_due"],
                    "total_paid": data["total_paid"],
                    "payment_ratio": round(payment_ratio * 100, 2),
                    "payment_history": sorted(
                        data["payment_history"], key=lambda x: months.index(x["month"])
                    ),
                }
            )

        return jsonify(result), 200

    except Exception as e:
        current_app.logger.error(f"Error getting tenant payment analytics: {e}")
        return jsonify(
            {"message": "Error getting tenant payment analytics", "error": str(e)}
        ), 500


@analytics_bp.route("/analytics/expenses", methods=["GET"])
@token_required
def get_expense_analytics():
    """
    Returns analytics about expenses (internet, electricity, other) by month.
    """
    try:
        # Get all payments for processing
        all_payments = Payment.query.all()

        # Prepare monthly data
        months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ]

        # Get current month index (0-based)
        current_month_idx = datetime.now().month - 1

        # Reorder months to show the last 12 months
        last_12_months = months[current_month_idx:] + months[:current_month_idx]

        # Initialize data
        expense_data = []

        for month in last_12_months:
            month_payments = [p for p in all_payments if p.month == month]

            # Sum up expenses for the month
            internet_total = sum(float(p.internet or 0) for p in month_payments)
            electricity_total = sum(float(p.electricity or 0) for p in month_payments)
            other_total = sum(float(p.other or 0) for p in month_payments)

            expense_data.append(
                {
                    "month": month,
                    "internet": internet_total,
                    "electricity": electricity_total,
                    "other": other_total,
                    "total": internet_total + electricity_total + other_total,
                }
            )

        return jsonify(expense_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting expense analytics: {e}")
        return jsonify(
            {"message": "Error getting expense analytics", "error": str(e)}
        ), 500
