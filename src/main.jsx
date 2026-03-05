import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AccentProvider } from './context/AccentContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AccentProvider>
      <App />
    </AccentProvider>
  </StrictMode>,
)
