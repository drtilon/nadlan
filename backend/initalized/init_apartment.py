# initalized/init_apartment.py
from models.models import Apartment, Tenant, User, Payment, Landlord
from extentions import db
from flask import current_app
from datetime import date, datetime
from sqlalchemy import inspect, text
from .init_landlord import ensure_default_landlords_exist


def ensure_db_schema():
    """Ensure that the database schema matches our model definitions."""
    try:
        inspector = inspect(db.engine)

        # Check payments table columns
        if "payments" in inspector.get_table_names():
            existing_columns = [
                col["name"] for col in inspector.get_columns("payments")
            ]

            # Define required columns that might be missing
            required_columns = {
                "paymentDate": "DATETIME NULL",
                "paymentMethod": 'VARCHAR(50) NULL DEFAULT "bank_transfer"',
                "extraPayments": "TEXT NULL",
                "notes": "TEXT NULL",
                "year": "INT NULL",
            }

            # Add missing columns
            for column_name, column_type in required_columns.items():
                if column_name not in existing_columns:
                    sql = f"ALTER TABLE payments ADD COLUMN {column_name} {column_type}"
                    db.engine.execute(text(sql))
                    current_app.logger.info(
                        f"Added missing column '{column_name}' to payments table"
                    )

        # Make sure the database tables exist
        db.create_all()
        current_app.logger.info("Database schema check completed")

    except Exception as e:
        current_app.logger.error(f"Error ensuring database schema: {e}")


def ensure_default_apartment_exists(new_tenants_data=None):
    # First ensure that landlords exist
    ensure_default_landlords_exist()

    # Get the default landlord
    default_landlord = Landlord.query.filter_by(
        company_name="Default Company Name"
    ).first()

    default_address = "Default Apartment Address"
    default_apartment = Apartment.query.filter_by(address=default_address).first()

    if not default_apartment:
        # Create the default apartment with all attributes
        default_apartment = Apartment(
            address=default_address,
            rooms=3,
            size=100.0,
            landlord_id=default_landlord.id if default_landlord else None,
            moveInDate=None,
            contractEndDate=None,
            rent=1200.00,
            deposit=100.00,
            notes="Default apartment created on startup",
            status="vacant",
            managementFee=0.00,
            rentCost=0.00,
            model="management",
        )
        db.session.add(default_apartment)
        db.session.commit()
        current_app.logger.info("Default apartment created.")

        # Initialize monthly payment records with all required fields
        initialize_payment_records(default_apartment.id)
    else:
        current_app.logger.info("Default apartment already exists.")
        updated = False

        if default_apartment.status == "available":
            default_apartment.status = "vacant"
            updated = True
            current_app.logger.info(
                "Updated default apartment status from 'available' to 'vacant'."
            )
        if not default_apartment.model:
            default_apartment.model = "management"
            updated = True
            current_app.logger.info("Added missing model field to default apartment.")

        # Update landlord_id if it's missing
        if default_apartment.landlord_id is None and default_landlord is not None:
            default_apartment.landlord_id = default_landlord.id
            updated = True
            current_app.logger.info("Set landlord_id for default apartment.")

        default_attrs = {
            "rooms": 3,
            "size": 100.0,
            "moveInDate": None,
            "contractEndDate": None,
            "rent": 1200.00,
            "deposit": 100.00,
            "notes": "Default apartment created on startup",
            "status": "vacant",
            "managementFee": 0.00,
            "rentCost": 0.00,
            "model": "management",
        }
        for attr, default_value in default_attrs.items():
            if getattr(default_apartment, attr, None) is None:
                setattr(default_apartment, attr, default_value)
                updated = True
                current_app.logger.info(
                    f"Set missing attribute '{attr}' to default value."
                )
        if updated:
            db.session.commit()

    # Tenant handling: add tenant(s) to the default apartment.
    if new_tenants_data:
        # Create tenants using provided tenant data
        for tenant_data in new_tenants_data:
            tenant = Tenant(
                name=tenant_data.get("name", "Default Tenant"),
                email=tenant_data.get("email"),
                phone=tenant_data.get("phone"),
                bornOn=tenant_data.get("bornOn", "1970-01-01"),
                refundIban=tenant_data.get("refundIban", "DEFAULT_REFUND_IBAN"),
                apartment_id=default_apartment.id,
            )
            db.session.add(tenant)
        db.session.commit()
        current_app.logger.info("New tenant data added for the default apartment.")
    else:
        # Ensure the default apartment has at least two tenants.
        current_tenants = default_apartment.tenants or []
        num_tenants = len(current_tenants)
        if num_tenants < 2:
            tenants_needed = 2 - num_tenants
            for i in range(tenants_needed):
                tenant = Tenant(
                    name=f"Default Tenant {num_tenants + i + 1}",
                    email=f"default_tenant{num_tenants + i + 1}@example.com",
                    phone="0000000000",
                    bornOn="1970-01-01",
                    refundIban="DEFAULT_REFUND_IBAN",
                    apartment_id=default_apartment.id,
                )
                db.session.add(tenant)
            db.session.commit()
            current_app.logger.info(
                "Added missing default tenant(s) for the default apartment."
            )
        else:
            current_app.logger.info(
                "Default apartment already has two or more tenants."
            )


