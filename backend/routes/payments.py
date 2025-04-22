# routes/payments.py
import json
from flask import Blueprint, request, jsonify, current_app
from .auth import token_required
from extentions import db
from models.models import Apartment, Payment, Tenant
from datetime import datetime, timedelta
from sqlalchemy import and_, func

payments_bp = Blueprint("payments_bp", __name__)


@payments_bp.route("/payments/<int:apartment_id>", methods=["GET"])
@token_required
def get_payments(apartment_id):
    """
    Returns payment details for the given apartment.
    Supports year parameter for historical data.
    Aligns with apartment contract dates.
    """
    try:
        # Get the requested year (default to current year)
        year = request.args.get('year', datetime.utcnow().year, type=int)
        
        # Get apartment details to check contract dates
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get contract dates
        move_in_date = apartment.moveInDate
        contract_end_date = apartment.contractEndDate
        
        # Determine active months based on contract dates
        active_months = get_active_months(move_in_date, contract_end_date, year)
            
        # Get all payment records for this apartment for the specified year
        payments_records = Payment.query.filter(
            Payment.apartment_id == apartment_id,
            Payment.year == year
        ).all()
        
        # Create a mapping: month -> Payment record
        payments_by_month = {payment.month: payment for payment in payments_records}
        
        # Month list
        month_list = [
            "January", "February", "March", "April", "May", "June", 
            "July", "August", "September", "October", "November", "December"
        ]
        
        # Calculate available years
        available_years = get_available_payment_years(apartment_id)
        
        # Build response data
        response_data = {}
        
        # Get apartment tenants to help with setting defaults
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
            
            # Create default entries or use existing ones
            if month in payments_by_month:
                # Format existing payment record
                payment = payments_by_month[month]
                
                # Load tenants JSON if available
                tenants = json.loads(payment.tenants) if payment.tenants else []
                
                # Make sure tenant data has proper structure
                for tenant in tenants:
                    if "amountDue" not in tenant:
                        tenant["amountDue"] = 0
                    if "amountPaid" not in tenant:
                        tenant["amountPaid"] = 0
                
                # Format extra payments
                extraPayments = {
                    "internet": payment.internet if payment.internet is not None else 0,
                    "electricity": payment.electricity if payment.electricity is not None else 0,
                    "other": payment.other if payment.other is not None else 0,
                }
                
                # If not active but has a record, mark as not_applicable
                status = payment.status if is_active else "not_applicable"
                
                response_data[month] = {
                    "id": payment.id,
                    "apartment_id": payment.apartment_id,
                    "month": payment.month,
                    "status": status,
                    "tenants": tenants,
                    "extraPayments": extraPayments,
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
                # Create default entry for month with no payment record
                status = "not_paid" if is_active else "not_applicable"
                
                # Determine appropriate tenant defaults based on if the month is active
                tenant_defaults = []
                if is_active and apartment_tenants:
                    # Calculate default amount due per tenant
                    rent = float(apartment.rent) if apartment.rent else 0
                    amount_per_tenant = rent / len(apartment_tenants) if apartment_tenants else 0
                    
                    # Create a default amount for each tenant
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
                    "isActive": is_active
                }
        
        # Return data with metadata
        metadata = {
            "apartment_id": apartment_id,
            "year": year,
            "move_in_date": apartment.moveInDate.isoformat() if apartment.moveInDate else None,
            "contract_end_date": apartment.contractEndDate.isoformat() if apartment.contractEndDate else None,
            "available_years": available_years,
            "active_months": active_months
        }
        
        return jsonify({
            "payments": response_data,
            "metadata": metadata
        }), 200
    
    except Exception as e:
        current_app.logger.error(f"Error getting payments: {e}")
        return jsonify({"message": "Error getting payments", "error": str(e)}), 500


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


