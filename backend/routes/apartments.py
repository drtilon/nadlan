# routes/apartments.py - UPDATED WITH LANDLORD SEMANTIC SEARCH
import json
import math
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, current_app, g, Response
from models.models import Apartment, Tenant, Landlord
from .auth import token_required, role_required
from extentions import db
from activity_logger import ActivityLogger
from typing import Tuple
from sqlalchemy import or_, asc, desc, func, distinct

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

# Constants for pagination
DEFAULT_PAGE_SIZE = 12
MAX_PAGE_SIZE = 100
PAGE_SIZE_OPTIONS = [6, 12, 24, 48]

# Status mappings for the new filter system
STATUS_MAPPING = {
    'Available': ['vacant', 'available'],
    'Occupied': ['occupied'],
    'Expiring': ['expiring_soon', 'contract_sent']  # For contracts expiring soon
}

def debug_print(message):
    """Debug printing function"""
    current_app.logger.info(f"[APARTMENTS DEBUG] {message}")


def get_expiry_status(contract_end_date):
    """Helper function to determine contract expiry status"""
    if not contract_end_date:
        return {'status': 'no_date', 'daysUntilExpiry': None}

    today = date.today()
    if isinstance(contract_end_date, str):
        try:
            contract_end_date = datetime.strptime(contract_end_date, '%Y-%m-%d').date()
        except ValueError:
            return {'status': 'invalid_date', 'daysUntilExpiry': None}

    days_until_expiry = (contract_end_date - today).days

    if days_until_expiry < 0:
        return {'status': 'expired', 'daysUntilExpiry': days_until_expiry}
    elif days_until_expiry <= 30:
        return {'status': 'expiring_soon', 'daysUntilExpiry': days_until_expiry}
    else:
        return {'status': 'valid', 'daysUntilExpiry': days_until_expiry}


def apply_filters(query, filters):
    """Apply comprehensive filters to the apartment query"""

    # Landlord text search filter - search by name or company
    if filters.get('landlord'):
        val = f"%{filters['landlord']}%"
        query = query.join(Landlord).filter(
            or_(
                Landlord.name.ilike(val),
                Landlord.company_name.ilike(val)
            )
        )

    # Location filters
    if filters.get('state'):
        query = query.filter(Apartment.state.ilike(f"%{filters['state']}%"))

    if filters.get('city'):
        query = query.filter(Apartment.city.ilike(f"%{filters['city']}%"))

    if filters.get('zip_code'):
        query = query.filter(Apartment.zip_code.ilike(f"%{filters['zip_code']}%"))

    # Gender filter
    if filters.get('gender'):
        if filters['gender'] in ['Female', 'Male']:
            gender_mapping = {'Female': 'women_only', 'Male': 'men_only'}
            query = query.filter(Apartment.genderPreference == gender_mapping[filters['gender']])
        elif filters['gender'] == 'Mixed':
            query = query.filter(Apartment.genderPreference == 'mixed')

    # Rooms filter
    if filters.get('rooms'):
        if filters['rooms'] == '5+':
            query = query.filter(Apartment.rooms >= 5)
        else:
            try:
                rooms_count = int(filters['rooms'])
                query = query.filter(Apartment.rooms == rooms_count)
            except ValueError:
                pass

    # Size filter (m²)
    if filters.get('size_range'):
        size_range = filters['size_range']
        if size_range == '<50':
            query = query.filter(Apartment.size < 50)
        elif size_range == '50–100':
            query = query.filter(Apartment.size >= 50, Apartment.size < 100)
        elif size_range == '100–150':
            query = query.filter(Apartment.size >= 100, Apartment.size < 150)
        elif size_range == '150+':
            query = query.filter(Apartment.size >= 150)

    # Floor filter
    if filters.get('floor'):
        query = query.filter(Apartment.floor == filters['floor'])

    # Status filter - enhanced to support Available/Occupied/Expiring
    if filters.get('status'):
        status = filters['status']
        if status == 'Available':
            query = query.filter(Apartment.status.in_(['vacant', 'available']))
        elif status == 'Occupied':
            query = query.filter(Apartment.status == 'occupied')
        elif status == 'Expiring':
            # For expiring, we need to check contractEndDate
            today = date.today()
            expiring_date = today + timedelta(days=30)
            query = query.filter(
                Apartment.contractEndDate.between(today, expiring_date)
            )

    return query


