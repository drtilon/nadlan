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
    end_date: date = None
) -> Optional[ContractPeriod]:
    """
    Automatically create a contract when an apartment is created or needs a contract

    Args:
        apartment_id: ID of the apartment
        tenant_ids: List of tenant IDs to assign to contract
        start_date: Contract start date (defaults to today)
        end_date: Contract end date (defaults to start_date + 1 year)

    Returns:
        ContractPeriod object or None if creation failed
    """
    try:
        # Get apartment details
        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            current_app.logger.error(f"Apartment {apartment_id} not found for contract creation")
            return None

        # Set defaults
        if start_date is None:
            start_date = date.today()

        if end_date is None:
            end_date = start_date + timedelta(days=365)  # 1 year contract

        # Generate unique contract number
        contract_number = generate_contract_number(apartment_id)

        # Create contract period
        contract = ContractPeriod(
            apartment_id=apartment_id,
            contract_number=contract_number,
            start_date=start_date,
            end_date=end_date,
            monthly_rent=apartment.rent or 0.0,
            security_deposit=apartment.deposit or 0.0,
            status='active',
            notes=f'Auto-generated contract for {apartment.address}',
            created_at=datetime.utcnow(),
            created_by='system_auto'
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
        current_app.logger.error(f"Error creating auto-contract for apartment {apartment_id}: {e}")
        db.session.rollback()
        return None


def assign_tenants_to_contract(
    contract_id: int,
    tenant_ids: List[int],
    move_in_date: date = None
):
    """
    Assign tenants to a contract period

    Args:
        contract_id: Contract period ID
        tenant_ids: List of tenant IDs to assign
        move_in_date: Move-in date for tenants
    """
    if not tenant_ids:
        return

    # Calculate rent share percentage (equal split)
    rent_share = 100.0 / len(tenant_ids)

    for i, tenant_id in enumerate(tenant_ids):
        contract_tenant = ContractTenant(
            contract_period_id=contract_id,
            tenant_id=tenant_id,
            is_primary=(i == 0),  # First tenant is primary
            move_in_date=move_in_date or date.today(),
            rent_share_percentage=rent_share,
            created_at=datetime.utcnow()
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
        ).first()

        if not current_contract:
            # No current contract exists, create one
            current_app.logger.info(f"No active contract found for apartment {apartment_id}, creating new one")
            create_automatic_contract(apartment_id, new_tenant_ids)
            return True

        # Remove existing tenant assignments
        ContractTenant.query.filter_by(
            contract_period_id=current_contract.id
        ).delete()

        # Add new tenant assignments
        if new_tenant_ids:
            assign_tenants_to_contract(
                current_contract.id,
                new_tenant_ids,
                date.today()
            )

        # Update contract notes
        changes_note = f"Tenants updated on {date.today()}: {len(new_tenant_ids)} tenants"

        if current_contract.notes:
            current_contract.notes += f"\n{changes_note}"
        else:
            current_contract.notes = changes_note

        current_contract.updated_at = datetime.utcnow()

        db.session.commit()

        current_app.logger.info(
            f"Updated contract {current_contract.contract_number} for apartment {apartment_id} "
            f"with {len(new_tenant_ids)} tenants"
        )

        return True

    except Exception as e:
        current_app.logger.error(
            f"Error updating contract for apartment {apartment_id}: {e}"
        )
        db.session.rollback()
        return False


def extend_contract_date(apartment_id: int, new_end_date: date, notes: str = None) -> bool:
    """
    Extend the expiration date of the current contract

    Args:
        apartment_id: Apartment ID
        new_end_date: New contract end date
        notes: Optional notes about the extension

    Returns:
        True if extension was successful, False otherwise
    """
    try:
        # Get current active contract
        current_contract = ContractPeriod.query.filter_by(
            apartment_id=apartment_id,
            status='active'
        ).filter(
            ContractPeriod.start_date <= date.today()
        ).order_by(ContractPeriod.created_at.desc()).first()

        if not current_contract:
            current_app.logger.error(f"No active contract found for apartment {apartment_id}")
            return False

        # Store old end date for logging
        old_end_date = current_contract.end_date

        # Update end date
        current_contract.end_date = new_end_date
        current_contract.updated_at = datetime.utcnow()

        # Add notes about the extension
        extension_note = f"Contract extended on {date.today()}: "
        extension_note += f"Previous end date: {old_end_date}, "
        extension_note += f"New end date: {new_end_date}"

        if notes:
            extension_note += f"\nNotes: {notes}"

        if current_contract.notes:
            current_contract.notes += f"\n{extension_note}"
        else:
            current_contract.notes = extension_note

        db.session.commit()

        current_app.logger.info(
            f"Extended contract {current_contract.contract_number} for apartment {apartment_id} "
            f"from {old_end_date} to {new_end_date}"
        )

        return True

    except Exception as e:
        current_app.logger.error(
            f"Error extending contract for apartment {apartment_id}: {e}"
        )
        db.session.rollback()
        return False


def get_or_create_active_contract(apartment_id: int, tenant_ids: List[int] = None) -> Optional[ContractPeriod]:
    """
    Get existing active contract or create a new one if none exists

    Args:
        apartment_id: Apartment ID
        tenant_ids: Tenant IDs to assign if creating new contract

    Returns:
        ContractPeriod object or None
    """
    # Try to get existing active contract
    existing_contract = ContractPeriod.query.filter_by(
        apartment_id=apartment_id,
        status='active'
    ).filter(
        ContractPeriod.start_date <= date.today()
    ).filter(
        db.or_(
            ContractPeriod.end_date.is_(None),
            ContractPeriod.end_date >= date.today()
        )
    ).first()

    if existing_contract:
        return existing_contract

    # Create new contract if none exists
    return create_automatic_contract(apartment_id, tenant_ids)
