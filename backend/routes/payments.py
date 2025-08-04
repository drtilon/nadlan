# routes/payments.py - Fixed version
import json
from flask import Blueprint, request, jsonify, current_app
from .auth import token_required
from extentions import db
from models.models import Apartment, Payment, Tenant
from datetime import datetime, timedelta
from sqlalchemy import and_, func, desc
from activity_logger import ActivityLogger

payments_bp = Blueprint("payments_bp", __name__)

# ============ INDIVIDUAL PAYMENT ENDPOINTS ============

@payments_bp.route("/payment", methods=["POST"])
@token_required
def add_individual_payment():
    """
    Add a new individual payment record.
    """
    try:
        data = request.json
        apartment_id = data.get('apartment_id')
        amount = float(data.get('amount', 0))
        tenant_name = data.get('tenant_name', '')
        payment_method = data.get('payment_method', 'bank_transfer')
        payment_date_str = data.get('payment_date')
        payment_type = data.get('payment_type', 'rent')
        month = data.get('month', '')
        year = int(data.get('year', datetime.utcnow().year))
        notes = data.get('notes', '')

        # Validate required fields
        if not apartment_id or not amount or not tenant_name:
            return jsonify({"message": "Missing required fields: apartment_id, amount, tenant_name"}), 400

        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Parse payment date
        payment_date = datetime.utcnow()
        if payment_date_str:
            try:
                payment_date = datetime.fromisoformat(payment_date_str.replace("Z", "+00:00"))
            except ValueError:
                try:
                    payment_date = datetime.strptime(payment_date_str, "%Y-%m-%d")
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

        # Create new payment record
        new_payment = Payment(
            apartment_id=apartment_id,
            month=month,
            year=year,
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
        
        # Add new model fields if they exist
        if hasattr(new_payment, 'amount'):
            new_payment.amount = amount
        if hasattr(new_payment, 'payment_type'):
            new_payment.payment_type = payment_type
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
            
            # Update tenant data
            tenant_data = [{
                "name": tenant_name,
                "amountPaid": amount,
                "amountDue": amount,
                "paid": True
            }]
            payment.tenants = json.dumps(tenant_data)
            
            # Update new model fields if they exist
            if hasattr(payment, 'amount'):
                payment.amount = amount
            if hasattr(payment, 'tenant_name'):
                payment.tenant_name = tenant_name

        if 'payment_method' in data:
            payment.paymentMethod = data['payment_method']
        
        if 'payment_date' in data:
            try:
                payment.paymentDate = datetime.fromisoformat(data['payment_date'].replace("Z", "+00:00"))
            except:
                try:
                    payment.paymentDate = datetime.strptime(data['payment_date'], "%Y-%m-%d")
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
        
        if payment.tenants:
            tenants_data = json.loads(payment.tenants)
            payment_data["amount"] = sum(float(t.get("amountPaid", 0)) for t in tenants_data)
        
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

# ============ PAYMENT HISTORY ============

@payments_bp.route("/payment-history/<int:apartment_id>", methods=["GET"])
@token_required
def get_payment_history(apartment_id):
    """
    Get comprehensive payment history for an apartment.
    """
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        year_filter = request.args.get('year', type=int)
        
        query = Payment.query.filter_by(apartment_id=apartment_id)
        if year_filter:
            query = query.filter_by(year=year_filter)
        
        # MySQL-compatible ordering - NULL paymentDates will come last naturally with DESC
        payments = query.order_by(
            Payment.paymentDate.desc(),
            Payment.updated_at.desc()
        ).all()
        history = []

        for payment in payments:
            # Skip payments without payment date (these are unpaid monthly records)
            if not payment.paymentDate or payment.status == "not_applicable":
                continue

            # Handle both old and new payment formats
            amount_paid = 0
            tenant_name = ''
            tenant_names = []
            
            if payment.tenants:
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
                "status": payment.status,
                "amountPaid": amount_paid,
                "paymentDate": payment.paymentDate.isoformat() if payment.paymentDate else None,
                "paymentMethod": payment.paymentMethod or "bank_transfer",
                "paymentType": getattr(payment, "payment_type", "rent"),
                "tenant_name": tenant_name,
                "tenant_names": tenant_names,
                "notes": payment.notes or "",
                "isIndividual": bool(hasattr(payment, 'amount') and payment.amount)
            }
            history.append(entry)

        return jsonify(history), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving payment history: {e}")
        return jsonify({"message": "Error retrieving payment history", "error": str(e)}), 500

# ============ BATCH PAYMENT ENDPOINT (LEGACY) ============

