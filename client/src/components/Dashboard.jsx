import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'

function Dashboard() {
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [serverStatus, setServerStatus] = useState('Checking...')
  const [serverInfo, setServerInfo] = useState(null)
  
  const { user, userProfile, signOut, apiToken } = useAuth()

  // Check server status on component mount
  useEffect(() => {
    checkServerStatus()
    getServerInfo()
  }, [])

  const checkServerStatus = async () => {
    try {
      const result = await axios.get('http://localhost:8000/api/health')
      setServerStatus('Connected')
    } catch (error) {
      setServerStatus('Disconnected')
    }
  }

  const getServerInfo = async () => {
    try {
      const result = await axios.get('http://localhost:8000/api/info')
      setServerInfo(result.data)
    } catch (error) {
      console.log('Could not fetch server info')
    }
  }

  const sendMessage = async () => {
    if (!message.trim()) return
    
    setLoading(true)
    try {
      const result = await axios.post('http://localhost:8000/api/echo', {
        message: message
      }, {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      })
      setResponse(result.data.echo)
    } catch (error) {
      setResponse('Error: Could not connect to FastAPI server')
    }
    setLoading(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                🚀 EchoPath
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
                React + Vite Frontend with FastAPI Backend
              </p>
              <div className="flex items-center justify-center space-x-4">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  serverStatus === 'Connected' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : serverStatus === 'Disconnected'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    serverStatus === 'Connected' ? 'bg-green-500' : 
                    serverStatus === 'Disconnected' ? 'bg-red-500' : 'bg-yellow-500'
                  }`}></div>
                  Server: {serverStatus}
                </div>
                {serverInfo && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {serverInfo.server} v{serverInfo.version}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-300">Welcome back,</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {user?.displayName || userProfile?.displayName || user?.email || 'User'}
                </p>
                {userProfile?.authProvider && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    via {userProfile.authProvider}
                  </p>
                )}
              </div>
              {user?.photoURL && (
                <img 
                  src={user.photoURL} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full border-2 border-gray-300"
                />
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Echo Message
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Send a message to the FastAPI server and see the response
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter a message to echo..."
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
              />
              <button 
                onClick={sendMessage}
                disabled={loading || !message.trim()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
              >
                {loading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </div>
                ) : 'Send'}
              </button>
            </div>
            
            {response && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border-l-4 border-blue-500">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Server Response:
                </h3>
                <p className="text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-800 p-3 rounded border">
                  {response}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
