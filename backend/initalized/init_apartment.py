# initialized/init_apartment.py - Database Initialization with New Structure
from models.models import (
    Apartment, Tenant, User, Payment, Landlord, ContractPeriod, ContractTenant,
    Contract, ContractTemplate
)
from extentions import db
from flask import current_app
from datetime import date, datetime, timedelta
from sqlalchemy import inspect, text
import json


def ensure_db_schema():
    """Ensure that the database schema matches our new model definitions."""
    try:
        inspector = inspect(db.engine)

        # Create all tables based on our models
        db.create_all()

        current_app.logger.info("Database schema ensured - all tables created/updated")

        # Add any new columns to existing tables
        ensure_column_migrations(inspector)

    except Exception as e:
        current_app.logger.error(f"Error ensuring database schema: {e}")
        raise


def ensure_column_migrations(inspector):
    """Add any missing columns to existing tables"""

    # Check tenants table for new structure
    if "tenants" in inspector.get_table_names():
        existing_columns = [col["name"] for col in inspector.get_columns("tenants")]

        # Migrate from dob/bornOn to date_of_birth
        if "date_of_birth" not in existing_columns:
            try:
                sql = "ALTER TABLE tenants ADD COLUMN date_of_birth DATE NULL"
                with db.engine.begin() as conn:
                    conn.execute(text(sql))

                    # Migrate data from old columns if they exist
                    if "dob" in existing_columns:
                        conn.execute(text("UPDATE tenants SET date_of_birth = dob WHERE dob IS NOT NULL"))
                    elif "bornOn" in existing_columns:
                        conn.execute(text("UPDATE tenants SET date_of_birth = STR_TO_DATE(bornOn, '%Y-%m-%d') WHERE bornOn IS NOT NULL"))

                current_app.logger.info("Added 'date_of_birth' column to tenants table")
            except Exception as e:
                current_app.logger.error(f"Error adding date_of_birth column: {e}")

        # Add refund_iban if missing
        if "refund_iban" not in existing_columns and "refundIban" not in existing_columns:
            try:
                sql = "ALTER TABLE tenants ADD COLUMN refund_iban VARCHAR(255) NULL"
                with db.engine.begin() as conn:
                    conn.execute(text(sql))
                current_app.logger.info("Added 'refund_iban' column to tenants table")
            except Exception as e:
                current_app.logger.error(f"Error adding refund_iban column: {e}")

    # Check payments table for new columns
    if "payments" in inspector.get_table_names():
        existing_columns = [col["name"] for col in inspector.get_columns("payments")]

        new_payment_columns = {
            "contract_period_id": "INT NULL",
            "payment_type": "ENUM('rent', 'deposit', 'other') DEFAULT 'rent'",
            "deposit_payment": "BOOLEAN DEFAULT FALSE",
            "tenant_payments": "TEXT NULL"
        }

        for column_name, column_type in new_payment_columns.items():
            if column_name not in existing_columns:
                try:
                    sql = f"ALTER TABLE payments ADD COLUMN {column_name} {column_type}"
                    with db.engine.begin() as conn:
                        conn.execute(text(sql))
                    current_app.logger.info(f"Added '{column_name}' to payments table")
                except Exception as e:
                    current_app.logger.warning(f"Column {column_name} might already exist: {e}")

    # Check contract_periods table for status enum update
    if "contract_periods" in inspector.get_table_names():
        try:
            # Update status enum to include 'future'
            sql = "ALTER TABLE contract_periods MODIFY COLUMN status ENUM('active', 'completed', 'terminated', 'pending', 'future') DEFAULT 'active'"
            with db.engine.begin() as conn:
                conn.execute(text(sql))
            current_app.logger.info("Updated contract_periods status enum")
        except Exception as e:
            current_app.logger.warning(f"Status enum might already be updated: {e}")


