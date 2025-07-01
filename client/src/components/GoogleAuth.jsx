import { useState, useEffect } from 'react'
import axios from 'axios'

const GOOGLE_CLIENT_ID = "33161138139-png537jihd6ij83qqg2ddjv92qg9gekm.apps.googleusercontent.com"

export const GoogleAuthButton = ({ onSuccess, onError, text = "Continue with Google" }) => {
  const [loading, setLoading] = useState(false)
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false)
  const [debugInfo, setDebugInfo] = useState('Initializing...')

  useEffect(() => {
    const initGoogleIdentity = () => {
      console.log('Initializing Google Identity Services...')
      setDebugInfo('Initializing Google Identity...')
      
      if (!window.google) {
        console.log('Google Identity Services not loaded')
        setDebugInfo('Google Identity Services not loaded')
        return
      }

      try {
        console.log('Google Identity Services found, initializing...')
        setDebugInfo('Configuring Google Identity...')
        
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        
        console.log('Google Identity Services initialized successfully')
        setDebugInfo('Ready!')
        setIsGoogleLoaded(true)
        
      } catch (error) {
        console.error('Google Identity initialization error:', error)
        setDebugInfo(`Error: ${error.message}`)
      }
    }

    // Wait for Google Identity Services to load
    let checkCount = 0
    const checkGoogleIdentity = () => {
      checkCount++
      console.log(`Checking for Google Identity Services... (${checkCount})`)
      setDebugInfo(`Checking Google Identity... (${checkCount})`)
      
      if (window.google && window.google.accounts) {
        console.log('Google Identity Services is ready!')
        initGoogleIdentity()
      } else if (checkCount < 50) { // 5 seconds max
        setTimeout(checkGoogleIdentity, 100)
      } else {
        console.error('Google Identity Services failed to load after 5 seconds')
        setDebugInfo('Google Identity Services failed to load')
      }
    }
    
    checkGoogleIdentity()
  }, [])

  const handleCredentialResponse = async (response) => {
    console.log('Received credential response:', response)
    setLoading(true)
    
    try {
      // The response.credential contains the JWT ID token
      const result = await axios.post('http://localhost:8000/api/auth/google', {
        access_token: response.credential
      })

      // Decode the JWT to get user info (for display purposes)
      const tokenPayload = JSON.parse(atob(response.credential.split('.')[1]))
      
      // Store token and user info
      localStorage.setItem('token', result.data.access_token)
      localStorage.setItem('user', JSON.stringify({
        email: tokenPayload.email,
        fullName: tokenPayload.name,
        picture: tokenPayload.picture,
        token_type: result.data.token_type
      }))

      onSuccess({
        email: tokenPayload.email,
        fullName: tokenPayload.name,
        picture: tokenPayload.picture,
        token: result.data.access_token
      })

    } catch (error) {
      console.error('Google auth backend error:', error)
      if (error.response?.data?.detail) {
        onError(error.response.data.detail)
      } else {
        onError('Google authentication failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    if (!isGoogleLoaded) {
      onError('Google authentication is not ready yet. Please wait.')
      return
    }

    try {
      console.log('Triggering Google sign-in prompt...')
      setLoading(true)
      
      // Use the One Tap or popup method
      window.google.accounts.id.prompt((notification) => {
        console.log('Prompt notification:', notification)
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to popup if One Tap doesn't work
          console.log('One Tap not available, falling back to popup...')
          
          // Create a temporary callback for popup
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
          })
          
          // Render the sign-in button temporarily and click it
          const tempDiv = document.createElement('div')
          document.body.appendChild(tempDiv)
          
          window.google.accounts.id.renderButton(tempDiv, {
            theme: 'outline',
            size: 'large',
          })
          
          // Auto-click the button
          setTimeout(() => {
            const button = tempDiv.querySelector('div[role="button"]')
            if (button) {
              button.click()
            }
            document.body.removeChild(tempDiv)
          }, 100)
        }
        setLoading(false)
      })
      
    } catch (error) {
      console.error('Google sign-in error:', error)
      onError('Failed to start Google sign-in. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleGoogleAuth}
        disabled={loading || !isGoogleLoaded}
        className="w-auto mx-auto flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      >
        {loading ? (
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Authenticating...
          </div>
        ) : !isGoogleLoaded ? (
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {debugInfo}
          </div>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {text}
          </>
        )}
      </button>
      <div className="text-xs text-gray-500 text-center">
        Debug: {debugInfo}
      </div>
    </div>
  )
}

export default GoogleAuthButton
