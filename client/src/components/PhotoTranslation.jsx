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
  const [targetLang, setTargetLang] = useState('es')
  const [isProcessing, setIsProcessing] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)
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
      formData.append('source_lang', sourceLang)
      formData.append('target_lang', targetLang)

      // Replace this with your actual photo translation API call
      const response = await fetch('http://localhost:8000/translate/photo', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setExtractedText(data.extracted_text)
        setTranslatedText(data.translated_text)
      } else {
        throw new Error('Translation failed')
      }
    } catch (error) {
      console.error('Translation error:', error)
      setExtractedText('Text extraction failed. Please try again.')
      setTranslatedText('Translation failed. Please try again.')
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
            <h1 className="text-3xl font-bold text-gray-900">📷 Photo Translation</h1>
          </div>
        </div>

        {/* Translation Interface */}
        <div className="max-w-6xl mx-auto">
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

          {/* Image Upload/Capture Interface */}
          <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
            {!imagePreview ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-300 hover:border-purple-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="text-6xl mb-4">📷</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Upload or Capture Image
                </h3>
                <p className="text-gray-600 mb-6">
                  Drag and drop an image here, or click to select a file
                </p>
                
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Choose File
                  </button>
                  <button
                    onClick={takePhoto}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Take Photo
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
                <div className="mb-4">
                  <img
                    src={imagePreview}
                    alt="Selected"
                    className="max-w-full max-h-96 mx-auto rounded-lg shadow-lg"
                  />
                </div>
                
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={clearImage}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Clear Image
                  </button>
                  <button
                    onClick={handleTranslate}
                    disabled={isProcessing}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? 'Processing...' : 'Extract & Translate'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          {(extractedText || translatedText) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Extracted Text */}
              <div className="bg-white rounded-lg shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Extracted Text</h3>
                <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 min-h-32 max-h-64 overflow-y-auto">
                  {extractedText ? (
                    <p className="text-gray-800 whitespace-pre-wrap">{extractedText}</p>
                  ) : (
                    <p className="text-gray-500 italic">Extracted text will appear here...</p>
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
                <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 min-h-32 max-h-64 overflow-y-auto">
                  {translatedText ? (
                    <p className="text-gray-800 whitespace-pre-wrap">{translatedText}</p>
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

export default PhotoTranslation
