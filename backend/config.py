# config.py

import os

class Config:
    DB_CONFIG = {
        "user": os.environ.get("DB_USER"),
        "password": os.environ.get("DB_PASSWORD"),
        "host": os.environ.get("DB_HOST"),
        "database": os.environ.get("DB_NAME"),
    }

    SECRET_KEY = os.environ.get("SECRET_KEY")
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY environment variable is required")
    TOKEN_EXPIRATION = 24  # hours

    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:3306/{DB_CONFIG['database']}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # File upload configuration - CHANGED: 20MB → 50MB
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB total request size
    UPLOAD_FOLDER = 'uploads'

    # Additional Flask configuration for better file handling
    SEND_FILE_MAX_AGE_DEFAULT = 0
    MAX_FORM_MEMORY_SIZE = 50 * 1024 * 1024  # 50MB form memory

    # Timeout settings
    PERMANENT_SESSION_LIFETIME = 1800  # 30 minutes
