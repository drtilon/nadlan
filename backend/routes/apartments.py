# routes/apartments.py - Complete minimal file with address components support

import pandas as pd
from io import BytesIO
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, g, current_app, send_file, Response
from models.models import Apartment, Tenant, Landlord, ContractPeriod, ContractTenant
from extentions import db
from typing import Tuple, List
from schemas import ApartmentData, TenantData
from flasgger import swag_from
from pydantic import ValidationError
from .auth import token_required, role_required
from activity_logger import ActivityLogger
from sqlalchemy import or_, and_, func, desc, asc, case, text
import math

apartments_bp = Blueprint("apartments_bp", __name__)

# Constants for pagination
DEFAULT_PAGE_SIZE = 12
MAX_PAGE_SIZE = 100
PAGE_SIZE_OPTIONS = [6, 12, 24, 48]


def get_expiry_status(contract_end_date):
    """Helper function to determine contract expiry status"""
    if not contract_end_date:
        return {'status': 'no_date', 'daysUntilExpiry': None}

    today = date.today()
    if isinstance(contract_end_date, str):
        contract_end_date = datetime.strptime(contract_end_date, '%Y-%m-%d').date()

    days_until_expiry = (contract_end_date - today).days

    if days_until_expiry < 0:
        return {'status': 'expired', 'daysUntilExpiry': days_until_expiry}
    elif days_until_expiry <= 30:
        return {'status': 'expiring_soon', 'daysUntilExpiry': days_until_expiry}
    else:
        return {'status': 'valid', 'daysUntilExpiry': days_until_expiry}


