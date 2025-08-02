# migration_contract_periods.py
from flask import Flask
from config import Config
from extentions import db
from models.models import Apartment, Tenant
from sqlalchemy import text
import sys
from datetime import datetime, date

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

def run_migration():
    """
    Run the contract periods migration.
    This will create the new tables and migrate existing data.
    """
    with app.app_context():
        try:
            print("Starting Contract Periods Migration...")
            print("=" * 50)

            # Step 1: Create new tables
            print("Step 1: Creating new tables...")
            create_contract_tables()

            # Step 2: Migrate existing data
            print("Step 2: Migrating existing apartment data...")
            migrate_existing_data()

            # Step 3: Update payments table
            print("Step 3: Updating payments table...")
            update_payments_table()

            # Step 4: Create views
            print("Step 4: Creating helpful views...")
            create_views()

            print("\n✅ Migration completed successfully!")
            print("=" * 50)
            print("Next steps:")
            print("1. Update your app.py to register the new contract_periods blueprint")
            print("2. Test the new contract management functionality")
            print("3. Update your frontend components")

        except Exception as e:
            print(f"❌ Migration failed: {e}")
            print("Rolling back changes...")
            db.session.rollback()
            return False

    return True

def create_contract_tables():
    """Create the new contract_periods and contract_tenants tables"""
    try:
        # Create contract_periods table
        db.engine.execute(text("""
            CREATE TABLE IF NOT EXISTS contract_periods (
                id INT AUTO_INCREMENT PRIMARY KEY,
                apartment_id INT NOT NULL,
                contract_number VARCHAR(50) UNIQUE,
                start_date DATE NOT NULL,
                end_date DATE NULL,
                monthly_rent DECIMAL(10, 2) NOT NULL,
                security_deposit DECIMAL(10, 2) DEFAULT 0.00,
                status ENUM('active', 'completed', 'terminated', 'pending') DEFAULT 'active',
                notes TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_by VARCHAR(80) NULL,

                FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
                INDEX idx_apartment_dates (apartment_id, start_date, end_date),
                INDEX idx_status (status),
                INDEX idx_contract_number (contract_number)
            )
        """))
        print("  ✅ Created contract_periods table")

        # Create contract_tenants table
        db.engine.execute(text("""
            CREATE TABLE IF NOT EXISTS contract_tenants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                contract_period_id INT NOT NULL,
                tenant_id INT NOT NULL,
                is_primary BOOLEAN DEFAULT FALSE,
                move_in_date DATE NULL,
                move_out_date DATE NULL,
                rent_share_percentage DECIMAL(5, 2) DEFAULT 100.00,
                notes TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (contract_period_id) REFERENCES contract_periods(id) ON DELETE CASCADE,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                UNIQUE KEY unique_contract_tenant (contract_period_id, tenant_id),
                INDEX idx_contract_period (contract_period_id),
                INDEX idx_tenant (tenant_id)
            )
        """))
        print("  ✅ Created contract_tenants table")

    except Exception as e:
        print(f"  ❌ Error creating tables: {e}")
        raise

