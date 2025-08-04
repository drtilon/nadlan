# config.py

import os

class Config:
    DB_CONFIG = {
        "user": os.environ.get("DB_USER", "default_user"),
        "password": os.environ.get("DB_PASSWORD", "default_password"),
        "host": os.environ.get("DB_HOST", "mysql_db"),
        "database": os.environ.get("DB_NAME", "default_database"),
    }

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev_secret_key_change_in_production")
    TOKEN_EXPIRATION = 24  # hours

    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:3306/{DB_CONFIG['database']}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # File upload configuration - INCREASED limits for 32MB+ files
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB total request size (increased from 20MB)
    UPLOAD_FOLDER = 'uploads'

    # Additional Flask configuration for better file handling
    SEND_FILE_MAX_AGE_DEFAULT = 0
    MAX_FORM_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB form memory (increased from 20MB)

    # Timeout settings
    PERMANENT_SESSION_LIFETIME = 1800  # 30 minutes
