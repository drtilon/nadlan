# auth.py
import jwt
import datetime
from functools import wraps
from flask import request, jsonify, g, current_app


def token_required(f):
    """
    Decorator to check for a valid JWT in the Authorization header.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        if not token:
            return jsonify({"message": "Token is missing!"}), 401
        try:
            # Use the HS256 algorithm explicitly
            decoded = jwt.decode(
                token, current_app.config["SECRET_KEY"], algorithms=["HS256"]
            )
            g.user = (
                decoded  # attach the decoded token (including 'role') to Flask global
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired!"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token!"}), 401
        return f(*args, **kwargs)

    return decorated


def role_required(required_role):
    """
    Decorator to ensure the user has a specific role.
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if g.user.get("role") != required_role:
                return jsonify({"message": "Insufficient permissions"}), 403
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def create_token(username, role, expiration_hours=None):
    """
    Helper function to create a JWT with the given username, role, and expiration.
    """
    if expiration_hours is None:
        # Get token expiration from application config, default to 24 hours
        expiration_hours = current_app.config.get("TOKEN_EXPIRATION", 24)

    payload = {
        "sub": username,
        "role": role,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=expiration_hours),
    }
    token = jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")
    return token