def migrate_existing_data():
    """Migrate existing tenant-apartment relationships to contract periods"""
    try:
        # Check if we have any existing contract periods
        existing_contracts = ContractPeriod.query.count()
        if existing_contracts > 0:
            current_app.logger.info(f"Found {existing_contracts} existing contract periods, skipping migration")
            return

        # Find tenants with direct apartment connections (legacy)
        tenants_with_apartments = db.session.query(Tenant).filter(
            db.column('apartment_id') != None
        ).all() if 'apartment_id' in [c.name for c in Tenant.__table__.columns] else []

        if not tenants_with_apartments:
            current_app.logger.info("No legacy tenant-apartment relationships to migrate")
            return

        current_app.logger.info(f"Migrating {len(tenants_with_apartments)} legacy tenant-apartment relationships")

        for tenant in tenants_with_apartments:
            if hasattr(tenant, 'apartment_id') and tenant.apartment_id:
                apartment = Apartment.query.get(tenant.apartment_id)
                if apartment:
                    # Create a contract period for this relationship
                    contract_number = f"LEGACY-{apartment.id}-{tenant.id}-{datetime.now().strftime('%Y%m%d')}"

                    # Use tenant's move-in date or default to today
                    start_date = tenant.moveInDate if hasattr(tenant, 'moveInDate') and tenant.moveInDate else date.today()
                    end_date = tenant.moveOutDate if hasattr(tenant, 'moveOutDate') and tenant.moveOutDate else None

                    contract_period = ContractPeriod(
                        apartment_id=apartment.id,
                        contract_number=contract_number,
                        start_date=start_date,
                        end_date=end_date,
                        monthly_rent=apartment.rent,
                        security_deposit=tenant.deposit if hasattr(tenant, 'deposit') else 0,
                        status='completed' if end_date and end_date < date.today() else 'active',
                        notes='Migrated from legacy system',
                        created_by='system_migration'
                    )

                    db.session.add(contract_period)
                    db.session.flush()

                    # Create contract tenant assignment
                    contract_tenant = ContractTenant(
                        contract_period_id=contract_period.id,
                        tenant_id=tenant.id,
                        is_primary=True,
                        move_in_date=start_date,
                        move_out_date=end_date,
                        rent_share_percentage=100.00,
                        notes='Migrated from legacy system'
                    )

                    db.session.add(contract_tenant)

                    current_app.logger.info(f"Migrated tenant {tenant.name} to contract period {contract_number}")

        db.session.commit()
        current_app.logger.info("Legacy data migration completed")

    except Exception as e:
        current_app.logger.error(f"Error during data migration: {e}")
        db.session.rollback()


def generate_sample_data():
    """Generate sample apartments and tenants if database is empty"""

    # Check if we already have data
    if Apartment.query.count() > 0 or Tenant.query.count() > 0:
        current_app.logger.info("Database already has data, skipping sample generation")
        return None, None

    current_app.logger.info("Generating sample data...")

    # Create sample landlord
    landlord = Landlord(
        name="Tel Aviv Properties Ltd",
        company_name="TAP Management",
        email="info@telavivprops.com",
        phone="+972-3-5555555",
        iban="IL620108000000099999999",
        company_address="123 Rothschild Blvd, Tel Aviv"
    )
    db.session.add(landlord)
    db.session.flush()

    # Sample apartments data
    apartments_data = [
        {
            "street_name": "Dizengoff",
            "house_number": "123",
            "city": "Tel Aviv",
            "floor": "3",
            "bedrooms": 2,
            "rent": 4500.00,
            "maxOccupancy": 2
        },
        {
            "street_name": "Rothschild",
            "house_number": "45",
            "city": "Tel Aviv",
            "floor": "5",
            "bedrooms": 3,
            "rent": 6000.00,
            "maxOccupancy": 3
        },
        {
            "street_name": "Ibn Gabirol",
            "house_number": "78",
            "city": "Tel Aviv",
            "floor": "2",
            "bedrooms": 1,
            "rent": 3500.00,
            "maxOccupancy": 2
        },
        {
            "street_name": "Allenby",
            "house_number": "90",
            "city": "Tel Aviv",
            "floor": "4",
            "bedrooms": 2,
            "rent": 5200.00,
            "maxOccupancy": 2
        }
    ]

    apartments = []
    for apt_data in apartments_data:
        apartment = Apartment(
            landlord_id=landlord.id,
            **apt_data,
            zip_code="6458101",
            country="Israel",
            bathrooms=1,
            area=65.5,
            genderPreference="mixed"
        )
        db.session.add(apartment)
        apartments.append(apartment)

    # Sample tenants data
    tenants_data = [
        {
            "name": "Sarah Cohen",
            "email": "sarah.cohen@email.com",
            "phone": "+972-54-1111111",
            "passport_id": "123456789",
            "gender": "female",
            "date_of_birth": date(1995, 3, 15)
        },
        {
            "name": "David Levi",
            "email": "david.levi@email.com",
            "phone": "+972-54-2222222",
            "passport_id": "987654321",
            "gender": "male",
            "date_of_birth": date(1992, 7, 22)
        },
        {
            "name": "Michael Brown",
            "email": "michael.brown@email.com",
            "phone": "+972-54-3333333",
            "passport_id": "456789123",
            "gender": "male",
            "date_of_birth": date(1998, 11, 8)
        },
        {
            "name": "Lisa Green",
            "email": "lisa.green@email.com",
            "phone": "+972-54-4444444",
            "passport_id": "789123456",
            "gender": "female",
            "date_of_birth": date(1994, 5, 30)
        },
        {
            "name": "John Miller",
            "email": "john.miller@email.com",
            "phone": "+972-54-5555555",
            "passport_id": "321654987",
            "gender": "male",
            "date_of_birth": date(1990, 1, 10)
        }
    ]

    tenants = []
    for tenant_data in tenants_data:
        tenant = Tenant(**tenant_data)
        db.session.add(tenant)
        tenants.append(tenant)

    db.session.flush()
    return apartments, tenants


