export function registerPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  if (!window.isSecureContext) return

  const register = () => {
    navigator.serviceWorker
      .register(new URL('sw.js', document.baseURI), { scope: './' })
      .catch(() => {})
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

export function setupInstallPrompt() {
  const button = document.getElementById('installBtn')
  if (!button) return

  let deferredPrompt = null

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event
    button.hidden = false
  })

  button.addEventListener('click', async () => {
    if (!deferredPrompt) return
    const prompt = deferredPrompt
    deferredPrompt = null
    button.hidden = true
    prompt.prompt()
    try {
      const choice = await prompt.userChoice
      if (choice.outcome === 'accepted') {
        window.dispatchEvent(new CustomEvent('marcenaria:installed'))
      }
    } catch {
      // The browser can reject a prompt that is no longer available.
    }
  })

  window.addEventListener('appinstalled', () => {
    button.hidden = true
    window.dispatchEvent(new CustomEvent('marcenaria:installed'))
  })
}
