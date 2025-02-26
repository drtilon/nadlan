# db.py
import time
import mysql.connector
from flask import current_app


def get_db_connection(retries=5, delay=5):
    """
    Attempt to connect to the database, retrying if necessary.
    """
    db_config = current_app.config["DB_CONFIG"]
    for attempt in range(retries):
        try:
            connection = mysql.connector.connect(**db_config)
            if connection.is_connected():
                current_app.logger.info("Connected to MySQL")
                return connection
        except mysql.connector.Error as err:
            current_app.logger.error(
                f"Database connection error on attempt {attempt + 1}: {err}"
            )
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                raise
    raise Exception("Could not connect to the database after multiple attempts.")


def init_db():
    """
    Initialize database tables if they don't exist.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Apartments table: includes fields for management or rental model.
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS apartments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        address VARCHAR(255) NOT NULL,
        rooms VARCHAR(50),
        size VARCHAR(50),
        tenants JSON,
        landlordName VARCHAR(255),
        landlordEmail VARCHAR(255),
        landlordPhone VARCHAR(50),
        moveInDate DATE,
        contractEndDate DATE,
        rent VARCHAR(50),
        deposit VARCHAR(50),
        notes TEXT,
        IBAN VARCHAR(100),
        status VARCHAR(50),
        model VARCHAR(50) DEFAULT 'management',  -- 'management' or 'rental'
        management_fee DECIMAL(5,2) DEFAULT 0,   -- if management model
        rent_cost DECIMAL(10,2) DEFAULT 0,       -- if rental model
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
    """)

    # Payments table: stores monthly payment info.
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        apartment_id INT NOT NULL,
        month VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        tenants JSON,
        internet DECIMAL(10,2) DEFAULT 0,
        electricity DECIMAL(10,2) DEFAULT 0,
        other DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE
    )
    """)

    conn.commit()
    cursor.close()
    conn.close()
