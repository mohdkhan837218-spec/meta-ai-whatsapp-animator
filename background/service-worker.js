// Background Service Worker for Meta AI WhatsApp Bulk Video Animator

const DEFAULT_SETTINGS = {
  defaultPrompt: 'animate',
  cooldownDelay: 8, // seconds between jobs
  timeoutLimit: 120, // max seconds to wait for Meta AI video
  autoDownload: true,
  filenamePrefix: '', // Blank by default so original filename / timestamp is retained
  filenameScheme: 'original', // 'original' (exact image name with timestamp) | 'prompt' | 'image_prompt'
  autoScroll: true
};

// Initialize settings on installation
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get('settings');
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  console.log('[MetaAI Animator SW] Extension initialized.');
});

// Update badge count
async function updateBadge(count) {
  try {
    if (count > 0) {
      await chrome.action.setBadgeText({ text: String(count) });
      await chrome.action.setBadgeBackgroundColor({ color: '#25D366' }); // WhatsApp Green
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (e) {
    console.error('[MetaAI Animator SW] Error setting badge:', e);
  }
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'DOWNLOAD_VIDEO') {
        const { url, filename, base64Data } = message;
        const targetUrl = base64Data || url;

        if (!targetUrl) {
          sendResponse({ success: false, error: 'No download URL or data provided.' });
          return;
        }

        const downloadId = await chrome.downloads.download({
          url: targetUrl,
          filename: filename || `meta_ai_video_${Date.now()}.mp4`,
          saveAs: false,
          conflictAction: 'uniquify'
        });

        sendResponse({ success: true, downloadId });
      } 
      else if (message.action === 'UPDATE_QUEUE_COUNT') {
        await updateBadge(message.count || 0);
        sendResponse({ success: true });
      }
      else if (message.action === 'GET_SETTINGS') {
        const data = await chrome.storage.local.get('settings');
        sendResponse({ success: true, settings: data.settings || DEFAULT_SETTINGS });
      }
      else if (message.action === 'SAVE_SETTINGS') {
        await chrome.storage.local.set({ settings: message.settings });
        sendResponse({ success: true });
      }
      else if (message.action === 'PING') {
        sendResponse({ success: true, status: 'ready' });
      }
      else {
        sendResponse({ success: false, error: `Unknown action: ${message.action}` });
      }
    } catch (err) {
      console.error('[MetaAI Animator SW] Message handler error:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // Keep message channel open for async response
});
