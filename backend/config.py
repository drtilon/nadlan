# config.py
import os


class Config:
    DB_CONFIG = {
        "user": os.environ.get("DB_USER", "default_user"),
        "password": os.environ.get("DB_PASSWORD", "default_password"),
        "host": os.environ.get("DB_HOST", "mysql"),  # Adjust for your environment
        "database": os.environ.get("DB_NAME", "default_database"),
    }
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev_secret_key_change_in_production")
    TOKEN_EXPIRATION = 24  # hours
    SQLALCHEMY_DATABASE_URI = (
        os.environ.get("DATABASE_URL")
        or "mysql+pymysql://user:password@localhost/your_database_name"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