def create_sample_contracts(apartments, tenants):
    """Create sample contract periods with tenant assignments"""

    if not apartments or not tenants:
        return []

    # Check if we already have contract periods
    if ContractPeriod.query.count() > 0:
        current_app.logger.info("Contract periods already exist, skipping")
        return []

    current_app.logger.info("Creating sample contract periods...")

    contracts_data = [
        {
            "apartment": apartments[0],  # Dizengoff
            "tenants": [
                {"tenant": tenants[0], "is_primary": True, "rent_share": 55},   # Sarah
                {"tenant": tenants[1], "is_primary": False, "rent_share": 45}   # David
            ],
            "start_date": date(2024, 9, 1),
            "end_date": date(2025, 8, 31),
            "monthly_rent": 4500.00,
            "security_deposit": 4500.00,
            "status": "active"
        },
        {
            "apartment": apartments[1],  # Rothschild
            "tenants": [
                {"tenant": tenants[4], "is_primary": True, "rent_share": 100}   # John (moved out)
            ],
            "start_date": date(2023, 6, 1),
            "end_date": date(2024, 5, 31),
            "monthly_rent": 6000.00,
            "security_deposit": 6000.00,
            "status": "completed"
        },
        {
            "apartment": apartments[2],  # Ibn Gabirol
            "tenants": [
                {"tenant": tenants[2], "is_primary": True, "rent_share": 100}   # Michael
            ],
            "start_date": date(2024, 11, 1),
            "end_date": date(2025, 10, 31),
            "monthly_rent": 3500.00,
            "security_deposit": 3500.00,
            "status": "active"
        },
        {
            "apartment": apartments[3],  # Allenby
            "tenants": [
                {"tenant": tenants[3], "is_primary": True, "rent_share": 60},   # Lisa
                {"tenant": tenants[1], "is_primary": False, "rent_share": 40}   # David (in 2 apartments)
            ],
            "start_date": date(2024, 12, 1),
            "end_date": date(2025, 11, 30),
            "monthly_rent": 5200.00,
            "security_deposit": 5200.00,
            "status": "active"
        },
        {
            "apartment": apartments[1],  # Rothschild - Future contract
            "tenants": [
                {"tenant": tenants[0], "is_primary": True, "rent_share": 100}   # Sarah (future)
            ],
            "start_date": date(2025, 9, 1),
            "end_date": date(2026, 8, 31),
            "monthly_rent": 6500.00,
            "security_deposit": 6500.00,
            "status": "future"
        }
    ]

    created_contracts = []
    for i, contract_data in enumerate(contracts_data, 1):
        contract_number = f"CNT-2024-{str(i).zfill(4)}"

        contract_period = ContractPeriod(
            apartment_id=contract_data["apartment"].id,
            contract_number=contract_number,
            start_date=contract_data["start_date"],
            end_date=contract_data["end_date"],
            monthly_rent=contract_data["monthly_rent"],
            security_deposit=contract_data["security_deposit"],
            status=contract_data["status"],
            notes=f"Sample contract for {contract_data['apartment'].get_short_address()}",
            created_by="system_init"
        )

        db.session.add(contract_period)
        db.session.flush()

        # Create tenant assignments
        for tenant_info in contract_data["tenants"]:
            # Determine move dates based on contract status
            if contract_data["status"] == "completed":
                move_out = contract_data["end_date"]
            elif contract_data["status"] == "future":
                move_out = None
            else:
                move_out = None

            contract_tenant = ContractTenant(
                contract_period_id=contract_period.id,
                tenant_id=tenant_info["tenant"].id,
                is_primary=tenant_info["is_primary"],
                move_in_date=contract_data["start_date"],
                move_out_date=move_out,
                rent_share_percentage=tenant_info["rent_share"],
                notes=f"{'Primary' if tenant_info['is_primary'] else 'Secondary'} tenant"
            )

            db.session.add(contract_tenant)

        created_contracts.append(contract_period)
        current_app.logger.info(f"Created contract {contract_number}")

    return created_contracts


