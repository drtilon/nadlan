# routes/contract_periods.py - FIXED VERSION
from flask import Blueprint, request, jsonify, current_app, g
from .auth import token_required, role_required
from extentions import db
from models.models import Apartment, Tenant, ContractPeriod, ContractTenant
from sqlalchemy import text, and_, or_
from datetime import datetime, date
from activity_logger import ActivityLogger
import json

contract_periods_bp = Blueprint("contract_periods_bp", __name__)

# ================ API ENDPOINTS ================

@contract_periods_bp.route("/apartments/<int:apartment_id>/contracts", methods=["GET"])
@token_required
def get_apartment_contracts(apartment_id):
    """Get all contract periods for a specific apartment - FIXED VERSION"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Query contracts with eager loading to prevent recursion
        contracts = db.session.query(ContractPeriod)\
            .filter_by(apartment_id=apartment_id)\
            .order_by(ContractPeriod.start_date.desc())\
            .all()

        # Manually build contract data to avoid recursion
        contracts_data = []
        for contract in contracts:
            # Get contract tenants with tenant info
            contract_tenants = db.session.query(ContractTenant)\
                .filter_by(contract_period_id=contract.id)\
                .all()

            # Build tenants list for this contract
            tenants_data = []
            for ct in contract_tenants:
                tenant = db.session.query(Tenant).get(ct.tenant_id)
                if tenant:
                    tenants_data.append({
                        "id": ct.id,
                        "contract_period_id": ct.contract_period_id,
                        "tenant_id": ct.tenant_id,
                        "tenant": {
                            "id": tenant.id,
                            "name": tenant.name,
                            "email": tenant.email,
                            "phone": tenant.phone
                        },
                        "is_primary": ct.is_primary,
                        "move_in_date": ct.move_in_date.isoformat() if ct.move_in_date else None,
                        "move_out_date": ct.move_out_date.isoformat() if ct.move_out_date else None,
                        "rent_share_percentage": float(ct.rent_share_percentage) if ct.rent_share_percentage else 100.0,
                        "notes": ct.notes,
                        "created_at": ct.created_at.isoformat() if ct.created_at else None
                    })

            # Build contract data
            contract_data = {
                "id": contract.id,
                "apartment_id": contract.apartment_id,
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
                "payments_count": 0  # You can add payment count logic here if needed
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
    """Create a new contract period"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Validate required fields
        required_fields = ["apartment_id", "start_date", "monthly_rent"]
        for field in required_fields:
            if field not in data:
                return jsonify({"message": f"Missing required field: {field}"}), 400

        # Check if apartment exists
        apartment = Apartment.query.get(data["apartment_id"])
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Contract number is required
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

        # Create new contract period
        contract = ContractPeriod(
            apartment_id=data["apartment_id"],
            contract_number=contract_number,
            start_date=datetime.strptime(data["start_date"], "%Y-%m-%d").date(),
            end_date=datetime.strptime(data["end_date"], "%Y-%m-%d").date() if data.get("end_date") else None,
            monthly_rent=float(data["monthly_rent"]),
            security_deposit=float(data.get("security_deposit", 0)),
            status=data.get("status", "active"),
            notes=data.get("notes", ""),
            created_by=g.current_user.username if hasattr(g, 'current_user') else None
        )

        db.session.add(contract)
        db.session.flush()  # Get the contract ID

        # Add tenants to contract if provided
        tenant_ids = data.get("tenant_ids", [])
        if tenant_ids:
            add_tenants_to_contract(contract.id, tenant_ids)

        db.session.commit()

        # Log the action
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
    """Update an existing contract period"""
    try:
        contract = ContractPeriod.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Update basic fields
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

        # Update tenants if provided
        if "tenant_ids" in data:
            # Remove existing tenant assignments
            ContractTenant.query.filter_by(contract_period_id=contract_id).delete()

            # Add new tenant assignments
            tenant_ids = data["tenant_ids"]
            if tenant_ids:
                add_tenants_to_contract(contract_id, tenant_ids)

        db.session.commit()

        # Log the action
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

        # Delete contract (cascade will handle contract_tenants)
        db.session.delete(contract)
        db.session.commit()

        # Log the action
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

def add_tenants_to_contract(contract_id, tenant_ids):
    """Add multiple tenants to a contract"""
    if not tenant_ids:
        return

    for i, tenant_id in enumerate(tenant_ids):
        contract_tenant = ContractTenant(
            contract_period_id=contract_id,
            tenant_id=tenant_id,
            is_primary=(i == 0),  # First tenant is primary
            rent_share_percentage=100.0 / len(tenant_ids)  # Equal split by default
        )
        db.session.add(contract_tenant)

def check_overlapping_contracts(apartment_id, start_date, end_date):
    """Check if the new contract period overlaps with existing ones"""
    try:
        start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None

        # Query for overlapping contracts
        query = ContractPeriod.query.filter_by(apartment_id=apartment_id)

        if end_date_obj:
            # Contract has an end date - check for any overlap
            query = query.filter(
                or_(
                    # Existing contract starts before new contract ends and has no end date
                    and_(
                        ContractPeriod.start_date <= end_date_obj,
                        ContractPeriod.end_date.is_(None)
                    ),
                    # Existing contract overlaps with new contract period
                    and_(
                        ContractPeriod.start_date <= end_date_obj,
                        ContractPeriod.end_date >= start_date_obj
                    )
                )
            )
        else:
            # New contract has no end date - check if any existing contract starts after new start date
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
