# routes/payment_history.py - FIXED VERSION preserving all existing endpoints

from flask import Blueprint, request, jsonify, current_app
from .auth import token_required, role_required
from extentions import db
from models.models import Payment, Tenant, Apartment, ContractTenant, ContractPeriod
from datetime import datetime, date, timedelta
from activity_logger import ActivityLogger
import json
import traceback
from sqlalchemy import case, func


payment_history_bp = Blueprint("payment_history_bp", __name__)


@payment_history_bp.route("/payment-receipt/<int:payment_id>", methods=["GET"])
@token_required
def get_payment_receipt(payment_id):
    """
    Generates a receipt for a specific payment.
    PRESERVED: This is your original endpoint with field name fixes
    """
    try:
        payment = Payment.query.get(payment_id)
        if not payment:
            return jsonify({"message": "Payment not found"}), 404

        # Format extra payments
        extra_payments = {}
        if hasattr(payment, "extraPayments") and payment.extraPayments:
            try:
                extra_payments = json.loads(payment.extraPayments)
            except:
                extra_payments = {
                    "internet": getattr(payment, "internet", 0) or 0,
                    "electricity": getattr(payment, "electricity", 0) or 0,
                    "other": getattr(payment, "other", 0) or 0,
                }

        # Handle both payment_date and paymentDate fields
        payment_date_field = (
            payment.payment_date
            if hasattr(payment, "payment_date")
            else payment.paymentDate
            if hasattr(payment, "paymentDate")
            else None
        )

        receipt_data = {
            "receiptNumber": f"R-{payment_id}-{datetime.now().strftime('%Y%m%d')}",
            "apartment_id": payment.apartment_id,
            "month": payment.month,
            "year": payment.year,
            "status": getattr(payment, "status", "paid"),
            "paymentDate": payment_date_field.isoformat()
            if payment_date_field
            else None,
            "paymentMethod": getattr(
                payment,
                "payment_method",
                getattr(payment, "paymentMethod", "bank_transfer"),
            ),
            "tenants": json.loads(payment.tenants)
            if hasattr(payment, "tenants") and payment.tenants
            else [],
            "extraPayments": extra_payments,
            "notes": getattr(payment, "notes", ""),
        }

        return jsonify(receipt_data), 200

    except Exception as e:
        current_app.logger.error(f"Error generating receipt: {e}")
        return jsonify({"message": "Error generating receipt", "error": str(e)}), 500


