// Gerência de Enfermagem — service worker
// A fonte de verdade da versao e version.json. Este valor so nomeia o cache;
// mantenha-o igual ao de version.json por clareza, mas quem dispara o aviso de
// atualizacao no app e sempre o version.json.
const APP_VERSION = '2026.09.14-3';
const CACHE = 'ge-' + APP_VERSION;

// Caminhos relativos ao escopo do SW — funcionam em qualquer subpasta.
const ASSETS = ['./', './index.html', './manifest.json', './canon.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll é atômico: um 404 derruba o install inteiro.
    // Individual + allSettled deixa o SW instalar mesmo se um asset faltar.
    await Promise.allSettled(ASSETS.map(u => c.add(new Request(u, { cache: 'reload' }))));
    // NÃO chamamos skipWaiting aqui: o app pergunta ao usuário antes de trocar.
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// O app manda esta mensagem quando o usuário aceita atualizar.
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
  if (e.data && e.data.type === 'GET_VERSION') {
    e.source && e.source.postMessage({ type: 'VERSION', version: APP_VERSION });
  }
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = req.url;

  if (!url.startsWith('http://') && !url.startsWith('https://')) return;
  if (req.method !== 'GET') return;

  // A página de reset nunca pode ser servida do cache.
  if (new URL(url).pathname.endsWith('/reset.html')) return;

  // Supabase sempre na rede.
  if (url.includes('supabase.co')) return;

  const isNavigation =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    new URL(url).pathname.endsWith('/index.html');

  // O app inteiro vive no index.html: network-first, cache só como fallback offline.
  if (isNavigation) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', clone)).catch(() => {});
        }
        return res;
      } catch (err) {
        const cached = await caches.match('./index.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  // Demais assets (CDNs, ícones): cache-first com atualização em segundo plano.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res && res.ok) {
      const clone = res.clone();
      caches.open(CACHE).then(c => { try { c.put(req, clone); } catch (err) {} });
    }
    return res;
  })());
});
