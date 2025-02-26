# routes/apartments.py
import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, g, current_app, send_file
from auth import token_required, role_required
from db import get_db_connection

apartments_bp = Blueprint("apartments_bp", __name__)

@apartments_bp.route("/add", methods=["POST"])
@token_required
@role_required("admin")
def add_apartment():
    data = request.json
    if not data.get("address"):
        return jsonify({"message": "Address is required"}), 400
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
        INSERT INTO apartments 
        (address, rooms, size, tenants, tenantEmail, tenantPhone, landlordName, landlordEmail, landlordPhone,
         moveInDate, contractEndDate, rent, deposit, notes, IBAN, status, management_fee, rent_cost)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            data.get("address"),
            data.get("rooms"),
            data.get("size"),
            data.get("tenants"),
            data.get("tenantEmail"),
            data.get("tenantPhone"),
            data.get("landlordName"),
            data.get("landlordEmail"),
            data.get("landlordPhone"),
            data.get("moveInDate") if data.get("moveInDate") else None,
            data.get("contractEndDate") if data.get("contractEndDate") else None,
            data.get("rent"),
            data.get("deposit"),
            data.get("notes"),
            data.get("IBAN"),
            data.get("status"),
            data.get("managementFee") or 0,
            data.get("rentCost") or 0,
        )
        cursor.execute(query, values)
        conn.commit()
        return jsonify({"message": "Apartment added successfully"}), 201
    except Exception as e:
        current_app.logger.error(f"Error adding apartment: {e}")
        return jsonify({"message": "Error adding apartment", "error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

@apartments_bp.route("/edit/<int:apartment_id>", methods=["PUT"])
@token_required
@role_required("admin")
def edit_apartment(apartment_id):
    data = request.json
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
        UPDATE apartments 
        SET address=%s, rooms=%s, size=%s, tenants=%s, tenantEmail=%s, tenantPhone=%s,
            landlordName=%s, landlordEmail=%s, landlordPhone=%s, moveInDate=%s, contractEndDate=%s,
            rent=%s, deposit=%s, notes=%s, IBAN=%s, status=%s, model=%s, management_fee=%s, rent_cost=%s
        WHERE id=%s
        """
        values = (
            data.get("address"),
            data.get("rooms"),
            data.get("size"),
            data.get("tenants"),
            data.get("tenantEmail"),
            data.get("tenantPhone"),
            data.get("landlordName"),
            data.get("landlordEmail"),
            data.get("landlordPhone"),
            data.get("moveInDate") if data.get("moveInDate") else None,
            data.get("contractEndDate") if data.get("contractEndDate") else None,
            data.get("rent"),
            data.get("deposit"),
            data.get("notes"),
            data.get("IBAN"),
            data.get("status"),
            data.get("model") or "management",
            data.get("managementFee") or 0,
            data.get("rentCost") or 0,
            apartment_id,
        )
        cursor.execute(query, values)
        conn.commit()
        return jsonify({"message": "Apartment updated successfully"}), 200
    except Exception as e:
        current_app.logger.error(f"Error editing apartment: {e}")
        return jsonify({"message": "Error editing apartment", "error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

@apartments_bp.route("/list", methods=["GET"])
@token_required
def list_apartments():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM apartments")
        apartments = cursor.fetchall()

        # For non-admin users, remove sensitive fields
        role = g.user.get("role", "limited")
        if role != "admin":
            for apt in apartments:
                apt.pop("tenantEmail", None)
                apt.pop("tenantPhone", None)
                apt.pop("landlordEmail", None)
                apt.pop("landlordPhone", None)
                apt.pop("IBAN", None)
                apt.pop("notes", None)
                apt.pop("management_fee", None)
                apt.pop("rent_cost", None)
        return jsonify(apartments), 200
    except Exception as e:
        current_app.logger.error(f"Error listing apartments: {e}")
        return jsonify({"message": "Error listing apartments", "error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

@apartments_bp.route("/export", methods=["GET"])
@token_required
@role_required("admin")
def export_excel():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM apartments")
        data = cursor.fetchall()
        df = pd.DataFrame(data)
        output = BytesIO()
        writer = pd.ExcelWriter(output, engine="xlsxwriter")
        df.to_excel(writer, index=False, sheet_name="Apartments")
        writer.close()
        output.seek(0)
        return send_file(output, download_name="apartments.xlsx", as_attachment=True)
    except Exception as e:
        current_app.logger.error(f"Error exporting apartments: {e}")
        return jsonify({"message": "Error exporting apartments", "error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()
            
@apartments_bp.route("/delete/<int:apartment_id>", methods=["DELETE"])
@token_required
@role_required("admin")
def delete_apartment(apartment_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "DELETE FROM apartments WHERE id = %s"
        cursor.execute(query, (apartment_id,))
        conn.commit()
        return jsonify({"message": "Apartment deleted successfully"}), 200
    except Exception as e:
        current_app.logger.error(f"Error deleting apartment: {e}")
        return jsonify({"message": "Error deleting apartment", "error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

