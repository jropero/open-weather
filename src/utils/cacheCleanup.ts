const PURGE_KEY = 'cache_last_purged';
const PURGE_INTERVAL = 24 * 60 * 60 * 1000;

export function purgeStaleCache() {
  try {
    const last = Number(localStorage.getItem(PURGE_KEY) ?? 0);
    if (Date.now() - last < PURGE_INTERVAL) return;

    const today = new Date();
    const todayMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('hist_cache_') && !key.endsWith(todayMonthDay)) {
        localStorage.removeItem(key);
      }
    }

    localStorage.setItem(PURGE_KEY, String(Date.now()));
  } catch { /* localStorage unavailable */ }
}
