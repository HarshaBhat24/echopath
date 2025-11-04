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
    <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 relative overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 left-1/3 w-96 h-96 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
        <div className="absolute bottom-40 right-1/4 w-96 h-96 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '6s' }}></div>
      </div>

      {/* Floating Particles */}
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-white rounded-full opacity-30 animate-pulse"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${3 + Math.random() * 4}s`
          }}
        ></div>
      ))}

      <div className="relative z-10 container mx-auto px-6 py-8 min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-indigo-300 bg-clip-text text-transparent drop-shadow-2xl">
            🌐 EchoPath
          </h1>
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border-2 border-white/20 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-purple-400/50 hover:bg-white/20 transition-all duration-300 shadow-xl"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full" />
              ) : (
                <span className="text-white text-xl font-bold">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </button>
            {showProfile && (
              <div className="absolute right-0 mt-4 w-80 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-6 z-50 shadow-2xl">
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-400 to-indigo-400 flex items-center justify-center mr-4 shadow-lg">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full" />
                    ) : (
                      <span className="text-white text-2xl font-bold">
                        {user.email?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">
                      {user.displayName || 'User'}
                    </p>
                    <p className="text-sm text-white/70">{user.email}</p>
                  </div>
                </div>
                <div className="border-t border-white/20 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Email Status:</span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      user.emailVerified 
                        ? 'bg-green-500/20 text-green-300' 
                        : 'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {user.emailVerified ? '✅ Verified' : '⚠️ Unverified'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Member Since:</span>
                    <span className="text-sm text-white font-medium">
                      {new Date(user.metadata.creationTime).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Last Login:</span>
                    <span className="text-sm text-white font-medium">
                      {new Date(user.metadata.lastSignInTime).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={handleSignOut} 
                  className="mt-6 w-full px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-red-500/25 focus:ring-4 focus:ring-red-400/50"
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Welcome Message */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3 drop-shadow-lg">
            Welcome back, {user.displayName?.split(' ')[0] || 'there'}! 👋
          </h2>
          <p className="text-xl text-white/80 drop-shadow-lg">
            Choose your translation method to get started
          </p>
        </div>

        {/* Translation Cards */}
        <div className="flex-1 flex items-center justify-center pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full">
            {/* Text Translation Card */}
            <div
              onClick={() => navigate('/text-translation')}
              className="group relative bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 p-8 cursor-pointer transition-all duration-500 hover:bg-white/20 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25 hover:border-purple-400/50"
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="mb-6 flex items-center justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <span className="text-4xl">📝</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white text-center mb-3 group-hover:text-purple-200 transition-colors">
                  Text Translation
                </h3>
                <p className="text-white/70 text-center text-sm leading-relaxed">
                  Translate text between Indian languages with high accuracy using IndicTrans2
                </p>
                <div className="mt-6 flex justify-center">
                  <span className="px-4 py-2 bg-purple-500/20 text-purple-200 rounded-full text-sm font-medium group-hover:bg-purple-500/30 transition-colors">
                    Click to Start →
                  </span>
                </div>
              </div>
            </div>

            {/* Voice Translation Card */}
            <div
              onClick={() => navigate('/voice-translation')}
              className="group relative bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 p-8 cursor-pointer transition-all duration-500 hover:bg-white/20 hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/25 hover:border-pink-400/50"
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-pink-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="mb-6 flex items-center justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-pink-400 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <span className="text-4xl">🎤</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white text-center mb-3 group-hover:text-pink-200 transition-colors">
                  Voice Translation
                </h3>
                <p className="text-white/70 text-center text-sm leading-relaxed">
                  Speak naturally and get instant translations with speech recognition
                </p>
                <div className="mt-6 flex justify-center">
                  <span className="px-4 py-2 bg-pink-500/20 text-pink-200 rounded-full text-sm font-medium group-hover:bg-pink-500/30 transition-colors">
                    Click to Start →
                  </span>
                </div>
              </div>
            </div>

            {/* Photo Translation Card */}
            <div
              onClick={() => navigate('/photo-translation')}
              className="group relative bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 p-8 cursor-pointer transition-all duration-500 hover:bg-white/20 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/25 hover:border-cyan-400/50"
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="mb-6 flex items-center justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <span className="text-4xl">📷</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white text-center mb-3 group-hover:text-cyan-200 transition-colors">
                  Photo Translation
                </h3>
                <p className="text-white/70 text-center text-sm leading-relaxed">
                  Upload images with text and get OCR-powered translations instantly
                </p>
                <div className="mt-6 flex justify-center">
                  <span className="px-4 py-2 bg-cyan-500/20 text-cyan-200 rounded-full text-sm font-medium group-hover:bg-cyan-500/30 transition-colors">
                    Click to Start →
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="mt-auto pt-8 border-t border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-300 mb-1">7+</div>
              <div className="text-sm text-white/70">Indian Languages</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-pink-300 mb-1">3</div>
              <div className="text-sm text-white/70">Translation Methods</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-300 mb-1">AI</div>
              <div className="text-sm text-white/70">Powered by IndicTrans2</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimpleDashboard
