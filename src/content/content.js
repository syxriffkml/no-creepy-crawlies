// No Creepy Crawlies — Content Script
// Scans the page for bug images and coordinates with the background service worker.

import { collectImages, observeMutations, observeViewport } from '../utils/imageScanner.js';
import { applyBlur, findElementsByUrl } from './blurReveal.js';

// URLs already queued for scanning this page session — avoids duplicate API calls
const queued = new Set();

// ---------------------------------------------------------------------------
// Scan pipeline
// ---------------------------------------------------------------------------

/**
 * Send one image URL to the background for scanning.
 * Results are handled by applyResult() when they come back.
 */
function queueScan(url) {
  if (queued.has(url)) return;
  queued.add(url);

  chrome.runtime.sendMessage({ type: 'SCAN_IMAGE', url }, async (result) => {
    if (chrome.runtime.lastError) return; // extension context invalidated, ignore
    await applyResult(url, result);
  });
}

/**
 * Act on a scan result for a given URL.
 * Checks the confidence threshold, then blurs every element on the page
 * that matches this URL.
 */
async function applyResult(url, result) {
  if (!result?.detected) return;

  const { confidenceThreshold = 0.9 } = await chrome.storage.local.get('confidenceThreshold');
  if (result.confidence < confidenceThreshold) return;

  for (const el of findElementsByUrl(url)) {
    applyBlur(el, result);
  }
}

/**
 * Run an initial scan of all images currently in the DOM.
 */
function scanPage() {
  for (const { url } of collectImages()) {
    queueScan(url);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function init() {
  const { enabled = true, whitelistedDomains = [] } = await chrome.storage.local.get([
    'enabled',
    'whitelistedDomains',
  ]);

  if (!enabled) return;

  const hostname = window.location.hostname;
  const isWhitelisted = whitelistedDomains.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`),
  );
  if (isWhitelisted) return;

  // 1. Immediate scan of whatever is already loaded
  scanPage();

  // 2. Pre-scan images as they approach the viewport (fires before scrolling
  //    is needed — covers lazy-loaded sites like Google Images)
  observeViewport((url) => queueScan(url));

  // 3. Watch for src changes + newly injected images (infinite scroll, SPAs)
  observeMutations((newImages) => {
    for (const { url } of newImages) {
      queueScan(url);
    }
  });

  // 4. Re-scan after the page fully settles to catch anything that
  //    wasn't ready during the initial DOMContentLoaded phase
  if (document.readyState !== 'complete') {
    window.addEventListener('load', scanPage, { once: true });
  }
  setTimeout(scanPage, 2000);
}

init();
