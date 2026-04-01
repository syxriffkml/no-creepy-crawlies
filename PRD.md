# BugBlind — Product Requirements Document (PRD)

> **GitHub Repo:** `bugblind`
> **GitHub Description:** AI-powered browser extension that detects and blurs insect & bug images across the web 🐛🚫
> **Version:** 1.0.0
> **Status:** Planning Complete — Ready for Development

---

## 1. Overview

BugBlind is a browser extension that uses AI vision APIs to automatically detect and blur images containing insects, spiders, and other creepy crawlies as the user browses the web. Users bring their own API keys, keeping costs distributed and privacy intact. The extension supports multiple AI backends with smart usage tracking and a clean onboarding experience.

---

## 2. Browser Support

| Browser | Engine | Notes |
|---|---|---|
| Chrome | Chromium | Primary target |
| Edge | Chromium | Same codebase as Chrome |
| Opera | Chromium | Same codebase as Chrome |
| Opera GX | Chromium | Same codebase as Chrome |
| Firefox | Gecko | Requires separate `manifest.json` (Manifest V2), same core logic |

> Use **Manifest V3** for Chromium browsers, **Manifest V2** for Firefox.

---

## 3. Supported AI APIs

All 4 APIs are supported. Users choose which one(s) to use and provide their own API keys.

| API | Accuracy | Cost | Pros | Cons |
|---|---|---|---|---|
| Claude Vision | ⭐⭐⭐⭐⭐ | 💰💰💰 | Most accurate, best context understanding | Pricier, no free tier |
| Gemini Flash | ⭐⭐⭐⭐⭐ | 💰 | Smart, very affordable, generous limits | Requires Google account |
| Google Cloud Vision | ⭐⭐⭐⭐ | 💰💰 | Fast, reliable, widely used | Less context-aware than LLMs |
| Clarifai | ⭐⭐⭐ | 💰💰 | Dedicated insect/animal model | Less accurate overall |

- **Recommended badge:** Gemini Flash (best accuracy-to-cost ratio)
- **Default fallback order:** Claude → Gemini → Google Cloud Vision → Clarifai
- Users can customize priority order in Settings
- Each API card in onboarding shows short pros/cons + a "Learn More" link → GitHub README

---

## 4. Architecture Overview

```
bugblind/
├── manifest.json              # Chromium (MV3)
├── manifest.firefox.json      # Firefox (MV2)
├── background/
│   └── background.js          # Service worker — API calls, usage tracking, message broker
├── content/
│   └── content.js             # Scans pages, replaces images, watches DOM mutations
├── popup/
│   ├── popup.html             # Quick view popup
│   ├── popup.js
│   └── popup.css
├── onboarding/
│   ├── onboarding.html        # First-time setup wizard
│   ├── onboarding.js
│   └── onboarding.css
├── settings/
│   ├── settings.html          # Full settings page
│   ├── settings.js
│   └── settings.css
├── assets/
│   └── icons/                 # Extension icons (16, 32, 48, 128px)
├── utils/
│   ├── apiClients.js          # API call wrappers for all 4 providers
│   ├── usageTracker.js        # Usage counting, warning logic, monthly reset
│   ├── imageScanner.js        # DOM scanning, MutationObserver logic
│   └── storage.js             # chrome.storage.local helpers
└── README.md
```

---

## 5. Core Features

### 5.1 Image Scanning

- Scans all of the following:
  - `<img>` tags
  - CSS background images
  - Video thumbnails
- Scans on **page load** AND watches for dynamically loaded images via **MutationObserver** (handles infinite scroll, lazy loading, SPAs)
- Scanning is **global across all websites** by default
- Users can whitelist specific domains to skip scanning (see Settings)
- Images below a minimum size (e.g. < 50x50px) are skipped to avoid wasting API calls on icons/favicons

### 5.2 Blur & Reveal

- Detected bug images are **blurred** (CSS `filter: blur(20px)`)
- A small overlay label is shown on the blurred image (e.g. 🐛 *Blocked*)
- **Click to reveal** — clicking the blurred image shows a warning card:
  ```
  ⚠️ Spider detected
  This image may contain an insect or bug.
  [ Reveal Image ]   [ Keep Blurred ]
  ```
- The bug type label (e.g. "Spider", "Cockroach") is stored from the **original API call** — no extra API call needed for the warning card
- Once revealed, the image stays revealed for that page session

### 5.3 API Call Optimization

To minimize API usage:
- **Cache results by image URL** — if the same image URL has been scanned before, use cached result (stored in `chrome.storage.local`)
- **Skip small images** — ignore images under 50x50px
- **Viewport-first scanning** — prioritize images in the visible viewport, then scan offscreen images progressively
- **Debounce MutationObserver** — batch new image detections to avoid rapid-fire API calls on scroll

### 5.4 Confidence Threshold

- Default: **90% confidence** required before blurring an image
- User-adjustable in Settings (slider: 50% – 99%)
- Higher = fewer false positives but may miss some bugs
- Lower = catches more bugs but may blur unrelated images

### 5.5 API Failure Handling

