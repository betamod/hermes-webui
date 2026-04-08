// Minimal test to check if React renders at all
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ padding: '2rem', color: 'white' }}>
      <h1>Hermes Test</h1>
      <p>If you see this, React is working.</p>
    </div>
  </StrictMode>,
)
