from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_limiter import Limiter

db = SQLAlchemy()
jwt = JWTManager()
bcrypt = Bcrypt()
limiter = Limiter(key_func=lambda: "global")
