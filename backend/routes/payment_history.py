# routes/payment_history.py - FIXED VERSION preserving all existing endpoints

from flask import Blueprint, request, jsonify, current_app
from .auth import token_required, role_required
from extentions import db
from models.models import Payment, Tenant, Apartment, ContractTenant, ContractPeriod
from datetime import datetime, date, timedelta
from activity_logger import ActivityLogger
import json
import traceback

payment_history_bp = Blueprint("payment_history_bp", __name__)

@payment_history_bp.route("/payment-history/<int:apartment_id>", methods=["GET"])
@token_required
def get_payment_history(apartment_id):
    """
    Get comprehensive payment history for an apartment.
    PRESERVED: This is your original endpoint with field name fixes
    """
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        year_filter = request.args.get('year', type=int)

        query = Payment.query.filter_by(apartment_id=apartment_id)
        if year_filter:
            query = query.filter_by(year=year_filter)

        # FIXED: Handle both payment_date and paymentDate fields
        payments = query.order_by(
            Payment.payment_date.desc() if hasattr(Payment, 'payment_date') else Payment.paymentDate.desc(),
            Payment.updated_at.desc()
        ).all()

        history = []

        for payment in payments:
            # Skip payments without payment date (these are unpaid monthly records)
            payment_date_field = payment.payment_date if hasattr(payment, 'payment_date') and payment.payment_date else payment.paymentDate if hasattr(payment, 'paymentDate') else None

            if not payment_date_field or getattr(payment, 'status', '') == "not_applicable":
                continue

            # Handle both old and new payment formats
            amount_paid = 0
            tenant_name = ''
            tenant_names = []

            if hasattr(payment, 'tenants') and payment.tenants:
                try:
                    tenants_data = json.loads(payment.tenants)
                    amount_paid = sum(float(tenant.get("amountPaid", 0)) for tenant in tenants_data)
                    tenant_names = [tenant.get("name", "") for tenant in tenants_data if tenant.get("name")]
                    tenant_name = tenant_names[0] if tenant_names else ""
                except:
                    pass

            # Use new field if available
            if hasattr(payment, 'amount') and payment.amount:
                amount_paid = float(payment.amount)

            if hasattr(payment, 'tenant_name') and payment.tenant_name:
                tenant_name = payment.tenant_name
                tenant_names = [tenant_name]

            entry = {
                "id": payment.id,
                "month": payment.month,
                "year": payment.year,
                "status": getattr(payment, 'status', 'paid'),
                "amountPaid": amount_paid,
                "paymentDate": payment_date_field.isoformat() if payment_date_field else None,
                "paymentMethod": getattr(payment, 'payment_method', getattr(payment, 'paymentMethod', 'bank_transfer')),
                "paymentType": getattr(payment, "payment_type", "rent"),
                "tenant_name": tenant_name,
                "tenant_names": tenant_names,
                "notes": getattr(payment, 'notes', ''),
                "isIndividual": bool(hasattr(payment, 'amount') and payment.amount)
            }
            history.append(entry)

        return jsonify(history), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving payment history: {e}")
        return jsonify({"message": "Error retrieving payment history", "error": str(e)}), 500

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
                    "internet": getattr(payment, 'internet', 0) or 0,
                    "electricity": getattr(payment, 'electricity', 0) or 0,
                    "other": getattr(payment, 'other', 0) or 0
                }

        # Handle both payment_date and paymentDate fields
        payment_date_field = payment.payment_date if hasattr(payment, 'payment_date') else payment.paymentDate if hasattr(payment, 'paymentDate') else None

        receipt_data = {
            "receiptNumber": f"R-{payment_id}-{datetime.now().strftime('%Y%m%d')}",
            "apartment_id": payment.apartment_id,
            "month": payment.month,
            "year": payment.year,
            "status": getattr(payment, 'status', 'paid'),
            "paymentDate": payment_date_field.isoformat() if payment_date_field else None,
            "paymentMethod": getattr(payment, "payment_method", getattr(payment, "paymentMethod", "bank_transfer")),
            "tenants": json.loads(payment.tenants) if hasattr(payment, 'tenants') and payment.tenants else [],
            "extraPayments": extra_payments,
            "notes": getattr(payment, "notes", "")
        }

        return jsonify(receipt_data), 200

    except Exception as e:
        current_app.logger.error(f"Error generating receipt: {e}")
        return jsonify({"message": "Error generating receipt", "error": str(e)}), 500


