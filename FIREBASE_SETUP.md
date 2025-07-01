# Firebase Integration Setup Guide

This guide explains how to set up Firebase authentication for your EchoPath project.

## Prerequisites

1. A Google account
2. Access to the Firebase console

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Follow the setup wizard:
   - Enter your project name (e.g., "echopath")
   - Choose whether to enable Google Analytics (optional)
   - Select your Google Analytics account if enabled

## Step 2: Enable Authentication

1. In your Firebase project console, click "Authentication" in the left sidebar
2. Click "Get started" if it's your first time
3. Go to the "Sign-in method" tab
4. Enable the following providers:
   - **Email/Password**: Click on it and toggle "Enable"
   - **Google**: Click on it, toggle "Enable", and set up your OAuth consent screen

## Step 3: Create a Web App

1. In the Firebase project overview, click the web icon (</>) to add a web app
2. Register your app with a nickname (e.g., "echopath-web")
3. You don't need to set up Firebase Hosting for now
4. Copy the Firebase configuration object

## Step 4: Set up Firestore Database

1. In the Firebase console, click "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in test mode" for development (you can secure it later)
4. Select a location for your database

## Step 5: Generate Service Account Key

1. Go to Project Settings (gear icon) → Service accounts
2. Click "Generate new private key"
3. Download the JSON file containing your service account credentials

## Step 6: Configure Environment Variables

Update your `.env` file with the following Firebase configuration:

### Firebase Client Configuration (for frontend)
```env
VITE_FIREBASE_API_KEY=your-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### Firebase Admin Configuration (for backend)
```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account-email@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
```

**Note**: Replace all `your-*` placeholders with actual values from your Firebase project.

## Step 7: Update Google OAuth Configuration

Make sure your Google OAuth configuration in the `.env` file matches the one in your Firebase project:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Step 8: Install Dependencies

The necessary dependencies are already included in the project:

### Client Dependencies
- `firebase` - Firebase SDK for web
- `axios` - For API requests

### Server Dependencies
- `firebase-admin` - Firebase Admin SDK for Python

## Step 9: Run the Application

1. **Start the backend server:**
   ```bash
   cd server
   python main.py
   ```

2. **Start the frontend development server:**
   ```bash
   cd client
   npm run dev
   ```

## Features Included

### Authentication Methods
- **Email/Password Registration and Login**
- **Google OAuth Sign-in**
- **Firebase Authentication Integration**

### Data Storage
- **User profiles stored in Firestore**
- **Authentication state persistence**
- **Automatic token refresh**

### Security Features
- **Firebase ID token verification**
- **JWT token generation for API access**
- **Secure user session management**

## Firestore Database Structure

The application creates the following collections:

### Users Collection (`users`)
```json
{
  "uid": "firebase-user-id",
  "email": "user@example.com",
  "displayName": "User Name",
  "photoURL": "https://...",
  "authProvider": "google|email|firebase",
  "emailVerified": true,
  "isActive": true,
  "createdAt": "timestamp",
  "lastLoginAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Troubleshooting

### Common Issues

1. **Firebase Configuration Error**
   - Make sure all environment variables are set correctly
   - Check that the Firebase project ID matches across all configurations

2. **Google OAuth Issues**
   - Verify that the Google OAuth client ID matches the one in Firebase
   - Check that the authorized redirect URIs include your development URL

3. **Firestore Permission Errors**
   - Make sure Firestore is set up with proper security rules
   - For development, use test mode with open rules

4. **Token Verification Errors**
   - Ensure the Firebase service account key is correctly formatted
   - Check that the private key includes proper line breaks (`\n`)

### Security Rules for Production

When ready for production, update your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
