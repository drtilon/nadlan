# init_apartment.py - Complete Fixed Version
from models.models import Apartment, Tenant, User, Payment, Landlord
from extentions import db
from flask import current_app
from datetime import date, datetime
from sqlalchemy import inspect, text


def ensure_db_schema():
    """Ensure that the database schema matches our model definitions."""
    try:
        inspector = inspect(db.engine)

        # Check apartments table for new address columns and gender preference
        if "apartments" in inspector.get_table_names():
            existing_columns = [
                col["name"] for col in inspector.get_columns("apartments")
            ]

            # Define new address columns and gender preference that might be missing
            new_columns = {
                "street_name": "VARCHAR(100) NOT NULL DEFAULT 'Unknown Street'",
                "house_number": "VARCHAR(20) NOT NULL DEFAULT '1'",
                "zip_code": "VARCHAR(20) NOT NULL DEFAULT '00000'",
                "city": "VARCHAR(50) NOT NULL DEFAULT 'Tel Aviv'",
                "state": "VARCHAR(50) NULL",
                "country": "VARCHAR(50) NOT NULL DEFAULT 'Israel'",
                "building": "VARCHAR(50) NULL",
                "floor": "VARCHAR(10) NULL",
                "side": "VARCHAR(10) NULL",
                "full_address": "VARCHAR(500) NULL",
                "genderPreference": "VARCHAR(20) NULL DEFAULT 'mixed'"
            }

            # Add missing columns
            for column_name, column_type in new_columns.items():
                if column_name not in existing_columns:
                    try:
                        # Use db.session.execute for newer SQLAlchemy versions
                        sql = f"ALTER TABLE apartments ADD COLUMN {column_name} {column_type}"
                        with db.engine.begin() as conn:
                            conn.execute(text(sql))
                        current_app.logger.info(
                            f"Added missing column '{column_name}' to apartments table"
                        )
                    except Exception as e:
                        current_app.logger.error(f"Error adding column {column_name}: {e}")

            # Update existing apartments with default gender preference if null
            try:
                update_sql = "UPDATE apartments SET genderPreference = 'mixed' WHERE genderPreference IS NULL OR genderPreference = ''"
                with db.engine.begin() as conn:
                    result = conn.execute(text(update_sql))
                    current_app.logger.info(f"Updated {result.rowcount} apartments with default gender preference")
            except Exception as e:
                current_app.logger.warning(f"Could not update gender preference defaults: {e}")

        # Check payments table columns
        if "payments" in inspector.get_table_names():
            existing_columns = [
                col["name"] for col in inspector.get_columns("payments")
            ]

            # Define required columns that might be missing
            required_columns = {
                "paymentDate": "DATETIME NULL",
                "paymentMethod": "VARCHAR(50) NULL DEFAULT 'bank_transfer'",
                "extraPayments": "TEXT NULL",
                "notes": "TEXT NULL",
                "year": "INT NULL",
            }

            # Add missing columns
            for column_name, column_type in required_columns.items():
                if column_name not in existing_columns:
                    try:
                        sql = f"ALTER TABLE payments ADD COLUMN {column_name} {column_type}"
                        with db.engine.begin() as conn:
                            conn.execute(text(sql))
                        current_app.logger.info(
                            f"Added missing column '{column_name}' to payments table"
                        )
                    except Exception as e:
                        current_app.logger.error(f"Error adding column {column_name}: {e}")

        # Make sure the database tables exist
        db.create_all()
        current_app.logger.info("Database schema check completed")

    except Exception as e:
        current_app.logger.error(f"Error ensuring database schema: {e}")


