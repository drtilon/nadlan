# app.py
from flask import Flask
from flask_cors import CORS
from config import Config
from db import init_db
from routes.auth_routes import auth_bp
from routes.apartments import apartments_bp
from routes.payments import payments_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, resources={r"/*": {"origins": "*", "supports_credentials": True}})

    with app.app_context():
        init_db()

    # Register blueprints under /api
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(apartments_bp, url_prefix='/api')
    app.register_blueprint(payments_bp, url_prefix='/api')

    return app

if __name__ == "__main__":
    app = create_app()
    # In production, use a WSGI server (gunicorn, uWSGI, etc.).
    app.run(debug=False, host="0.0.0.0", port=5000)

