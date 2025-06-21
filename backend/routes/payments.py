# routes/payments.py - Updated to support both old and new payment systems
import json
from flask import Blueprint, request, jsonify, current_app
from .auth import token_required
from extentions import db
from models.models import Apartment, Payment, Tenant
from datetime import datetime, timedelta
from sqlalchemy import and_, func, desc
from activity_logger import ActivityLogger

payments_bp = Blueprint("payments_bp", __name__)

# ============ NEW SIMPLIFIED PAYMENT ENDPOINTS ============

@payments_bp.route("/payment", methods=["POST"])
@token_required
def add_individual_payment():
    """
    Add a new individual payment record.
    Supports various payment types including deposits, extra payments, etc.
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

        # Create tenant data structure
        tenant_data = [{
            "name": tenant_name,
            "amountPaid": amount,
            "amountDue": amount if payment_type == 'rent' else 0,
            "paid": True
        }]

        # Determine unique month identifier for non-rent payments
        if payment_type != 'rent':
            month = f"{payment_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        elif not month:
            # Default to current month for rent payments
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
        
        # Add new fields if they exist in the model
        if hasattr(new_payment, 'amount'):
            new_payment.amount = amount
        if hasattr(new_payment, 'payment_type'):
            new_payment.payment_type = payment_type
        if hasattr(new_payment, 'tenant_name'):
            new_payment.tenant_name = tenant_name
        if hasattr(new_payment, 'description'):
            new_payment.description = f"{payment_type.title()} payment by {tenant_name}"
        if hasattr(new_payment, 'created_at'):
            new_payment.created_at = datetime.utcnow()
        
        db.session.add(new_payment)
        db.session.flush()
        payment_id = new_payment.id

        db.session.commit()

        # Log the payment addition
        ActivityLogger.log_payment_action(
            action="add",
            payment_id=payment_id,
            apartment_id=apartment_id,
            details={
                "amount": amount,
                "tenant": tenant_name,
                "payment_type": payment_type,
                "payment_method": payment_method,
                "month": month,
                "year": year
            }
        )

        return jsonify({
            "message": "Payment added successfully",
            "payment_id": payment_id
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding payment: {e}")
        return jsonify({"message": "Error adding payment", "error": str(e)}), 500

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
        
        # Log the payment deletion before deleting
        ActivityLogger.log_payment_action(
            action="delete",
            payment_id=payment_id,
            apartment_id=apartment_id,
            details={
                "month": payment.month,
                "year": payment.year,
                "amount": sum(float(t.get("amountPaid", 0)) for t in json.loads(payment.tenants)) if payment.tenants else 0
            }
        )

        db.session.delete(payment)
        db.session.commit()

        return jsonify({"message": "Payment deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting payment: {e}")
        return jsonify({"message": "Error deleting payment", "error": str(e)}), 500

# ============ ENHANCED PAYMENT HISTORY (replaces existing) ============

@payments_bp.route("/payment-history/<int:apartment_id>", methods=["GET"])
@token_required
def get_payment_history(apartment_id):
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        year_filter = request.args.get('year', type=int)
        
        query = Payment.query.filter_by(apartment_id=apartment_id)
        if year_filter:
            query = query.filter_by(year=year_filter)
        
        payments = query.all()
        history = []

        for payment in payments:
            if not payment.paymentDate or payment.status == "not_applicable":
                continue

            # Handle both old and new payment formats
            if hasattr(payment, 'amount') and payment.amount:
                # New individual payment format
                amount_paid = float(payment.amount)
                tenant_name = payment.tenant_name or ''
            else:
                # Old batch payment format
                tenants_data = json.loads(payment.tenants) if payment.tenants else []
                amount_paid = sum(float(tenant.get("amountPaid", 0)) for tenant in tenants_data)
                tenant_name = tenants_data[0].get("name", "") if tenants_data else ""

            entry = {
                "id": payment.id,
                "month": payment.month,
                "year": payment.year,
                "status": payment.status,
                "amountPaid": amount_paid,
                "paymentDate": payment.paymentDate.isoformat() if payment.paymentDate else None,
                "paymentMethod": getattr(payment, "paymentMethod", "bank_transfer"),
                "paymentType": getattr(payment, "payment_type", "rent"),
                "tenant_name": tenant_name,
                "notes": getattr(payment, "notes", ""),
                "isIndividual": bool(hasattr(payment, 'amount') and payment.amount)
            }
            history.append(entry)

        history.sort(key=lambda x: x["paymentDate"] if x["paymentDate"] else "", reverse=True)
        return jsonify(history), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving payment history: {e}")
        return jsonify({"message": "Error retrieving payment history", "error": str(e)}), 500

# ============ KEEP EXISTING ENDPOINTS FOR BACKWARD COMPATIBILITY ============

@payments_bp.route("/payments/<int:apartment_id>", methods=["GET"])
@token_required
def get_payments(apartment_id):
    """
    Returns payment details for the given apartment.
    Supports year parameter for historical data.
    Aligns with apartment contract dates.
    KEPT FOR BACKWARD COMPATIBILITY
    """
    try:
        year = request.args.get('year', datetime.utcnow().year, type=int)
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        move_in_date = apartment.moveInDate
        contract_end_date = apartment.contractEndDate
        active_months = get_active_months(move_in_date, contract_end_date, year)
        
        # Get only rent payments for the monthly view
        payments_records = Payment.query.filter(
            Payment.apartment_id == apartment_id,
            Payment.year == year,
            ~Payment.month.like('deposit_%'),
            ~Payment.month.like('extra_%')
        ).all()
        
        payments_by_month = {payment.month: payment for payment in payments_records}
        month_list = [
            "January", "February", "March", "April", "May", "June", 
            "July", "August", "September", "October", "November", "December"
        ]
        available_years = get_available_payment_years(apartment_id)
        response_data = {}
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
            is_active = month in active_months
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
                    "paymentDate": payment.paymentDate.isoformat() if hasattr(payment, "paymentDate") and payment.paymentDate else None,
                    "paymentMethod": getattr(payment, "paymentMethod", "bank_transfer"),
                    "notes": getattr(payment, "notes", ""),
                    "isActive": is_active
                }
            else:
                status = "not_paid" if is_active else "not_applicable"
                tenant_defaults = []
                if is_active and apartment_tenants:
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
                    "status": status,
                    "tenants": tenant_defaults,
                    "extraPayments": {
                        "internet": 0,
                        "electricity": 0,
                        "other": 0
                    },
                    "internet": 0,
                    "electricity": 0,
                    "other": 0,
                    "year": year,
                    "paymentDate": None,
                    "paymentMethod": "bank_transfer",
                    "notes": "",
                    "isActive": is_active
                }
        
        metadata = {
            "apartment_id": apartment_id,
            "year": year,
            "move_in_date": apartment.moveInDate.isoformat() if apartment.moveInDate else None,
            "contract_end_date": apartment.contractEndDate.isoformat() if apartment.contractEndDate else None,
            "available_years": available_years,
            "active_months": active_months
        }
        
        # Log payment data retrieval
        ActivityLogger.log_activity(
            action="view",
            entity_type="payment",
            entity_id=None,
            details={
                "apartment_id": apartment_id,
                "year": year
            }
        )
        
        return jsonify({
            "payments": response_data,
            "metadata": metadata
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error getting payments: {e}")
        return jsonify({"message": "Error getting payments", "error": str(e)}), 500

# ============ KEEP OTHER EXISTING FUNCTIONS ============

@payments_bp.route("/payments/<int:apartment_id>", methods=["POST"])
@token_required
def update_payments(apartment_id):
    """
    LEGACY ENDPOINT - Updates existing records or creates new ones as needed.
    Kept for backward compatibility with the old monthly payment system.
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
            
        active_months = get_active_months(apartment.moveInDate, apartment.contractEndDate, selected_year)
        current_app.logger.info(f"Updating payments for apartment {apartment_id}, year {selected_year}, data: {data}")
        
        # Track changes for logging
        updated_payments = []
        created_payments = []
        
        for month in month_list:
            month_data = data.get("payments", {}).get(month)
            if not month_data:
                continue
                
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
                    payment_date = datetime.fromisoformat(
                        payment_date_str.replace("Z", "+00:00")
                    )
                except ValueError:
                    try:
                        payment_date = datetime.strptime(
                            payment_date_str, "%Y-%m-%d"
                        )
                    except ValueError:
                        payment_date = datetime.utcnow()
            
            payment = Payment.query.filter_by(
                apartment_id=apartment_id, 
                month=month,
                year=selected_year
            ).first()

            if payment:
                # Track original status for logging changes
                original_status = payment.status
                original_amount_paid = sum(float(t.get("amountPaid", 0)) for t in json.loads(payment.tenants)) if payment.tenants else 0
                
                payment.status = status
                payment.tenants = tenants_json
                payment.internet = internet
                payment.electricity = electricity
                payment.other = other
                payment.extraPayments = extra_payments_json
                payment.year = selected_year
                if (
                    status == "paid" and payment.status != "paid"
                ) or payment_date_str:
                    payment.paymentDate = payment_date or datetime.utcnow()
                payment.paymentMethod = payment_method
                payment.notes = notes
                payment.updated_at = datetime.utcnow()
                current_app.logger.info(f"Updated payment for {month} {selected_year}: {payment.status}")
                
                # Calculate new amount paid
                new_amount_paid = sum(float(tenant.get("amountPaid", 0)) for tenant in tenants)
                
                # Track changes in a structured way for logging
                updated_payments.append({
                    "id": payment.id,
                    "month": month,
                    "year": selected_year,
                    "old_status": original_status,
                    "new_status": status,
                    "old_amount_paid": original_amount_paid,
                    "new_amount_paid": new_amount_paid,
                    "status_changed": original_status != status,
                    "amount_changed": original_amount_paid != new_amount_paid
                })
            else:
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
                    paymentDate=payment_date
                    if payment_date
                    else (
                        datetime.utcnow()
                        if status == "paid"
                        else None
                    ),
                    paymentMethod=payment_method,
                    notes=notes,
                    updated_at=datetime.utcnow()
                )
                db.session.add(new_payment)
                db.session.flush()  # Get the ID
                current_app.logger.info(f"Created new payment for {month} {selected_year}: {new_payment.status}")
                
                # Track created payments for logging
                created_payments.append({
                    "id": new_payment.id,
                    "month": month,
                    "year": selected_year,
                    "status": status,
                    "amount_paid": sum(float(tenant.get("amountPaid", 0)) for tenant in tenants)
                })

        db.session.commit()
        current_app.logger.info(f"Payments for {selected_year} committed successfully")
        
        # Log the batch payment update
        ActivityLogger.log_payment_action(
            action="update_batch",
            payment_id=None,
            apartment_id=apartment_id,
            details={
                "year": selected_year,
                "updated_payments": updated_payments,
                "created_payments": created_payments,
                "total_updated": len(updated_payments),
                "total_created": len(created_payments)
            }
        )
        
        return jsonify({"message": f"Payments for {selected_year} updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating payments: {e}")
        
        # Log failure
        ActivityLogger.log_payment_action(
            action="update_batch",
            payment_id=None,
            apartment_id=apartment_id,
            details={
                "year": selected_year,
                "error": str(e)
            },
            success=False,
            error=e
        )
        
        return jsonify({"message": "Error updating payments", "error": str(e)}), 500

# ============ UTILITY FUNCTIONS ============

def get_active_months(move_in_date, contract_end_date, year):
    """
    Determine which months in the given year the apartment should have active payments.
    Based on moveInDate and contractEndDate.
    """
    month_list = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ]
    
    if not move_in_date and not contract_end_date:
        return month_list
    
    month_map = {
        1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
        7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December"
    }
    
    active_months = []
    start_month = 1
    if move_in_date and move_in_date.year == year:
        start_month = move_in_date.month
    
    end_month = 12
    if contract_end_date and contract_end_date.year == year:
        end_month = contract_end_date.month
    
    if (move_in_date and year < move_in_date.year) or \
       (contract_end_date and year > contract_end_date.year):
        return []
    
    for month_num in range(start_month, end_month + 1):
        active_months.append(month_map[month_num])
    
    return active_months