def ensure_new_apartment_exists(new_tenants_data=None):
    # Get the second landlord
    second_landlord = Landlord.query.filter_by(
        company_name="Second Company Name"
    ).first()

    new_address = "New Apartment Address"
    new_apartment = Apartment.query.filter_by(address=new_address).first()

    if not new_apartment:
        # Create the new apartment with all attributes
        new_apartment = Apartment(
            address=new_address,
            rooms=3,
            size=100.0,
            landlord_id=second_landlord.id if second_landlord else None,
            moveInDate=None,
            contractEndDate=None,
            rent=1500.00,
            deposit=200.00,
            notes="New apartment created on startup",
            status="vacant",
            managementFee=0.00,
            rentCost=0.00,
            model="management",
        )
        db.session.add(new_apartment)
        db.session.commit()
        current_app.logger.info("New apartment created.")

        # Initialize monthly payment records with all required fields
        initialize_payment_records(new_apartment.id)
    else:
        current_app.logger.info("New apartment already exists.")
        updated = False

        if new_apartment.status == "available":
            new_apartment.status = "vacant"
            updated = True
            current_app.logger.info(
                "Updated new apartment status from 'available' to 'vacant'."
            )
        if not new_apartment.model:
            new_apartment.model = "management"
            updated = True
            current_app.logger.info("Added missing model field to new apartment.")

        # Update landlord_id if it's missing
        if new_apartment.landlord_id is None and second_landlord is not None:
            new_apartment.landlord_id = second_landlord.id
            updated = True
            current_app.logger.info("Set landlord_id for new apartment.")

        default_attrs = {
            "rooms": 3,
            "size": 100.0,
            "moveInDate": None,
            "contractEndDate": None,
            "rent": 1500.00,
            "deposit": 200.00,
            "notes": "New apartment created on startup",
            "status": "vacant",
            "managementFee": 0.00,
            "rentCost": 0.00,
            "model": "management",
        }
        for attr, default_value in default_attrs.items():
            if getattr(new_apartment, attr, None) is None:
                setattr(new_apartment, attr, default_value)
                updated = True
                current_app.logger.info(
                    f"Set missing attribute '{attr}' to default value."
                )
        if updated:
            db.session.commit()

    # Tenant handling: add tenant(s) to the new apartment.
    if new_tenants_data:
        # Create tenants using provided tenant data
        for tenant_data in new_tenants_data:
            tenant = Tenant(
                name=tenant_data.get("name", "New Apartment Tenant"),
                email=tenant_data.get("email"),
                phone=tenant_data.get("phone"),
                bornOn=tenant_data.get("bornOn", "1970-01-01"),
                refundIban=tenant_data.get("refundIban", "DEFAULT_REFUND_IBAN"),
                apartment_id=new_apartment.id,
            )
            db.session.add(tenant)
        db.session.commit()
        current_app.logger.info("New tenant data added for the new apartment.")
    else:
        # Ensure the new apartment has at least four tenants.
        current_tenants = new_apartment.tenants or []
        num_tenants = len(current_tenants)
        if num_tenants < 4:
            tenants_needed = 4 - num_tenants
            for i in range(tenants_needed):
                tenant = Tenant(
                    name=f"New Apartment Tenant {num_tenants + i + 1}",
                    email=f"new_apartment_tenant{num_tenants + i + 1}@example.com",
                    phone="0000000000",
                    bornOn="1970-01-01",
                    refundIban="DEFAULT_REFUND_IBAN",
                    apartment_id=new_apartment.id,
                )
                db.session.add(tenant)
            db.session.commit()
            current_app.logger.info(
                "Added missing default tenant(s) for the new apartment."
            )
        else:
            current_app.logger.info("New apartment already has four or more tenants.")


def initialize_payment_records(apartment_id):
    """Initialize monthly payment records for a new apartment with all required fields."""
    month_list = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]

    current_year = datetime.utcnow().year

    for month in month_list:
        # Check if payment record already exists
        existing_payment = Payment.query.filter_by(
            apartment_id=apartment_id, month=month
        ).first()

        if not existing_payment:
            payment = Payment(
                apartment_id=apartment_id,
                month=month,
                status="not_paid",
                tenants="[]",  # Empty JSON array
                internet=0.0,
                electricity=0.0,
                other=0.0,
                updated_at=datetime.utcnow(),
                paymentDate=None,
                paymentMethod="bank_transfer",
                extraPayments="{}",  # Empty JSON object
                notes="",
                year=current_year,
            )
            db.session.add(payment)

    db.session.commit()
    current_app.logger.info(
        f"Initialized payment records for apartment ID {apartment_id}"
    )
