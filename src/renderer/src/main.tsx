import './assets/main.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Debugger błędów dla białego ekranu
window.onerror = function (msg, url, lineNo, _columnNo, error) {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `
      <div style="padding: 40px; color: #ff4444; background: #111; height: 100vh; font-family: monospace;">
        <h1 style="color: #fff">Błąd krytyczny aplikacji:</h1>
        <p style="font-size: 18px">${msg}</p>
        <pre style="background: #222; padding: 20px; border-radius: 8px; color: #aaa; overflow: auto;">
${error?.stack || 'Brak stosu błędów.'}
        </pre>
        <p style="color: #666">Plik: ${url} (linia ${lineNo})</p>
        <button onclick="location.reload()" style="padding: 10px 20px; background: #444; color: #fff; border: none; cursor: pointer;">Odśwież aplikację</button>
      </div>
    `
  }
  return false
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
