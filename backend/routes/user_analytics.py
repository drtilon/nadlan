from flask import Blueprint, jsonify, request, current_app, g
from models.models import Apartment, Tenant, ContractPeriod, Payment
from extentions import db
from .auth import token_required
from datetime import datetime, date, timedelta
from sqlalchemy import func, or_, and_
import math
from utils.logging_helpers import log_with_user

user_analytics_bp = Blueprint("user_analytics", __name__)

# Constants
APARTMENTS_PER_PAGE = 50
MAX_APARTMENTS_PER_PAGE = 100

@user_analytics_bp.route("/user-analytics/apartments", methods=["GET"])
@token_required
def get_user_apartments():
    """
    Optimized endpoint for UserAnalyticsPanel - returns apartments with minimal data
    Supports pagination for infinite scroll
    """
    try:
        # Get pagination parameters
        page = int(request.args.get("page", 0))
        limit = min(int(request.args.get("limit", APARTMENTS_PER_PAGE)), MAX_APARTMENTS_PER_PAGE)

        # Get filter parameters
        search = request.args.get("search", "").strip()
        status_filter = request.args.get("status", "").strip()

        current_app.logger.info(f"User analytics apartments request - Page: {page}, Limit: {limit}")

        # Build query - only fetch apartments with minimal joins
        query = db.session.query(Apartment)

        # Apply search filter
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Apartment.address.ilike(search_pattern),
                    Apartment.street_name.ilike(search_pattern),
                    Apartment.city.ilike(search_pattern),
                    Apartment.notes.ilike(search_pattern)
                )
            )

        # Apply status filter
        if status_filter and status_filter != 'all':
            query = query.filter(Apartment.status.ilike(f"%{status_filter}%"))

        # Order by address
        query = query.order_by(
            func.coalesce(Apartment.street_name, Apartment.address, "").asc()
        )

        # Get total count
        total = query.count()

        # Apply pagination
        offset = page * limit
        apartments = query.offset(offset).limit(limit).all()

        current_app.logger.info(f"Retrieved {len(apartments)} apartments (Total: {total})")

        # Build lightweight response - only essential data
        apartments_data = []
        for apt in apartments:
            # Get current tenants efficiently
            current_tenants = apt.get_current_tenants()

            # Get contract end date efficiently
            current_contracts = apt.get_current_contract_periods()
            contract_end_date = None
            if current_contracts and current_contracts[0].end_date:
                contract_end_date = current_contracts[0].end_date.isoformat()

            # Determine status
            actual_status = "occupied" if current_tenants else "vacant"

            apt_dict = {
                "id": apt.id,
                "address": apt.address or f"{apt.street_name or ''} {apt.house_number or ''}".strip() or "No Address",
                "city": apt.city or "",
                "rooms": apt.rooms or 0,
                "rent": float(apt.rent) if apt.rent else 0,
                "status": actual_status,
                "original_status": apt.status,
                "contractEndDate": contract_end_date,
                "current_tenant_count": len(current_tenants),
                "notes": apt.notes or "",
            }

            apartments_data.append(apt_dict)

        # Calculate pagination info
        total_pages = math.ceil(total / limit) if limit > 0 else 1
        has_next = (page + 1) < total_pages

        response = {
            "apartments": apartments_data,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages,
                "total_items": total,
                "items_per_page": limit,
                "has_next_page": has_next,
                "has_prev_page": page > 0
            }
        }

        return jsonify(response), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error in user analytics apartments: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to load apartments", "details": str(e)}), 500