@apartments_bp.route("/filter-options", methods=["GET"])
@token_required
def get_filter_options() -> Tuple[Response, int]:
    """
    Get all available filter options for dropdowns
    """
    try:
        # Get all unique landlords
        landlords = db.session.query(
            Landlord.id,
            Landlord.company_name,
            Landlord.name
        ).all()

        # Get all unique states
        states = db.session.query(distinct(Apartment.state)).filter(
            Apartment.state.isnot(None)
        ).all()

        # Get all unique cities
        cities = db.session.query(distinct(Apartment.city)).filter(
            Apartment.city.isnot(None)
        ).all()

        # Get all unique zip codes
        zip_codes = db.session.query(distinct(Apartment.zip_code)).filter(
            Apartment.zip_code.isnot(None)
        ).all()

        # Get all unique floors
        floors = db.session.query(distinct(Apartment.floor)).filter(
            Apartment.floor.isnot(None)
        ).all()

        response_data = {
            "landlords": [
                {
                    "id": landlord.id,
                    "name": f"{landlord.company_name} ({landlord.name})"
                }
                for landlord in landlords
            ],
            "states": [state[0] for state in states if state[0]],
            "cities": [city[0] for city in cities if city[0]],
            "zip_codes": [zip_code[0] for zip_code in zip_codes if zip_code[0]],
            "floors": [floor[0] for floor in floors if floor[0]],
            "genders": ["Female", "Male", "Mixed"],
            "rooms": ["1", "2", "3", "4", "5+"],
            "size_ranges": ["<50", "50–100", "100–150", "150+"],
            "statuses": ["Available", "Occupied", "Expiring"]
        }

        return jsonify(response_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting filter options: {e}")
        return jsonify({"message": "Error getting filter options", "error": str(e)}), 500


@apartments_bp.route("/list", methods=["GET"])
@token_required
def list_apartments_paginated() -> Tuple[Response, int]:
    """
    Get paginated apartment list with comprehensive search, sorting, and filtering.
    Supports all the new filter dropdowns and sorting options.
    """
    try:
        # Parse pagination parameters
        page = max(0, int(request.args.get('page', 0)))
        limit = min(int(request.args.get('limit', DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE)
        offset = page * limit

        # Parse search and filter parameters
        search = request.args.get('search', '').strip()
        sort = request.args.get('sort', 'id:1')  # Default to id ascending

        # Parse sort parameter (e.g., 'expiry:1' or 'expiry:-1')
        sort_field, sort_direction = sort.split(':') if ':' in sort else (sort, '1')
        sort_direction = asc if sort_direction == '1' else desc

        # Parse comprehensive filters
        filters = {
            'landlord': request.args.get('landlord'),
            'state': request.args.get('state'),
            'city': request.args.get('city'),
            'zip_code': request.args.get('zip_code'),
            'gender': request.args.get('gender'),
            'rooms': request.args.get('rooms'),
            'size_range': request.args.get('size_range'),
            'floor': request.args.get('floor'),
            'status': request.args.get('status')
        }

        # Remove empty filters
        filters = {k: v for k, v in filters.items() if v and v.strip()}

        debug_print(f"Listing apartments: page={page}, limit={limit}, sort={sort}, search={search}, filters={filters}")

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

        # Apply comprehensive filters
        query = apply_filters(query, filters)

        # Apply sorting
        if sort_field == 'expiry':
            query = query.order_by(sort_direction(Apartment.contractEndDate))
        elif sort_field == 'address':
            query = query.order_by(sort_direction(Apartment.street_name), asc(Apartment.house_number))
        elif sort_field == 'city':
            query = query.order_by(sort_direction(Apartment.city), asc(Apartment.street_name))
        elif sort_field == 'rent':
            query = query.order_by(sort_direction(Apartment.rent))
        elif sort_field == 'status':
            query = query.order_by(sort_direction(Apartment.status))
        elif sort_field == 'landlord':
            query = query.join(Landlord).order_by(sort_direction(Landlord.company_name))
        elif sort_field == 'rooms':
            query = query.order_by(sort_direction(Apartment.rooms))
        elif sort_field == 'size':
            query = query.order_by(sort_direction(Apartment.size))
        elif sort_field == 'occupancy':
            query = query.outerjoin(Tenant).group_by(Apartment.id).order_by(sort_direction(func.count(Tenant.id)))
        else:  # default to ID
            query = query.order_by(sort_direction(Apartment.id))

        # Get total count for pagination
        total_count = query.count()

        # Apply pagination
        apartments = query.offset(offset).limit(limit).all()

        # Process apartments data with enhanced information
        apartments_data = []
        for apartment in apartments:
            apartment_dict = apartment.to_dict(
                include_landlord=True,
                include_tenants=True,
                user_role=g.user.get("role", "user")
            )

            # Add expiry status
            apartment_dict['expiryStatus'] = get_expiry_status(apartment.contractEndDate)

            # Add occupancy information
            current_tenants = apartment.tenants or []
            apartment_dict['current_tenant_count'] = len(current_tenants)
            apartment_dict['occupancy_ratio'] = f"{len(current_tenants)}/{apartment.maxOccupancy}"
            apartment_dict['is_full'] = len(current_tenants) >= apartment.maxOccupancy

            apartments_data.append(apartment_dict)

        # Calculate pagination metadata
        total_pages = math.ceil(total_count / limit) if total_count > 0 else 0
        has_next = (offset + limit) < total_count
        has_prev = page > 0

        response_data = {
            'apartments': apartments_data,
            'pagination': {
                'current_page': page + 1,  # Frontend uses 1-based indexing
                'total_pages': total_pages,
                'total_items': total_count,
                'items_per_page': limit,
                'has_next_page': has_next,
                'has_prev_page': has_prev,
                'start_index': offset + 1 if apartments_data else 0,
                'end_index': min(offset + limit, total_count),
                'page_size_options': PAGE_SIZE_OPTIONS,
            },
            'total': total_count,
            'metadata': {
                'search_term': search,
                'sort_by': sort,
                'filters': filters,
                'page_size_options': PAGE_SIZE_OPTIONS
            }
        }

        # Log activity
        ActivityLogger.log_activity(
            action="list",
            entity_type="apartment",
            details={
                "total_count": total_count,
                "page": page,
                "limit": limit,
                "search": search if search else None,
                "sort": sort,
                "filters": filters
            }
        )

        debug_print(f"Listed {len(apartments_data)} apartments, total={total_count}")
        return jsonify(response_data), 200

    except Exception as e:
        current_app.logger.error(f"Error listing apartments: {e}")
        return jsonify({"message": "Error listing apartments", "error": str(e)}), 500


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
        apartment_data.setdefault("genderPreference", "mixed")

        # Create new apartment
        apartment = Apartment(**apartment_data)
        apartment.update_full_address()

        db.session.add(apartment)
        db.session.flush()  # Get the apartment ID before committing

        # Add tenants if provided
        tenant_ids = []
        for tenant_data in tenants_data:
            tenant_data['apartment_id'] = apartment.id
            tenant = Tenant(**tenant_data)
            db.session.add(tenant)
            db.session.flush()
            tenant_ids.append(tenant.id)

        db.session.commit()

        ActivityLogger.log_apartment_action(
            action="create",
            apartment_id=apartment.id,
            details={
                "apartment_data": apartment_data,
                "tenants": tenant_ids,
                "user_role": user_role
            }
        )

        debug_print(f"Added apartment {apartment.id} with {len(tenant_ids)} tenants")
        return jsonify({"message": "Apartment added successfully", "id": apartment.id}), 201

    except Exception as e:
        current_app.logger.error(f"Error adding apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error adding apartment", "error": str(e)}), 500


@apartments_bp.route("/admin/edit/<int:apartment_id>", methods=["PUT"])
@token_required
@role_required("admin")
def admin_edit_apartment(apartment_id: int) -> Tuple[Response, int]:
    """Admin edit apartment - includes sensitive financial data"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        apartment_data = data.get("apartment", {})
        tenants_data = data.get("tenants", [])

        # Store original data for logging
        original_data = apartment.to_dict(include_tenants=True, user_role="admin")
        original_tenants = [tenant.id for tenant in apartment.tenants]

        # Update apartment fields (admin can update all fields)
        for field, value in apartment_data.items():
            if field != "id" and hasattr(apartment, field):
                setattr(apartment, field, value)

        # Update full address after changes
        apartment.update_full_address()

        # Handle tenant updates (remove old, add new)
        for tenant in apartment.tenants[:]:
            db.session.delete(tenant)

        new_tenant_ids = []
        for tenant_data in tenants_data:
            tenant_data['apartment_id'] = apartment_id
            tenant = Tenant(**tenant_data)
            db.session.add(tenant)
            db.session.flush()
            new_tenant_ids.append(tenant.id)

        db.session.commit()

        debug_print(f"Admin updated apartment {apartment_id}: {len(new_tenant_ids)} tenants")

        ActivityLogger.log_apartment_action(
            action="admin_update",
            apartment_id=apartment_id,
            details={
                "original": original_data,
                "original_tenants": original_tenants,
                "new_tenants": new_tenant_ids,
                "user_role": "admin"
            }
        )

        return jsonify({"message": "Apartment updated successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error in admin edit apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error editing apartment", "error": str(e)}), 500


@apartments_bp.route("/user/edit/<int:apartment_id>", methods=["PUT"])
@token_required
def user_edit_apartment(apartment_id: int) -> Tuple[Response, int]:
    """User edit apartment - excludes sensitive financial data"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        apartment_data = data.get("apartment", {})
        tenants_data = data.get("tenants", [])

        # Store original data for logging
        original_data = apartment.to_dict(include_tenants=True, user_role="user")
        original_tenants = [tenant.id for tenant in apartment.tenants]

        # Restricted fields that users cannot modify
        restricted_fields = ['managementFee', 'rentCost', 'model']

        # Update apartment fields (excluding sensitive ones)
        for field, value in apartment_data.items():
            if field not in restricted_fields and field != "id" and hasattr(apartment, field):
                setattr(apartment, field, value)

        # Update full address after changes
        apartment.update_full_address()

        # Handle tenant updates
        for tenant in apartment.tenants[:]:
            db.session.delete(tenant)

        new_tenant_ids = []
        for tenant_data in tenants_data:
            tenant_data['apartment_id'] = apartment_id
            tenant = Tenant(**tenant_data)
            db.session.add(tenant)
            db.session.flush()
            new_tenant_ids.append(tenant.id)

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
        apartment_data = apartment.to_dict(
            include_landlord=True,
            include_tenants=True,
            user_role=user_role
        )

        # Add expiry status
        apartment_data['expiryStatus'] = get_expiry_status(apartment.contractEndDate)

        ActivityLogger.log_apartment_action(
            action="view",
            apartment_id=apartment_id,
            details={"user_role": user_role}
        )

        return jsonify(apartment_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting apartment: {e}")
        return jsonify({"message": "Error getting apartment", "error": str(e)}), 500


@apartments_bp.route("/delete/<int:apartment_id>", methods=["DELETE"])
@token_required
@role_required("admin")
def delete_apartment(apartment_id: int) -> Tuple[Response, int]:
    """Delete apartment (admin only)"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Store data for logging before deletion
        apartment_data = apartment.to_dict(include_tenants=True, user_role="admin")

        db.session.delete(apartment)
        db.session.commit()

        ActivityLogger.log_apartment_action(
            action="delete",
            apartment_id=apartment_id,
            details={
                "deleted_apartment": apartment_data,
                "user_role": "admin"
            }
        )

        debug_print(f"Deleted apartment {apartment_id}")
        return jsonify({"message": "Apartment deleted successfully"}), 200

    except Exception as e:
        current_app.logger.error(f"Error deleting apartment: {e}")
        db.session.rollback()
        return jsonify({"message": "Error deleting apartment", "error": str(e)}), 500