@payment_history_bp.route("/tenants/<int:tenant_id>/payment-history", methods=["GET"])
@token_required
def get_tenant_payment_history(tenant_id):
    """Get payment history for a specific tenant - CORRECTED for actual Payment model"""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Get apartments this tenant has lived in from ContractTenant records
        contract_tenants = (
            db.session.query(ContractTenant, ContractPeriod)
            .join(
                ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id
            )
            .filter(ContractTenant.tenant_id == tenant_id)
            .all()
        )

        apartment_ids = set()
        for ct, cp in contract_tenants:
            apartment_ids.add(cp.apartment_id)

        # Also check legacy apartment_id assignment
        if hasattr(tenant, "apartment_id") and tenant.apartment_id:
            apartment_ids.add(tenant.apartment_id)

        # Get all payments for these apartments where this tenant is involved
        payments_query = Payment.query.filter(Payment.apartment_id.in_(apartment_ids))
        all_payments = payments_query.all()

        payments_history = []
        payment_summary = {
            "total_payments": 0,
            "total_paid": 0.0,
            "total_due": 0.0,
            "outstanding": 0.0,
        }

        for payment in all_payments:
            try:
                # FIXED: Parse tenant_payments JSON to find this specific tenant
                tenant_found = False
                tenant_amount_paid = 0.0
                tenant_amount_due = 0.0

                if hasattr(payment, "tenant_payments") and payment.tenant_payments:
                    try:
                        tenants_data = json.loads(payment.tenant_payments)

                        for tenant_info in tenants_data:
                            # Check both tenant ID and name
                            if (
                                tenant_info.get("id") == tenant.id
                                or tenant_info.get("name") == tenant.name
                            ):
                                tenant_found = True
                                tenant_amount_paid = float(
                                    tenant_info.get("amountPaid", 0)
                                )
                                tenant_amount_due = float(
                                    tenant_info.get("amountDue", 0)
                                )
                                break
                    except (json.JSONDecodeError, TypeError):
                        # Skip malformed JSON
                        continue

                if not tenant_found:
                    continue  # Skip this payment if tenant not found in it

                # Get apartment info
                apartment = Apartment.query.get(payment.apartment_id)
                apartment_address = "N/A"

                if apartment:
                    if hasattr(apartment, "address") and apartment.address:
                        apartment_address = apartment.address
                    elif hasattr(apartment, "full_address") and apartment.full_address:
                        apartment_address = apartment.full_address
                    else:
                        address_parts = []
                        if hasattr(apartment, "street_name") and apartment.street_name:
                            address_parts.append(apartment.street_name)
                        if (
                            hasattr(apartment, "house_number")
                            and apartment.house_number
                        ):
                            address_parts.append(apartment.house_number)
                        if hasattr(apartment, "city") and apartment.city:
                            address_parts.append(apartment.city)
                        apartment_address = (
                            " ".join(address_parts)
                            if address_parts
                            else f"Apartment {apartment.id}"
                        )

                # Build history entry with tenant-specific amounts and proper field names
                entry = {
                    "id": payment.id,
                    "month": payment.month,
                    "year": payment.year,
                    "status": getattr(payment, "status", "paid"),
                    "amountDue": tenant_amount_due,
                    "amountPaid": tenant_amount_paid,
                    "paymentDate": payment.payment_date.isoformat()
                    if payment.payment_date
                    else None,
                    "payment_date": payment.payment_date.isoformat()
                    if payment.payment_date
                    else None,
                    "paymentMethod": getattr(
                        payment, "payment_method", "bank_transfer"
                    ),
                    "method": getattr(payment, "payment_method", "bank_transfer"),
                    "paymentType": getattr(payment, "payment_type", "rent"),
                    "description": getattr(payment, "notes", "") or "Payment",
                    "notes": getattr(payment, "notes", ""),
                    "apartment_address": apartment_address,
                    "apartment_id": payment.apartment_id,
                    "amount": tenant_amount_paid,
                }

                payments_history.append(entry)

                # Update summary with tenant-specific amounts
                payment_summary["total_payments"] += 1
                payment_summary["total_paid"] += tenant_amount_paid
                payment_summary["total_due"] += tenant_amount_due

            except Exception as e:
                current_app.logger.warning(
                    f"Skipping payment {payment.id} due to error: {e}"
                )
                continue

        # Calculate outstanding amount
        payment_summary["outstanding"] = (
            payment_summary["total_due"] - payment_summary["total_paid"]
        )

        # Sort by payment date (most recent first)
        payments_history.sort(
            key=lambda x: x["paymentDate"] if x["paymentDate"] else "", reverse=True
        )

        current_app.logger.info(
            f"Returning {len(payments_history)} payments for tenant {tenant.name}"
        )

        return jsonify(
            {
                "tenant": {
                    "id": tenant.id,
                    "name": tenant.name,
                    "email": tenant.email,
                    "status": "active" if apartment_ids else "inactive",
                },
                "payments": payments_history,
                "payment_history": payments_history,
                "paymentHistory": payments_history,
                "summary": payment_summary,
                "apartments_lived_in": list(apartment_ids),
            }
        ), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving tenant payment history: {e}")
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify(
            {"message": "Error retrieving tenant payment history", "error": str(e)}
        ), 500