@payments_bp.route("/payments/<int:apartment_id>", methods=["POST"])
@token_required
def update_batch_payments(apartment_id):
    """
    LEGACY ENDPOINT - Updates/creates batch payments for multiple months.
    This is used by the old monthly payment interface.
    """
    data = request.json
    month_list = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ]
    selected_year = data.get("year", datetime.utcnow().year)
    
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404
            
        current_app.logger.info(f"Updating batch payments for apartment {apartment_id}, year {selected_year}")
        
        # Track changes for logging
        updated_payments = []
        created_payments = []
        
        for month in month_list:
            month_data = data.get("payments", {}).get(month)
            if not month_data:
                continue
                
            # Extract payment data
            internet = float(month_data.get("extraPayments", {}).get("internet", 0))
            electricity = float(month_data.get("extraPayments", {}).get("electricity", 0))
            other = float(month_data.get("extraPayments", {}).get("other", 0))

            if internet == 0 and "internet" in month_data:
                internet = float(month_data["internet"])
            if electricity == 0 and "electricity" in month_data:
                electricity = float(month_data["electricity"])
            if other == 0 and "other" in month_data:
                other = float(month_data["other"])

            extra_payments = {
                "internet": internet,
                "electricity": electricity,
                "other": other,
            }
            extra_payments_json = json.dumps(extra_payments)

            tenants = month_data.get("tenants", [])
            for tenant in tenants:
                if "amountDue" not in tenant:
                    tenant["amountDue"] = 0
                if "amountPaid" not in tenant:
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
            
            # Look for existing batch payment (exclude individual payments by checking for standard month names)
            payment = Payment.query.filter_by(
                apartment_id=apartment_id, 
                month=month,
                year=selected_year
            ).filter(
                # Only get batch payments (standard month names, not individual payment IDs)
                Payment.month.in_(month_list)
            ).first()

            if payment:
                # Update existing batch payment
                original_status = payment.status
                original_amount_paid = sum(float(t.get("amountPaid", 0)) for t in json.loads(payment.tenants)) if payment.tenants else 0
                
                payment.status = status
                payment.tenants = tenants_json
                payment.internet = internet
                payment.electricity = electricity
                payment.other = other
                payment.extraPayments = extra_payments_json
                payment.year = selected_year
                
                if status == "paid" and payment_date_str:
                    payment.paymentDate = payment_date or datetime.utcnow()
                elif status == "paid" and not payment.paymentDate:
                    payment.paymentDate = datetime.utcnow()
                    
                payment.paymentMethod = payment_method
                payment.notes = notes
                payment.updated_at = datetime.utcnow()
                
                # Clear individual payment fields to mark as batch
                if hasattr(payment, 'amount'):
                    payment.amount = None
                if hasattr(payment, 'tenant_name'):
                    payment.tenant_name = None
                if hasattr(payment, 'payment_type'):
                    payment.payment_type = None
                
                new_amount_paid = sum(float(tenant.get("amountPaid", 0)) for tenant in tenants)
                
                updated_payments.append({
                    "id": payment.id,
                    "month": month,
                    "year": selected_year,
                    "old_status": original_status,
                    "new_status": status,
                    "old_amount_paid": original_amount_paid,
                    "new_amount_paid": new_amount_paid
                })
            else:
                # Create new batch payment
                new_payment = Payment(
                    apartment_id=apartment_id,
                    month=month,
                    year=selected_year,
                    status=status,
                    tenants=tenants_json,
                    internet=internet,
                    electricity=electricity,
                    other=other,
                    extraPayments=extra_payments_json,
                    paymentDate=payment_date if payment_date else (datetime.utcnow() if status == "paid" else None),
                    paymentMethod=payment_method,
                    notes=notes,
                    updated_at=datetime.utcnow()
                )
                
                # Ensure individual payment fields are None for batch payments
                if hasattr(new_payment, 'amount'):
                    new_payment.amount = None
                if hasattr(new_payment, 'tenant_name'):
                    new_payment.tenant_name = None
                if hasattr(new_payment, 'payment_type'):
                    new_payment.payment_type = None
                
                db.session.add(new_payment)
                db.session.flush()
                
                created_payments.append({
                    "id": new_payment.id,
                    "month": month,
                    "year": selected_year,
                    "status": status,
                    "amount_paid": sum(float(tenant.get("amountPaid", 0)) for tenant in tenants)
                })

        db.session.commit()
        
        # Log the batch update
        ActivityLogger.log_payment_action(
            action="update_batch",
            payment_id=None,
            apartment_id=apartment_id,
            details={
                "year": selected_year,
                "updated_payments": len(updated_payments),
                "created_payments": len(created_payments)
            }
        )
        
        return jsonify({"message": f"Batch payments for {selected_year} updated successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating batch payments: {e}")
        return jsonify({"message": "Error updating batch payments", "error": str(e)}), 500

# ============ LEGACY ENDPOINTS FOR BACKWARD COMPATIBILITY ============

@payments_bp.route("/payments/<int:apartment_id>", methods=["GET"])
@token_required
def get_payments(apartment_id):
    """
    Returns payment details for the given apartment.
    KEPT FOR BACKWARD COMPATIBILITY
    """
    try:
        year = request.args.get('year', datetime.utcnow().year, type=int)
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get only batch payments (standard month names) for the monthly view
        month_list = [
            "January", "February", "March", "April", "May", "June", 
            "July", "August", "September", "October", "November", "December"
        ]
        
        payments_records = Payment.query.filter(
            Payment.apartment_id == apartment_id,
            Payment.year == year,
            Payment.month.in_(month_list)  # Only standard month names (batch payments)
        ).all()
        
        payments_by_month = {payment.month: payment for payment in payments_records}
        available_years = get_available_payment_years(apartment_id)
        response_data = {}
        
        # Get apartment tenants
        apartment_tenants = []
        if apartment.tenants:
            for tenant in apartment.tenants:
                apartment_tenants.append({
                    "id": tenant.id,
                    "name": tenant.name,
                    "amountDue": 0,
                    "amountPaid": 0,
                    "paid": False
                })
        
        for month in month_list:
            if month in payments_by_month:
                payment = payments_by_month[month]
                tenants = json.loads(payment.tenants) if payment.tenants else []
                
                for tenant in tenants:
                    if "amountDue" not in tenant:
                        tenant["amountDue"] = 0
                    if "amountPaid" not in tenant:
                        tenant["amountPaid"] = 0
                        
                extra_payments = {
                    "internet": payment.internet if payment.internet is not None else 0,
                    "electricity": payment.electricity if payment.electricity is not None else 0,
                    "other": payment.other if payment.other is not None else 0,
                }
                
                response_data[month] = {
                    "id": payment.id,
                    "apartment_id": payment.apartment_id,
                    "month": payment.month,
                    "status": payment.status,
                    "tenants": tenants,
                    "extraPayments": extra_payments,
                    "internet": payment.internet if payment.internet is not None else 0,
                    "electricity": payment.electricity if payment.electricity is not None else 0,
                    "other": payment.other if payment.other is not None else 0,
                    "year": payment.year,
                    "updated_at": payment.updated_at.isoformat() if payment.updated_at else None,
                    "paymentDate": payment.paymentDate.isoformat() if payment.paymentDate else None,
                    "paymentMethod": payment.paymentMethod or "bank_transfer",
                    "notes": payment.notes or ""
                }
            else:
                # Default empty month
                tenant_defaults = []
                if apartment_tenants:
                    rent = float(apartment.rent) if apartment.rent else 0
                    amount_per_tenant = rent / len(apartment_tenants) if apartment_tenants else 0
                    for tenant in apartment_tenants:
                        tenant_defaults.append({
                            "id": tenant["id"],
                            "name": tenant["name"],
                            "amountDue": amount_per_tenant,
                            "amountPaid": 0,
                            "paid": False
                        })
                        
                response_data[month] = {
                    "status": "not_paid",
                    "tenants": tenant_defaults,
                    "extraPayments": {"internet": 0, "electricity": 0, "other": 0},
                    "internet": 0,
                    "electricity": 0,
                    "other": 0,
                    "year": year,
                    "paymentDate": None,
                    "paymentMethod": "bank_transfer",
                    "notes": ""
                }
        
        metadata = {
            "apartment_id": apartment_id,
            "year": year,
            "available_years": available_years
        }
        
        return jsonify({
            "payments": response_data,
            "metadata": metadata
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error getting payments: {e}")
        return jsonify({"message": "Error getting payments", "error": str(e)}), 500

# ============ UTILITY FUNCTIONS ============

def get_available_payment_years(apartment_id):
    """
    Get a list of years that have payment records for this apartment.
    """
    existing_years = db.session.query(Payment.year).filter_by(
        apartment_id=apartment_id
    ).distinct().all()
    years = [year[0] for year in existing_years]
    
    apartment = Apartment.query.get(apartment_id)
    if apartment:
        if apartment.moveInDate:
            start_year = apartment.moveInDate.year
            if start_year not in years:
                years.append(start_year)
        if apartment.contractEndDate:
            if apartment.contractEndDate.year not in years:
                years.append(apartment.contractEndDate.year)
    
    if not years:
        years.append(datetime.utcnow().year)
    
    years.sort(reverse=True)
    return years

# ============ OTHER ENDPOINTS ============

@payments_bp.route("/apartment/<int:apartment_id>", methods=["GET"])
@token_required
def get_apartment_details(apartment_id):
    """
    Returns details of the apartment.
    """
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404
        return jsonify(apartment.to_dict()), 200
    except Exception as e:
        current_app.logger.error(f"Error getting apartment details: {e}")
        return jsonify({"message": "Error getting apartment details", "error": str(e)}), 500

@payments_bp.route("/payments/<int:apartment_id>/years", methods=["GET"])
@token_required
def get_payment_years(apartment_id):
    """
    Returns available years for apartment payments.
    """
    try:
        years = get_available_payment_years(apartment_id)
        return jsonify({"years": years}), 200
    except Exception as e:
        current_app.logger.error(f"Error getting payment years: {e}")
        return jsonify({"message": "Error getting payment years", "error": str(e)}), 500
