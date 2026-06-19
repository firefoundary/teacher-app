import os
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from dotenv import load_dotenv
from pathlib import Path

current_dir = Path(__file__).parent
dotenv_path = current_dir.parent.parent.parent / '.env'
load_dotenv(dotenv_path=dotenv_path)

class PostgresDB:
    def __init__(self):
        self.db_url = os.getenv("DATABASE_URL")
        
        if not self.db_url:
            raise ValueError("DATABASE_URL must be set in .env file")
            
    def _get_connection(self):
        """Creates and returns a new database connection."""
        return psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
    
    def get_teachers_by_cluster(self, cluster_id):
        """Fetch all teachers in a cluster using 'cluster' column"""
        try:
            conn = self._get_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM teachers WHERE cluster = %s", (cluster_id,))
            data = cur.fetchall()
            conn.close()
            return data
        except Exception as e:
            print(f"Error fetching cluster teachers: {e}")
            return []
    
    def get_issue_competency_mappings(self):
        """Fetch all issue-to-competency keyword mappings"""
        try:
            conn = self._get_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM issue_competency_mapping")
            data = cur.fetchall()
            conn.close()
            return data
        except Exception as e:
            print(f"Error loading mappings: {e}")
            return []
        
    def get_teacher_issues(self, teacher_id):
        """Fetch all issues mapped to a specific teacher."""
        try:
            conn = self._get_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM issues WHERE teacher_id = %s", (teacher_id,))
            data = cur.fetchall()
            conn.close()
            return data
        except Exception as e:
            print(f"Error fetching teacher issues: {e}")
            return []

    def get_issue_by_id(self, issue_id: str):
        """Fetch a single issue by its unique ID."""
        try:
            conn = self._get_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM issues WHERE id = %s", (issue_id,))
            data = cur.fetchone()
            conn.close()
            return data
        except Exception as e:
            print(f"Error fetching issue by ID: {e}")
            return None
    
    # Backward compatibility alias
    def get_teacher_feedback(self, teacher_id):
        """DEPRECATED: Legacy method - use get_teacher_issues instead"""
        return self.get_teacher_issues(teacher_id)
    
    def get_cluster_issues(self, cluster_id):
        """Fetch all issues from a cluster"""
        try:
            conn = self._get_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM issues WHERE cluster = %s", (cluster_id,))
            data = cur.fetchall()
            conn.close()
            return data
        except Exception as e:
            print(f"Error fetching cluster issues: {e}")
            return []
    
    # Backward compatibility alias
    def get_cluster_feedback(self, cluster_id):
        """Legacy method: use get_cluster_issues instead"""
        return self.get_cluster_issues(cluster_id)
    
    def get_base_training_module(self, module_id):
        """Fetch base module/resource content for personalization pipeline."""
        try:
            conn = self._get_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM training_modules WHERE id = %s", (module_id,))
            data = cur.fetchone()
            conn.close()
            return data
        except Exception as e:
            print(f"Error fetching module: {e}")
            return None
    
    def save_personalized_training(self, teacher_id, module_id, personalized_content, metadata):
        """Save personalized training assignment"""
        try:
            conn = self._get_connection()
            cur = conn.cursor()
            
            # Using RETURNING * mimics the behavior of Supabase returning the inserted row
            insert_query = """
                INSERT INTO personalized_training 
                (teacher_id, module_id, personalized_content, adaptation_metadata, status, completion_percentage) 
                VALUES (%s, %s, %s, %s, %s, %s) 
                RETURNING *
            """
            
            # Json() securely casts the Python dictionary to Postgres JSONB format
            cur.execute(insert_query, (
                teacher_id, 
                module_id, 
                personalized_content, 
                Json(metadata), 
                'assigned', 
                0
            ))
            
            inserted_row = cur.fetchone()
            conn.commit()
            conn.close()
            
            # Supabase usually returns a list even for single inserts, so we wrap it to prevent downstream breaking
            return [inserted_row] if inserted_row else None
            
        except Exception as e:
            print(f"Error saving personalized training: {e}")
            return None
    
    # Backward compatibility alias 
    def get_feedback_by_id(self, feedback_id: str):
        """DEPRECATED: Legacy method - use get_issue_by_id instead"""
        return self.get_issue_by_id(feedback_id)

    def initialize_default_mappings(self):
        """Initialize default keyword mappings if table is empty"""
        try:
            conn = self._get_connection()
            cur = conn.cursor()
            
            cur.execute("SELECT COUNT(*) FROM issue_competency_mapping")
            count = cur.fetchone()['count']
            
            if count == 0:
                print("Initializing default issue_competency_mapping data...")
                
                default_mappings = [
                    {'issue_keyword': 'behavior', 'competency_area': 'classroom_management', 'confidence_score': 0.85},
                    {'issue_keyword': 'discipline', 'competency_area': 'classroom_management', 'confidence_score': 0.85},
                    {'issue_keyword': 'classroom management', 'competency_area': 'classroom_management', 'confidence_score': 0.95},
                    {'issue_keyword': 'students talking', 'competency_area': 'classroom_management', 'confidence_score': 0.80},
                    {'issue_keyword': 'noise', 'competency_area': 'classroom_management', 'confidence_score': 0.75},
                    {'issue_keyword': 'disruption', 'competency_area': 'classroom_management', 'confidence_score': 0.85},
                    {'issue_keyword': 'curriculum', 'competency_area': 'content_knowledge', 'confidence_score': 0.80},
                    {'issue_keyword': 'content', 'competency_area': 'content_knowledge', 'confidence_score': 0.75},
                    {'issue_keyword': 'subject matter', 'competency_area': 'content_knowledge', 'confidence_score': 0.85},
                    {'issue_keyword': 'syllabus', 'competency_area': 'content_knowledge', 'confidence_score': 0.80},
                    {'issue_keyword': 'teaching methods', 'competency_area': 'pedagogy', 'confidence_score': 0.85},
                    {'issue_keyword': 'pedagogy', 'competency_area': 'pedagogy', 'confidence_score': 0.95},
                    {'issue_keyword': 'lesson planning', 'competency_area': 'pedagogy', 'confidence_score': 0.85},
                    {'issue_keyword': 'active learning', 'competency_area': 'pedagogy', 'confidence_score': 0.85},
                    {'issue_keyword': 'assessment', 'competency_area': 'pedagogy', 'confidence_score': 0.75},
                    {'issue_keyword': 'technology', 'competency_area': 'technology_usage', 'confidence_score': 0.85},
                    {'issue_keyword': 'computer', 'competency_area': 'technology_usage', 'confidence_score': 0.80},
                    {'issue_keyword': 'digital tools', 'competency_area': 'technology_usage', 'confidence_score': 0.90},
                    {'issue_keyword': 'projector', 'competency_area': 'technology_usage', 'confidence_score': 0.75},
                    {'issue_keyword': 'software', 'competency_area': 'technology_usage', 'confidence_score': 0.80},
                    {'issue_keyword': 'engagement', 'competency_area': 'student_engagement', 'confidence_score': 0.85},
                    {'issue_keyword': 'participation', 'competency_area': 'student_engagement', 'confidence_score': 0.80},
                    {'issue_keyword': 'motivation', 'competency_area': 'student_engagement', 'confidence_score': 0.85},
                    {'issue_keyword': 'attention', 'competency_area': 'student_engagement', 'confidence_score': 0.75},
                    {'issue_keyword': 'focus', 'competency_area': 'student_engagement', 'confidence_score': 0.75},
                    {'issue_keyword': 'interest', 'competency_area': 'student_engagement', 'confidence_score': 0.80},
                ]
                
                insert_query = """
                    INSERT INTO issue_competency_mapping (issue_keyword, competency_area, confidence_score)
                    VALUES (%(issue_keyword)s, %(competency_area)s, %(confidence_score)s)
                """
                
                # executemany processes the entire list efficiently in one transaction
                cur.executemany(insert_query, default_mappings)
                conn.commit()
                
                print(f"✓ Initialized {len(default_mappings)} default mappings")
            else:
                print(f"✓ Database already has {count} mappings")
                
            conn.close()
        except Exception as e:
            print(f"Error initializing mappings: {e}")

# Initialize global instance, identical to previous SupabaseDB behavior
db = PostgresDB()