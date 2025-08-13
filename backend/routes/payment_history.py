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

        # Get optional year filter from query params
        year_filter = request.args.get('year', type=int)
        
        # Query payments, optionally filtered by year
        query = Payment.query.filter_by(apartment_id=apartment_id)
        if year_filter:
            query = query.filter_by(year=year_filter)
        
        payments = query.all()
        history = []

        for payment in payments:
            # Skip if no payment date or status is not_applicable
            if not hasattr(payment, "paymentDate") or not payment.paymentDate or payment.status == "not_applicable":
                continue

            # Calculate total amount due and paid from tenants
            tenants_data = json.loads(payment.tenants) if payment.tenants else []
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
                        "internet": payment.internet or 0,
                        "electricity": payment.electricity or 0,
                        "other": payment.other or 0
                    }
                    amount_due += sum(float(value) for value in extra_payments.values())
                    amount_paid += sum(float(value) for value in extra_payments.values())

            # Build history entry
            entry = {
                "id": payment.id,
                "month": payment.month,
                "year": payment.year,
                "status": payment.status,
                "amountDue": amount_due,
                "amountPaid": amount_paid,
                "paymentDate": payment.paymentDate.isoformat() if payment.paymentDate else None,
                "paymentMethod": getattr(payment, "paymentMethod", "bank_transfer"),
                "notes": getattr(payment, "notes", "")
            }

            history.append(entry)

        # Sort by payment date (most recent first)
        history.sort(key=lambda x: x["paymentDate"] if x["paymentDate"] else "", reverse=True)

        return jsonify(history), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving payment history: {e}")
        return jsonify({"message": "Error retrieving payment history", "error": str(e)}), 500

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

        # Format extra payments
        extra_payments = {}
        if hasattr(payment, "extraPayments") and payment.extraPayments:
            try:
                extra_payments = json.loads(payment.extraPayments)
            except:
                extra_payments = {
                    "internet": payment.internet or 0,
                    "electricity": payment.electricity or 0,
                    "other": payment.other or 0
                }

        receipt_data = {
            "receiptNumber": f"R-{payment_id}-{datetime.now().strftime('%Y%m%d')}",
            "apartment_id": payment.apartment_id,
            "month": payment.month,
            "year": payment.year,
            "status": payment.status,
            "paymentDate": payment.paymentDate.isoformat() if hasattr(payment, "paymentDate") and payment.paymentDate else None,
            "paymentMethod": getattr(payment, "paymentMethod", "bank_transfer"),
            "tenants": json.loads(payment.tenants) if payment.tenants else [],
            "extraPayments": extra_payments,
            "notes": getattr(payment, "notes", "")
        }

        return jsonify(receipt_data), 200

    except Exception as e:
        current_app.logger.error(f"Error generating receipt: {e}")
        return jsonify({"message": "Error generating receipt", "error": str(e)}), 500


