from flask_bcrypt import Bcrypt
from flask import Flask

app = Flask(__name__)
bcrypt = Bcrypt(app)

new_password = ""
hashed_password = bcrypt.generate_password_hash(new_password).decode("utf-8")
print("New hashed password:", hashed_password)
