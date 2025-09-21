import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'

function TextTranslation() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [inputText, setInputText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('hi')
  const [isTranslating, setIsTranslating] = useState(false)
  const [animateTranslation, setAnimateTranslation] = useState(false)
  const navigate = useNavigate()

  const languages = [
    { code: 'auto', name: '🔍 Auto Detect', flag: '🌐' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'हिंदी (Hindi)', flag: '🇮🇳' },
    { code: 'ka', name: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳' },
    { code: 'ta', name: 'தமிழ் (Tamil)', flag: '🇮🇳' },
    { code: 'te', name: 'తెలుగు (Telugu)', flag: '🇮🇳' },
    { code: 'ma', name: 'മലയാളം (Malayalam)', flag: '🇮🇳' },
    { code: 'be', name: 'বাংলা (Bengali)', flag: '🇮🇳' }
  ]

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

  const handleTranslate = async () => {
    if (!inputText.trim()) return

    setIsTranslating(true)
    setAnimateTranslation(true)
    
    try {
      // Ensure we have an API token before calling protected endpoint
      let token = localStorage.getItem('api_token')
      if (!token && auth?.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken()
          const resp = await axios.post('http://localhost:8000/api/auth/firebase', {
            firebase_token: idToken
          })
          token = resp.data?.access_token
          if (token) {
            localStorage.setItem('api_token', token)
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
          }
        } catch (e) {
          console.error('API auth exchange failed:', e)
        }
      }

      const token2 = localStorage.getItem('api_token')
      const { data } = await axios.post(
        'http://localhost:8000/api/translate/text',
        {
          text: inputText,
          source_lang: sourceLang,
          target_lang: targetLang
        },
        token2 ? { headers: { Authorization: `Bearer ${token2}` } } : undefined
      )
      setTranslatedText(data.translated_text)
      setTimeout(() => setAnimateTranslation(false), 1000)
    } catch (error) {
      console.error('Translation error:', error)
      const detail = error?.response?.data?.detail
      setTranslatedText(detail ? `Translation failed: ${detail}` : 'Translation failed. Please try again.')
      setAnimateTranslation(false)
    } finally {
      setIsTranslating(false)
    }
  }

  const clearText = () => {
    setInputText('')
    setTranslatedText('')
    setAnimateTranslation(false)
  }

  const swapLanguages = () => {
    if (sourceLang !== 'auto') {
      setSourceLang(targetLang)
      setTargetLang(sourceLang)
      setInputText(translatedText)
      setTranslatedText(inputText)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
  }

  const getLanguageByCode = (code) => {
    return languages.find(lang => lang.code === code) || { name: 'Unknown', flag: '❓' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-b-4 border-purple-400 mx-auto mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl">🌐</span>
            </div>
          </div>
          <p className="text-white text-lg font-medium">Loading EchoPath...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="page-container page-bg">
      {/* Enhanced Animated Background Elements */}
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-r from-pink-300 to-purple-400 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-pulse animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-gradient-to-r from-indigo-400 to-cyan-400 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-pulse animation-delay-4000"></div>
        <div className="absolute bottom-40 right-1/3 w-64 h-64 bg-gradient-to-r from-pink-500 to-rose-400 rounded-full mix-blend-multiply filter blur-2xl opacity-25 animate-pulse animation-delay-1000"></div>
        
        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-20 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            ></div>
          ))}
        </div>
      </div>

  <div className="page-inner overflow-x-hidden pointer-events-auto">
        {/* Header */}
  <div className="flex items-center justify-between mb-12 max-w-7xl mx-auto">
          <div className="flex items-center space-x-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="group flex items-center space-x-3 px-6 py-3 bg-white/15 backdrop-blur-xl rounded-2xl border border-white/25 text-white hover:bg-white/25 transition-all duration-500 shadow-2xl hover:shadow-blue-500/25"
            >
              <svg className="w-6 h-6 group-hover:translate-x-[-8px] transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-semibold text-lg">Back to Dashboard</span>
            </button>
            <div className="text-white">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent flex items-center space-x-3">
                <span className="text-5xl">�</span>
                <span>Text Translation</span>
              </h1>
              <p className="text-white/80 mt-2 text-lg">Break language barriers with AI-powered translation</p>
            </div>
          </div>
        </div>

        {/* Main Translation Interface */}
        <div className="max-w-7xl mx-auto">
          {/* Language Selection Card */}
          <div className="card p-6 mb-10 transition-all duration-500">
            <div className="flex items-center justify-center space-x-8">
              {/* Source Language */}
              <div className="flex flex-col space-y-4">
                <label className="text-white text-lg font-bold uppercase tracking-wider drop-shadow-lg">From Language</label>
                <div className="relative group">
                  <select
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                    className="appearance-none bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-xl border border-white/30 rounded-2xl px-6 py-4 text-white font-semibold focus:outline-none focus:ring-4 focus:ring-pink-400/50 focus:border-transparent cursor-pointer min-w-[250px] text-lg hover:bg-white/25 transition-all duration-300 shadow-xl"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-gray-900 text-white py-2">
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Swap Button */}
              <button
                onClick={swapLanguages}
                disabled={sourceLang === 'auto'}
                className="group mt-10 p-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 rounded-2xl text-white hover:from-blue-600 hover:via-indigo-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500 shadow-2xl hover:shadow-blue-500/50"
              >
                <svg className="w-8 h-8 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m0-4l4-4" />
                </svg>
              </button>
              
              {/* Target Language */}
              <div className="flex flex-col space-y-4">
                <label className="text-white text-lg font-bold uppercase tracking-wider drop-shadow-lg">To Language</label>
                <div className="relative group">
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="appearance-none bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-xl border border-white/30 rounded-2xl px-6 py-4 text-white font-semibold focus:outline-none focus:ring-4 focus:ring-purple-400/50 focus:border-transparent cursor-pointer min-w-[250px] text-lg hover:bg-white/25 transition-all duration-300 shadow-xl"
                  >
                    {languages.filter(lang => lang.code !== 'auto').map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-gray-900 text-white py-2">
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Translation Boxes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Input Box */}
            <div className="group card shadow-2xl hover:shadow-blue-500/25 transition-all duration-500 overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-white/20 bg-gradient-to-r from-white/10 to-transparent">
                <div className="flex items-center space-x-4">
                  <span className="text-4xl drop-shadow-lg">{getLanguageByCode(sourceLang).flag}</span>
                  <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                    {getLanguageByCode(sourceLang).name}
                  </h3>
                </div>
                <button
                  onClick={clearText}
                  className="text-white/70 hover:text-white transition-all duration-300 p-3 rounded-xl hover:bg-white/20 shadow-lg"
                  title="Clear text"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type or paste your text here and watch the magic happen..."
                  className="w-full h-60 bg-transparent text-white placeholder-white/50 resize-none focus:outline-none text-xl leading-relaxed font-medium"
                />
                <div className="flex justify-between items-center mt-4">
                  <span className="text-white/70 text-lg font-medium">
                    {inputText.length} characters
                  </span>
                  <button
                    onClick={handleTranslate}
                    disabled={!inputText.trim() || isTranslating}
                    className="btn-primary relative px-10 py-4 rounded-2xl text-lg shadow-2xl hover:shadow-blue-500/50"
                  >
                    {isTranslating ? (
                      <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        <span>Translating Magic...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <span>✨ Translate Now</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Output Box */}
            <div className={`group card shadow-2xl transition-all duration-500 overflow-hidden ${animateTranslation ? 'ring-4 ring-blue-400/50 shadow-blue-500/50' : 'hover:shadow-blue-500/25'}`}>
              <div className="flex justify-between items-center p-6 border-b border-white/20 bg-gradient-to-r from-white/10 to-transparent">
                <div className="flex items-center space-x-4">
                  <span className="text-4xl drop-shadow-lg">{getLanguageByCode(targetLang).flag}</span>
                  <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                    {getLanguageByCode(targetLang).name}
                  </h3>
                </div>
                {translatedText && (
                  <button
                    onClick={() => copyToClipboard(translatedText)}
                    className="text-white/70 hover:text-white transition-all duration-300 p-3 rounded-xl hover:bg-white/20 shadow-lg"
                    title="Copy translation"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="p-6">
                <div className="w-full h-60 flex items-start">
                  {translatedText ? (
                    <p className="text-white text-xl leading-relaxed whitespace-pre-wrap break-words w-full font-medium">
                      {translatedText}
                    </p>
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full text-white/70">
                      <div className="text-8xl mb-6 opacity-50 animate-pulse">🌟</div>
                      <p className="text-center text-xl font-semibold mb-2">Your translation will appear here!</p>
                      <p className="text-center text-lg opacity-75">Start typing to experience the magic ✨</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TextTranslation
