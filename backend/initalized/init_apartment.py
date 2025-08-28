# initalized/init_apartment.py - FIXED VERSION with correct month handling

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
    """Ensure database schema exists and is up to date"""
    try:
        current_app.logger.info("🔧 Ensuring database schema...")

        # Create all tables
        db.create_all()

        # Check if managementFee and rentCost columns exist, add them if they don't
        inspector = db.inspect(db.engine)
        apartment_columns = [col['name'] for col in inspector.get_columns('apartments')]

        if 'managementFee' not in apartment_columns:
            current_app.logger.info("Adding managementFee column to apartments table...")
            db.session.execute(text('ALTER TABLE apartments ADD COLUMN managementFee NUMERIC(10, 2) DEFAULT 0.00'))

        if 'rentCost' not in apartment_columns:
            current_app.logger.info("Adding rentCost column to apartments table...")
            db.session.execute(text('ALTER TABLE apartments ADD COLUMN rentCost NUMERIC(10, 2) DEFAULT 0.00'))

        db.session.commit()
        current_app.logger.info("✅ Database schema updated successfully")

    except Exception as e:
        current_app.logger.error(f"❌ Schema setup failed: {e}")
        db.session.rollback()
        raise


def generate_sample_data():
    """Generate sample apartments, landlords and tenants if they don't exist"""
    apartments = []
    tenants = []

    try:
        # Check if we have existing data
        existing_apartments = Apartment.query.count()
        existing_tenants = Tenant.query.count()

        if existing_apartments > 0 and existing_tenants > 0:
            current_app.logger.info("Sample data already exists, skipping generation...")
            apartments = Apartment.query.all()
            tenants = Tenant.query.all()
            return apartments, tenants

        current_app.logger.info("🏠 Creating sample landlords...")

        # Create sample landlords
        landlord1 = Landlord(
            name="David Ben Gurion",
            email="david@example.com",
            phone="+972-50-123-4567",
            company_name="Ben Gurion Real Estate",
            iban="IL620108000000012612345",
            company_address="123 Independence St, Tel Aviv, Israel"
        )

        landlord2 = Landlord(
            name="Golda Meir",
            email="golda@example.com",
            phone="+972-52-987-6543",
            company_name="Meir Properties Ltd",
            iban="IL620108000000098765432",
            company_address="456 Herzl Blvd, Jerusalem, Israel"
        )

        db.session.add_all([landlord1, landlord2])
        db.session.flush()  # Get IDs

        current_app.logger.info("🏠 Creating sample apartments...")

        # Create sample apartments
        sample_apartments = [
            {
                "full_address": "123 Dizengoff Street, Tel Aviv, Israel",
                "address": "123 Dizengoff Street",
                "street_name": "Dizengoff",
                "house_number": "123",
                "city": "Tel Aviv",
                "zip_code": "12345",
                "model": "rental",
                "rent": 5500.00,
                "deposit": 11000.00,
                "landlord_id": landlord1.id,
                "managementFee": 550.00,
                "rentCost": 4950.00
            },
            {
                "full_address": "456 Ben Yehuda Street, Tel Aviv, Israel",
                "address": "456 Ben Yehuda Street",
                "street_name": "Ben Yehuda",
                "house_number": "456",
                "city": "Tel Aviv",
                "zip_code": "67890",
                "model": "management",
                "rent": 4500.00,
                "deposit": 9000.00,
                "landlord_id": landlord2.id,
                "managementFee": 450.00,
                "rentCost": 4050.00
            },
            {
                "full_address": "789 Rothschild Boulevard, Tel Aviv, Israel",
                "address": "789 Rothschild Boulevard",
                "street_name": "Rothschild",
                "house_number": "789",
                "city": "Tel Aviv",
                "zip_code": "54321",
                "model": "rental",
                "rent": 6200.00,
                "deposit": 12400.00,
                "landlord_id": landlord1.id,
                "managementFee": 620.00,
                "rentCost": 5580.00
            }
        ]

        for apt_data in sample_apartments:
            apartment = Apartment(**apt_data)
            apartments.append(apartment)
            db.session.add(apartment)

        current_app.logger.info("👥 Creating sample tenants...")

        # Create sample tenants
        sample_tenants = [
            {
                "name": "Sarah Cohen",
                "email": "sarah.cohen@example.com",
                "phone": "+972-54-111-2222",
                "passport_id": "123456789",
                "gender": "female",
                "date_of_birth": date(1990, 5, 15),
                "refund_iban": "IL620108000000111111111"
            },
            {
                "name": "David Levi",
                "email": "david.levi@example.com",
                "phone": "+972-53-333-4444",
                "passport_id": "987654321",
                "gender": "male",
                "date_of_birth": date(1985, 8, 20),
                "refund_iban": "IL620108000000222222222"
            },
            {
                "name": "Rachel Green",
                "email": "rachel.green@example.com",
                "phone": "+972-52-555-6666",
                "passport_id": "456789123",
                "gender": "female",
                "date_of_birth": date(1992, 11, 10),
                "refund_iban": "IL620108000000333333333"
            },
            {
                "name": "Michael Brown",
                "email": "michael.brown@example.com",
                "phone": "+972-55-777-8888",
                "passport_id": "789123456",
                "gender": "male",
                "date_of_birth": date(1988, 2, 28),
                "refund_iban": "IL620108000000444444444"
            }
        ]

        for tenant_data in sample_tenants:
            tenant = Tenant(**tenant_data)
            tenants.append(tenant)
            db.session.add(tenant)

        db.session.flush()
        current_app.logger.info(f"Created {len(apartments)} apartments and {len(tenants)} tenants")

        return apartments, tenants

    except Exception as e:
        current_app.logger.error(f"Error generating sample data: {e}")
        db.session.rollback()
        raise


