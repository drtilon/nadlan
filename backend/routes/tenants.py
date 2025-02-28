# routes/tenants.py
from flask import Blueprint, jsonify, g, current_app, request, Response
from models.models import Tenant, Apartment
from extentions import db
from typing import Tuple, List
from .auth import token_required, role_required
from schemas import TenantData
from pydantic import ValidationError
from datetime import datetime

tenants_bp = Blueprint("tenants_bp", __name__)


@tenants_bp.route("/tenants/list", methods=["GET"])
@token_required
def list_tenants() -> Tuple[Response, int]:
    """
    Returns a list of all tenants in the system.
    Administrators see all details, while regular users see limited information.
    """
    try:
        # Query all tenants from the database
        tenants = Tenant.query.all()

        # Convert to dictionary format
        tenants_data = []
        for tenant in tenants:
            tenant_dict = {
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "phone": tenant.phone,
                "apartment_id": tenant.apartment_id,
            }

            # If tenant is associated with an apartment, add apartment address
            if tenant.apartment_id:
                apartment = Apartment.query.get(tenant.apartment_id)
                if apartment:
                    tenant_dict["apartment_address"] = apartment.address

            tenants_data.append(tenant_dict)

        # For non-admin users, remove sensitive information
        role = g.user.get("role", "limited")
        if role != "admin":
            for tenant in tenants_data:
                tenant.pop("email", None)
                tenant.pop("phone", None)

        return jsonify(tenants_data), 200

    except Exception as e:
        current_app.logger.error(f"Error listing tenants: {e}")
        return jsonify({"message": "Error listing tenants", "error": str(e)}), 500


@tenants_bp.route("/tenants/add", methods=["POST"])
@token_required
@role_required("admin")
def add_tenant() -> Tuple[Response, int]:
    """
    Adds a new tenant to the system.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        # Validate request data
        try:
            new_tenant = TenantData(**data)
        except ValidationError as e:
            return jsonify({"message": "Invalid data", "errors": e.errors()}), 400

        # Create and add tenant to database
        tenant = Tenant(**new_tenant.dict())
        db.session.add(tenant)
        db.session.commit()

        return jsonify({"message": "Tenant added successfully", "id": tenant.id}), 201

    except Exception as e:
        current_app.logger.error(f"Error adding tenant: {e}")
        db.session.rollback()
        return jsonify({"message": "Error adding tenant", "error": str(e)}), 500


@tenants_bp.route("/tenants/<int:tenant_id>", methods=["GET"])
@token_required
def get_tenant(tenant_id: int) -> Tuple[Response, int]:
    """
    Returns details for a specific tenant.
    """
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        tenant_data = {
            "id": tenant.id,
            "name": tenant.name,
            "email": tenant.email,
            "phone": tenant.phone,
            "apartment_id": tenant.apartment_id,
        }

        # For non-admin users, remove sensitive information
        role = g.user.get("role", "limited")
        if role != "admin":
            tenant_data.pop("email", None)
            tenant_data.pop("phone", None)

        return jsonify(tenant_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting tenant: {e}")
        return jsonify({"message": "Error getting tenant", "error": str(e)}), 500


@tenants_bp.route("/tenants/<int:tenant_id>", methods=["PUT"])
@token_required
@role_required("admin")
def update_tenant(tenant_id: int) -> Tuple[Response, int]:
    """
    Updates an existing tenant's information.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Update tenant fields
        tenant.name = data.get("name", tenant.name)
        tenant.email = data.get("email", tenant.email)
        tenant.phone = data.get("phone", tenant.phone)
        tenant.apartment_id = data.get("apartment_id", tenant.apartment_id)

        db.session.commit()
        return jsonify({"message": "Tenant updated successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error updating tenant: {e}")
        db.session.rollback()
        return jsonify({"message": "Error updating tenant", "error": str(e)}), 500


@tenants_bp.route("/tenants/<int:tenant_id>", methods=["DELETE"])
@token_required
@role_required("admin")
def delete_tenant(tenant_id: int) -> Tuple[Response, int]:
    """
    Deletes a tenant from the system.
    """
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        db.session.delete(tenant)
        db.session.commit()
        return jsonify({"message": "Tenant deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting tenant: {e}")
        db.session.rollback()
        return jsonify({"message": "Error deleting tenant", "error": str(e)}), 500


@tenants_bp.route("/tenants/search", methods=["GET"])
@token_required
def search_tenants() -> Tuple[Response, int]:
    """
    Searches for tenants based on query parameters.
    """
    try:
        query = request.args.get("q", "")
        if not query:
            return jsonify([]), 200

        # Search for tenants by name
        tenants = Tenant.query.filter(Tenant.name.ilike(f"%{query}%")).all()

        # Convert to dictionary format
        tenants_data = []
        for tenant in tenants:
            tenant_dict = {
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email if g.user.get("role") == "admin" else None,
                "phone": tenant.phone if g.user.get("role") == "admin" else None,
                "apartment_id": tenant.apartment_id,
            }
            tenants_data.append(tenant_dict)

        return jsonify(tenants_data), 200

    except Exception as e:
        current_app.logger.error(f"Error searching tenants: {e}")
        return jsonify({"message": "Error searching tenants", "error": str(e)}), 500
