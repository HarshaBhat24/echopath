#!/usr/bin/env python3
"""
Firebase connection test script
Run this to verify your Firebase configuration is working correctly.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_firebase_config():
    """Test Firebase configuration"""
    print("🔥 Firebase Configuration Test")
    print("=" * 50)
    
    # Check environment variables
    required_vars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY_ID', 
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_CLIENT_ID'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
        else:
            print(f"✅ {var}: {'*' * 20}")
    
    if missing_vars:
        print(f"\n❌ Missing environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        return False
    
    # Test Firebase Admin SDK initialization
    try:
        print(f"\n🔄 Testing Firebase Admin SDK...")
        from firebase_service import firebase_service
        print(f"✅ Firebase Admin SDK initialized successfully")
        print(f"✅ Project ID: {os.getenv('FIREBASE_PROJECT_ID')}")
        return True
    except Exception as e:
        print(f"❌ Firebase initialization failed: {e}")
        return False

def test_client_config():
    """Test client-side Firebase configuration"""
    print(f"\n🌐 Client Configuration Test")
    print("=" * 50)
    
    client_vars = [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_MESSAGING_SENDER_ID',
        'VITE_FIREBASE_APP_ID'
    ]
    
    missing_client_vars = []
    for var in client_vars:
        if not os.getenv(var):
            missing_client_vars.append(var)
        else:
            print(f"✅ {var}: {'*' * 20}")
    
    if missing_client_vars:
        print(f"\n❌ Missing client environment variables:")
        for var in missing_client_vars:
            print(f"   - {var}")
        return False
    
    return True

def main():
    """Main test function"""
    print("🚀 EchoPath Firebase Integration Test")
    print("=" * 60)
    
    # Test server-side Firebase config
    server_ok = test_firebase_config()
    
    # Test client-side Firebase config  
    client_ok = test_client_config()
    
    print(f"\n📊 Test Results")
    print("=" * 50)
    print(f"Server Configuration: {'✅ PASS' if server_ok else '❌ FAIL'}")
    print(f"Client Configuration: {'✅ PASS' if client_ok else '❌ FAIL'}")
    
    if server_ok and client_ok:
        print(f"\n🎉 All tests passed! Firebase is ready to use.")
        print(f"\nNext steps:")
        print(f"1. Start the backend server: python main.py")
        print(f"2. Start the frontend server: cd client && npm run dev")
        return 0
    else:
        print(f"\n❌ Some tests failed. Please check your configuration.")
        print(f"📖 See FIREBASE_SETUP.md for detailed setup instructions.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
