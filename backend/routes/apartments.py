# routes/apartments.py
import pandas as pd
from io import BytesIO
from datetime import datetime
from flask import Blueprint, request, jsonify, g, current_app, send_file, Response
from models.models import Apartment, Tenant
from extentions import db
from typing import Tuple, List
from schemas import ApartmentData, TenantData
from flasgger import swag_from
from pydantic import ValidationError
from .auth import token_required, role_required

apartments_bp = Blueprint("apartments_bp", __name__)


@apartments_bp.route("/add", methods=["POST"])
@token_required
def add_apartment_route() -> Tuple[Response, int]:
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        try:
            new_tenants = [
                TenantData(**tenant) for tenant in data.get("new_tenants", [])
            ]
        except ValidationError as e:
            return jsonify({"message": "Invalid data", "errors": e.errors()}), 400

        apartment = Apartment(**data["new_apartment"])

        db.session.add(apartment)
        db.session.flush()  # Ensure apartment ID is assigned before adding tenants

        tenants = [
            Tenant(**tenant.dict(), apartment_id=apartment.id) for tenant in new_tenants
        ]
        db.session.add_all(tenants)

        db.session.commit()
        return jsonify({"message": "Apartment added successfully"}), 201

    except Exception as e:
        current_app.logger.error(f"Error adding apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error adding apartment", "error": str(e)}), 500


@apartments_bp.route("/edit/<int:apartment_id>", methods=["PUT"])
@token_required
def edit_apartment(apartment_id: int) -> Tuple[Response, int]:
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        # Extract apartment and tenant data
        apartment_data = data.get("new_apartment", {})
        tenants_data = data.get("new_tenants", [])

        if not apartment_data:
            return jsonify({"message": "No apartment data provided"}), 400

        # Remove nested 'landlord' field if present to avoid assigning a dict to the relationship
        apartment_data.pop("landlord", None)

        # Get the apartment
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Update apartment fields
        for field, value in apartment_data.items():
            # Handle date fields separately
            if field == "moveInDate" and value:
                try:
                    apartment.moveInDate = datetime.strptime(value, "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    current_app.logger.error(f"Invalid moveInDate format: {value}")
            elif field == "contractEndDate" and value:
                try:
                    apartment.contractEndDate = datetime.strptime(
                        value, "%Y-%m-%d"
                    ).date()
                except (ValueError, TypeError):
                    current_app.logger.error(f"Invalid contractEndDate format: {value}")
            # Skip tenants field as we'll handle it separately
            elif field != "tenants" and hasattr(apartment, field):
                setattr(apartment, field, value)

        # Unassign all existing tenants from this apartment
        existing_tenants = Tenant.query.filter_by(apartment_id=apartment_id).all()
        for tenant in existing_tenants:
            tenant.apartment_id = None  # Set to NULL instead of deleting the tenant

        # Then assign the selected tenants to this apartment
        for tenant_data in tenants_data:
            tenant_id = tenant_data.get("id")

            # Fixed bug: Handle temporary IDs properly
            if tenant_id and not str(tenant_id).startswith("temp-"):
                # If tenant has an ID, find and update
                tenant = Tenant.query.get(tenant_id)
                if tenant:
                    tenant.apartment_id = apartment_id
            else:
                # This is a new tenant, create it
                # Extract only the valid fields for a Tenant
                new_tenant_data = {
                    "name": tenant_data.get("name", ""),
                    "email": tenant_data.get("email", ""),
                    "phone": tenant_data.get("phone", ""),
                    "bornOn": tenant_data.get("bornOn", ""),
                    "refundIban": tenant_data.get("refundIban", ""),
                    "apartment_id": apartment_id,
                }

                # Create new tenant with apartment_id
                tenant = Tenant(**new_tenant_data)
                db.session.add(tenant)

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
        apartments_data = []

        for apt in apartments:
            apt_dict = apt.to_dict()

            # Get tenants for this apartment
            tenants = Tenant.query.filter_by(apartment_id=apt.id).all()
            tenants_list = [tenant.to_dict() for tenant in tenants]

            # Convert tenants to comma-separated string for backward compatibility
            tenant_names = ", ".join(
                [tenant.get("name", "") for tenant in tenants_list]
            )

            apt_dict["tenants"] = tenant_names if not tenants_list else tenants_list
            apartments_data.append(apt_dict)

        # For non-admin users, remove sensitive fields
        role = g.user.get("role", "limited")
        if role != "admin":
            for apt in apartments_data:
                apt.pop("landlordEmail", None)
                apt.pop("landlordPhone", None)
                apt.pop("iban", None)
                apt.pop("notes", None)
                apt.pop("managementFee", None)
                apt.pop("rentCost", None)

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
