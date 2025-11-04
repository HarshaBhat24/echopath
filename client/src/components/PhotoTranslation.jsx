import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'

function PhotoTranslation() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [extractedText, setExtractedText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('en')
  const [isProcessing, setIsProcessing] = useState(false)
  const [dragActive, setDragActive] = useState(false)
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

  // Map UI language codes to Tesseract language codes
  const mapToTesseractLang = (code) => {
    const mapping = {
      'auto': 'hin+kan+tam+tel+eng', // Try multiple Indian languages for auto-detect
      'en': 'eng',
      'ka': 'kan',
      'ta': 'tam',
      'te': 'tel',
      'ma': 'mal',
      'be': 'ben',
      'hi': 'hin'
    }
    return mapping[code] || 'eng'
  }

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

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target.result)
      }
      reader.readAsDataURL(file)
      setExtractedText('')
      setTranslatedText('')
    } else {
      alert('Please select a valid image file.')
    }
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleTranslate = async () => {
    if (!selectedImage) return

    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('image', selectedImage)
      formData.append('lang', mapToTesseractLang(sourceLang))
      
      // Always send source (auto-detect) and target language for translation
      formData.append('source_lang', sourceLang)
      formData.append('target_lang', targetLang)
      formData.append('transliterate', 'true')

      // Call the OCR extraction endpoint (no auth required)
      const response = await fetch('http://localhost:8000/api/ocr/extract', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        
        // Show extracted text (native script only)
        setExtractedText(data.extracted_text)
        
        // Show translated text with optional transliteration
        if (data.translated_text) {
          if (data.transliterated_text) {
            // Show translated text + transliterated version
            setTranslatedText(
              `${data.translated_text}\n\nRomanized:\n${data.transliterated_text}`
            )
          } else {
            // Just translated text
            setTranslatedText(data.translated_text)
          }
        } else {
          setTranslatedText('Translation not available.')
        }
      } else {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Text extraction failed')
      }
    } catch (error) {
      console.error('Text extraction error:', error)
      setExtractedText(`Error: ${error.message}`)
      setTranslatedText('')
    } finally {
      setIsProcessing(false)
    }
  }

  const clearImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    setExtractedText('')
    setTranslatedText('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const takePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      
      // Create a video element to capture from camera
      const video = document.createElement('video')
      video.srcObject = stream
      video.play()
      
      video.onloadedmetadata = () => {
        // Create canvas to capture the frame
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        
        // Draw the video frame to canvas
        ctx.drawImage(video, 0, 0)
        
        // Convert to blob and use as selected image
        canvas.toBlob((blob) => {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' })
          handleFileSelect(file)
          
          // Stop the camera stream
          stream.getTracks().forEach(track => track.stop())
        }, 'image/jpeg', 0.9)
      }
    } catch (error) {
      console.error('Camera access error:', error)
      alert('Please allow camera access to take a photo.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-b-4 border-purple-400 mx-auto mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl">📷</span>
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

      <div className="relative z-10 container mx-auto px-6 py-8 min-h-screen">
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
                <span className="text-5xl">📷</span>
                <span>Photo Translation</span>
              </h1>
              <p className="text-white/80 mt-2 text-lg">Extract and translate text from images instantly</p>
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

          {/* Image Upload/Capture Interface */}
          <div className="card p-8 mb-10 shadow-2xl hover:shadow-blue-500/25 transition-all duration-500">
            {!imagePreview ? (
              <div
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                  dragActive 
                    ? 'border-purple-400 bg-white/20' 
                    : 'border-white/30 hover:border-purple-400/50 hover:bg-white/10'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="text-8xl mb-6 opacity-70">📷</div>
                <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-lg">
                  Upload or Capture Image
                </h3>
                <p className="text-white/70 mb-8 text-lg">
                  Drag and drop an image here, or click to select a file
                </p>
                
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-10 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl hover:from-violet-700 hover:to-purple-700 transition-all duration-300 shadow-2xl hover:shadow-purple-500/50 font-semibold text-lg"
                  >
                    📁 Choose File
                  </button>
                  <button
                    onClick={takePhoto}
                    className="px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-2xl hover:shadow-green-500/50 font-semibold text-lg"
                  >
                    📸 Take Photo
                  </button>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="text-center">
                <div className="mb-6">
                  <img
                    src={imagePreview}
                    alt="Selected"
                    className="max-w-full max-h-96 mx-auto rounded-2xl shadow-2xl border-2 border-white/20"
                  />
                </div>
                
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={clearImage}
                    className="px-8 py-4 bg-white/15 backdrop-blur-xl text-white rounded-2xl hover:bg-white/25 transition-all duration-300 shadow-xl font-semibold text-lg border border-white/20"
                  >
                    🗑️ Clear Image
                  </button>
                  <button
                    onClick={handleTranslate}
                    disabled={isProcessing}
                    className="px-10 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-2xl hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl hover:shadow-blue-500/50 font-semibold text-lg"
                  >
                    {isProcessing ? (
                      <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        <span>Processing Magic...</span>
                      </div>
                    ) : (
                      '✨ Extract & Translate'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          {(extractedText || translatedText) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Extracted Text */}
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
                    {extractedText ? (
                      <p className="text-white text-xl leading-relaxed whitespace-pre-wrap break-words w-full font-medium">
                        {extractedText}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-48 text-white/70">
                        <div className="text-6xl mb-4 opacity-50">📄</div>
                        <p className="text-center text-lg font-semibold">Extracted text will appear here!</p>
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
                      <p className="text-white text-xl leading-relaxed whitespace-pre-wrap break-words w-full font-medium">
                        {translatedText}
                      </p>
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

export default PhotoTranslation
