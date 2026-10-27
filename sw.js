/* Cache only this application's own resources. Ready markers are written last. */
const PREFIX = 'python-classroom-';
const BASE = self.registration.scope;
const MANIFEST_URL = new URL('offline-manifest.json', BASE).href;
const READY_URL = new URL('__offline_ready__', BASE).href;
let preparing = null;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

async function digest(buffer) {
  const value = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(value), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function validResponse(response, file) {
  if (!response || !response.ok) return false;
  const data = await response.clone().arrayBuffer();
  return data.byteLength === file.size && await digest(data) === file.sha256;
}

async function readyCaches() {
  const names = (await caches.keys()).filter((name) => name.startsWith(PREFIX)).reverse();
  const result = [];
  for (const name of names) {
    const cache = await caches.open(name);
    const marker = await cache.match(READY_URL);
    if (marker?.ok) {
      try { result.push({ name, cache, metadata: await marker.json() }); } catch { /* incomplete marker */ }
    }
  }
  return result;
}

async function verifyCache(candidate) {
  if (!candidate.metadata?.files?.length) return false;
  for (const file of candidate.metadata.files) {
    const response = await candidate.cache.match(new URL(file.url, BASE).href);
    if (!await validResponse(response, file)) return false;
  }
  return true;
}

async function latestValidCache() {
  for (const candidate of await readyCaches()) {
    if (await verifyCache(candidate)) return candidate;
  }
  return null;
}

async function fetchManifest() {
  const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('无法下载离线资源清单，请联网后重试。');
  const manifest = await response.json();
  if (!manifest.version || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('离线资源清单无效。');
  for (const file of manifest.files) {
    const url = new URL(file.url, BASE);
    if (url.origin !== self.location.origin || !url.href.startsWith(BASE) || !Number.isSafeInteger(file.size) || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error('离线资源清单包含无效文件。');
    }
  }
  return manifest;
}

async function prepare(report) {
  let manifest;
  try {
    manifest = await fetchManifest();
  } catch (error) {
    const existing = await latestValidCache();
    if (existing) return { ...existing.metadata, fromCache: true };
    throw error;
  }
  const cache = await caches.open(`${PREFIX}${manifest.version}`);
  let completed = 0;
  report({ type: 'progress', completed, total: manifest.files.length, message: '正在准备离线资源…' });
  for (const file of manifest.files) {
    const url = new URL(file.url, BASE).href;
    const existing = await cache.match(url);
    if (!await validResponse(existing, file)) {
      const response = await fetch(url, { cache: 'no-store' });
      if (!await validResponse(response, file)) throw new Error(`资源下载或校验失败：${file.url}`);
      await cache.put(url, response);
    }
    completed += 1;
    report({ type: 'progress', completed, total: manifest.files.length, message: '正在准备离线资源…' });
  }
  await cache.put(MANIFEST_URL, new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }));
  // Until this final write succeeds, fetch handlers ignore the staging cache.
  await cache.put(READY_URL, new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }));
  return manifest;
}

self.addEventListener('message', (event) => {
  const port = event.ports?.[0];
  if (!port) return;
  const report = (message) => port.postMessage(message);
  event.waitUntil((async () => {
    try {
      if (event.data?.type === 'prepare') {
        // Concurrent tabs share one resource download. Each receives a final result.
        if (!preparing) preparing = prepare(report).finally(() => { preparing = null; });
        const manifest = await preparing;
        report({ type: 'ready', completed: manifest.files.length, total: manifest.files.length, version: manifest.version });
      } else if (event.data?.type === 'check') {
        const candidate = await latestValidCache();
        if (!candidate) throw new Error('离线资源不完整，请联网准备后再使用。');
        report({ type: 'ready', completed: candidate.metadata.files.length, total: candidate.metadata.files.length, version: candidate.metadata.version });
      } else {
        throw new Error('不支持的离线操作。');
      }
    } catch (error) {
      const quota = error.name === 'QuotaExceededError' || /quota|storage.*full/i.test(error.message || '');
      report({ type: 'error', message: quota ? '浏览器存储空间不足，尚未完成离线准备。请释放空间后重试。' : (error.message || '离线准备失败，请联网后重试。') });
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE) || event.request.method !== 'GET') return;
  if (url.href === MANIFEST_URL) return; // prepare/check manage this separately.
  event.respondWith((async () => {
    const candidates = await readyCaches();
    for (const { cache, metadata } of candidates) {
      const key = event.request.mode === 'navigate' ? new URL('index.html', BASE).href : event.request;
      const resourceURL = typeof key === 'string' ? key : key.url;
      // Static manifest files are content-verified and do not vary by visitor.
      // Module/CSS requests carry Origin, while prefetch requests may not; a
      // host's Vary: Origin must not make those prepared resources miss offline.
      if (!metadata.files?.some((file) => new URL(file.url, BASE).href === resourceURL)) continue;
      const response = await cache.match(key, { ignoreVary: true });
      if (response) return response;
    }
    return fetch(event.request);
  })());
});
