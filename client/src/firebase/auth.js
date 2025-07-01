import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  updateDoc 
} from 'firebase/firestore';
import { auth, db, googleProvider } from './config.js';

// User data interface
export const createUserProfile = async (user, additionalData = {}) => {
  if (!user) return null;
  
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    const { displayName, email, photoURL } = user;
    const createdAt = serverTimestamp();
    
    try {
      await setDoc(userRef, {
        displayName: displayName || additionalData.displayName || '',
        email,
        photoURL: photoURL || '',
        createdAt,
        lastLoginAt: createdAt,
        authProvider: additionalData.authProvider || 'firebase',
        isActive: true,
        ...additionalData
      });
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  } else {
    // Update last login time
    try {
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }
  
  return userRef;
};

// Google Sign In
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create or update user profile in Firestore
    await createUserProfile(user, { authProvider: 'google' });
    
    return {
      success: true,
      user,
      message: 'Successfully signed in with Google'
    };
  } catch (error) {
    console.error('Google sign in error:', error);
    return {
      success: false,
      error: error.code,
      message: error.message
    };
  }
};

// Email/Password Sign In
export const signInWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;
    
    // Update last login time
    await createUserProfile(user);
    
    return {
      success: true,
      user,
      message: 'Successfully signed in'
    };
  } catch (error) {
    console.error('Email sign in error:', error);
    return {
      success: false,
      error: error.code,
      message: error.message
    };
  }
};

// Email/Password Sign Up
export const signUpWithEmail = async (email, password, displayName = '') => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    
    // Update display name if provided
    if (displayName) {
      await updateProfile(user, { displayName });
    }
    
    // Create user profile in Firestore
    await createUserProfile(user, { 
      authProvider: 'email',
      displayName: displayName || email.split('@')[0]
    });
    
    return {
      success: true,
      user,
      message: 'Account created successfully'
    };
  } catch (error) {
    console.error('Email sign up error:', error);
    return {
      success: false,
      error: error.code,
      message: error.message
    };
  }
};

// Sign Out
export const logOut = async () => {
  try {
    await signOut(auth);
    return {
      success: true,
      message: 'Successfully signed out'
    };
  } catch (error) {
    console.error('Sign out error:', error);
    return {
      success: false,
      error: error.code,
      message: error.message
    };
  }
};

// Auth State Observer
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Get user profile from Firestore
export const getUserProfile = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return {
        success: true,
        data: { id: userSnap.id, ...userSnap.data() }
      };
    } else {
      return {
        success: false,
        message: 'User profile not found'
      };
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    return {
      success: false,
      error: error.code,
      message: error.message
    };
  }
};

// Update user profile
export const updateUserProfile = async (uid, data) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      message: 'Profile updated successfully'
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return {
      success: false,
      error: error.code,
      message: error.message
    };
  }
};