def migrate_existing_data():
    """Migrate existing apartment data to contract periods"""
    try:
        # Get all apartments
        apartments = Apartment.query.all()
        print(f"  📊 Found {len(apartments)} apartments to migrate")

        migrated_count = 0

        for apartment in apartments:
            # Create legacy contract for each apartment
            contract_number = f"LEGACY-APT{apartment.id:03d}"

            # Check if legacy contract already exists
            existing = db.engine.execute(text(
                "SELECT id FROM contract_periods WHERE contract_number = :contract_number"
            ), {"contract_number": contract_number}).fetchone()

            if existing:
                print(f"    ⚠️  Legacy contract already exists for apartment {apartment.id}")
                continue

            # Determine contract status
            status = 'active'
            if apartment.contractEndDate and apartment.contractEndDate < date.today():
                status = 'completed'

            # Insert contract period
            result = db.engine.execute(text("""
                INSERT INTO contract_periods (
                    apartment_id, contract_number, start_date, end_date,
                    monthly_rent, security_deposit, status, notes, created_by
                ) VALUES (
                    :apartment_id, :contract_number, :start_date, :end_date,
                    :monthly_rent, :security_deposit, :status, :notes, :created_by
                )
            """), {
                "apartment_id": apartment.id,
                "contract_number": contract_number,
                "start_date": apartment.moveInDate or date.today(),
                "end_date": apartment.contractEndDate,
                "monthly_rent": apartment.rent,
                "security_deposit": apartment.deposit,
                "status": status,
                "notes": f"Legacy contract migrated from apartment data. Original notes: {apartment.notes or ''}",
                "created_by": "system_migration"
            })

            contract_id = result.lastrowid

            # Migrate tenants for this apartment
            tenants = Tenant.query.filter_by(apartment_id=apartment.id).all()
            tenant_count = len(tenants)

            if tenant_count > 0:
                rent_share = 100.0 / tenant_count

                for i, tenant in enumerate(tenants):
                    db.engine.execute(text("""
                        INSERT INTO contract_tenants (
                            contract_period_id, tenant_id, is_primary,
                            move_in_date, rent_share_percentage
                        ) VALUES (
                            :contract_period_id, :tenant_id, :is_primary,
                            :move_in_date, :rent_share_percentage
                        )
                    """), {
                        "contract_period_id": contract_id,
                        "tenant_id": tenant.id,
                        "is_primary": i == 0,  # First tenant is primary
                        "move_in_date": apartment.moveInDate,
                        "rent_share_percentage": rent_share
                    })

            migrated_count += 1
            print(f"    ✅ Migrated apartment {apartment.id}: {apartment.address} ({tenant_count} tenants)")

        db.session.commit()
        print(f"  ✅ Successfully migrated {migrated_count} apartments")

    except Exception as e:
        print(f"  ❌ Error migrating data: {e}")
        raise

def update_payments_table():
    """Add contract_period_id column to payments table"""
    try:
        # Check if column already exists
        result = db.engine.execute(text("""
            SELECT COUNT(*) as count FROM information_schema.COLUMNS
            WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'contract_period_id'
        """)).fetchone()

        if result and result[0] > 0:
            print("  ⚠️  contract_period_id column already exists in payments table")
        else:
            # Add the column
            db.engine.execute(text("""
                ALTER TABLE payments
                ADD COLUMN contract_period_id INT NULL,
                ADD FOREIGN KEY (contract_period_id) REFERENCES contract_periods(id) ON DELETE SET NULL,
                ADD INDEX idx_contract_period (contract_period_id)
            """))
            print("  ✅ Added contract_period_id column to payments table")

        # Try to associate existing payments with contract periods
        associate_payments_with_contracts()

    except Exception as e:
        print(f"  ❌ Error updating payments table: {e}")
        raise

def associate_payments_with_contracts():
    """Associate existing payments with their contract periods based on date ranges"""
    try:
        # Get all payments without contract association
        unassociated_payments = db.engine.execute(text("""
            SELECT p.id, p.apartment_id, p.paymentDate
            FROM payments p
            WHERE p.contract_period_id IS NULL AND p.paymentDate IS NOT NULL
        """)).fetchall()

        print(f"    📊 Found {len(unassociated_payments)} unassociated payments")

        associated_count = 0

        for payment in unassociated_payments:
            payment_id, apartment_id, payment_date = payment

            if not payment_date:
                continue

            # Find matching contract period
            contract = db.engine.execute(text("""
                SELECT id FROM contract_periods
                WHERE apartment_id = :apartment_id
                AND start_date <= :payment_date
                AND (end_date IS NULL OR end_date >= :payment_date)
                ORDER BY start_date DESC
                LIMIT 1
            """), {
                "apartment_id": apartment_id,
                "payment_date": payment_date
            }).fetchone()

            if contract:
                # Associate payment with contract
                db.engine.execute(text("""
                    UPDATE payments
                    SET contract_period_id = :contract_id
                    WHERE id = :payment_id
                """), {
                    "contract_id": contract[0],
                    "payment_id": payment_id
                })
                associated_count += 1

        db.session.commit()
        print(f"    ✅ Associated {associated_count} payments with contract periods")

    except Exception as e:
        print(f"    ❌ Error associating payments: {e}")
        raise

