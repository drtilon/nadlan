# routes/payments.py - FIXED VERSION (Key sections that need updates)

from flask import Blueprint, request, jsonify, current_app
from .auth import token_required, role_required
from extentions import db
from models.models import Payment, Apartment, Tenant, ContractPeriod, ContractTenant
from datetime import datetime, date, timedelta
from activity_logger import ActivityLogger
import json
import calendar

payments_bp = Blueprint("payments_bp", __name__)

@payments_bp.route("/payment-history/<int:apartment_id>", methods=["GET"])
@token_required
def get_payment_history(apartment_id):
    """
    Get comprehensive payment history for an apartment.
    FIXED: Use payment_date instead of paymentDate
    """
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        year_filter = request.args.get('year', type=int)

        query = Payment.query.filter_by(apartment_id=apartment_id)
        if year_filter:
            query = query.filter_by(year=year_filter)

        # FIXED: Use payment_date instead of paymentDate and handle NULL values properly
        payments = query.order_by(
            Payment.payment_date.desc().nullslast(),
            Payment.updated_at.desc()
        ).all()

        history = []

        for payment in payments:
            # Skip payments without payment date (these are unpaid monthly records)
            if not payment.payment_date or getattr(payment, 'status', '') == "not_applicable":
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
                "paymentDate": payment.payment_date.isoformat() if payment.payment_date else None,
                "paymentMethod": getattr(payment, 'payment_method', 'bank_transfer'),
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

