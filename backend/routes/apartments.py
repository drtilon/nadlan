import pandas as pd
from io import BytesIO
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, g, current_app, send_file, Response
from models.models import Apartment, Tenant, Landlord
from extentions import db
from typing import Tuple, List
from schemas import ApartmentData, TenantData
from flasgger import swag_from
from pydantic import ValidationError
from .auth import token_required, role_required
from activity_logger import ActivityLogger
from sqlalchemy import or_, and_, func, desc, asc, case, text
import math
from models.models import Apartment, Tenant, Landlord, ContractPeriod, ContractTenant

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
    Updated to work with contract periods system and maxOccupancy.
    """
    try:
        # Parse query parameters
        page = max(0, request.args.get("page", 0, type=int))
        limit = min(max(1, request.args.get("limit", DEFAULT_PAGE_SIZE, type=int)), MAX_PAGE_SIZE)
        search = request.args.get("search", "").strip()
        sort_by = request.args.get("sort", "expiry")
        status_filter = request.args.get("status", "").strip()

        # Calculate offset
        offset = page * limit

        # Build base query
        query = Apartment.query

        # Add user-specific filtering (if not admin)
        role = g.user.get("role", "limited")
        if role != "admin":
            # Add user-specific filtering logic here if needed
            pass

        # Apply search filter
        if search:
            query = query.filter(Apartment.address.ilike(f"%{search}%"))

        # Apply status filter
        if status_filter and status_filter != 'all':
            # Normalize status for comparison
            if status_filter.lower() in ['occupied', 'rented']:
                query = query.filter(or_(
                    Apartment.status == 'occupied',
                    Apartment.status == 'Rented'
                ))
            elif status_filter.lower() in ['vacant', 'available']:
                query = query.filter(or_(
                    Apartment.status == 'vacant',
                    Apartment.status == 'Available'
                ))
            elif status_filter.lower() in ['contract_sent', 'contract sent']:
                query = query.filter(or_(
                    Apartment.status == 'contract_sent',
                    Apartment.status == 'Contract Sent'
                ))
            else:
                query = query.filter(Apartment.status == status_filter)

        # Get total count before applying pagination
        total_count = query.count()

        # Apply sorting
        if sort_by == 'alphabetical':
            query = query.order_by(asc(Apartment.address))
        elif sort_by == 'occupancy':
            # Sort by occupancy ratio - full apartments first, then by percentage
            query = query.order_by(
                # Calculate current tenant count using a subquery
                desc(
                    func.coalesce(
                        db.session.query(func.count(Tenant.id))
                        .filter(Tenant.apartment_id == Apartment.id)
                        .scalar_subquery(),
                        0
                    ) * 100.0 / Apartment.maxOccupancy
                ),
                desc(Apartment.maxOccupancy),
                asc(Apartment.address)
            )
        elif sort_by == 'expiry':
            # Simplified sorting for expiry status using standard SQL
            today = date.today()
            thirty_days_later = today + timedelta(days=30)

            query = query.order_by(
                # Priority: expired (1), expiring soon (2), valid (3), no date (4)
                case(
                    (Apartment.contractEndDate.is_(None), 4),
                    (Apartment.contractEndDate < today, 1),
                    (Apartment.contractEndDate <= thirty_days_later, 2),
                    else_=3
                ),
                # Then by contract end date (earliest first for expired/expiring)
                asc(Apartment.contractEndDate),
                # Finally by address for consistent ordering
                asc(Apartment.address)
            )
        else:
            # Default sorting by ID
            query = query.order_by(desc(Apartment.id))

        # Apply pagination
        apartments = query.offset(offset).limit(limit).all()

        # Process apartments data with contract information
        apartments_data = []
        for apt in apartments:
            # Get current contract period
            current_contract = apt.get_current_contract()

            # Get tenants - either from current contract or legacy
            tenants = []
            if current_contract and current_contract.contract_tenants:
                tenants = [
                    {
                        "id": ct.tenant.id,
                        "name": ct.tenant.name,
                        "firstName": ct.tenant.name.split(' ')[0] if ct.tenant.name else '',
                        "lastName": ' '.join(ct.tenant.name.split(' ')[1:]) if ct.tenant.name and ' ' in ct.tenant.name else '',
                        "email": ct.tenant.email,
                        "phone": ct.tenant.phone,
                        "bornOn": ct.tenant.bornOn,
                        "refundIban": ct.tenant.refundIban,
                        "isPrimary": ct.is_primary
                    }
                    for ct in current_contract.contract_tenants
                    if ct.tenant
                ]
            else:
                # Fallback to legacy tenants
                tenants = [
                    {
                        "id": tenant.id,
                        "name": tenant.name,
                        "firstName": tenant.name.split(' ')[0] if tenant.name else '',
                        "lastName": ' '.join(tenant.name.split(' ')[1:]) if tenant.name and ' ' in tenant.name else '',
                        "email": tenant.email,
                        "phone": tenant.phone,
                        "bornOn": tenant.bornOn,
                        "refundIban": tenant.refundIban,
                        "isPrimary": False
                    }
                    for tenant in apt.tenants
                ]

            # Normalize status
            normalized_status = apt.status
            if apt.status in ['Rented']:
                normalized_status = 'occupied'
            elif apt.status in ['Available']:
                normalized_status = 'vacant'
            elif apt.status in ['Contract Sent']:
                normalized_status = 'contract_sent'

            # Calculate occupancy information
            current_tenant_count = len(tenants)
            max_occupancy = apt.maxOccupancy or 1
            occupancy_ratio = f"{current_tenant_count}/{max_occupancy}"
            is_full = current_tenant_count >= max_occupancy
            occupancy_percentage = (current_tenant_count / max_occupancy * 100) if max_occupancy > 0 else 0

            # Build apartment data
            apt_dict = {
                'id': apt.id,
                'address': apt.address,
                'rooms': apt.rooms,
                'size': apt.size,
                'maxOccupancy': max_occupancy,
                'current_tenant_count': current_tenant_count,
                'occupancy_ratio': occupancy_ratio,
                'is_full': is_full,
                'occupancy_percentage': occupancy_percentage,
                'rent': float(apt.rent) if apt.rent else 0,
                'deposit': float(apt.deposit) if apt.deposit else 0,
                'status': normalized_status,
                'displayStatus': apt.status,
                'moveInDate': apt.moveInDate.isoformat() if apt.moveInDate else None,
                'contractEndDate': apt.contractEndDate.isoformat() if apt.contractEndDate else None,
                'notes': apt.notes,
                'managementFee': float(apt.managementFee) if apt.managementFee else 0,
                'rentCost': float(apt.rentCost) if apt.rentCost else 0,
                'model': apt.model or 'management',
                'landlord_id': apt.landlord_id,
                'tenants': tenants
            }

            # Add current contract information if available
            if current_contract:
                apt_dict['current_contract'] = {
                    'id': current_contract.id,
                    'contract_number': current_contract.contract_number,
                    'start_date': current_contract.start_date.isoformat() if current_contract.start_date else None,
                    'end_date': current_contract.end_date.isoformat() if current_contract.end_date else None,
                    'monthly_rent': float(current_contract.monthly_rent) if current_contract.monthly_rent else 0,
                    'status': current_contract.status,
                    'tenants': [
                        {
                            'tenant': {
                                'id': ct.tenant.id,
                                'name': ct.tenant.name,
                                'firstName': ct.tenant.name.split(' ')[0] if ct.tenant.name else '',
                                'lastName': ' '.join(ct.tenant.name.split(' ')[1:]) if ct.tenant.name and ' ' in ct.tenant.name else '',
                                'email': ct.tenant.email,
                                'phone': ct.tenant.phone,
                                'bornOn': ct.tenant.bornOn,
                                'refundIban': ct.tenant.refundIban
                            },
                            'is_primary': ct.is_primary,
                            'rent_share_percentage': float(ct.rent_share_percentage) if ct.rent_share_percentage else 100.0
                        }
                        for ct in current_contract.contract_tenants
                        if ct.tenant
                    ]
                }

                # Override dates with contract dates if available
                if current_contract.start_date:
                    apt_dict['moveInDate'] = current_contract.start_date.isoformat()
                if current_contract.end_date:
                    apt_dict['contractEndDate'] = current_contract.end_date.isoformat()

            # Add landlord information
            if apt.landlord:
                if role == "admin":
                    apt_dict['landlord'] = {
                        'id': apt.landlord.id,
                        'name': apt.landlord.name,
                        'company_name': apt.landlord.company_name,
                        'email': apt.landlord.email,
                        'phone': apt.landlord.phone,
                        'iban': apt.landlord.iban,
                        'company_address': apt.landlord.company_address
                    }
                else:
                    # Limited info for non-admins
                    apt_dict['landlord'] = {
                        'id': apt.landlord.id,
                        'name': apt.landlord.name,
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
            'total': total_count,  # For backward compatibility
            'metadata': {
                'searchTerm': search,
                'sortBy': sort_by,
                'statusFilter': status_filter,
                'pageSizeOptions': PAGE_SIZE_OPTIONS
            }
        }

        # Log the activity (only for searches or first page loads)
        if search or page == 0:
            ActivityLogger.log_activity(
                action="list" if not search else "search",
                entity_type="apartment",
                details={
                    "search": search,
                    "sort": sort_by,
                    "status_filter": status_filter,
                    "total_found": total_count,
                    "page": page,
                    "limit": limit
                }
            )

        return jsonify(response_data), 200

    except Exception as e:
        current_app.logger.error(f"Error listing apartments: {e}")
        return jsonify({"message": "Error listing apartments", "error": str(e)}), 500


@apartments_bp.route("/search-suggestions", methods=["GET"])
@token_required
def get_search_suggestions() -> Tuple[Response, int]:
    """
    Get search suggestions for apartment addresses.

    Query parameters:
    - q: Search query (minimum 2 characters)
    """
    try:
        query = request.args.get("q", "").strip()

        if len(query) < 2:
            return jsonify([]), 200

        # Get user role for filtering
        role = g.user.get("role", "limited")

        # Build query
        suggestions_query = db.session.query(Apartment.address).distinct()

        # Add user-specific filtering if needed
        if role != "admin":
            # Add filtering logic for non-admin users if needed
            pass

        # Apply search filter
        suggestions_query = suggestions_query.filter(
            Apartment.address.ilike(f"%{query}%")
        ).order_by(Apartment.address).limit(10)

        # Execute query and extract addresses
        results = suggestions_query.all()
        suggestions = [result[0] for result in results]

        return jsonify(suggestions), 200

    except Exception as e:
        current_app.logger.error(f"Error getting search suggestions: {e}")
        return jsonify({"message": "Error getting search suggestions", "error": str(e)}), 500


@apartments_bp.route("/stats", methods=["GET"])
@token_required
def get_apartment_stats() -> Tuple[Response, int]:
    """
    Get apartment statistics for dashboard.
    """
    try:
        # Get user role for filtering
        role = g.user.get("role", "limited")

        # Build base query
        base_query = Apartment.query

        # Add user-specific filtering if needed
        if role != "admin":
            # Add filtering logic for non-admin users if needed
            pass

        # Calculate basic stats
        total_apartments = base_query.count()

        # Status distribution
        occupied_count = base_query.filter(or_(
            Apartment.status == 'occupied',
            Apartment.status == 'מושכר',
            Apartment.status == 'Rented'
        )).count()

        vacant_count = base_query.filter(or_(
            Apartment.status == 'vacant',
            Apartment.status == 'פנוי',
            Apartment.status == 'Available'
        )).count()

        # Expiry stats
        today = date.today()
        thirty_days_later = today + timedelta(days=30)

        expired_count = base_query.filter(
            and_(
                Apartment.contractEndDate.isnot(None),
                Apartment.contractEndDate < today
            )
        ).count()

        expiring_soon_count = base_query.filter(
            and_(
                Apartment.contractEndDate.isnot(None),
                Apartment.contractEndDate >= today,
                Apartment.contractEndDate <= thirty_days_later
            )
        ).count()

        # Revenue stats (only for admins)
        total_rent = 0
        if role == "admin":
            rent_sum = db.session.query(func.sum(Apartment.rent)).scalar()
            total_rent = float(rent_sum) if rent_sum else 0

        stats = {
            "total": total_apartments,
            "occupied": occupied_count,
            "vacant": vacant_count,
            "expired": expired_count,
            "expiring_soon": expiring_soon_count,
            "occupancy_rate": round((occupied_count / total_apartments * 100) if total_apartments > 0 else 0, 2)
        }

        # Add financial stats for admins only
        if role == "admin":
            stats["total_monthly_rent"] = total_rent

        return jsonify(stats), 200

    except Exception as e:
        current_app.logger.error(f"Error getting apartment stats: {e}")
        return jsonify({"message": "Error getting apartment stats", "error": str(e)}), 500


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

        # Create the apartment
        apartment = Apartment(**apartment_data)
        db.session.add(apartment)
        db.session.flush()  # Ensure apartment ID is assigned before adding tenants

        # Get tenant data
        tenants_data = data.get("new_tenants", [])
        tenant_ids = []

        # Process tenant data, handling both existing and new tenants
        for tenant_data in tenants_data:
            # Check if this is an existing tenant or a new one
            is_existing = tenant_data.get("isExistingTenant", False)
            tenant_id = tenant_data.get("id")

            if is_existing and tenant_id:
                # For existing tenants, just update the apartment_id
                existing_tenant = Tenant.query.get(tenant_id)
                if existing_tenant:
                    existing_tenant.apartment_id = apartment.id
                    tenant_ids.append(tenant_id)
                    # Log the reassignment
                    current_app.logger.info(
                        f"Reassigned existing tenant {tenant_id} to apartment {apartment.id}"
                    )
            else:
                # For new tenants, create them
                # First, remove the isExistingTenant flag as it's not a database field
                if "isExistingTenant" in tenant_data:
                    del tenant_data["isExistingTenant"]

                # Create and add the new tenant
                new_tenant = Tenant(**tenant_data, apartment_id=apartment.id)
                db.session.add(new_tenant)
                db.session.flush()  # Get the ID of the new tenant
                tenant_ids.append(new_tenant.id)
                current_app.logger.info(
                    f"Created new tenant for apartment {apartment.id}"
                )

        db.session.commit()

        # Log the activity
        ActivityLogger.log_apartment_action(
            action="create",
            apartment_id=apartment.id,
            details={
                "address": apartment.address,
                "landlord_id": apartment.landlord_id,
                "tenants": tenant_ids
            }
        )

        return jsonify({"message": "Apartment added successfully", "id": apartment.id}), 201

    except Exception as e:
        current_app.logger.error(f"Error adding apartment: {e}")
        db.session.rollback()

        # Log failure
        ActivityLogger.log_apartment_action(
            action="create",
            apartment_id=None,
            details={"error": str(e), "apartment_data": data.get("new_apartment", {})},
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

        # Capture original data for logging
        original_data = {
            "address": apartment.address,
            "landlord_id": apartment.landlord_id,
            "status": apartment.status,
            "rent": float(apartment.rent) if apartment.rent else 0
        }

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

        # Track original tenants for logging
        original_tenants = [tenant.id for tenant in Tenant.query.filter_by(apartment_id=apartment_id).all()]

        # Unassign all existing tenants from this apartment
        existing_tenants = Tenant.query.filter_by(apartment_id=apartment_id).all()
        for tenant in existing_tenants:
            tenant.apartment_id = None  # Set to NULL instead of deleting the tenant

        # Then assign the selected tenants to this apartment
        new_tenant_ids = []
        for tenant_data in tenants_data:
            tenant_id = tenant_data.get("id")

            # Fixed bug: Handle temporary IDs properly
            if tenant_id and not str(tenant_id).startswith("temp-"):
                # If tenant has an ID, find and update
                tenant = Tenant.query.get(tenant_id)
                if tenant:
                    tenant.apartment_id = apartment_id
                    new_tenant_ids.append(tenant_id)
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
                db.session.flush()  # Get the ID
                new_tenant_ids.append(tenant.id)

        db.session.commit()

        # Prepare updated data for logging
        updated_data = {
            "address": apartment.address,
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

        # Log failure
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
    try:
        apartments = Apartment.query.all()
        apartments_data = [apt.to_dict() for apt in apartments]
        df = pd.DataFrame(apartments_data)
        output = BytesIO()
        writer = pd.ExcelWriter(output, engine="xlsxwriter")
        df.to_excel(writer, index=False, sheet_name="Apartments")
        writer.close()
        output.seek(0)

        # Log export
        ActivityLogger.log_activity(
            action="export",
            entity_type="apartment",
            details={"format": "excel", "count": len(apartments_data)}
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
            "address": apartment.address,
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

        # Log failure
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
        if not data or "contractEndDate" not in data:
            return jsonify({"message": "Contract end date is required"}), 400

        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Capture original data for logging
        original_end_date = apartment.contractEndDate.isoformat() if apartment.contractEndDate else None

        # Parse and validate the new contract end date
        new_end_date_str = data["contractEndDate"]
        try:
            new_end_date = datetime.strptime(new_end_date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400

        # Validate that the new end date is in the future
        if apartment.contractEndDate and new_end_date <= apartment.contractEndDate:
            return jsonify({"message": "New end date must be later than current end date"}), 400

        # Update the contract end date
        apartment.contractEndDate = new_end_date
        db.session.commit()

        # Log the contract extension
        ActivityLogger.log_apartment_action(
            action="extend_contract",
            apartment_id=apartment_id,
            details={
                "address": apartment.address,
                "original_end_date": original_end_date,
                "new_end_date": new_end_date_str,
                "extension_days": (new_end_date - apartment.contractEndDate).days if apartment.contractEndDate else None
            }
        )

        return jsonify({
            "message": "Contract extended successfully",
            "contractEndDate": new_end_date_str
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error extending contract: {e}")
        db.session.rollback()

        # Log failure
        ActivityLogger.log_apartment_action(
            action="extend_contract",
            apartment_id=apartment_id,
            details={"error": str(e), "requested_date": data.get("contractEndDate") if data else None},
            success=False,
            error=e
        )

        return jsonify({"message": "Error extending contract", "error": str(e)}), 500


@apartments_bp.route("/apartment/<int:apartment_id>/contracts", methods=["GET"])
@token_required
def get_apartment_contracts(apartment_id: int) -> Tuple[Response, int]:
    """
    Returns all payment periods (contracts) for a specific apartment.
    Creates a fallback contract from apartment details if no explicit contracts exist.
    """
    try:
        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # For now, create a fallback contract structure based on apartment details
        # In the future, you could create a separate PaymentPeriod/Contract model
        contracts = []

        # Create current/main contract from apartment details
        if apartment.moveInDate or apartment.contractEndDate or apartment.rent:
            contract = {
                "id": "current",
                "startDate": apartment.moveInDate.isoformat() if apartment.moveInDate else None,
                "endDate": apartment.contractEndDate.isoformat() if apartment.contractEndDate else None,
                "rent": float(apartment.rent) if apartment.rent else 0
            }
            contracts.append(contract)

        # If no contracts found, create a minimal fallback
        if not contracts:
            contracts.append({
                "id": "current",
                "startDate": None,
                "endDate": None,
                "rent": 0
            })

        # Log the activity
        ActivityLogger.log_activity(
            action="view_contracts",
            entity_type="apartment",
            entity_id=apartment_id,
            details={"contract_count": len(contracts)}
        )

        return jsonify(contracts), 200

    except Exception as e:
        current_app.logger.error(f"Error getting apartment contracts: {e}")
        return jsonify({"message": "Error getting apartment contracts", "error": str(e)}), 500


@apartments_bp.route("/apartment/<int:apartment_id>/new-payment-period", methods=["POST"])
@token_required
@role_required("admin")
def create_new_payment_period(apartment_id: int) -> Tuple[Response, int]:
    """
    Creates a new payment period for an apartment.
    Updates the apartment's contract dates and rent information.
    """
    try:
        # Check if apartment exists
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Extract required fields
        start_date = data.get("start_date")
        end_date = data.get("end_date")  # Can be null for open-ended
        rent = data.get("rent")
        tenants = data.get("tenants", [])

        if not start_date or not rent:
            return jsonify({"message": "start_date and rent are required"}), 400

        # Capture original data for logging
        original_data = {
            "moveInDate": apartment.moveInDate.isoformat() if apartment.moveInDate else None,
            "contractEndDate": apartment.contractEndDate.isoformat() if apartment.contractEndDate else None,
            "rent": float(apartment.rent) if apartment.rent else 0
        }

        # Parse dates
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None
        except ValueError as e:
            return jsonify({"message": f"Invalid date format: {str(e)}"}), 400

        # Update apartment with new contract/period information
        apartment.moveInDate = start_date_obj
        apartment.contractEndDate = end_date_obj
        apartment.rent = float(rent)

        # Update tenants if provided (reassign existing tenants to this apartment)
        if tenants:
            # First, unassign current tenants
            current_tenants = Tenant.query.filter_by(apartment_id=apartment_id).all()
            for tenant in current_tenants:
                tenant.apartment_id = None

            # Then assign the specified tenants
            for tenant_name in tenants:
                # Find tenant by name (you might want to use ID instead)
                tenant = Tenant.query.filter_by(name=tenant_name).first()
                if tenant:
                    tenant.apartment_id = apartment_id

        db.session.commit()

        # Log the new payment period creation
        ActivityLogger.log_activity(
            action="create_payment_period",
            entity_type="apartment",
            entity_id=apartment_id,
            details={
                "original": original_data,
                "new": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "rent": rent,
                    "tenants": tenants
                }
            }
        )

        return jsonify({"message": "New payment period created successfully"}), 201

    except Exception as e:
        current_app.logger.error(f"Error creating new payment period: {e}")
        db.session.rollback()

        # Log failure
        ActivityLogger.log_activity(
            action="create_payment_period",
            entity_type="apartment",
            entity_id=apartment_id,
            details={"error": str(e)},
            status="failed",
            error=e
        )

        return jsonify({"message": "Error creating new payment period", "error": str(e)}), 500
@apartments_bp.route("/apartments/all", methods=["GET"])
@token_required
def get_all_apartments() -> Tuple[Response, int]:
    """
    Get all apartments without pagination - for contract manager and similar use cases.
    Returns simplified apartment data optimized for dropdowns and selection lists.
    """
    try:
        # Get optional search parameter
        search = request.args.get("search", "").strip()

        # Build base query - get only essential fields for performance
        query = db.session.query(
            Apartment.id,
            Apartment.address,
            Apartment.status
        )

        # Add user-specific filtering (if not admin)
        role = g.user.get("role", "limited")
        if role != "admin":
            # Add user-specific filtering logic here if needed
            pass

        # Apply search filter if provided
        if search:
            query = query.filter(Apartment.address.ilike(f"%{search}%"))

        # Order by address for consistent sorting
        query = query.order_by(asc(Apartment.address))

        # Execute query
        apartments = query.all()

        # Convert to simplified format
        apartments_data = []
        for apt in apartments:
            # Get basic tenant info for display
            tenants = Tenant.query.filter_by(apartment_id=apt.id).all()
            tenant_names = []

            for tenant in tenants:
                if tenant.name:
                    tenant_names.append(tenant.name)
                elif hasattr(tenant, 'first_name') and hasattr(tenant, 'last_name'):
                    full_name = f"{tenant.first_name or ''} {tenant.last_name or ''}".strip()
                    if full_name:
                        tenant_names.append(full_name)

            apartments_data.append({
                'id': apt.id,
                'address': apt.address,
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
