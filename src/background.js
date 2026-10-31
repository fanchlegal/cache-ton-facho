// Récupère les listes partagées (fichiers texte, un pseudo par ligne) et les garde en mémoire locale.
const api = globalThis.browser ?? globalThis.chrome;

const DEFAULT_LIST_URL = 'https://raw.githubusercontent.com/fanchlegal/cache-ton-facho/main/liste.txt';
const REFRESH_MINUTES = 360; // toutes les 6 heures
const MAX_SIZE = 2_000_000;  // 2 Mo maximum par liste

const cleanUser = (s) => (s || '').trim()
  .replace(/^https?:\/\/(www\.)?(threads\.(com|net)|instagram\.com)\//i, '')
  .replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase();

// Une ligne = un pseudo (avec ou sans @, ou adresse de profil). Tout ce qui suit # est un commentaire.
function parseList(text) {
  return [...new Set(
    text.split(/\r?\n/)
      .map((l) => cleanUser(l.replace(/#.*$/, '')))
      .filter((u) => /^[\w.]{1,40}$/.test(u))
  )];
}

async function refreshLists() {
  const { useRemote, remoteUrls, remoteData } = await api.storage.local.get({
    useRemote: false, remoteUrls: [DEFAULT_LIST_URL], remoteData: {}
  });
  if (!useRemote) return remoteData;
  const next = {};
  for (const url of remoteUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`erreur ${res.status}`);
      const text = await res.text();
      if (text.length > MAX_SIZE) throw new Error('liste trop volumineuse');
      next[url] = { accounts: parseList(text), fetchedAt: Date.now(), error: null };
    } catch (e) {
      // On garde la dernière version connue en cas d'échec
      next[url] = { ...(remoteData[url] || { accounts: [] }), error: String(e.message || e), failedAt: Date.now() };
    }
  }
  await api.storage.local.set({ remoteData: next });
  return next;
}

function schedule() {
  api.alarms.create('refresh-lists', { periodInMinutes: REFRESH_MINUTES });
}

// Instagram est facultatif (un nouveau site dans host_permissions désactiverait l'extension
// chez tout le monde à la mise à jour) : le script n'y est injecté qu'une fois l'accès accordé
const INSTAGRAM = {
  id: 'instagram', matches: ['https://www.instagram.com/*'],
  js: ['content.js'], css: ['styles.css'], runAt: 'document_idle'
};

async function syncInstagram() {
  const on = await api.permissions.contains({ origins: INSTAGRAM.matches });
  const registered = (await api.scripting.getRegisteredContentScripts({ ids: [INSTAGRAM.id] })).length > 0;
  if (on && !registered) await api.scripting.registerContentScripts([INSTAGRAM]);
  if (!on && registered) await api.scripting.unregisterContentScripts({ ids: [INSTAGRAM.id] });
}

api.permissions.onAdded.addListener(syncInstagram);
api.permissions.onRemoved.addListener(syncInstagram);
api.runtime.onInstalled.addListener(() => { schedule(); refreshLists(); syncInstagram(); });
api.runtime.onStartup?.addListener(() => { schedule(); refreshLists(); syncInstagram(); });
api.alarms.onAlarm.addListener((alarm) => { if (alarm.name === 'refresh-lists') refreshLists(); });

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'refresh-lists') {
    refreshLists().then(sendResponse, (e) => sendResponse({ error: String(e) }));
    return true; // réponse asynchrone
  }
  return false;
});
