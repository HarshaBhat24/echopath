import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'
import translationImage from '../assets/translation.png'
import voiceImage from '../assets/voice.png'
import photoImage from '../assets/photo.png'


function SimpleDashboard() {
  const [showProfile, setShowProfile] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [primaryLanguage, setPrimaryLanguage] = useState('')
  const [savingLanguage, setSavingLanguage] = useState(false)
  const [translationHistory, setTranslationHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const { user, userProfile, updateProfile, loading } = useAuth()
  const navigate = useNavigate()
  const profileRef = useRef(null)
  const historyRef = useRef(null)

  useEffect(() => {
    // Redirect to login if no user
    if (!loading && !user) {
      navigate('/login')
    }
  }, [user, loading, navigate])

  useEffect(() => {
    // Load primary language from profile
    if (userProfile?.primaryLanguage) {
      setPrimaryLanguage(userProfile.primaryLanguage)
    }
  }, [userProfile])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false)
      }
      if (historyRef.current && !historyRef.current.contains(event.target)) {
        setShowHistory(false)
      }
    }

    if (showProfile || showHistory) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfile, showHistory])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      console.log('Sign out successful!')
      navigate('/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handleSavePrimaryLanguage = async () => {
    if (!primaryLanguage) return
    
    setSavingLanguage(true)
    try {
      console.log('Saving primary language:', primaryLanguage)
      const result = await updateProfile({ primaryLanguage })
      console.log('Save result:', result)
      if (result.success) {
        console.log('Primary language saved successfully')
        // Show a brief success indication
        setTimeout(() => {
          setSavingLanguage(false)
        }, 500)
      } else {
        console.error('Failed to save primary language:', result.error)
        setSavingLanguage(false)
      }
    } catch (error) {
      console.error('Error saving primary language:', error)
      setSavingLanguage(false)
    }
  }

  const fetchTranslationHistory = async () => {
    setLoadingHistory(true)
    try {
      let token = localStorage.getItem('api_token')
      if (!token && auth?.currentUser) {
        const idToken = await auth.currentUser.getIdToken()
        const resp = await axios.post('http://localhost:8000/api/auth/firebase', {
          firebase_token: idToken
        })
        token = resp.data?.access_token
        if (token) {
          localStorage.setItem('api_token', token)
        }
      }
      
      const response = await axios.get('http://localhost:8000/api/translation/history', {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      setTranslationHistory(response.data.history || [])
    } catch (error) {
      console.error('Error fetching translation history:', error)
      setTranslationHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleShowHistory = () => {
    setShowHistory(true)
    fetchTranslationHistory()
  }

  const handleDeleteHistoryItem = async (historyId) => {
    try {
      const token = localStorage.getItem('api_token')
      await axios.delete(`http://localhost:8000/api/translation/history/${historyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      // Refresh history
      fetchTranslationHistory()
    } catch (error) {
      console.error('Error deleting history item:', error)
    }
  }

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all translation history?')) {
      return
    }
    
    try {
      const token = localStorage.getItem('api_token')
      await axios.post('http://localhost:8000/api/translation/history/clear', {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setTranslationHistory([])
    } catch (error) {
      console.error('Error clearing history:', error)
    }
  }

  const getLanguageFlag = (langCode) => {
    const flags = {
      'en': '🇺🇸',
      'eng_Latn': '🇺🇸',
      'hi': '🇮🇳',
      'hin_Deva': '🇮🇳',
      'ka': '🇮🇳',
      'kan_Knda': '🇮🇳',
      'ta': '🇮🇳',
      'tam_Taml': '🇮🇳',
      'te': '🇮🇳',
      'tel_Telu': '🇮🇳',
      'ma': '🇮🇳',
      'mal_Mlym': '🇮🇳',
      'be': '🇮🇳',
      'ben_Beng': '🇮🇳'
    }
    return flags[langCode] || '🌐'
  }

  const getTranslationTypeIcon = (type) => {
    const icons = {
      'text': '📝',
      'voice': '🎤',
      'photo': '📷'
    }
    return icons[type] || '💬'
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Recently'
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
          <div className="flex items-center space-x-4">
            {/* History Button */}
            <button
              onClick={handleShowHistory}
              className="p-4 rounded-full bg-white/10 backdrop-blur-xl border-2 border-white/20 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-cyan-400/50 hover:bg-white/20 transition-all duration-300 shadow-xl"
              title="Translation History"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            
            {/* Profile Button */}
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
                <div className="border-t border-white/20 pt-4 mt-4">
                  <label className="block text-sm text-white/70 mb-2">Primary Language:</label>
                  <select
                    value={primaryLanguage}
                    onChange={(e) => setPrimaryLanguage(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50 transition-all duration-300"
                  >
                    <option value="" className="bg-gray-800">Select Language</option>
                    <option value="en" className="bg-gray-800">🇬🇧 English</option>
                    <option value="hi" className="bg-gray-800">🇮🇳 Hindi</option>
                    <option value="ka" className="bg-gray-800">🇮🇳 Kannada</option>
                    <option value="ta" className="bg-gray-800">🇮🇳 Tamil</option>
                    <option value="te" className="bg-gray-800">🇮🇳 Telugu</option>
                    <option value="ma" className="bg-gray-800">🇮🇳 Malayalam</option>
                    <option value="be" className="bg-gray-800">🇮🇳 Bengali</option>
                  </select>
                  <button
                    onClick={handleSavePrimaryLanguage}
                    disabled={!primaryLanguage || savingLanguage}
                    className="mt-3 w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium rounded-xl transition-all duration-300 shadow-lg hover:shadow-purple-500/25 focus:ring-4 focus:ring-purple-400/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {savingLanguage ? '💾 Saving...' : '💾 Save Language'}
                  </button>
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
        </div>

        {/* Translation History Modal */}
        {showHistory && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div ref={historyRef} className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/15 max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="p-6 border-b border-white/20 bg-gradient-to-r from-white/10 to-transparent flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
                  <span>🕐</span>
                  <span>Translation History</span>
                </h2>
                <div className="flex space-x-3">
                  {translationHistory.length > 0 && (
                    <button
                      onClick={handleClearHistory}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-all duration-300 text-sm font-medium"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-2 hover:bg-white/20 rounded-xl transition-all duration-300"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                  </div>
                ) : translationHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-white text-xl font-semibold mb-2">No translations yet</p>
                    <p className="text-white/70">Your translation history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {translationHistory.map((item) => (
                      <div key={item.id} className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 hover:bg-white/10 transition-all duration-300">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <span className="text-3xl">{getTranslationTypeIcon(item.type)}</span>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{getLanguageFlag(item.sourceLang)}</span>
                                <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                                <span className="text-lg">{getLanguageFlag(item.targetLang)}</span>
                              </div>
                              <p className="text-white/60 text-xs mt-1">{formatTimestamp(item.timestamp)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteHistoryItem(item.id)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-all duration-300 group"
                            title="Delete"
                          >
                            <svg className="w-5 h-5 text-white/50 group-hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="bg-white/5 rounded-xl p-3">
                            <p className="text-white/60 text-xs font-semibold mb-1 uppercase tracking-wider">Original</p>
                            <p className="text-white text-sm leading-relaxed">{item.originalText}</p>
                          </div>
                          
                          <div className="bg-white/5 rounded-xl p-3">
                            <p className="text-white/60 text-xs font-semibold mb-1 uppercase tracking-wider">Translation</p>
                            <p className="text-white text-sm leading-relaxed">{item.translatedText}</p>
                          </div>
                          
                          {item.romanizedText && (
                            <div className="bg-white/5 rounded-xl p-3">
                              <p className="text-white/60 text-xs font-semibold mb-1 uppercase tracking-wider">Romanized</p>
                              <p className="text-purple-200 text-sm leading-relaxed italic">{item.romanizedText}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
