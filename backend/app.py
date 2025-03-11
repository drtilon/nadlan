# app.py - Updated with logs blueprint
from flask import Flask, current_app
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config
from flasgger import Swagger
from extentions import db, jwt, bcrypt
from sqlalchemy.exc import OperationalError
import time
from models.models import Apartment, Tenant, User
from initalized.init_user import ensure_admin_user_exists
from initalized.init_apartment import (
    ensure_default_apartment_exists,
    ensure_new_apartment_exists,
)


def wait_for_mysql(app):
    """Retry MySQL connection until it's available."""
    max_retries = 10
    retries = 0
    while retries < max_retries:
        try:
            with app.app_context():
                app.logger.info("Running db.create_all()...")
                db.create_all()
                current_app.logger.info("Database connection successful!")
            return
        except OperationalError as e:
            current_app.logger.error(
                f"MySQL not ready yet ({e}). Retrying in 5 seconds..."
            )
            time.sleep(5)
            retries += 1

    current_app.logger.error("Failed to connect to MySQL after multiple attempts.")
    exit(1)


def create_app():
    try:
        app = Flask(__name__)
        app.config.from_object(Config)

        try:
            # For production with credentials enabled, you must specify a concrete origin.
            # Make sure to set CORS_ALLOWED_ORIGINS in your Config (e.g., "https://your-production-domain.com")
            allowed_origins = app.config.get(
                "CORS_ALLOWED_ORIGINS", "http://localhost:3001"
            )
            CORS(
                app,
                resources={
                    r"/*": {"origins": allowed_origins, "supports_credentials": True}
                },
            )
        except Exception as e:
            app.logger.error(f"Error initializing CORS: {e}")

        try:
            db.init_app(app)
            jwt.init_app(app)
            bcrypt.init_app(app)
            Swagger(app)
        except Exception as e:
            app.logger.error(f"Error initializing extensions: {e}")

        try:
            with app.app_context():
                wait_for_mysql(app)
                ensure_admin_user_exists()
                ensure_default_apartment_exists()
                ensure_new_apartment_exists()
        except Exception as e:
            app.logger.error(f"Error initializing DB: {e}")

        try:
            from routes.auth_routes import auth_bp
            from routes.apartments import apartments_bp
            from routes.tenants import tenants_bp
            from routes.adminPanel.user_actions import adminPanel_bp
            from routes.payments import payments_bp
            from routes.analytics import analytics_bp
            from routes.documents import documents_bp
            from routes.logs import logs_bp  # Import the new logs blueprint
            from routes.payment_history import payment_history_bp

            app.register_blueprint(auth_bp, url_prefix="/api/auth")
            app.register_blueprint(adminPanel_bp, url_prefix="/api/adminPanel")
            app.register_blueprint(apartments_bp, url_prefix="/api/")
            app.register_blueprint(tenants_bp, url_prefix="/api/")
            app.register_blueprint(payments_bp, url_prefix="/api/")
            app.register_blueprint(analytics_bp, url_prefix="/api/")
            app.register_blueprint(payment_history_bp, url_prefix="/api")
            # app.register_blueprint(documents_bp, url_prefix="/api/documents")
            app.register_blueprint(
                logs_bp, url_prefix="/api"
            )  # Register logs blueprint
            app.logger.info("Blueprints registered")
        except Exception as e:
            app.logger.error(f"Error registering blueprints: {e}")

        return app

    except Exception as e:
        # If the app hasn't been created, fall back to using Python's logging
        import logging

        logging.error(f"Critical error creating the Flask app: {e}")
        return None


if __name__ == "__main__":
    app = create_app()
    # In production, you should disable debug mode
    app.run(debug=True, host="0.0.0.0", port=5001)
