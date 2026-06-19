import os
import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv, find_dotenv

# Load environment variables
load_dotenv(find_dotenv(), override=False)

# Fallback to DB_URL or DATABASE_URL based on your .env setup
DB_URL = os.getenv("DB_URL") or os.getenv("DATABASE_URL")

if not DB_URL:
    raise ValueError("Neither DB_URL nor DATABASE_URL was found in the environment variables.")

def _get_connection():
    """Helper to establish a connection to the PostgreSQL database."""
    return psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)

def authenticate_client(client_id: str, client_secret: str) -> dict | None:
    """
    Look up the client by client_id in PostgreSQL, verify secret hash.
    Returns the client row dict on success, None on failure.
    """
    conn = None
    try:
        conn = _get_connection()
        cur = conn.cursor()
        
        # Query the active client row matching the client_id
        cur.execute(
            "SELECT * FROM api_clients WHERE client_id = %s AND is_active = TRUE LIMIT 1",
            (client_id,)
        )
        client = cur.fetchone()
        
        if not client:
            return None

        if not client.get("client_secret_hash"):
            return None
            
        # Verify the password using bcrypt
        if not bcrypt.checkpw(client_secret.encode(), client["client_secret_hash"].encode()):
            return None

        # Update the last_used_at timestamp natively
        try:
            cur.execute(
                "UPDATE api_clients SET last_used_at = NOW() WHERE client_id = %s",
                (client_id,)
            )
            conn.commit()
        except Exception as update_err:
            print(f"Warning: Could not update last_used_at for client {client_id}: {update_err}")
            conn.rollback() # Roll back only the update chunk if it fails

        return client

    except Exception as e:
        print(f"Database authentication error: {e}")
        return None
        
    finally:
        if conn:
            conn.close()