from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Dict, Any
import uvicorn
from datetime import timedelta
import os

# Import our authentication modules
from auth import (
    authenticate_user, create_access_token, verify_token, create_user,
    ACCESS_TOKEN_EXPIRE_MINUTES, Token, User, UserCreate, GoogleAuthRequest,
    verify_google_token, create_google_user
)

app = FastAPI(
    title="EchoPath API",
    description="A simple FastAPI server for the EchoPath project with authentication",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get the current authenticated user."""
    return verify_token(token)

# Pydantic models for request/response
class EchoRequest(BaseModel):
    message: str

class EchoResponse(BaseModel):
    echo: str
    original_message: str
    status: str
    user_email: str

class HealthResponse(BaseModel):
    status: str
    message: str

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Welcome to EchoPath API with Authentication"}

@app.post("/api/auth/register", response_model=User)
async def register(user_data: UserCreate):
    """Register a new user"""
    return create_user(user_data)

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login endpoint"""
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/google", response_model=Token)
async def google_auth(request: GoogleAuthRequest):
    """Authenticate with Google OAuth"""
    try:
        # Verify the Google token and get user info
        google_user_info = await verify_google_token(request.access_token)
        
        # Create or update user
        user = create_google_user(google_user_info)
        
        # Create JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google authentication failed: {str(e)}"
        )

@app.get("/api/auth/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        message="FastAPI server is running successfully"
    )

@app.post("/api/echo", response_model=EchoResponse)
async def echo_message(request: EchoRequest, current_user: User = Depends(get_current_user)):
    """Echo back the received message (protected endpoint)"""
    return EchoResponse(
        echo=f"Echo: {request.message}",
        original_message=request.message,
        status="success",
        user_email=current_user.email
    )

@app.get("/api/info")
async def server_info():
    """Get server information"""
    return {
        "server": "FastAPI",
        "version": "1.0.0",
        "framework": "FastAPI with Uvicorn",
        "authentication": "JWT Bearer Token",
        "endpoints": [
            "/",
            "/api/auth/register",
            "/api/auth/login", 
            "/api/auth/google",
            "/api/auth/me",
            "/api/health",
            "/api/echo",
            "/api/info"
        ]
    }

@app.get("/api/auth/google/test")
async def test_google_config():
    """Test Google OAuth configuration"""
    return {
        "google_client_id_configured": bool(os.getenv("GOOGLE_CLIENT_ID")),
        "google_client_secret_configured": bool(os.getenv("GOOGLE_CLIENT_SECRET")),
        "client_id_preview": os.getenv("GOOGLE_CLIENT_ID", "")[:20] + "..." if os.getenv("GOOGLE_CLIENT_ID") else "Not set"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
