const cacheName = 'sereness-shell-v04'
const scope = new URL(self.registration.scope)
self.addEventListener('install', event => event.waitUntil((async () => {
  const shell = await fetch(scope, { cache: 'reload' })
  if (!shell.ok) throw new Error('Unable to cache the web app')
  const html = await shell.clone().text()
  const assets = [...html.matchAll(/["'](\.\/assets\/[^"']+)["']/g)].map(match => match[1])
  const urls = ['./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest', ...assets].map(path => new URL(path, scope))
  const cache = await caches.open(cacheName)
  await cache.addAll([...new Set(urls.map(url => url.href))])
  await cache.put(scope, shell)
})()))
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('sereness-shell-') && key !== cacheName).map(key => caches.delete(key)))),
))
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return
  event.respondWith(fetch(event.request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(cacheName)
      await cache.put(event.request,response.clone())
    }
    return response
  }).catch(async () => {
    const cached = await caches.match(event.request)
    if (cached) return cached
    if (event.request.mode === 'navigate') return (await caches.match(new URL('./',scope))) ?? Response.error()
    return Response.error()
  }))
})