def create_sample_contracts(apartments, tenants):
    """Create sample contract periods with tenant assignments"""
    contract_periods = []

    try:
        # Check if contracts already exist
        existing_contracts = ContractPeriod.query.count()
        if existing_contracts > 0:
            current_app.logger.info("Contracts already exist, skipping creation...")
            return ContractPeriod.query.all()

        current_app.logger.info("📋 Creating sample contracts...")

        # Contract 1: Apartment 1 with 2 tenants
        contract1 = ContractPeriod(
            apartment_id=apartments[0].id,
            contract_number="CON-2025-001",
            start_date=date(2025, 6, 1),
            end_date=date(2026, 5, 31),
            monthly_rent=apartments[0].rent,
            security_deposit=apartments[0].deposit,
            status="active",
            notes="Standard 12-month rental agreement"
        )

        db.session.add(contract1)
        db.session.flush()

        # Assign tenants to contract 1
        ct1_1 = ContractTenant(
            contract_period_id=contract1.id,
            tenant_id=tenants[0].id,
            rent_share_percentage=55.0,
            is_primary=True,
            move_in_date=date(2025, 6, 1)
        )

        ct1_2 = ContractTenant(
            contract_period_id=contract1.id,
            tenant_id=tenants[1].id,
            rent_share_percentage=45.0,
            is_primary=False,
            move_in_date=date(2025, 6, 1)
        )

        db.session.add_all([ct1_1, ct1_2])

        # Contract 2: Apartment 2 with 1 tenant
        contract2 = ContractPeriod(
            apartment_id=apartments[1].id,
            contract_number="CON-2025-002",
            start_date=date(2025, 7, 1),
            end_date=date(2026, 6, 30),
            monthly_rent=apartments[1].rent,
            security_deposit=apartments[1].deposit,
            status="active",
            notes="Management model contract"
        )

        db.session.add(contract2)
        db.session.flush()

        ct2_1 = ContractTenant(
            contract_period_id=contract2.id,
            tenant_id=tenants[2].id,
            rent_share_percentage=100.0,
            is_primary=True,
            move_in_date=date(2025, 7, 1)
        )

        db.session.add(ct2_1)

        # Contract 3: Apartment 3 with 2 tenants
        contract3 = ContractPeriod(
            apartment_id=apartments[2].id,
            contract_number="CON-2025-003",
            start_date=date(2025, 8, 1),
            end_date=date(2026, 7, 31),
            monthly_rent=apartments[2].rent,
            security_deposit=apartments[2].deposit,
            status="active",
            notes="Premium location rental"
        )

        db.session.add(contract3)
        db.session.flush()

        ct3_1 = ContractTenant(
            contract_period_id=contract3.id,
            tenant_id=tenants[1].id,  # David can have multiple contracts
            rent_share_percentage=60.0,
            is_primary=True,
            move_in_date=date(2025, 8, 1)
        )

        ct3_2 = ContractTenant(
            contract_period_id=contract3.id,
            tenant_id=tenants[3].id,
            rent_share_percentage=40.0,
            is_primary=False,
            move_in_date=date(2025, 8, 1)
        )

        db.session.add_all([ct3_1, ct3_2])

        contract_periods = [contract1, contract2, contract3]
        db.session.flush()

        current_app.logger.info(f"Created {len(contract_periods)} contract periods")
        return contract_periods

    except Exception as e:
        current_app.logger.error(f"Error creating contracts: {e}")
        db.session.rollback()
        raise


