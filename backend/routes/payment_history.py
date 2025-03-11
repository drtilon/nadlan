# routes/payment_history.py
from flask import Blueprint, request, jsonify, current_app
from .auth import token_required
from extentions import db
from models.models import Apartment, Payment
from datetime import datetime
import json

payment_history_bp = Blueprint("payment_history_bp", __name__)


@payment_history_bp.route("/payment-history/<int:apartment_id>", methods=["GET"])
@token_required
def get_payment_history(apartment_id):
    """
    Retrieves payment history for a specific apartment.
    """
    try:
        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get all payment records for this apartment
        payments = Payment.query.filter_by(apartment_id=apartment_id).all()

        history = []

        for payment in payments:
            # Skip if no payment date (likely not processed yet)
            if not hasattr(payment, "paymentDate") or not payment.paymentDate:
                continue

            # Calculate total amount due and paid from tenants
            tenants_data = json.loads(payment.tenants) if payment.tenants else []
            amount_due = sum(
                float(tenant.get("amountDue", 0)) for tenant in tenants_data
            )
            amount_paid = sum(
                float(tenant.get("amountPaid", 0)) for tenant in tenants_data
            )

            # Add extra payments if they exist
            if hasattr(payment, "extraPayments") and payment.extraPayments:
                try:
                    extra_payments = json.loads(payment.extraPayments)
                    amount_due += sum(float(value) for value in extra_payments.values())
                    # Assume extra payments are always paid in full when recorded
                    amount_paid += sum(
                        float(value) for value in extra_payments.values()
                    )
                except:
                    # Handle case where extraPayments might not be valid JSON
                    pass

            # Build history entry
            entry = {
                "id": payment.id,
                "month": payment.month,
                "year": datetime.now().year,  # Default to current year if not stored
                "status": payment.status,
                "amountDue": amount_due,
                "amountPaid": amount_paid,
                "paymentDate": payment.paymentDate.isoformat()
                if hasattr(payment, "paymentDate") and payment.paymentDate
                else None,
                "paymentMethod": getattr(
                    payment, "paymentMethod", "bank_transfer"
                ),  # Default to bank transfer if not specified
            }

            history.append(entry)

        # Sort by payment date (most recent first)
        history.sort(
            key=lambda x: x["paymentDate"] if x["paymentDate"] else "", reverse=True
        )

        return jsonify(history), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving payment history: {e}")
        return jsonify(
            {"message": "Error retrieving payment history", "error": str(e)}
        ), 500


@payment_history_bp.route("/payment-receipt/<int:payment_id>", methods=["GET"])
@token_required
def get_payment_receipt(payment_id):
    """
    Generates a receipt for a specific payment.
    In a real application, this would generate a PDF.
    """
    try:
        payment = Payment.query.get(payment_id)
        if not payment:
            return jsonify({"message": "Payment not found"}), 404

        # For now, just return the payment data
        # In a real app, you would generate a PDF receipt here
        receipt_data = {
            "receiptNumber": f"R-{payment_id}-{datetime.now().strftime('%Y%m%d')}",
            "apartment_id": payment.apartment_id,
            "month": payment.month,
            "status": payment.status,
            "paymentDate": payment.paymentDate.isoformat()
            if hasattr(payment, "paymentDate") and payment.paymentDate
            else None,
            "paymentMethod": getattr(payment, "paymentMethod", "bank_transfer"),
            "tenants": json.loads(payment.tenants) if payment.tenants else [],
            "extraPayments": json.loads(payment.extraPayments)
            if hasattr(payment, "extraPayments") and payment.extraPayments
            else {},
        }

        return jsonify(receipt_data), 200

    except Exception as e:
        current_app.logger.error(f"Error generating receipt: {e}")
        return jsonify({"message": "Error generating receipt", "error": str(e)}), 500
