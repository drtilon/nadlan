# routes/payments.py
import json
from flask import Blueprint, request, jsonify, current_app
from auth import token_required
from db import get_db_connection

payments_bp = Blueprint("payments_bp", __name__)

@payments_bp.route("/payments/<int:apartment_id>", methods=["GET"])
@token_required
def get_payments(apartment_id):
    month_list = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM payments WHERE apartment_id = %s", (apartment_id,))
        rows = cursor.fetchall()
        payments = {}
        for month in month_list:
            payment = next((row for row in rows if row['month'] == month), None)
            if payment:
                if isinstance(payment.get("tenants"), str):
                    payment["tenants"] = json.loads(payment["tenants"])
                
                # Convert tenant payment data if using old format
                if payment["tenants"] and all(isinstance(t, dict) and "amountDue" not in t for t in payment["tenants"]):
                    for tenant in payment["tenants"]:
                        tenant["amountDue"] = 0
                        tenant["amountPaid"] = 0
                
                # Structure extraPayments from flat fields
                payment["extraPayments"] = {
                    "internet": payment.get("internet", 0),
                    "electricity": payment.get("electricity", 0),
                    "other": payment.get("other", 0)
                }
                
                payments[month] = payment
            else:
                payments[month] = {
                    "status": "not_paid",
                    "tenants": [],
                    "extraPayments": {
                        "internet": 0,
                        "electricity": 0,
                        "other": 0
                    }
                }
        return jsonify(payments), 200
    except Exception as e:
        current_app.logger.error(f"Error getting payments: {e}")
        return jsonify({"message": "Error getting payments", "error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

@payments_bp.route("/payments/<int:apartment_id>", methods=["POST"])
@token_required
def update_payments(apartment_id):
    data = request.json  # Expected JSON with month keys
    month_list = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        for month in month_list:
            month_data = data.get(month)
            if month_data:
                # Extract extra payments from nested structure
                internet = month_data.get("extraPayments", {}).get("internet", 0)
                electricity = month_data.get("extraPayments", {}).get("electricity", 0)
                other = month_data.get("extraPayments", {}).get("other", 0)
                
                # Fall back to flat structure if nested isn't available
                if internet == 0 and "internet" in month_data:
                    internet = month_data["internet"]
                if electricity == 0 and "electricity" in month_data:
                    electricity = month_data["electricity"]
                if other == 0 and "other" in month_data:
                    other = month_data["other"]
                
                # Ensure tenant data has the expected structure
                tenants = month_data.get("tenants", [])
                for tenant in tenants:
                    if "amountDue" not in tenant:
                        tenant["amountDue"] = 0
                    if "amountPaid" not in tenant:
                        tenant["amountPaid"] = 0
                
                tenants_json = json.dumps(tenants)
                
                cursor.execute("SELECT id FROM payments WHERE apartment_id=%s AND month=%s", (apartment_id, month))
                result = cursor.fetchone()
                if result:
                    update_query = """
                    UPDATE payments
                    SET status=%s, tenants=%s, internet=%s, electricity=%s, other=%s, updated_at=CURRENT_TIMESTAMP
                    WHERE apartment_id=%s AND month=%s
                    """
                    values = (
                        month_data.get("status", "not_paid"),
                        tenants_json,
                        internet,
                        electricity,
                        other,
                        apartment_id,
                        month
                    )
                    cursor.execute(update_query, values)
                else:
                    insert_query = """
                    INSERT INTO payments (apartment_id, month, status, tenants, internet, electricity, other)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """
                    values = (
                        apartment_id,
                        month,
                        month_data.get("status", "not_paid"),
                        tenants_json,
                        internet,
                        electricity,
                        other
                    )
                    cursor.execute(insert_query, values)
        conn.commit()
        return jsonify({"message": "Payments updated successfully"}), 200
    except Exception as e:
        current_app.logger.error(f"Error updating payments: {e}")
        return jsonify({"message": "Error updating payments", "error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

# Endpoint to get apartment details including rent amount
@payments_bp.route("/apartment/<int:apartment_id>", methods=["GET"])
@token_required
def get_apartment_details(apartment_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM apartments WHERE id = %s", (apartment_id,))
        apartment = cursor.fetchone()
        
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404
            
        return jsonify(apartment), 200
    except Exception as e:
        current_app.logger.error(f"Error getting apartment details: {e}")
        return jsonify({"message": "Error getting apartment details", "error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()
