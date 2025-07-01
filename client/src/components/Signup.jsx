import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { GoogleAuthButton } from './GoogleAuth'

function Signup({ onSignup }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    // Validate password strength
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    try {
      const response = await axios.post('http://localhost:8000/api/auth/register', {
        email: formData.email,
        password: formData.password,
        full_name: formData.fullName
      })

      // Auto-login after successful registration
      const loginResponse = await axios.post('http://localhost:8000/api/auth/login', {
        username: formData.email,
        password: formData.password
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      })

      // Store token in localStorage
      localStorage.setItem('token', loginResponse.data.access_token)
      localStorage.setItem('user', JSON.stringify({
        email: formData.email,
        fullName: formData.fullName,
        token_type: loginResponse.data.token_type
      }))

      onSignup({
        email: formData.email,
        fullName: formData.fullName,
        token: loginResponse.data.access_token
      })
    } catch (error) {
      setError(error.response?.data?.detail || 'Registration failed. Please try again.')
    }
    setLoading(false)
  }

  const handleGoogleSignup = (userData) => {
    onSignup(userData)
  }

  const handleGoogleError = (error) => {
    setError(error)
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{backgroundColor: '#3D74B3'}}>
      {/* Top Spacer */}
      <div className="h-32"></div>
      
      {/* Top Section - Welcome Text */}
      <div className="flex items-center justify-center text-gray-800 px-12 py-8 mb-24">
        <div className="max-w-lg text-center bg-white/90 backdrop-blur-sm border-2 border-white rounded-2xl p-8 shadow-2xl">
          <h1 className="text-4xl font-bold mb-4 text-gray-800">
            EchoPath
          </h1>
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
            Hello There
          </h2>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Ready to get started? Create your account and join the EchoPath community. Your journey begins here!
          </p>
          <div className="flex items-center justify-center space-x-4 text-gray-500">
            <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-blue-400"></div>
            <span className="text-sm font-medium">JOIN US TODAY</span>
            <div className="w-12 h-0.5 bg-gradient-to-l from-transparent to-blue-400"></div>
          </div>
        </div>
      </div>

      {/* Middle Spacer */}
      <div className="mb-32"></div>

      {/* Bottom Section - Signup Form */}
      <div className="flex items-center justify-center px-12 py-8 pb-20">
        <div className="w-full max-w-md">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-10 border-2 border-white">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Create Account</h2>
              <p className="text-gray-600">Fill in your details to get started</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/90"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/90"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/90"
                  placeholder="Create a password"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/90"
                  placeholder="Confirm your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-lg"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <GoogleAuthButton 
                  onSuccess={handleGoogleSignup}
                  onError={handleGoogleError}
                  text="Sign up with Google"
                />
              </div>
            </div>

            <div className="text-center mt-8">
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link 
                  to="/login" 
                  className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Signup