def create_sample_payments(contract_periods):
    """Create sample payment records for the contracts"""
    try:
        # Check if payments already exist
        existing_payments = Payment.query.count()
        if existing_payments > 0:
            current_app.logger.info("Payments already exist, skipping creation...")
            return

        current_app.logger.info("💰 Creating sample payments...")

        for contract in contract_periods:
            # Create payments for each month from contract start to current month
            start_date = contract.start_date
            current_date = datetime.now().date()

            # Create payments from start date to current month
            payment_date = start_date.replace(day=1)

            while payment_date <= current_date and payment_date <= (contract.end_date or date(2030, 12, 31)):
                # Determine if payment is paid (past months) or outstanding (future months)
                is_paid = payment_date < current_date

                # Calculate tenant payments based on rent share
                tenant_payments = []
                for ct in contract.contract_tenants:
                    if ct.is_active():
                        tenant_amount = float(contract.monthly_rent) * (float(ct.rent_share_percentage) / 100.0)
                        tenant_payments.append({
                            "tenantId": ct.tenant_id,
                            "tenantName": ct.tenant.name,
                            "amountPaid": tenant_amount if is_paid else 0.0,
                            "isPrimary": ct.is_primary
                        })

                # FIXED: Use month number instead of month name
                payment = Payment(
                    apartment_id=contract.apartment_id,
                    contract_period_id=contract.id,
                    month=payment_date.month,  # Use integer month (1-12)
                    year=payment_date.year,
                    amount=contract.monthly_rent,
                    payment_date=payment_date if is_paid else None,
                    payment_method="bank_transfer" if is_paid else None,
                    payment_type="rent",
                    internet=0.0,
                    electricity=0.0,
                    other=0.0,
                    tenant_payments=json.dumps(tenant_payments),
                    extraPayments="{}",
                    status="paid" if is_paid else "outstanding",
                    notes=f"{'PAID' if is_paid else 'OUTSTANDING'} - Rent for {payment_date.strftime('%B %Y')}"
                )

                db.session.add(payment)

                # Move to next month
                if payment_date.month == 12:
                    payment_date = payment_date.replace(year=payment_date.year + 1, month=1)
                else:
                    payment_date = payment_date.replace(month=payment_date.month + 1)

        current_app.logger.info("Sample payments created")

    except Exception as e:
        current_app.logger.error(f"Error creating sample payments: {e}")
        db.session.rollback()
        raise


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
        current_app.logger.info("🚀 Starting database initialization...")

        # Step 1: Ensure database schema
        ensure_db_schema()

        # Step 2: Generate sample data if needed
        apartments, tenants = generate_sample_data()

        # Step 3: Create sample contracts if data was generated
        if apartments and tenants:
            contract_periods = create_sample_contracts(apartments, tenants)

            # Step 4: Create sample payments
            create_sample_payments(contract_periods)

        # Step 5: Create admin user
        create_admin_user()

        # Final commit
        db.session.commit()

        # Log summary
        total_apartments = Apartment.query.count()
        total_tenants = Tenant.query.count()
        total_contracts = ContractPeriod.query.count()
        total_assignments = ContractTenant.query.count()
        total_payments = Payment.query.count()

        current_app.logger.info("✅ Database initialization completed successfully!")
        current_app.logger.info(f"📊 Summary: {total_apartments} apartments, {total_tenants} tenants, {total_contracts} contracts, {total_assignments} tenant assignments, {total_payments} payments")

        return True

    except Exception as e:
        current_app.logger.error(f"❌ Database initialization failed: {e}")
        db.session.rollback()
        return False