def get_available_payment_years(apartment_id):
    """
    Get a list of years that should have payment records for this apartment.
    Includes years with existing records and years based on contract dates.
    """
    existing_years = db.session.query(Payment.year).filter_by(
        apartment_id=apartment_id
    ).distinct().all()
    years = [year[0] for year in existing_years]
    
    apartment = Apartment.query.get(apartment_id)
    if apartment:
        if apartment.moveInDate and apartment.contractEndDate:
            start_year = apartment.moveInDate.year
            end_year = apartment.contractEndDate.year
            for year in range(start_year, end_year + 1):
                if year not in years:
                    years.append(year)
        elif apartment.moveInDate:
            start_year = apartment.moveInDate.year
            current_year = datetime.utcnow().year
            for year in range(start_year, current_year + 1):
                if year not in years:
                    years.append(year)
        elif apartment.contractEndDate:
            if apartment.contractEndDate.year not in years:
                years.append(apartment.contractEndDate.year)
    
    if not years:
        years.append(datetime.utcnow().year)
    
    years.sort(reverse=True)
    
    return years

# ============ OTHER EXISTING ENDPOINTS ============

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
        return jsonify({"message": "Error getting apartment details", "error": str(e)}), 500

@payments_bp.route("/payments/<int:apartment_id>/years", methods=["GET"])
@token_required
def get_payment_years(apartment_id):
    """
    Returns available years for apartment payments based on:
    1. Existing payment records 
    2. Contract dates
    3. Current year
    """
    try:
        years = get_available_payment_years(apartment_id)
        return jsonify({"years": years}), 200
    except Exception as e:
        current_app.logger.error(f"Error getting payment years: {e}")
        return jsonify({"message": "Error getting payment years", "error": str(e)}), 500



