import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './auth/AuthContext.tsx'
import { I18nProvider } from './i18n/I18nContext.tsx'
import { ThemeProvider } from './theme/ThemeContext.tsx'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
