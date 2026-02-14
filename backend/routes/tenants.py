# routes/tenants.py - FIXED VERSION preserving all existing endpoints
from flask import Blueprint, jsonify, g, current_app, request, Response
from models.models import Tenant, Apartment, ContractPeriod, ContractTenant,Payment
from extentions import db
from typing import Tuple, List
from .auth import token_required, role_required
from schemas import TenantData, TenantUpdateData
from pydantic import ValidationError
from datetime import datetime, date, timedelta
from activity_logger import ActivityLogger
from sqlalchemy import func, and_, or_
import traceback
from utils.logging_helpers import log_with_user

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
            log_with_user(current_app.logger, 'error', f"Validation error adding tenant: {e}")
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
        try:
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
        except Exception as log_error:
            current_app.logger.warning(f"Failed to log activity: {log_error}")

        current_app.logger.info(f"Tenant added: {tenant.name} (ID: {tenant.id})")

        # Return tenant data as a proper dict - FIXED JSON SERIALIZATION
        return jsonify({
            "message": "Tenant added successfully",
            "tenant": {
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "phone": tenant.phone,
                "date_of_birth": tenant.date_of_birth.isoformat() if tenant.date_of_birth else None,
                "gender": tenant.gender,
                "passport_id": tenant.passport_id,
                "refund_iban": tenant.refund_iban,
                "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
                "updated_at": tenant.updated_at.isoformat() if tenant.updated_at else None
            }
        }), 201

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error adding tenant: {str(e)}")
        log_with_user(current_app.logger, 'error', f"Traceback: {traceback.format_exc()}")
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
            log_with_user(current_app.logger, 'error', f"Validation error updating tenant: {e}")
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

        # Update tenant fields
        if tenant_update_data.name:
            tenant.name = tenant_update_data.name
        if tenant_update_data.email:
            tenant.email = tenant_update_data.email
        if tenant_update_data.phone is not None:  # Allow empty string
            tenant.phone = tenant_update_data.phone
        if tenant_update_data.date_of_birth:
            tenant.date_of_birth = tenant_update_data.date_of_birth
        if tenant_update_data.refund_iban is not None:  # Allow empty string
            tenant.refund_iban = tenant_update_data.refund_iban
        if tenant_update_data.passport_id is not None:  # Allow empty string
            tenant.passport_id = tenant_update_data.passport_id
        if tenant_update_data.gender is not None:  # Allow empty string
            tenant.gender = tenant_update_data.gender

        tenant.updated_at = datetime.utcnow()

        db.session.commit()

        # Log activity
        try:
            ActivityLogger.log_activity(
                action="update",
                entity_type="tenant",
                entity_id=tenant.id,
                details={
                    "tenant_name": tenant.name,
                    "updated_fields": list(data.keys())
                }
            )
        except Exception as log_error:
            current_app.logger.warning(f"Failed to log activity: {log_error}")

        current_app.logger.info(f"Tenant updated: {tenant.name} (ID: {tenant.id})")

        # Return updated tenant data - FIXED JSON SERIALIZATION
        return jsonify({
            "message": "Tenant updated successfully",
            "tenant": {
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "phone": tenant.phone,
                "date_of_birth": tenant.date_of_birth.isoformat() if tenant.date_of_birth else None,
                "gender": tenant.gender,
                "passport_id": tenant.passport_id,
                "refund_iban": tenant.refund_iban,
                "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
                "updated_at": tenant.updated_at.isoformat() if tenant.updated_at else None
            }
        }), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error updating tenant: {str(e)}")
        log_with_user(current_app.logger, 'error', f"Traceback: {traceback.format_exc()}")
        db.session.rollback()
        return jsonify({"message": "Error updating tenant", "error": str(e)}), 500


