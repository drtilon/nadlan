# routes/auth_routes.py
import os
from flask import Blueprint, request, jsonify, current_app
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import timedelta
from models.models import User
from extentions import db
from .auth import token_required, role_required

auth_bp = Blueprint("auth_bp", __name__)
bcrypt = Bcrypt()

# Rate limiter to prevent brute-force login attempts
limiter = Limiter(key_func=get_remote_address)


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")  # 5 login attempts per minute per IP
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"message": "Missing username or password"}), 400

    # Query the database for the user
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"message": "Invalid username or password"}), 401

    if not user.is_approved:
        return jsonify({"message": "Your account is pending admin approval."}), 403
    # Verify password
    if user and bcrypt.check_password_hash(user.password, password):
        role = user.role  # Retrieve role from database

        # Get token expiration time from config (in hours)
        token_expiration_hours = current_app.config.get("TOKEN_EXPIRATION", 24)

        # Generate JWT tokens with the proper expiration time
        access_token = create_access_token(
            identity=username,
            additional_claims={"role": role},
            expires_delta=timedelta(hours=token_expiration_hours),  # Use config value
        )
        refresh_token = create_refresh_token(identity=username)

        return jsonify(
            {
                "message": "Login successful",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": {
                    "username": username,
                    "role": role,
                    "id": user.id,
                    "is_approved": user.is_approved,
                },
            }
        ), 200

    return jsonify({"message": "Invalid username or password"}), 401


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    role = data.get("role", "user")  # Default role is 'user'

    if not username or not password:
        return jsonify({"message": "Missing username or password"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "User already exists"}), 409

    # For new users, is_approved is False by default (unless they're an admin)
    is_approved = True if role == "admin" else False

    new_user = User(username=username, role=role, is_approved=is_approved)
    new_user.set_password(password)

    db.session.add(new_user)
    db.session.commit()

    # Inform the user that their account is pending admin approval
    return jsonify(
        {"message": "User registered successfully. Awaiting admin approval."}
    ), 201


@auth_bp.route("/verify", methods=["GET"])
@token_required
def verify_token():
    """
    Simple endpoint to verify if the current token is valid.
    Token_required decorator will return 401 if token is invalid.
    """
    return jsonify({"message": "Token is valid", "status": "success"}), 200