def create_sample_payments(contract_periods):
    """Create sample payment records"""

    if not contract_periods or Payment.query.count() > 10:
        current_app.logger.info("Payments already exist or no contracts, skipping")
        return

    current_app.logger.info("Creating sample payments...")

    # Only create payments for active and completed contracts
    active_contracts = [cp for cp in contract_periods if cp.status in ['active', 'completed']]

    for contract in active_contracts:
        # Create deposit payment
        deposit_payment = Payment(
            contract_period_id=contract.id,
            apartment_id=contract.apartment_id,
            month=contract.start_date.month,
            year=contract.start_date.year,
            amount=contract.security_deposit,
            payment_date=datetime.combine(contract.start_date, datetime.min.time()),
            payment_method="bank_transfer",
            payment_type="deposit",
            deposit_payment=True,
            notes="Security deposit payment"
        )
        db.session.add(deposit_payment)

        # Create monthly rent payments
        current_date = contract.start_date
        end_date = min(contract.end_date or date.today(), date.today())

        while current_date <= end_date:
            # Determine if payment should be marked as paid
            is_paid = True
            payment_date = datetime(current_date.year, current_date.month, 5)

            # Make some recent payments outstanding for demo
            if contract.status == 'active' and current_date.year == 2025 and current_date.month >= 1:
                is_paid = False
                payment_date = None

            # Create tenant payment breakdown
            tenant_payments = {}
            for ct in contract.contract_tenants:
                tenant_amount = float(contract.monthly_rent) * (float(ct.rent_share_percentage) / 100)
                tenant_payments[str(ct.tenant_id)] = {
                    "tenant_name": ct.tenant.name,
                    "amount_due": tenant_amount,
                    "amount_paid": tenant_amount if is_paid else 0,
                    "paid_date": payment_date.isoformat() if payment_date else None,
                    "payment_method": "bank_transfer" if is_paid else None
                }

            payment = Payment(
                contract_period_id=contract.id,
                apartment_id=contract.apartment_id,
                month=current_date.month,
                year=current_date.year,
                amount=contract.monthly_rent,
                payment_date=payment_date,
                payment_method="bank_transfer" if is_paid else None,
                payment_type="rent",
                tenant_payments=json.dumps(tenant_payments),
                notes=f"{'PAID' if is_paid else 'OUTSTANDING'} - Rent for {current_date.strftime('%B %Y')}"
            )

            db.session.add(payment)

            # Move to next month
            if current_date.month == 12:
                current_date = date(current_date.year + 1, 1, 1)
            else:
                current_date = date(current_date.year, current_date.month + 1, 1)

    current_app.logger.info("Sample payments created")


def create_admin_user():
    """Create default admin user if it doesn't exist"""
    admin_username = "admin"
    admin_password = "admin123"

    existing_admin = User.query.filter_by(username=admin_username).first()
    if not existing_admin:
        admin_user = User(username=admin_username, role="admin", is_approved=True)
        admin_user.set_password(admin_password)
        db.session.add(admin_user)
        current_app.logger.info(f"Created admin user (username: {admin_username}, password: {admin_password})")
    else:
        current_app.logger.info(f"Admin user '{admin_username}' already exists")


