# routes/apartments.py - FIXED VERSION with Complete Filtering Support
import json
import math
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, current_app, g
from models.models import Apartment, Tenant, Landlord, ContractPeriod, ContractTenant, Payment
from .auth import token_required, role_required
from extentions import db
from typing import Tuple, Optional
from sqlalchemy import and_, or_, func
from .contract_automation import generate_contract_number, create_automatic_contract

apartments_bp = Blueprint("apartments", __name__)


@apartments_bp.route("/list", methods=["GET"])
@token_required
def list_apartments():
    """List apartments with pagination and comprehensive filtering - used by ApartmentList.jsx"""
    try:
        # Get query parameters
        page = request.args.get("page", 0, type=int)  # Frontend sends 0-based
        limit = request.args.get("limit", 12, type=int)
        sort = request.args.get("sort", "")
        search = request.args.get("search", "")

        # NEW: Get all filter parameters
        landlord = request.args.get("landlord", "")
        state = request.args.get("state", "")
        city = request.args.get("city", "")
        zip_code = request.args.get("zip_code", "")
        gender = request.args.get("gender", "")
        rooms = request.args.get("rooms", "")
        size_range = request.args.get("size_range", "")
        floor = request.args.get("floor", "")
        status = request.args.get("status", "")

        # Build base query
        query = Apartment.query.join(Landlord, Apartment.landlord_id == Landlord.id, isouter=True)

        # Apply search filter (existing functionality)
        if search:
            query = query.filter(
                or_(
                    Apartment.street_name.ilike(f"%{search}%"),
                    Apartment.address.ilike(f"%{search}%"),
                    Apartment.city.ilike(f"%{search}%")
                )
            )

        # NEW: Apply all the filter parameters

        # Landlord filter (search in both name and company_name)
        if landlord:
            query = query.filter(
                or_(
                    Landlord.name.ilike(f"%{landlord}%"),
                    Landlord.company_name.ilike(f"%{landlord}%")
                )
            )

        # State filter
        if state:
            query = query.filter(Apartment.state.ilike(f"%{state}%"))

        # City filter
        if city:
            query = query.filter(Apartment.city.ilike(f"%{city}%"))

        # Zip code filter
        if zip_code:
            query = query.filter(Apartment.zip_code.ilike(f"%{zip_code}%"))

        # Gender preference filter
        if gender:
            query = query.filter(Apartment.genderPreference == gender)

        # Rooms filter
        if rooms:
            try:
                rooms_int = int(rooms)
                query = query.filter(Apartment.bedrooms == rooms_int)
            except ValueError:
                pass  # Ignore invalid room numbers

        # Size filter with range support
        if size_range:
            # Parse size ranges like "50-100", "100+", etc.
            if size_range == "50-":  # Less than 50
                query = query.filter(Apartment.area < 50)
            elif size_range == "50-100":  # Between 50-100
                query = query.filter(and_(Apartment.area >= 50, Apartment.area <= 100))
            elif size_range == "100-150":  # Between 100-150
                query = query.filter(and_(Apartment.area >= 100, Apartment.area <= 150))
            elif size_range == "150+":  # Greater than 150
                query = query.filter(Apartment.area > 150)
            elif size_range.endswith("+"):  # Handle generic "X+" format
                try:
                    min_size = int(size_range[:-1])
                    query = query.filter(Apartment.area >= min_size)
                except ValueError:
                    pass
            elif "-" in size_range:  # Handle generic "X-Y" format
                try:
                    min_size, max_size = map(int, size_range.split("-"))
                    query = query.filter(and_(Apartment.area >= min_size, Apartment.area <= max_size))
                except ValueError:
                    pass

        # Floor filter
        if floor:
            try:
                floor_int = int(floor)
                query = query.filter(Apartment.floor == floor_int)
            except ValueError:
                # If not a number, try string match
                query = query.filter(Apartment.floor.ilike(f"%{floor}%"))

        # Status filter - this is complex because we need to determine occupancy
        if status:
            if status.lower() in ['vacant', 'available']:
                # Filter for apartments with no current tenants
                subquery = db.session.query(ContractTenant.contract_period_id).join(
                    ContractPeriod
                ).filter(
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

            elif status.lower() in ['occupied', 'rented']:
                # Filter for apartments with current tenants
                subquery = db.session.query(ContractTenant.contract_period_id).join(
                    ContractPeriod
                ).filter(
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

        # Apply sorting (existing functionality)
        if sort == "expiry:1":
            # MySQL-compatible sorting - handle NULLs manually
            query = query.outerjoin(ContractPeriod).order_by(
                db.case(
                    (ContractPeriod.end_date.is_(None), 1),
                    else_=0
                ),
                ContractPeriod.end_date.asc()
            )
        elif sort == "address:1":
            query = query.order_by(Apartment.street_name.asc())
        elif sort == "rent:1":
            query = query.order_by(Apartment.rent.asc())
        elif sort == "rent:-1":
            query = query.order_by(Apartment.rent.desc())
        elif sort == "size:1":
            query = query.order_by(Apartment.area.asc())
        elif sort == "size:-1":
            query = query.order_by(Apartment.area.desc())

        # Get total count before pagination
        total = query.count()

        # Apply pagination
        offset = page * limit
        apartments = query.offset(offset).limit(limit).all()

        current_app.logger.info(f"Filtering apartments - Total: {total}, Page: {page}, Limit: {limit}")
        current_app.logger.info(f"Applied filters - landlord: {landlord}, city: {city}, rooms: {rooms}, size_range: {size_range}, status: {status}")

        # Build response
        apartments_data = []
        for apt in apartments:
            # Get current contract and tenants
            current_contracts = apt.get_current_contract_periods()
            current_tenants = apt.get_current_tenants()

            # Determine actual status based on current occupancy
            actual_status = "occupied" if current_tenants else "vacant"

            apt_dict = {
                "id": apt.id,
                "address": apt.address or f"{apt.street_name} {apt.house_number}, {apt.city}",
                "rooms": apt.bedrooms,
                "size": float(apt.area) if apt.area else 0,
                "rent": float(apt.rent) if apt.rent else 0,
                "deposit": float(apt.security_deposit) if hasattr(apt, 'security_deposit') else 0,
                "status": actual_status,
                "maxOccupancy": apt.maxOccupancy,
                "current_tenant_count": len(current_tenants),
                "is_full": len(current_tenants) >= apt.maxOccupancy,
                "floor": apt.floor,
                "city": apt.city,
                "state": apt.state,
                "zip_code": apt.zip_code,
                "genderPreference": apt.genderPreference,
                "tenants": [
                    {
                        "id": t.id,
                        "name": t.name,
                        "email": t.email,
                        "phone": t.phone
                    } for t in current_tenants
                ],
                "moveInDate": current_contracts[0].start_date.isoformat() if current_contracts else None,
                "contractEndDate": current_contracts[0].end_date.isoformat() if current_contracts and current_contracts[0].end_date else None,
                "landlord": {
                    "id": apt.landlord.id,
                    "name": apt.landlord.name,
                    "company_name": apt.landlord.company_name
                } if apt.landlord else None
            }
            apartments_data.append(apt_dict)

        return jsonify({
            "apartments": apartments_data,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": math.ceil(total / limit) if limit > 0 else 1
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error listing apartments: {e}")
        return jsonify({"error": "Failed to list apartments"}), 500


@apartments_bp.route("/filter-options", methods=["GET"])
@token_required
def get_filter_options():
    """Get filter options for ApartmentFilters.jsx - Enhanced with more options"""
    try:
        # Get unique values from database
        cities = db.session.query(Apartment.city).distinct().filter(Apartment.city.isnot(None)).all()
        floors = db.session.query(Apartment.floor).distinct().filter(Apartment.floor.isnot(None)).all()
        states = db.session.query(Apartment.state).distinct().filter(Apartment.state.isnot(None)).all()

        # Get landlord info
        landlords = db.session.query(Landlord.name, Landlord.company_name).distinct().all()
        landlord_options = []
        for landlord in landlords:
            if landlord.name:
                landlord_options.append(landlord.name)
            if landlord.company_name and landlord.company_name != landlord.name:
                landlord_options.append(landlord.company_name)

        return jsonify({
            "cities": [city[0] for city in cities if city[0]],
            "floors": [str(floor[0]) for floor in floors if floor[0] is not None],
            "states": [state[0] for state in states if state[0]],
            "statuses": ["vacant", "occupied"],
            "landlords": sorted(list(set(landlord_options)))  # Remove duplicates and sort
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error fetching filter options: {e}")
        return jsonify({"error": "Failed to fetch filter options"}), 500

@apartments_bp.route("/add", methods=["POST"])
@token_required
def add_apartment():
    """Add apartment route - FULLY FIXED VERSION"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid request: No data provided"}), 400

        # Extract apartment and tenant data
        new_apartment_data = data.get("new_apartment", {})
        new_tenants = data.get("new_tenants", [])

        # Create apartment
        apartment = Apartment(
            street_name=new_apartment_data.get("street_name"),
            house_number=new_apartment_data.get("house_number"),
            city=new_apartment_data.get("city"),
            zip_code=new_apartment_data.get("zip_code"),
            floor=new_apartment_data.get("floor"),
            bedrooms=new_apartment_data.get("rooms"),
            area=new_apartment_data.get("size"),
            rent=new_apartment_data.get("rent"),
            maxOccupancy=new_apartment_data.get("maxOccupancy"),
            genderPreference=new_apartment_data.get("genderPreference"),
            state=new_apartment_data.get("state", "available")
        )

        db.session.add(apartment)
        db.session.flush()  # Get apartment ID

        # Create tenants if provided
        tenant_ids = []
        for tenant_data in new_tenants:
            # FIXED: Use correct field name 'date_of_birth' instead of 'dob'
            new_tenant = Tenant(
                name=tenant_data.get("name"),
                email=tenant_data.get("email"),
                phone=tenant_data.get("phone"),
                date_of_birth=datetime.strptime(tenant_data.get("date_of_birth"), "%Y-%m-%d").date() if tenant_data.get("date_of_birth") else None,
                refund_iban=tenant_data.get("refund_iban"),
                passport_id=tenant_data.get("passport_id"),
                gender=tenant_data.get("gender")
            )
            db.session.add(new_tenant)
            db.session.flush()  # Get tenant ID
            tenant_ids.append(new_tenant.id)

        # Create contract with proper contract number
        if tenant_ids:
            # Use the contract automation helper function
            contract = create_automatic_contract(
                apartment_id=apartment.id,
                tenant_ids=tenant_ids,
                start_date=date.today()
            )

            if not contract:
                raise Exception("Failed to create contract for apartment")

        else:
            # Create contract without tenants - still need proper contract number
            contract_number = generate_contract_number(apartment.id)

            contract_period = ContractPeriod(
                apartment_id=apartment.id,
                contract_number=contract_number,  # FIXED: Proper contract number
                start_date=date.today(),
                end_date=None,
                monthly_rent=apartment.rent or 0.0,
                security_deposit=0.0,
                status='active',
                notes=f'Auto-created contract for apartment {apartment.id}',
                created_at=datetime.utcnow(),
                created_by='system_auto'
            )
            db.session.add(contract_period)

        db.session.commit()

        return jsonify({
            "message": "Apartment added successfully",
            "apartment_id": apartment.id
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding apartment: {e}")
        return jsonify({"error": str(e)}), 500



@apartments_bp.route("/admin/edit/<int:apartment_id>", methods=["PUT"])
@token_required
@role_required("admin")
def admin_edit_apartment(apartment_id):
    """Admin edit apartment - used by ApartmentForm.jsx"""
    return edit_apartment_common(apartment_id, is_admin=True)


@apartments_bp.route("/user/edit/<int:apartment_id>", methods=["PUT"])
@token_required
def user_edit_apartment(apartment_id):
    """User edit apartment - used by ApartmentForm.jsx"""
    return edit_apartment_common(apartment_id, is_admin=False)


def edit_apartment_common(apartment_id, is_admin=False):
    """Common edit logic for both admin and user"""
    try:
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"error": "Apartment not found"}), 404

        data = request.get_json()
        new_apartment_data = data.get("new_apartment", {})

        # Update apartment fields
        apartment.street_name = new_apartment_data.get("street_name", apartment.street_name)
        apartment.house_number = new_apartment_data.get("house_number", apartment.house_number)
        apartment.city = new_apartment_data.get("city", apartment.city)
        apartment.zip_code = new_apartment_data.get("zip_code", apartment.zip_code)
        apartment.floor = new_apartment_data.get("floor", apartment.floor)
        apartment.bedrooms = new_apartment_data.get("rooms", apartment.bedrooms)
        apartment.area = new_apartment_data.get("size", apartment.area)
        apartment.rent = new_apartment_data.get("rent", apartment.rent)
        apartment.maxOccupancy = new_apartment_data.get("maxOccupancy", apartment.maxOccupancy)
        apartment.genderPreference = new_apartment_data.get("genderPreference", apartment.genderPreference)
        apartment.state = new_apartment_data.get("state", apartment.state)

        # Update address
        apartment.address = f"{apartment.street_name} {apartment.house_number}, {apartment.city}"

        # Admin-only fields
        if is_admin:
            apartment.landlord_id = new_apartment_data.get("landlord_id", apartment.landlord_id)

        db.session.commit()

        return jsonify({"message": "Apartment updated successfully"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error editing apartment: {e}")
        return jsonify({"error": str(e)}), 500


@apartments_bp.route("/delete/<int:apartment_id>", methods=["DELETE"])
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
