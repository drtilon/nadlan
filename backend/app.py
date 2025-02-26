# app.py
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config
from models import db
from flasgger import Swagger


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, resources={r"/*": {"origins": "*", "supports_credentials": True}})

    db.init_app(app)
    Swagger(app)  # Initialize Flasgger

    with app.app_context():
        db.create_all()

    # Register blueprints
    from routes.apartments import apartments_bp
    from routes.auth_routes import auth_bp
    from routes.payments import payments_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(apartments_bp, url_prefix="/api")
    app.register_blueprint(payments_bp, url_prefix="/api")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5001)
