// No Creepy Crawlies — Service Worker (background script)
// Handles: API calls, usage tracking, message brokering between content <-> popup/settings

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});

// TODO (step 3): handle messages from content.js to make API calls
// TODO (step 4): initialize usage tracker on startup
