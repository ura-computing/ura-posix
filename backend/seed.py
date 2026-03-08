"""
Database seeding script for PharmaGest.

Creates default admin and owner accounts with a default pharmacy.

Usage:
    # From project root:
    make back-seed
    
    # Or directly with venv:
    cd backend && .venv/bin/python seed.py
"""

import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import User, Pharmacy
from utils.auth import hash_password

def seed_database():
    """Create default pharmacy, admin, and owner accounts."""
    
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.email == "admin@gmail.com").first()
        if existing_admin:
            print("✓ Admin account already exists, skipping seed.")
            return
        
        # 1. Create default pharmacy
        default_pharmacy = Pharmacy(
            name="Pharmacie Demo",
            address="123 Rue Mohammed V, Casablanca",
            phone="+212 5 22 12 34 56",
            email="contact@pharmacie-demo.ma"
        )
        db.add(default_pharmacy)
        db.flush()  # Get pharmacy ID
        
        print(f"✓ Created default pharmacy: {default_pharmacy.name} (ID: {default_pharmacy.id})")
        
        # 2. Create admin account
        admin = User(
            email="admin@gmail.com",
            name="Admin",
            password_hash=hash_password("admin@123"),
            role="admin",
            status="active",
            profile_complete=True,
            pharmacy_id=None  # Admin not tied to specific pharmacy
        )
        db.add(admin)
        
        print(f"✓ Created admin account: {admin.email} / admin@123")
        
        # 3. Create owner account
        owner = User(
            email="owner@gmail.com",
            name="Owner Demo",
            password_hash=hash_password("owner@123"),
            role="owner",
            status="active",
            profile_complete=True,
            pharmacy_id=default_pharmacy.id,
            pharmacy_name=default_pharmacy.name
        )
        db.add(owner)
        
        print(f"✓ Created owner account: {owner.email} / owner@123")
        print(f"  → Assigned to pharmacy: {default_pharmacy.name}")
        
        # Commit all changes
        db.commit()
        
        print("\n" + "="*60)
        print("Database seeded successfully!")
        print("="*60)
        print("\nDefault Accounts:")
        print(f"  Admin:  admin@gmail.com / admin@123")
        print(f"  Owner:  owner@gmail.com / owner@123")
        print(f"\nDefault Pharmacy: {default_pharmacy.name}")
        print("="*60)
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
