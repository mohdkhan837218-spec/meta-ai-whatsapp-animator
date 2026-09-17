// Queue Manager for sequential bulk processing of images to Meta AI video generation
// Supports both Direct WhatsApp Web Internal Client (Primary) and Resilient DOM Automation (Fallback)

window.QueueManager = (function () {
  'use strict';

  let queue = [];
  let isProcessing = false;
  let isPaused = false;
  let shouldStop = false;
  let currentActiveId = null;
  let cooldownRemaining = 0;
  let bridgeReady = false;
  let consecutiveServerErrors = 0;

  let listeners = {
    onQueueUpdate: [],
    onLog: []
  };

  let settings = {
    defaultPrompt: 'animate',
    cooldownDelay: 8,
    timeoutLimit: 180,
    autoDownload: true,
    filenamePrefix: '', // Blank by default to keep exact original image/prompt name
    filenameScheme: 'original', // 'original' | 'prompt' | 'image_prompt'
    autoScroll: true
  };

  // Listen for backend bridge status
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === 'MAI_PONG' || event.data.type === 'MAI_BRIDGE_READY') {
      bridgeReady = true;
      console.log('[QueueManager] Direct Bridge status: READY');
    }
  });

  // Ensure bridge script is running in MAIN world
  function ensureBridgeConnected() {
    return new Promise((resolve) => {
      let resolved = false;

      function onPong(e) {
        if (e.source === window && e.data && (e.data.type === 'MAI_PONG' || e.data.type === 'MAI_BRIDGE_READY')) {
          window.removeEventListener('message', onPong);
          bridgeReady = true;
          resolved = true;
          console.log('[QueueManager] ✓ Bridge verified and connected!');
          resolve(true);
        }
      }

      window.addEventListener('message', onPong);
      window.postMessage({ type: 'MAI_PING' }, '*');

      setTimeout(() => {
        if (!resolved) {
          console.log('[QueueManager] Pinging bridge again or injecting script tag...');
          try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('content/injected-bridge.js');
            (document.head || document.documentElement).appendChild(script);
            script.onload = () => {
              script.remove();
              window.postMessage({ type: 'MAI_PING' }, '*');
            };
          } catch (e) {
            console.warn('[QueueManager] Dynamic injection notice:', e);
          }
        }
      }, 400);

      setTimeout(() => {
        if (!resolved) {
          window.removeEventListener('message', onPong);
          resolve(bridgeReady);
        }
      }, 1500);
    });
  }

  // Ping bridge immediately on startup
  ensureBridgeConnected();

  // Load settings from storage
  function loadSettings() {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (res) => {
        if (res && res.success && res.settings) {
          settings = { ...settings, ...res.settings };
          emitQueueUpdate();
        }
      });
    }
  }

  function updateSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', settings });
    }
    emitQueueUpdate();
  }

  function getSettings() {
    return { ...settings };
  }

  function onQueueUpdate(cb) {
    listeners.onQueueUpdate.push(cb);
  }

  function onLog(cb) {
    listeners.onLog.push(cb);
  }

  function log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, level, message };
    console.log(`[QueueManager ${level.toUpperCase()}] ${message}`);
    listeners.onLog.forEach(cb => cb(entry));
  }

  function emitQueueUpdate() {
    const stats = {
      total: queue.length,
      queued: queue.filter(q => q.status === 'QUEUED').length,
      processing: queue.filter(q => ['UPLOADING', 'GENERATING', 'DOWNLOADING'].includes(q.status)).length,
      completed: queue.filter(q => q.status === 'COMPLETED').length,
      failed: queue.filter(q => q.status === 'FAILED').length
    };

    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'UPDATE_QUEUE_COUNT',
        count: stats.queued + stats.processing
      });
    }

    listeners.onQueueUpdate.forEach(cb => cb({
      queue: [...queue],
      activeId: currentActiveId,
      isProcessing,
      isPaused,
      cooldownRemaining,
      stats,
      settings
    }));
  }

  function addFiles(files, promptListOrSingle = '') {
    const addedItems = [];
    let promptList = [];

    if (Array.isArray(promptListOrSingle)) {
      promptList = promptListOrSingle;
    } else if (typeof promptListOrSingle === 'string' && promptListOrSingle.includes('\n')) {
      promptList = promptListOrSingle.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }

    // Natural sort files by filename so Image 1, Image 2, Image 3... match sequential prompts 1, 2, 3
    const fileArray = Array.from(files).sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    // Active queued pending items count before adding
    const currentQueuedCount = queue.filter(q => q.status === 'QUEUED').length;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      if (!file.type.startsWith('image/')) {
        log('warn', `Skipping non-image file: ${file.name}`);
        continue;
      }

      // Sequential matching from start:
      // If queue is empty, i = 0 gets prompt 0, i = 1 gets prompt 1...
      let itemPrompt = '';
      const seqIndex = currentQueuedCount + addedItems.length;

      if (promptList.length > 0) {
        if (seqIndex < promptList.length) {
          itemPrompt = promptList[seqIndex];
        } else if (i < promptList.length) {
          itemPrompt = promptList[i];
        }
      }

      if (!itemPrompt) {
        itemPrompt = (typeof promptListOrSingle === 'string' && !promptListOrSingle.includes('\n') && promptListOrSingle.trim())
          ? promptListOrSingle.trim()
          : settings.defaultPrompt;
      }

      const id = 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const previewUrl = URL.createObjectURL(file);

      const item = {
        id,
        file,
        name: file.name,
        size: formatBytes(file.size),
        previewUrl,
        prompt: itemPrompt,
        status: 'QUEUED',
        progressText: 'Queued',
        videoUrl: null,
        error: null,
        addedAt: Date.now()
      };

      queue.push(item);
      addedItems.push(item);
    }

    log('info', `Added ${addedItems.length} image(s) to queue with sequential prompts.`);
    emitQueueUpdate();
    return addedItems;
  }

  // Apply a list of prompts sequentially to queued items starting from the first queued image (#1 -> prompt 1, #2 -> prompt 2...)
  function applyBulkPrompts(promptList) {
    let list = [];
    if (Array.isArray(promptList)) {
      list = promptList;
    } else if (typeof promptList === 'string') {
      list = promptList.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }

    if (list.length === 0) return 0;

    let applied = 0;
    let promptIndex = 0;

    // Apply strictly starting from index 0 of all QUEUED items
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === 'QUEUED') {
        if (promptIndex < list.length) {
          queue[i].prompt = list[promptIndex];
          promptIndex++;
          applied++;
        }
      }
    }

    log('info', `✓ Attached ${applied} prompt(s) sequentially starting from image #1.`);
    emitQueueUpdate();
    return applied;
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function removeItem(id) {
    const idx = queue.findIndex(q => q.id === id);
    if (idx !== -1) {
      const item = queue[idx];
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      queue.splice(idx, 1);
      log('info', `Removed "${item.name}" from queue.`);
      emitQueueUpdate();
    }
  }

  function clearCompleted() {
    queue = queue.filter(q => q.status === 'QUEUED' || ['UPLOADING', 'GENERATING', 'DOWNLOADING'].includes(q.status));
    emitQueueUpdate();
  }

  function clearAll() {
    if (isProcessing) {
      stop();
    }
    queue.forEach(q => { if (q.previewUrl) URL.revokeObjectURL(q.previewUrl); });
    queue = [];
    log('info', 'Queue cleared.');
    emitQueueUpdate();
  }

  function retryItem(id) {
    const item = queue.find(q => q.id === id);
    if (item) {
      item.status = 'QUEUED';
      item.error = null;
      item.progressText = 'Queued';
      consecutiveServerErrors = 0;
      log('info', `Re-queued "${item.name}".`);
      emitQueueUpdate();
    }
  }

  function retryAllFailed() {
    let count = 0;
    queue.forEach(item => {
      if (item.status === 'FAILED') {
        item.status = 'QUEUED';
        item.error = null;
        item.progressText = 'Queued';
        count++;
      }
    });
    if (count > 0) {
      consecutiveServerErrors = 0;
      log('info', `Re-queued ${count} failed image(s) for retry.`);
      emitQueueUpdate();
    }
    return count;
  }

  function updateItemPrompt(id, newPrompt) {
    const item = queue.find(q => q.id === id);
    if (item && item.status === 'QUEUED') {
      item.prompt = newPrompt;
      emitQueueUpdate();
    }
  }

  async function start() {
    if (isProcessing) {
      if (isPaused) {
        isPaused = false;
        log('info', 'Automation resumed.');
        emitQueueUpdate();
      }
      return;
    }

    const pending = queue.filter(q => q.status === 'QUEUED');
    if (pending.length === 0) {
      log('warn', 'No queued images to process.');
      return;
    }

    log('info', 'Verifying WhatsApp Web bridge connection...');
    await ensureBridgeConnected();

    isProcessing = true;
    isPaused = false;
    shouldStop = false;
    log('info', `Starting bulk generation for ${pending.length} item(s)...`);
    emitQueueUpdate();

    processQueueLoop();
  }

  function pause() {
    if (isProcessing && !isPaused) {
      isPaused = true;
      log('warn', 'Automation paused. Will hold after current step.');
      emitQueueUpdate();
    }
  }

  function resume() {
    if (isProcessing && isPaused) {
      isPaused = false;
      log('info', 'Automation resumed.');
      emitQueueUpdate();
    }
  }

  function stop() {
    shouldStop = true;
    isProcessing = false;
    isPaused = false;
    currentActiveId = null;
    cooldownRemaining = 0;
    log('warn', 'Automation stopped.');
    emitQueueUpdate();
  }

  async function processQueueLoop() {
    while (isProcessing && !shouldStop) {
      while (isPaused && !shouldStop) {
        await WhatsAppDOM.sleep(500);
      }
      if (shouldStop) break;

      const item = queue.find(q => q.status === 'QUEUED');
      if (!item) {
        log('info', '🎉 All items in queue have been processed!');
        break;
      }

      currentActiveId = item.id;
      emitQueueUpdate();

      try {
        await processSingleItem(item);
        consecutiveServerErrors = 0;
      } catch (err) {
        console.error('[QueueManager] Item processing failed:', err);
        item.status = 'FAILED';
        item.error = err.message || 'Unknown error occurred';
        item.progressText = 'Skipped: ' + item.error;

        // Detect Meta AI backend server outage / downtime
        const errMsgLower = (item.error || '').toLowerCase();
        const isServerOutage = errMsgLower.includes('imagine api') || 
                               errMsgLower.includes('video server') || 
                               errMsgLower.includes('still down') || 
                               errMsgLower.includes('online yet') || 
                               errMsgLower.includes('server is down') || 
                               errMsgLower.includes('servers are down') || 
                               errMsgLower.includes('temporarily unavailable') || 
                               errMsgLower.includes('service is unavailable');

        if (isServerOutage) {
          consecutiveServerErrors++;
          log('warn', `🚨 Meta AI Server Outage: "${item.error}". Image "${item.name}" marked for retry.`);
        } else {
          consecutiveServerErrors = 0;
          log('warn', `⚠️ Skipping "${item.name}" (${item.error}). Moving to next image in queue...`);
        }

        emitQueueUpdate();

        // Close any lingering modal or attach menu so next image can proceed cleanly!
        try {
          await WhatsAppDOM.closeMediaPreviewIfOpen();
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
          await WhatsAppDOM.sleep(600);
          WhatsAppDOM.scrollToBottom();
        } catch (cleanErr) {}

        // Auto-pause if 2 consecutive images fail due to Meta AI server outage
        if (consecutiveServerErrors >= 2) {
          isPaused = true;
          log('warn', `⏸️ Meta AI Video Server is currently DOWN/OFFLINE ("Imagine API video generation failed"). Automation automatically PAUSED to protect remaining images. Once Meta servers recover, click "Resume" or "Retry Failed"!`);
          emitQueueUpdate();
        }
      }

      currentActiveId = null;
      emitQueueUpdate();

      if (shouldStop) break;

      const remaining = queue.filter(q => q.status === 'QUEUED');
      if (remaining.length > 0 && settings.cooldownDelay > 0) {
        log('info', `Waiting ${settings.cooldownDelay}s cooldown before uploading next image (${remaining.length} remaining in queue)...`);
        for (let s = settings.cooldownDelay; s > 0; s--) {
          if (shouldStop || isPaused) break;
          cooldownRemaining = s;
          emitQueueUpdate();
          await WhatsAppDOM.sleep(1000);
        }
        cooldownRemaining = 0;
        emitQueueUpdate();
      }
    }

    isProcessing = false;
    currentActiveId = null;
    cooldownRemaining = 0;
    emitQueueUpdate();
  }

  // Convert File to Base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Open Media Preview, enter prompt into caption box, and send via MAIN world bridge
  function sendMediaViaPreviewBridge(item) {
    return new Promise(async (resolve, reject) => {
      try {
        const base64Data = await fileToBase64(item.file);

        const timeoutId = setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Media Preview upload timed out after 35s.'));
        }, 35000);

        function handler(event) {
          if (event.source !== window || !event.data) return;
          if (event.data.type === 'MAI_MEDIA_PREVIEW_SENT' && event.data.jobId === item.id) {
            clearTimeout(timeoutId);
            window.removeEventListener('message', handler);
            if (event.data.success) {
              resolve(event.data);
            } else {
              reject(new Error(event.data.error || 'Failed to upload and send from Media Preview.'));
            }
          }
        }

        window.addEventListener('message', handler);
        window.postMessage({
          type: 'MAI_OPEN_AND_SEND_MEDIA',
          jobId: item.id,
          base64Data,
          filename: item.name,
          prompt: item.prompt
        }, '*');

      } catch (err) {
        reject(err);
      }
    });
  }

  // Wait for video from direct backend bridge
  function waitForVideoFromBridge(jobId, timeoutMs) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, timeoutMs);

      function handler(event) {
        if (event.source !== window || !event.data) return;
        if (event.data.type === 'MAI_VIDEO_RECEIVED' && event.data.jobId === jobId) {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve({
            success: true,
            base64Data: event.data.videoDataUrl,
            videoUrl: null
          });
        }
      }

      window.addEventListener('message', handler);
    });
  }

  // Single Item Flow
  async function processSingleItem(item) {
    log('info', `🚀 Processing "${item.name}" with prompt: "${item.prompt}"`);

    // Ensure Meta AI Chat is Active
    const chatInfo = WhatsAppDOM.getActiveChatInfo();
    if (!chatInfo.isMetaAI) {
      log('info', 'Switching to Meta AI chat...');
      await WhatsAppDOM.openMetaAIChat();
      await WhatsAppDOM.sleep(1000);
    }

    const sendTimestamp = Date.now();

    // Snapshot existing messages before sending to guarantee absolute job isolation
    const knownOutgoingIds = new Set(
      Array.from(document.querySelectorAll('div.message-out, div[class*="message-out"]'))
        .map(m => m.getAttribute('data-id') || m)
    );
    const knownIncomingIds = new Set(
      Array.from(document.querySelectorAll('div.message-in, div[class*="message-in"]'))
        .map(m => m.getAttribute('data-id') || m)
    );

    item.status = 'UPLOADING';
    item.progressText = 'Opening Media Preview & Caption Box...';
    emitQueueUpdate();

    // ==========================================
    // Visual DOM Media Preview Upload (Shows Preview & Caption Box)
    // ==========================================
    log('info', `Opening Media Preview with image & caption "${item.prompt}"...`);

    let uploadRes = null;
    try {
      uploadRes = await sendMediaViaPreviewBridge(item);
    } catch (bridgeErr) {
      console.warn('[QueueManager] Bridge upload notice:', bridgeErr);
      log('warn', `Bridge notice: ${bridgeErr.message}. Trying DOM fallback...`);
      await WhatsAppDOM.injectImageFile(item.file);
      uploadRes = await WhatsAppDOM.setCaptionAndSend(item.prompt);
    }

    if (uploadRes && uploadRes.captionInserted) {
      log('info', `✓ Image with prompt "${item.prompt}" verified in caption box and sent!`);
    } else {
      log('info', `✓ Image sent from preview with prompt.`);
    }

    // Wait for the new outgoing message in chat to establish anchor
    const sentAnchorEl = await WhatsAppDOM.waitForNewOutgoingMessage(knownOutgoingIds, 25000);
    log('info', 'Image sent confirmed! Now waiting for Meta AI to generate video (this normally takes 30-90 seconds)...');

    // 4. Wait for Meta AI Video Generation
    item.status = 'GENERATING';
    item.progressText = 'Meta AI is generating video...';
    emitQueueUpdate();

    if (settings.autoScroll) {
      WhatsAppDOM.scrollToBottom();
    }

    const videoResult = await WhatsAppDOM.waitForMetaAIVideo(
      sentAnchorEl,
      item.id,
      sendTimestamp,
      knownIncomingIds,
      (progress) => {
        item.progressText = progress.status;
        emitQueueUpdate();
      },
      settings.timeoutLimit * 1000
    );

    if (!videoResult || (!videoResult.videoUrl && !videoResult.base64Data)) {
      throw new Error('Timed out waiting for Meta AI video generation.');
    }

    // 5. Download Video
    item.status = 'DOWNLOADING';
    item.progressText = 'Downloading generated video...';
    item.videoUrl = videoResult.videoUrl;
    emitQueueUpdate();

    if (settings.autoDownload) {
      // Clean base name without extension while preserving timestamp flags and identifiers
      const originalBase = (item.name || 'image').replace(/\.[^/.]+$/, '').trim();
      const safeOriginalName = originalBase.replace(/[/\\?%*:|"<>]/g, '_');

      const safePromptName = (item.prompt || '')
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 60)
        .trim();

      let baseDownloadName = safeOriginalName;
      if (settings.filenameScheme === 'prompt' && safePromptName) {
        baseDownloadName = safePromptName;
      } else if (settings.filenameScheme === 'image_prompt' && safePromptName) {
        baseDownloadName = `${safeOriginalName}_${safePromptName}`;
      } else {
        // 'original' (default): Exactly preserves the original image filename and any timestamp flag!
        baseDownloadName = safeOriginalName;
      }

      const prefix = settings.filenamePrefix ? settings.filenamePrefix.trim() : '';
      const filename = `${prefix}${baseDownloadName}.mp4`;

      log('info', `Triggering download: ${filename}`);

      if (chrome.runtime && chrome.runtime.sendMessage) {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'DOWNLOAD_VIDEO',
            url: videoResult.videoUrl,
            base64Data: videoResult.base64Data,
            filename
          }, (response) => {
            if (response && response.success) {
              log('info', `Download started successfully (ID: ${response.downloadId})`);
            } else {
              log('warn', `Download notice: ${response?.error || 'Download completed'}`);
            }
            resolve();
          });
        });
      }
    }

    // 6. Complete
    item.status = 'COMPLETED';
    item.progressText = 'Video generated & saved! ✓';
    log('info', `✓ Successfully finished "${item.name}"!`);
    emitQueueUpdate();

    if (settings.autoScroll) {
      WhatsAppDOM.scrollToBottom();
    }
  }

  loadSettings();

  return {
    getQueue: () => [...queue],
    getSettings,
    updateSettings,
    addFiles,
    applyBulkPrompts,
    removeItem,
    retryItem,
    retryAllFailed,
    updateItemPrompt,
    clearCompleted,
    clearAll,
    start,
    pause,
    resume,
    stop,
    onQueueUpdate,
    onLog
  };
})();