@payments_bp.route("/payments/<int:apartment_id>", methods=["POST"])
@token_required
def update_payments(apartment_id):
    """
    Expects a JSON object with payment data for a specific year.
    Updates existing records or creates new ones as needed.
    Includes support for multiyear contracts and checking active months.
    
    Expected format:
    {
        "payments": {
            "January": { ... },
            "February": { ... },
            ...
        },
        "year": 2025
    }
    """
    data = request.json
    month_list = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ]
    
    # Get the year from the request, default to current year
    selected_year = data.get("year", datetime.utcnow().year)
    
    try:
        # Get apartment to check contract dates
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404
            
        # Get active months based on contract dates
        active_months = get_active_months(apartment.moveInDate, apartment.contractEndDate, selected_year)
        
        # Process payment data for each month
        for month in month_list:
            month_data = data.get("payments", {}).get(month)
            if month_data:
                # Skip months marked as not active if they're also not in our active_months list
                if month_data.get("isActive") is False and month not in active_months:
                    continue
                    
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
                
                # Find or create payment record
                payment = Payment.query.filter_by(
                    apartment_id=apartment_id, 
                    month=month,
                    year=selected_year
                ).first()

                if payment:
                    # Update existing payment record
                    payment.status = month_data.get("status", "not_paid")
                    payment.tenants = tenants_json
                    payment.internet = internet
                    payment.electricity = electricity
                    payment.other = other
                    payment.extraPayments = extra_payments_json
                    payment.year = selected_year

                    # Only update payment date if status changed to paid or if explicitly provided
                    if (
                        month_data.get("status") == "paid" and payment.status != "paid"
                    ) or payment_date_str:
                        payment.paymentDate = payment_date or datetime.utcnow()

                    payment.paymentMethod = payment_method
                    payment.notes = notes
                    payment.updated_at = datetime.utcnow()
                else:
                    # Create new payment record
                    new_payment = Payment(
                        apartment_id=apartment_id,
                        month=month,
                        year=selected_year,
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
                        updated_at=datetime.utcnow()
                    )
                    db.session.add(new_payment)

        db.session.commit()
        return jsonify({"message": f"Payments for {selected_year} updated successfully"}), 200
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
        return jsonify({"message": "Error getting apartment details", "error": str(e)}), 500


@payments_bp.route("/payment-history/<int:apartment_id>", methods=["GET"])
@token_required
def get_payment_history(apartment_id):
    """
    Get payment history for an apartment with optional year filter.
    """
    try:
        # Get optional year filter from query params
        year_filter = request.args.get('year', type=int)
        
        # Query base - filter by apartment ID
        query = Payment.query.filter_by(apartment_id=apartment_id)
        
        # Add year filter if provided
        if year_filter:
            query = query.filter_by(year=year_filter)
            
        # Get all payments matching filters
        payments = query.all()
        
        history = []
        for payment in payments:
            # Skip if no payment date (likely not processed yet)
            if not hasattr(payment, "paymentDate") or not payment.paymentDate:
                continue
                
            # Skip if status is not_applicable (outside contract period)
            if payment.status == "not_applicable":
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
                    # Assume extra payments are always paid in full when recorded
                    amount_paid += sum(float(value) for value in extra_payments.values())
                except:
                    # Handle case where extraPayments might not be valid JSON
                    pass

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


@payments_bp.route("/payment-history-years/<int:apartment_id>", methods=["GET"])
@token_required
def get_payment_history_years(apartment_id):
    """
    Get all years that have payment history records.
    Useful for filtering payment history by year.
    """
    try:
        # Query distinct years from payment records
        years = db.session.query(func.distinct(Payment.year)).filter_by(
            apartment_id=apartment_id
        ).all()
        
        # Format results and ensure current year is included
        year_list = [year[0] for year in years]
        current_year = datetime.utcnow().year
        if current_year not in year_list:
            year_list.append(current_year)
            
        # Sort years in descending order
        year_list.sort(reverse=True)
        
        return jsonify({"years": year_list}), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching payment history years: {e}")
        return jsonify({"message": "Error fetching payment history years", "error": str(e)}), 500