@payment_history_bp.route("/tenants/<int:tenant_id>/payment-history", methods=["GET"])
@token_required
def get_tenant_payment_history(tenant_id):
    """
    ENHANCED: Get comprehensive payment history for a tenant across all apartments
    """
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Get all apartments this tenant has been associated with through contracts
        tenant_apartments_query = db.session.query(ContractPeriod.apartment_id)\
            .join(ContractTenant, ContractTenant.contract_period_id == ContractPeriod.id)\
            .filter(ContractTenant.tenant_id == tenant_id)\
            .distinct()

        apartment_ids = [apt.apartment_id for apt in tenant_apartments_query.all() if apt.apartment_id]

        current_app.logger.info(f"Found apartments for tenant {tenant.name}: {apartment_ids}")

        payments_history = []
        payment_summary = {
            "total_payments": 0,
            "total_paid": 0,
            "total_due": 0,
            "outstanding": 0
        }

        if apartment_ids:
            # Get all payments for these apartments
            try:
                payments = Payment.query.filter(
                    Payment.apartment_id.in_(apartment_ids)
                ).order_by(
                    Payment.payment_date.desc() if hasattr(Payment, 'payment_date') else Payment.paymentDate.desc(),
                    Payment.year.desc(),
                    Payment.month.desc()
                ).all()
            except AttributeError:
                # Fallback if payment_date field doesn't exist
                payments = Payment.query.filter(
                    Payment.apartment_id.in_(apartment_ids)
                ).order_by(
                    Payment.paymentDate.desc(),
                    Payment.year.desc(),
                    Payment.month.desc()
                ).all()

            for payment in payments:
                # Get apartment and contract info
                apartment = Apartment.query.get(payment.apartment_id)
                contract_period = None
                if payment.contract_period_id:
                    contract_period = ContractPeriod.query.get(payment.contract_period_id)

                # Handle different field names for payment data
                payment_date = getattr(payment, 'payment_date', None) or getattr(payment, 'paymentDate', None)
                amount_paid = getattr(payment, 'amountPaid', None) or getattr(payment, 'amount', 0)
                amount_due = getattr(payment, 'amountDue', None) or getattr(payment, 'amount', 0)
                status = getattr(payment, 'status', None) or getattr(payment, 'paymentStatus', 'UNKNOWN')
                description = getattr(payment, 'description', None) or getattr(payment, 'paymentDescription', f"Payment for {payment.month}/{payment.year}")
                method = getattr(payment, 'method', None) or getattr(payment, 'paymentMethod', 'N/A')

                # Create payment history entry
                entry = {
                    "id": payment.id,
                    "paymentDate": payment_date.isoformat() if payment_date else None,
                    "month": payment.month,
                    "year": payment.year,
                    "amountPaid": float(amount_paid) if amount_paid else 0.0,
                    "amountDue": float(amount_due) if amount_due else 0.0,
                    "status": status,
                    "paymentStatus": status,  # Alternative field
                    "description": description,
                    "paymentDescription": description,  # Alternative field
                    "method": method,
                    "paymentMethod": method,  # Alternative field
                    "apartment_id": payment.apartment_id,
                    "apartment_address": apartment.address if apartment else f"Apartment {payment.apartment_id}",
                    "contract_period_id": payment.contract_period_id
                }

                # Add contract period info if available
                if contract_period:
                    entry["contract_period"] = {
                        "id": contract_period.id,
                        "contract_number": contract_period.contract_number,
                        "start_date": contract_period.start_date.isoformat() if contract_period.start_date else None,
                        "end_date": contract_period.end_date.isoformat() if contract_period.end_date else None,
                    }

                payments_history.append(entry)

                # Update summary
                payment_summary["total_payments"] += 1
                payment_summary["total_paid"] += float(amount_paid) if amount_paid else 0.0
                payment_summary["total_due"] += float(amount_due) if amount_due else 0.0

            # Calculate outstanding amount
            payment_summary["outstanding"] = payment_summary["total_due"] - payment_summary["total_paid"]

        current_app.logger.info(f"Returning {len(payments_history)} payments for tenant {tenant.name}")

        return jsonify({
            "tenant": {
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "status": "active" if apartment_ids else "inactive"
            },
            "payments": payments_history,
            "payment_history": payments_history,  # Alternative field name
            "summary": payment_summary,
            "apartments_lived_in": apartment_ids
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving tenant payment history: {e}")
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"message": "Error retrieving tenant payment history", "error": str(e)}), 500