@payment_history_bp.route("/tenant-payment-history/<int:tenant_id>", methods=["GET"])
@token_required
def get_tenant_payment_history(tenant_id):
    """
    Retrieves payment history for a specific tenant across all apartments.
    """
    try:
        # Get tenant details
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Get optional year filter from query params
        year_filter = request.args.get('year', type=int)
        apartment_id = request.args.get('apartment_id', type=int)

        # Build base query
        query = Payment.query

        # Filter by apartment if tenant has one or if specified
        if apartment_id:
            query = query.filter_by(apartment_id=apartment_id)
        elif tenant.apartment_id:
            query = query.filter_by(apartment_id=tenant.apartment_id)

        # Filter by year if specified
        if year_filter:
            query = query.filter_by(year=year_filter)

        payments = query.all()
        history = []

        for payment in payments:
            # Check if this payment involves the tenant
            tenant_involved = False
            tenant_amount_due = 0
            tenant_amount_paid = 0

            # Check individual payments first
            if hasattr(payment, 'tenant_name') and payment.tenant_name == tenant.name:
                tenant_involved = True
                tenant_amount_due = float(payment.amount) if hasattr(payment, 'amount') and payment.amount else 0
                tenant_amount_paid = tenant_amount_due

            # Check batch payments (legacy format)
            elif payment.tenants:
                try:
                    tenants_data = json.loads(payment.tenants)
                    for tenant_data in tenants_data:
                        if tenant_data.get("name") == tenant.name:
                            tenant_involved = True
                            tenant_amount_due = float(tenant_data.get("amountDue", 0))
                            tenant_amount_paid = float(tenant_data.get("amountPaid", 0))
                            break
                except (json.JSONDecodeError, TypeError):
                    continue

            if not tenant_involved:
                continue

            # Skip if no payment date or status is not_applicable
            if not hasattr(payment, "paymentDate") or not payment.paymentDate or payment.status == "not_applicable":
                continue

            # Build history entry
            entry = {
                "id": payment.id,
                "apartment_id": payment.apartment_id,
                "month": payment.month,
                "year": payment.year,
                "status": payment.status,
                "amountDue": tenant_amount_due,
                "amountPaid": tenant_amount_paid,
                "paymentDate": payment.paymentDate.isoformat() if payment.paymentDate else None,
                "paymentMethod": getattr(payment, "paymentMethod", "bank_transfer"),
                "paymentType": getattr(payment, "payment_type", "rent"),
                "notes": getattr(payment, "notes", ""),
                "isIndividual": bool(hasattr(payment, 'amount') and payment.amount and hasattr(payment, 'tenant_name') and payment.tenant_name == tenant.name),
                "contract_period_id": getattr(payment, "contract_period_id", None)
            }

            # Add contract info if available
            if hasattr(payment, "contract_period") and payment.contract_period:
                entry["contract_info"] = {
                    "contract_number": payment.contract_period.contract_number,
                    "start_date": payment.contract_period.start_date.isoformat() if payment.contract_period.start_date else None,
                    "end_date": payment.contract_period.end_date.isoformat() if payment.contract_period.end_date else None,
                }

            history.append(entry)

        # Sort by payment date (most recent first)
        history.sort(key=lambda x: x["paymentDate"] if x["paymentDate"] else "", reverse=True)

        return jsonify({
            "tenant": {
                "id": tenant.id,
                "name": tenant.name,
                "apartment_id": tenant.apartment_id
            },
            "payments": history,
            "summary": {
                "total_payments": len(history),
                "total_paid": sum(p["amountPaid"] for p in history),
                "total_due": sum(p["amountDue"] for p in history),
                "outstanding": sum(max(0, p["amountDue"] - p["amountPaid"]) for p in history)
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving tenant payment history: {e}")
        return jsonify({"message": "Error retrieving tenant payment history", "error": str(e)}), 500


@payment_history_bp.route("/apartment-tenant-payments/<int:apartment_id>", methods=["GET"])
@token_required
def get_apartment_tenant_payments(apartment_id):
    """
    Get payment breakdown by tenant for a specific apartment.
    """
    try:
        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get optional filters
        year_filter = request.args.get('year', type=int)
        tenant_name_filter = request.args.get('tenant_name')

        # Query payments for this apartment
        query = Payment.query.filter_by(apartment_id=apartment_id)
        if year_filter:
            query = query.filter_by(year=year_filter)

        payments = query.all()

        # Group payments by tenant
        tenant_payments = {}

        for payment in payments:
            # Skip payments without payment date
            if not hasattr(payment, "paymentDate") or not payment.paymentDate:
                continue

            # Handle individual payments
            if (hasattr(payment, 'tenant_name') and payment.tenant_name and
                hasattr(payment, 'amount') and payment.amount):
                tenant_name = payment.tenant_name

                # Apply tenant filter if specified
                if tenant_name_filter and tenant_name_filter.lower() not in tenant_name.lower():
                    continue

                if tenant_name not in tenant_payments:
                    tenant_payments[tenant_name] = []

                tenant_payments[tenant_name].append({
                    "id": payment.id,
                    "month": payment.month,
                    "year": payment.year,
                    "amountDue": float(payment.amount),
                    "amountPaid": float(payment.amount),
                    "paymentDate": payment.paymentDate.isoformat(),
                    "paymentMethod": getattr(payment, "paymentMethod", "bank_transfer"),
                    "paymentType": getattr(payment, "payment_type", "rent"),
                    "notes": getattr(payment, "notes", ""),
                    "isIndividual": True,
                    "contract_period_id": getattr(payment, "contract_period_id", None)
                })

            # Handle batch payments
            elif payment.tenants:
                try:
                    tenants_data = json.loads(payment.tenants)
                    for tenant_data in tenants_data:
                        tenant_name = tenant_data.get("name", "")
                        if not tenant_name:
                            continue

                        # Apply tenant filter if specified
                        if tenant_name_filter and tenant_name_filter.lower() not in tenant_name.lower():
                            continue

                        if tenant_name not in tenant_payments:
                            tenant_payments[tenant_name] = []

                        tenant_payments[tenant_name].append({
                            "id": payment.id,
                            "month": payment.month,
                            "year": payment.year,
                            "amountDue": float(tenant_data.get("amountDue", 0)),
                            "amountPaid": float(tenant_data.get("amountPaid", 0)),
                            "paymentDate": payment.paymentDate.isoformat() if payment.paymentDate else None,
                            "paymentMethod": getattr(payment, "paymentMethod", "bank_transfer"),
                            "paymentType": "rent",  # Batch payments are typically rent
                            "notes": getattr(payment, "notes", ""),
                            "isIndividual": False,
                            "contract_period_id": getattr(payment, "contract_period_id", None)
                        })
                except (json.JSONDecodeError, TypeError):
                    continue

        # Calculate summaries for each tenant
        tenant_summaries = {}
        for tenant_name, payments_list in tenant_payments.items():
            total_due = sum(p["amountDue"] for p in payments_list)
            total_paid = sum(p["amountPaid"] for p in payments_list)
            outstanding = max(0, total_due - total_paid)
            payment_ratio = (total_paid / total_due * 100) if total_due > 0 else 0

            tenant_summaries[tenant_name] = {
                "payments": payments_list,
                "summary": {
                    "total_payments": len(payments_list),
                    "total_due": total_due,
                    "total_paid": total_paid,
                    "outstanding": outstanding,
                    "payment_ratio": round(payment_ratio, 2)
                }
            }

        return jsonify({
            "apartment_id": apartment_id,
            "apartment_address": apartment.address,
            "tenant_payments": tenant_summaries,
            "filters": {
                "year": year_filter,
                "tenant_name": tenant_name_filter
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving apartment tenant payments: {e}")
        return jsonify({"message": "Error retrieving apartment tenant payments", "error": str(e)}), 500
