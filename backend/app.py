# app.py
from flask import Flask, current_app, request, Response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config
from flasgger import Swagger
from extentions import db, jwt, bcrypt
from sqlalchemy.exc import OperationalError
import time
from models.models import Apartment, Tenant, User, Landlord
from initalized.init_user import ensure_admin_user_exists
from initalized.init_apartment import (
    ensure_default_apartment_exists,
    ensure_new_apartment_exists,
)
import os
from dotenv import load_dotenv
from activity_logger import ActivityLogger, configure_activity_logger


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

        # Set file upload limits - INCREASED for larger files
        app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size (increased from 50MB)
        app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'uploads')

        # Additional configuration for better file handling
        app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # Disable caching for file uploads

        try:
            # Allow requests from any origin during development
            # For production, specify your frontend domain
            allowed_origins = os.environ.get(
                "CORS_ALLOWED_ORIGINS",
                "https://www.shefaug.com,https://shefaug.com,http://localhost,http://localhost:80,http://localhost:3001,http://207.154.221.54",
            ).split(",")
            # Strip whitespace from origins
            allowed_origins = [origin.strip() for origin in allowed_origins]

            app.logger.info(f"Configuring CORS with origins: {allowed_origins}")

            CORS(
                app,
                resources={
                    r"/api/*": {
                        "origins": allowed_origins,
                        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                        "allow_headers": [
                            "Content-Type",
                            "Authorization",
                            "X-Requested-With",
                        ],
                        "supports_credentials": True,
                        "expose_headers": ["Authorization"],
                        "max_age": 600,  # Cache preflight requests for 10 minutes
                    }
                },
                supports_credentials=True,
            )

            # Add OPTIONS handler for preflight requests
            @app.before_request
            def handle_preflight():
                if request.method == "OPTIONS":
                    response = Response()
                    origin = request.headers.get("Origin")
                    if origin in allowed_origins:
                        response.headers.add("Access-Control-Allow-Origin", origin)
                    else:
                        response.headers.add("Access-Control-Allow-Origin", "*")
                    response.headers.add(
                        "Access-Control-Allow-Headers",
                        "Content-Type,Authorization,X-Requested-With",
                    )
                    response.headers.add(
                        "Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS"
                    )
                    response.headers.add("Access-Control-Allow-Credentials", "true")
                    response.headers.add("Access-Control-Max-Age", "600")
                    return response

            # Add CORS headers to all responses
            @app.after_request
            def after_request(response):
                origin = request.headers.get("Origin")
                if origin in allowed_origins:
                    response.headers.add("Access-Control-Allow-Origin", origin)
                else:
                    response.headers.add("Access-Control-Allow-Origin", "*")
                response.headers.add(
                    "Access-Control-Allow-Headers",
                    "Content-Type,Authorization,X-Requested-With",
                )
                response.headers.add(
                    "Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS"
                )
                response.headers.add("Access-Control-Allow-Credentials", "true")
                return response

        except Exception as e:
            app.logger.error(f"Error initializing CORS: {e}")

        # Add error handler for file too large
        @app.errorhandler(413)
        def too_large(e):
            return {"error": "File too large. Maximum file size is 100MB."}, 413

        # Add error handler for request entity too large (Nginx/server level)
        @app.errorhandler(400)
        def bad_request(e):
            # Check if it's a file size related error
            if "too large" in str(e).lower() or "413" in str(e):
                return {"error": "Request too large. Please reduce file size and try again."}, 413
            return {"error": "Bad request"}, 400

        try:
            db.init_app(app)
            jwt.init_app(app)
            bcrypt.init_app(app)
            Swagger(app)
            configure_activity_logger(app)
            app.logger.info("Activity logger initialized")
        except Exception as e:
            app.logger.error(f"Error initializing extensions: {e}")

        try:
            with app.app_context():
                wait_for_mysql(app)
                from initalized.init_apartment import ensure_db_schema

                ensure_db_schema()
                ensure_admin_user_exists()
                ensure_default_apartment_exists()
                ensure_new_apartment_exists()
        except Exception as e:
            app.logger.error(f"Error initializing DB: {e}")

        try:
            from routes.auth_routes import auth_bp
            from routes.apartments import apartments_bp
            from routes.tenants import tenants_bp
            from routes.landlords import landlords_bp
            from routes.adminPanel.user_actions import adminPanel_bp
            from routes.payments import payments_bp
            from routes.analytics import analytics_bp
            from routes.documents import documents_bp
            from routes.logs import logs_bp
            from routes.payment_history import payment_history_bp
            from routes.contracts import contracts_bp
            from routes.contract_templates import contract_templates_bp
            from routes.health import health_bp

            app.register_blueprint(health_bp, url_prefix="/api")
            app.register_blueprint(auth_bp, url_prefix="/api/auth")
            app.register_blueprint(adminPanel_bp, url_prefix="/api/adminPanel")
            app.register_blueprint(apartments_bp, url_prefix="/api/")
            app.register_blueprint(tenants_bp, url_prefix="/api/")
            app.register_blueprint(landlords_bp, url_prefix="/api/")
            app.register_blueprint(payments_bp, url_prefix="/api/")
            app.register_blueprint(analytics_bp, url_prefix="/api/")
            app.register_blueprint(payment_history_bp, url_prefix="/api")
            app.register_blueprint(documents_bp, url_prefix="/api/documents")
            app.register_blueprint(contracts_bp, url_prefix="/api/documents")
            app.register_blueprint(contract_templates_bp, url_prefix="/api/documents")
            app.register_blueprint(logs_bp, url_prefix="/api")
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
    if app:
        # In production, you should disable debug mode
        app.run(debug=True, host="0.0.0.0", port=5001)
    else:
        print("Failed to create Flask app")
        exit(1)
