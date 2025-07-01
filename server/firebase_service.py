import os
import json
from typing import Optional, Dict, Any
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class FirebaseService:
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FirebaseService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self.initialize_firebase()
            self._initialized = True
    
    def initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Check if Firebase is already initialized
            firebase_admin.get_app()
            print("Firebase already initialized")
        except ValueError:
            # Firebase not initialized, initialize it
            try:
                # First, try to use the JSON service account file
                import os.path
                json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                                       'echopath-aee73-firebase-adminsdk-fbsvc-3371e82372.json')
                
                if os.path.exists(json_path):
                    print(f"Using Firebase service account file: {json_path}")
                    cred = credentials.Certificate(json_path)
                    firebase_admin.initialize_app(cred)
                    print("Firebase initialized with service account file")
                else:
                    # Fallback to environment variables
                    project_id = os.getenv("FIREBASE_PROJECT_ID")
                    if not project_id:
                        raise ValueError("FIREBASE_PROJECT_ID not set")
                    
                    private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n')
                    if not private_key or "BEGIN PRIVATE KEY" not in private_key:
                        # If no valid private key, try default credentials
                        print("No valid private key found, trying default credentials...")
                        firebase_admin.initialize_app()
                        print("Firebase initialized with default credentials")
                    else:
                        # Create credentials from environment variables
                        cred_dict = {
                            "type": "service_account",
                            "project_id": project_id,
                            "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
                            "private_key": private_key,
                            "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
                            "client_id": os.getenv("FIREBASE_CLIENT_ID"),
                            "auth_uri": os.getenv("FIREBASE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"),
                            "token_uri": os.getenv("FIREBASE_TOKEN_URI", "https://oauth2.googleapis.com/token"),
                            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                            "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{os.getenv('FIREBASE_CLIENT_EMAIL')}"
                        }
                        
                        # Initialize with credentials
                        cred = credentials.Certificate(cred_dict)
                        firebase_admin.initialize_app(cred)
                        print("Firebase initialized with service account credentials")
                
            except Exception as e:
                print(f"Error initializing Firebase with credentials: {e}")
                # Try with default credentials as fallback
                try:
                    firebase_admin.initialize_app()
                    print("Firebase initialized with default credentials (fallback)")
                except Exception as fallback_error:
                    print(f"Failed to initialize Firebase: {fallback_error}")
                    raise
        
        # Initialize Firestore client
        self.db = firestore.client()
    
    def verify_firebase_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify Firebase ID token and return user info"""
        try:
            decoded_token = firebase_auth.verify_id_token(token)
            return {
                'uid': decoded_token['uid'],
                'email': decoded_token.get('email'),
                'name': decoded_token.get('name', ''),
                'picture': decoded_token.get('picture', ''),
                'email_verified': decoded_token.get('email_verified', False),
                'auth_provider': decoded_token.get('firebase', {}).get('sign_in_provider', 'unknown')
            }
        except Exception as e:
            print(f"Token verification error: {e}")
            return None
    
    def create_user_document(self, user_info: Dict[str, Any]) -> bool:
        """Create or update user document in Firestore"""
        try:
            user_ref = self.db.collection('users').document(user_info['uid'])
            
            # Check if user already exists
            user_doc = user_ref.get()
            
            if not user_doc.exists:
                # Create new user document
                user_data = {
                    'email': user_info['email'],
                    'displayName': user_info.get('name', ''),
                    'photoURL': user_info.get('picture', ''),
                    'emailVerified': user_info.get('email_verified', False),
                    'authProvider': user_info.get('auth_provider', 'unknown'),
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'lastLoginAt': firestore.SERVER_TIMESTAMP,
                    'isActive': True
                }
                user_ref.set(user_data)
                print(f"Created new user document for {user_info['email']}")
            else:
                # Update last login time
                user_ref.update({
                    'lastLoginAt': firestore.SERVER_TIMESTAMP
                })
                print(f"Updated last login for {user_info['email']}")
            
            return True
        except Exception as e:
            print(f"Error creating/updating user document: {e}")
            return False
    
    def get_user_by_uid(self, uid: str) -> Optional[Dict[str, Any]]:
        """Get user document by UID"""
        try:
            user_ref = self.db.collection('users').document(uid)
            user_doc = user_ref.get()
            
            if user_doc.exists:
                data = user_doc.to_dict()
                data['uid'] = uid
                return data
            return None
        except Exception as e:
            print(f"Error getting user by UID: {e}")
            return None
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user document by email"""
        try:
            users_ref = self.db.collection('users')
            query = users_ref.where('email', '==', email).limit(1)
            docs = query.stream()
            
            for doc in docs:
                data = doc.to_dict()
                data['uid'] = doc.id
                return data
            return None
        except Exception as e:
            print(f"Error getting user by email: {e}")
            return None
    
    def update_user_document(self, uid: str, data: Dict[str, Any]) -> bool:
        """Update user document"""
        try:
            user_ref = self.db.collection('users').document(uid)
            data['updatedAt'] = firestore.SERVER_TIMESTAMP
            user_ref.update(data)
            return True
        except Exception as e:
            print(f"Error updating user document: {e}")
            return False
    
    def delete_user_document(self, uid: str) -> bool:
        """Delete user document (soft delete by marking as inactive)"""
        try:
            user_ref = self.db.collection('users').document(uid)
            user_ref.update({
                'isActive': False,
                'deactivatedAt': firestore.SERVER_TIMESTAMP
            })
            return True
        except Exception as e:
            print(f"Error deactivating user document: {e}")
            return False
    
    def create_custom_token(self, uid: str, additional_claims: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Create a custom token for a user"""
        try:
            token = firebase_auth.create_custom_token(uid, additional_claims)
            return token.decode('utf-8')
        except Exception as e:
            print(f"Error creating custom token: {e}")
            return None

# Singleton instance
firebase_service = FirebaseService()
