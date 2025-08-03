# routes/contract_periods.py
from flask import Blueprint, request, jsonify, current_app, g
from .auth import token_required, role_required
from extentions import db
from models.models import Apartment, Tenant, ContractPeriod, ContractTenant  # Added missing imports
from sqlalchemy import text, and_, or_
from datetime import datetime, date
from activity_logger import ActivityLogger
import json

contract_periods_bp = Blueprint("contract_periods_bp", __name__)

# ================ API ENDPOINTS ================

@contract_periods_bp.route("/apartments/<int:apartment_id>/contracts", methods=["GET"])
@token_required
def get_apartment_contracts(apartment_id):
    """Get all contract periods for a specific apartment"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        contracts = ContractPeriod.query.filter_by(apartment_id=apartment_id)\
                                       .order_by(ContractPeriod.start_date.desc())\
                                       .all()

        contracts_data = [contract.to_dict() for contract in contracts]

        # Add computed fields
        for contract_data in contracts_data:
            contract_data["is_current"] = is_current_contract(contract_data)
            contract_data["duration_days"] = calculate_duration_days(contract_data)

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
            notes=data.get("notes"),
            created_by=g.user.get("sub", "unknown")
        )

        db.session.add(contract)
        db.session.flush()  # Get the contract ID

        # Add tenants if provided
        tenant_ids = data.get("tenant_ids", [])
        if tenant_ids:
            add_tenants_to_contract(contract.id, tenant_ids)

        db.session.commit()

        # Log the action
        ActivityLogger.log_contract_action(
            action="create",
            contract_id=contract.id,
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
            "contract": contract.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating contract period: {e}")

        ActivityLogger.log_contract_action(
            action="create",
            contract_id=None,
            apartment_id=data.get("apartment_id") if data else None,
            details={"error": str(e)},
            success=False,
            error=e
        )

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

        # Store original data for logging
        original_data = contract.to_dict()

        # Update fields
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
            # Add new ones
            add_tenants_to_contract(contract_id, data["tenant_ids"])

        db.session.commit()

        # Log the update
        ActivityLogger.log_contract_action(
            action="update",
            contract_id=contract_id,
            apartment_id=contract.apartment_id,
            details={
                "original": original_data,
                "updated": contract.to_dict()
            }
        )

        return jsonify({
            "message": "Contract period updated successfully",
            "contract": contract.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating contract period: {e}")

        ActivityLogger.log_contract_action(
            action="update",
            contract_id=contract_id,
            apartment_id=contract.apartment_id if contract else None,
            details={"error": str(e)},
            success=False,
            error=e
        )

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

        # Check if there are payments associated with this contract
        payments_count = len(contract.payments) if hasattr(contract, 'payments') else 0
        if payments_count > 0:
            return jsonify({
                "message": f"Cannot delete contract with {payments_count} associated payments. Please reassign or delete payments first."
            }), 400

        # Store data for logging
        contract_data = contract.to_dict()

        db.session.delete(contract)
        db.session.commit()

        # Log the deletion
        ActivityLogger.log_contract_action(
            action="delete",
            contract_id=contract_id,
            apartment_id=contract_data["apartment_id"],
            details=contract_data
        )

        return jsonify({"message": "Contract period deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting contract period: {e}")

        ActivityLogger.log_contract_action(
            action="delete",
            contract_id=contract_id,
            apartment_id=contract.apartment_id if contract else None,
            details={"error": str(e)},
            success=False,
            error=e
        )

        return jsonify({"message": "Error deleting contract period", "error": str(e)}), 500

@contract_periods_bp.route("/contracts/<int:contract_id>/tenants", methods=["POST"])
@token_required
@role_required("admin")
def add_tenant_to_contract(contract_id):
    """Add a tenant to a contract period"""
    try:
        contract = ContractPeriod.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        data = request.get_json()
        tenant_id = data.get("tenant_id")

        if not tenant_id:
            return jsonify({"message": "tenant_id is required"}), 400

        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Check if tenant is already assigned to this contract
        existing = ContractTenant.query.filter_by(
            contract_period_id=contract_id,
            tenant_id=tenant_id
        ).first()

        if existing:
            return jsonify({"message": "Tenant is already assigned to this contract"}), 400

        # Create contract tenant assignment
        contract_tenant = ContractTenant(
            contract_period_id=contract_id,
            tenant_id=tenant_id,
            is_primary=data.get("is_primary", False),
            move_in_date=datetime.strptime(data["move_in_date"], "%Y-%m-%d").date() if data.get("move_in_date") else None,
            move_out_date=datetime.strptime(data["move_out_date"], "%Y-%m-%d").date() if data.get("move_out_date") else None,
            rent_share_percentage=float(data.get("rent_share_percentage", 100.0)),
            notes=data.get("notes")
        )

        db.session.add(contract_tenant)
        db.session.commit()

        # Log the action
        ActivityLogger.log_contract_action(
            action="add_tenant",
            contract_id=contract_id,
            apartment_id=contract.apartment_id,
            details={
                "tenant_id": tenant_id,
                "tenant_name": tenant.name,
                "is_primary": contract_tenant.is_primary,
                "rent_share_percentage": float(contract_tenant.rent_share_percentage)
            }
        )

        return jsonify({
            "message": "Tenant added to contract successfully",
            "contract_tenant": contract_tenant.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding tenant to contract: {e}")
        return jsonify({"message": "Error adding tenant to contract", "error": str(e)}), 500

@contract_periods_bp.route("/contracts/<int:contract_id>/tenants/<int:tenant_id>", methods=["DELETE"])
@token_required
@role_required("admin")
def remove_tenant_from_contract(contract_id, tenant_id):
    """Remove a tenant from a contract period"""
    try:
        contract_tenant = ContractTenant.query.filter_by(
            contract_period_id=contract_id,
            tenant_id=tenant_id
        ).first()

        if not contract_tenant:
            return jsonify({"message": "Tenant assignment not found"}), 404

        # Store data for logging
        tenant_data = contract_tenant.to_dict()

        db.session.delete(contract_tenant)
        db.session.commit()

        # Log the action
        ActivityLogger.log_contract_action(
            action="remove_tenant",
            contract_id=contract_id,
            apartment_id=contract_tenant.contract_period.apartment_id,
            details=tenant_data
        )

        return jsonify({"message": "Tenant removed from contract successfully"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error removing tenant from contract: {e}")
        return jsonify({"message": "Error removing tenant from contract", "error": str(e)}), 500

@contract_periods_bp.route("/contracts/<int:contract_id>/payments", methods=["GET"])
@token_required
def get_contract_payments(contract_id):
    """Get all payments for a specific contract period"""
    try:
        contract = ContractPeriod.query.get(contract_id)
        if not contract:
            return jsonify({"message": "Contract not found"}), 404

        # Get payments directly associated with this contract
        payments = getattr(contract, 'payments', [])

        # Also get payments within the contract date range if no direct association
        if not payments:
            from models.models import Payment
            query = Payment.query.filter_by(apartment_id=contract.apartment_id)

            if contract.end_date:
                query = query.filter(
                    and_(
                        Payment.paymentDate >= contract.start_date,
                        Payment.paymentDate <= contract.end_date
                    )
                )
            else:
                query = query.filter(Payment.paymentDate >= contract.start_date)

            payments = query.all()

        payments_data = [payment.to_dict() for payment in payments]

        return jsonify({
            "contract": contract.to_dict(),
            "payments": payments_data,
            "total_payments": len(payments_data),
            "total_amount": sum(float(p.get("amountPaid", 0)) for p in payments_data)
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching contract payments: {e}")
        return jsonify({"message": "Error fetching contract payments", "error": str(e)}), 500

# ================ HELPER FUNCTIONS ================

def is_current_contract(contract_data):
    """Check if a contract is currently active"""
    today = date.today()
    start_date = datetime.strptime(contract_data["start_date"], "%Y-%m-%d").date()
    end_date = datetime.strptime(contract_data["end_date"], "%Y-%m-%d").date() if contract_data["end_date"] else None

    is_active = today >= start_date and (end_date is None or today <= end_date)
    return is_active and contract_data["status"] == "active"

def calculate_duration_days(contract_data):
    """Calculate the duration of a contract in days"""
    start_date = datetime.strptime(contract_data["start_date"], "%Y-%m-%d").date()
    end_date = datetime.strptime(contract_data["end_date"], "%Y-%m-%d").date() if contract_data["end_date"] else date.today()

    return (end_date - start_date).days

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
