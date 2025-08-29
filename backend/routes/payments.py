# routes/payments.py - FIXED VERSION (Key sections that need updates)

from flask import Blueprint, request, jsonify, current_app
from .auth import token_required, role_required
from extentions import db
from models.models import Payment, Apartment, Tenant, ContractPeriod, ContractTenant
from datetime import datetime, date, timedelta
from activity_logger import ActivityLogger
import json
import calendar
from sqlalchemy import case, func



payments_bp = Blueprint("payments_bp", __name__)

@payments_bp.route("/payment-history/<int:apartment_id>", methods=["GET"])
@token_required
def get_payment_history(apartment_id):
    """
    Get comprehensive payment history for an apartment - MYSQL FIXED VERSION
    """
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        year_filter = request.args.get('year', type=int)

        query = Payment.query.filter_by(apartment_id=apartment_id)
        if year_filter:
            query = query.filter_by(year=year_filter)

        # FIXED: MySQL-compatible NULL handling instead of .nullslast()
        payments = query.order_by(
            case(
                (Payment.payment_date.is_(None), 1),  # NULLs get value 1 (sorted last)
                else_=0  # Non-NULLs get value 0 (sorted first)
            ).asc(),
            Payment.payment_date.desc(),  # Then by actual date descending
            Payment.updated_at.desc()     # Finally by updated_at
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
@payments_bp.route("/payment/individual", methods=["POST"])
@token_required
def add_individual_payment():
    """Add an individual payment for a specific tenant"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Extract and validate required fields
        apartment_id = data.get('apartment_id')
        tenant_name = data.get('tenant_name')
        amount = data.get('amount')
        payment_method = data.get('payment_method', 'bank_transfer')
        payment_date_str = data.get('payment_date')
        payment_type = data.get('payment_type', 'rent')
        month = data.get('month')
        year = data.get('year')
        notes = data.get('notes', '')

        if not all([apartment_id, tenant_name, amount, payment_date_str]):
            return jsonify({"message": "Missing required fields: apartment_id, tenant_name, amount, payment_date"}), 400

        # Validate apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Validate tenant exists
        tenant = Tenant.query.filter_by(name=tenant_name).first()
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Parse payment date
        try:
            payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400

        # Validate amount
        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({"message": "Amount must be greater than 0"}), 400
        except (ValueError, TypeError):
            return jsonify({"message": "Invalid amount"}), 400

        # Create unique month identifier for individual payments
        month_identifier = f"individual_{tenant_name}_{payment_date.strftime('%Y%m%d_%H%M%S')}"

        # Create tenant data structure
        tenant_data = [{
            "id": tenant.id,
            "name": tenant.name,
            "amountPaid": amount,
            "amountDue": amount,
            "paid": True
        }]

        # Create new payment record
        new_payment = Payment(
            apartment_id=apartment_id,
            month=month_identifier,
            year=payment_date.year,
            status='paid',
            tenants=json.dumps(tenant_data),
            internet=0.0,
            electricity=0.0,
            other=0.0,
            extraPayments="{}",
            paymentDate=payment_date,
            paymentMethod=payment_method,
            notes=notes,
            updated_at=datetime.utcnow()
        )

        # Set the amount field if it exists
        if hasattr(new_payment, 'amount'):
            new_payment.amount = amount

        db.session.add(new_payment)
        db.session.commit()

        # Log activity
        ActivityLogger.log_activity(
            action="add_individual_payment",
            entity_type="payment",
            entity_id=new_payment.id,
            details={
                "apartment_id": apartment_id,
                "tenant_name": tenant_name,
                "amount": amount,
                "payment_type": payment_type,
                "payment_date": payment_date.isoformat()
            }
        )

        return jsonify({
            "message": "Individual payment added successfully",
            "payment_id": new_payment.id,
            "tenant_name": tenant_name,
            "apartment_address": apartment.address,
            "amount": amount,
            "payment_date": payment_date.isoformat(),
            "payment_type": payment_type
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

@payments_bp.route("/payment", methods=["POST"])
@token_required
def create_individual_payment():
    """
    Create individual payment - FIXED to handle month conversion from string to integer
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Extract data exactly as your frontend sends it
        apartment_id = data.get('apartment_id')
        amount = data.get('amount')
        tenant_name = data.get('tenant_name')
        payment_method = data.get('payment_method', 'bank_transfer')
        payment_date_str = data.get('payment_date')
        payment_type = data.get('payment_type', 'rent')
        month_name = data.get('month')  # Frontend sends 'August', 'January', etc.
        year = data.get('year')
        notes = data.get('notes', '')
        contract_period_id = data.get('contract_period_id')

        # Basic validation
        if not apartment_id:
            return jsonify({"message": "Apartment ID is required"}), 400
        if not amount or float(amount) <= 0:
            return jsonify({"message": "Valid amount is required"}), 400
        if not tenant_name:
            return jsonify({"message": "Tenant name is required"}), 400

        # Validate apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # FIXED: Convert month name to integer (1-12)
        month_mapping = {
            'January': 1, 'February': 2, 'March': 3, 'April': 4,
            'May': 5, 'June': 6, 'July': 7, 'August': 8,
            'September': 9, 'October': 10, 'November': 11, 'December': 12
        }

        # Convert month name to integer
        if month_name and isinstance(month_name, str):
            month_int = month_mapping.get(month_name)
            if not month_int:
                return jsonify({"message": f"Invalid month name: {month_name}"}), 400
        elif month_name and isinstance(month_name, int):
            month_int = month_name  # Already an integer
        else:
            month_int = datetime.now().month  # Default to current month

        # Parse payment date
        payment_date = None
        if payment_date_str:
            try:
                payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"message": "Invalid payment date format. Use YYYY-MM-DD"}), 400

        # Create payment record
        new_payment = Payment(
            apartment_id=apartment_id,
            month=month_int,  # FIXED: Use integer month (1-12) not string
            year=year or datetime.now().year,
            amount=float(amount),  # Required field in your model
            status='paid',
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # Set optional fields based on what exists in your Payment model
        if hasattr(new_payment, 'payment_date'):
            new_payment.payment_date = payment_date
        elif hasattr(new_payment, 'paymentDate'):
            new_payment.paymentDate = payment_date

        if hasattr(new_payment, 'tenant_name'):
            new_payment.tenant_name = tenant_name

        if hasattr(new_payment, 'payment_method'):
            new_payment.payment_method = payment_method
        elif hasattr(new_payment, 'paymentMethod'):
            new_payment.paymentMethod = payment_method

        if hasattr(new_payment, 'payment_type'):
            new_payment.payment_type = payment_type

        if hasattr(new_payment, 'notes'):
            new_payment.notes = notes

        if hasattr(new_payment, 'contract_period_id') and contract_period_id:
            new_payment.contract_period_id = contract_period_id

        # Create legacy tenants JSON for backward compatibility
        tenant_data = [{
            "name": tenant_name,
            "amountPaid": float(amount),
            "amountDue": float(amount),
            "paid": True
        }]
        if hasattr(new_payment, 'tenants'):
            new_payment.tenants = json.dumps(tenant_data)

        # Set other legacy fields for backward compatibility (with defaults from your model)
        for field, value in [
            ('internet', 0.0),
            ('electricity', 0.0),
            ('other', 0.0),
            ('extraPayments', '{}'),
            ('tenant_payments', None)
        ]:
            if hasattr(new_payment, field):
                setattr(new_payment, field, value)

        db.session.add(new_payment)
        db.session.commit()

        # Log activity
        ActivityLogger.log_payment_action(
            action="create_individual",
            payment_id=new_payment.id,
            apartment_id=apartment_id,
            details={
                "amount": float(amount),
                "tenant_name": tenant_name,
                "payment_method": payment_method,
                "payment_type": payment_type,
                "month": month_int,
                "month_name": month_name,
                "year": year
            }
        )

        return jsonify({
            "message": "Individual payment created successfully",
            "payment_id": new_payment.id,
            "apartment_id": apartment_id,
            "amount": float(amount),
            "tenant_name": tenant_name,
            "month": month_int,
            "month_name": month_name,
            "year": year,
            "payment_date": payment_date.isoformat() if payment_date else None
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating individual payment: {e}")
        return jsonify({"message": "Error creating individual payment", "error": str(e)}), 500


@payments_bp.route("/payments/<int:apartment_id>", methods=["POST"])
@token_required
def update_batch_payments(apartment_id):
    """
    FIXED: Updates/creates batch payments with proper month name to integer conversion
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        payments_data = data.get('payments', {})
        selected_year = data.get('year', datetime.now().year)

        if not payments_data:
            return jsonify({"message": "No payment data provided"}), 400

        # Month name to integer mapping
        month_mapping = {
            'January': 1, 'February': 2, 'March': 3, 'April': 4,
            'May': 5, 'June': 6, 'July': 7, 'August': 8,
            'September': 9, 'October': 10, 'November': 11, 'December': 12
        }

        results = []
        updated_count = 0
        created_count = 0

        for month_name, payment_info in payments_data.items():
            # FIXED: Convert month name to integer
            if isinstance(month_name, str) and month_name in month_mapping:
                month_int = month_mapping[month_name]
            elif isinstance(month_name, int):
                month_int = month_name  # Already an integer
            else:
                current_app.logger.warning(f"Invalid month format: {month_name}")
                continue

            status = payment_info.get('status', 'paid')
            tenants = payment_info.get('tenants', [])
            extra_payments = payment_info.get('extraPayments', {})
            payment_date_str = payment_info.get('paymentDate')
            payment_method = payment_info.get('paymentMethod', 'bank_transfer')
            notes = payment_info.get('notes', '')
            contract_period_id = payment_info.get('contract_period_id')

            # Parse payment date
            payment_date = None
            if payment_date_str:
                try:
                    payment_date = datetime.fromisoformat(payment_date_str.replace("Z", "+00:00")).date()
                except:
                    try:
                        payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d').date()
                    except:
                        payment_date = datetime.utcnow().date()

            # Prepare data
            tenants_json = json.dumps(tenants)
            extra_payments_json = json.dumps(extra_payments)

            # Calculate amounts
            total_amount = sum(float(t.get('amountDue', 0)) for t in tenants)
            internet = float(extra_payments.get('internet', 0))
            electricity = float(extra_payments.get('electricity', 0))
            other = float(extra_payments.get('other', 0))

            # Look for existing payment using integer month
            existing_payment = Payment.query.filter_by(
                apartment_id=apartment_id,
                month=month_int,  # FIXED: Use integer month
                year=selected_year
            ).first()

            if existing_payment:
                # Update existing payment
                original_status = getattr(existing_payment, 'status', 'unknown')

                # Update fields
                if hasattr(existing_payment, 'status'):
                    existing_payment.status = status
                if hasattr(existing_payment, 'tenants'):
                    existing_payment.tenants = tenants_json
                if hasattr(existing_payment, 'amount'):
                    existing_payment.amount = total_amount

                # Update other fields
                for field, value in [
                    ('internet', internet),
                    ('electricity', electricity),
                    ('other', other),
                    ('extraPayments', extra_payments_json),
                    ('notes', notes)
                ]:
                    if hasattr(existing_payment, field):
                        setattr(existing_payment, field, value)

                # Update payment date
                if status == "paid" and payment_date:
                    if hasattr(existing_payment, 'payment_date'):
                        existing_payment.payment_date = payment_date
                    elif hasattr(existing_payment, 'paymentDate'):
                        existing_payment.paymentDate = payment_date

                # Update payment method
                if hasattr(existing_payment, 'payment_method'):
                    existing_payment.payment_method = payment_method
                elif hasattr(existing_payment, 'paymentMethod'):
                    existing_payment.paymentMethod = payment_method

                # Update contract period
                if hasattr(existing_payment, 'contract_period_id') and contract_period_id:
                    existing_payment.contract_period_id = contract_period_id

                existing_payment.updated_at = datetime.utcnow()
                updated_count += 1

                # Log payment update
                ActivityLogger.log_payment_action(
                    action="update_batch",
                    payment_id=existing_payment.id,
                    apartment_id=apartment_id,
                    details={
                        "month": month_int,
                        "month_name": month_name,
                        "year": selected_year,
                        "original_status": original_status,
                        "new_status": status,
                        "amount": total_amount
                    }
                )

            else:
                # Create new payment
                new_payment = Payment(
                    apartment_id=apartment_id,
                    month=month_int,  # FIXED: Use integer month
                    year=selected_year,
                    status=status,
                    amount=total_amount,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )

                # Set optional fields
                if hasattr(new_payment, 'tenants'):
                    new_payment.tenants = tenants_json

                if hasattr(new_payment, 'payment_date') and status == "paid" and payment_date:
                    new_payment.payment_date = payment_date
                elif hasattr(new_payment, 'paymentDate') and status == "paid" and payment_date:
                    new_payment.paymentDate = payment_date

                if hasattr(new_payment, 'payment_method'):
                    new_payment.payment_method = payment_method
                elif hasattr(new_payment, 'paymentMethod'):
                    new_payment.paymentMethod = payment_method

                if hasattr(new_payment, 'contract_period_id') and contract_period_id:
                    new_payment.contract_period_id = contract_period_id

                # Set other fields
                for field, value in [
                    ('internet', internet),
                    ('electricity', electricity),
                    ('other', other),
                    ('extraPayments', extra_payments_json),
                    ('notes', notes),
                    ('tenant_payments', None)
                ]:
                    if hasattr(new_payment, field):
                        setattr(new_payment, field, value)

                db.session.add(new_payment)
                db.session.flush()  # Get the ID
                created_count += 1

                # Log payment creation
                ActivityLogger.log_payment_action(
                    action="create_batch",
                    payment_id=new_payment.id,
                    apartment_id=apartment_id,
                    details={
                        "month": month_int,
                        "month_name": month_name,
                        "year": selected_year,
                        "status": status,
                        "amount": total_amount
                    }
                )

            results.append({
                "month": month_name,
                "month_int": month_int,
                "action": "updated" if existing_payment else "created",
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


@payments_bp.route("/payments/<int:apartment_id>", methods=["GET"])
@token_required
def get_batch_payments_data(apartment_id):
    """
    Get batch payments data - handles GET /api/payments/{apartment_id}?year=2025
    This endpoint loads existing payment data for the batch payment interface
    """
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get year filter from query parameters (used by frontend)
        year_filter = request.args.get('year', type=int)
        if not year_filter:
            year_filter = datetime.now().year

        # Get all payments for this apartment and year
        payments = Payment.query.filter_by(
            apartment_id=apartment_id,
            year=year_filter
        ).order_by(
            # Use your fixed MySQL-compatible ordering
            case(
                (Payment.payment_date.is_(None) if hasattr(Payment, 'payment_date') else True, 1),
                else_=0
            ).asc(),
            Payment.payment_date.desc() if hasattr(Payment, 'payment_date') else Payment.paymentDate.desc(),
            Payment.updated_at.desc()
        ).all()

        # Month integer to name mapping (for frontend compatibility)
        month_names = {
            1: 'January', 2: 'February', 3: 'March', 4: 'April',
            5: 'May', 6: 'June', 7: 'July', 8: 'August',
            9: 'September', 10: 'October', 11: 'November', 12: 'December'
        }

        # Structure the response exactly as your frontend expects
        payments_data = {}

        for payment in payments:
            # Convert month integer back to month name for frontend
            month_key = month_names.get(payment.month, f"Month_{payment.month}")

            # Extract tenant information
            tenants_info = []
            if hasattr(payment, 'tenants') and payment.tenants:
                try:
                    tenants_info = json.loads(payment.tenants)
                except:
                    tenants_info = []

            # If no tenants JSON, create from individual payment fields
            if not tenants_info and hasattr(payment, 'tenant_name') and payment.tenant_name:
                amount = float(payment.amount) if hasattr(payment, 'amount') and payment.amount else 0
                tenants_info = [{
                    "name": payment.tenant_name,
                    "amountPaid": amount,
                    "amountDue": amount,
                    "paid": True
                }]

            # Get payment date (handle both field types)
            payment_date = None
            if hasattr(payment, 'payment_date') and payment.payment_date:
                payment_date = payment.payment_date.isoformat()
            elif hasattr(payment, 'paymentDate') and payment.paymentDate:
                payment_date = payment.paymentDate.isoformat()

            # Extract extra payments
            extra_payments = {"internet": 0, "electricity": 0, "other": 0}
            if hasattr(payment, 'extraPayments') and payment.extraPayments:
                try:
                    extra_payments = json.loads(payment.extraPayments)
                except:
                    extra_payments = {
                        "internet": getattr(payment, 'internet', 0) or 0,
                        "electricity": getattr(payment, 'electricity', 0) or 0,
                        "other": getattr(payment, 'other', 0) or 0
                    }
            else:
                # Fallback to individual fields
                extra_payments = {
                    "internet": getattr(payment, 'internet', 0) or 0,
                    "electricity": getattr(payment, 'electricity', 0) or 0,
                    "other": getattr(payment, 'other', 0) or 0
                }

            # Build the payment data structure your frontend expects
            payments_data[month_key] = {
                "status": getattr(payment, 'status', 'paid'),
                "tenants": tenants_info,
                "extraPayments": extra_payments,
                "paymentDate": payment_date,
                "paymentMethod": getattr(payment, 'payment_method', getattr(payment, 'paymentMethod', 'bank_transfer')),
                "notes": getattr(payment, 'notes', ''),
                "contract_period_id": getattr(payment, 'contract_period_id', None)
            }

        current_app.logger.info(f"Returning batch payments data for apartment {apartment_id}, year {year_filter}: {len(payments_data)} months")

        # Return in the exact format your frontend expects
        return jsonify({
            "payments": payments_data,
            "apartment_id": apartment_id,
            "year": year_filter
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting batch payments data for apartment {apartment_id}: {e}")
        return jsonify({"message": "Error retrieving payments data", "error": str(e)}), 500


# ALSO MAKE SURE YOUR ROUTE SUPPORTS BOTH GET AND POST METHODS
# Update your existing POST endpoint to handle both methods:

@payments_bp.route("/payments/<int:apartment_id>", methods=["GET", "POST"])
@token_required
def handle_batch_payments(apartment_id):
    """
    Handle both GET and POST for batch payments
    GET: Load existing payment data
    POST: Update/create batch payments
    """
    if request.method == "GET":
        return get_batch_payments_data(apartment_id)
    else:  # POST
        return update_batch_payments(apartment_id)
