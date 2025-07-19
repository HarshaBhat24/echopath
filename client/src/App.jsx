import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import SimpleLogin from './components/SimpleLogin'
import SimpleSignup from './components/SimpleSignup'
import SimpleDashboard from './components/SimpleDashboard'
import TextTranslation from './components/TextTranslation'
import VoiceTranslation from './components/VoiceTranslation'
import PhotoTranslation from './components/PhotoTranslation'

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/login" element={<SimpleLogin />} />
          <Route path="/signup" element={<SimpleSignup />} />
          <Route path="/dashboard" element={<SimpleDashboard />} />
          <Route path="/text-translation" element={<TextTranslation />} />
          <Route path="/voice-translation" element={<VoiceTranslation />} />
          <Route path="/photo-translation" element={<PhotoTranslation />} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
