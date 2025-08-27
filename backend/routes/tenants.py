# routes/tenants.py - CORRECTED VERSION for your actual database schema
from flask import Blueprint, jsonify, g, current_app, request, Response
from models.models import Tenant, Apartment, ContractPeriod, ContractTenant
from extentions import db
from typing import Tuple, List
from .auth import token_required, role_required
from schemas import TenantData, TenantUpdateData
from pydantic import ValidationError
from datetime import datetime, date, timedelta
from activity_logger import ActivityLogger
from sqlalchemy import func, and_, or_

tenants_bp = Blueprint("tenants_bp", __name__)

@tenants_bp.route("/tenants/add", methods=["POST"])
@token_required
def add_tenant() -> Tuple[Response, int]:
    """
    Add a new tenant with validation including gender and passport ID
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        # Validate data using Pydantic
        try:
            tenant_data = TenantData(**data)
        except ValidationError as e:
            return jsonify({"message": "Validation error", "errors": e.errors()}), 400

        # Check if tenant with this name already exists
        existing_tenant = Tenant.query.filter_by(name=tenant_data.name).first()
        if existing_tenant:
            return jsonify({"message": "A tenant with this name already exists"}), 400

        # Check if passport_id is provided and unique
        if tenant_data.passport_id:
            existing_passport = Tenant.query.filter_by(passport_id=tenant_data.passport_id).first()
            if existing_passport:
                return jsonify({"message": "A tenant with this passport ID already exists"}), 400

        # Create new tenant using ACTUAL field names from your model
        tenant = Tenant(
            name=tenant_data.name,
            email=tenant_data.email,
            phone=tenant_data.phone,
            date_of_birth=tenant_data.date_of_birth,  # ACTUAL field name
            refund_iban=tenant_data.refund_iban,      # ACTUAL field name
            passport_id=tenant_data.passport_id,
            gender=tenant_data.gender
            # NO apartment_id - tenants connect through contract periods
        )

        db.session.add(tenant)
        db.session.commit()

        # Log activity
        ActivityLogger.log_activity(
            action="create",
            entity_type="tenant",
            entity_id=tenant.id,
            details={
                "tenant_name": tenant.name,
                "has_passport": bool(tenant.passport_id),
                "gender": tenant.gender
            }
        )

        current_app.logger.info(f"Tenant added: {tenant.name} (ID: {tenant.id})")
        return jsonify({
            "message": "Tenant added successfully",
            "tenant": tenant.to_dict()
        }), 201

    except Exception as e:
        current_app.logger.error(f"Error adding tenant: {e}")
        db.session.rollback()
        return jsonify({"message": "Error adding tenant", "error": str(e)}), 500


@tenants_bp.route("/tenants/update/<int:tenant_id>", methods=["PUT"])
@token_required
def update_tenant(tenant_id) -> Tuple[Response, int]:
    """
    Update tenant information including gender and passport ID
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        # Get existing tenant
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Validate data using Pydantic
        try:
            tenant_update_data = TenantUpdateData(**data)
        except ValidationError as e:
            return jsonify({"message": "Validation error", "errors": e.errors()}), 400

        # Check for name conflicts if name is being updated
        if tenant_update_data.name and tenant_update_data.name != tenant.name:
            existing_tenant = Tenant.query.filter_by(name=tenant_update_data.name).first()
            if existing_tenant and existing_tenant.id != tenant_id:
                return jsonify({"message": "A tenant with this name already exists"}), 400

        # Check for passport ID conflicts if passport_id is being updated
        if tenant_update_data.passport_id and tenant_update_data.passport_id != tenant.passport_id:
            existing_passport = Tenant.query.filter_by(passport_id=tenant_update_data.passport_id).first()
            if existing_passport and existing_passport.id != tenant_id:
                return jsonify({"message": "A tenant with this passport ID already exists"}), 400

        # Update tenant fields using ACTUAL field names
        if tenant_update_data.name:
            tenant.name = tenant_update_data.name
        if tenant_update_data.email:
            tenant.email = tenant_update_data.email
        if tenant_update_data.phone:
            tenant.phone = tenant_update_data.phone
        if tenant_update_data.date_of_birth:
            tenant.date_of_birth = tenant_update_data.date_of_birth  # ACTUAL field name
        if tenant_update_data.refund_iban:
            tenant.refund_iban = tenant_update_data.refund_iban      # ACTUAL field name
        if tenant_update_data.passport_id is not None:
            tenant.passport_id = tenant_update_data.passport_id
        if tenant_update_data.gender:
            tenant.gender = tenant_update_data.gender

        # Update timestamp
        tenant.updated_at = datetime.utcnow()

        db.session.commit()

        # Log activity
        ActivityLogger.log_activity(
            action="update",
            entity_type="tenant",
            entity_id=tenant.id,
            details={
                "tenant_name": tenant.name,
                "updated_fields": [k for k, v in data.items() if v is not None]
            }
        )

        current_app.logger.info(f"Tenant updated: {tenant.name} (ID: {tenant.id})")
        return jsonify({
            "message": "Tenant updated successfully",
            "tenant": tenant.to_dict()
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error updating tenant: {e}")
        db.session.rollback()
        return jsonify({"message": "Error updating tenant", "error": str(e)}), 500


@tenants_bp.route("/tenants/delete/<int:tenant_id>", methods=["DELETE"])
@token_required
def delete_tenant(tenant_id) -> Tuple[Response, int]:
    """
    Delete a tenant from the system
    """
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        tenant_name = tenant.name

        # Check if tenant has active contracts
        active_contracts = []
        for assignment in tenant.contract_assignments:
            if assignment.is_active():
                active_contracts.append(assignment)

        if active_contracts:
            contract_details = []
            for assignment in active_contracts:
                contract_details.append({
                    "contract_id": assignment.contract_period_id,
                    "apartment": assignment.contract_period.apartment.get_short_address()
                })
            return jsonify({
                "message": "Cannot delete tenant with active contracts",
                "active_contracts": contract_details
            }), 400

        # Log activity before deletion
        ActivityLogger.log_activity(
            action="delete",
            entity_type="tenant",
            entity_id=tenant.id,
            details={
                "tenant_name": tenant_name,
                "had_contracts": len(tenant.contract_assignments) > 0
            }
        )

        # Delete tenant
        db.session.delete(tenant)
        db.session.commit()

        current_app.logger.info(f"Tenant deleted: {tenant_name} (ID: {tenant_id})")
        return jsonify({"message": "Tenant deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting tenant: {e}")
        db.session.rollback()
        return jsonify({"message": "Error deleting tenant", "error": str(e)}), 500


@tenants_bp.route("/tenants/list", methods=["GET"])
@token_required
def list_tenants() -> Tuple[Response, int]:
    """
    List all tenants with optional filtering by search term, apartment, and gender
    """
    try:
        # Get query parameters
        search = request.args.get("search", "").strip()
        apartment_id = request.args.get("apartment_id", type=int)
        gender_filter = request.args.get("gender", "").strip().lower()

        # Start with base query
        query = Tenant.query

        # Apply search filter (name or email)
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Tenant.name.ilike(search_pattern),
                    Tenant.email.ilike(search_pattern)
                )
            )

        # Apply gender filter
        if gender_filter and gender_filter != "all":
            query = query.filter(Tenant.gender.ilike(f"%{gender_filter}%"))

        # Apply apartment filter (through contract assignments)
        if apartment_id:
            # Get tenants who have current contracts with the specified apartment
            today = date.today()
            tenant_ids_in_apartment = db.session.query(ContractTenant.tenant_id).join(
                ContractPeriod
            ).filter(
                ContractPeriod.apartment_id == apartment_id,
                ContractPeriod.status == "active",
                ContractPeriod.start_date <= today,
                or_(ContractPeriod.end_date.is_(None), ContractPeriod.end_date >= today)
            ).subquery()

            query = query.filter(Tenant.id.in_(tenant_ids_in_apartment))

        # Get all tenants matching the criteria
        tenants = query.all()

        # Convert to dictionary format
        tenants_data = []
        for tenant in tenants:
            tenant_dict = tenant.to_dict(include_current_assignments=True)
            tenants_data.append(tenant_dict)

        # Log activity
        ActivityLogger.log_activity(
            action="list",
            entity_type="tenant",
            details={
                "count": len(tenants_data),
                "search": search if search else None,
                "apartment_filter": apartment_id if apartment_id else None,
                "gender_filter": gender_filter if gender_filter else None
            }
        )

        current_app.logger.info(f"Listed {len(tenants_data)} tenants")
        return jsonify({
            "success": True,
            "tenants": tenants_data,
            "total": len(tenants_data),
            "filters": {
                "search": search,
                "apartment_id": apartment_id,
                "gender": gender_filter
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error listing tenants: {e}")
        return jsonify({"message": "Error listing tenants", "error": str(e)}), 500


@tenants_bp.route("/tenants/available", methods=["GET"])
@token_required
def get_available_tenants():
    """
    Get tenants that are not currently assigned to any active contract
    """
    try:
        # Get all tenants
        all_tenants = Tenant.query.all()

        # Filter out tenants with active contracts
        available_tenants = []
        today = date.today()

        for tenant in all_tenants:
            has_active_contract = False
            for assignment in tenant.contract_assignments:
                if (assignment.contract_period.status == "active" and
                    assignment.contract_period.start_date <= today and
                    (assignment.contract_period.end_date is None or assignment.contract_period.end_date >= today) and
                    assignment.is_active(today)):
                    has_active_contract = True
                    break

            if not has_active_contract:
                available_tenants.append(tenant)

        # Convert to dictionary format
        tenants_data = []
        for tenant in available_tenants:
            tenant_dict = tenant.to_dict()
            tenants_data.append(tenant_dict)

        # Log activity
        ActivityLogger.log_activity(
            action="list_available",
            entity_type="tenant",
            details={"count": len(tenants_data)}
        )

        current_app.logger.info(f"Retrieved {len(tenants_data)} available (unassigned) tenants")
        return jsonify(tenants_data), 200

    except Exception as e:
        current_app.logger.error(f"Error listing available tenants: {e}")
        return jsonify({"message": "Error listing available tenants", "error": str(e)}), 500


@tenants_bp.route("/tenants/<int:tenant_id>", methods=["GET"])
@token_required
def get_tenant_details(tenant_id) -> Tuple[Response, int]:
    """
    Get detailed information about a specific tenant including contract assignments
    """
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Get tenant data with full details
        tenant_data = tenant.to_dict(include_current_assignments=True)

        # Log activity
        ActivityLogger.log_activity(
            action="view",
            entity_type="tenant",
            entity_id=tenant_id,
            details={"tenant_name": tenant.name}
        )

        return jsonify(tenant_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting tenant details: {e}")
        return jsonify({"message": "Error getting tenant details", "error": str(e)}), 500


@tenants_bp.route("/tenants/analytics", methods=["GET"])
@token_required
def get_tenant_analytics():
    """
    Get tenant analytics including total count, gender distribution, and contract status
    """
    try:
        # Total tenant count
        total_tenants = Tenant.query.count()

        # Gender distribution
        gender_distribution = db.session.query(
            Tenant.gender,
            func.count(Tenant.id).label('count')
        ).group_by(Tenant.gender).all()

        gender_stats = {}
        for gender, count in gender_distribution:
            gender_key = gender if gender else 'not_specified'
            gender_stats[gender_key] = count

        # Count tenants with/without active contracts
        today = date.today()
        active_contract_tenant_ids = db.session.query(ContractTenant.tenant_id).join(
            ContractPeriod
        ).filter(
            ContractPeriod.status == "active",
            ContractPeriod.start_date <= today,
            or_(ContractPeriod.end_date.is_(None), ContractPeriod.end_date >= today),
            ContractTenant.move_in_date <= today,
            or_(ContractTenant.move_out_date.is_(None), ContractTenant.move_out_date >= today)
        ).distinct().all()

        active_contract_tenant_ids = [t[0] for t in active_contract_tenant_ids]
        tenants_with_contracts = len(active_contract_tenant_ids)
        tenants_without_contracts = total_tenants - tenants_with_contracts

        # Log activity
        ActivityLogger.log_activity(
            action="analytics",
            entity_type="tenant",
            details={"total_tenants": total_tenants}
        )

        return jsonify({
            "total_tenants": total_tenants,
            "tenants_with_contracts": tenants_with_contracts,
            "tenants_without_contracts": tenants_without_contracts,
            "gender_distribution": gender_stats
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting tenant analytics: {e}")
        return jsonify({"message": "Error getting tenant analytics", "error": str(e)}), 500


# Legacy endpoints for backward compatibility
@tenants_bp.route("/add", methods=["POST"])
@token_required
def legacy_add_tenant():
    """Legacy endpoint - redirects to main add endpoint"""
    return add_tenant()


@tenants_bp.route("/list", methods=["GET"])
@token_required
def legacy_list_tenants():
    """Legacy endpoint - redirects to main list endpoint"""
    return list_tenants()


@tenants_bp.route("/<int:tenant_id>", methods=["GET"])
@token_required
def legacy_get_tenant(tenant_id):
    """Legacy endpoint - redirects to main get endpoint"""
    return get_tenant_details(tenant_id)


@tenants_bp.route("/<int:tenant_id>", methods=["PUT"])
@token_required
def legacy_update_tenant(tenant_id):
    """Legacy endpoint - redirects to main update endpoint"""
    return update_tenant(tenant_id)


@tenants_bp.route("/<int:tenant_id>", methods=["DELETE"])
@token_required
def legacy_delete_tenant(tenant_id):
    """Legacy endpoint - redirects to main delete endpoint"""
    return delete_tenant(tenant_id)