- If an API call fails (network error, timeout, invalid key): **leave the original image as-is**
- Log the failure silently — do not alert the user per failed image
- If failures are consistent, surface a warning in the popup

---

## 6. Usage Tracker

### 6.1 Tracking
- Counts API calls per API key
- Stored in `chrome.storage.local`
- Tracks: total calls this month, calls per day (for popup stat)

### 6.2 Warning Thresholds
- **80% used** → first warning
- **90% used** → second warning
- Warnings shown via:
  - Badge/notification in the **extension popup**
  - **Browser toast notification** (chrome.notifications API)

### 6.3 Reset
- Counter resets **automatically on the 1st of every month**
- Reset date is stored so the extension knows when to reset on next load

---

## 7. Onboarding (First-Time Setup Wizard)

Triggered automatically when the extension is installed and no API key is found.

### Steps:
1. **Welcome screen** — brief intro to BugBlind, what it does
2. **Choose API** — card-based selection showing all 4 options with:
   - Short pros & cons
   - Accuracy & cost indicators
   - ⭐ Recommended badge on Gemini Flash
   - "Learn More" link → GitHub README
3. **Enter API Key** — input field for the selected API's key, with a link to where to get one
4. **Test It** — extension sends a test image to the API to confirm the key works, shows ✅ or ❌
5. **Done** — success screen, extension is active

> Users can add additional API keys and set fallback order later in Settings.

---

## 8. Settings Page

| Section | Options |
|---|---|
| **API Management** | Add/remove API keys, set priority/fallback order, test keys |
| **Confidence Threshold** | Slider (50%–99%), default 90% |
| **Usage Notifications** | Toggle warnings on/off, view current usage per API |
| **Whitelisted Sites** | Add/remove domains to skip scanning |
| **Whitelisted Bug Types** | Toggle specific bug types to not block (e.g. butterflies) |
| **Theme** | Light / Dark / System (default: System) |
| **Reset Usage Counter** | Manual reset button |
| **About / Help** | Version info, link to GitHub README |

---

## 9. Extension Popup (Quick View)

Shown when user clicks the extension icon in the browser toolbar.

Contents:
- **On/Off toggle** — enable/disable extension globally
- **Current API in use** — name + small status indicator (active/warning/error)
- **Usage stats snapshot** — e.g. "423 / 1,000 calls used this month"
- **Images blocked today** — e.g. "🐛 12 images blocked today"
- **Link to Settings**

---

## 10. Bug Types Blocked (Default)

All of the following are blocked by default. Users can whitelist any in Settings:

- Spiders
- Cockroaches
- Ants
- Beetles
- Centipedes / Millipedes
- Grasshoppers / Crickets
- Mosquitoes / Flies
- Wasps / Bees / Hornets
- Caterpillars / Larvae
- Any other insect / bug

---

## 11. Data & Privacy

- All API keys stored locally in `chrome.storage.local` — never sent to any external server except the chosen AI API
- No user data is collected by the extension developer
- Images are sent directly from the user's browser to the chosen AI API — no proxy server
- Cache of scanned image URLs stored locally only

---

## 12. API Integration Notes

### Claude Vision (Anthropic)
- Endpoint: `https://api.anthropic.com/v1/messages`
- Send image as base64 in the message content
- Prompt: *"Does this image contain any insects, bugs, spiders, or creepy crawlies? Reply with JSON: { detected: true/false, type: string, confidence: number }"*
- Model: `claude-opus-4-5` or latest available vision model

### Gemini Flash (Google)
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- Send image as base64 inline data part
- Same JSON prompt structure as above

### Google Cloud Vision
- Endpoint: `https://vision.googleapis.com/v1/images:annotate`
- Use `LABEL_DETECTION` and `OBJECT_LOCALIZATION` features
- Check returned labels against a known insect label list

### Clarifai
- Endpoint: `https://api.clarifai.com/v2/models/{model_id}/outputs`
- Use the `general-image-recognition` or `ai-general-recognition` model
- Check returned concepts against insect/bug keyword list

---

## 13. Implementation Order (Suggested for Claude Code)

1. **Project scaffold** — folder structure, manifest files (MV3 + MV2)
2. **Storage utils** — `chrome.storage.local` helpers
3. **API clients** — wrappers for all 4 APIs with consistent response format
4. **Usage tracker** — counting, warnings, monthly reset
5. **Image scanner** — DOM scanning, MutationObserver, cache logic
6. **Blur & reveal UI** — CSS blur overlay, warning card component
7. **Onboarding wizard** — 5-step setup flow
8. **Popup** — quick view UI
9. **Settings page** — full settings UI
10. **Testing** — test across Chrome, Edge, Opera, Firefox
11. **README** — full docs for GitHub including API setup guides per provider

---

## 14. Out of Scope (v1.0)

- Video frame-by-frame scanning (too expensive on API calls)
- Mobile browser support
- Syncing settings across devices
- Auto-suggesting alternative APIs when limit is reached (just warns for now)
- Publishing to browser extension stores (future)

---

*PRD generated from planning session. Feed this to Claude Code as the first message to begin implementation.*
