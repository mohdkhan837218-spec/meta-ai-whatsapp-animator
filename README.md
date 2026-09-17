# 🎬 Meta AI WhatsApp Bulk Video Animator (Chrome Extension v3.2.4)

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![WhatsApp Web](https://img.shields.io/badge/WhatsApp%20Web-Compatible-25D366?logo=whatsapp&logoColor=white)](https://web.whatsapp.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.2.4-orange.svg)](manifest.json)

An automated **Manifest V3 Chrome Extension** designed to automate **bulk Image-to-Video generation** using **Meta AI** inside WhatsApp Web (`web.whatsapp.com`).

Transform dozens or hundreds of images into animated AI videos completely hands-free — with sequential prompt matching, native media caption injection, patient real-time video generation observers, automatic timestamped downloads, and intelligent server-down auto-pause protection.

---

## ✨ Key Features

- **📂 Bulk Drag & Drop Image Queue**:
  - Drag and drop dozens of photos at once or select via file browser.
  - Natural alphabetical and numeric sorting (`1.jpg, 2.jpg...`, `IMG_001, IMG_002...`) ensures exact sequential consistency.
  - Visual badges (`#1, #2, #3...`) for every queued card.

- **📝 Sequential Prompt Matching (1 Prompt per Image)**:
  - Upload a `.txt` file containing your prompts or paste a multi-line list into the **Bulk Prompts** box.
  - Line 1 automatically matches Image #1, Line 2 matches Image #2, etc.
  - Prompts sync immediately on paste/type and remain individually editable.

- **🖼️ Native WhatsApp Media Preview & Caption Insertion**:
  - Automatically loads images into WhatsApp Web's real Media Preview dialog.
  - Programmatically focuses and types the specific prompt into WhatsApp's Lexical caption container (`[data-testid="media-caption-input-container"]`).
  - Built-in anti-duplication safeguards prevent double typing (`animateanimate`).

- **⏳ Patient & Verified Video Generation Wait**:
  - Meta AI video generation takes real time (typically 30s to 90s).
  - The extension watches the chat strictly *after* the outgoing image message anchor.
  - Displays a live second-by-second counter: `⏳ Meta AI is generating video... (45s / 180s)`.
  - Rejects pure text disclaimers or stale earlier videos — only accepts confirmed, playable `<video>` streams (`blob:...`).

- **📥 Timestamped & Exact Filename Video Downloads**:
  - Immediately triggers automatic download via Chrome Downloads API as soon as the video is ready.
  - Preserves the original image filename and any timestamp flags (e.g. `IMG_20260917_124500.mp4`).
  - Optional customizable filename formats (Original Name, Prompt Name, or Image + Prompt).

- **🚨 Smart Meta AI Server Outage Detection & Auto-Pause**:
  - Recognizes when Meta AI's video backend is experiencing downtime or overload (`"Imagine API video generation failed"`, `"video server at Meta's end hasn't come back online yet"`).
  - Automatically pauses the queue if 2 consecutive server outages occur, protecting your remaining images from being wasted.
  - Includes a one-click **"🔄 Retry Failed"** button to resume generation as soon as Meta's servers recover.

- **⏱️ Configurable Cooldown Delay**:
  - Configurable cooldown (default 8s) between jobs to respect WhatsApp Web connections and prevent server-side rate limits.

---

## 📸 Sample Demo Images Included

This repository comes with sample demonstration images and matching prompts in [`sample_images/`](sample_images/):
- `sample_images/1_waterfall.jpg`: Photorealistic rainforest waterfall.
- `sample_images/2_cyberpunk_samurai.jpg`: Cyberpunk warrior with glowing neon lighting.
- `sample_images/3_golden_hour_car.jpg`: Vintage sports car on coastal cliffside at sunset.
- `sample_images/prompts.txt`: Ready-to-use sequential prompts matching each demo image.

---

## 🚀 Installation Guide

### Prerequisites
- Google Chrome, Brave, Edge, or any Chromium-based browser.
- An active WhatsApp account logged into [WhatsApp Web](https://web.whatsapp.com/).

### Steps
1. **Clone or Download Repository**:
   ```bash
   git clone https://github.com/mohdkhan837218-spec/meta-ai-whatsapp-animator.git
   ```
   *(Or download as ZIP and extract to a folder).*

2. **Load into Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** toggle in the top-right corner.
   - Click **"Load unpacked"** in the top-left.
   - Select the `meta-ai-whatsapp-animator` folder.

3. **Open WhatsApp Web**:
   - Navigate to [web.whatsapp.com](https://web.whatsapp.com/).
   - Click on the **Meta AI** chat (or click the floating Meta AI pill button at the bottom-right corner added by the extension).

---

## 🎯 How to Use

1. **Open the Extension Modal**:
   - Click the green floating launcher pill at the bottom-right of WhatsApp Web or click the extension icon in your Chrome toolbar.

2. **Add Your Prompts**:
   - Paste multi-line prompts into the **Bulk Prompts** text box, or click **"📂 Upload .txt"** and select a text file with 1 prompt per line (e.g. [`sample_images/prompts.txt`](sample_images/prompts.txt)).

3. **Add Your Images**:
   - Drag & drop your photos into the dropzone (e.g. from [`sample_images/`](sample_images/)).
   - Notice the `#1, #2, #3` badges matching the sequential prompts.

4. **Start Automation**:
   - Click **"Start Bulk Animation"**.
   - Watch the extension open each image in Media Preview, paste its prompt, send it, patiently wait for Meta AI to generate the video, and save the MP4 to your Downloads folder one-by-one!

---

## 📁 Repository Structure

```
meta-ai-whatsapp-animator/
├── manifest.json              # Manifest V3 configuration & permissions
├── background/
│   └── service-worker.js      # Background worker handling Chrome downloads
├── content/
│   ├── content.js             # Content script bootstrap and coordinator
│   ├── injected-bridge.js     # MAIN world script for native Lexical input & preview
│   ├── queue-manager.js       # Queue state machine, prompt matcher & server protection
│   ├── ui-overlay.js          # Draggable floating pill, modal, tabs & item cards
│   └── whatsapp-dom.js        # DOM selectors, video stream detection & anchor tracking
├── styles/
│   └── overlay.css            # WhatsApp-native glassmorphism UI stylesheet
├── sample_images/             # High quality demo images and prompt file
│   ├── 1_waterfall.jpg
│   ├── 2_cyberpunk_samurai.jpg
│   ├── 3_golden_hour_car.jpg
│   └── prompts.txt
├── icons/                     # Extension icons (16x16, 48x48, 128x128)
├── LICENSE                    # MIT License
└── README.md                  # Project documentation
```

---

## ⚙️ Settings & Customization

| Setting | Default | Description |
| :--- | :--- | :--- |
| **Auto-Download** | `Enabled` | Automatically saves MP4 files to your Downloads folder. |
| **Filename Format** | `Original Image Name` | Keeps original image filename & timestamp flags intact. |
| **Cooldown Delay** | `8 seconds` | Safe delay between jobs to prevent rate limits. |
| **Generation Timeout**| `180 seconds` | Max time to wait for Meta AI to generate complex videos. |
| **Auto-Scroll** | `Enabled` | Keeps chat view pinned to the bottom during generation. |

---

## 🛡️ License

This project is licensed under the [MIT License](LICENSE) — free for personal and commercial use.

Created with ❤️ by [Mohd Khan](https://github.com/mohdkhan837218-spec).
