# routes/apartments.py
import pandas as pd
from io import BytesIO
from datetime import datetime
from flask import Blueprint, request, jsonify, g, current_app, send_file, Response
from auth import token_required, role_required
from models import Apartment, Tenant, db
from typing import Tuple, List
from schemas import ApartmentData, TenantData

apartments_bp = Blueprint("apartments_bp", __name__)


@apartments_bp.route("/add", methods=["POST"])
@token_required
@role_required("admin")
def add_apartment_route(
    new_apartment: ApartmentData, new_tenants: List[TenantData]
) -> Tuple[Response, int]:
    try:
        db.session.add(Apartment(new_apartment.model_dump()))
        for tenants in new_tenants:
            db.session.add(Tenant(tenants.model_dump()))
        db.session.commit()
        return jsonify({"message": "Apartment added successfully"}), 201

    except Exception as e:
        current_app.logger.error(f"Error adding apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error adding apartment", "error": str(e)}), 500


@apartments_bp.route("/edit/<int:apartment_id>", methods=["PUT"])
@token_required
@role_required("admin")
def edit_apartment(apartment_id: int) -> Tuple[Response, int]:
    data = request.json
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        apartment.address = data.get("address", apartment.address)
        apartment.rooms = data.get("rooms", apartment.rooms)
        apartment.size = data.get("size", apartment.size)
        apartment.tenants = data.get("tenants", apartment.tenants)
        apartment.tenantEmail = data.get("tenantEmail", apartment.tenantEmail)
        apartment.tenantPhone = data.get("tenantPhone", apartment.tenantPhone)
        apartment.landlordName = data.get("landlordName", apartment.landlordName)
        apartment.landlordEmail = data.get("landlordEmail", apartment.landlordEmail)
        apartment.landlordPhone = data.get("landlordPhone", apartment.landlordPhone)

        if data.get("moveInDate"):
            apartment.moveInDate = datetime.strptime(
                data["moveInDate"], "%Y-%m-%d"
            ).date()
        if data.get("contractEndDate"):
            apartment.contractEndDate = datetime.strptime(
                data["contractEndDate"], "%Y-%m-%d"
            ).date()

        apartment.rent = data.get("rent", apartment.rent)
        apartment.deposit = data.get("deposit", apartment.deposit)
        apartment.notes = data.get("notes", apartment.notes)
        apartment.IBAN = data.get("IBAN", apartment.IBAN)
        apartment.status = data.get("status", apartment.status)
        apartment.management_fee = (
            data.get("managementFee", apartment.management_fee) or 0
        )
        apartment.rent_cost = data.get("rentCost", apartment.rent_cost) or 0

        db.session.commit()
        return jsonify({"message": "Apartment updated successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error editing apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error editing apartment", "error": str(e)}), 500


@apartments_bp.route("/list", methods=["GET"])
@token_required
def list_apartments() -> Tuple[Response, int]:
    try:
        apartments = Apartment.query.all()
        apartments_data = [apt.to_dict() for apt in apartments]

        # For non-admin users, remove sensitive fields
        role = g.user.get("role", "limited")
        if role != "admin":
            for apt in apartments_data:
                apt.pop("tenantEmail", None)
                apt.pop("tenantPhone", None)
                apt.pop("landlordEmail", None)
                apt.pop("landlordPhone", None)
                apt.pop("IBAN", None)
                apt.pop("notes", None)
                apt.pop("management_fee", None)
                apt.pop("rent_cost", None)

        return jsonify(apartments_data), 200

    except Exception as e:
        current_app.logger.error(f"Error listing apartments: {e}")
        return jsonify({"message": "Error listing apartments", "error": str(e)}), 500


@apartments_bp.route("/export", methods=["GET"])
@token_required
@role_required("admin")
def export_excel() -> Tuple[Response, int]:
    try:
        apartments = Apartment.query.all()
        apartments_data = [apt.to_dict() for apt in apartments]
        df = pd.DataFrame(apartments_data)
        output = BytesIO()
        writer = pd.ExcelWriter(output, engine="xlsxwriter")
        df.to_excel(writer, index=False, sheet_name="Apartments")
        writer.close()
        output.seek(0)
        return send_file(output, download_name="apartments.xlsx", as_attachment=True)
    except Exception as e:
        current_app.logger.error(f"Error exporting apartments: {e}")
        return jsonify({"message": "Error exporting apartments", "error": str(e)}), 500


@apartments_bp.route("/delete/<int:apartment_id>", methods=["DELETE"])
@token_required
@role_required("admin")
def delete_apartment(apartment_id: int) -> Tuple[Response, int]:
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        db.session.delete(apartment)
        db.session.commit()
        return jsonify({"message": "Apartment deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error deleting apartment", "error": str(e)}), 500
