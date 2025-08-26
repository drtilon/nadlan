# routes/apartments.py - MINIMAL FIXED VERSION (Uses existing endpoints)
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, g
from models.models import Apartment, Tenant, Landlord
from .auth import token_required, role_required
from extentions import db
from activity_logger import ActivityLogger
from typing import Tuple
from flask import Response

apartments_bp = Blueprint("apartments_bp", __name__)

# Constants
APARTMENT_STATUS = {
    'VACANT': 'vacant',
    'OCCUPIED': 'occupied',
    'CONTRACT_SENT': 'contract_sent'
}

PROPERTY_MODELS = {
    'MANAGEMENT': 'management',
    'RENTAL': 'rental'
}


def debug_print(message):
    """Debug printing function"""
    current_app.logger.info(f"[APARTMENTS DEBUG] {message}")


@apartments_bp.route("/add", methods=["POST"])
@token_required
def add_apartment() -> Tuple[Response, int]:
    """Add a new apartment with tenants"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        apartment_data = data.get("new_apartment", {})
        tenants_data = data.get("new_tenants", [])

        if not apartment_data:
            return jsonify({"message": "No apartment data provided"}), 400

        # Get user role for logging
        user_role = g.user.get("role", "user")
        debug_print(f"Adding apartment with role: {user_role}")

        # Remove landlord object if it exists (we only need landlord_id)
        apartment_data.pop("landlord", None)

        # Set secure defaults for non-admin users
        if user_role != "admin":
            apartment_data["managementFee"] = 0.00
            apartment_data["rentCost"] = 0.00
            apartment_data["model"] = PROPERTY_MODELS['MANAGEMENT']

        # Ensure required fields have defaults
        apartment_data.setdefault("status", APARTMENT_STATUS['VACANT'])
        apartment_data.setdefault("maxOccupancy", 1)
        apartment_data.setdefault("genderPreference", "mixed")
        apartment_data.setdefault("country", "Israel")

        # Handle date fields
        for date_field in ['moveInDate', 'contractEndDate']:
            if date_field in apartment_data and apartment_data[date_field]:
                try:
                    apartment_data[date_field] = datetime.strptime(
                        apartment_data[date_field], '%Y-%m-%d'
                    ).date()
                except ValueError:
                    apartment_data[date_field] = None

        # Create apartment
        apartment = Apartment(**apartment_data)
        db.session.add(apartment)
        db.session.flush()  # Get the apartment ID

        # Process tenants
        tenant_ids = []
        for tenant_data in tenants_data:
            if not tenant_data.get("name"):
                continue  # Skip tenants without names

            is_existing = tenant_data.get("isExistingTenant", False)

            if is_existing and "id" in tenant_data:
                # Update existing tenant
                tenant = Tenant.query.get(tenant_data["id"])
                if tenant:
                    # Remove from previous apartment if any
                    if tenant.apartment_id:
                        debug_print(f"Moving tenant {tenant.name} from apartment {tenant.apartment_id} to {apartment.id}")

                    tenant.apartment_id = apartment.id
                    if "name" in tenant_data and tenant_data["name"]:
                        tenant.name = tenant_data["name"]
                    if "email" in tenant_data:
                        tenant.email = tenant_data["email"]
                    if "phone" in tenant_data:
                        tenant.phone = tenant_data["phone"]
                    tenant_ids.append(tenant.id)
            else:
                # Create new tenant
                new_tenant_data = {
                    "name": tenant_data.get("name", ""),
                    "email": tenant_data.get("email", ""),
                    "phone": tenant_data.get("phone", ""),
                    "bornOn": tenant_data.get("bornOn", ""),
                    "refundIban": tenant_data.get("refundIban", ""),
                    "apartment_id": apartment.id,
                }

                tenant = Tenant(**new_tenant_data)
                db.session.add(tenant)
                db.session.flush()
                tenant_ids.append(tenant.id)

        # Update apartment address
        apartment.update_full_address()
        db.session.commit()

        debug_print(f"Successfully created apartment {apartment.id} with {len(tenant_ids)} tenants")

        ActivityLogger.log_apartment_action(
            action="create",
            apartment_id=apartment.id,
            details={
                "full_address": apartment.address,
                "landlord_id": apartment.landlord_id,
                "tenants": tenant_ids,
                "created_by_role": user_role
            }
        )

        return jsonify({"message": "Apartment added successfully", "id": apartment.id}), 201

    except Exception as e:
        current_app.logger.error(f"Error adding apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error adding apartment", "error": str(e)}), 500


# ADMIN ROUTE - Full apartment editing with all fields
@apartments_bp.route("/admin/edit/<int:apartment_id>", methods=["PUT"])
@token_required
@role_required("admin")
def admin_edit_apartment(apartment_id: int) -> Tuple[Response, int]:
    """Admin-only apartment edit with access to all fields including sensitive financial data"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        apartment_data = data.get("new_apartment", {})
        tenants_data = data.get("new_tenants", [])

        if not apartment_data:
            return jsonify({"message": "No apartment data provided"}), 400

        # Remove landlord object if present
        apartment_data.pop("landlord", None)

        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Capture original data for logging
        original_data = {
            "full_address": apartment.address,
            "landlord_id": apartment.landlord_id,
            "status": apartment.status,
            "rent": float(apartment.rent) if apartment.rent else 0,
            "managementFee": float(apartment.managementFee) if apartment.managementFee else 0,
            "rentCost": float(apartment.rentCost) if apartment.rentCost else 0,
            "model": apartment.model
        }

        # Capture original tenant IDs for logging
        original_tenants = [tenant.id for tenant in apartment.tenants]

        # Clear existing tenant assignments
        for tenant in apartment.tenants:
            tenant.apartment_id = None

        # Update apartment fields (admin has access to everything)
        for field, value in apartment_data.items():
            if hasattr(apartment, field):
                if field in ['moveInDate', 'contractEndDate'] and value:
                    if isinstance(value, str):
                        try:
                            value = datetime.strptime(value, '%Y-%m-%d').date()
                        except ValueError:
                            continue
                setattr(apartment, field, value)

        # Process tenants with improved logic
        new_tenant_ids = []
        for tenant_data in tenants_data:
            if not tenant_data.get("name"):
                debug_print(f"Skipping tenant without name: {tenant_data}")
                continue

            is_existing = tenant_data.get("isExistingTenant", False)

            if is_existing and "id" in tenant_data:
                # Handle existing tenant
                tenant = Tenant.query.get(tenant_data["id"])
                if tenant:
                    debug_print(f"Updating existing tenant {tenant.id}: {tenant.name}")
                    tenant.apartment_id = apartment_id

                    # Update tenant fields if provided
                    if "name" in tenant_data and tenant_data["name"]:
                        tenant.name = tenant_data["name"]
                    if "email" in tenant_data:
                        tenant.email = tenant_data["email"]
                    if "phone" in tenant_data:
                        tenant.phone = tenant_data["phone"]

                    new_tenant_ids.append(tenant.id)
                else:
                    debug_print(f"Existing tenant {tenant_data.get('id')} not found")
            else:
                # Create new tenant
                new_tenant_data = {
                    "name": tenant_data.get("name", ""),
                    "email": tenant_data.get("email", ""),
                    "phone": tenant_data.get("phone", ""),
                    "bornOn": tenant_data.get("bornOn", ""),
                    "refundIban": tenant_data.get("refundIban", ""),
                    "apartment_id": apartment_id,
                }

                debug_print(f"Creating new tenant: {new_tenant_data['name']}")
                tenant = Tenant(**new_tenant_data)
                db.session.add(tenant)
                db.session.flush()
                new_tenant_ids.append(tenant.id)

        # Update apartment address
        apartment.update_full_address()
        db.session.commit()

        debug_print(f"Admin updated apartment {apartment_id}: {len(new_tenant_ids)} tenants")

        ActivityLogger.log_apartment_action(
            action="admin_update",
            apartment_id=apartment_id,
            details={
                "original": original_data,
                "original_tenants": original_tenants,
                "new_tenants": new_tenant_ids
            }
        )

        return jsonify({"message": "Apartment updated successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error in admin edit apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error editing apartment", "error": str(e)}), 500


