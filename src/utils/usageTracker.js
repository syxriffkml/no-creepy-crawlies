// No Creepy Crawlies — Usage tracker
// Business-logic layer on top of storage.js.
// Tracks API calls, checks warning thresholds, fires browser notifications.

import { getUsage, incrementUsage, resetUsage as storageResetUsage, getAllSettings } from './storage.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default monthly call limits per provider. Shown as "X / limit" in popup. */
export const DEFAULT_LIMITS = {
  claude:       1_000,
  gemini:       15_000,
  googleVision: 1_000,
  clarifai:     1_000,
};

export const PROVIDER_NAMES = {
  claude:       'Claude Vision',
  gemini:       'Gemini Flash',
  googleVision: 'Google Cloud Vision',
  clarifai:     'Clarifai',
};

/** Fire a notification when monthly usage crosses these percentages. */
const THRESHOLDS = [
  { pct: 0.8, id: 'warn80', label: '80%' },
  { pct: 0.9, id: 'warn90', label: '90%' },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Track which threshold notifications have already been sent this month so we
 * don't spam the user on every API call.
 * Shape: { [provider]: { month: 'YYYY-MM', warn80?: true, warn90?: true } }
 */
async function getSentWarnings() {
  const result = await chrome.storage.local.get('_sentWarnings');
  return result._sentWarnings ?? {};
}

async function setSentWarnings(data) {
  await chrome.storage.local.set({ _sentWarnings: data });
}

function fireNotification(id, title, message) {
  if (!chrome.notifications) return;
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'assets/icons/icon48.png',
    title,
    message,
    priority: 1,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call this after every successful API scan.
 * Increments the monthly + daily counter and fires a browser notification if
 * the 80% or 90% usage threshold is crossed for the first time this month.
 *
 * @returns {Promise<{ monthlyCount, dailyCount, resetMonth }>}
 */
export async function trackCall(provider) {
  const usage = await incrementUsage(provider);
  const limit = DEFAULT_LIMITS[provider];
  if (!limit) return usage;

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const pct = usage.monthlyCount / limit;

  const sentWarnings = await getSentWarnings();

  // Reset per-provider warning state when the month rolls over
  if (sentWarnings[provider]?.month !== thisMonth) {
    sentWarnings[provider] = { month: thisMonth };
  }

  const { notificationsEnabled } = await chrome.storage.local.get('notificationsEnabled');
  const notificationsOn = notificationsEnabled !== false; // default true

  if (notificationsOn) {
    for (const { pct: threshold, id, label } of THRESHOLDS) {
      if (pct >= threshold && !sentWarnings[provider][id]) {
        sentWarnings[provider][id] = true;
        const name = PROVIDER_NAMES[provider] ?? provider;
        fireNotification(
          `ncc-${provider}-${id}-${thisMonth}`,
          'No Creepy Crawlies — API Usage Alert',
          `${name}: ${label} of your monthly limit used (${usage.monthlyCount.toLocaleString()} / ${limit.toLocaleString()})`,
        );
      }
    }
  }

  await setSentWarnings(sentWarnings);
  return usage;
}

/**
 * Get a display-ready usage summary for one provider.
 * Used by the popup and settings page.
 *
 * @returns {{ monthlyCount, dailyCount, resetMonth, limit, pct }}
 */
export async function getUsageSummary(provider) {
  const usage = await getUsage(provider);
  const limit = DEFAULT_LIMITS[provider] ?? null;
  return {
    ...usage,
    limit,
    pct: limit != null ? usage.monthlyCount / limit : null,
  };
}

/**
 * Get usage summaries for every provider that has an API key configured.
 * Returns an object keyed by provider name.
 */
export async function getAllUsageSummaries() {
  const { apis } = await getAllSettings();
  const out = {};
  for (const { provider } of apis) {
    out[provider] = await getUsageSummary(provider);
  }
  return out;
}

/**
 * Manually reset usage counters (and clear sent-warning state) for a provider.
 * Pass no argument to reset every provider.
 */
export async function resetUsage(provider) {
  await storageResetUsage(provider);

  const sentWarnings = await getSentWarnings();
  if (provider) {
    delete sentWarnings[provider];
  } else {
    for (const p of Object.keys(sentWarnings)) delete sentWarnings[p];
  }
  await setSentWarnings(sentWarnings);
}