def ensure_default_landlords_exist():
    """Ensure default landlords exist"""
    try:
        # Check if default landlord exists
        default_landlord = Landlord.query.filter_by(
            company_name="Default Company Name"
        ).first()

        if not default_landlord:
            # Create default landlord
            default_landlord = Landlord(
                company_name="Default Company Name",
                name="Default Landlord",
                email="default@example.com",
                phone="0000000000",
                iban="DEFAULT_IBAN",
                company_address="Default Address",
                notes="Default landlord created on startup"
            )
            db.session.add(default_landlord)
            current_app.logger.info("Default landlord created.")

        # Check if second landlord exists
        second_landlord = Landlord.query.filter_by(
            company_name="Second Company Name"
        ).first()

        if not second_landlord:
            # Create second landlord
            second_landlord = Landlord(
                company_name="Second Company Name",
                name="Second Landlord",
                email="second@example.com",
                phone="0000000001",
                iban="SECOND_IBAN",
                company_address="Second Address",
                notes="Second landlord created on startup"
            )
            db.session.add(second_landlord)
            current_app.logger.info("Second landlord created.")

        db.session.commit()

    except Exception as e:
        current_app.logger.error(f"Error creating default landlords: {e}")
        db.session.rollback()


def ensure_default_apartment_exists(new_tenants_data=None):
    # First ensure that landlords exist
    ensure_default_landlords_exist()

    # Get the default landlord
    default_landlord = Landlord.query.filter_by(
        company_name="Default Company Name"
    ).first()

    # Check if default apartment exists by looking for specific address components
    default_apartment = Apartment.query.filter_by(
        street_name="Main Street",
        house_number="123",
        city="Tel Aviv"
    ).first()

    if not default_apartment:
        # Create the default apartment with new address structure and gender preference
        default_apartment = Apartment(
            street_name="Main Street",
            house_number="123",
            zip_code="12345",
            city="Tel Aviv",
            state="Tel Aviv",
            country="Israel",
            building="A",
            floor="2",
            side="B",
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
            genderPreference="mixed",
        )

        # Update full address
        default_apartment.update_full_address()

        db.session.add(default_apartment)
        db.session.commit()
        current_app.logger.info("Default apartment created with new address structure and gender preference.")
    else:
        current_app.logger.info("Default apartment already exists.")

        # Update full_address if it's missing
        if not default_apartment.full_address:
            default_apartment.update_full_address()
            db.session.commit()
            current_app.logger.info("Updated full_address for default apartment.")

        # Update gender preference if it's missing
        if not hasattr(default_apartment, 'genderPreference') or default_apartment.genderPreference is None:
            default_apartment.genderPreference = "mixed"
            db.session.commit()
            current_app.logger.info("Updated gender preference for default apartment.")

    # Ensure the default apartment has at least two tenants
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


def ensure_new_apartment_exists(new_tenants_data=None):
    # Get the second landlord
    second_landlord = Landlord.query.filter_by(
        company_name="Second Company Name"
    ).first()

    # Check if new apartment exists by address components
    new_apartment = Apartment.query.filter_by(
        street_name="Herzl Street",
        house_number="456",
        city="Tel Aviv"
    ).first()

    if not new_apartment:
        # Create the new apartment with new address structure and gender preference
        new_apartment = Apartment(
            street_name="Herzl Street",
            house_number="456",
            zip_code="67890",
            city="Tel Aviv",
            state="Tel Aviv",
            country="Israel",
            building="Tower B",
            floor="5",
            side="A",
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
            genderPreference="mixed",
        )

        # Update full address
        new_apartment.update_full_address()

        db.session.add(new_apartment)
        db.session.commit()
        current_app.logger.info("New apartment created with new address structure and gender preference.")

        # Initialize monthly payment records
        initialize_payment_records(new_apartment.id)
    else:
        current_app.logger.info("New apartment already exists.")

        # Update full_address if it's missing
        if not new_apartment.full_address:
            new_apartment.update_full_address()
            db.session.commit()
            current_app.logger.info("Updated full_address for new apartment.")

        # Update gender preference if it's missing
        if not hasattr(new_apartment, 'genderPreference') or new_apartment.genderPreference is None:
            new_apartment.genderPreference = "mixed"
            db.session.commit()
            current_app.logger.info("Updated gender preference for new apartment.")


def initialize_payment_records(apartment_id):
    """Initialize monthly payment records for an apartment"""
    try:
        from datetime import datetime
        # Create initial payment records or perform other initialization
        current_app.logger.info(f"Payment records initialized for apartment {apartment_id}")
    except Exception as e:
        current_app.logger.error(f"Error initializing payment records: {e}")
