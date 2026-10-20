# No Creepy Crawlies

A Chromium extension that uses your chosen AI provider to identify and blur insect images. Enter your own API key in the extension; no `.env` file or application server is required.

Repository: [syxriffkml/no-creepy-crawlies](https://github.com/syxriffkml/no-creepy-crawlies).

## Run locally

Install Node.js, then run:

```sh
npm install
npm run setup
npm run build
```

Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the `dist` folder. Configure your API key during onboarding or in Settings.

After code changes, run `npm run build`, reload the extension, and refresh existing webpages. `npm run dev` watches source files and rebuilds them; existing tabs still need a refresh to replace their content scripts.

## Current behavior

The extension sends images to the configured provider and blurs images identified as insects above the confidence threshold. It supports Gemini, Claude, Google Cloud Vision, and Clarifai. Results are cached to reduce repeat requests.

Images still loading can receive a temporary blur while a check runs. A failed check removes that temporary blur and leaves the image visible. An API error does not mean an image is safe; it means the image could not be checked.

Detection depends on the configured cloud provider; there is no local AI model. Images can be visible before detection finishes, and detection can make mistakes. Provider outages or exhausted quotas can prevent new images from being detected.

Embedded `data:` images are skipped, and size filters can exclude small thumbnails. Canvas drawings, video frames, and backgrounds defined only in stylesheets are not scanned. The extension does not guarantee that every insect image will be blocked.

## Keys, privacy, and usage

API keys and settings are stored in the browser's local extension storage. Images sent for classification leave the browser and go to the configured AI provider.

Each uncached image check normally requires a separate provider request. Testing an API key also makes a real request, so image-heavy pages and connection tests consume provider quota.

The usage display counts successful image-scan requests recorded by the extension; it does not measure token balances, account-wide quotas, or actual charges. Its displayed thresholds are not a provider quota guarantee or a spending cap. Check your provider's dashboard for quotas and billing status.

Changes in this folder are local until you choose to commit and push them to GitHub.
