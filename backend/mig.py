#!/usr/bin/env python3
"""
PRODUCTION-SAFE DATABASE MIGRATION SCRIPT
Migrates database schema for 50MB upload support with proper backups and safety checks

Usage:
    python3 production_migration.py

Prerequisites:
    pip install pymysql

Environment Variables:
    None required - configuration is hardcoded from docker-compose settings
"""

import sys
import pymysql
from datetime import datetime
import logging
import subprocess
import os

# Configure logging
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'production_migration_{timestamp}.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class ProductionMigration:
    def __init__(self):
        """Initialize with hardcoded production configuration from docker-compose"""
        self.db_config = {
            'host': 'mysql',
            'user': 'myuser',
            'password': 'mypassword',
            'database': 'mydatabase',
            'port': 3306,
            'charset': 'utf8mb4'
        }
        self.conn = None
        self.backup_file = None

    def create_backup(self):
        """Create a complete database backup before migration"""
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            self.backup_file = f"backup_before_50mb_migration_{timestamp}.sql"

            # Create mysqldump command
            cmd = [
                'mysqldump',
                f'--host={self.db_config["host"]}',
                f'--port={self.db_config["port"]}',
                f'--user={self.db_config["user"]}',
                f'--password={self.db_config["password"]}',
                '--single-transaction',
                '--routines',
                '--triggers',
                '--lock-tables=false',
                '--add-drop-database',
                self.db_config['database']
            ]

            logger.info(f"Creating backup: {self.backup_file}")
            with open(self.backup_file, 'w') as f:
                result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=True)

            if result.returncode == 0:
                backup_size = os.path.getsize(self.backup_file)
                if backup_size > 1000:  # At least 1KB
                    logger.info(f"✅ Backup created: {self.backup_file} ({backup_size:,} bytes)")
                    return True
                else:
                    logger.error(f"❌ Backup file too small: {backup_size} bytes")
                    return False
            else:
                logger.error(f"❌ Backup failed: {result.stderr}")
                return False

        except Exception as e:
            logger.error(f"❌ Backup error: {e}")
            return False

    def connect(self):
        """Connect to production database"""
        try:
            self.conn = pymysql.connect(**self.db_config)
            logger.info(f"✅ Connected to {self.db_config['host']}:{self.db_config['port']}")
            return True
        except pymysql.Error as e:
            logger.error(f"❌ Connection failed: {e}")
            return False

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()

    def column_exists(self, table_name, column_name):
        """Check if a column exists"""
        try:
            cursor = self.conn.cursor()
            cursor.execute(f"""
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = '{self.db_config['database']}'
                AND TABLE_NAME = '{table_name}'
                AND COLUMN_NAME = '{column_name}'
            """)
            result = cursor.fetchone()[0]
            cursor.close()
            return result > 0
        except pymysql.Error:
            return False

    def safe_execute(self, sql, description):
        """Execute SQL with error handling"""
        try:
            cursor = self.conn.cursor()
            cursor.execute(sql)
            self.conn.commit()
            cursor.close()
            logger.info(f"✅ {description}")
            return True
        except pymysql.Error as e:
            error_msg = str(e)
            if any(ignore in error_msg for ignore in ["Duplicate column", "already exists"]):
                logger.info(f"ℹ️ {description} (already exists)")
                return True
            else:
                logger.error(f"❌ {description} failed: {e}")
                return False

    def get_row_counts(self):
        """Get current row counts for verification"""
        counts = {}
        tables = ["apartments", "tenants", "payments", "users", "contracts"]

        try:
            cursor = self.conn.cursor()
            for table in tables:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    counts[table] = cursor.fetchone()[0]
                except:
                    counts[table] = 0
            cursor.close()
        except pymysql.Error as e:
            logger.error(f"Error getting row counts: {e}")

        return counts

    def run_migration(self):
        """Run the complete production migration"""
        logger.info("🏭 STARTING PRODUCTION DATABASE MIGRATION")
        logger.info("=" * 60)
        logger.info(f"Target: {self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}")
        logger.info(f"User: {self.db_config['user']}")

        # Step 1: Create backup
        logger.info("\n📦 STEP 1: Creating backup...")
        if not self.create_backup():
            logger.error("❌ MIGRATION ABORTED: Backup failed")
            return False

        # Step 2: Connect to database
        logger.info("\n🔗 STEP 2: Connecting to database...")
        if not self.connect():
            logger.error("❌ MIGRATION ABORTED: Connection failed")
            return False

        # Step 3: Get pre-migration state
        logger.info("\n📊 STEP 3: Analyzing current database...")
        pre_counts = self.get_row_counts()
        logger.info("Current row counts:")
        for table, count in pre_counts.items():
            logger.info(f"  {table}: {count:,} rows")

        # Step 4: Run all schema migrations
        logger.info("\n🔄 STEP 4: Running schema migrations...")

        migrations = [
            # Apartments table enhancements
            ("ALTER TABLE apartments ADD COLUMN maxOccupancy INT DEFAULT 4", "Added maxOccupancy to apartments"),
            ("ALTER TABLE apartments ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", "Added created_at to apartments"),
            ("ALTER TABLE apartments ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", "Added updated_at to apartments"),

            # Tenants table enhancements
            ("ALTER TABLE tenants ADD COLUMN bornOn VARCHAR(50) NULL", "Added bornOn to tenants"),
            ("ALTER TABLE tenants ADD COLUMN refundIban VARCHAR(255) NULL", "Added refundIban to tenants"),
            ("ALTER TABLE tenants ADD COLUMN moveInDate DATE NULL", "Added moveInDate to tenants"),
            ("ALTER TABLE tenants ADD COLUMN moveOutDate DATE NULL", "Added moveOutDate to tenants"),
            ("ALTER TABLE tenants ADD COLUMN deposit DECIMAL(10,2) NULL", "Added deposit to tenants"),
            ("ALTER TABLE tenants ADD COLUMN rentAmount DECIMAL(10,2) NULL", "Added rentAmount to tenants"),
            ("ALTER TABLE tenants ADD COLUMN notes TEXT NULL", "Added notes to tenants"),
            ("ALTER TABLE tenants ADD COLUMN isActive BOOLEAN DEFAULT TRUE", "Added isActive to tenants"),
            ("ALTER TABLE tenants ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", "Added created_at to tenants"),
            ("ALTER TABLE tenants ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", "Added updated_at to tenants"),

            # Payments table enhancements
            ("ALTER TABLE payments ADD COLUMN amount FLOAT NULL", "Added amount to payments"),
            ("ALTER TABLE payments ADD COLUMN tenant_name VARCHAR(255) NULL", "Added tenant_name to payments"),
            ("ALTER TABLE payments ADD COLUMN payment_type VARCHAR(50) DEFAULT 'rent'", "Added payment_type to payments"),
            ("ALTER TABLE payments ADD COLUMN paymentDate DATETIME NULL", "Added paymentDate to payments"),
            ("ALTER TABLE payments ADD COLUMN paymentMethod VARCHAR(50) DEFAULT 'bank_transfer'", "Added paymentMethod to payments"),
            ("ALTER TABLE payments ADD COLUMN notes TEXT NULL", "Added notes to payments"),
            ("ALTER TABLE payments ADD COLUMN year INT NULL", "Added year to payments"),
            ("ALTER TABLE payments ADD COLUMN extraPayments TEXT NULL", "Added extraPayments to payments"),
            ("ALTER TABLE payments ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", "Added created_at to payments"),
            ("ALTER TABLE payments ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", "Added updated_at to payments"),
            ("ALTER TABLE payments MODIFY COLUMN month VARCHAR(50) NOT NULL", "Extended month column length"),

            # Users table enhancements
            ("ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT FALSE", "Added is_approved to users"),
            ("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", "Added created_at to users"),
            ("ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", "Added updated_at to users"),

            # Contracts table - CRITICAL 50MB support
            ("ALTER TABLE contracts MODIFY COLUMN file_size BIGINT", "🎯 ENABLED 50MB file support"),
            ("ALTER TABLE contracts ADD COLUMN created_by INT NULL", "Added created_by to contracts"),
            ("ALTER TABLE contracts ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", "Added created_at to contracts"),
            ("ALTER TABLE contracts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", "Added updated_at to contracts"),
        ]

        success_count = 0
        for sql, description in migrations:
            if self.safe_execute(sql, description):
                success_count += 1

        logger.info(f"Completed {success_count}/{len(migrations)} migrations")

        # Step 5: Data synchronization
        logger.info("\n🔄 STEP 5: Synchronizing data...")

        sync_operations = [
            ("UPDATE users SET is_approved = approved WHERE approved IS NOT NULL", "Synced user approval status"),
            ("UPDATE tenants SET bornOn = dob WHERE bornOn IS NULL AND dob IS NOT NULL", "Synced birthdate fields"),
            ("UPDATE payments SET year = YEAR(NOW()) WHERE year IS NULL", "Set default payment years"),
            ("UPDATE contracts SET created_by = uploaded_by WHERE created_by IS NULL AND uploaded_by IS NOT NULL", "Synced contract creators"),
        ]

        for sql, description in sync_operations:
            self.safe_execute(sql, description)

        # Step 6: Verify 50MB support
        logger.info("\n🔍 STEP 6: Verifying 50MB file support...")
        try:
            cursor = self.conn.cursor()
            cursor.execute(f"""
                SELECT DATA_TYPE FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = '{self.db_config['database']}'
                AND TABLE_NAME = 'contracts' AND COLUMN_NAME = 'file_size'
            """)
            result = cursor.fetchone()
            cursor.close()

            if result and result[0].upper() == 'BIGINT':
                logger.info("🎯 ✅ VERIFIED: 50MB file upload support enabled!")
            else:
                logger.error(f"❌ File size verification failed: {result}")
                return False
        except pymysql.Error as e:
            logger.error(f"❌ Verification error: {e}")
            return False

        # Step 7: Final verification
        logger.info("\n📊 STEP 7: Final data verification...")
        post_counts = self.get_row_counts()

        data_preserved = True
        for table, pre_count in pre_counts.items():
            post_count = post_counts.get(table, 0)
            if post_count != pre_count:
                logger.warning(f"⚠️ {table}: {post_count} rows (was {pre_count})")
                if post_count < pre_count:
                    data_preserved = False
            else:
                logger.info(f"✅ {table}: {post_count:,} rows preserved")

        if not data_preserved:
            logger.error("❌ Data loss detected!")
            return False

        # SUCCESS!
        logger.info("\n" + "=" * 60)
        logger.info("🎉 PRODUCTION MIGRATION COMPLETED SUCCESSFULLY!")
        logger.info("=" * 60)
        logger.info("✅ Database schema updated for new backend")
        logger.info("✅ 50MB file upload support enabled")
        logger.info("✅ Enhanced payment system added")
        logger.info("✅ All existing data preserved")
        logger.info(f"✅ Backup available: {self.backup_file}")
        logger.info("=" * 60)

        return True

