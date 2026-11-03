"""Create the first SuperAdmin login.

Usage (from erp-backend/, venv active):
    python scripts/create_superadmin.py <username> <password> [email]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from extensions import db
from helpers import hash_user_password
from models import User


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    username, password = sys.argv[1], sys.argv[2]
    email = sys.argv[3] if len(sys.argv) > 3 else None

    app = create_app()
    with app.app_context():
        user = User.query.filter_by(username=username).first()
        if user:
            user.role = "SuperAdmin"
            user.password = hash_user_password(password)
            user.is_active = True
            print(f"Updated existing user '{username}' to SuperAdmin.")
        else:
            user = User(
                username=username,
                password=hash_user_password(password),
                role="SuperAdmin",
                useremail=email,
                branch="All",
                location="All",
                is_active=True,
                is_first_login=True,
            )
            db.session.add(user)
            print(f"Created SuperAdmin '{username}'.")
        db.session.commit()


if __name__ == "__main__":
    main()
