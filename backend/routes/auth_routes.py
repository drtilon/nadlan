# routes/auth_routes.py
import os
from flask import Blueprint, request, jsonify, current_app
from auth import create_token
from config import Config

auth_bp = Blueprint("auth_bp", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"message": "Missing username or password"}), 400

    # In production, you'd query a 'users' table to verify the password/role.
    # For this example, if the credentials match environment variables => admin, else => limited.
    if username == os.environ.get(
        "APP_USERNAME", "admin"
    ) and password == os.environ.get("APP_PASSWORD", "password"):
        role = "admin"
    else:
        role = "limited"

    # Create a JWT token using our helper from auth.py
    token = create_token(username, role, Config.TOKEN_EXPIRATION)

    response = jsonify({"message": "Login successful", "token": token})
    response.headers.add("Access-Control-Allow-Credentials", "true")
    return response, 200
