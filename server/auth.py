from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from fastapi import HTTPException, status
import os
from dotenv import load_dotenv
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
import requests

# Load environment variables
load_dotenv()

# Authentication configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Pydantic models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class User(BaseModel):
    email: str
    full_name: Optional[str] = None
    is_active: bool = True
    auth_provider: str = "email"  # "email" or "google"

class UserInDB(User):
    hashed_password: Optional[str] = None  # Optional for Google users

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    access_token: str  # This will actually be the ID token from Google

# Fake database - in production, use a real database
fake_users_db = {}

def verify_password(plain_password, hashed_password):
    """Verify a plain password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Hash a password."""
    return pwd_context.hash(password)

def get_user(email: str):
    """Get user from database."""
    if email in fake_users_db:
        user_dict = fake_users_db[email]
        return UserInDB(**user_dict)

def authenticate_user(email: str, password: str):
    """Authenticate a user with email and password."""
    user = get_user(email)
    if not user:
        return False
    if user.auth_provider == "google":
        # Google users don't have passwords
        return False
    if not user.hashed_password or not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create an access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    """Verify and decode a token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token_data = TokenData(email=email)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user(email=token_data.email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def create_user(user_data: UserCreate):
    """Create a new user with email and password."""
    if user_data.email in fake_users_db:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed_password = get_password_hash(user_data.password)
    user_dict = {
        "email": user_data.email,
        "full_name": user_data.full_name,
        "hashed_password": hashed_password,
        "is_active": True,
        "auth_provider": "email"
    }
    fake_users_db[user_data.email] = user_dict
    return User(**user_dict)

async def verify_google_token(token: str) -> dict:
    """Verify Google OAuth token and return user info."""
    try:
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        
        # Check if the token is valid
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Wrong issuer.')
            
        return {
            'email': idinfo['email'],
            'name': idinfo.get('name', ''),
            'picture': idinfo.get('picture', ''),
            'google_id': idinfo['sub']
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Google token: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Token verification failed: {str(e)}"
        )

def create_google_user(google_user_info: dict) -> User:
    """Create or update user from Google OAuth info."""
    email = google_user_info['email']
    
    # Check if user already exists
    if email in fake_users_db:
        existing_user = fake_users_db[email]
        # Update user info if it's a Google user
        if existing_user.get('auth_provider') == 'google':
            user_dict = {
                **existing_user,
                'full_name': google_user_info['name'],
                'is_active': True
            }
            fake_users_db[email] = user_dict
            return User(**user_dict)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered with email/password"
            )
    
    # Create new Google user
    user_dict = {
        'email': email,
        'full_name': google_user_info['name'],
        'is_active': True,
        'auth_provider': 'google',
        'hashed_password': None  # Google users don't have passwords
    }
    fake_users_db[email] = user_dict
    return User(**user_dict)