@tenants_bp.route("/tenants/delete/<int:tenant_id>", methods=["DELETE"])
@token_required
def delete_tenant(tenant_id) -> Tuple[Response, int]:
    """
    Delete a tenant if they have no active contracts
    """
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Check if tenant has active contracts
        active_contracts = db.session.query(ContractTenant)\
            .filter(
                ContractTenant.tenant_id == tenant_id,
                ContractTenant.move_out_date.is_(None)
            ).count()

        if active_contracts > 0:
            return jsonify({
                "message": "Cannot delete tenant with active contracts. Move them out first."
            }), 400

        # Log activity before deletion
        try:
            ActivityLogger.log_activity(
                action="delete",
                entity_type="tenant",
                entity_id=tenant.id,
                details={"tenant_name": tenant.name}
            )
        except Exception as log_error:
            current_app.logger.warning(f"Failed to log activity: {log_error}")

        tenant_name = tenant.name
        db.session.delete(tenant)
        db.session.commit()

        current_app.logger.info(f"Tenant deleted: {tenant_name} (ID: {tenant_id})")
        return jsonify({"message": "Tenant deleted successfully"}), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error deleting tenant: {str(e)}")
        log_with_user(current_app.logger, 'error', f"Traceback: {traceback.format_exc()}")
        db.session.rollback()
        return jsonify({"message": "Error deleting tenant", "error": str(e)}), 500



@tenants_bp.route("/tenants/list", methods=["GET"])
@token_required
def list_tenants() -> Tuple[Response, int]:
    """
    Get list of all tenants with enhanced data including current contracts
    """
    try:
        # Get all tenants
        tenants = Tenant.query.all()

        tenants_data = []
        for tenant in tenants:
            # Get current active contracts for this tenant
            current_contracts = db.session.query(ContractTenant, ContractPeriod, Apartment)\
                .join(ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id)\
                .join(Apartment, ContractPeriod.apartment_id == Apartment.id)\
                .filter(
                    ContractTenant.tenant_id == tenant.id,
                    ContractTenant.move_out_date.is_(None)  # Still active
                ).all()

            # Transform contract data
            contract_list = []
            for contract_tenant, contract_period, apartment in current_contracts:
                contract_list.append({
                    "contract_tenant_id": contract_tenant.id,
                    "apartment_id": apartment.id,
                    "apartment_address": apartment.address,
                    "start_date": contract_period.start_date.isoformat() if contract_period.start_date else None,
                    "end_date": contract_period.end_date.isoformat() if contract_period.end_date else None,
                    "monthly_rent": float(contract_period.monthly_rent) if contract_period.monthly_rent else 0,
                    "is_primary": contract_tenant.is_primary
                })

            # Build tenant data
            tenant_data = {
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email,
                "phone": tenant.phone,
                "date_of_birth": tenant.date_of_birth.isoformat() if tenant.date_of_birth else None,
                "gender": tenant.gender,
                "passport_id": tenant.passport_id,
                "refund_iban": tenant.refund_iban,
                "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
                "updated_at": tenant.updated_at.isoformat() if tenant.updated_at else None,
                "current_contracts": contract_list
            }
            tenants_data.append(tenant_data)

        return jsonify({
            "tenants": tenants_data,
            "count": len(tenants_data)
        }), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error listing tenants: {str(e)}")
        log_with_user(current_app.logger, 'error', f"Traceback: {traceback.format_exc()}")
        return jsonify({"message": "Error listing tenants", "error": str(e)}), 500

