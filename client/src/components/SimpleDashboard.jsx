import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'
import translationImage from '../assets/translation.png'
import voiceImage from '../assets/voice.png'
import photoImage from '../assets/photo.png'


function SimpleDashboard() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showProfile, setShowProfile] = useState(false)
  const navigate = useNavigate()
  const profileRef = useRef(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
      } else {
        navigate('/login')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [navigate])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false)
      }
    }

    if (showProfile) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfile])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      console.log('Sign out successful!')
      navigate('/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🎉 EchoPath</h1>
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full" />
              ) : (
                <span className="text-gray-600 font-semibold">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </button>
            {showProfile && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl p-4 z-10">
                <div className="flex items-center mb-4">
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      className="w-12 h-12 rounded-full mr-3"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {user.displayName || 'User'}
                    </p>
                    <p className="text-xs text-gray-600">{user.email}</p>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Email Verified: {' '}
                    <span className={`text-xs font-medium ${
                      user.emailVerified ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {user.emailVerified ? '✅ Verified' : '⚠️ Not Verified'}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    Account Created: {new Date(user.metadata.creationTime).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Last Sign In: {new Date(user.metadata.lastSignInTime).toLocaleDateString()}
                  </p>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Translation Boxes */}
        <div className="flex-1 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-4 max-w-5xl mx-auto justify-items-center">
          <div
            onClick={() => navigate('/text-translation')}
            className="relative rounded-lg overflow-hidden shadow-xl cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:scale-105 hover:border-4 hover:border-purple-500"
          >
            <img src={translationImage} alt="Text Translation" className="w-full h-48 object-cover" />
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
              <h2 className="text-2xl font-bold text-white">Text Translation</h2>
            </div>
          </div>
          <div
            onClick={() => navigate('/voice-translation')}
            className="relative rounded-lg overflow-hidden shadow-xl cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:scale-105 hover:border-4 hover:border-purple-500"
          >
            <img src={voiceImage} alt="Voice Translation" className="w-full h-48 object-cover" />
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
              <h2 className="text-2xl font-bold text-white">Voice Translation</h2>
            </div>
          </div>
          <div
            onClick={() => navigate('/photo-translation')}
            className="relative rounded-lg overflow-hidden shadow-xl cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:scale-105 hover:border-4 hover:border-purple-500"
          >
            <img src={photoImage} alt="Photo Translation" className="w-full h-48 object-cover" />
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
              <h2 className="text-2xl font-bold text-white">Translation Through Photo</h2>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimpleDashboard
