// Service worker do PWA. Estratégia dev-safe: não intercepta HMR/módulos do
// Vite nem rotas de API com dados sensíveis. Em produção dá suporte offline.
const CACHE = 'unifi-pwa-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function isStaticAsset(pathname) {
  return /\.(?:css|js|mjs|woff2?|ttf|png|jpe?g|gif|svg|ico|webp)$/.test(pathname)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Dev: deixa passar HMR e módulos do Vite sem interceptar.
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return
  }

  // Branding público pode ser cacheado; demais rotas de API, nunca.
  const isBranding =
    url.pathname.startsWith('/api/settings/manifest') ||
    url.pathname.startsWith('/api/settings/app-icon')
  if (url.pathname.startsWith('/api/') && !isBranding) return

  // Navegação: rede primeiro, caindo para o shell em cache quando offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/').then((r) => r || caches.match(req)))
    )
    return
  }

  // Branding e assets estáticos: stale-while-revalidate.
  if (isBranding || url.pathname.startsWith('/assets/') || isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          })
          .catch(() => cached)
        return cached || network
      })
    )
  }
})