@tenants_bp.route("/tenants/available", methods=["GET"])
@token_required
def get_available_tenants():
    """
    Get tenants that are not currently assigned to any active contract
    FIXED: Updated to use correct parameter names
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

        # Convert to dictionary format - FIXED: Using standard parameters
        tenants_data = []
        for tenant in available_tenants:
            tenant_dict = tenant.to_dict(include_contracts=True)
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
        log_with_user(current_app.logger, 'error', f"Error listing available tenants: {e}")
        return jsonify({"message": "Error listing available tenants", "error": str(e)}), 500



@tenants_bp.route("/tenants/<int:tenant_id>", methods=["GET"])
@token_required
def get_tenant_details(tenant_id):
    """Get detailed information about a specific tenant with all related data - FIXED VERSION"""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        # Get current active contracts with apartment info
        current_contracts_query = db.session.query(ContractTenant, ContractPeriod, Apartment)\
            .join(ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id)\
            .join(Apartment, ContractPeriod.apartment_id == Apartment.id)\
            .filter(
                ContractTenant.tenant_id == tenant.id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == 'active'
            ).all()

        # Get complete move history
        move_history_query = db.session.query(ContractTenant, ContractPeriod, Apartment)\
            .join(ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id)\
            .join(Apartment, ContractPeriod.apartment_id == Apartment.id)\
            .filter(ContractTenant.tenant_id == tenant.id)\
            .order_by(ContractTenant.move_in_date.desc())\
            .all()

        # Transform current contracts
        current_contracts_list = []
        for contract_tenant, contract_period, apartment in current_contracts_query:
            current_contracts_list.append({
                "contract_tenant_id": contract_tenant.id,
                "contract_period_id": contract_period.id,
                "apartment_id": apartment.id,
                "apartment_address": apartment.address or apartment.full_address or f"Apartment {apartment.id}",
                "start_date": contract_period.start_date.isoformat() if contract_period.start_date else None,
                "end_date": contract_period.end_date.isoformat() if contract_period.end_date else None,
                "monthly_rent": float(contract_period.monthly_rent) if contract_period.monthly_rent else 0,
                "security_deposit": float(contract_period.security_deposit) if contract_period.security_deposit else 0,
                "is_primary": contract_tenant.is_primary,
                "rent_share_percentage": float(contract_tenant.rent_share_percentage) if contract_tenant.rent_share_percentage else 100.0
            })

        # Transform move history
        move_history_list = []
        for contract_tenant, contract_period, apartment in move_history_query:
            move_history_list.append({
                "contract_tenant_id": contract_tenant.id,
                "contract_period_id": contract_period.id,
                "apartment_id": apartment.id,
                "apartment_address": apartment.address or apartment.full_address or f"Apartment {apartment.id}",
                "move_in_date": contract_tenant.move_in_date.isoformat() if contract_tenant.move_in_date else None,
                "move_out_date": contract_tenant.move_out_date.isoformat() if contract_tenant.move_out_date else None,
                "monthly_rent": float(contract_period.monthly_rent) if contract_period.monthly_rent else 0,
                "security_deposit": float(contract_period.security_deposit) if contract_period.security_deposit else 0,
                "is_primary": contract_tenant.is_primary,
                "rent_share_percentage": float(contract_tenant.rent_share_percentage) if contract_tenant.rent_share_percentage else 100.0,
                "is_current": contract_tenant.move_out_date is None,
                "contract_start": contract_period.start_date.isoformat() if contract_period.start_date else None,
                "contract_end": contract_period.end_date.isoformat() if contract_period.end_date else None,
                "notes": contract_tenant.notes,
                # FIXED: Use notes field instead of move_out_notes since move_out_notes doesn't exist
                "move_out_notes": contract_tenant.notes  # Use same notes field
            })

        tenant_data = {
            "id": tenant.id,
            "name": tenant.name,
            "email": tenant.email,
            "phone": tenant.phone,
            "date_of_birth": tenant.date_of_birth.isoformat() if tenant.date_of_birth else None,
            "gender": tenant.gender,
            "passport_id": tenant.passport_id,
            "refund_iban": tenant.refund_iban,
            "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
            "updated_at": tenant.updated_at.isoformat() if tenant.updated_at else None,
            "current_contracts": current_contracts_list,
            "move_history": move_history_list,
            "has_active_contract": len(current_contracts_list) > 0
        }

        return jsonify(tenant_data), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error getting tenant details: {e}")
        return jsonify({"message": "Error getting tenant details", "error": str(e)}), 500


@tenants_bp.route("/tenants/analytics", methods=["GET"])
@token_required
def get_tenant_analytics():
    """
    Get tenant analytics including total count, gender distribution, and contract status
    PRESERVED: This endpoint was in your original file
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
        log_with_user(current_app.logger, 'error', f"Error getting tenant analytics: {e}")
        return jsonify({"message": "Error getting tenant analytics", "error": str(e)}), 500


# Legacy endpoints for backward compatibility - PRESERVED
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




