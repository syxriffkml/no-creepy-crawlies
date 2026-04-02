// No Creepy Crawlies — Service Worker (background script)
// Handles: API calls, cache, usage tracking, message brokering

import { scanImage } from '../utils/apiClients.js';
import { storageGet, getCacheEntry, setCacheEntry, getActiveApi } from '../utils/storage.js';
import { trackCall } from '../utils/usageTracker.js';

// ---------------------------------------------------------------------------
// Install hook
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SCAN_IMAGE') {
    handleScanImage(msg.url)
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true; // keep message channel open for async response
  }
});

// ---------------------------------------------------------------------------
// Scan pipeline
// ---------------------------------------------------------------------------

async function handleScanImage(url) {
  const { enabled = true } = await storageGet('enabled');
  if (!enabled) return null;

  // Return cached result immediately — no API call needed
  const cached = await getCacheEntry(url);
  if (cached) return cached;

  // No API configured yet (user hasn't completed onboarding)
  const api = await getActiveApi();
  if (!api) return null;

  // Fetch the image and convert to base64
  let base64, mimeType;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    mimeType = blob.type || 'image/jpeg';
    base64 = await blobToBase64(blob);
  } catch {
    return null; // network error — leave image untouched
  }

  // Call the AI API
  let result;
  try {
    result = await scanImage(api.provider, api.key, base64, mimeType);
  } catch (err) {
    console.error('[NCC] API error:', err.message);
    return null;
  }

  // Persist result and track usage
  await setCacheEntry(url, result);
  await trackCall(api.provider);

  return result;
}

/**
 * Blob → base64 string (no data URI prefix).
 * Uses arrayBuffer() because FileReader is not available in service workers.
 */
async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Process in chunks to avoid call stack overflow on large images
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