@apartments_bp.route("/list", methods=["GET"])
@token_required
def list_apartments_paginated() -> Tuple[Response, int]:
    """
    Get paginated apartment list with search, sorting, and filtering.
    Updated to support new address components.
    """
    try:
        # Parse pagination parameters
        page = max(0, int(request.args.get('page', 0)))
        limit = min(int(request.args.get('limit', DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE)
        offset = page * limit

        # Parse search and filter parameters
        search = request.args.get('search', '').strip()
        sort_by = request.args.get('sortBy', 'id')
        status_filter = request.args.get('status', '')

        # Build base query
        query = Apartment.query

        # Apply search across address components
        if search:
            search_term = f'%{search}%'
            query = query.filter(
                or_(
                    Apartment.street_name.ilike(search_term),
                    Apartment.house_number.ilike(search_term),
                    Apartment.city.ilike(search_term),
                    Apartment.zip_code.ilike(search_term),
                    Apartment.country.ilike(search_term),
                    Apartment.building.ilike(search_term),
                    Apartment.full_address.ilike(search_term),
                    Apartment.notes.ilike(search_term)
                )
            )

        # Apply status filter
        if status_filter:
            query = query.filter(Apartment.status == status_filter)

        # Apply sorting
        if sort_by == 'address':
            query = query.order_by(asc(Apartment.street_name), asc(Apartment.house_number))
        elif sort_by == 'city':
            query = query.order_by(asc(Apartment.city), asc(Apartment.street_name))
        elif sort_by == 'rent':
            query = query.order_by(desc(Apartment.rent))
        elif sort_by == 'status':
            query = query.order_by(asc(Apartment.status))
        else:  # default to ID
            query = query.order_by(desc(Apartment.id))

        # Get total count for pagination
        total_count = query.count()

        # Apply pagination
        apartments = query.offset(offset).limit(limit).all()

        # Convert to dict format
        apartments_data = []
        for apt in apartments:
            apt_dict = apt.to_dict()

            # Add expiry status
            apt_dict['expiryStatus'] = get_expiry_status(apt.contractEndDate)

            # Add landlord info
            if apt.landlord:
                apt_dict['landlordName'] = apt.landlord.name
                apt_dict['landlordEmail'] = apt.landlord.email
                apt_dict['landlordPhone'] = apt.landlord.phone
                apt_dict['landlord'] = {
                    'id': apt.landlord.id,
                    'name': apt.landlord.name,
                    'email': apt.landlord.email,
                    'phone': apt.landlord.phone,
                    'company_name': apt.landlord.company_name
                }

            apartments_data.append(apt_dict)

        # Calculate pagination metadata
        total_pages = math.ceil(total_count / limit) if total_count > 0 else 0
        has_next = page < total_pages - 1
        has_prev = page > 0

        # Build response
        response_data = {
            'apartments': apartments_data,
            'pagination': {
                'currentPage': page,
                'totalPages': total_pages,
                'totalItems': total_count,
                'itemsPerPage': limit,
                'hasNextPage': has_next,
                'hasPrevPage': has_prev,
                'startIndex': offset + 1 if apartments_data else 0,
                'endIndex': min(offset + limit, total_count)
            },
            'total': total_count,
            'metadata': {
                'searchTerm': search,
                'sortBy': sort_by,
                'statusFilter': status_filter,
                'pageSizeOptions': PAGE_SIZE_OPTIONS
            }
        }

        return jsonify(response_data), 200

    except Exception as e:
        current_app.logger.error(f"Error listing apartments: {e}")
        return jsonify({"message": "Error listing apartments", "error": str(e)}), 500


@apartments_bp.route("/all", methods=["GET"])
@token_required
def list_all_apartments() -> Tuple[Response, int]:
    """
    Returns ALL apartments without pagination for dropdowns and selections.
    """
    try:
        search = request.args.get('search', '').strip()

        query = Apartment.query

        # Apply search if provided
        if search:
            search_term = f'%{search}%'
            query = query.filter(
                or_(
                    Apartment.street_name.ilike(search_term),
                    Apartment.house_number.ilike(search_term),
                    Apartment.city.ilike(search_term),
                    Apartment.zip_code.ilike(search_term),
                    Apartment.full_address.ilike(search_term)
                )
            )

        apartments = query.order_by(Apartment.street_name, Apartment.house_number).all()

        apartments_data = []
        for apt in apartments:
            tenant_names = [tenant.name for tenant in apt.tenants if tenant.name]

            apartments_data.append({
                'id': apt.id,
                'address': apt.address,  # Uses computed property
                'status': apt.status,
                'tenants': ', '.join(tenant_names) if tenant_names else 'No tenants'
            })

        # Log the activity
        ActivityLogger.log_activity(
            action="list_all",
            entity_type="apartment",
            details={
                "total_count": len(apartments_data),
                "search": search if search else None,
                "endpoint": "/apartments/all"
            }
        )

        return jsonify(apartments_data), 200

    except Exception as e:
        current_app.logger.error(f"Error listing all apartments: {e}")
        return jsonify({"message": "Error listing apartments", "error": str(e)}), 500


@apartments_bp.route("/add", methods=["POST"])
@token_required
def add_apartment_route() -> Tuple[Response, int]:
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        # Get apartment data
        apartment_data = data.get("new_apartment", {})
        if not apartment_data:
            return jsonify({"message": "No apartment data provided"}), 400

        # Validate apartment data using new schema
        try:
            validated_data = ApartmentData(**apartment_data)
        except ValidationError as e:
            return jsonify({"message": "Invalid apartment data", "errors": e.errors()}), 400

        # Create the apartment with validated data
        apartment_dict = validated_data.dict(exclude={'tenants'})
        apartment = Apartment(**apartment_dict)

        # Update full address after creation
        apartment.update_full_address()

        db.session.add(apartment)
        db.session.flush()  # Ensure apartment ID is assigned before adding tenants

        # Get tenant data
        tenants_data = data.get("new_tenants", [])
        tenant_ids = []

        # Process tenant data, handling both existing and new tenants
        for tenant_data in tenants_data:
            is_existing = tenant_data.get("isExistingTenant", False)
            tenant_id = tenant_data.get("id")

            if is_existing and tenant_id:
                # For existing tenants, just update the apartment_id
                existing_tenant = Tenant.query.get(tenant_id)
                if existing_tenant:
                    existing_tenant.apartment_id = apartment.id
                    tenant_ids.append(tenant_id)
                    current_app.logger.info(
                        f"Reassigned existing tenant {tenant_id} to apartment {apartment.id}"
                    )
            else:
                # For new tenants, create them
                if "isExistingTenant" in tenant_data:
                    del tenant_data["isExistingTenant"]

                new_tenant = Tenant(**tenant_data, apartment_id=apartment.id)
                db.session.add(new_tenant)
                db.session.flush()
                tenant_ids.append(new_tenant.id)
                current_app.logger.info(
                    f"Created new tenant for apartment {apartment.id}"
                )

        db.session.commit()

        # Log the activity with new address structure
        ActivityLogger.log_apartment_action(
            action="create",
            apartment_id=apartment.id,
            details={
                "full_address": apartment.address,
                "address_components": {
                    "street_name": apartment.street_name,
                    "house_number": apartment.house_number,
                    "city": apartment.city,
                    "zip_code": apartment.zip_code,
                    "country": apartment.country
                },
                "landlord_id": apartment.landlord_id,
                "tenants": tenant_ids
            }
        )

        return jsonify({"message": "Apartment added successfully", "id": apartment.id}), 201

    except Exception as e:
        current_app.logger.error(f"Error adding apartment: {e}")
        db.session.rollback()

        ActivityLogger.log_apartment_action(
            action="create",
            apartment_id=None,
            details={"error": str(e), "apartment_data": apartment_data},
            success=False,
            error=e
        )

        return jsonify({"message": "Error adding apartment", "error": str(e)}), 500


@apartments_bp.route("/edit/<int:apartment_id>", methods=["PUT"])
@token_required
def edit_apartment(apartment_id: int) -> Tuple[Response, int]:
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        apartment_data = data.get("new_apartment", {})
        tenants_data = data.get("new_tenants", [])

        if not apartment_data:
            return jsonify({"message": "No apartment data provided"}), 400

        # Remove nested 'landlord' field if present
        apartment_data.pop("landlord", None)

        # Get the apartment
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Capture original data for logging
        original_data = {
            "full_address": apartment.address,
            "landlord_id": apartment.landlord_id,
            "status": apartment.status,
            "rent": float(apartment.rent) if apartment.rent else 0
        }

        # Update apartment fields
        for field, value in apartment_data.items():
            if field == "moveInDate" and value:
                try:
                    apartment.moveInDate = datetime.strptime(value, "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    current_app.logger.error(f"Invalid moveInDate format: {value}")
            elif field == "contractEndDate" and value:
                try:
                    apartment.contractEndDate = datetime.strptime(value, "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    current_app.logger.error(f"Invalid contractEndDate format: {value}")
            elif field != "tenants" and hasattr(apartment, field):
                setattr(apartment, field, value)

        # Update full address after field changes
        apartment.update_full_address()

        # Handle tenant updates
        original_tenants = [tenant.id for tenant in Tenant.query.filter_by(apartment_id=apartment_id).all()]

        # Unassign all existing tenants from this apartment
        existing_tenants = Tenant.query.filter_by(apartment_id=apartment_id).all()
        for tenant in existing_tenants:
            tenant.apartment_id = None

        # Assign selected tenants to this apartment
        new_tenant_ids = []
        for tenant_data in tenants_data:
            tenant_id = tenant_data.get("id")

            if tenant_id and not str(tenant_id).startswith("temp-"):
                # Existing tenant
                tenant = Tenant.query.get(tenant_id)
                if tenant:
                    tenant.apartment_id = apartment_id
                    new_tenant_ids.append(tenant_id)
            else:
                # New tenant
                new_tenant_data = {
                    "name": tenant_data.get("name", ""),
                    "email": tenant_data.get("email", ""),
                    "phone": tenant_data.get("phone", ""),
                    "bornOn": tenant_data.get("bornOn", ""),
                    "refundIban": tenant_data.get("refundIban", ""),
                    "apartment_id": apartment_id,
                }

                tenant = Tenant(**new_tenant_data)
                db.session.add(tenant)
                db.session.flush()
                new_tenant_ids.append(tenant.id)

        db.session.commit()

        # Prepare updated data for logging
        updated_data = {
            "full_address": apartment.address,
            "landlord_id": apartment.landlord_id,
            "status": apartment.status,
            "rent": float(apartment.rent) if apartment.rent else 0,
            "original_tenants": original_tenants,
            "new_tenants": new_tenant_ids
        }

        # Log the update
        ActivityLogger.log_apartment_action(
            action="update",
            apartment_id=apartment_id,
            details={
                "original": original_data,
                "updated": updated_data,
                "changed_fields": [k for k, v in apartment_data.items() if k in original_data and original_data[k] != v]
            }
        )

        return jsonify({"message": "Apartment updated successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error editing apartment: {e}")
        db.session.rollback()

        ActivityLogger.log_apartment_action(
            action="update",
            apartment_id=apartment_id,
            details={"error": str(e)},
            success=False,
            error=e
        )

        return jsonify({"message": "Error editing apartment", "error": str(e)}), 500


@apartments_bp.route("/export", methods=["GET"])
@token_required
@role_required("admin")
def export_excel() -> Tuple[Response, int]:
    """
    Export apartments to Excel with new address structure.
    """
    try:
        apartments = Apartment.query.all()

        # Prepare data for export with address components
        export_data = []
        for apt in apartments:
            export_row = {
                'id': apt.id,
                'full_address': apt.address,
                'street_name': apt.street_name,
                'house_number': apt.house_number,
                'zip_code': apt.zip_code,
                'city': apt.city,
                'state': apt.state,
                'country': apt.country,
                'building': apt.building,
                'floor': apt.floor,
                'side': apt.side,
                'rooms': apt.rooms,
                'size': apt.size,
                'maxOccupancy': apt.maxOccupancy,
                'rent': apt.rent,
                'deposit': apt.deposit,
                'status': apt.status,
                'model': apt.model,
                'landlord_name': apt.landlord.name if apt.landlord else 'No Landlord',
                'tenant_count': len(apt.tenants),
                'tenant_names': ', '.join([t.name for t in apt.tenants]),
                'notes': apt.notes
            }
            export_data.append(export_row)

        df = pd.DataFrame(export_data)
        output = BytesIO()
        writer = pd.ExcelWriter(output, engine="xlsxwriter")
        df.to_excel(writer, index=False, sheet_name="Apartments")
        writer.close()
        output.seek(0)

        # Log export
        ActivityLogger.log_activity(
            action="export",
            entity_type="apartment",
            details={"format": "excel", "count": len(export_data)}
        )

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

        # Capture data for logging before deletion
        apartment_data = {
            "id": apartment.id,
            "full_address": apartment.address,
            "address_components": {
                "street_name": apartment.street_name,
                "house_number": apartment.house_number,
                "city": apartment.city,
                "zip_code": apartment.zip_code
            },
            "landlord_id": apartment.landlord_id,
            "tenants": [tenant.id for tenant in apartment.tenants]
        }

        db.session.delete(apartment)
        db.session.commit()

        # Log deletion
        ActivityLogger.log_apartment_action(
            action="delete",
            apartment_id=apartment_id,
            details=apartment_data
        )

        return jsonify({"message": "Apartment deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting apartment: {e}")
        db.session.rollback()

        ActivityLogger.log_apartment_action(
            action="delete",
            apartment_id=apartment_id,
            details={"error": str(e)},
            success=False,
            error=e
        )

        return jsonify({"message": "Error deleting apartment", "error": str(e)}), 500


@apartments_bp.route("/apartments/<int:apartment_id>/extend-contract", methods=["PUT"])
@token_required
def extend_contract(apartment_id: int) -> Tuple[Response, int]:
    """
    Extend the contract end date for a specific apartment.
    """
    try:
        data = request.get_json()
        if not data or 'contractEndDate' not in data:
            return jsonify({"message": "Missing contractEndDate"}), 400

        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Parse and update contract end date
        try:
            new_end_date = datetime.strptime(data['contractEndDate'], '%Y-%m-%d').date()
            old_end_date = apartment.contractEndDate
            apartment.contractEndDate = new_end_date
            db.session.commit()

            # Log the extension
            ActivityLogger.log_apartment_action(
                action="extend_contract",
                apartment_id=apartment_id,
                details={
                    "full_address": apartment.address,
                    "old_end_date": old_end_date.isoformat() if old_end_date else None,
                    "new_end_date": new_end_date.isoformat()
                }
            )

            return jsonify({"message": "Contract extended successfully"}), 200

        except ValueError:
            return jsonify({"message": "Invalid date format"}), 400

    except Exception as e:
        current_app.logger.error(f"Error extending contract: {e}")
        db.session.rollback()
        return jsonify({"message": "Error extending contract", "error": str(e)}), 500