def create_views():
    """Create helpful database views"""
    try:
        # Create active contracts view
        db.engine.execute(text("""
            CREATE OR REPLACE VIEW active_contracts_view AS
            SELECT
                cp.id as contract_id,
                cp.apartment_id,
                a.address as apartment_address,
                cp.contract_number,
                cp.start_date,
                cp.end_date,
                cp.monthly_rent,
                cp.status,
                GROUP_CONCAT(
                    CONCAT(t.name, IF(ct.is_primary, ' (Primary)', ''))
                    ORDER BY ct.is_primary DESC, t.name
                    SEPARATOR ', '
                ) as tenants,
                COUNT(ct.tenant_id) as tenant_count,
                DATEDIFF(COALESCE(cp.end_date, CURDATE()), cp.start_date) as contract_duration_days
            FROM contract_periods cp
            JOIN apartments a ON cp.apartment_id = a.id
            LEFT JOIN contract_tenants ct ON cp.id = ct.contract_period_id
            LEFT JOIN tenants t ON ct.tenant_id = t.id
            WHERE cp.status = 'active'
            GROUP BY cp.id, cp.apartment_id, a.address, cp.contract_number, cp.start_date, cp.end_date, cp.monthly_rent, cp.status
        """))
        print("  ✅ Created active_contracts_view")

        # Create payments with contract view
        db.engine.execute(text("""
            CREATE OR REPLACE VIEW payments_with_contract_view AS
            SELECT
                p.*,
                cp.contract_number,
                cp.start_date as contract_start,
                cp.end_date as contract_end,
                a.address as apartment_address,
                GROUP_CONCAT(t.name ORDER BY ct.is_primary DESC, t.name SEPARATOR ', ') as contract_tenants
            FROM payments p
            LEFT JOIN contract_periods cp ON p.contract_period_id = cp.id
            LEFT JOIN apartments a ON p.apartment_id = a.id
            LEFT JOIN contract_tenants ct ON cp.id = ct.contract_period_id
            LEFT JOIN tenants t ON ct.tenant_id = t.id
            GROUP BY p.id
        """))
        print("  ✅ Created payments_with_contract_view")

    except Exception as e:
        print(f"  ❌ Error creating views: {e}")
        # Views are optional, so don't raise the error
        pass

def verify_migration():
    """Verify the migration was successful"""
    try:
        print("\nVerifying migration...")

        # Check contract_periods table
        contract_count = db.engine.execute(text("SELECT COUNT(*) FROM contract_periods")).fetchone()[0]
        print(f"  📊 Contract periods created: {contract_count}")

        # Check contract_tenants table
        tenant_assignments = db.engine.execute(text("SELECT COUNT(*) FROM contract_tenants")).fetchone()[0]
        print(f"  📊 Tenant assignments created: {tenant_assignments}")

        # Check payments association
        associated_payments = db.engine.execute(text(
            "SELECT COUNT(*) FROM payments WHERE contract_period_id IS NOT NULL"
        )).fetchone()[0]
        print(f"  📊 Payments associated with contracts: {associated_payments}")

        # Show sample data
        print("\n  Sample contract periods:")
        sample_contracts = db.engine.execute(text("""
            SELECT cp.contract_number, a.address, cp.start_date, cp.end_date, cp.status
            FROM contract_periods cp
            JOIN apartments a ON cp.apartment_id = a.id
            LIMIT 5
        """)).fetchall()

        for contract in sample_contracts:
            contract_number, address, start_date, end_date, status = contract
            end_str = end_date.strftime('%Y-%m-%d') if end_date else 'Ongoing'
            print(f"    • {contract_number}: {address} ({start_date.strftime('%Y-%m-%d')} - {end_str}) [{status}]")

        return True

    except Exception as e:
        print(f"  ❌ Error verifying migration: {e}")
        return False

if __name__ == "__main__":
    print("Contract Periods Migration Tool")
    print("This will create new tables and migrate existing apartment data.")
    print("Make sure to backup your database before running this migration!")

    confirmation = input("\nDo you want to proceed? (yes/no): ")
    if confirmation.lower() != 'yes':
        print("Migration cancelled.")
        sys.exit(0)

    success = run_migration()

    if success:
        verify_migration()
        print("\n🎉 Migration completed successfully!")
        print("\nNext steps:")
        print("1. Update your app.py to include the new routes:")
        print("   from routes.contract_periods import contract_periods_bp")
        print("   app.register_blueprint(contract_periods_bp, url_prefix='/api')")
        print("2. Update your models.py with the new contract models")
        print("3. Test the new functionality")
    else:
        print("\n❌ Migration failed. Please check the error messages above.")
        sys.exit(1)
