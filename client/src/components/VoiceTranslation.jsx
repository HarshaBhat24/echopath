import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'

function VoiceTranslation() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [transcribedText, setTranscribedText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [romanizedText, setRomanizedText] = useState('')
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('ka')
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [inputMode, setInputMode] = useState('record') // 'record' or 'upload'
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const intervalRef = useRef(null)
  const fileInputRef = useRef(null)
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

  const getLanguageByCode = (code) => {
    return languages.find(lang => lang.code === code) || { name: 'Unknown', flag: '❓' }
  }

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
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        setAudioBlob(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setRecordingTime(0)
      
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Please allow microphone access to record audio.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Check if it's an audio file
      if (!file.type.startsWith('audio/')) {
        alert('Please upload an audio file (mp3, wav, m4a, etc.)')
        return
      }
      setUploadedFile(file)
      setAudioBlob(null) // Clear any recorded audio
      setTranscribedText('')
      setTranslatedText('')
      setRomanizedText('')
    }
  }

  const clearUploadedFile = () => {
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setTranscribedText('')
    setTranslatedText('')
    setRomanizedText('')
  }

  const handleTranslate = async () => {
    const audioToTranslate = uploadedFile || audioBlob
    if (!audioToTranslate) return

    setIsProcessing(true)
    try {
      const formData = new FormData()
      if (uploadedFile) {
        formData.append('audio', uploadedFile)
      } else {
        formData.append('audio', audioBlob, 'recording.wav')
      }
  formData.append('source_lang', sourceLang)
  formData.append('target_lang', targetLang)

      // Ensure we have an API token before calling protected endpoint
      let token = localStorage.getItem('api_token')
      if (!token && auth?.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken()
          const resp = await fetch('http://localhost:8000/api/auth/firebase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firebase_token: idToken })
          })
          if (resp.ok) {
            const data = await resp.json()
            token = data?.access_token
            if (token) localStorage.setItem('api_token', token)
          }
        } catch (e) {
          console.error('API auth exchange failed:', e)
        }
      }

      const response = await fetch('http://localhost:8000/api/translate/voice', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setTranscribedText(data.transcribed_text)
        setTranslatedText(data.translated_text)
        setRomanizedText(data.romanized_text || '')
      } else {
        throw new Error('Translation failed')
      }
    } catch (error) {
      console.error('Translation error:', error)
      setTranscribedText('Transcription failed. Please try again.')
      setTranslatedText('Translation failed. Please try again.')
      setRomanizedText('')
    } finally {
      setIsProcessing(false)
    }
  }

  const clearRecording = () => {
    setAudioBlob(null)
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setTranscribedText('')
    setTranslatedText('')
    setRomanizedText('')
    setRecordingTime(0)
  }

  const playRecording = () => {
    if (uploadedFile) {
      const audio = new Audio(URL.createObjectURL(uploadedFile))
      audio.play()
    } else if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob))
      audio.play()
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-b-4 border-purple-400 mx-auto mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl">🎤</span>
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
                <span className="text-5xl">🎤</span>
                <span>Voice Translation</span>
              </h1>
              <p className="text-white/80 mt-2 text-lg">Speak naturally and translate your voice instantly</p>
            </div>
          </div>
        </div>

        {/* Translation Interface */}
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
              
              {/* Arrow Icon */}
              <div className="mt-10 p-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 rounded-2xl text-white shadow-2xl">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              
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

          {/* Recording Interface */}
          <div className="card p-12 mb-10 shadow-2xl hover:shadow-blue-500/25 transition-all duration-500">
            {/* Mode Toggle */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex rounded-2xl bg-white/10 backdrop-blur-xl p-1.5 border border-white/20">
                <button
                  onClick={() => {
                    setInputMode('record')
                    clearRecording()
                  }}
                  className={`px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-300 ${
                    inputMode === 'record'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  🎙️ Record Audio
                </button>
                <button
                  onClick={() => {
                    setInputMode('upload')
                    clearRecording()
                  }}
                  className={`px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-300 ${
                    inputMode === 'upload'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  📁 Upload Audio
                </button>
              </div>
            </div>

            {/* Recording Mode */}
            {inputMode === 'record' && (
              <div className="text-center">
                <div className="mb-8">
                  <div className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center text-6xl transition-all duration-300 shadow-2xl ${
                    isRecording 
                      ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white animate-pulse scale-110' 
                      : 'bg-gradient-to-br from-white/20 to-white/10 text-white border-2 border-white/30 hover:scale-105'
                  }`}>
                    🎤
                  </div>
                </div>
                
                {isRecording && (
                  <div className="mb-6">
                    <p className="text-2xl font-bold text-white drop-shadow-lg animate-pulse">
                      Recording: {formatTime(recordingTime)}
                    </p>
                  </div>
                )}
                
                <div className="flex justify-center space-x-4 mb-6">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="px-10 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl hover:from-violet-700 hover:to-purple-700 transition-all duration-300 shadow-2xl hover:shadow-purple-500/50 font-semibold text-lg"
                    >
                      🎙️ Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-10 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-2xl hover:from-red-700 hover:to-rose-700 transition-all duration-300 shadow-2xl hover:shadow-red-500/50 font-semibold text-lg animate-pulse"
                    >
                      ⏹️ Stop Recording
                    </button>
                  )}
                  
                  {audioBlob && !isRecording && (
                    <>
                      <button
                        onClick={playRecording}
                        className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-2xl hover:shadow-green-500/50 font-semibold text-lg"
                      >
                        ▶️ Play
                      </button>
                      <button
                        onClick={clearRecording}
                        className="px-8 py-4 bg-white/15 backdrop-blur-xl text-white rounded-2xl hover:bg-white/25 transition-all duration-300 shadow-xl font-semibold text-lg border border-white/20"
                      >
                        🗑️ Clear
                      </button>
                    </>
                  )}
                </div>
                
                {audioBlob && !isRecording && (
                  <button
                    onClick={handleTranslate}
                    disabled={isProcessing}
                    className="px-12 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-2xl hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl hover:shadow-blue-500/50 font-semibold text-lg"
                  >
                    {isProcessing ? (
                      <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        <span>Processing Magic...</span>
                      </div>
                    ) : (
                      '✨ Translate Audio'
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Upload Mode */}
            {inputMode === 'upload' && (
              <div className="text-center">
                <div className="mb-8">
                  <div className="w-40 h-40 mx-auto rounded-full flex items-center justify-center text-6xl bg-gradient-to-br from-white/20 to-white/10 text-white border-2 border-white/30 hover:scale-105 transition-all duration-300 shadow-2xl">
                    📁
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="audio-upload"
                />

                {!uploadedFile ? (
                  <label
                    htmlFor="audio-upload"
                    className="inline-block px-10 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl hover:from-violet-700 hover:to-purple-700 transition-all duration-300 shadow-2xl hover:shadow-purple-500/50 font-semibold text-lg cursor-pointer"
                  >
                    📤 Choose Audio File
                  </label>
                ) : (
                  <div className="space-y-6">
                    <div className="inline-flex items-center space-x-4 px-6 py-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
                      <span className="text-2xl">🎵</span>
                      <span className="text-white font-semibold text-lg">{uploadedFile.name}</span>
                      <span className="text-white/60 text-sm">({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>

                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={playRecording}
                        className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-2xl hover:shadow-green-500/50 font-semibold text-lg"
                      >
                        ▶️ Play
                      </button>
                      <button
                        onClick={clearUploadedFile}
                        className="px-8 py-4 bg-white/15 backdrop-blur-xl text-white rounded-2xl hover:bg-white/25 transition-all duration-300 shadow-xl font-semibold text-lg border border-white/20"
                      >
                        🗑️ Remove
                      </button>
                      <label
                        htmlFor="audio-upload"
                        className="px-8 py-4 bg-white/15 backdrop-blur-xl text-white rounded-2xl hover:bg-white/25 transition-all duration-300 shadow-xl font-semibold text-lg border border-white/20 cursor-pointer"
                      >
                        🔄 Change File
                      </label>
                    </div>

                    <button
                      onClick={handleTranslate}
                      disabled={isProcessing}
                      className="px-12 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-2xl hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl hover:shadow-blue-500/50 font-semibold text-lg"
                    >
                      {isProcessing ? (
                        <div className="flex items-center space-x-3">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                          <span>Processing Magic...</span>
                        </div>
                      ) : (
                        '✨ Translate Audio'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results */}
          {(transcribedText || translatedText) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Transcription */}
              <div className="group card shadow-2xl hover:shadow-blue-500/25 transition-all duration-500 overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-white/20 bg-gradient-to-r from-white/10 to-transparent">
                  <div className="flex items-center space-x-4">
                    <span className="text-4xl drop-shadow-lg">{getLanguageByCode(sourceLang).flag}</span>
                    <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                      {getLanguageByCode(sourceLang).name}
                    </h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="w-full min-h-48 max-h-64 overflow-y-auto">
                    {transcribedText ? (
                      <p className="text-white text-xl leading-relaxed whitespace-pre-wrap break-words w-full font-medium">
                        {transcribedText}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-48 text-white/70">
                        <div className="text-6xl mb-4 opacity-50">🎙️</div>
                        <p className="text-center text-lg font-semibold">Transcription will appear here!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Translation */}
              <div className="group card shadow-2xl hover:shadow-blue-500/25 transition-all duration-500 overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-white/20 bg-gradient-to-r from-white/10 to-transparent">
                  <div className="flex items-center space-x-4">
                    <span className="text-4xl drop-shadow-lg">{getLanguageByCode(targetLang).flag}</span>
                    <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                      {getLanguageByCode(targetLang).name}
                    </h3>
                  </div>
                  {translatedText && (
                    <button
                      onClick={() => navigator.clipboard.writeText(translatedText)}
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
                  <div className="w-full min-h-48 max-h-64 overflow-y-auto">
                    {translatedText ? (
                      <div className="space-y-4">
                        <p className="text-white text-xl leading-relaxed whitespace-pre-wrap break-words w-full font-medium">
                          {translatedText}
                        </p>
                        {romanizedText && (
                          <div className="pt-4 border-t border-white/20">
                            <p className="text-purple-200 text-lg italic leading-relaxed whitespace-pre-wrap break-words w-full">
                              {romanizedText}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-48 text-white/70">
                        <div className="text-6xl mb-4 opacity-50">🌟</div>
                        <p className="text-center text-lg font-semibold">Translation will appear here!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VoiceTranslation