@payments_bp.route("/payment-receipt/<int:payment_id>", methods=["GET"])
@token_required
def get_payment_receipt(payment_id):
    """
    Generate a receipt for a specific payment.
    """
    try:
        payment = Payment.query.get(payment_id)
        if not payment:
            return jsonify({"message": "Payment not found"}), 404

        # Get apartment details
        apartment = Apartment.query.get(payment.apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404
            
        # Get tenant details
        tenants_data = json.loads(payment.tenants) if payment.tenants else []
        
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
        else:
            extra_payments = {
                "internet": payment.internet or 0,
                "electricity": payment.electricity or 0,
                "other": payment.other or 0
            }
        
        # Calculate totals
        total_due = sum(float(tenant.get("amountDue", 0)) for tenant in tenants_data)
        total_paid = sum(float(tenant.get("amountPaid", 0)) for tenant in tenants_data)
        total_due += sum(float(value) for value in extra_payments.values())
        total_paid += sum(float(value) for value in extra_payments.values() if payment.status == "paid")
        
        # Generate receipt number using payment ID, apartment ID and timestamp
        receipt_number = f"RCP-{payment.apartment_id}-{payment.id}-{int(datetime.utcnow().timestamp())}"
        
        receipt_data = {
            "receiptNumber": receipt_number,
            "apartment": {
                "id": apartment.id,
                "address": apartment.address
            },
            "payment": {
                "id": payment.id,
                "month": payment.month,
                "year": payment.year,
                "status": payment.status,
                "paymentDate": payment.paymentDate.isoformat() if payment.paymentDate else None,
                "paymentMethod": payment.paymentMethod if hasattr(payment, "paymentMethod") else "bank_transfer"
            },
            "tenants": tenants_data,
            "extraPayments": extra_payments,
            "totals": {
                "totalDue": total_due,
                "totalPaid": total_paid,
                "balance": total_due - total_paid
            },
            "notes": payment.notes if hasattr(payment, "notes") else "",
            "issuedAt": datetime.utcnow().isoformat()
        }

        return jsonify(receipt_data), 200
    except Exception as e:
        current_app.logger.error(f"Error generating receipt: {e}")
        return jsonify({"message": "Error generating receipt", "error": str(e)}), 500


@payments_bp.route("/payment-summary/<int:apartment_id>", methods=["GET"])
@token_required
def get_payment_summary(apartment_id):
    """
    Get summary of payment status for all years.
    Useful for dashboard displays.
    """
    try:
        # Get apartment details
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404
            
        # Get all payment records for this apartment
        payments = Payment.query.filter_by(apartment_id=apartment_id).all()
        
        # Group payments by year
        years_data = {}
        for payment in payments:
            year = payment.year
            if year not in years_data:
                years_data[year] = {
                    "total": 0,
                    "paid": 0,
                    "partial": 0,
                    "not_paid": 0,
                    "not_applicable": 0
                }
                
            # Count by status
            years_data[year]["total"] += 1
            if payment.status in years_data[year]:
                years_data[year][payment.status] += 1
        
        # Format for response
        summary = []
        for year, data in sorted(years_data.items(), reverse=True):
            active_months = data["total"] - data["not_applicable"]
            completion_percentage = 0
            if active_months > 0:
                completion_percentage = int((data["paid"] / active_months) * 100)
                
            summary.append({
                "year": year,
                "totalMonths": data["total"],
                "activeMonths": active_months,
                "paid": data["paid"],
                "partial": data["partial"],
                "not_paid": data["not_paid"],
                "not_applicable": data["not_applicable"],
                "completionPercentage": completion_percentage
            })
            
        return jsonify(summary), 200
    except Exception as e:
        current_app.logger.error(f"Error generating payment summary: {e}")
        return jsonify({"message": "Error generating payment summary", "error": str(e)}), 500


def get_active_months(move_in_date, contract_end_date, year):
    """
    Determine which months in the given year the apartment should have active payments.
    Based on moveInDate and contractEndDate.
    """
    # Default: all months are active if no dates are specified
    month_list = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ]
    
    if not move_in_date and not contract_end_date:
        return month_list
    
    # Month mapping
    month_map = {
        1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
        7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December"
    }
    
    active_months = []
    
    # Determine start month (either January or the move-in month if in this year)
    start_month = 1
    if move_in_date and move_in_date.year == year:
        start_month = move_in_date.month
    
    # Determine end month (either December or the contract end month if in this year)
    end_month = 12
    if contract_end_date and contract_end_date.year == year:
        end_month = contract_end_date.month
    
    # If this year is outside the contract period, return no active months
    if (move_in_date and year < move_in_date.year) or \
       (contract_end_date and year > contract_end_date.year):
        return []
    
    # Add all months between start and end
    for month_num in range(start_month, end_month + 1):
        active_months.append(month_map[month_num])
    
    return active_months


