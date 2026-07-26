import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './styles.css'

const root = document.getElementById('admin-app-root')
if (root) {
  createRoot(root).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}
