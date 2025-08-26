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
from .contract_automation import (
    create_automatic_contract,
    update_contract_tenants,
    extend_contract_date,
    get_or_create_active_contract
)
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
    """Add a new apartment with tenants and automatically create contract period"""
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

        # Clean apartment data for date fields
        if 'moveInDate' in apartment_data:
            apartment_data['moveInDate'] = clean_date_field(apartment_data['moveInDate'])
        if 'contractEndDate' in apartment_data:
            apartment_data['contractEndDate'] = clean_date_field(apartment_data['contractEndDate'])

        # Create new apartment
        apartment = Apartment(**apartment_data)
        apartment.update_full_address()

        db.session.add(apartment)
        db.session.flush()  # Get the apartment ID before committing

        # Add tenants if provided - FIXED: Filter out frontend-only fields
        tenant_ids = []
        for tenant_data in tenants_data:
            tenant_data['apartment_id'] = apartment.id

            # FIXED: Filter out frontend-only fields that don't exist in Tenant model
            frontend_only_fields = ['isExistingTenant', 'isPrimary', 'firstName', 'lastName']
            cleaned_tenant_data = {
                key: value for key, value in tenant_data.items()
                if key not in frontend_only_fields and hasattr(Tenant, key)
            }

            # Handle date fields
            if 'bornOn' in cleaned_tenant_data:
                cleaned_tenant_data['bornOn'] = clean_date_field(cleaned_tenant_data['bornOn']) or ''

            # Ensure required fields are present
            cleaned_tenant_data.setdefault('name', '')
            cleaned_tenant_data.setdefault('email', '')
            cleaned_tenant_data.setdefault('phone', '')
            cleaned_tenant_data.setdefault('bornOn', '')
            cleaned_tenant_data.setdefault('refundIban', '')

            current_app.logger.info(f"Creating tenant with data: {cleaned_tenant_data}")

            tenant = Tenant(**cleaned_tenant_data)
            db.session.add(tenant)
            db.session.flush()
            tenant_ids.append(tenant.id)

        # AUTOMATIC CONTRACT PERIOD CREATION - NEW FEATURE
        contract_created = False
        contract_id = None
        contract_number = None

        if tenant_ids:  # Only create contract period if there are tenants
            try:
                from .contract_automation import create_automatic_contract

                contract = create_automatic_contract(
                    apartment_id=apartment.id,
                    tenant_ids=tenant_ids
                )
                if contract:
                    contract_created = True
                    contract_id = contract.id
                    contract_number = contract.contract_number

                    # Update apartment status to occupied if contract was created
                    apartment.status = APARTMENT_STATUS['OCCUPIED']

                    debug_print(f"Auto-created contract period {contract_number} for apartment {apartment.id}")
                else:
                    debug_print(f"Failed to auto-create contract period for apartment {apartment.id}")
            except ImportError:
                current_app.logger.warning("Contract automation module not found - skipping contract creation")
            except Exception as contract_error:
                # Log error but don't fail the apartment creation
                current_app.logger.error(f"Contract period auto-creation failed for apartment {apartment.id}: {contract_error}")

        db.session.commit()

        # Prepare response message
        response_message = f"Apartment added successfully"
        if contract_created:
            response_message += f" with auto-generated contract period"

        ActivityLogger.log_apartment_action(
            action="create",
            apartment_id=apartment.id,
            details={
                "apartment_data": apartment_data,
                "tenants": tenant_ids,
                "user_role": user_role,
                "contract_created": contract_created,
                "contract_id": contract_id,
                "contract_number": contract_number
            }
        )

        debug_print(f"Added apartment {apartment.id} with {len(tenant_ids)} tenants" +
                   (f" and contract period {contract_number}" if contract_created else ""))

        return jsonify({
            "message": response_message,
            "id": apartment.id,
            "contract_created": contract_created,
            "contract_id": contract_id,
            "contract_number": contract_number
        }), 201

    except Exception as e:
        current_app.logger.error(f"Error adding apartment: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"message": "Error adding apartment", "error": str(e)}), 500

def clean_date_field(value):
    """Convert empty string dates to None for database compatibility"""
    if value == '' or value is None:
        return None
    if isinstance(value, str):
        try:
            datetime.strptime(value, '%Y-%m-%d')
            return value
        except ValueError:
            return None
    return value

@apartments_bp.route("/admin/edit/<int:apartment_id>", methods=["PUT"])
@token_required
@role_required("admin")
def admin_edit_apartment(apartment_id: int) -> Tuple[Response, int]:
    """Admin edit apartment - with proper foreign key constraint handling"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        # Handle both data structures for compatibility
        apartment_data = data.get("apartment", {}) or data.get("new_apartment", {})
        tenants_data = data.get("tenants", []) or data.get("new_tenants", [])

        if not apartment_data:
            return jsonify({"message": "No apartment data provided"}), 400

        current_app.logger.info(f"Admin editing apartment {apartment_id}: {len(tenants_data)} tenants provided")

        # Store original data for logging
        original_tenants = [tenant.id for tenant in apartment.tenants]

        # Update apartment fields
        updateable_fields = [
            'street_name', 'house_number', 'zip_code', 'city', 'state', 'country',
            'building', 'floor', 'side', 'rooms', 'size', 'maxOccupancy',
            'rent', 'deposit', 'managementFee', 'rentCost', 'notes', 'status',
            'model', 'genderPreference', 'landlord_id'
        ]

        for field in updateable_fields:
            if field in apartment_data and hasattr(apartment, field):
                value = apartment_data[field]
                setattr(apartment, field, value)

        # Handle date fields separately with cleaning
        if 'moveInDate' in apartment_data:
            apartment.moveInDate = clean_date_field(apartment_data['moveInDate'])
        if 'contractEndDate' in apartment_data:
            apartment.contractEndDate = clean_date_field(apartment_data['contractEndDate'])

        # Update full address after changes
        apartment.update_full_address()

        # FIXED: Handle tenant deletion with proper foreign key constraint handling
        current_app.logger.info(f"Handling tenant updates for apartment {apartment_id}")

        # Step 1: Get existing tenant IDs for this apartment
        existing_tenant_ids = [tenant.id for tenant in apartment.tenants]
        current_app.logger.info(f"Existing tenant IDs: {existing_tenant_ids}")

        # Step 2: Delete contract_tenant assignments first (to avoid FK constraint)
        if existing_tenant_ids:
            from models.models import ContractTenant
            deleted_assignments = ContractTenant.query.filter(
                ContractTenant.tenant_id.in_(existing_tenant_ids)
            ).delete(synchronize_session=False)
            current_app.logger.info(f"Deleted {deleted_assignments} contract tenant assignments")

        # Step 3: Now delete the tenants (FK constraints are resolved)
        if existing_tenant_ids:
            deleted_tenants = Tenant.query.filter_by(apartment_id=apartment_id).delete()
            current_app.logger.info(f"Deleted {deleted_tenants} tenants")

        # Step 4: Create new tenants
        new_tenant_ids = []
        current_app.logger.info(f"Creating {len(tenants_data)} new tenants")

        for i, tenant_data in enumerate(tenants_data):
            # Clean the tenant data
            clean_tenant_data = {
                'apartment_id': apartment_id,
                'name': tenant_data.get('name', ''),
                'email': tenant_data.get('email', ''),
                'phone': tenant_data.get('phone', ''),
                'bornOn': tenant_data.get('bornOn', ''),
                'refundIban': tenant_data.get('refundIban', '')
            }

            # Create new tenant
            tenant = Tenant(**clean_tenant_data)
            db.session.add(tenant)
            db.session.flush()  # Get the ID
            new_tenant_ids.append(tenant.id)
            current_app.logger.info(f"Created tenant {tenant.id}: {tenant.name}")

        # Step 5: Commit all changes
        db.session.commit()
        current_app.logger.info(f"Successfully committed changes for apartment {apartment_id}")

        # AUTOMATIC CONTRACT PERIOD UPDATES
        contract_updated = False
        contract_number = None

        # Update contract period tenants if tenants changed
        tenants_changed = set(original_tenants) != set(new_tenant_ids)
        current_app.logger.info(f"Tenants changed: {tenants_changed}")

        if tenants_changed and new_tenant_ids:  # Only if we have tenants
            try:
                # Import here to avoid circular imports
                from .contract_automation import update_contract_tenants, get_or_create_active_contract

                current_app.logger.info("Attempting to update contract period tenants...")
                contract_updated = update_contract_tenants(apartment_id, new_tenant_ids)

                if contract_updated:
                    current_contract = get_or_create_active_contract(apartment_id, new_tenant_ids)
                    if current_contract:
                        contract_number = current_contract.contract_number
                        current_app.logger.info(f"Contract period updated: {contract_number}")

            except ImportError:
                current_app.logger.warning("Contract automation module not found - skipping contract updates")
            except Exception as contract_error:
                current_app.logger.error(f"Contract period tenant update failed: {contract_error}")

        # Prepare response message
        response_message = "Apartment updated successfully"
        if contract_updated:
            response_message += " (contract period tenants updated)"

        current_app.logger.info(f"Successfully updated apartment {apartment_id}")

        # Log activity
        ActivityLogger.log_apartment_action(
            action="admin_update",
            apartment_id=apartment_id,
            details={
                "original_tenants": original_tenants,
                "new_tenants": new_tenant_ids,
                "user_role": "admin",
                "contract_updated": contract_updated,
                "contract_number": contract_number,
                "tenants_changed": tenants_changed
            }
        )

        return jsonify({
            "message": response_message,
            "contract_updated": contract_updated,
            "contract_number": contract_number
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error in admin edit apartment: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"message": "Error editing apartment", "error": str(e)}), 500


@apartments_bp.route("/user/edit/<int:apartment_id>", methods=["PUT"])
@token_required
def user_edit_apartment(apartment_id: int) -> Tuple[Response, int]:
    """User edit apartment - with proper foreign key constraint handling"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        # Handle both data structures for compatibility
        apartment_data = data.get("apartment", {}) or data.get("new_apartment", {})
        tenants_data = data.get("tenants", []) or data.get("new_tenants", [])

        current_app.logger.info(f"User editing apartment {apartment_id}: {len(tenants_data)} tenants provided")

        # Store original data for logging
        original_tenants = [tenant.id for tenant in apartment.tenants]

        # Users can only update basic apartment info
        user_allowed_fields = [
            'street_name', 'house_number', 'zip_code', 'city', 'state', 'country',
            'building', 'floor', 'side', 'rooms', 'size', 'maxOccupancy',
            'rent', 'deposit', 'notes', 'status', 'genderPreference', 'landlord_id'
        ]

        for field in user_allowed_fields:
            if field in apartment_data and hasattr(apartment, field):
                value = apartment_data[field]
                setattr(apartment, field, value)

        # Handle date fields separately with cleaning
        if 'moveInDate' in apartment_data:
            apartment.moveInDate = clean_date_field(apartment_data['moveInDate'])
        if 'contractEndDate' in apartment_data:
            apartment.contractEndDate = clean_date_field(apartment_data['contractEndDate'])

        # Update full address after changes
        apartment.update_full_address()

        # FIXED: Handle tenant deletion with proper foreign key constraint handling
        current_app.logger.info(f"Handling tenant updates for apartment {apartment_id}")

        # Step 1: Get existing tenant IDs for this apartment
        existing_tenant_ids = [tenant.id for tenant in apartment.tenants]
        current_app.logger.info(f"Existing tenant IDs: {existing_tenant_ids}")

        # Step 2: Delete contract_tenant assignments first (to avoid FK constraint)
        if existing_tenant_ids:
            from models.models import ContractTenant
            deleted_assignments = ContractTenant.query.filter(
                ContractTenant.tenant_id.in_(existing_tenant_ids)
            ).delete(synchronize_session=False)
            current_app.logger.info(f"Deleted {deleted_assignments} contract tenant assignments")

        # Step 3: Now delete the tenants (FK constraints are resolved)
        if existing_tenant_ids:
            deleted_tenants = Tenant.query.filter_by(apartment_id=apartment_id).delete()
            current_app.logger.info(f"Deleted {deleted_tenants} tenants")

        # Step 4: Create new tenants
        new_tenant_ids = []
        current_app.logger.info(f"Creating {len(tenants_data)} new tenants")

        for tenant_data in tenants_data:
            # Clean the tenant data
            clean_tenant_data = {
                'apartment_id': apartment_id,
                'name': tenant_data.get('name', ''),
                'email': tenant_data.get('email', ''),
                'phone': tenant_data.get('phone', ''),
                'bornOn': tenant_data.get('bornOn', ''),
                'refundIban': tenant_data.get('refundIban', '')
            }

            # Create new tenant
            tenant = Tenant(**clean_tenant_data)
            db.session.add(tenant)
            db.session.flush()
            new_tenant_ids.append(tenant.id)

        # Step 5: Commit all changes
        db.session.commit()

        # AUTOMATIC CONTRACT PERIOD UPDATES
        contract_updated = False
        contract_number = None

        # Update contract period tenants if tenants changed
        tenants_changed = set(original_tenants) != set(new_tenant_ids)

        if tenants_changed and new_tenant_ids:  # Only if we have tenants
            try:
                from .contract_automation import update_contract_tenants, get_or_create_active_contract

                contract_updated = update_contract_tenants(apartment_id, new_tenant_ids)

                if contract_updated:
                    current_contract = get_or_create_active_contract(apartment_id, new_tenant_ids)
                    if current_contract:
                        contract_number = current_contract.contract_number

            except ImportError:
                current_app.logger.warning("Contract automation module not found - skipping contract updates")
            except Exception as contract_error:
                current_app.logger.error(f"Contract period tenant update failed: {contract_error}")

        # Prepare response message
        response_message = "Apartment updated successfully"
        if contract_updated:
            response_message += " (contract period tenants updated)"

        current_app.logger.info(f"Successfully updated apartment {apartment_id}")

        # Log activity
        ActivityLogger.log_apartment_action(
            action="user_update",
            apartment_id=apartment_id,
            details={
                "original_tenants": original_tenants,
                "new_tenants": new_tenant_ids,
                "user_role": "user",
                "contract_updated": contract_updated,
                "contract_number": contract_number,
                "tenants_changed": tenants_changed
            }
        )

        return jsonify({
            "message": response_message,
            "contract_updated": contract_updated,
            "contract_number": contract_number
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error in user edit apartment: {e}", exc_info=True)
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


@apartments_bp.route("/apartments/<int:apartment_id>/extend-contract", methods=["PUT"])
@token_required
@role_required("admin")
def extend_apartment_contract_period(apartment_id: int) -> Tuple[Response, int]:
    """
    Extend the contract period expiration date for an apartment
    This endpoint specifically handles contract period date extensions
    """
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400

        # Validate required fields
        new_end_date_str = data.get("new_end_date")
        if not new_end_date_str:
            return jsonify({"message": "new_end_date is required"}), 400

        # Parse the new end date
        try:
            new_end_date = datetime.strptime(new_end_date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400

        # Validate that the new date is in the future
        if new_end_date <= date.today():
            return jsonify({"message": "New end date must be in the future"}), 400

        # Get optional notes
        notes = data.get("notes", "")

        # Get current active contract period (or create one if none exists)
        from models.models import ContractPeriod
        current_contract = ContractPeriod.query.filter_by(
            apartment_id=apartment_id,
            status='active'
        ).filter(
            ContractPeriod.start_date <= date.today()
        ).filter(
            db.or_(
                ContractPeriod.end_date.is_(None),
                ContractPeriod.end_date >= date.today()
            )
        ).order_by(ContractPeriod.created_at.desc()).first()

        if not current_contract:
            return jsonify({"message": "No active contract period found"}), 404

        old_end_date = current_contract.end_date

        # Extend the contract period
        extension_successful = extend_contract_date(
            apartment_id=apartment_id,
            new_end_date=new_end_date,
            notes=f"Extended via API. {notes}".strip()
        )

        if not extension_successful:
            return jsonify({"message": "Failed to extend contract period"}), 500

        # Also update the apartment's contractEndDate for consistency
        apartment.contractEndDate = new_end_date
        db.session.commit()

        # Log the action
        ActivityLogger.log_apartment_action(
            action="extend_contract_period",
            apartment_id=apartment_id,
            details={
                "contract_number": current_contract.contract_number,
                "old_end_date": old_end_date.isoformat() if old_end_date else None,
                "new_end_date": new_end_date.isoformat(),
                "notes": notes,
                "user_role": g.user.get("role", "admin")
            }
        )

        current_app.logger.info(
            f"Contract period extended for apartment {apartment_id}: "
            f"{old_end_date} -> {new_end_date}"
        )

        return jsonify({
            "message": "Contract period extended successfully",
            "apartment_id": apartment_id,
            "contract_number": current_contract.contract_number,
            "old_end_date": old_end_date.isoformat() if old_end_date else None,
            "new_end_date": new_end_date.isoformat(),
            "extension_days": (new_end_date - (old_end_date or date.today())).days
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error extending contract period for apartment {apartment_id}: {e}")
        db.session.rollback()
        return jsonify({"message": "Error extending contract period", "error": str(e)}), 500


# Add this endpoint to get contract period information for an apartment:

@apartments_bp.route("/apartments/<int:apartment_id>/contract", methods=["GET"])
@token_required
def get_apartment_contract_period(apartment_id: int) -> Tuple[Response, int]:
    """
    Get the current active contract period for an apartment
    """
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Get current active contract period
        from models.models import ContractPeriod, ContractTenant
        current_contract = ContractPeriod.query.filter_by(
            apartment_id=apartment_id,
            status='active'
        ).filter(
            ContractPeriod.start_date <= date.today()
        ).filter(
            db.or_(
                ContractPeriod.end_date.is_(None),
                ContractPeriod.end_date >= date.today()
            )
        ).order_by(ContractPeriod.created_at.desc()).first()

        if not current_contract:
            return jsonify({
                "message": "No active contract period found",
                "has_contract": False,
                "apartment_id": apartment_id
            }), 404

        # Get contract period tenants
        contract_tenants = ContractTenant.query.filter_by(
            contract_period_id=current_contract.id
        ).all()

        tenants_data = []
        for ct in contract_tenants:
            if ct.tenant:
                tenants_data.append({
                    "id": ct.tenant.id,
                    "name": ct.tenant.name,
                    "email": ct.tenant.email,
                    "is_primary": ct.is_primary,
                    "rent_share_percentage": float(ct.rent_share_percentage) if ct.rent_share_percentage else 0.0,
                    "move_in_date": ct.move_in_date.isoformat() if ct.move_in_date else None
                })

        contract_data = {
            "id": current_contract.id,
            "contract_number": current_contract.contract_number,
            "apartment_id": current_contract.apartment_id,
            "start_date": current_contract.start_date.isoformat() if current_contract.start_date else None,
            "end_date": current_contract.end_date.isoformat() if current_contract.end_date else None,
            "monthly_rent": float(current_contract.monthly_rent) if current_contract.monthly_rent else 0,
            "security_deposit": float(current_contract.security_deposit) if current_contract.security_deposit else 0,
            "status": current_contract.status,
            "notes": current_contract.notes,
            "tenants": tenants_data,
            "has_contract": True,
            "days_until_expiry": (current_contract.end_date - date.today()).days if current_contract.end_date else None
        }

        return jsonify(contract_data), 200

    except Exception as e:
        current_app.logger.error(f"Error getting contract period for apartment {apartment_id}: {e}")
        return jsonify({"message": "Error getting contract period", "error": str(e)}), 500