def get_available_payment_years(apartment_id):
    """
    Get a list of years that should have payment records for this apartment.
    Includes years with existing records and years based on contract dates.
    """
    # Get years from existing payment records
    existing_years = db.session.query(Payment.year).filter_by(
        apartment_id=apartment_id
    ).distinct().all()
    years = [year[0] for year in existing_years]
    
    # Get apartment contract dates
    apartment = Apartment.query.get(apartment_id)
    if apartment:
        # If we have contract dates, include all years between move-in and contract end
        if apartment.moveInDate and apartment.contractEndDate:
            start_year = apartment.moveInDate.year
            end_year = apartment.contractEndDate.year
            for year in range(start_year, end_year + 1):
                if year not in years:
                    years.append(year)
        # If we only have move-in date, include all years from move-in to current
        elif apartment.moveInDate:
            start_year = apartment.moveInDate.year
            current_year = datetime.utcnow().year
            for year in range(start_year, current_year + 1):
                if year not in years:
                    years.append(year)
        # If we only have contract end date, include current year
        elif apartment.contractEndDate:
            if apartment.contractEndDate.year not in years:
                years.append(apartment.contractEndDate.year)
    
    # If no years found (new apartment without dates), add current year
    if not years:
        years.append(datetime.utcnow().year)
    
    # Sort years in descending order (most recent first)
    years.sort(reverse=True)
    
    return years


def initialize_payment_records(apartment_id, year=None):
    """
    Initialize monthly payment records for a specific year.
    Useful when setting up a new apartment or preparing for a new year.
    """
    month_list = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ]
    
    if year is None:
        year = datetime.utcnow().year
        
    # Get apartment to check contract dates
    apartment = Apartment.query.get(apartment_id)
    if not apartment:
        return False
        
    # Get active months based on contract dates
    active_months = get_active_months(apartment.moveInDate, apartment.contractEndDate, year)
    
    # Get apartment tenants to help with setting defaults
    apartment_tenants = []
    tenant_json = []
    
    if apartment.tenants:
        for tenant in apartment.tenants:
            apartment_tenants.append({
                "id": tenant.id,
                "name": tenant.name
            })
            
            # Calculate default tenant rent
            rent = float(apartment.rent) if apartment.rent else 0
            amount_per_tenant = round(rent / len(apartment.tenants), 2) if apartment.tenants else 0
            
            tenant_json.append({
                "id": tenant.id,
                "name": tenant.name,
                "amountDue": amount_per_tenant,
                "amountPaid": 0,
                "paid": False
            })
            
    # Encode as JSON
    tenants_json = json.dumps(tenant_json) if tenant_json else "[]"
    
    # Create records for each month
    created_count = 0
    for month in month_list:
        # Check if a record already exists
        existing_payment = Payment.query.filter_by(
            apartment_id=apartment_id, 
            month=month,
            year=year
        ).first()
        
        if not existing_payment:
            # Determine if this month is active based on contract dates
            is_active = month in active_months
            status = "not_paid" if is_active else "not_applicable"
            
            # Create payment record
            payment = Payment(
                apartment_id=apartment_id,
                month=month,
                year=year,
                status=status,
                tenants=tenants_json if is_active else "[]",
                internet=0.0,
                electricity=0.0,
                other=0.0,
                extraPayments="{}",
                updated_at=datetime.utcnow()
            )
            
            db.session.add(payment)
            created_count += 1
    
    if created_count > 0:
        db.session.commit()
        
    return created_count