@payments_bp.route("/payments/<int:apartment_id>/month/<month>/<int:year>", methods=["GET"])
@token_required
def get_monthly_payments(apartment_id, month, year):
    """
    Get all payments for a specific apartment, month, and year.
    Shows individual payments by different tenants.
    """
    try:
        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get all payments for this month
        payments = Payment.query.filter_by(
            apartment_id=apartment_id,
            month=month,
            year=year
        ).order_by(Payment.paymentDate.desc(), Payment.created_at.desc()).all()

        # Calculate summary
        total_paid = sum(float(payment.amount or 0) for payment in payments)
        tenant_payments = {}
        
        for payment in payments:
            tenant = payment.tenant_name
            if tenant not in tenant_payments:
                tenant_payments[tenant] = {
                    "tenant_name": tenant,
                    "total_paid": 0,
                    "payments": []
                }
            
            tenant_payments[tenant]["total_paid"] += float(payment.amount or 0)
            tenant_payments[tenant]["payments"].append(payment.to_dict())

        # Get expected rent (you might want to calculate this based on contract)
        expected_rent = float(apartment.rent) if apartment.rent else 0
        remaining_amount = max(0, expected_rent - total_paid)

        response_data = {
            "apartment_id": apartment_id,
            "month": month,
            "year": year,
            "expected_rent": expected_rent,
            "total_paid": total_paid,
            "remaining_amount": remaining_amount,
            "is_fully_paid": remaining_amount == 0,
            "payment_count": len(payments),
            "tenant_payments": list(tenant_payments.values()),
            "all_payments": [payment.to_dict() for payment in payments]
        }

        return jsonify(response_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting monthly payments: {e}")
        return jsonify({"message": "Error getting monthly payments", "error": str(e)}), 500

@payments_bp.route("/payments/<int:apartment_id>/summary", methods=["GET"])
@token_required
def get_payment_summary(apartment_id):
    """
    Get a summary of payments by month, showing total paid vs expected.
    """
    try:
        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        year = request.args.get('year', datetime.utcnow().year, type=int)
        
        # Get all payments for this year
        payments = Payment.query.filter_by(
            apartment_id=apartment_id,
            year=year
        ).all()

        # Group by month
        monthly_summary = {}
        months = ["January", "February", "March", "April", "May", "June",
                 "July", "August", "September", "October", "November", "December"]

        for month in months:
            month_payments = [p for p in payments if p.month == month]
            total_paid = sum(float(p.amount or 0) for p in month_payments)
            expected_rent = float(apartment.rent) if apartment.rent else 0
            
            monthly_summary[month] = {
                "month": month,
                "year": year,
                "expected_rent": expected_rent,
                "total_paid": total_paid,
                "remaining_amount": max(0, expected_rent - total_paid),
                "is_fully_paid": total_paid >= expected_rent,
                "payment_count": len(month_payments),
                "tenants_paid": list(set(p.tenant_name for p in month_payments if p.tenant_name))
            }

        return jsonify({
            "apartment_id": apartment_id,
            "year": year,
            "monthly_summary": monthly_summary
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting payment summary: {e}")
        return jsonify({"message": "Error getting payment summary", "error": str(e)}), 500



