import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, updateProfile } from 'firebase/auth'
import { auth } from '../firebase/config'

function SimpleSignup() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.')
      setLoading(false)
      return
    }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password)
      console.log('✅ Account created successfully!')
      
      // Optional: Update user profile with display name
      // await updateProfile(userCredential.user, {
      //   displayName: formData.email.split('@')[0]
      // })
      
      navigate('/dashboard')
    } catch (error) {
      console.error('Signup error:', error)
      setError(getErrorMessage(error.code))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true)
    setError('')
    
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      console.log('✅ Google sign-up successful!')
      navigate('/dashboard')
    } catch (error) {
      console.error('Google sign-up error:', error)
      setError(getErrorMessage(error.code))
    } finally {
      setGoogleLoading(false)
    }
  }

  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.'
      case 'auth/invalid-email':
        return 'Invalid email address.'
      case 'auth/operation-not-allowed':
        return 'Email/password accounts are not enabled.'
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.'
      case 'auth/popup-closed-by-user':
        return 'Google sign-up was cancelled.'
      default:
        return 'An error occurred during sign-up. Please try again.'
    }
  }

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
    if (error) setError('')
  }

  return (
    <div className="page-container page-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="card p-8">
          <div className="text-center mb-8">
            <h1 className="section-title">Create Account</h1>
            <p className="text-white/80 mt-2">Join us today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-3 rounded-md">
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-md shadow-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 bg-white/10 text-white border border-white/20"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-md shadow-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 bg-white/10 text-white border border-white/20"
                placeholder="Create a password (min 6 characters)"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/90 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-md shadow-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 bg-white/10 text-white border border-white/20"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full btn-primary"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating account...
                </div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-transparent text-white/70">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={loading || googleLoading}
              className="mt-4 w-full btn-ghost"
            >
              {googleLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                  Signing up with Google...
                </div>
              ) : (
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </div>
              )}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-white/80">
              Already have an account?{' '}
              <Link to="/login" className="font-medium underline hover:opacity-80">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimpleSignup
