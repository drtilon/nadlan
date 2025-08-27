# routes/tenants.py - Complete file with Gender and Contract Expiry support
from flask import Blueprint, jsonify, g, current_app, request, Response
from models.models import Tenant, Apartment
from extentions import db
from typing import Tuple, List
from .auth import token_required, role_required
from schemas import TenantData, TenantUpdateData
from pydantic import ValidationError
from datetime import datetime, date, timedelta
from activity_logger import ActivityLogger
from sqlalchemy import func

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

        # Create new tenant
        tenant = Tenant(
            name=tenant_data.name,
            email=tenant_data.email,
            phone=tenant_data.phone,
            bornOn=tenant_data.bornOn,
            refundIban=tenant_data.refundIban,
            passport_id=tenant_data.passport_id,
            gender=tenant_data.gender,
            apartment_id=tenant_data.apartment_id
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
                "apartment_id": tenant.apartment_id,
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

        # Track changes for logging
        changes = {}

        # Update fields that are provided
        update_fields = [
            'name', 'email', 'phone', 'bornOn', 'refundIban',
            'passport_id', 'gender', 'apartment_id'
        ]

        for field in update_fields:
            new_value = getattr(tenant_update_data, field)
            if new_value is not None:
                old_value = getattr(tenant, field)
                if new_value != old_value:
                    changes[field] = {"from": old_value, "to": new_value}
                    setattr(tenant, field, new_value)

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
                "changes": changes,
                "apartment_id": tenant.apartment_id
            }
        )

        current_app.logger.info(f"Tenant updated: {tenant.name} (ID: {tenant.id})")
        return jsonify({
            "message": "Tenant updated successfully",
            "tenant": tenant.to_dict(),
            "changes": changes
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error updating tenant: {e}")
        db.session.rollback()
        return jsonify({"message": "Error updating tenant", "error": str(e)}), 500


@tenants_bp.route("/tenants/list", methods=["GET"])
@token_required
def list_tenants() -> Tuple[Response, int]:
    """
    Lists all tenants with optional filtering and contract expiry information
    """
    try:
        # Get query parameters
        search = request.args.get('search', '').strip()
        apartment_id = request.args.get('apartment_id', type=int)
        gender_filter = request.args.get('gender', '').strip()

        # Build base query
        query = Tenant.query

        # Apply filters
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db.or_(
                    Tenant.name.ilike(search_term),
                    Tenant.email.ilike(search_term),
                    Tenant.phone.ilike(search_term),
                    Tenant.passport_id.ilike(search_term)
                )
            )

        if apartment_id:
            query = query.filter(Tenant.apartment_id == apartment_id)

        if gender_filter:
            query = query.filter(Tenant.gender == gender_filter.lower())

        # Get all tenants
        tenants = query.all()

        # Convert to dictionary format with contract expiry info using ContractTenant table
        tenants_data = []
        for tenant in tenants:
            tenant_dict = tenant.to_dict()

            # Add contract expiry information using ContractTenant table
            from models.models import ContractPeriod, ContractTenant

            # Get current contract for this tenant through ContractTenant table
            current_contract_tenant = db.session.query(ContractTenant).join(
                ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id
            ).filter(
                ContractTenant.tenant_id == tenant.id,
                ContractPeriod.status == 'active',
                ContractPeriod.start_date <= date.today(),
                db.or_(
                    ContractPeriod.end_date.is_(None),
                    ContractPeriod.end_date >= date.today()
                )
            ).first()

            if current_contract_tenant and current_contract_tenant.contract_period:
                contract = current_contract_tenant.contract_period
                tenant_dict["contract_info"] = {
                    "contract_id": contract.id,
                    "contract_number": contract.contract_number,
                    "start_date": contract.start_date.isoformat() if contract.start_date else None,
                    "end_date": contract.end_date.isoformat() if contract.end_date else None,
                    "monthly_rent": float(contract.monthly_rent) if contract.monthly_rent else 0,
                    "is_primary": current_contract_tenant.is_primary,
                    "rent_share_percentage": float(current_contract_tenant.rent_share_percentage) if current_contract_tenant.rent_share_percentage else 100.0,
                    "days_until_expiry": (contract.end_date - date.today()).days if contract.end_date else None,
                    "status": contract.status
                }
            else:
                tenant_dict["contract_info"] = None

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
    Get tenants that are not currently assigned to any apartment
    """
    try:
        # Get tenants where apartment_id is NULL (not assigned to any apartment)
        available_tenants = Tenant.query.filter_by(apartment_id=None).all()

        # Convert to dictionary format
        tenants_data = []
        for tenant in available_tenants:
            tenant_dict = tenant.to_dict(include_apartment=False, include_contracts=False)
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
    Get detailed information about a specific tenant including contract expiry
    FIXED: MySQL compatible version with proper NULL handling
    """
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Get tenant basic data
        tenant_data = tenant.to_dict()

        # Get contract information using ContractTenant table
        from models.models import ContractPeriod, ContractTenant

        # FIXED: MySQL compatible query - no NULLS FIRST syntax
        # First try to get current active contract (move_out_date is NULL)
        current_contract_tenant = db.session.query(ContractTenant).join(
            ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id
        ).filter(
            ContractTenant.tenant_id == tenant.id,
            ContractTenant.move_out_date.is_(None),  # Not moved out
            ContractPeriod.status == 'active'
        ).first()

        # If no active contract, get the most recent historical contract
        # MySQL compatible: use CASE to handle NULL values in ORDER BY
        if not current_contract_tenant:
            current_contract_tenant = db.session.query(ContractTenant).join(
                ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id
            ).filter(
                ContractTenant.tenant_id == tenant.id
            ).order_by(
                # MySQL compatible NULL handling - NULL dates go first (most recent active contracts)
                db.case(
                    (ContractTenant.move_out_date.is_(None), 0),
                    else_=1
                ),
                ContractTenant.move_out_date.desc(),
                ContractTenant.move_in_date.desc()
            ).first()

        if current_contract_tenant:
            contract = current_contract_tenant.contract_period
            is_active = current_contract_tenant.move_out_date is None and contract.status == 'active'

            tenant_data["contract_info"] = {
                "contract_period_id": contract.id,
                "contract_id": contract.id,
                "contract_number": contract.contract_number,
                "start_date": contract.start_date.isoformat() if contract.start_date else None,
                "end_date": contract.end_date.isoformat() if contract.end_date else None,
                "monthly_rent": float(contract.monthly_rent) if contract.monthly_rent else 0,
                "is_primary": current_contract_tenant.is_primary,
                "rent_share_percentage": float(current_contract_tenant.rent_share_percentage) if current_contract_tenant.rent_share_percentage else 100.0,
                "days_until_expiry": (contract.end_date - date.today()).days if contract.end_date and is_active else None,
                "status": contract.status if is_active else 'historical',
                "move_in_date": current_contract_tenant.move_in_date.isoformat() if current_contract_tenant.move_in_date else None,
                "move_out_date": current_contract_tenant.move_out_date.isoformat() if current_contract_tenant.move_out_date else None,
                "is_active": is_active,
                "apartment_id": contract.apartment_id
            }
        else:
            tenant_data["contract_info"] = None

        # Add tenant status information
        tenant_data["is_active"] = tenant.apartment_id is not None
        tenant_data["status"] = "active" if tenant.apartment_id else "moved_out"

        # Log activity
        ActivityLogger.log_activity(
            action="view",
            entity_type="tenant",
            entity_id=tenant.id,
            details={"tenant_name": tenant.name}
        )

        current_app.logger.info(f"Retrieved tenant details: {tenant.name} (ID: {tenant_id})")
        return jsonify({
            "success": True,
            "tenant": tenant_data
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting tenant details: {e}")
        return jsonify({"message": "Error getting tenant details", "error": str(e)}), 500

@tenants_bp.route("/tenants/<int:tenant_id>", methods=["PUT"])
@token_required
def update_tenant_legacy(tenant_id: int) -> Tuple[Response, int]:
    """
    Legacy update endpoint - redirects to the main update endpoint
    """
    return update_tenant(tenant_id)


@tenants_bp.route("/tenants/delete/<int:tenant_id>", methods=["DELETE"])
@token_required
def delete_tenant(tenant_id) -> Tuple[Response, int]:
    """
    Delete a tenant by ID
    """
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        tenant_name = tenant.name
        apartment_id = tenant.apartment_id

        # Log activity before deletion
        ActivityLogger.log_activity(
            action="delete",
            entity_type="tenant",
            entity_id=tenant.id,
            details={
                "tenant_name": tenant_name,
                "apartment_id": apartment_id
            }
        )

        db.session.delete(tenant)
        db.session.commit()

        current_app.logger.info(f"Tenant deleted: {tenant_name} (ID: {tenant_id})")
        return jsonify({"message": "Tenant deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting tenant: {e}")
        db.session.rollback()
        return jsonify({"message": "Error deleting tenant", "error": str(e)}), 500


@tenants_bp.route("/tenants/search", methods=["GET"])
@token_required
def search_tenants() -> Tuple[Response, int]:
    """
    Searches for tenants based on query parameters including gender and passport
    """
    try:
        query = request.args.get("q", "")
        if not query:
            return jsonify([]), 200

        # Search for tenants by name, email, phone, passport, or gender
        search_term = f"%{query}%"
        tenants = Tenant.query.filter(
            db.or_(
                Tenant.name.ilike(search_term),
                Tenant.email.ilike(search_term),
                Tenant.phone.ilike(search_term),
                Tenant.passport_id.ilike(search_term),
                Tenant.gender.ilike(search_term)
            )
        ).all()

        # Convert to dictionary format
        tenants_data = []
        for tenant in tenants:
            tenant_dict = tenant.to_dict(include_apartment=False, include_contracts=False)
            tenants_data.append(tenant_dict)

        # Log search
        ActivityLogger.log_activity(
            action="search",
            entity_type="tenant",
            details={"query": query, "results": len(tenants_data)}
        )

        return jsonify(tenants_data), 200

    except Exception as e:
        current_app.logger.error(f"Error searching tenants: {e}")
        return jsonify({"message": "Error searching tenants", "error": str(e)}), 500


@tenants_bp.route("/tenants/apartment/<int:apartment_id>", methods=["GET"])
@token_required
def get_apartment_tenants(apartment_id: int) -> Tuple[Response, int]:
    """
    Returns all tenants for a specific apartment with contract information
    """
    try:
        # Query tenants associated with this apartment
        tenants = Tenant.query.filter_by(apartment_id=apartment_id).all()

        if not tenants:
            return jsonify([]), 200

        # Convert to dictionary format with contract info
        tenants_data = []
        for tenant in tenants:
            tenant_dict = tenant.to_dict()

            # Add contract information using ContractTenant table
            from models.models import ContractPeriod, ContractTenant

            # Get current contract for this tenant through ContractTenant table
            current_contract_tenant = db.session.query(ContractTenant).join(
                ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id
            ).filter(
                ContractTenant.tenant_id == tenant.id,
                ContractPeriod.apartment_id == apartment_id,
                ContractPeriod.status == 'active',
                ContractPeriod.start_date <= date.today(),
                db.or_(
                    ContractPeriod.end_date.is_(None),
                    ContractPeriod.end_date >= date.today()
                )
            ).first()

            if current_contract_tenant:
                tenant_dict["isPrimary"] = current_contract_tenant.is_primary
                tenant_dict["rent_share_percentage"] = float(current_contract_tenant.rent_share_percentage) if current_contract_tenant.rent_share_percentage else 100.0
            else:
                tenant_dict["isPrimary"] = False
                tenant_dict["rent_share_percentage"] = 100.0

            tenants_data.append(tenant_dict)

        # Sort by is_primary to put primary tenants first
        tenants_data = sorted(
            tenants_data,
            key=lambda x: (not x.get("isPrimary", False), x.get("name", "")),
        )

        return jsonify(tenants_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting apartment tenants: {e}")
        return jsonify(
            {"message": "Error retrieving apartment tenants", "error": str(e)}
        ), 500


@tenants_bp.route("/tenants/analytics", methods=["GET"])
@token_required
def get_tenant_analytics():
    """
    Get tenant analytics including contract expiry information
    """
    try:
        from models.models import ContractPeriod, ContractTenant

        # Total tenants
        total_tenants = Tenant.query.count()

        # Get tenants with expiring contracts (within 30 days)
        today = date.today()
        expiry_threshold = today + timedelta(days=30)

        expiring_contracts = db.session.query(ContractTenant).join(
            ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id
        ).filter(
            ContractPeriod.status == 'active',
            ContractPeriod.end_date.between(today, expiry_threshold)
        ).count()

        # Get tenants without contracts
        tenants_without_contracts = db.session.query(Tenant).outerjoin(
            ContractTenant, Tenant.id == ContractTenant.tenant_id
        ).filter(ContractTenant.id.is_(None)).count()

        # Gender distribution
        gender_stats = db.session.query(
            Tenant.gender,
            func.count(Tenant.id)
        ).group_by(Tenant.gender).all()

        gender_distribution = {}
        for gender, count in gender_stats:
            gender_key = gender if gender else 'not_specified'
            gender_distribution[gender_key] = count

        return jsonify({
            "total_tenants": total_tenants,
            "expiring_contracts": expiring_contracts,
            "tenants_without_contracts": tenants_without_contracts,
            "gender_distribution": gender_distribution
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
