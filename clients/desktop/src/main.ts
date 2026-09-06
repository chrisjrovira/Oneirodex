const root = document.querySelector<HTMLElement>('#app')
if (!root) {
  throw new Error('#app root element not found')
}

void (async () => {
  // Compared against the literal so Vite's define substitution constant-folds
  // the branch away. The old form wrapped it in `String(...).toLowerCase()`,
  // which Rollup cannot fold — so the thin bundle still emitted (and shipped)
  // the full companion's app chunk, install pipeline and all. Capabilities were
  // always the real enforcement, but shipping the code contradicts the claim
  // that thin has no install pipeline.
  if (import.meta.env.VITE_CLIENT_MODE === 'thin') {
    const { mountThinApp } = await import('./thin-app.js')
    document.title = 'Oneirodex Thin'
    await mountThinApp(root)
    return
  }
  const { mountApp } = await import('./app.js')
  await mountApp(root)
})()
