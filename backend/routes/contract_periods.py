# routes/contract_periods.py - COMPLETE VERSION with Move-Out functionality
from flask import Blueprint, request, jsonify, current_app, g
from .auth import token_required, role_required
from extentions import db
from models.models import Apartment, Tenant, ContractPeriod, ContractTenant
from sqlalchemy import text, and_, or_
from datetime import datetime, date
from activity_logger import ActivityLogger
import json

contract_periods_bp = Blueprint("contract_periods_bp", __name__)

# ================ EXISTING API ENDPOINTS ================

@contract_periods_bp.route("/apartments/<int:apartment_id>/contracts", methods=["GET"])
@token_required
def get_apartment_contracts(apartment_id):
    """Get all contracts for an apartment"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        contracts = ContractPeriod.query.filter_by(apartment_id=apartment_id).order_by(ContractPeriod.start_date.desc()).all()
        contracts_data = []

        for contract in contracts:
            # Get tenants for this contract
            contract_tenants = db.session.query(ContractTenant, Tenant).join(
                Tenant, ContractTenant.tenant_id == Tenant.id
            ).filter(ContractTenant.contract_period_id == contract.id).all()

            tenants_data = []
            for contract_tenant, tenant in contract_tenants:
                tenants_data.append({
                    "id": contract_tenant.id,
                    "tenant_id": tenant.id,
                    "tenant": {
                        "id": tenant.id,
                        "name": tenant.name,
                        "email": tenant.email,
                        "phone": tenant.phone
                    },
                    "is_primary": contract_tenant.is_primary,
                    "move_in_date": contract_tenant.move_in_date.isoformat() if contract_tenant.move_in_date else None,
                    "move_out_date": contract_tenant.move_out_date.isoformat() if contract_tenant.move_out_date else None,
                    "rent_share_percentage": float(contract_tenant.rent_share_percentage) if contract_tenant.rent_share_percentage else 100.0,
                    "notes": contract_tenant.notes
                })

            contract_data = {
                "id": contract.id,
                "contract_number": contract.contract_number,
                "start_date": contract.start_date.isoformat() if contract.start_date else None,
                "end_date": contract.end_date.isoformat() if contract.end_date else None,
                "monthly_rent": float(contract.monthly_rent) if contract.monthly_rent else 0,
                "security_deposit": float(contract.security_deposit) if contract.security_deposit else 0,
                "status": contract.status,
                "notes": contract.notes,
                "created_at": contract.created_at.isoformat() if contract.created_at else None,
                "updated_at": contract.updated_at.isoformat() if contract.updated_at else None,
                "created_by": contract.created_by,
                "tenants": tenants_data,
                "apartment_address": apartment.address if apartment else None,
                "is_current": is_current_contract(contract),
                "duration_days": calculate_duration_days(contract),
                "payments_count": 0
            }

            contracts_data.append(contract_data)

        return jsonify(contracts_data), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching apartment contracts: {e}")
        return jsonify({"message": "Error fetching contracts", "error": str(e)}), 500

@contract_periods_bp.route("/contracts", methods=["POST"])
@token_required
@role_required("admin")
def create_contract_period():
    """Create a new contract period - FIXED VERSION"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        required_fields = ["apartment_id", "start_date", "monthly_rent"]
        for field in required_fields:
            if field not in data:
                return jsonify({"message": f"Missing required field: {field}"}), 400

        apartment = Apartment.query.get(data["apartment_id"])
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        contract_number = data.get("contract_number")
        if not contract_number:
            return jsonify({"message": "Contract number is required"}), 400

        # Check for overlapping contracts
        overlapping = check_overlapping_contracts(
            data["apartment_id"],
            data["start_date"],
            data.get("end_date")
        )
        if overlapping:
            return jsonify({
                "message": "Contract period overlaps with existing contract",
                "overlapping_contract": overlapping
            }), 400

        # Create the contract
        start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()

        contract = ContractPeriod(
            apartment_id=data["apartment_id"],
            contract_number=contract_number,
            start_date=start_date,
            end_date=datetime.strptime(data["end_date"], "%Y-%m-%d").date() if data.get("end_date") else None,
            monthly_rent=float(data["monthly_rent"]),
            security_deposit=float(data.get("security_deposit", 0)),
            status=data.get("status", "active"),
            notes=data.get("notes", ""),
            created_by=g.current_user.username if hasattr(g, 'current_user') else None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.session.add(contract)
        db.session.flush()  # Get the contract ID

        # Add tenants to contract if provided - FIXED
        tenant_ids = data.get("tenant_ids", [])
        if tenant_ids:
            add_tenants_to_contract(contract.id, tenant_ids, start_date)

        db.session.commit()

        ActivityLogger.log_apartment_action(
            action="create_contract_period",
            apartment_id=data["apartment_id"],
            details={
                "contract_number": contract_number,
                "start_date": data["start_date"],
                "end_date": data.get("end_date"),
                "monthly_rent": data["monthly_rent"],
                "tenant_count": len(tenant_ids)
            }
        )

        return jsonify({
            "message": "Contract period created successfully",
            "contract_id": contract.id
        }), 201

    except Exception as e:
        current_app.logger.error(f"Error creating contract period: {e}")
        db.session.rollback()
        return jsonify({"message": "Error creating contract period", "error": str(e)}), 500

@contract_periods_bp.route("/contracts/<int:contract_id>", methods=["PUT"])
@token_required
@role_required("admin")
def update_contract_period(contract_id):
    """Update an existing contract period - FIXED VERSION"""
    try:
        contract = ContractPeriod.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Update contract fields
        if "contract_number" in data:
            contract.contract_number = data["contract_number"]
        if "start_date" in data:
            contract.start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        if "end_date" in data:
            contract.end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date() if data["end_date"] else None
        if "monthly_rent" in data:
            contract.monthly_rent = float(data["monthly_rent"])
        if "security_deposit" in data:
            contract.security_deposit = float(data["security_deposit"])
        if "status" in data:
            contract.status = data["status"]
        if "notes" in data:
            contract.notes = data["notes"]

        contract.updated_at = datetime.utcnow()

        # Update tenants if provided - FIXED
        if "tenant_ids" in data:
            # Remove existing tenant assignments
            ContractTenant.query.filter_by(contract_period_id=contract_id).delete()

            # Add new tenant assignments
            tenant_ids = data["tenant_ids"]
            if tenant_ids:
                add_tenants_to_contract(contract_id, tenant_ids, contract.start_date)

        db.session.commit()

        ActivityLogger.log_apartment_action(
            action="update_contract_period",
            apartment_id=contract.apartment_id,
            details={
                "contract_id": contract_id,
                "contract_number": contract.contract_number
            }
        )

        return jsonify({"message": "Contract period updated successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error updating contract period: {e}")
        db.session.rollback()
        return jsonify({"message": "Error updating contract period", "error": str(e)}), 500
@contract_periods_bp.route("/contracts/<int:contract_id>/add-tenant", methods=["POST"])
@token_required
@role_required("admin")
def add_tenant_to_contract(contract_id):
    """Add a new tenant to an existing contract period"""
    try:
        # Get the contract
        contract = ContractPeriod.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        tenant_id = data.get("tenant_id")
        move_in_date_str = data.get("move_in_date")
        rent_share_percentage = data.get("rent_share_percentage", None)
        is_primary = data.get("is_primary", False)
        notes = data.get("notes", "")

        if not tenant_id:
            return jsonify({"message": "Tenant ID is required"}), 400

        # Validate tenant exists
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Use contract start date if no move_in_date provided
        if move_in_date_str:
            try:
                move_in_date = datetime.strptime(move_in_date_str, "%Y-%m-%d").date()
            except ValueError:
                return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400
        else:
            move_in_date = contract.start_date or date.today()

        # Check if tenant is already in this contract
        existing = ContractTenant.query.filter_by(
            contract_period_id=contract_id,
            tenant_id=tenant_id,
            move_out_date=None
        ).first()

        if existing:
            return jsonify({"message": "Tenant is already in this contract"}), 400

        # Calculate rent share if not provided
        if rent_share_percentage is None:
            # Get current active tenants in this contract
            current_tenants = ContractTenant.query.filter_by(
                contract_period_id=contract_id,
                move_out_date=None
            ).count()
            rent_share_percentage = 100.0 / (current_tenants + 1)

            # Update existing tenants to have equal shares
            existing_tenants = ContractTenant.query.filter_by(
                contract_period_id=contract_id,
                move_out_date=None
            ).all()

            for existing_tenant in existing_tenants:
                existing_tenant.rent_share_percentage = rent_share_percentage
                existing_tenant.updated_at = datetime.utcnow()

        # Create new contract tenant record
        contract_tenant = ContractTenant(
            contract_period_id=contract_id,
            tenant_id=tenant_id,
            is_primary=is_primary,
            move_in_date=move_in_date,  # FIXED: Always provide a valid date
            rent_share_percentage=rent_share_percentage,
            notes=notes,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.session.add(contract_tenant)
        db.session.commit()

        ActivityLogger.log_apartment_action(
            action="add_tenant_to_contract",
            apartment_id=contract.apartment_id,
            details={
                "contract_id": contract_id,
                "tenant_id": tenant_id,
                "tenant_name": tenant.name,
                "move_in_date": move_in_date.isoformat()
            }
        )

        return jsonify({
            "message": f"Tenant {tenant.name} added to contract successfully",
            "contract_tenant_id": contract_tenant.id
        }), 201

    except Exception as e:
        current_app.logger.error(f"Error adding tenant to contract: {e}")
        db.session.rollback()
        return jsonify({"message": "Error adding tenant to contract", "error": str(e)}), 500



@contract_periods_bp.route("/contracts/<int:contract_id>", methods=["DELETE"])
@token_required
@role_required("admin")
def delete_contract_period(contract_id):
    """Delete a contract period"""
    try:
        contract = ContractPeriod.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        apartment_id = contract.apartment_id
        contract_number = contract.contract_number

        db.session.delete(contract)
        db.session.commit()

        ActivityLogger.log_apartment_action(
            action="delete_contract_period",
            apartment_id=apartment_id,
            details={
                "contract_id": contract_id,
                "contract_number": contract_number
            }
        )

        return jsonify({"message": "Contract period deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting contract period: {e}")
        db.session.rollback()
        return jsonify({"message": "Error deleting contract period", "error": str(e)}), 500

@contract_periods_bp.route("/tenants/<int:tenant_id>/move-history", methods=["GET"])
@token_required
def get_tenant_move_history(tenant_id):
    """Get complete move history for a tenant across all apartments and contracts - FIXED VERSION"""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Get all contract tenant records for this tenant, ordered properly for MySQL
        contract_tenants = db.session.query(ContractTenant)\
            .filter(ContractTenant.tenant_id == tenant_id)\
            .order_by(
                # MySQL compatible NULL handling
                db.case(
                    (ContractTenant.move_out_date.is_(None), 0),  # Active contracts first (NULL move_out_date)
                    else_=1
                ),
                ContractTenant.move_out_date.desc(),  # Most recent move-out dates first
                ContractTenant.move_in_date.desc()    # Then by move-in date
            )\
            .all()

        move_history = []
        for ct in contract_tenants:
            # Get contract and apartment separately to avoid relationship issues
            contract = db.session.query(ContractPeriod).get(ct.contract_period_id)
            apartment = db.session.query(Apartment).get(contract.apartment_id) if contract else None

            history_entry = {
                "contract_tenant_id": ct.id,
                "contract_id": ct.contract_period_id,
                "contract_number": contract.contract_number if contract else 'Unknown',
                "apartment_id": contract.apartment_id if contract else None,
                "apartment_address": apartment.address or apartment.full_address if apartment else 'Unknown',
                "move_in_date": ct.move_in_date.isoformat() if ct.move_in_date else None,
                "move_out_date": ct.move_out_date.isoformat() if ct.move_out_date else None,
                "is_primary": ct.is_primary,
                "rent_share_percentage": float(ct.rent_share_percentage) if ct.rent_share_percentage else 100.0,
                "monthly_rent": float(contract.monthly_rent) if contract and contract.monthly_rent else 0,
                "notes": ct.notes,
                "is_current": not ct.move_out_date and contract and contract.status == 'active',
                "duration_days": None
            }

            # Calculate duration if we have both dates
            if ct.move_in_date:
                end_date = ct.move_out_date or date.today()
                history_entry["duration_days"] = (end_date - ct.move_in_date).days

            move_history.append(history_entry)

        # Calculate summary statistics
        total_apartments = len(set(entry["apartment_id"] for entry in move_history if entry["apartment_id"]))
        current_apartment = next((entry for entry in move_history if entry["is_current"]), None)
        total_rent_paid_estimate = sum(
            (entry["monthly_rent"] * (entry["duration_days"] / 30.44)) if entry["duration_days"] and entry["monthly_rent"]
            else 0 for entry in move_history
        )

        return jsonify({
            "tenant": {
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "phone": tenant.phone
            },
            "move_history": move_history,
            "summary": {
                "total_apartments_lived": total_apartments,
                "total_contracts": len(move_history),
                "current_apartment": current_apartment,
                "estimated_total_rent_paid": total_rent_paid_estimate,
                "is_currently_active": current_apartment is not None
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving tenant move history: {e}")
        return jsonify({"message": "Error retrieving tenant move history", "error": str(e)}), 500
# routes/contract_periods.py - ADD THESE MISSING ENDPOINTS

# Add this import at the top if not already present
from datetime import datetime, date
import json

@contract_periods_bp.route("/contract-tenants/<int:contract_tenant_id>/move-out", methods=["PUT"])
@token_required
def move_out_tenant(contract_tenant_id):
    """Move out a tenant by setting their move_out_date"""
    try:
        contract_tenant = ContractTenant.query.get(contract_tenant_id)
        if not contract_tenant:
            return jsonify({"message": "Contract tenant record not found"}), 404

        tenant = contract_tenant.tenant
        contract = db.session.query(ContractPeriod).get(contract_tenant.contract_period_id)

        if not tenant:
            return jsonify({"message": "Associated tenant not found"}), 404
        if not contract:
            return jsonify({"message": "Associated contract not found"}), 404

        data = request.get_json()
        move_out_date_str = data.get('move_out_date')
        notes = data.get('notes', '')

        if not move_out_date_str:
            return jsonify({"message": "move_out_date is required"}), 400

        try:
            move_out_date = datetime.strptime(move_out_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400

        # Validate move_out_date is not before move_in_date
        if contract_tenant.move_in_date and move_out_date <= contract_tenant.move_in_date:
            return jsonify({"message": "Move-out date must be after move-in date"}), 400

        # Update the contract tenant record
        contract_tenant.move_out_date = move_out_date
        if notes:
            existing_notes = contract_tenant.notes or ""
            contract_tenant.notes = f"{existing_notes}\nMoved out: {notes}".strip()

        # Also update legacy tenant apartment_id to None if this was their current apartment
        if tenant.apartment_id == contract.apartment_id:
            tenant.apartment_id = None

        db.session.commit()

        ActivityLogger.log_activity(
            action="move_out",
            entity_type="tenant",
            entity_id=tenant.id,
            details={
                "contract_tenant_id": contract_tenant_id,
                "apartment_id": contract.apartment_id,
                "apartment_address": contract.apartment.address if contract.apartment else None,
                "move_out_date": move_out_date.isoformat(),
                "notes": notes
            }
        )

        return jsonify({
            "message": f"Tenant {tenant.name} moved out successfully",
            "tenant_name": tenant.name,
            "apartment_address": contract.apartment.address if contract.apartment else None,
            "move_out_date": move_out_date.isoformat(),
            "contract_id": contract.id,
            "contract_number": contract.contract_number
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error moving out tenant: {e}")
        return jsonify({"message": "Error moving out tenant", "error": str(e)}), 500


# EXISTING TRANSFER ENDPOINT (already in your code, but enhanced)
@contract_periods_bp.route("/tenants/<int:tenant_id>/transfer", methods=["POST"])
@token_required
@role_required("admin")
def transfer_tenant_to_apartment(tenant_id):
    """Transfer a tenant from their current apartment to a new apartment"""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        new_apartment_id = data.get('new_apartment_id')
        move_out_date_str = data.get('move_out_date')
        move_in_date_str = data.get('move_in_date')
        notes = data.get('notes', '')
        assign_to_new_contract = data.get('assign_to_new_contract', True)

        if not new_apartment_id:
            return jsonify({"message": "new_apartment_id is required"}), 400

        new_apartment = Apartment.query.get(new_apartment_id)
        if not new_apartment:
            return jsonify({"message": "New apartment not found"}), 404

        try:
            move_out_date = datetime.strptime(move_out_date_str, '%Y-%m-%d').date() if move_out_date_str else date.today()
            move_in_date = datetime.strptime(move_in_date_str, '%Y-%m-%d').date() if move_in_date_str else date.today()
        except ValueError:
            return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400

        # Validate dates
        if move_in_date <= move_out_date:
            return jsonify({"message": "Move-in date must be after move-out date"}), 400

        # Step 1: Move out from current apartment
        old_apartment_id = None
        current_contract_tenant = db.session.query(ContractTenant)\
            .join(ContractPeriod)\
            .filter(
                ContractTenant.tenant_id == tenant_id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == 'active'
            ).first()

        if current_contract_tenant:
            old_apartment_id = current_contract_tenant.contract_period.apartment_id
            current_contract_tenant.move_out_date = move_out_date
            if notes:
                existing_notes = current_contract_tenant.notes or ""
                current_contract_tenant.notes = f"{existing_notes}\nTransferred: {notes}".strip()

        # Step 2: Update legacy apartment_id
        tenant.apartment_id = new_apartment_id

        # Step 3: Assign to new apartment's contract if requested
        new_contract_tenant = None
        if assign_to_new_contract:
            # Find active contract in new apartment
            active_contract = db.session.query(ContractPeriod)\
                .filter(
                    ContractPeriod.apartment_id == new_apartment_id,
                    ContractPeriod.status == 'active'
                ).first()

            if active_contract:
                # Calculate rent share (default to equal share among all tenants)
                existing_tenants = db.session.query(ContractTenant)\
                    .filter(
                        ContractTenant.contract_period_id == active_contract.id,
                        ContractTenant.move_out_date.is_(None)
                    ).count()

                rent_share = 100.0 / (existing_tenants + 1)

                new_contract_tenant = ContractTenant(
                    contract_period_id=active_contract.id,
                    tenant_id=tenant_id,
                    is_primary=False,
                    move_in_date=move_in_date,
                    rent_share_percentage=rent_share,
                    notes=f"Transferred from apartment {old_apartment_id} on {move_out_date}",
                    created_at=datetime.utcnow()
                )
                db.session.add(new_contract_tenant)

        db.session.commit()

        ActivityLogger.log_activity(
            action="transfer",
            entity_type="tenant",
            entity_id=tenant_id,
            details={
                "old_apartment_id": old_apartment_id,
                "new_apartment_id": new_apartment_id,
                "move_out_date": move_out_date.isoformat(),
                "move_in_date": move_in_date.isoformat(),
                "notes": notes
            }
        )

        result_message = f"Tenant {tenant.name} transferred successfully"
        if new_contract_tenant:
            result_message += f" and assigned to contract {active_contract.contract_number}"

        return jsonify({
            "message": result_message,
            "tenant": tenant.to_dict(),
            "old_apartment_id": old_apartment_id,
            "new_apartment_id": new_apartment_id,
            "new_contract_assignment": new_contract_tenant.to_dict() if new_contract_tenant else None
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error transferring tenant: {e}")
        return jsonify({"message": "Error transferring tenant", "error": str(e)}), 500

@contract_periods_bp.route("/apartments/<int:apartment_id>/active-tenants", methods=["GET"])
@token_required
def get_active_tenants_for_apartment(apartment_id):
    """Get only the currently active tenants for an apartment (not moved out)"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get active contract tenants (not moved out) for this apartment
        active_contract_tenants = db.session.query(ContractTenant)\
            .join(ContractPeriod)\
            .join(Tenant)\
            .filter(
                ContractPeriod.apartment_id == apartment_id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == 'active'
            )\
            .order_by(ContractTenant.is_primary.desc(), ContractTenant.move_in_date.asc())\
            .all()

        active_tenants = []
        for ct in active_contract_tenants:
            tenant = ct.tenant
            contract = db.session.query(ContractPeriod).get(ct.contract_period_id)

            tenant_data = {
                "tenant_id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "phone": tenant.phone,
                "contract_tenant_id": ct.id,
                "contract_id": contract.id,
                "contract_number": contract.contract_number,
                "is_primary": ct.is_primary,
                "move_in_date": ct.move_in_date.isoformat() if ct.move_in_date else None,
                "move_out_date": ct.move_out_date.isoformat() if ct.move_out_date else None,
                "rent_share_percentage": float(ct.rent_share_percentage) if ct.rent_share_percentage else 100.0,
                "monthly_rent_portion": (float(contract.monthly_rent) * float(ct.rent_share_percentage) / 100.0) if contract.monthly_rent and ct.rent_share_percentage else 0,
                "notes": ct.notes
            }
            active_tenants.append(tenant_data)

        return jsonify({
            "apartment": {
                "id": apartment.id,
                "address": apartment.address
            },
            "active_tenants": active_tenants,
            "total_active": len(active_tenants),
            "total_rent_shares": sum(t["rent_share_percentage"] for t in active_tenants)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving active tenants: {e}")
        return jsonify({"message": "Error retrieving active tenants", "error": str(e)}), 500

# ================ UPDATED TENANT ENDPOINTS ================

@contract_periods_bp.route("/tenants/<int:tenant_id>/current-contract", methods=["GET"])
@token_required
def get_tenant_current_contract(tenant_id):
    """Get the current active contract for a tenant"""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Find current active contract through ContractTenant
        current_contract_tenant = db.session.query(ContractTenant)\
            .join(ContractPeriod)\
            .filter(
                ContractTenant.tenant_id == tenant_id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == 'active',
                ContractPeriod.start_date <= date.today()
            )\
            .filter(
                or_(
                    ContractPeriod.end_date.is_(None),
                    ContractPeriod.end_date >= date.today()
                )
            )\
            .first()

        if not current_contract_tenant:
            return jsonify({
                "tenant": tenant.to_dict(include_apartment=False, include_contracts=False),
                "current_contract": None,
                "is_active": False
            }), 200

        contract = db.session.query(ContractPeriod).get(current_contract_tenant.contract_period_id)
        apartment = db.session.query(Apartment).get(contract.apartment_id)

        contract_info = {
            "contract_period_id": contract.id,
            "contract_number": contract.contract_number,
            "start_date": contract.start_date.isoformat() if contract.start_date else None,
            "end_date": contract.end_date.isoformat() if contract.end_date else None,
            "monthly_rent": float(contract.monthly_rent) if contract.monthly_rent else 0,
            "is_primary": current_contract_tenant.is_primary,
            "rent_share_percentage": float(current_contract_tenant.rent_share_percentage) if current_contract_tenant.rent_share_percentage else 100.0,
            "move_in_date": current_contract_tenant.move_in_date.isoformat() if current_contract_tenant.move_in_date else None,
            "days_until_expiry": (contract.end_date - date.today()).days if contract.end_date else None,
            "status": contract.status,
            "apartment": {
                "id": apartment.id,
                "address": apartment.address,
                "rooms": apartment.rooms,
                "size": apartment.size
            } if apartment else None
        }

        return jsonify({
            "tenant": tenant.to_dict(include_apartment=False, include_contracts=False),
            "current_contract": contract_info,
            "is_active": True
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting tenant current contract: {e}")
        return jsonify({"message": "Error getting tenant current contract", "error": str(e)}), 500

# ================ HELPER FUNCTIONS ================

def is_current_contract(contract):
    """Check if this contract is currently active"""
    today = date.today()
    return (contract.start_date <= today and
            (contract.end_date is None or contract.end_date >= today) and
            contract.status == 'active')

def calculate_duration_days(contract):
    """Get the duration of the contract in days"""
    if not contract.start_date:
        return 0
    end_date = contract.end_date or date.today()
    return (end_date - contract.start_date).days

def add_tenants_to_contract(contract_id, tenant_ids, start_date=None):
    """Add multiple tenants to a contract - FIXED VERSION"""
    if not tenant_ids:
        return

    # Get the contract to use its start_date if no start_date provided
    if start_date is None:
        contract = ContractPeriod.query.get(contract_id)
        if contract and contract.start_date:
            start_date = contract.start_date
        else:
            start_date = date.today()

    # Convert string date to date object if needed
    if isinstance(start_date, str):
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            start_date = date.today()

    # Calculate equal rent share
    rent_share = 100.0 / len(tenant_ids) if len(tenant_ids) > 0 else 100.0

    for i, tenant_id in enumerate(tenant_ids):
        contract_tenant = ContractTenant(
            contract_period_id=contract_id,
            tenant_id=tenant_id,
            is_primary=(i == 0),  # First tenant is primary
            move_in_date=start_date,  # FIXED: Always provide a date
            rent_share_percentage=rent_share,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.session.add(contract_tenant)
def assign_tenants_to_contract(contract_id, tenant_ids, move_in_date=None):
    """Assign tenants to a contract period - FIXED VERSION"""
    if not tenant_ids:
        return

    # Get contract start date if move_in_date not provided
    if move_in_date is None:
        contract = ContractPeriod.query.get(contract_id)
        if contract and contract.start_date:
            move_in_date = contract.start_date
        else:
            move_in_date = date.today()

    # Convert string to date if needed
    if isinstance(move_in_date, str):
        try:
            move_in_date = datetime.strptime(move_in_date, "%Y-%m-%d").date()
        except ValueError:
            move_in_date = date.today()

    # Calculate equal rent share
    rent_share = 100.0 / len(tenant_ids)

    for tenant_id in tenant_ids:
        contract_tenant = ContractTenant(
            contract_period_id=contract_id,
            tenant_id=tenant_id,
            is_primary=False,  # All tenants equal
            move_in_date=move_in_date,  # FIXED: Always provide a valid date
            rent_share_percentage=rent_share,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.session.add(contract_tenant)


def check_overlapping_contracts(apartment_id, start_date, end_date):
    """Check if the new contract period overlaps with existing ones"""
    try:
        start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None

        query = ContractPeriod.query.filter_by(apartment_id=apartment_id)

        if end_date_obj:
            query = query.filter(
                or_(
                    and_(
                        ContractPeriod.start_date <= end_date_obj,
                        ContractPeriod.end_date.is_(None)
                    ),
                    and_(
                        ContractPeriod.start_date <= end_date_obj,
                        ContractPeriod.end_date >= start_date_obj
                    )
                )
            )
        else:
            query = query.filter(ContractPeriod.start_date >= start_date_obj)

        overlapping = query.first()

        if overlapping:
            return {
                "id": overlapping.id,
                "contract_number": overlapping.contract_number,
                "start_date": overlapping.start_date.isoformat(),
                "end_date": overlapping.end_date.isoformat() if overlapping.end_date else None
            }

        return None

    except Exception as e:
        current_app.logger.error(f"Error checking overlapping contracts: {e}")
        return None
@contract_periods_bp.route("/apartments/<int:apartment_id>/active-tenants-detailed", methods=["GET"])
@token_required
def get_active_tenants_detailed_for_apartment(apartment_id):
    """Get detailed information about currently active tenants for an apartment including gender and contract details"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get active contract tenants (not moved out) for this apartment
        active_contract_tenants = db.session.query(ContractTenant)\
            .join(ContractPeriod)\
            .join(Tenant)\
            .filter(
                ContractPeriod.apartment_id == apartment_id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == 'active'
            )\
            .order_by(ContractTenant.is_primary.desc(), ContractTenant.move_in_date.asc())\
            .all()

        active_tenants = []
        for ct in active_contract_tenants:
            tenant = ct.tenant
            contract = db.session.query(ContractPeriod).get(ct.contract_period_id)

            # Get the contract expiration date
            contract_expiry_date = contract.end_date.isoformat() if contract.end_date else None

            tenant_data = {
                "tenant_id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "phone": tenant.phone,
                "gender": tenant.gender,  # Include gender information
                "contract_tenant_id": ct.id,
                "contract_id": contract.id,
                "contract_number": contract.contract_number,
                "contract_expiry_date": contract_expiry_date,  # Add contract expiration
                "is_primary": ct.is_primary,
                "move_in_date": ct.move_in_date.isoformat() if ct.move_in_date else None,
                "move_out_date": ct.move_out_date.isoformat() if ct.move_out_date else None,
                "rent_share_percentage": float(ct.rent_share_percentage) if ct.rent_share_percentage else 100.0,
                "monthly_rent_portion": (float(contract.monthly_rent) * float(ct.rent_share_percentage) / 100.0) if contract.monthly_rent and ct.rent_share_percentage else 0,
                "notes": ct.notes
            }
            active_tenants.append(tenant_data)

        return jsonify({
            "apartment": {
                "id": apartment.id,
                "address": apartment.address
            },
            "active_tenants": active_tenants,
            "total_active": len(active_tenants),
            "total_rent_shares": sum(t["rent_share_percentage"] for t in active_tenants)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving detailed active tenants: {e}")
        return jsonify({"message": "Error retrieving detailed active tenants", "error": str(e)}), 500



@contract_periods_bp.route("/tenants/<int:tenant_id>/move-history", methods=["GET"])
@token_required
def get_tenant_move_history_enhanced(tenant_id):
    """Get complete move history for a tenant with enhanced apartment and contract details"""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Get all contract tenant records for this tenant, ordered properly
        contract_tenants = db.session.query(ContractTenant)\
            .filter(ContractTenant.tenant_id == tenant_id)\
            .order_by(
                # MySQL compatible NULL handling
                db.case(
                    (ContractTenant.move_out_date.is_(None), 0),  # Active contracts first
                    else_=1
                ),
                ContractTenant.move_out_date.desc(),
                ContractTenant.move_in_date.desc()
            )\
            .all()

        move_history = []
        summary_data = {
            "total_apartments": 0,
            "total_contracts": len(contract_tenants),
            "current_apartment": None,
            "estimated_total_rent_paid": 0,
            "is_currently_active": False
        }

        apartment_ids_seen = set()

        for ct in contract_tenants:
            # Get contract and apartment info
            contract = ContractPeriod.query.get(ct.contract_period_id)
            apartment = Apartment.query.get(contract.apartment_id) if contract else None

            # Calculate duration
            duration_days = None
            if ct.move_in_date:
                end_date = ct.move_out_date or date.today()
                duration_days = (end_date - ct.move_in_date).days

            # Determine if this is current
            is_current = not ct.move_out_date and contract and contract.status == 'active'

            history_entry = {
                "contract_tenant_id": ct.id,
                "contract_id": ct.contract_period_id,
                "contract_number": contract.contract_number if contract else f'Contract {ct.contract_period_id}',
                "apartment_id": contract.apartment_id if contract else None,
                "apartment_address": apartment.address or apartment.full_address if apartment else f'Apartment {contract.apartment_id if contract else "Unknown"}',
                "move_in_date": ct.move_in_date.isoformat() if ct.move_in_date else None,
                "move_out_date": ct.move_out_date.isoformat() if ct.move_out_date else None,
                "is_primary": ct.is_primary,
                "rent_share_percentage": float(ct.rent_share_percentage) if ct.rent_share_percentage else 100.0,
                "monthly_rent": float(contract.monthly_rent) if contract and contract.monthly_rent else 0,
                "security_deposit": float(contract.security_deposit) if contract and contract.security_deposit else 0,
                "notes": ct.notes,
                "move_out_notes": ct.move_out_notes,
                "is_current": is_current,
                "duration_days": duration_days,
                "contract_start_date": contract.start_date.isoformat() if contract and contract.start_date else None,
                "contract_end_date": contract.end_date.isoformat() if contract and contract.end_date else None,
                "contract_status": contract.status if contract else "unknown"
            }

            # Add apartment-specific details if available
            if apartment:
                history_entry.update({
                    "apartment_details": {
                        "full_address": apartment.full_address,
                        "city": apartment.city,
                        "zip_code": apartment.zip_code,
                        "country": apartment.country,
                        "building": apartment.building,
                        "floor": apartment.floor,
                        "apartment_number": apartment.apartment_number,
                        "rooms": apartment.rooms,
                        "bedrooms": apartment.bedrooms,
                        "area": float(apartment.area) if apartment.area else None,
                        "property_type": "Apartment"  # Could be enhanced with actual property type
                    }
                })

                # Track unique apartments
                if apartment.id:
                    apartment_ids_seen.add(apartment.id)

            # Update summary
            if is_current:
                summary_data["current_apartment"] = history_entry
                summary_data["is_currently_active"] = True

            # Estimate rent paid
            if duration_days and contract and contract.monthly_rent:
                months_lived = duration_days / 30.44  # Average days per month
                rent_share = (ct.rent_share_percentage or 100.0) / 100.0
                estimated_rent = float(contract.monthly_rent) * rent_share * months_lived
                summary_data["estimated_total_rent_paid"] += estimated_rent

            move_history.append(history_entry)

        summary_data["total_apartments"] = len(apartment_ids_seen)

        return jsonify({
            "tenant": {
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "phone": tenant.phone
            },
            "move_history": move_history,
            "summary": summary_data
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error retrieving tenant move history: {e}")
        return jsonify({"message": "Error retrieving tenant move history", "error": str(e)}), 500
