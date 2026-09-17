// Content Script Entry Point for Meta AI WhatsApp Bulk Video Animator

(function () {
  'use strict';

  console.log('[MetaAI Animator] Content script injected on web.whatsapp.com');

  // Wait for WhatsApp Web UI to initialize
  function checkAndInitialize() {
    if (document.querySelector('#app') && (document.querySelector('#main') || document.querySelector('#side'))) {
      console.log('[MetaAI Animator] WhatsApp Web interface ready. Initializing overlay...');
      window.UIOverlay.init();
    } else {
      setTimeout(checkAndInitialize, 1500);
    }
  }

  // Handle messages from Extension Popup or Background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.action === 'PING_CONTENT') {
        sendResponse({
          success: true,
          status: 'ready',
          chatInfo: window.WhatsAppDOM.getActiveChatInfo()
        });
      }
      else if (message.action === 'OPEN_DASHBOARD') {
        const modal = document.getElementById('mai-panel-modal');
        if (modal) {
          modal.classList.remove('mai-hidden');
        }
        sendResponse({ success: true });
      }
      else if (message.action === 'SWITCH_TO_META_AI') {
        window.WhatsAppDOM.openMetaAIChat().then(switched => {
          sendResponse({ success: switched });
        });
        return true;
      }
      else {
        sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  });

  // Start polling for WhatsApp load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    checkAndInitialize();
  } else {
    window.addEventListener('DOMContentLoaded', checkAndInitialize);
  }
})();