@payment_history_bp.route(
    "/apartment-tenant-payments/<int:apartment_id>", methods=["GET"]
)
@token_required
def get_apartment_tenant_payments(apartment_id):
    """
    Get payment breakdown by tenant for a specific apartment.
    PRESERVED: This is your original endpoint with field name fixes
    """
    try:
        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get optional year filter from query params
        year_filter = request.args.get("year", type=int)

        # Query payments, optionally filtered by year
        query = Payment.query.filter_by(apartment_id=apartment_id)
        if year_filter:
            query = query.filter_by(year=year_filter)

        payments = query.all()
        history = []

        for payment in payments:
            # Handle both payment_date and paymentDate fields
            payment_date_field = (
                payment.payment_date
                if hasattr(payment, "payment_date")
                else payment.paymentDate
                if hasattr(payment, "paymentDate")
                else None
            )

            # Skip if no payment date or status is not_applicable
            if (
                not payment_date_field
                or getattr(payment, "status", "") == "not_applicable"
            ):
                continue

            # Calculate total amount due and paid from tenants
            tenants_data = (
                json.loads(payment.tenants)
                if hasattr(payment, "tenants") and payment.tenants
                else []
            )
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
                    amount_paid += sum(
                        float(value) for value in extra_payments.values()
                    )
                except:
                    # Handle malformed JSON
                    extra_payments = {
                        "internet": getattr(payment, "internet", 0) or 0,
                        "electricity": getattr(payment, "electricity", 0) or 0,
                        "other": getattr(payment, "other", 0) or 0,
                    }
                    amount_due += sum(float(value) for value in extra_payments.values())
                    amount_paid += sum(
                        float(value) for value in extra_payments.values()
                    )

            # Build history entry
            entry = {
                "id": payment.id,
                "month": payment.month,
                "year": payment.year,
                "status": getattr(payment, "status", "paid"),
                "amountDue": amount_due,
                "amountPaid": amount_paid,
                "paymentDate": payment_date_field.isoformat()
                if payment_date_field
                else None,
                "paymentMethod": getattr(
                    payment,
                    "payment_method",
                    getattr(payment, "paymentMethod", "bank_transfer"),
                ),
                "notes": getattr(payment, "notes", ""),
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


@payment_history_bp.route("/payment-history/tenant/<int:tenant_id>", methods=["GET"])
@token_required
def get_tenant_payments_history(tenant_id):
    """Get payment history for a specific tenant across all apartments - NEW ENHANCED VERSION"""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Get all payments where this tenant is mentioned in the tenants JSON
        all_payments = Payment.query.all()
        tenant_payments = []

        for payment in all_payments:
            try:
                if payment.tenants:
                    tenants_data = json.loads(payment.tenants)
                    for tenant_info in tenants_data:
                        if (
                            tenant_info.get("name") == tenant.name
                            or tenant_info.get("id") == tenant.id
                        ):
                            # Get apartment info
                            apartment = Apartment.query.get(payment.apartment_id)

                            # Handle both payment_date and paymentDate fields
                            payment_date_field = (
                                payment.payment_date
                                if hasattr(payment, "payment_date")
                                else payment.paymentDate
                                if hasattr(payment, "paymentDate")
                                else None
                            )

                            payment_record = {
                                "id": payment.id,
                                "amount": float(tenant_info.get("amountPaid", 0)),
                                "payment_date": payment_date_field.isoformat()
                                if payment_date_field
                                else None,
                                "payment_method": getattr(
                                    payment,
                                    "payment_method",
                                    getattr(payment, "paymentMethod", "N/A"),
                                )
                                or "N/A",
                                "payment_type": "rent",  # Default type
                                "notes": getattr(payment, "notes", "") or "",
                                "status": "paid"
                                if tenant_info.get("paid", False)
                                else "pending",
                                "apartment_id": payment.apartment_id,
                                "apartment_address": apartment.address
                                if apartment
                                else "Unknown",
                                "month": payment.month,
                                "year": payment.year,
                            }
                            tenant_payments.append(payment_record)
                            break
            except (json.JSONDecodeError, AttributeError, TypeError):
                continue

        # Sort by payment date (most recent first)
        tenant_payments.sort(
            key=lambda x: x["payment_date"] or "1900-01-01", reverse=True
        )

        # Calculate summary statistics
        total_payments = len(tenant_payments)
        total_paid = sum(p["amount"] for p in tenant_payments)
        average_payment = total_paid / total_payments if total_payments > 0 else 0
        last_payment_date = (
            tenant_payments[0]["payment_date"] if tenant_payments else None
        )

        summary = {
            "total_payments": total_payments,
            "total_paid": total_paid,
            "average_payment": average_payment,
            "last_payment_date": last_payment_date,
        }

        return jsonify(
            {
                "tenant": {"id": tenant.id, "name": tenant.name},
                "payments": tenant_payments,
                "summary": summary,
            }
        ), 200

    except Exception as e:
        current_app.logger.error(f"Error getting tenant payment history: {e}")
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify(
            {
                "message": "Error getting tenant payment history",
                "error": str(e),
                "payments": [],
                "summary": {
                    "total_payments": 0,
                    "total_paid": 0,
                    "average_payment": 0,
                    "last_payment_date": None,
                },
            }
        ), 500
