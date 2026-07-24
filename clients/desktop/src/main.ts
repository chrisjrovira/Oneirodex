import { mountApp } from './app.js'

const root = document.querySelector<HTMLElement>('#app')
if (!root) {
  throw new Error('#app root element not found')
}

void mountApp(root)
