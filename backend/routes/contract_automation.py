# contract_automation.py
"""
Helper functions for automatic ContractPeriod creation and management
Add this file to your routes/ directory
"""

from datetime import datetime, date, timedelta
from flask import current_app
from models.models import ContractPeriod, ContractTenant, Apartment
from extentions import db
from typing import List, Optional
import uuid


def generate_contract_number(apartment_id: int) -> str:
    """Generate a unique contract number for an apartment"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M")
    unique_id = str(uuid.uuid4())[:8].upper()
    return f"CONT-{apartment_id}-{timestamp}-{unique_id}"


def create_automatic_contract(
    apartment_id: int,
    tenant_ids: List[int] = None,
    start_date: date = None,
    end_date: date = None,
    security_deposit: float = None,
) -> Optional[ContractPeriod]:
    """
    Automatically create a contract when an apartment is created or needs a contract

    Args:
        apartment_id: ID of the apartment
        tenant_ids: List of tenant IDs to assign to contract
        start_date: Contract start date (defaults to today)
        end_date: Contract end date (defaults to start_date + 1 year)
        security_deposit: Security deposit amount (defaults to monthly rent if not provided)

    Returns:
        ContractPeriod object or None if creation failed
    """
    try:
        # Get apartment details
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            current_app.logger.error(
                f"Apartment {apartment_id} not found for contract creation"
            )
            return None

        # Set defaults
        if start_date is None:
            start_date = date.today()

        if end_date is None:
            end_date = start_date + timedelta(days=365)  # 1 year contract

        # Set security deposit - default to monthly rent if not provided
        if security_deposit is None:
            security_deposit = float(apartment.rent) if apartment.rent else 0.0

        # Generate unique contract number
        contract_number = generate_contract_number(apartment_id)

        # Get apartment address safely
        apartment_address = getattr(apartment, "address", None)
        if not apartment_address:
            # Build address from components if full address doesn't exist
            apartment_address = (
                f"{apartment.street_name} {apartment.house_number}, {apartment.city}"
            )

        # Create contract period
        contract = ContractPeriod(
            apartment_id=apartment_id,
            contract_number=contract_number,
            start_date=start_date,
            end_date=end_date,
            monthly_rent=float(apartment.rent) if apartment.rent else 0.0,
            security_deposit=security_deposit,  # Use the parameter or calculated default
            status="active",
            notes=f"Auto-generated contract for {apartment_address}",
            created_at=datetime.utcnow(),
            created_by="system_auto",
        )

        db.session.add(contract)
        db.session.flush()  # Get contract ID

        # Add tenants to contract if provided
        if tenant_ids:
            assign_tenants_to_contract(contract.id, tenant_ids, start_date)

        db.session.commit()

        current_app.logger.info(
            f"Auto-created contract {contract_number} for apartment {apartment_id} "
            f"with {len(tenant_ids) if tenant_ids else 0} tenants"
        )

        return contract

    except Exception as e:
        current_app.logger.error(
            f"Error creating auto-contract for apartment {apartment_id}: {e}"
        )
        db.session.rollback()
        return None


def assign_tenants_to_contract(
    contract_id: int, tenant_ids: List[int], move_in_date: date = None
):
    """
    Assign tenants to a contract period - ALL TENANTS ARE EQUAL
    REMOVED: Primary tenant concept - all tenants have equal status
    """
    if not tenant_ids:
        return

    # Calculate rent share percentage (equal split)
    rent_share = 100.0 / len(tenant_ids)

    for tenant_id in tenant_ids:
        contract_tenant = ContractTenant(
            contract_period_id=contract_id,
            tenant_id=tenant_id,
            is_primary=False,  # FIXED: No more primary tenant - all are equal
            move_in_date=move_in_date or date.today(),
            rent_share_percentage=rent_share,
            created_at=datetime.utcnow(),
        )
        db.session.add(contract_tenant)


def update_contract_tenants(apartment_id: int, new_tenant_ids: List[int]) -> bool:
    """
    Update the current contract when tenants are added/removed/changed

    Args:
        apartment_id: Apartment ID
        new_tenant_ids: New list of tenant IDs

    Returns:
        True if update was successful, False otherwise
    """
    try:
        # Get current active contract for the apartment
        current_contract = (
            ContractPeriod.query.filter_by(apartment_id=apartment_id, status="active")
            .filter(ContractPeriod.start_date <= date.today())
            .filter(
                db.or_(
                    ContractPeriod.end_date.is_(None),
                    ContractPeriod.end_date >= date.today(),
                )
            )
            .first()
        )

        if not current_contract:
            # No current contract exists, create one
            current_app.logger.info(
                f"No active contract found for apartment {apartment_id}, creating new one"
            )
            create_automatic_contract(apartment_id, new_tenant_ids)
            return True

        # Remove existing tenant assignments
        ContractTenant.query.filter_by(contract_period_id=current_contract.id).delete()

        # Add new tenant assignments
        if new_tenant_ids:
            assign_tenants_to_contract(current_contract.id, new_tenant_ids)

        db.session.commit()

        current_app.logger.info(
            f"Updated contract {current_contract.contract_number} tenants for apartment {apartment_id}"
        )

        return True

    except Exception as e:
        current_app.logger.error(
            f"Error updating contract tenants for apartment {apartment_id}: {e}"
        )
        db.session.rollback()
        return False


def get_active_contract_for_apartment(apartment_id: int) -> Optional[ContractPeriod]:
    """
    Get the currently active contract for an apartment

    Args:
        apartment_id: ID of the apartment

    Returns:
        ContractPeriod object or None if no active contract found
    """
    try:
        today = date.today()

        active_contract = ContractPeriod.query.filter(
            ContractPeriod.apartment_id == apartment_id,
            ContractPeriod.status == "active",
            ContractPeriod.start_date <= today,
            db.or_(ContractPeriod.end_date.is_(None), ContractPeriod.end_date >= today),
        ).first()

        return active_contract

    except Exception as e:
        current_app.logger.error(
            f"Error getting active contract for apartment {apartment_id}: {e}"
        )
        return None


def extend_contract_period(contract_id: int, new_end_date: date) -> bool:
    """
    Extend an existing contract period

    Args:
        contract_id: ID of the contract to extend
        new_end_date: New end date for the contract

    Returns:
        True if extension was successful, False otherwise
    """
    try:
        contract = ContractPeriod.query.get(contract_id)
        if not contract:
            current_app.logger.error(f"Contract {contract_id} not found")
            return False

        # Validate new end date
        if new_end_date <= contract.start_date:
            current_app.logger.error(
                f"New end date {new_end_date} must be after start date {contract.start_date}"
            )
            return False

        # Update the contract
        old_end_date = contract.end_date
        contract.end_date = new_end_date
        contract.updated_at = datetime.utcnow()

        db.session.commit()

        current_app.logger.info(
            f"Extended contract {contract.contract_number} from {old_end_date} to {new_end_date}"
        )

        return True

    except Exception as e:
        current_app.logger.error(f"Error extending contract {contract_id}: {e}")
        db.session.rollback()
        return False


def terminate_contract_period(contract_id: int, termination_date: date = None) -> bool:
    """
    Terminate a contract period

    Args:
        contract_id: ID of the contract to terminate
        termination_date: Date of termination (defaults to today)

    Returns:
        True if termination was successful, False otherwise
    """
    try:
        contract = ContractPeriod.query.get(contract_id)
        if not contract:
            current_app.logger.error(f"Contract {contract_id} not found")
            return False

        if termination_date is None:
            termination_date = date.today()

        # Update contract status and end date
        contract.status = "terminated"
        contract.end_date = termination_date
        contract.updated_at = datetime.utcnow()

        # Update all contract tenants to have move_out_date
        for ct in contract.contract_tenants:
            if ct.move_out_date is None:
                ct.move_out_date = termination_date

        db.session.commit()

        current_app.logger.info(
            f"Terminated contract {contract.contract_number} on {termination_date}"
        )

        return True

    except Exception as e:
        current_app.logger.error(f"Error terminating contract {contract_id}: {e}")
        db.session.rollback()
        return False


def calculate_contract_rent_split(contract_id: int) -> dict:
    """
    Calculate rent split for all tenants in a contract

    Args:
        contract_id: ID of the contract

    Returns:
        Dictionary with tenant rent calculations
    """
    try:
        contract = ContractPeriod.query.get(contract_id)
        if not contract:
            return {}

        rent_split = {}
        total_rent = float(contract.monthly_rent)

        for ct in contract.contract_tenants:
            if ct.is_active():
                tenant_rent = total_rent * (float(ct.rent_share_percentage) / 100.0)
                rent_split[ct.tenant_id] = {
                    "tenant_name": ct.tenant.name,
                    "rent_share_percentage": float(ct.rent_share_percentage),
                    "monthly_rent": round(tenant_rent, 2),
                    "is_primary": ct.is_primary,
                }

        return rent_split

    except Exception as e:
        current_app.logger.error(
            f"Error calculating rent split for contract {contract_id}: {e}"
        )
        return {}