def initialize_database():
    """Main function to initialize the database with proper structure and sample data"""
    try:
        current_app.logger.info("Starting database initialization...")

        # Step 1: Ensure database schema
        ensure_db_schema()

        # Step 2: Migrate existing data if needed
        migrate_existing_data()

        # Step 3: Generate sample data if needed
        apartments, tenants = generate_sample_data()

        # Step 4: Create sample contracts if data was generated
        if apartments and tenants:
            contract_periods = create_sample_contracts(apartments, tenants)

            # Step 5: Create sample payments
            create_sample_payments(contract_periods)

        # Step 6: Create admin user
        create_admin_user()

        # Final commit
        db.session.commit()

        # Log summary
        total_apartments = Apartment.query.count()
        total_tenants = Tenant.query.count()
        total_contracts = ContractPeriod.query.count()
        total_payments = Payment.query.count()
        outstanding_payments = Payment.query.filter(Payment.payment_date.is_(None)).count()

        current_app.logger.info(
            f"✅ Database initialization completed!\n"
            f"📊 Summary:\n"
            f"   • {total_apartments} apartments\n"
            f"   • {total_tenants} tenants\n"
            f"   • {total_contracts} contract periods\n"
            f"   • {total_payments} payments ({outstanding_payments} outstanding)\n"
        )

        return True

    except Exception as e:
        current_app.logger.error(f"Error during database initialization: {e}")
        db.session.rollback()
        raise


# Entry point for initialization
def init_app():
    """Entry point called from Flask app initialization"""
    with current_app.app_context():
        return initialize_database()


# Legacy compatibility functions for existing code
def ensure_default_apartment_exists(new_tenants_data=None):
    """Legacy function - now calls comprehensive initialization"""
    return initialize_database()


def ensure_new_apartment_exists(new_tenants_data=None):
    """Legacy function - now calls comprehensive initialization"""
    # Just return True since initialization is handled by initialize_database
    return True


def ensure_comprehensive_apartment_data():
    """Ensure comprehensive apartment data exists - safe to call multiple times"""
    # Check if we need to initialize
    apartment_count = Apartment.query.count()
    contract_count = ContractPeriod.query.count()

    if apartment_count < 3 or contract_count < 2:
        current_app.logger.info(
            f"Insufficient data found (apartments: {apartment_count}, contracts: {contract_count}), "
            f"initializing comprehensive dataset..."
        )
        return initialize_database()
    else:
        current_app.logger.info(
            f"✅ Found sufficient data (apartments: {apartment_count}, contracts: {contract_count}), "
            f"skipping initialization"
        )
        return True


def get_outstanding_summary():
    """Get summary of all outstanding payments"""
    try:
        outstanding_payments = Payment.query.filter(
            Payment.payment_date.is_(None)
        ).all()

        total_outstanding = sum(float(p.amount) for p in outstanding_payments)

        # Group by apartment
        by_apartment = {}
        for payment in outstanding_payments:
            apt_id = payment.apartment_id
            if apt_id not in by_apartment:
                apartment = Apartment.query.get(apt_id)
                by_apartment[apt_id] = {
                    "apartment": apartment.get_short_address() if apartment else f"Apartment {apt_id}",
                    "count": 0,
                    "amount": 0
                }
            by_apartment[apt_id]["count"] += 1
            by_apartment[apt_id]["amount"] += float(payment.amount)

        # Group by contract
        by_contract = {}
        for payment in outstanding_payments:
            if payment.contract_period_id:
                contract = ContractPeriod.query.get(payment.contract_period_id)
                if contract:
                    contract_key = contract.contract_number
                    if contract_key not in by_contract:
                        by_contract[contract_key] = {
                            "apartment": contract.apartment.get_short_address(),
                            "count": 0,
                            "amount": 0
                        }
                    by_contract[contract_key]["count"] += 1
                    by_contract[contract_key]["amount"] += float(payment.amount)

        return {
            "total": total_outstanding,
            "count": len(outstanding_payments),
            "by_apartment": by_apartment,
            "by_contract": by_contract,
            "payments": [p.to_dict(include_contract_period=False) for p in outstanding_payments[:10]]  # First 10
        }

    except Exception as e:
        current_app.logger.error(f"Error getting outstanding summary: {e}")
        return None
