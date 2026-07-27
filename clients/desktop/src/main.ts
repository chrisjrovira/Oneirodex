const mode = String(import.meta.env.VITE_CLIENT_MODE || 'full').toLowerCase()
const root = document.querySelector<HTMLElement>('#app')
if (!root) {
  throw new Error('#app root element not found')
}

void (async () => {
  if (mode === 'thin') {
    const { mountThinApp } = await import('./thin-app.js')
    document.title = 'GameTheca Thin'
    await mountThinApp(root)
    return
  }
  const { mountApp } = await import('./app.js')
  await mountApp(root)
})()
