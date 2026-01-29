#!/usr/bin/env python3
"""Migration script to update users table for Clerk authentication.

This script:
1. Renames ha_user_id column to clerk_user_id
2. Adds email column
3. Adds avatar_url column
4. Adds updated_at column
5. Creates list_shares table

Run from the backend directory:
    python -m scripts.migrate_users

Or with uv:
    uv run python -m scripts.migrate_users
"""

import sqlite3
import sys
from pathlib import Path


def get_db_path() -> Path:
    """Get the database path."""
    # Check for environment variable or use default
    return Path(__file__).parent.parent / "data" / "familylist.db"


def migrate(db_path: Path) -> None:
    """Run the migration."""
    if not db_path.exists():
        print(f"Database not found at {db_path}")
        print("Run the application first to create the database, then run this migration.")
        sys.exit(1)

    print(f"Migrating database at {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check current schema
        cursor.execute("PRAGMA table_info(users)")
        columns = {row[1]: row for row in cursor.fetchall()}
        print(f"Current users columns: {list(columns.keys())}")

        # Rename ha_user_id to clerk_user_id if needed
        if "ha_user_id" in columns and "clerk_user_id" not in columns:
            print("Renaming ha_user_id to clerk_user_id...")
            cursor.execute("ALTER TABLE users RENAME COLUMN ha_user_id TO clerk_user_id")
            print("  Done")

        # Add email column if missing
        if "email" not in columns:
            print("Adding email column...")
            cursor.execute("ALTER TABLE users ADD COLUMN email VARCHAR(255)")
            print("  Done")

        # Add avatar_url column if missing
        if "avatar_url" not in columns:
            print("Adding avatar_url column...")
            cursor.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
            print("  Done")

        # Add updated_at column if missing
        if "updated_at" not in columns:
            print("Adding updated_at column...")
            cursor.execute("ALTER TABLE users ADD COLUMN updated_at TEXT")
            # Set initial value to created_at for existing rows
            cursor.execute("UPDATE users SET updated_at = created_at WHERE updated_at IS NULL")
            print("  Done")

        # Create list_shares table if it doesn't exist
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='list_shares'
        """)
        if not cursor.fetchone():
            print("Creating list_shares table...")
            cursor.execute("""
                CREATE TABLE list_shares (
                    id VARCHAR(36) PRIMARY KEY,
                    list_id VARCHAR(36) NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
                    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    permission VARCHAR(20) NOT NULL DEFAULT 'view',
                    created_at TEXT,
                    UNIQUE(list_id, user_id)
                )
            """)
            cursor.execute(
                "CREATE INDEX idx_list_shares_user_id ON list_shares(user_id)"
            )
            print("  Done")

        conn.commit()
        print("\nMigration completed successfully!")

        # Show final schema
        cursor.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"\nFinal users columns: {columns}")

    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    db_path = get_db_path()
    migrate(db_path)