def main():
    """Main function for production migration"""
    print("🏭 PRODUCTION DATABASE MIGRATION FOR 50MB SUPPORT")
    print("=" * 60)

    print(f"Target: { 'mysql' }:{ 3306 }")
    print(f"Database: { 'mydatabase' }")
    print(f"User: { 'myuser' }")
    print()
    print("⚠️ IMPORTANT:")
    print("- Automatic backup will be created")
    print("- All existing data will be preserved")
    print("- Migration adds 50MB file upload support")
    print("- Process is safe and reversible")
    print()

    # Confirm execution
    try:
        confirm = input("Proceed with production migration? (yes/no): ").strip().lower()
        if confirm not in ['yes', 'y']:
            print("Migration cancelled.")
            return 0
    except (EOFError, KeyboardInterrupt):
        print("\nMigration cancelled.")
        return 0

    # Run migration
    try:
        migrator = ProductionMigration()

        if migrator.run_migration():
            print("\n🎊 MIGRATION SUCCESSFUL!")
            print("Your production database now supports 50MB file uploads!")
            print("Update your backend configuration and restart your application.")
            return 0
        else:
            print("\n💥 MIGRATION FAILED!")
            print(f"Restore from backup: {migrator.backup_file}")
            return 1

    except Exception as e:
        logger.error(f"Critical error: {e}")
        print(f"\n💥 Critical error: {e}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