@tenants_bp.route("/tenants/<int:tenant_id>/payments", methods=["POST"])
@token_required
def add_tenant_payment(tenant_id):
    """Add a new payment for a tenant - FIXED VERSION"""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        data = request.get_json()
        amount = data.get('amount')
        payment_date_str = data.get('payment_date')
        description = data.get('description', 'Payment')
        method = data.get('method', 'bank_transfer')

        if not amount or float(amount) <= 0:
            return jsonify({"message": "Valid payment amount is required"}), 400

        if not payment_date_str:
            return jsonify({"message": "Payment date is required"}), 400

        try:
            payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400

        # Find tenant's current active contract
        active_contract = db.session.query(ContractTenant, ContractPeriod)\
            .join(ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id)\
            .filter(
                ContractTenant.tenant_id == tenant_id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == 'active'
            ).first()

        if not active_contract:
            return jsonify({"message": "No active contract found for tenant"}), 400

        contract_tenant, contract_period = active_contract

        # Create payment record with all the field variations your system might need
        payment = Payment(
            apartment_id=contract_period.apartment_id,
            contract_period_id=contract_period.id,
            month=payment_date.month,
            year=payment_date.year,
            amount=float(amount),
            status='PAID',
            notes=description
        )

        # Set payment_date field if it exists
        if hasattr(Payment, 'payment_date'):
            payment.payment_date = payment_date

        # Set alternative field names that might exist in your system
        if hasattr(Payment, 'paymentDate'):
            payment.paymentDate = payment_date
        if hasattr(Payment, 'paymentStatus'):
            payment.paymentStatus = 'PAID'
        if hasattr(Payment, 'paymentDescription'):
            payment.paymentDescription = description
        if hasattr(Payment, 'method'):
            payment.method = method
        if hasattr(Payment, 'paymentMethod'):
            payment.paymentMethod = method
        if hasattr(Payment, 'amountPaid'):
            payment.amountPaid = float(amount)
        if hasattr(Payment, 'amountDue'):
            payment.amountDue = float(amount)

        db.session.add(payment)
        db.session.commit()

        # Log activity
        ActivityLogger.log_activity(
            action="add_payment",
            entity_type="tenant",
            entity_id=tenant_id,
            details={
                "amount": float(amount),
                "payment_date": payment_date_str,
                "apartment_id": contract_period.apartment_id
            }
        )

        return jsonify({
            "message": "Payment added successfully",
            "payment_id": payment.id
        }), 201

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error adding payment for tenant {tenant_id}: {e}")
        db.session.rollback()
        return jsonify({"message": "Error adding payment", "error": str(e)}), 500