# USER ROUTE - Limited apartment editing without sensitive financial data
@apartments_bp.route("/user/edit/<int:apartment_id>", methods=["PUT"])
@token_required
def user_edit_apartment(apartment_id: int) -> Tuple[Response, int]:
    """User apartment edit - excludes sensitive financial fields but allows landlord access"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        apartment_data = data.get("new_apartment", {})
        tenants_data = data.get("new_tenants", [])

        if not apartment_data:
            return jsonify({"message": "No apartment data provided"}), 400

        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Remove landlord object if present
        apartment_data.pop("landlord", None)

        # Remove sensitive fields that users shouldn't modify
        sensitive_fields = ['managementFee', 'rentCost', 'model']
        for field in sensitive_fields:
            apartment_data.pop(field, None)

        # Capture original data for logging
        original_data = {
            "full_address": apartment.address,
            "landlord_id": apartment.landlord_id,
            "status": apartment.status,
            "rent": float(apartment.rent) if apartment.rent else 0
        }

        # Capture original tenant IDs
        original_tenants = [tenant.id for tenant in apartment.tenants]

        # Clear existing tenant assignments
        for tenant in apartment.tenants:
            tenant.apartment_id = None

        # Update allowed apartment fields (including landlord_id for users)
        allowed_fields = [
            'street_name', 'house_number', 'zip_code', 'city', 'state', 'country',
            'building', 'floor', 'side', 'rooms', 'size', 'maxOccupancy',
            'rent', 'deposit', 'moveInDate', 'contractEndDate', 'notes',
            'status', 'genderPreference', 'landlord_id'  # Users CAN modify landlord
        ]

        for field, value in apartment_data.items():
            if field in allowed_fields and hasattr(apartment, field):
                if field in ['moveInDate', 'contractEndDate'] and value:
                    if isinstance(value, str):
                        try:
                            value = datetime.strptime(value, '%Y-%m-%d').date()
                        except ValueError:
                            continue
                setattr(apartment, field, value)

        # Process tenants (same logic as admin route)
        new_tenant_ids = []
        for tenant_data in tenants_data:
            if not tenant_data.get("name"):
                continue

            is_existing = tenant_data.get("isExistingTenant", False)

            if is_existing and "id" in tenant_data:
                tenant = Tenant.query.get(tenant_data["id"])
                if tenant:
                    debug_print(f"User updating existing tenant {tenant.id}: {tenant.name}")
                    tenant.apartment_id = apartment_id
                    if "name" in tenant_data and tenant_data["name"]:
                        tenant.name = tenant_data["name"]
                    if "email" in tenant_data:
                        tenant.email = tenant_data["email"]
                    if "phone" in tenant_data:
                        tenant.phone = tenant_data["phone"]

                    new_tenant_ids.append(tenant.id)
                else:
                    debug_print(f"Existing tenant {tenant_data.get('id')} not found")
            else:
                # Create new tenant
                new_tenant_data = {
                    "name": tenant_data.get("name", ""),
                    "email": tenant_data.get("email", ""),
                    "phone": tenant_data.get("phone", ""),
                    "bornOn": tenant_data.get("bornOn", ""),
                    "refundIban": tenant_data.get("refundIban", ""),
                    "apartment_id": apartment_id,
                }

                debug_print(f"User creating new tenant: {new_tenant_data['name']}")
                tenant = Tenant(**new_tenant_data)
                db.session.add(tenant)
                db.session.flush()
                new_tenant_ids.append(tenant.id)

        # Update apartment address
        apartment.update_full_address()
        db.session.commit()

        debug_print(f"User updated apartment {apartment_id}: {len(new_tenant_ids)} tenants")

        ActivityLogger.log_apartment_action(
            action="user_update",
            apartment_id=apartment_id,
            details={
                "original": original_data,
                "original_tenants": original_tenants,
                "new_tenants": new_tenant_ids,
                "user_role": "user"
            }
        )

        return jsonify({"message": "Apartment updated successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error in user edit apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error editing apartment", "error": str(e)}), 500


# LEGACY ROUTE - Redirect to appropriate endpoint based on role
@apartments_bp.route("/edit/<int:apartment_id>", methods=["PUT"])
@token_required
def edit_apartment(apartment_id: int) -> Tuple[Response, int]:
    """Legacy edit endpoint - redirects to appropriate endpoint based on user role"""
    user_role = g.user.get("role", "user")

    if user_role == "admin":
        return admin_edit_apartment(apartment_id)
    else:
        return user_edit_apartment(apartment_id)


@apartments_bp.route("/apartments/<int:apartment_id>", methods=["GET"])
@token_required
def get_apartment(apartment_id: int) -> Tuple[Response, int]:
    """Returns apartment details - sensitive financial data filtered based on user role"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        user_role = g.user.get("role", "user")

        # Get basic apartment data
        apartment_dict = {
            'id': apartment.id,
            'address': apartment.address,
            'street_name': apartment.street_name,
            'house_number': apartment.house_number,
            'zip_code': apartment.zip_code,
            'city': apartment.city,
            'state': apartment.state,
            'country': apartment.country,
            'building': apartment.building,
            'floor': apartment.floor,
            'side': apartment.side,
            'rooms': apartment.rooms,
            'size': apartment.size,
            'maxOccupancy': apartment.maxOccupancy,
            'rent': float(apartment.rent) if apartment.rent else 0,
            'deposit': float(apartment.deposit) if apartment.deposit else 0,
            'moveInDate': apartment.moveInDate.isoformat() if apartment.moveInDate else None,
            'contractEndDate': apartment.contractEndDate.isoformat() if apartment.contractEndDate else None,
            'notes': apartment.notes,
            'status': apartment.status,
            'genderPreference': apartment.genderPreference,
            'landlord_id': apartment.landlord_id,
            'created_at': apartment.created_at.isoformat() if apartment.created_at else None,
            'updated_at': apartment.updated_at.isoformat() if apartment.updated_at else None
        }

        # Add landlord information (users CAN see landlord info)
        if apartment.landlord:
            apartment_dict['landlord'] = {
                'id': apartment.landlord.id,
                'name': apartment.landlord.name,
                'company_name': apartment.landlord.company_name,
                'email': apartment.landlord.email,
                'phone': apartment.landlord.phone
            }

        # Add tenant information
        tenants_list = []
        for tenant in apartment.tenants:
            tenant_dict = {
                'id': tenant.id,
                'name': tenant.name,
                'firstName': tenant.firstName,
                'lastName': tenant.lastName,
                'email': tenant.email,
                'phone': tenant.phone,
                'bornOn': tenant.bornOn.isoformat() if tenant.bornOn else None,
                'refundIban': tenant.refundIban
            }
            tenants_list.append(tenant_dict)

        apartment_dict['tenants'] = tenants_list

        # Add sensitive financial data only for admins
        if user_role == "admin":
            apartment_dict.update({
                'managementFee': float(apartment.managementFee) if apartment.managementFee else 0,
                'rentCost': float(apartment.rentCost) if apartment.rentCost else 0,
                'model': apartment.model
            })

        return jsonify(apartment_dict), 200

    except Exception as e:
        current_app.logger.error(f"Error getting apartment: {e}")
        return jsonify({"message": "Error retrieving apartment", "error": str(e)}), 500


@apartments_bp.route("/delete/<int:apartment_id>", methods=["DELETE"])
@token_required
@role_required("admin")
def delete_apartment(apartment_id: int) -> Tuple[Response, int]:
    """Delete an apartment - admin only"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Store info for logging before deletion
        apartment_address = apartment.address
        tenant_count = len(apartment.tenants)

        # Remove tenant associations first
        for tenant in apartment.tenants:
            tenant.apartment_id = None

        # Log the deletion
        ActivityLogger.log_apartment_action(
            action="delete",
            apartment_id=apartment_id,
            details={
                "full_address": apartment_address,
                "tenant_count": tenant_count
            }
        )

        # Delete the apartment
        db.session.delete(apartment)
        db.session.commit()

        debug_print(f"Successfully deleted apartment {apartment_id}: {apartment_address}")
        return jsonify({"message": "Apartment deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error deleting apartment", "error": str(e)}), 500
