# routes/payments.py
import json
from flask import Blueprint, request, jsonify, current_app
from .auth import token_required
from extentions import db
from models.models import (
    Apartment,
    Payment,
)  # Ensure these models are correctly imported
from datetime import datetime

payments_bp = Blueprint("payments_bp", __name__)


@payments_bp.route("/payments/<int:apartment_id>", methods=["GET"])
@token_required
def get_payments(apartment_id):
    """
    Returns a dictionary of months (January to December) with payment details for the given apartment.
    If no payment record exists for a month, returns default values.
    """
    month_list = [
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
    try:
        payments_records = Payment.query.filter_by(apartment_id=apartment_id).all()
        # Create a mapping: month -> Payment record
        payments_by_month = {payment.month: payment for payment in payments_records}
        payments = {}
        for month in month_list:
            if month in payments_by_month:
                payment = payments_by_month[month]
                # Load tenants JSON if available
                tenants = json.loads(payment.tenants) if payment.tenants else []
                # Convert tenant payment data if using an old format
                if tenants and all(
                    isinstance(t, dict) and "amountDue" not in t for t in tenants
                ):
                    for tenant in tenants:
                        tenant["amountDue"] = 0
                        tenant["amountPaid"] = 0
                extraPayments = {
                    "internet": payment.internet if payment.internet is not None else 0,
                    "electricity": payment.electricity
                    if payment.electricity is not None
                    else 0,
                    "other": payment.other if payment.other is not None else 0,
                }
                payments[month] = {
                    "id": payment.id,
                    "apartment_id": payment.apartment_id,
                    "month": payment.month,
                    "status": payment.status,
                    "tenants": tenants,
                    "extraPayments": extraPayments,
                    "updated_at": payment.updated_at.isoformat()
                    if payment.updated_at
                    else None,
                }
            else:
                payments[month] = {
                    "status": "not_paid",
                    "tenants": [],
                    "extraPayments": {"internet": 0, "electricity": 0, "other": 0},
                }
        return jsonify(payments), 200
    except Exception as e:
        current_app.logger.error(f"Error getting payments: {e}")
        return jsonify({"message": "Error getting payments", "error": str(e)}), 500


@payments_bp.route("/payments/<int:apartment_id>", methods=["POST"])
@token_required
def update_payments(apartment_id):
    """
    Expects a JSON object with keys for each month (e.g., "January", "February", ...)
    containing payment data. For each month, updates the record if it exists or creates a new record.
    Enhanced to handle payment date, method and additional metadata.
    """
    data = request.json
    month_list = [
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
    current_year = datetime.utcnow().year

    try:
        for month in month_list:
            month_data = data.get(month)
            if month_data:
                # Extract extra payments from nested structure, or fallback to flat keys
                internet = month_data.get("extraPayments", {}).get("internet", 0)
                electricity = month_data.get("extraPayments", {}).get("electricity", 0)
                other = month_data.get("extraPayments", {}).get("other", 0)

                if internet == 0 and "internet" in month_data:
                    internet = month_data["internet"]
                if electricity == 0 and "electricity" in month_data:
                    electricity = month_data["electricity"]
                if other == 0 and "other" in month_data:
                    other = month_data["other"]

                # Get extraPayments as JSON string
                extra_payments = {
                    "internet": internet,
                    "electricity": electricity,
                    "other": other,
                }
                extra_payments_json = json.dumps(extra_payments)

                # Ensure tenant data has expected fields
                tenants = month_data.get("tenants", [])
                for tenant in tenants:
                    if "amountDue" not in tenant:
                        tenant["amountDue"] = 0
                    if "amountPaid" not in tenant:
                        tenant["amountPaid"] = 0
                tenants_json = json.dumps(tenants)

                # Extract payment date and method
                payment_date_str = month_data.get("paymentDate")
                payment_method = month_data.get("paymentMethod", "bank_transfer")
                notes = month_data.get("notes", "")

                # Convert payment date string to datetime object if provided
                payment_date = None
                if payment_date_str:
                    try:
                        payment_date = datetime.fromisoformat(
                            payment_date_str.replace("Z", "+00:00")
                        )
                    except ValueError:
                        # Handle different date formats
                        try:
                            payment_date = datetime.strptime(
                                payment_date_str, "%Y-%m-%d"
                            )
                        except ValueError:
                            payment_date = datetime.utcnow()

                payment = Payment.query.filter_by(
                    apartment_id=apartment_id, month=month
                ).first()

                if payment:
                    # Update existing payment record
                    payment.status = month_data.get("status", "not_paid")
                    payment.tenants = tenants_json
                    payment.internet = internet
                    payment.electricity = electricity
                    payment.other = other
                    payment.extraPayments = extra_payments_json

                    # Only update payment date if status changed to paid or if explicitly provided
                    if (
                        month_data.get("status") == "paid" and payment.status != "paid"
                    ) or payment_date_str:
                        payment.paymentDate = payment_date or datetime.utcnow()

                    payment.paymentMethod = payment_method
                    payment.notes = notes
                    payment.year = current_year
                else:
                    # Create new payment record
                    new_payment = Payment(
                        apartment_id=apartment_id,
                        month=month,
                        status=month_data.get("status", "not_paid"),
                        tenants=tenants_json,
                        internet=internet,
                        electricity=electricity,
                        other=other,
                        extraPayments=extra_payments_json,
                        paymentDate=payment_date
                        if payment_date
                        else (
                            datetime.utcnow()
                            if month_data.get("status") == "paid"
                            else None
                        ),
                        paymentMethod=payment_method,
                        notes=notes,
                        year=current_year,
                    )
                    db.session.add(new_payment)

        db.session.commit()
        return jsonify({"message": "Payments updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating payments: {e}")
        return jsonify({"message": "Error updating payments", "error": str(e)}), 500


@payments_bp.route("/apartment/<int:apartment_id>", methods=["GET"])
@token_required
def get_apartment_details(apartment_id):
    """
    Returns details of the apartment using the ORM.
    """
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404
        return jsonify(apartment.to_dict()), 200
    except Exception as e:
        current_app.logger.error(f"Error getting apartment details: {e}")
        return jsonify(
            {"message": "Error getting apartment details", "error": str(e)}
        ), 500
