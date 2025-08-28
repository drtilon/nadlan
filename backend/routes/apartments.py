# routes/apartments.py - MINIMAL FIX: Only remove contractEndDate references
from flask import Blueprint, jsonify, request, current_app, g
from models.models import Apartment, Tenant, Landlord, ContractPeriod, ContractTenant, Payment
from extentions import db
from .auth import token_required, role_required
from datetime import datetime, date, timedelta
from sqlalchemy import func, or_, and_, desc, asc, case, text
from sqlalchemy.orm import joinedload
from activity_logger import ActivityLogger
import traceback
import math
from typing import List
from .contract_automation import generate_contract_number, create_automatic_contract
import json
apartments_bp = Blueprint("apartments", __name__)


@apartments_bp.route("/list", methods=["GET"])
@token_required
def list_apartments():
    """List apartments with pagination, comprehensive filtering, and complete sorting support - MINIMAL FIX for contractEndDate"""
    try:
        # Get pagination parameters
        page = int(request.args.get("page", 0))
        limit = int(request.args.get("limit", 50))

        # Get search parameter
        search = request.args.get("search", "").strip()

        # Get ALL filter parameters
        landlord = request.args.get("landlord", "").strip()
        city = request.args.get("city", "").strip()
        state = request.args.get("state", "").strip()
        zip_code = request.args.get("zip_code", "").strip()
        rooms = request.args.get("rooms", "").strip()
        size_range = request.args.get("size_range", "").strip()
        status = request.args.get("status", "").strip()
        gender = request.args.get("gender", "").strip()
        floor = request.args.get("floor", "").strip()

        # Get sorting parameter
        sort = request.args.get("sort", "address:1")

        # Check if user is admin
        is_admin = g.user.get("role") == "admin"

        current_app.logger.info(f"Apartment list request - Page: {page}, Limit: {limit}, Search: '{search}', Sort: '{sort}'")
        current_app.logger.info(f"Filters - landlord: {landlord}, city: {city}, state: {state}, zip_code: {zip_code}, rooms: {rooms}, size_range: {size_range}, status: {status}, gender: {gender}, floor: {floor}")

        # Start with base query including landlord join
        query = db.session.query(Apartment).outerjoin(Landlord)

        # Apply search filter - enhanced to search more fields
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Apartment.address.ilike(search_pattern),
                    Apartment.street_name.ilike(search_pattern),
                    Apartment.city.ilike(search_pattern),
                    Apartment.state.ilike(search_pattern),
                    Apartment.zip_code.ilike(search_pattern),
                    Apartment.building.ilike(search_pattern),
                    Apartment.side.ilike(search_pattern),
                    Apartment.notes.ilike(search_pattern),
                    Landlord.name.ilike(search_pattern),
                    Landlord.company_name.ilike(search_pattern)
                )
            )

        # Apply ALL filters with proper handling
        if landlord:
            query = query.filter(
                or_(
                    Landlord.name.ilike(f"%{landlord}%"),
                    Landlord.company_name.ilike(f"%{landlord}%")
                )
            )

        if city:
            query = query.filter(Apartment.city.ilike(f"%{city}%"))

        if state:
            query = query.filter(Apartment.state.ilike(f"%{state}%"))

        if zip_code:
            query = query.filter(Apartment.zip_code.ilike(f"%{zip_code}%"))

        if rooms:
            try:
                rooms_int = int(rooms)
                query = query.filter(
                    or_(
                        Apartment.rooms == rooms_int,
                        Apartment.bedrooms == rooms_int
                    )
                )
            except ValueError:
                current_app.logger.warning(f"Invalid rooms filter: {rooms}")

        if size_range:
            try:
                # Handle size ranges like "50-100"
                if "-" in size_range:
                    min_size, max_size = map(float, size_range.split("-", 1))
                    query = query.filter(
                        and_(
                            Apartment.area >= min_size,
                            Apartment.area <= max_size
                        )
                    )
                else:
                    # Single size value
                    size_value = float(size_range)
                    query = query.filter(Apartment.area == size_value)
            except ValueError:
                current_app.logger.warning(f"Invalid size range: {size_range}")

        if gender:
            query = query.filter(Apartment.genderPreference.ilike(f"%{gender}%"))

        if floor:
            try:
                floor_int = int(floor)
                query = query.filter(Apartment.floor == floor_int)
            except ValueError:
                # Handle non-numeric floors
                query = query.filter(Apartment.floor.ilike(f"%{floor}%"))

        # Handle status filter - account for occupied/vacant based on contracts
        if status:
            if status.lower() == "occupied":
                # Check for active contract periods
                subquery = db.session.query(ContractPeriod).filter(
                    and_(
                        ContractPeriod.apartment_id == Apartment.id,
                        ContractPeriod.status == 'active',
                        or_(
                            ContractPeriod.end_date.is_(None),
                            ContractPeriod.end_date >= datetime.now().date()
                        )
                    )
                ).exists()
                query = query.filter(subquery)
            elif status.lower() == "vacant":
                # Check for NO active contract periods
                subquery = db.session.query(ContractPeriod).filter(
                    and_(
                        ContractPeriod.apartment_id == Apartment.id,
                        ContractPeriod.status == 'active',
                        or_(
                            ContractPeriod.end_date.is_(None),
                            ContractPeriod.end_date >= datetime.now().date()
                        )
                    )
                ).exists()
                query = query.filter(~subquery)
            else:
                # Direct status match
                query = query.filter(Apartment.status.ilike(f"%{status}%"))

        # COMPREHENSIVE SORTING - FIXED to remove contractEndDate references
        sort_field = "address"
        sort_direction = "1"

        if ":" in sort:
            sort_field, sort_direction = sort.split(":", 1)

        # Determine sort order
        is_desc = sort_direction == "-1"

        current_app.logger.info(f"Sorting by: {sort_field}, Direction: {'DESC' if is_desc else 'ASC'}")

        # Apply comprehensive sorting with proper NULL handling
        if sort_field in ["address", "street_name"]:
            query = query.order_by(
                func.coalesce(Apartment.street_name, Apartment.address, '').desc() if is_desc
                else func.coalesce(Apartment.street_name, Apartment.address, '').asc()
            )

        elif sort_field == "rent":
            query = query.order_by(
                func.coalesce(Apartment.rent, 0).desc() if is_desc
                else func.coalesce(Apartment.rent, 0).asc()
            )

        elif sort_field in ["size", "area"]:
            query = query.order_by(
                func.coalesce(Apartment.area, 0).desc() if is_desc
                else func.coalesce(Apartment.area, 0).asc()
            )

        elif sort_field in ["rooms", "bedrooms"]:
            query = query.order_by(
                func.coalesce(Apartment.bedrooms, Apartment.rooms, 0).desc() if is_desc
                else func.coalesce(Apartment.bedrooms, Apartment.rooms, 0).asc()
            )

        elif sort_field == "floor":
            # Handle both numeric and string floors
            query = query.order_by(
                func.coalesce(Apartment.floor, 0).desc() if is_desc
                else func.coalesce(Apartment.floor, 0).asc()
            )

        elif sort_field == "city":
            query = query.order_by(
                func.coalesce(Apartment.city, '').desc() if is_desc
                else func.coalesce(Apartment.city, '').asc()
            )

        elif sort_field == "status":
            query = query.order_by(
                func.coalesce(Apartment.status, '').desc() if is_desc
                else func.coalesce(Apartment.status, '').asc()
            )

        elif sort_field == "landlord":
            query = query.order_by(
                func.coalesce(Landlord.name, Landlord.company_name, '').desc() if is_desc
                else func.coalesce(Landlord.name, Landlord.company_name, '').asc()
            )

        elif sort_field in ["tenant_count", "tenants"]:
            # Subquery to count current tenants per apartment
            tenant_count_subquery = (
                db.session.query(func.count(ContractTenant.id))
                .join(ContractPeriod, ContractTenant.contract_period_id == ContractPeriod.id)
                .filter(
                    and_(
                        ContractPeriod.apartment_id == Apartment.id,
                        ContractPeriod.status == 'active',
                        or_(
                            ContractPeriod.end_date.is_(None),
                            ContractPeriod.end_date >= datetime.now().date()
                        ),
                        or_(
                            ContractTenant.move_out_date.is_(None),
                            ContractTenant.move_out_date >= datetime.now().date()
                        )
                    )
                ).as_scalar()
            )

            query = query.order_by(tenant_count_subquery.desc() if is_desc else tenant_count_subquery.asc())

        elif sort_field in ["expiry", "contract_end", "contractEndDate"]:
            # FIXED: Only use ContractPeriod.end_date (removed Apartment.contractEndDate reference)
            query = query.outerjoin(ContractPeriod).order_by(
                func.coalesce(ContractPeriod.end_date, date(2099, 12, 31)).desc() if is_desc
                else func.coalesce(ContractPeriod.end_date, date(1900, 1, 1)).asc()
            )

        else:
            # Default to address sorting if unknown sort field
            current_app.logger.warning(f"Unknown sort field: {sort_field}, defaulting to address")
            query = query.order_by(
                func.coalesce(Apartment.street_name, Apartment.address, '').desc() if is_desc
                else func.coalesce(Apartment.street_name, Apartment.address, '').asc()
            )

        # Get total count before pagination
        total = query.count()

        # Apply pagination
        offset = page * limit
        apartments = query.offset(offset).limit(limit).all()

        current_app.logger.info(f"Retrieved {len(apartments)} apartments (Total: {total})")

        # Build enhanced response with all data needed for the frontend
        apartments_data = []
        for apt in apartments:
            # Get current contract and tenants
            current_contracts = apt.get_current_contract_periods()
            current_tenants = apt.get_current_tenants()

            # Determine actual status based on current occupancy
            actual_status = "occupied" if current_tenants else "vacant"

            # Enhanced apartment dictionary with ALL needed data
            apt_dict = {
                "id": apt.id,

                # Address information (both legacy and component format)
                "address": apt.address or f"{apt.street_name or ''} {apt.house_number or ''}".strip() or "No Address",
                "street_name": apt.street_name or "",
                "house_number": apt.house_number or "",
                "zip_code": apt.zip_code or "",
                "city": apt.city or "",
                "state": apt.state or "",
                "country": apt.country or "Israel",
                "building": apt.building or "",
                "floor": apt.floor,
                "side": apt.side or "",

                # Property details with fallbacks
                "rooms": apt.bedrooms or apt.rooms or 0,
                "bedrooms": apt.bedrooms or apt.rooms or 0,
                "size": float(apt.area) if apt.area else 0,  # Frontend expects 'size'
                "area": float(apt.area) if apt.area else 0,   # Also include 'area' as fallback
                "rent": float(apt.rent) if apt.rent else 0,
                "deposit": float(apt.deposit) if apt.deposit else 0,

                # NEW FINANCIAL FIELDS - with defaults
                "managementFee": float(apt.managementFee) if apt.managementFee else 0.0,
                "rentCost": float(apt.rentCost) if apt.rentCost else 0.0,
                "model": apt.model or "rental",

                # Occupancy and status
                "maxOccupancy": apt.maxOccupancy or 4,
                "genderPreference": apt.genderPreference or "mixed",
                "status": actual_status,  # Use computed status
                "original_status": apt.status,  # Keep original for reference

                # Tenant information
                "current_tenant_count": len(current_tenants),
                "is_full": len(current_tenants) >= (apt.maxOccupancy or 4),
                "tenants": [{"id": t.id, "name": t.name, "phone": t.phone, "email": t.email} for t in current_tenants],

                # Contract information - USING ContractPeriod data only
                "contract_count": len(current_contracts),
                "contractEndDate": current_contracts[0].end_date.isoformat() if current_contracts and current_contracts[0].end_date else None,
                "has_active_contracts": len(current_contracts) > 0,

                # LANDLORD INFORMATION - Frontend expects this format
                "landlord_id": apt.landlord_id,
                "landlord": {
                    "id": apt.landlord.id if apt.landlord else None,
                    "name": apt.landlord.name if apt.landlord else "",
                    "company_name": apt.landlord.company_name if apt.landlord else "",
                    "email": apt.landlord.email if apt.landlord else "",
                    "phone": apt.landlord.phone if apt.landlord else ""
                } if apt.landlord else None,

                # Metadata
                "notes": apt.notes or "",
                "created_at": apt.created_at.isoformat() if apt.created_at else None,
                "updated_at": apt.updated_at.isoformat() if apt.updated_at else None,
            }

            apartments_data.append(apt_dict)

        return jsonify({
            "apartments": apartments_data,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": math.ceil(total / limit) if limit > 0 else 1,
            "pagination": {
                "currentPage": page,
                "totalPages": math.ceil(total / limit) if limit > 0 else 1,
                "totalItems": total,
                "itemsPerPage": limit
            },
            "sort": {
                "field": sort_field,
                "direction": sort_direction,
                "applied": sort
            },
            "filters_applied": {
                "landlord": landlord,
                "city": city,
                "state": state,
                "zip_code": zip_code,
                "rooms": rooms,
                "size_range": size_range,
                "status": status,
                "gender": gender,
                "floor": floor,
                "search": search
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error listing apartments: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to list apartments", "details": str(e)}), 500


@apartments_bp.route("/filter-options", methods=["GET"])
@token_required
def get_filter_options():
    """Get filter options for ApartmentFilters.jsx - Enhanced with more options"""
    try:
        # Get unique values from database with proper NULL handling
        cities = db.session.query(Apartment.city).distinct().filter(Apartment.city.isnot(None), Apartment.city != '').all()
        states = db.session.query(Apartment.state).distinct().filter(Apartment.state.isnot(None), Apartment.state != '').all()
        floors = db.session.query(Apartment.floor).distinct().filter(Apartment.floor.isnot(None)).all()
        zip_codes = db.session.query(Apartment.zip_code).distinct().filter(Apartment.zip_code.isnot(None), Apartment.zip_code != '').all()

        # Get landlord info
        landlords = db.session.query(Landlord.name, Landlord.company_name).distinct().all()
        landlord_options = []
        for landlord in landlords:
            if landlord.name:
                landlord_options.append(landlord.name)
            if landlord.company_name and landlord.company_name != landlord.name:
                landlord_options.append(landlord.company_name)

        # Get room counts
        room_counts = db.session.query(Apartment.bedrooms).distinct().filter(Apartment.bedrooms.isnot(None)).all()
        room_counts_legacy = db.session.query(Apartment.rooms).distinct().filter(Apartment.rooms.isnot(None)).all()
        all_room_counts = set([r[0] for r in room_counts] + [r[0] for r in room_counts_legacy])

        return jsonify({
            "cities": sorted([city[0] for city in cities if city[0]]),
            "states": sorted([state[0] for state in states if state[0]]),
            "floors": sorted([str(floor[0]) for floor in floors if floor[0] is not None]),
            "zip_codes": sorted([zip_code[0] for zip_code in zip_codes if zip_code[0]]),
            "landlords": sorted(list(set(landlord_options))),
            "rooms": sorted([str(r) for r in all_room_counts if r is not None]),
            "statuses": ["vacant", "occupied", "contract_sent"],
            "genders": ["mixed", "male", "female"],
            "size_ranges": ["0-30", "30-50", "50-80", "80-120", "120+"]
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error getting filter options: {e}")
        return jsonify({"error": "Failed to get filter options", "details": str(e)}), 500


# routes/apartments.py - FIXED VERSION with landlord_id and automatic contract creation

@apartments_bp.route("apartments/add", methods=["POST"])
@token_required
def add_apartment():
    """Add apartment route - FIXED with landlord_id and automatic contract creation"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        # Extract apartment and tenant data
        new_apartment_data = data.get("new_apartment", {})
        new_tenants = data.get("new_tenants", [])

        # Check if user is admin
        is_admin = g.user.get("role") == "admin"

        # FIXED: Create apartment with ALL required fields including landlord_id
        # Handle numeric fields properly - convert empty strings to None
        def safe_numeric(value):
            if value is None or value == '' or value == 0:
                return None
            try:
                return float(value)
            except (ValueError, TypeError):
                return None

        apartment_fields = {
            "street_name": new_apartment_data.get("street_name"),
            "house_number": new_apartment_data.get("house_number"),
            "city": new_apartment_data.get("city"),
            "zip_code": new_apartment_data.get("zip_code"),
            "floor": new_apartment_data.get("floor") or None,  # Handle empty strings
            "bedrooms": new_apartment_data.get("rooms"),
            "area": safe_numeric(new_apartment_data.get("size")),  # FIXED: Handle empty size
            "rent": new_apartment_data.get("rent"),
            "deposit": new_apartment_data.get("deposit", 0),
            "maxOccupancy": new_apartment_data.get("maxOccupancy"),
            "genderPreference": new_apartment_data.get("genderPreference"),
            "state": new_apartment_data.get("state") or None,  # Handle empty strings
            "notes": new_apartment_data.get("notes", ""),
            # FIXED: Add landlord_id - THIS WAS MISSING!
            "landlord_id": new_apartment_data.get("landlord_id")
        }

        # Extract date fields for contract creation (NOT for apartment)
        move_in_date = None
        move_out_date = None

        if "moveInDate" in new_apartment_data and new_apartment_data["moveInDate"]:
            try:
                move_in_date = datetime.strptime(new_apartment_data["moveInDate"], "%Y-%m-%d").date()
            except ValueError:
                move_in_date = date.today()

        if "moveOutDate" in new_apartment_data and new_apartment_data["moveOutDate"]:
            try:
                move_out_date = datetime.strptime(new_apartment_data["moveOutDate"], "%Y-%m-%d").date()
            except ValueError:
                pass

        # Admin-only financial fields
        if is_admin:
            apartment_fields.update({
                "model": new_apartment_data.get("model", "rental"),
                "managementFee": safe_numeric(new_apartment_data.get("managementFee")),
                "rentCost": safe_numeric(new_apartment_data.get("rentCost"))
            })

        # Create apartment
        apartment = Apartment(**apartment_fields)

        # FIXED: Build address from components
        if apartment.street_name or apartment.house_number or apartment.city:
            address_parts = []
            if apartment.street_name:
                address_parts.append(apartment.street_name)
            if apartment.house_number:
                address_parts.append(apartment.house_number)
            if apartment.city:
                if address_parts:
                    address_parts.append(f", {apartment.city}")
                else:
                    address_parts.append(apartment.city)
            apartment.address = " ".join(address_parts) if address_parts else ""

        db.session.add(apartment)
        db.session.flush()  # Get apartment ID

        # FIXED: Create tenants and collect IDs properly
        tenant_ids = []
        for tenant_data in new_tenants:
            if tenant_data.get("name"):
                tenant = Tenant(
                    name=tenant_data["name"],
                    phone=tenant_data.get("phone"),
                    email=tenant_data.get("email"),
                    date_of_birth=tenant_data.get("date_of_birth"),
                    refund_iban=tenant_data.get("refund_iban"),
                    passport_id=tenant_data.get("passport_id"),
                    gender=tenant_data.get("gender")
                )
                db.session.add(tenant)
                db.session.flush()
                tenant_ids.append(tenant.id)

        # FIXED: ALWAYS create automatic contract when apartment is created (with or without tenants)
        current_app.logger.info(f"Creating automatic contract for apartment {apartment.id}")

        # Use the existing contract automation function
        from .contract_automation import create_automatic_contract

        contract = create_automatic_contract(
            apartment_id=apartment.id,
            tenant_ids=tenant_ids if tenant_ids else [],
            start_date=move_in_date if move_in_date else date.today(),
            end_date=move_out_date,  # This can be None
            security_deposit=apartment.deposit
        )

        if contract:
            current_app.logger.info(f"Successfully created contract {contract.contract_number} for apartment {apartment.id}")
        else:
            current_app.logger.warning(f"Failed to create automatic contract for apartment {apartment.id}")

        db.session.commit()

        # Log the activity
        ActivityLogger.log_apartment_action(apartment.id, g.user.get("username"))

        return jsonify({
            "message": "Apartment added successfully with automatic contract creation",
            "apartment_id": apartment.id,
            "contract_created": contract is not None,
            "contract_number": contract.contract_number if contract else None
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding apartment: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@apartments_bp.route("apartments/edit/<int:apartment_id>", methods=["PUT"])
@token_required
def edit_apartment(apartment_id):
    """Edit apartment - regular user version - FIXED"""
    return edit_apartment_common(apartment_id, is_admin=False)


@apartments_bp.route("apartments/edit-admin/<int:apartment_id>", methods=["PUT"])
@token_required
@role_required("admin")
def edit_apartment_admin(apartment_id):
    """Edit apartment - admin version - FIXED"""
    return edit_apartment_common(apartment_id, is_admin=True)

def edit_apartment_common(apartment_id, is_admin=False):
    """
    FIXED Common edit logic for both admin and user
    Handles the fact that Tenant model doesn't have apartment_id column
    """
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"error": "Apartment not found"}), 404

        data = request.get_json()
        new_apartment_data = data.get("new_apartment", {})
        new_tenants = data.get("new_tenants", [])

        print(f"Editing apartment {apartment_id}, is_admin: {is_admin}")
        print(f"Received data: {json.dumps(new_apartment_data, indent=2)}")

        # FIXED: Update ALL apartment fields - Basic fields for everyone
        if "street_name" in new_apartment_data:
            apartment.street_name = new_apartment_data["street_name"]
        if "house_number" in new_apartment_data:
            apartment.house_number = new_apartment_data["house_number"]
        if "city" in new_apartment_data:
            apartment.city = new_apartment_data["city"]
        if "zip_code" in new_apartment_data:
            apartment.zip_code = new_apartment_data["zip_code"]
        if "state" in new_apartment_data:
            apartment.state = new_apartment_data["state"]
        if "country" in new_apartment_data:
            apartment.country = new_apartment_data["country"]
        if "building" in new_apartment_data:
            apartment.building = new_apartment_data["building"]
        if "floor" in new_apartment_data:
            apartment.floor = new_apartment_data["floor"]
        if "side" in new_apartment_data:
            apartment.side = new_apartment_data["side"]

        # FIXED: Property details - handle both 'rooms' and 'bedrooms'
        if "rooms" in new_apartment_data:
            apartment.bedrooms = new_apartment_data["rooms"]
            # Also set the legacy 'rooms' field if it exists
            if hasattr(apartment, 'rooms'):
                apartment.rooms = new_apartment_data["rooms"]

        # FIXED: Handle 'size' -> 'area' mapping
        if "size" in new_apartment_data:
            apartment.area = new_apartment_data["size"]

        # FIXED: Other basic fields that everyone can edit
        if "rent" in new_apartment_data:
            apartment.rent = new_apartment_data["rent"]
        if "deposit" in new_apartment_data:
            apartment.deposit = new_apartment_data["deposit"]
        if "maxOccupancy" in new_apartment_data:
            apartment.maxOccupancy = new_apartment_data["maxOccupancy"]
        if "genderPreference" in new_apartment_data:
            apartment.genderPreference = new_apartment_data["genderPreference"]
        if "status" in new_apartment_data:
            apartment.status = new_apartment_data["status"]
        if "notes" in new_apartment_data:
            apartment.notes = new_apartment_data["notes"]

        # FIXED: Landlord can be edited by ALL users (not admin-only)
        if "landlord_id" in new_apartment_data:
            apartment.landlord_id = new_apartment_data["landlord_id"]
            print(f"Set landlord_id to: {apartment.landlord_id}")

        # FIXED: Handle date fields properly
        if "moveInDate" in new_apartment_data and new_apartment_data["moveInDate"]:
            try:
                apartment.moveInDate = datetime.strptime(new_apartment_data["moveInDate"], "%Y-%m-%d").date()
            except ValueError:
                pass  # Ignore invalid date formats

        if "contractEndDate" in new_apartment_data and new_apartment_data["contractEndDate"]:
            try:
                apartment.contractEndDate = datetime.strptime(new_apartment_data["contractEndDate"], "%Y-%m-%d").date()
            except ValueError:
                pass  # Ignore invalid date formats

        # FIXED: Update address field from components
        if apartment.street_name or apartment.house_number or apartment.city:
            address_parts = []
            if apartment.street_name:
                address_parts.append(apartment.street_name)
            if apartment.house_number:
                address_parts.append(apartment.house_number)
            if apartment.city:
                if address_parts:
                    address_parts.append(f", {apartment.city}")
                else:
                    address_parts.append(apartment.city)
            apartment.address = "".join(address_parts) if address_parts else apartment.address

        # FIXED: ONLY managementFee, rentCost, and model are admin-only
        if is_admin:
            print("Processing admin-only financial fields...")

            if "model" in new_apartment_data:
                apartment.model = new_apartment_data["model"]
                print(f"Set model to: {apartment.model}")

            if "managementFee" in new_apartment_data:
                apartment.managementFee = float(new_apartment_data["managementFee"]) if new_apartment_data["managementFee"] is not None else 0.0
                print(f"Set managementFee to: {apartment.managementFee}")

            if "rentCost" in new_apartment_data:
                apartment.rentCost = float(new_apartment_data["rentCost"]) if new_apartment_data["rentCost"] is not None else 0.0
                print(f"Set rentCost to: {apartment.rentCost}")

        # FIXED: Handle tenant updates using the contract system
        if new_tenants:
            print(f"Processing {len(new_tenants)} tenants...")

            # FIXED: Get current tenants through the contract system (not apartment_id)
            current_tenants = apartment.get_current_tenants()
            current_tenant_ids = {t.id for t in current_tenants}

            # Track which tenants should remain
            tenants_to_keep = set()

            for tenant_data in new_tenants:
                if tenant_data.get("isExistingTenant") and tenant_data.get("id"):
                    # Existing tenant - just mark to keep
                    tenants_to_keep.add(tenant_data["id"])

                    # Update existing tenant if needed
                    existing_tenant = next((t for t in current_tenants if t.id == tenant_data["id"]), None)
                    if existing_tenant:
                        if "name" in tenant_data:
                            existing_tenant.name = tenant_data["name"]
                        if "email" in tenant_data:
                            existing_tenant.email = tenant_data["email"]
                        if "phone" in tenant_data:
                            existing_tenant.phone = tenant_data["phone"]

                elif tenant_data.get("name") and not tenant_data.get("isExistingTenant"):
                    # FIXED: New tenant - create tenant and add to active contract
                    new_tenant = Tenant(
                        name=tenant_data["name"],
                        phone=tenant_data.get("phone", ""),
                        email=tenant_data.get("email", ""),
                        date_of_birth=tenant_data.get("date_of_birth"),
                        refund_iban=tenant_data.get("refund_iban"),
                        passport_id=tenant_data.get("passport_id"),
                        gender=tenant_data.get("gender")
                        # NOTE: NO apartment_id here since that column doesn't exist
                    )
                    db.session.add(new_tenant)
                    db.session.flush()  # Get the ID
                    tenants_to_keep.add(new_tenant.id)

                    # FIXED: Add tenant to an active contract period
                    # Find or create an active contract period for this apartment
                    active_contract = ContractPeriod.query.filter_by(
                        apartment_id=apartment.id,
                        status='active'
                    ).first()

                    if not active_contract:
                        # Create a new active contract period
                        from datetime import date
                        contract_number = f"APT{apartment.id}-{date.today().strftime('%Y%m%d')}-{len(apartment.contract_periods) + 1}"

                        active_contract = ContractPeriod(
                            apartment_id=apartment.id,
                            contract_number=contract_number,
                            start_date=date.today(),
                            monthly_rent=apartment.rent,
                            security_deposit=apartment.deposit,
                            status="active"
                        )
                        db.session.add(active_contract)
                        db.session.flush()  # Get the ID

                    # Add the tenant to the contract period
                    contract_tenant = ContractTenant(
                        contract_period_id=active_contract.id,
                        tenant_id=new_tenant.id,
                        move_in_date=date.today(),
                        is_primary=len(tenants_to_keep) == 1  # First tenant is primary
                    )
                    db.session.add(contract_tenant)

                    print(f"Created new tenant: {new_tenant.name} (ID: {new_tenant.id}) and added to contract {active_contract.contract_number}")

            # FIXED: Handle tenant removals through the contract system
            tenants_to_remove = current_tenant_ids - tenants_to_keep
            if tenants_to_remove:
                print(f"Removing tenants: {tenants_to_remove}")
                for tenant_id in tenants_to_remove:
                    # Find and end the contract assignments for this tenant in this apartment
                    contract_assignments = db.session.query(ContractTenant)\
                        .join(ContractPeriod)\
                        .filter(ContractPeriod.apartment_id == apartment.id)\
                        .filter(ContractTenant.tenant_id == tenant_id)\
                        .filter(ContractTenant.move_out_date.is_(None))\
                        .all()

                    for assignment in contract_assignments:
                        assignment.move_out_date = date.today()
                        print(f"Set move_out_date for tenant {tenant_id} in contract {assignment.contract_period.contract_number}")

        # FIXED: Commit all changes
        db.session.commit()

        print(f"Successfully updated apartment {apartment_id}")

        return jsonify({"message": "Apartment updated successfully"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error editing apartment {apartment_id}: {str(e)}")
        print(f"Error editing apartment: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@apartments_bp.route("apartments/delete/<int:apartment_id>", methods=["DELETE"])
@token_required
@role_required("admin")
def delete_apartment(apartment_id):
    """Delete apartment - used by ApartmentForm.jsx"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"error": "Apartment not found"}), 404

        # Check for active contracts
        active_contracts = [cp for cp in apartment.contract_periods if cp.status == 'active']
        if active_contracts:
            return jsonify({"error": "Cannot delete apartment with active contracts"}), 400

        db.session.delete(apartment)
        db.session.commit()

        return jsonify({"message": "Apartment deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting apartment: {e}")
        return jsonify({"error": str(e)}), 500


@apartments_bp.route("/apartments/<int:apartment_id>/extend-contract", methods=["PUT"])
@token_required
def extend_contract(apartment_id):
    """Extend contract end date - used by ContractExtensionDialog"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"error": "Apartment not found"}), 404

        data = request.get_json()
        new_end_date = data.get("contractEndDate")

        if not new_end_date:
            return jsonify({"error": "New end date required"}), 400

        # Find active contract period
        active_contract = None
        for cp in apartment.contract_periods:
            if cp.status == 'active':
                active_contract = cp
                break

        if active_contract:
            active_contract.end_date = datetime.strptime(new_end_date, '%Y-%m-%d').date()
            db.session.commit()
            return jsonify({"message": "Contract extended successfully"}), 200
        else:
            return jsonify({"error": "No active contract found"}), 404

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error extending contract: {e}")
        return jsonify({"error": str(e)}), 500


@apartments_bp.route("/apartment/<int:apartment_id>", methods=["GET"])
@token_required
def get_single_apartment(apartment_id):
    """Get detailed information for a single apartment by ID"""
    try:
        # Get apartment with landlord info
        apartment = db.session.query(Apartment)\
            .outerjoin(Landlord)\
            .filter(Apartment.id == apartment_id)\
            .first()

        if not apartment:
            return jsonify({"message": "Apartment not found"}), 404

        # Check if user is admin for enhanced data
        is_admin = g.user.get("role") == "admin"

        # Build apartment data similar to list_apartments format
        apt_dict = {
            # Basic apartment info
            "id": apartment.id,
            "address": apartment.address,
            "street_name": apartment.street_name,
            "house_number": apartment.house_number,
            "city": apartment.city,
            "state": apartment.state,
            "zip_code": apartment.zip_code,
            "floor": apartment.floor,

            # Space info
            "bedrooms": apartment.bedrooms,
            "rooms": apartment.rooms or apartment.bedrooms,  # Fallback
            "area": apartment.area,
            "size": apartment.area,  # Alias

            # Status and preferences
            "status": apartment.status,
            "genderPreference": apartment.genderPreference,
            "maxOccupancy": apartment.maxOccupancy,

            # Financial info - basic for all users
            "rent": float(apartment.rent) if apartment.rent else 0,

            # Contract dates if available
            "moveInDate": apartment.moveInDate.isoformat() if apartment.moveInDate else None,
            "contractEndDate": apartment.contractEndDate.isoformat() if apartment.contractEndDate else None,

            # Landlord info
            "landlord_id": apartment.landlord_id,
            "landlord": {
                "id": apartment.landlord.id,
                "name": apartment.landlord.name,
                "company_name": apartment.landlord.company_name,
                "email": apartment.landlord.email if is_admin else "",
                "phone": apartment.landlord.phone if is_admin else ""
            } if apartment.landlord else None,

            # Metadata
            "notes": apartment.notes or "",
            "created_at": apartment.created_at.isoformat() if apartment.created_at else None,
            "updated_at": apartment.updated_at.isoformat() if apartment.updated_at else None,
        }

        # Admin-only financial fields
        if is_admin and hasattr(apartment, 'managementFee'):
            apt_dict.update({
                "managementFee": float(apartment.managementFee) if apartment.managementFee else 0,
                "rentCost": float(apartment.rentCost) if apartment.rentCost else 0,
                "model": apartment.model if hasattr(apartment, 'model') else "rental"
            })

        return jsonify(apt_dict), 200

    except Exception as e:
        current_app.logger.error(f"Error getting apartment {apartment_id}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to get apartment", "details": str(e)}), 500