@tenants_bp.route("/tenants/<int:tenant_id>/transfer", methods=["POST"])
@token_required
def transfer_tenant(tenant_id):
    """Transfer a tenant to a new apartment - FIXED VERSION"""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        data = request.get_json()
        new_apartment_id = data.get('new_apartment_id')
        transfer_date_str = data.get('transfer_date')
        move_out_date_str = data.get('move_out_date')
        move_in_date_str = data.get('move_in_date')
        notes = data.get('notes', '')

        if not new_apartment_id:
            return jsonify({"message": "New apartment ID is required"}), 400

        if not transfer_date_str:
            return jsonify({"message": "Transfer date is required"}), 400

        try:
            transfer_date = datetime.strptime(transfer_date_str, '%Y-%m-%d').date()

            # FIXED: Handle move_out_date and move_in_date separately
            if move_out_date_str:
                move_out_date = datetime.strptime(move_out_date_str, '%Y-%m-%d').date()
            else:
                move_out_date = transfer_date

            if move_in_date_str:
                move_in_date = datetime.strptime(move_in_date_str, '%Y-%m-%d').date()
            else:
                move_in_date = transfer_date

        except ValueError:
            return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400

        # FIXED: Validate that move_in_date is after move_out_date
        if move_in_date <= move_out_date:
            return jsonify({"message": "Move-in date must be after move-out date"}), 400

        # Check if new apartment exists
        new_apartment = Apartment.query.get(new_apartment_id)
        if not new_apartment:
            return jsonify({"message": "New apartment not found"}), 404

        # Find tenant's current active contract
        current_contract = db.session.query(ContractTenant, ContractPeriod)\
            .join(ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id)\
            .filter(
                ContractTenant.tenant_id == tenant_id,
                ContractTenant.move_out_date.is_(None),
                ContractPeriod.status == 'active'
            ).first()

        if not current_contract:
            return jsonify({"message": "No active contract found for tenant"}), 400

        contract_tenant, contract_period = current_contract

        # Set move out date for current contract - FIXED: Use move_out_date
        contract_tenant.move_out_date = move_out_date
        # FIXED: Add transfer notes to existing notes field
        existing_notes = contract_tenant.notes or ""
        transfer_note = f"Transferred to apartment {new_apartment_id}. {notes}".strip()
        contract_tenant.notes = f"{existing_notes}\n{transfer_note}".strip() if existing_notes else transfer_note

        # Find active contract in the new apartment
        new_apartment_contract = ContractPeriod.query.filter_by(
            apartment_id=new_apartment_id,
            status='active'
        ).first()

        if not new_apartment_contract:
            return jsonify({"message": f"No active contract found in apartment {new_apartment_id}"}), 400

        # Create new contract tenant record for the new apartment - FIXED: Use move_in_date
        new_contract_tenant = ContractTenant(
            tenant_id=tenant_id,
            contract_period_id=new_apartment_contract.id,
            move_in_date=move_in_date,  # FIXED: Use the actual move_in_date
            is_primary=False,  # Default to not primary
            rent_share_percentage=100.0,  # Default percentage
            notes=f"Transferred from apartment {contract_period.apartment_id}. {notes}".strip()
        )

        db.session.add(new_contract_tenant)
        db.session.commit()

        # Log activity
        ActivityLogger.log_activity(
            action="transfer_tenant",
            entity_type="tenant",
            entity_id=tenant_id,
            details={
                "from_apartment_id": contract_period.apartment_id,
                "to_apartment_id": new_apartment_id,
                "move_out_date": move_out_date.isoformat(),
                "move_in_date": move_in_date.isoformat(),
                "transfer_date": transfer_date_str
            }
        )

        return jsonify({
            "message": "Tenant transferred successfully",
            "new_contract_tenant_id": new_contract_tenant.id,
            "move_out_date": move_out_date.isoformat(),
            "move_in_date": move_in_date.isoformat()
        }), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error transferring tenant {tenant_id}: {e}")
        db.session.rollback()
        return jsonify({"message": "Error transferring tenant", "error": str(e)}), 500

# FIXED MOVE OUT ENDPOINT
@tenants_bp.route("/tenants/<int:tenant_id>/move-out", methods=["POST"])
@token_required
def move_out_tenant(tenant_id):
    """Move out a tenant by setting their move_out_date - FIXED VERSION"""
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return jsonify({"message": "Tenant not found"}), 404

        data = request.get_json()
        move_out_date_str = data.get('move_out_date')
        notes = data.get('notes', '')

        if not move_out_date_str:
            return jsonify({"message": "Move out date is required"}), 400

        try:
            move_out_date = datetime.strptime(move_out_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400

        # Find tenant's current active contract
        current_contract = db.session.query(ContractTenant)\
            .filter(
                ContractTenant.tenant_id == tenant_id,
                ContractTenant.move_out_date.is_(None)
            ).first()

        if not current_contract:
            return jsonify({"message": "No active contract found for tenant"}), 400

        # Set move out date
        current_contract.move_out_date = move_out_date

        # FIXED: Add move out notes to existing notes field
        if notes:
            existing_notes = current_contract.notes or ""
            move_out_note = f"Moved out: {notes}"
            current_contract.notes = f"{existing_notes}\n{move_out_note}".strip() if existing_notes else move_out_note

        db.session.commit()

        # Log activity
        ActivityLogger.log_activity(
            action="move_out_tenant",
            entity_type="tenant",
            entity_id=tenant_id,
            details={
                "move_out_date": move_out_date_str,
                "contract_tenant_id": current_contract.id
            }
        )

        return jsonify({
            "message": "Tenant moved out successfully",
            "contract_tenant_id": current_contract.id
        }), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error moving out tenant {tenant_id}: {e}")
        db.session.rollback()
        return jsonify({"message": "Error processing move out", "error": str(e)}), 500
