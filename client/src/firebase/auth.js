// Lightweight wrappers around Firebase Auth/Firestore used by AuthContext
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from './config.js'

export const signInWithGoogle = async () => {
  const provider = googleProvider || new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return { success: true, user: result.user }
}

export const signInWithEmail = async (email, password) => {
  const result = await signInWithEmailAndPassword(auth, email, password)
  return { success: true, user: result.user }
}

export const signUpWithEmail = async (email, password, displayName) => {
  const result = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName) {
    await updateProfile(result.user, { displayName })
  }
  // Create basic user profile in Firestore
  const ref = doc(db, 'users', result.user.uid)
  await setDoc(ref, {
    email,
    displayName: displayName || '',
    photoURL: result.user.photoURL || '',
    emailVerified: result.user.emailVerified || false,
    authProvider: 'password',
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    isActive: true
  })
  return { success: true, user: result.user }
}

export const logOut = async () => {
  await signOut(auth)
  return { success: true }
}

export const onAuthStateChange = (callback) => onAuthStateChanged(auth, callback)

export const getCurrentUser = () => auth.currentUser

export const getUserProfile = async (uid) => {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    return { success: true, data: snap.data() }
  }
  return { success: false, data: null }
}
