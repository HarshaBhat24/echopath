import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'

function VoiceTranslation() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [transcribedText, setTranscribedText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('hi')
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const intervalRef = useRef(null)
  const navigate = useNavigate()

  const languages = [
    { code: 'auto', name: 'Auto Detect' },
    { code: 'en', name: 'English' },
    { code: 'ka', name: 'Kannada' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'ma', name: 'Malayalam' },
    { code: 'be', name: 'Bengali' },
    { code: 'hi', name: 'Hindi' }
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

  const handleTranslate = async () => {
    if (!audioBlob) return

    setIsProcessing(true)
    try {
      // Get auth token for API call
      let token = localStorage.getItem('api_token')
      if (!token && auth?.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken()
          const authResponse = await fetch('http://localhost:8000/api/auth/firebase', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              firebase_token: idToken
            })
          })
          if (authResponse.ok) {
            const authData = await authResponse.json()
            token = authData.access_token
            if (token) {
              localStorage.setItem('api_token', token)
            }
          }
        } catch (e) {
          console.error('API auth exchange failed:', e)
        }
      }

      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')
      formData.append('source_lang', sourceLang)
      formData.append('target_lang', targetLang)

      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Call the correct API endpoint with authentication
      const response = await fetch('http://localhost:8000/api/translate/voice', {
        method: 'POST',
        headers: headers,
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setTranscribedText(data.transcribed_text)
        setTranslatedText(data.translated_text)
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.detail || `Translation failed (${response.status})`
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Translation error:', error)
      const errorMessage = error.message || 'Translation failed. Please try again.'
      setTranscribedText('Transcription failed. Please try again.')
      setTranslatedText(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const clearRecording = () => {
    setAudioBlob(null)
    setTranscribedText('')
    setTranslatedText('')
    setRecordingTime(0)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const playRecording = () => {
    if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob))
      audio.play()
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
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="mr-4 p-2 rounded-lg bg-white shadow-md hover:shadow-lg transition-shadow"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900">🎤 Voice Translation</h1>
          </div>
        </div>

        {/* Translation Interface */}
        <div className="max-w-4xl mx-auto">
          {/* Language Selection */}
          <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
            <div className="flex items-center justify-center space-x-8">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-2">From</label>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-2">To</label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {languages.filter(lang => lang.code !== 'auto').map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Recording Interface */}
          <div className="bg-white rounded-lg shadow-xl p-8 mb-6">
            <div className="text-center">
              <div className="mb-6">
                <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center text-4xl transition-all duration-300 ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                }`}>
                  🎤
                </div>
              </div>
              
              {isRecording && (
                <div className="mb-4">
                  <p className="text-lg font-semibold text-red-600">
                    Recording: {formatTime(recordingTime)}
                  </p>
                </div>
              )}
              
              <div className="flex justify-center space-x-4">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Stop Recording
                  </button>
                )}
                
                {audioBlob && !isRecording && (
                  <>
                    <button
                      onClick={playRecording}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Play Recording
                    </button>
                    <button
                      onClick={clearRecording}
                      className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
              
              {audioBlob && !isRecording && (
                <button
                  onClick={handleTranslate}
                  disabled={isProcessing}
                  className="mt-4 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Processing...' : 'Translate Audio'}
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          {(transcribedText || translatedText) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Transcription */}
              <div className="bg-white rounded-lg shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Transcription</h3>
                <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 min-h-32">
                  {transcribedText ? (
                    <p className="text-gray-800">{transcribedText}</p>
                  ) : (
                    <p className="text-gray-500 italic">Transcription will appear here...</p>
                  )}
                </div>
              </div>

              {/* Translation */}
              <div className="bg-white rounded-lg shadow-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Translation</h3>
                  {translatedText && (
                    <button
                      onClick={() => navigator.clipboard.writeText(translatedText)}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      Copy
                    </button>
                  )}
                </div>
                <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 min-h-32">
                  {translatedText ? (
                    <p className="text-gray-800">{translatedText}</p>
                  ) : (
                    <p className="text-gray-500 italic">Translation will appear here...</p>
                  )}
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
