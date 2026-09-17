// Popup script for Meta AI WhatsApp Bulk Video Animator

document.addEventListener('DOMContentLoaded', async () => {
  const dot = document.getElementById('mai-status-dot');
  const statusText = document.getElementById('mai-status-text');
  const chatInfo = document.getElementById('mai-chat-info');
  const btnOpenPanel = document.getElementById('mai-btn-open-panel');
  const btnSwitchMeta = document.getElementById('mai-btn-switch-meta');

  // Query current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const isWhatsApp = tab && tab.url && tab.url.includes('web.whatsapp.com');

  if (!isWhatsApp) {
    dot.className = 'mai-status-dot';
    statusText.textContent = 'WhatsApp Web Not Open';
    chatInfo.textContent = 'Open web.whatsapp.com to use animator';
    btnOpenPanel.textContent = 'Open WhatsApp Web';
    btnOpenPanel.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://web.whatsapp.com' });
    });
    btnSwitchMeta.style.display = 'none';
    return;
  }

  // If on WhatsApp Web, ping content script
  try {
    chrome.tabs.sendMessage(tab.id, { action: 'PING_CONTENT' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        dot.className = 'mai-status-dot';
        statusText.textContent = 'Extension Connecting...';
        chatInfo.textContent = 'Please refresh the WhatsApp Web page if needed.';
        return;
      }

      dot.className = 'mai-status-dot active';
      statusText.textContent = 'WhatsApp Web Connected ✓';

      if (response.chatInfo) {
        const isMeta = response.chatInfo.isMetaAI;
        chatInfo.innerHTML = `Active Chat: <b>${escapeHtml(response.chatInfo.title)}</b> ${isMeta ? '(Meta AI ✓)' : '(Switch to Meta AI)'}`;
      }
    });
  } catch (err) {
    console.warn('Could not contact content script:', err);
  }

  // Open Dashboard inside WhatsApp Web
  btnOpenPanel.addEventListener('click', () => {
    chrome.tabs.sendMessage(tab.id, { action: 'OPEN_DASHBOARD' });
    window.close();
  });

  // Switch to Meta AI Chat
  btnSwitchMeta.addEventListener('click', () => {
    chrome.tabs.sendMessage(tab.id, { action: 'SWITCH_TO_META_AI' }, (res) => {
      if (res && res.success) {
        chatInfo.innerHTML = 'Active Chat: <b>Meta AI ✓</b>';
      }
    });
  });

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }
});