@payments_bp.route("/payment", methods=["POST"])
@token_required
@role_required("admin")
def add_individual_payment():
    """
    Add an individual payment record.
    FIXED: Use payment_date instead of paymentDate
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Required fields
        required_fields = ['apartment_id', 'amount', 'tenant_name']
        for field in required_fields:
            if field not in data:
                return jsonify({"message": f"Missing required field: {field}"}), 400

        apartment_id = data['apartment_id']
        amount = float(data['amount'])
        tenant_name = data['tenant_name']
        payment_method = data.get('payment_method', 'bank_transfer')
        payment_type = data.get('payment_type', 'rent')
        notes = data.get('notes', '')
        month = data.get('month')
        year = data.get('year', datetime.now().year)

        # Parse payment date
        payment_date = None
        if data.get('payment_date'):
            try:
                if 'T' in data['payment_date'] or 'Z' in data['payment_date']:
                    payment_date = datetime.fromisoformat(data['payment_date'].replace('Z', '+00:00'))
                else:
                    payment_date = datetime.strptime(data['payment_date'], '%Y-%m-%d')
            except ValueError:
                payment_date = datetime.utcnow()

        # Create tenant data structure for individual payment
        tenant_data = [{
            "name": tenant_name,
            "amountPaid": amount,
            "amountDue": amount,
            "paid": True
        }]

        # For non-rent payments, create unique identifier
        if payment_type != 'rent':
            month = f"{payment_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        elif not month:
            month = datetime.now().strftime('%B')

        # Create new payment record - FIXED: Use new model structure
        new_payment = Payment(
            apartment_id=apartment_id,
            month=month,
            year=year,
            amount=amount,
            payment_date=payment_date,
            payment_method=payment_method,
            payment_type=payment_type,
            notes=notes,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # Add legacy fields for backward compatibility if they exist
        if hasattr(new_payment, 'status'):
            new_payment.status = 'paid'
        if hasattr(new_payment, 'tenants'):
            new_payment.tenants = json.dumps(tenant_data)
        if hasattr(new_payment, 'tenant_name'):
            new_payment.tenant_name = tenant_name

        db.session.add(new_payment)
        db.session.flush()
        payment_id = new_payment.id
        db.session.commit()

        # Log the payment addition
        ActivityLogger.log_payment_action(
            action="add_individual",
            payment_id=payment_id,
            apartment_id=apartment_id,
            details={
                "amount": amount,
                "tenant": tenant_name,
                "payment_type": payment_type,
                "month": month,
                "year": year
            }
        )

        return jsonify({
            "message": "Individual payment added successfully",
            "payment_id": payment_id
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding individual payment: {e}")
        return jsonify({"message": "Error adding individual payment", "error": str(e)}), 500

@payments_bp.route("/payment/<int:payment_id>", methods=["PUT"])
@token_required
def update_individual_payment(payment_id):
    """
    Update an existing payment record.
    FIXED: Use payment_date instead of paymentDate
    """
    try:
        data = request.json
        payment = Payment.query.get(payment_id)

        if not payment:
            return jsonify({"message": "Payment not found"}), 404

        # Update payment fields
        if 'amount' in data:
            amount = float(data['amount'])
            tenant_name = data.get('tenant_name', '')

            # Update legacy tenant data if field exists
            if hasattr(payment, 'tenants'):
                tenant_data = [{
                    "name": tenant_name,
                    "amountPaid": amount,
                    "amountDue": amount,
                    "paid": True
                }]
                payment.tenants = json.dumps(tenant_data)

            # Update new model fields
            if hasattr(payment, 'amount'):
                payment.amount = amount
            if hasattr(payment, 'tenant_name'):
                payment.tenant_name = tenant_name

        if 'payment_method' in data:
            if hasattr(payment, 'payment_method'):
                payment.payment_method = data['payment_method']
            elif hasattr(payment, 'paymentMethod'):
                payment.paymentMethod = data['payment_method']

        if 'payment_date' in data:
            try:
                # FIXED: Use payment_date field instead of paymentDate
                payment_date_value = datetime.fromisoformat(data['payment_date'].replace("Z", "+00:00"))
                if hasattr(payment, 'payment_date'):
                    payment.payment_date = payment_date_value
                elif hasattr(payment, 'paymentDate'):
                    payment.paymentDate = payment_date_value
            except:
                try:
                    payment_date_value = datetime.strptime(data['payment_date'], "%Y-%m-%d")
                    if hasattr(payment, 'payment_date'):
                        payment.payment_date = payment_date_value
                    elif hasattr(payment, 'paymentDate'):
                        payment.paymentDate = payment_date_value
                except:
                    pass

        if 'notes' in data:
            payment.notes = data['notes']

        if 'month' in data:
            payment.month = data['month']

        if 'year' in data:
            payment.year = int(data['year'])

        if 'payment_type' in data and hasattr(payment, 'payment_type'):
            payment.payment_type = data['payment_type']

        payment.updated_at = datetime.utcnow()
        db.session.commit()

        # Log the payment update
        ActivityLogger.log_payment_action(
            action="update",
            payment_id=payment_id,
            apartment_id=payment.apartment_id,
            details=data
        )

        return jsonify({"message": "Payment updated successfully"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating payment: {e}")
        return jsonify({"message": "Error updating payment", "error": str(e)}), 500

@payments_bp.route("/payment/<int:payment_id>", methods=["DELETE"])
@token_required
def delete_individual_payment(payment_id):
    """
    Delete a payment record.
    """
    try:
        payment = Payment.query.get(payment_id)

        if not payment:
            return jsonify({"message": "Payment not found"}), 404

        apartment_id = payment.apartment_id

        # Capture payment data for logging
        payment_data = {
            "month": payment.month,
            "year": payment.year,
            "amount": 0
        }

        # Get amount from either old or new structure
        if hasattr(payment, 'tenants') and payment.tenants:
            tenants_data = json.loads(payment.tenants)
            payment_data["amount"] = sum(float(t.get("amountPaid", 0)) for t in tenants_data)
        elif hasattr(payment, 'amount') and payment.amount:
            payment_data["amount"] = float(payment.amount)

        # Log the payment deletion before deleting
        ActivityLogger.log_payment_action(
            action="delete",
            payment_id=payment_id,
            apartment_id=apartment_id,
            details=payment_data
        )

        db.session.delete(payment)
        db.session.commit()

        return jsonify({"message": "Payment deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting payment: {e}")
        return jsonify({"message": "Error deleting payment", "error": str(e)}), 500

@payments_bp.route("/payments/<int:apartment_id>", methods=["POST"])
@token_required
def update_batch_payments(apartment_id):
    """
    LEGACY ENDPOINT - Updates/creates batch payments for multiple months.
    FIXED: Use payment_date instead of paymentDate
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        selected_year = data.get("year", datetime.now().year)
        payments_data = data.get("payments", {})

        month_list = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]

        results = []
        updated_count = 0
        created_count = 0

        for month, month_data in payments_data.items():
            if month not in month_list:
                continue

            tenants = month_data.get("tenants", [])
            internet = float(month_data.get("internet", 0))
            electricity = float(month_data.get("electricity", 0))
            other = float(month_data.get("other", 0))
            extra_payments = month_data.get("extraPayments", {})
            extra_payments_json = json.dumps(extra_payments) if isinstance(extra_payments, dict) else "{}"

            # Reset paid status for all tenants if not explicitly paid
            for tenant in tenants:
                if not tenant.get("paid", False):
                    tenant["amountPaid"] = 0
            tenants_json = json.dumps(tenants)

            payment_date_str = month_data.get("paymentDate")
            payment_method = month_data.get("paymentMethod", "bank_transfer")
            notes = month_data.get("notes", "")
            status = month_data.get("status", "not_paid")

            payment_date = None
            if payment_date_str:
                try:
                    payment_date = datetime.fromisoformat(payment_date_str.replace("Z", "+00:00"))
                except ValueError:
                    try:
                        payment_date = datetime.strptime(payment_date_str, "%Y-%m-%d")
                    except ValueError:
                        payment_date = datetime.utcnow()

            # Look for existing batch payment
            payment = Payment.query.filter_by(
                apartment_id=apartment_id,
                month=month,
                year=selected_year
            ).filter(
                Payment.month.in_(month_list)
            ).first()

            if payment:
                # Update existing batch payment - FIXED: Use payment_date
                original_status = getattr(payment, 'status', 'unknown')
                original_amount_paid = 0

                if hasattr(payment, 'tenants') and payment.tenants:
                    try:
                        original_tenants = json.loads(payment.tenants)
                        original_amount_paid = sum(float(t.get("amountPaid", 0)) for t in original_tenants)
                    except:
                        pass

                # Update fields
                if hasattr(payment, 'status'):
                    payment.status = status
                if hasattr(payment, 'tenants'):
                    payment.tenants = tenants_json

                # Handle legacy fields
                for field, value in [
                    ('internet', internet),
                    ('electricity', electricity),
                    ('other', other),
                    ('extraPayments', extra_payments_json),
                    ('year', selected_year)
                ]:
                    if hasattr(payment, field):
                        setattr(payment, field, value)

                # Update payment date - FIXED: Use payment_date field
                if status == "paid" and payment_date_str:
                    if hasattr(payment, 'payment_date'):
                        payment.payment_date = payment_date
                    elif hasattr(payment, 'paymentDate'):
                        payment.paymentDate = payment_date

                # Update payment method
                if hasattr(payment, 'payment_method'):
                    payment.payment_method = payment_method
                elif hasattr(payment, 'paymentMethod'):
                    payment.paymentMethod = payment_method

                payment.updated_at = datetime.utcnow()
                updated_count += 1

                new_amount_paid = sum(float(t.get("amountPaid", 0)) for t in tenants)

                # Log payment update
                ActivityLogger.log_payment_action(
                    action="update_batch",
                    payment_id=payment.id,
                    apartment_id=apartment_id,
                    details={
                        "month": month,
                        "year": selected_year,
                        "original_status": original_status,
                        "new_status": status,
                        "original_amount": original_amount_paid,
                        "new_amount": new_amount_paid
                    }
                )

            else:
                # Create new payment - use new model structure
                new_payment = Payment(
                    apartment_id=apartment_id,
                    month=month,
                    year=selected_year
                )

                # Set amount based on tenants
                total_amount = sum(float(t.get("amountDue", 0)) for t in tenants)
                if hasattr(new_payment, 'amount'):
                    new_payment.amount = total_amount

                # Set payment details
                if hasattr(new_payment, 'payment_date') and status == "paid" and payment_date:
                    new_payment.payment_date = payment_date

                if hasattr(new_payment, 'payment_method'):
                    new_payment.payment_method = payment_method

                if hasattr(new_payment, 'payment_type'):
                    new_payment.payment_type = 'rent'

                if hasattr(new_payment, 'notes'):
                    new_payment.notes = notes

                # Legacy fields for backward compatibility
                if hasattr(new_payment, 'status'):
                    new_payment.status = status
                if hasattr(new_payment, 'tenants'):
                    new_payment.tenants = tenants_json
                if hasattr(new_payment, 'paymentDate') and status == "paid" and payment_date:
                    new_payment.paymentDate = payment_date
                if hasattr(new_payment, 'paymentMethod'):
                    new_payment.paymentMethod = payment_method

                for field, value in [
                    ('internet', internet),
                    ('electricity', electricity),
                    ('other', other),
                    ('extraPayments', extra_payments_json)
                ]:
                    if hasattr(new_payment, field):
                        setattr(new_payment, field, value)

                new_payment.created_at = datetime.utcnow()
                new_payment.updated_at = datetime.utcnow()

                db.session.add(new_payment)
                db.session.flush()
                created_count += 1

                # Log payment creation
                ActivityLogger.log_payment_action(
                    action="create_batch",
                    payment_id=new_payment.id,
                    apartment_id=apartment_id,
                    details={
                        "month": month,
                        "year": selected_year,
                        "status": status,
                        "amount": total_amount
                    }
                )

            results.append({
                "month": month,
                "action": "updated" if payment else "created",
                "status": status
            })

        db.session.commit()

        return jsonify({
            "message": f"Batch payments processed successfully. Updated: {updated_count}, Created: {created_count}",
            "results": results,
            "summary": {
                "updated": updated_count,
                "created": created_count,
                "total": len(results)
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating batch payments: {e}")
        return jsonify({"message": "Error updating batch payments", "error": str(e)}), 500