@payment_history_bp.route("/apartment-tenant-payments/<int:apartment_id>", methods=["GET"])
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
        year_filter = request.args.get('year', type=int)

        # Query payments, optionally filtered by year
        query = Payment.query.filter_by(apartment_id=apartment_id)
        if year_filter:
            query = query.filter_by(year=year_filter)

        payments = query.all()
        history = []

        for payment in payments:
            # Handle both payment_date and paymentDate fields
            payment_date_field = payment.payment_date if hasattr(payment, 'payment_date') else payment.paymentDate if hasattr(payment, 'paymentDate') else None

            # Skip if no payment date or status is not_applicable
            if not payment_date_field or getattr(payment, 'status', '') == "not_applicable":
                continue

            # Calculate total amount due and paid from tenants
            tenants_data = json.loads(payment.tenants) if hasattr(payment, 'tenants') and payment.tenants else []
            amount_due = sum(float(tenant.get("amountDue", 0)) for tenant in tenants_data)
            amount_paid = sum(float(tenant.get("amountPaid", 0)) for tenant in tenants_data)

            # Add extra payments if they exist
            if hasattr(payment, "extraPayments") and payment.extraPayments:
                try:
                    extra_payments = json.loads(payment.extraPayments)
                    amount_due += sum(float(value) for value in extra_payments.values())
                    amount_paid += sum(float(value) for value in extra_payments.values())
                except:
                    # Handle malformed JSON
                    extra_payments = {
                        "internet": getattr(payment, 'internet', 0) or 0,
                        "electricity": getattr(payment, 'electricity', 0) or 0,
                        "other": getattr(payment, 'other', 0) or 0
                    }
                    amount_due += sum(float(value) for value in extra_payments.values())
                    amount_paid += sum(float(value) for value in extra_payments.values())

            # Build history entry
            entry = {
                "id": payment.id,
                "month": payment.month,
                "year": payment.year,
                "status": getattr(payment, 'status', 'paid'),
                "amountDue": amount_due,
                "amountPaid": amount_paid,
                "paymentDate": payment_date_field.isoformat() if payment_date_field else None,
                "paymentMethod": getattr(payment, "payment_method", getattr(payment, "paymentMethod", "bank_transfer")),
                "notes": getattr(payment, "notes", "")
            }

            history.append(entry)

        # Sort by payment date (most recent first)
        history.sort(key=lambda x: x["paymentDate"] if x["paymentDate"] else "", reverse=True)

        return jsonify(history), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving payment history: {e}")
        return jsonify({"message": "Error retrieving payment history", "error": str(e)}), 500

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
                        if (tenant_info.get("name") == tenant.name or
                            tenant_info.get("id") == tenant.id):

                            # Get apartment info
                            apartment = Apartment.query.get(payment.apartment_id)

                            # Handle both payment_date and paymentDate fields
                            payment_date_field = payment.payment_date if hasattr(payment, 'payment_date') else payment.paymentDate if hasattr(payment, 'paymentDate') else None

                            payment_record = {
                                "id": payment.id,
                                "amount": float(tenant_info.get("amountPaid", 0)),
                                "payment_date": payment_date_field.isoformat() if payment_date_field else None,
                                "payment_method": getattr(payment, 'payment_method', getattr(payment, 'paymentMethod', 'N/A')) or 'N/A',
                                "payment_type": "rent",  # Default type
                                "notes": getattr(payment, 'notes', '') or '',
                                "status": "paid" if tenant_info.get("paid", False) else "pending",
                                "apartment_id": payment.apartment_id,
                                "apartment_address": apartment.address if apartment else "Unknown",
                                "month": payment.month,
                                "year": payment.year
                            }
                            tenant_payments.append(payment_record)
                            break
            except (json.JSONDecodeError, AttributeError, TypeError):
                continue

        # Sort by payment date (most recent first)
        tenant_payments.sort(key=lambda x: x["payment_date"] or "1900-01-01", reverse=True)

        # Calculate summary statistics
        total_payments = len(tenant_payments)
        total_paid = sum(p["amount"] for p in tenant_payments)
        average_payment = total_paid / total_payments if total_payments > 0 else 0
        last_payment_date = tenant_payments[0]["payment_date"] if tenant_payments else None

        summary = {
            "total_payments": total_payments,
            "total_paid": total_paid,
            "average_payment": average_payment,
            "last_payment_date": last_payment_date
        }

        return jsonify({
            "tenant": {
                "id": tenant.id,
                "name": tenant.name
            },
            "payments": tenant_payments,
            "summary": summary
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting tenant payment history: {e}")
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "message": "Error getting tenant payment history",
            "error": str(e),
            "payments": [],
            "summary": {
                "total_payments": 0,
                "total_paid": 0,
                "average_payment": 0,
                "last_payment_date": None
            }
        }), 500
