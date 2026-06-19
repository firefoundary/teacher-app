import time
import uuid
from flask import request, g

#imports for the new postgres
from database_client import db


def log_request(endpoint: str, status_code: int, start_time: float, error: str = None):
    """Fire-and-forget audit log to PostgreSQL. Never raises."""
    conn = None
    try:
        conn = db._get_connection()
        cur = conn.cursor()
        
        insert_query = """
            INSERT INTO api_request_logs 
            (client_id, endpoint, status_code, latency_ms, ip_address, request_id, error_message)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        cur.execute(insert_query, (
            getattr(g, "client_id", None),
            endpoint,
            status_code,
            int((time.time() - start_time) * 1000),
            request.remote_addr,
            str(uuid.uuid4()),
            error,
        ))
        
        conn.commit()
    except Exception as e:
        
        if conn:
            conn.rollback()
       
    finally:
        
        if conn:
            conn.close()