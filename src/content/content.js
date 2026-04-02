// No Creepy Crawlies — Content Script
// Scans the page for bug images and coordinates with the background service worker.

import { collectImages, observeMutations } from '../utils/imageScanner.js';

// URLs already queued for scanning this page session — avoids duplicate API calls
const queued = new Set();

// ---------------------------------------------------------------------------
// Scan pipeline
// ---------------------------------------------------------------------------

/**
 * Send one image URL to the background for scanning.
 * Results are handled by applyResult() when they come back.
 */
function queueScan(url, _element) {
  if (queued.has(url)) return;
  queued.add(url);

  chrome.runtime.sendMessage({ type: 'SCAN_IMAGE', url }, (result) => {
    if (chrome.runtime.lastError) return; // extension context invalidated, ignore
    applyResult(url, result);
  });
}

/**
 * Act on a scan result for a given image URL.
 * Finds all elements on the page sharing that URL and blurs them if detected.
 * (Full blur + overlay UI is wired in step 6.)
 */
function applyResult(url, result) {
  if (!result?.detected) return;

  // TODO step 6: apply blur overlay to all matching elements
  console.debug(
    `[NCC] Detected: ${result.type} (${Math.round(result.confidence * 100)}%) — ${url}`,
  );
}

/**
 * Run an initial scan of all images currently in the DOM.
 */
function scanPage() {
  for (const { url, element } of collectImages()) {
    queueScan(url, element);
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

  // Scan images already in the DOM
  scanPage();

  // Watch for images added dynamically (infinite scroll, SPAs, lazy loaders)
  observeMutations((newImages) => {
    for (const { url, element } of newImages) {
      queueScan(url, element);
    }
  });
}

init();
