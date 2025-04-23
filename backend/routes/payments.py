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
        year = request.args.get('year', datetime.utcnow().year, type=int)
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        move_in_date = apartment.moveInDate
        contract_end_date = apartment.contractEndDate
        active_months = get_active_months(move_in_date, contract_end_date, year)
        payments_records = Payment.query.filter(
            Payment.apartment_id == apartment_id,
            Payment.year == year
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
                current_app.logger.info(f"Created new payment for {month} {selected_year}: {new_payment.status}")

        db.session.commit()
        current_app.logger.info(f"Payments for {selected_year} committed successfully")
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

        apartment = Apartment.query.get(payment.apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404
            
        tenants_data = json.loads(payment.tenants) if payment.tenants else []
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
        
        total_due = sum(float(tenant.get("amountDue", 0)) for tenant in tenants_data)
        total_paid = sum(float(tenant.get("amountPaid", 0)) for tenant in tenants_data)
        total_due += sum(float(value) for value in extra_payments.values())
        total_paid += sum(float(value) for value in extra_payments.values() if payment.status == "paid")
        
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
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404
            
        payments = Payment.query.filter_by(apartment_id=apartment_id).all()
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
                
            years_data[year]["total"] += 1
            if payment.status in years_data[year]:
                years_data[year][payment.status] += 1
        
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
        
    apartment = Apartment.query.get(apartment_id)
    if not apartment:
        return False
        
    active_months = get_active_months(apartment.moveInDate, apartment.contractEndDate, year)
    apartment_tenants = []
    tenant_json = []
    
    if apartment.tenants:
        for tenant in apartment.tenants:
            apartment_tenants.append({
                "id": tenant.id,
                "name": tenant.name
            })
            rent = float(apartment.rent) if apartment.rent else 0
            amount_per_tenant = round(rent / len(apartment.tenants), 2) if apartment.tenants else 0
            tenant_json.append({
                "id": tenant.id,
                "name": tenant.name,
                "amountDue": amount_per_tenant,
                "amountPaid": 0,
                "paid": False
            })
            
    tenants_json = json.dumps(tenant_json) if tenant_json else "[]"
    
    created_count = 0
    for month in month_list:
        existing_payment = Payment.query.filter_by(
            apartment_id=apartment_id, 
            month=month,
            year=year
        ).first()
        
        if not existing_payment:
            is_active = month in active_months
            status = "not_paid" if is_active else "not_applicable"
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
                paymentMethod="bank_transfer",
                notes="",
                updated_at=datetime.utcnow()
            )
            db.session.add(payment)
            created_count += 1
    
    if created_count > 0:
        db.session.commit()
        
    return created_count