@user_analytics_bp.route("/user-analytics/summary", methods=["GET"])
@token_required
def get_user_summary():
    """
    Get summary statistics for user analytics dashboard
    Returns counts for vacant units, expiring contracts, and payment statuses
    """
    try:
        current_app.logger.info("Fetching user analytics summary")

        # Get all apartments (we need this for calculations)
        apartments = Apartment.query.all()

        # Calculate vacant units
        vacant_count = 0
        vacant_units = []

        # Calculate expiring contracts (next 30 days)
        today = date.today()
        thirty_days_from_now = today + timedelta(days=30)
        expiring_count = 0
        expiring_contracts = []

        # Payment status counts
        occupied_apartments = []

        for apt in apartments:
            current_tenants = apt.get_current_tenants()
            current_contracts = apt.get_current_contract_periods()

            # Check if vacant
            if not current_tenants:
                vacant_count += 1
                vacant_units.append({
                    "id": apt.id,
                    "address": apt.address or apt.get_short_address()
                })
            else:
                occupied_apartments.append(apt)

            # Check for expiring contracts
            if current_contracts and current_contracts[0].end_date:
                end_date = current_contracts[0].end_date
                if today < end_date <= thirty_days_from_now:
                    expiring_count += 1
                    days_until = (end_date - today).days
                    expiring_contracts.append({
                        "id": apt.id,
                        "address": apt.address or apt.get_short_address(),
                        "contractEndDate": end_date.isoformat(),
                        "daysUntil": days_until
                    })

        # Get payment statuses for occupied apartments (simplified - just counts)
        # We'll do actual payment checking only if needed
        paid_count = 0
        pending_count = 0
        overdue_count = 0

        current_month = today.month
        current_year = today.year

        for apt in occupied_apartments:
            try:
                # Check if payment exists for current month
                payment = Payment.query.filter_by(
                    apartment_id=apt.id,
                    month=current_month,
                    year=current_year
                ).first()

                if payment:
                    if payment.status == 'paid':
                        paid_count += 1
                    elif payment.status in ['pending', 'partial']:
                        pending_count += 1
                    else:
                        overdue_count += 1
                else:
                    # No payment record - consider it pending if before 5th, overdue after
                    if today.day > 5:
                        overdue_count += 1
                    else:
                        pending_count += 1
            except Exception as e:
                current_app.logger.warning(f"Error checking payment for apartment {apt.id}: {e}")
                pending_count += 1

        summary = {
            "total_apartments": len(apartments),
            "vacant": {
                "count": vacant_count,
                "apartments": vacant_units[:10]  # Return max 10 for preview
            },
            "expiring_contracts": {
                "count": expiring_count,
                "contracts": expiring_contracts[:10]  # Return max 10 for preview
            },
            "payments": {
                "paid": paid_count,
                "pending": pending_count,
                "overdue": overdue_count
            }
        }

        current_app.logger.info(f"Summary calculated: {summary['total_apartments']} apartments, {vacant_count} vacant, {expiring_count} expiring")

        return jsonify(summary), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error in user analytics summary: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to load summary", "details": str(e)}), 500


@user_analytics_bp.route("/user-analytics/tenants", methods=["GET"])
@token_required
def get_user_tenants():
    """
    Lightweight tenant list for user analytics
    Only returns basic tenant info with current apartment
    """
    try:
        search = request.args.get("search", "").strip()

        current_app.logger.info(f"User analytics tenants request - Search: '{search}'")

        # Build query
        query = Tenant.query

        # Apply search filter
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Tenant.name.ilike(search_pattern),
                    Tenant.email.ilike(search_pattern),
                    Tenant.phone.ilike(search_pattern)
                )
            )

        tenants = query.order_by(Tenant.name.asc()).all()

        # Build response with minimal data
        tenants_data = []
        for tenant in tenants:
            # Get current apartments
            current_apartments = tenant.get_current_apartments()
            apartment_address = None
            apartment_id = None

            if current_apartments:
                apt = current_apartments[0]
                apartment_address = apt.address or apt.get_short_address()
                apartment_id = apt.id

            # Get move-in date from current contract
            move_in_date = None
            current_assignments = tenant.get_current_contract_assignments()
            if current_assignments and current_assignments[0].move_in_date:
                move_in_date = current_assignments[0].move_in_date.isoformat()

            tenant_dict = {
                "id": tenant.id,
                "name": tenant.name,
                "email": tenant.email or "",
                "phone": tenant.phone or "",
                "apartment_address": apartment_address,
                "apartment_id": apartment_id,
                "move_in_date": move_in_date,
                "has_active_contract": len(current_apartments) > 0
            }

            tenants_data.append(tenant_dict)

        current_app.logger.info(f"Retrieved {len(tenants_data)} tenants")

        return jsonify(tenants_data), 200

    except Exception as e:
        log_with_user(current_app.logger, 'error', f"Error in user analytics tenants: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to load tenants", "details": str(e)}), 500
