// No Creepy Crawlies — chrome.storage.local helpers

export const PROVIDERS = ['claude', 'gemini', 'googleVision', 'clarifai'];

/**
 * Default values for every key we store.
 * Any missing key falls back to these on first read.
 */
export const DEFAULTS = {
  enabled: true,

  // [{ provider: string, key: string, priority: number }]
  apis: [],

  // 0.50 – 0.99, default 90%
  confidenceThreshold: 0.9,

  // 'light' | 'dark' | 'system'
  theme: 'system',

  notificationsEnabled: true,

  // domains to skip scanning, e.g. ['twitter.com']
  whitelistedDomains: [],

  // bug types NOT to block, e.g. ['butterfly']
  whitelistedBugTypes: [],

  // { [provider]: { monthlyCount, dailyCount, resetMonth } }
  usage: {},

  // { [url]: { detected, type, confidence, cachedAt } }
  imageCache: {},

  // images blocked counter, resets daily
  stats: { blockedToday: 0, lastDate: null },
};

// ---------------------------------------------------------------------------
// Low-level wrappers (promisify the callback-based chrome.storage API)
// ---------------------------------------------------------------------------

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

// ---------------------------------------------------------------------------
// General settings
// ---------------------------------------------------------------------------

/**
 * Get a single setting by key, falling back to DEFAULTS if not set.
 */
export async function getSetting(key) {
  const result = await storageGet(key);
  return result[key] !== undefined ? result[key] : DEFAULTS[key];
}

/**
 * Set a single setting by key.
 */
export async function setSetting(key, value) {
  await storageSet({ [key]: value });
}

/**
 * Get all settings at once (merged with defaults for any missing keys).
 */
export async function getAllSettings() {
  const result = await storageGet(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...result };
}

// ---------------------------------------------------------------------------
// API key management
// ---------------------------------------------------------------------------

export async function getApis() {
  const { apis = [] } = await storageGet('apis');
  return apis;
}

/**
 * Add or update an API key for a provider.
 * New providers are appended at the lowest priority.
 */
export async function saveApi(provider, key) {
  const apis = await getApis();
  const idx = apis.findIndex((a) => a.provider === provider);
  if (idx >= 0) {
    apis[idx] = { ...apis[idx], key };
  } else {
    apis.push({ provider, key, priority: apis.length + 1 });
  }
  await storageSet({ apis });
}

/**
 * Remove a provider's API key entirely.
 * Remaining providers have their priorities reassigned.
 */
export async function removeApi(provider) {
  const apis = await getApis();
  const updated = apis
    .filter((a) => a.provider !== provider)
    .map((a, i) => ({ ...a, priority: i + 1 }));
  await storageSet({ apis: updated });
}

/**
 * Reorder provider priority from an ordered array of provider names.
 * e.g. setApiPriority(['gemini', 'claude', 'googleVision', 'clarifai'])
 */
export async function setApiPriority(orderedProviders) {
  const apis = await getApis();
  const reordered = orderedProviders
    .map((provider, i) => {
      const api = apis.find((a) => a.provider === provider);
      return api ? { ...api, priority: i + 1 } : null;
    })
    .filter(Boolean);
  await storageSet({ apis: reordered });
}

/**
 * Get the active API (lowest priority number) that has a key set.
 * Returns null if no API keys are configured.
 */
export async function getActiveApi() {
  const apis = await getApis();
  if (!apis.length) return null;
  return [...apis].sort((a, b) => a.priority - b.priority)[0];
}

// ---------------------------------------------------------------------------
// Image scan cache
// ---------------------------------------------------------------------------

/**
 * Look up a cached scan result for a given image URL.
 * Returns null if not cached.
 */
export async function getCacheEntry(url) {
  const { imageCache = {} } = await storageGet('imageCache');
  return imageCache[url] ?? null;
}

/**
 * Store a scan result for a given image URL.
 * result: { detected: boolean, type: string|null, confidence: number }
 */
export async function setCacheEntry(url, result) {
  const { imageCache = {} } = await storageGet('imageCache');
  imageCache[url] = { ...result, cachedAt: Date.now() };
  await storageSet({ imageCache });
}

/**
 * Remove cache entries older than maxAgeMs (default: 7 days).
 * Call this periodically to keep storage size in check.
 */
export async function pruneCache(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const { imageCache = {} } = await storageGet('imageCache');
  const cutoff = Date.now() - maxAgeMs;
  const pruned = Object.fromEntries(
    Object.entries(imageCache).filter(([, v]) => v.cachedAt > cutoff),
  );
  await storageSet({ imageCache: pruned });
}

// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------

/**
 * Get usage data for a specific provider.
 */
export async function getUsage(provider) {
  const { usage = {} } = await storageGet('usage');
  return usage[provider] ?? { monthlyCount: 0, dailyCount: 0, resetMonth: null };
}

/**
 * Increment the call counter for a provider by 1.
 * Automatically resets monthly count when the month changes.
 * Returns the updated usage entry.
 */
export async function incrementUsage(provider) {
  const { usage = {} } = await storageGet('usage');
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const entry = usage[provider] ?? { monthlyCount: 0, dailyCount: 0, resetMonth: thisMonth };

  if (entry.resetMonth !== thisMonth) {
    entry.monthlyCount = 0;
    entry.dailyCount = 0;
    entry.resetMonth = thisMonth;
  }

  entry.monthlyCount += 1;
  entry.dailyCount += 1;
  usage[provider] = entry;

  await storageSet({ usage });
  return entry;
}

/**
 * Manually reset usage counters for a provider (or all if provider is omitted).
 */
export async function resetUsage(provider) {
  const { usage = {} } = await storageGet('usage');
  const blank = { monthlyCount: 0, dailyCount: 0, resetMonth: null };
  if (provider) {
    usage[provider] = blank;
  } else {
    PROVIDERS.forEach((p) => { usage[p] = blank; });
  }
  await storageSet({ usage });
}

// ---------------------------------------------------------------------------
// Daily blocked-image stats
// ---------------------------------------------------------------------------

/**
 * Get today's blocked-image count. Auto-resets at midnight.
 */
export async function getStats() {
  const { stats = DEFAULTS.stats } = await storageGet('stats');
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (stats.lastDate !== today) {
    return { blockedToday: 0, lastDate: today };
  }
  return stats;
}

/**
 * Increment the blocked-today counter by 1.
 * Returns the new count.
 */
export async function incrementBlocked() {
  const stats = await getStats();
  stats.blockedToday += 1;
  await storageSet({ stats });
  return stats.blockedToday;
}
