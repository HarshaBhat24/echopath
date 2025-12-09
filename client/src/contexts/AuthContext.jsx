import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithGoogle, 
  signInWithEmail, 
  signUpWithEmail, 
  logOut, 
  onAuthStateChange,
  getCurrentUser,
  getUserProfile,
  updateUserProfile
} from '../firebase/auth.js';
import { auth } from '../firebase/config.js';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiToken, setApiToken] = useState(localStorage.getItem('api_token'));

  // Function to get Firebase ID token and authenticate with our API
  const authenticateWithAPI = async (firebaseUser) => {
    try {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        
        // Send Firebase token to our API
        const response = await axios.post('http://localhost:8000/api/auth/firebase', {
          firebase_token: idToken
        });
        
        const { access_token } = response.data;
        setApiToken(access_token);
        localStorage.setItem('api_token', access_token);
        
        // Set default authorization header for future requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        
        return access_token;
      } else {
        // User signed out
        setApiToken(null);
        localStorage.removeItem('api_token');
        delete axios.defaults.headers.common['Authorization'];
        return null;
      }
    } catch (error) {
      console.error('Error authenticating with API:', error);
      return null;
    }
  };

  // Function to load user profile from Firestore
  const loadUserProfile = async (uid) => {
    try {
      const result = await getUserProfile(uid);
      if (result.success) {
        setUserProfile(result.data);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Authenticate with our API
        await authenticateWithAPI(firebaseUser);
        
        // Load user profile
        await loadUserProfile(firebaseUser.uid);
      } else {
        setUserProfile(null);
        await authenticateWithAPI(null);
      }
      
      setLoading(false);
    });

    // Set up axios interceptor for token refresh
    const axiosInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && user) {
          // Token might be expired, try to refresh
          try {
            const newToken = await user.getIdToken(true);
            const response = await axios.post('http://localhost:8000/api/auth/firebase', {
              firebase_token: newToken
            });
            
            const { access_token } = response.data;
            setApiToken(access_token);
            localStorage.setItem('api_token', access_token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            
            // Retry the original request
            error.config.headers['Authorization'] = `Bearer ${access_token}`;
            return axios.request(error.config);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            await logOut();
          }
        }
        return Promise.reject(error);
      }
    );

    // Set initial token if available
    if (apiToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${apiToken}`;
    }

    return () => {
      unsubscribe();
      axios.interceptors.response.eject(axiosInterceptor);
    };
  }, []);

  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const result = await signInWithEmail(email, password);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password, displayName) => {
    setLoading(true);
    try {
      const result = await signUpWithEmail(email, password, displayName);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signInGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const result = await logOut();
      return result;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData) => {
    if (!user) return { success: false, error: 'No user logged in' };
    
    try {
      const result = await updateUserProfile(user.uid, profileData);
      if (result.success) {
        // Reload user profile after update
        await loadUserProfile(user.uid);
      }
      return result;
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    userProfile,
    apiToken,
    loading,
    signIn,
    signUp,
    signInGoogle,
    signOut,
    loadUserProfile,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
