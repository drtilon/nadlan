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
    TOKEN_EXPIRATION = (
        24  # hours - was already set to 24 hours but not being used in auth.py
    )

    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:3306/{DB_CONFIG['database']}"
    # SQLALCHEMY_ECHO = True
    SQLALCHEMY_TRACK_MODIFICATIONS = False
