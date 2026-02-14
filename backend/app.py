# app.py - FIXED VERSION with proper logging configuration
from flask import Flask, current_app, request, Response, g
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config
from extentions import db, jwt, bcrypt
from sqlalchemy.exc import OperationalError
import time
from models.models import Apartment, Tenant, User, Landlord
from initalized.init_apartment import initialize_database
import os
from dotenv import load_dotenv
from activity_logger import ActivityLogger, configure_activity_logger
import logging
from logging.handlers import RotatingFileHandler


def configure_logging(app):
    """
    Configure logging to write ALL logs to files.
    This configures the root logger so all child loggers inherit the file handlers.
    """
    try:
        # Create logs directory if it doesn't exist
        log_dir = app.config.get('LOG_DIRECTORY', 'logs')
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)

        # Get the root logger
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)

        # Remove any existing handlers to avoid duplicates
        root_logger.handlers = []

        # Create formatter
        formatter = logging.Formatter(
            '[%(asctime)s] %(levelname)s in %(name)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

        # Create file handler for app.log (general application logs)
        app_handler = RotatingFileHandler(
            os.path.join(log_dir, 'app.log'),
            maxBytes=10485760,  # 10MB
            backupCount=10
        )
        app_handler.setLevel(logging.INFO)
        app_handler.setFormatter(formatter)

        # Create file handler for activity.log (user activity logs)
        activity_handler = RotatingFileHandler(
            os.path.join(log_dir, 'activity.log'),
            maxBytes=10485760,  # 10MB
            backupCount=10
        )
        activity_handler.setLevel(logging.INFO)
        activity_handler.setFormatter(formatter)

        # Add a filter to separate activity logs
        class ActivityFilter(logging.Filter):
            def filter(self, record):
                return 'USER ACTIVITY' in record.getMessage()

        class NonActivityFilter(logging.Filter):
            def filter(self, record):
                return 'USER ACTIVITY' not in record.getMessage()

        app_handler.addFilter(NonActivityFilter())
        activity_handler.addFilter(ActivityFilter())

        # Add handlers to root logger (this makes ALL loggers write to files)
        root_logger.addHandler(app_handler)
        root_logger.addHandler(activity_handler)

        # Also add handlers to Flask's app logger
        app.logger.handlers = []
        app.logger.addHandler(app_handler)
        app.logger.addHandler(activity_handler)
        app.logger.setLevel(logging.INFO)

        # Optional: Add console handler for development (you can comment this out in production)
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

        app.logger.info("Logging configured successfully - all logs will be written to files")

    except Exception as e:
        print(f"Error configuring logging: {e}")


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

        # Set file upload limits - UPDATED to 50MB
        app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB max file size
        app.config["UPLOAD_FOLDER"] = os.path.join(app.root_path, "uploads")

        # Additional configuration for better file handling
        app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0  # Disable caching for file uploads

        # *** CONFIGURE LOGGING FIRST - This is the key fix! ***
        configure_logging(app)

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

            # Add CORS headers and security headers to all responses
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

                # Security headers to prevent common attacks
                response.headers["X-Content-Type-Options"] = "nosniff"
                response.headers["X-Frame-Options"] = "DENY"
                response.headers["X-XSS-Protection"] = "1; mode=block"
                response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
                response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
                response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
                # Remove server header to hide implementation details
                response.headers.pop("Server", None)

                return response

            # Request-level logging middleware
            @app.before_request
            def log_request_start():
                if request.method == "OPTIONS":
                    return
                g._request_start_time = time.time()

            @app.after_request
            def log_request_info(response):
                # Skip OPTIONS and health/ping endpoints
                if request.method == "OPTIONS":
                    return response
                path = request.path
                if path in ('/api/health', '/api/ping', '/api/health/'):
                    return response

                duration_ms = 0
                start_time = getattr(g, '_request_start_time', None)
                if start_time:
                    duration_ms = int((time.time() - start_time) * 1000)

                user = getattr(g, 'user', None)
                if user:
                    username = user.get('sub', 'unknown')
                    role = user.get('role', 'unknown')
                    user_str = f"user={username}(role:{role})"
                else:
                    user_str = "user=anonymous"

                ip = request.headers.get('X-Forwarded-For',
                     request.headers.get('X-Real-IP', request.remote_addr))
                if ip:
                    ip = ip.split(',')[0].strip()

                app.logger.info(
                    f"[REQUEST] {user_str} {request.method} {path} "
                    f"{response.status_code} {duration_ms}ms ip={ip}"
                )
                return response

        except Exception as e:
            app.logger.error(f"Error initializing CORS: {e}")

        # Add error handler for file too large - UPDATED to 50MB
        @app.errorhandler(413)
        def too_large(e):
            return {"error": "File too large. Maximum file size is 50MB."}, 413

        # Add error handler for request entity too large (Nginx/server level)
        @app.errorhandler(400)
        def bad_request(e):
            # Check if it's a file size related error
            if "too large" in str(e).lower() or "413" in str(e):
                return {
                    "error": "Request too large. Please reduce file size and try again."
                }, 413
            return {"error": "Bad request"}, 400

        try:
            db.init_app(app)
            jwt.init_app(app)
            bcrypt.init_app(app)
            # Activity logger is now configured through the root logger
            app.logger.info("Extensions initialized")

        except Exception as e:
            app.logger.error(f"Error initializing extensions: {e}")

        try:
            with app.app_context():
                wait_for_mysql(app)
                from initalized.init_apartment import ensure_db_schema

                initialize_database()
        except Exception as e:
            app.logger.error(f"Error initializing DB: {e}")

        try:
            from routes.auth_routes import auth_bp
            from routes.apartments import apartments_bp
            from routes.tenants import tenants_bp
            from routes.landlords import landlords_bp
            from routes.payments import payments_bp
            from routes.analytics import analytics_bp
            from routes.fast_analytics import fast_analytics_bp
            from routes.payment_history import payment_history_bp
            from routes.documents import documents_bp
            from routes.contracts import contracts_bp
            from routes.contract_templates import contract_templates_bp
            from routes.contract_periods import contract_periods_bp
            from routes.logs import logs_bp
            from routes.csv_payments import csv_payments_bp
            from routes.health import health_bp
            from routes.adminPanel.user_actions import adminPanel_bp
            from routes.user_analytics import user_analytics_bp

            # Register all blueprints
            app.register_blueprint(contract_periods_bp, url_prefix="/api")
            app.register_blueprint(user_analytics_bp, url_prefix="/api/")
            app.register_blueprint(health_bp, url_prefix="/api")
            app.register_blueprint(auth_bp, url_prefix="/api/auth")
            app.register_blueprint(adminPanel_bp, url_prefix="/api/adminPanel")
            app.register_blueprint(apartments_bp, url_prefix="/api/")
            app.register_blueprint(tenants_bp, url_prefix="/api/")
            app.register_blueprint(landlords_bp, url_prefix="/api/")
            app.register_blueprint(payments_bp, url_prefix="/api/")
            app.register_blueprint(analytics_bp, url_prefix="/api/")
            app.register_blueprint(
                fast_analytics_bp, url_prefix="/api/"
            )  # NEW: Fast analytics routes
            app.register_blueprint(payment_history_bp, url_prefix="/api/")
            app.register_blueprint(documents_bp, url_prefix="/api/documents")
            app.register_blueprint(contracts_bp, url_prefix="/api/documents")
            app.register_blueprint(contract_templates_bp, url_prefix="/api/documents")
            app.register_blueprint(logs_bp, url_prefix="/api")
            app.register_blueprint(csv_payments_bp, url_prefix="/api/csv-payments/")
            app.logger.info("Blueprints registered (including fast analytics)")
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
        port = int(os.environ.get("PORT", 5001))
        app.logger.info(f"Starting Flask server on port {port}")
        app.run(host="0.0.0.0", port=port, debug=False)
    else:
        print("Failed to create Flask application!")
