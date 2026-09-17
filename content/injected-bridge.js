// Injected Bridge Script (Runs in MAIN World context with full page DOM & native browser APIs)
// Directly drives WhatsApp Web's native Media Preview, Caption Box & Send Button

(function () {
  'use strict';

  console.log('[MetaAI Bridge] Injected into MAIN world successfully.');

  let activeJobId = null;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convert blob to PNG if necessary for ClipboardItem compatibility
  async function ensurePngBlob(blob) {
    if (blob.type === 'image/png') return blob;
    try {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 800;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      return new Promise(res => canvas.toBlob(res, 'image/png'));
    } catch (e) {
      console.warn('[MetaAI Bridge] PNG conversion fallback notice:', e);
      return blob;
    }
  }

  // Check if WhatsApp Web Media Preview modal is currently open and visible
  function isMediaPreviewOpen() {
    // 1. Caption input container
    const caption = document.querySelector('div[data-testid="media-caption-input-container"], [data-testid="media-caption-input-container"]');
    if (caption && caption.offsetParent !== null) return true;

    // 2. Media editor canvas
    const canvas = document.querySelector('div[data-testid="media-editor-canvas"], [data-testid="media-editor-canvas"]');
    if (canvas && canvas.offsetParent !== null) return true;

    // 3. Media editor toolbar buttons
    const cropBtn = document.querySelector('div[data-testid="crop-rotate-button"], div[data-testid="filter-button"], button[aria-label="Crop and rotate"]');
    if (cropBtn && cropBtn.offsetParent !== null) return true;

    // 4. Send button outside #main footer
    const sendBtn = findMediaSendButton();
    if (sendBtn && sendBtn.offsetParent !== null) return true;

    return false;
  }

  // Find the Send button specifically in Media Preview (outside #main footer)
  function findMediaSendButton() {
    const sendIcons = Array.from(document.querySelectorAll(
      'span[data-icon="send-ai-filled"], ' +
      'span[data-testid="send-ai-filled"], ' +
      '[data-icon="send-ai-filled"], ' +
      '[data-testid="send-ai-filled"], ' +
      'span[data-icon="send"], ' +
      'span[data-icon="send-light"], ' +
      'span[data-icon*="send" i], ' +
      '[data-testid="send"]'
    )).filter(icon => !icon.closest('#main footer') && !icon.closest('#mai-overlay-root'));

    for (let i = sendIcons.length - 1; i >= 0; i--) {
      const icon = sendIcons[i];
      const btn = icon.closest('button') || icon.closest('div[role="button"]') || icon;
      if (btn && btn.offsetParent !== null) {
        return btn;
      }
    }

    // Circular button at bottom right (outside footer)
    const allButtons = Array.from(document.querySelectorAll('div[role="button"], button'));
    for (let i = allButtons.length - 1; i >= 0; i--) {
      const el = allButtons[i];
      if (el.closest('#mai-overlay-root') || el.closest('#main footer')) continue;
      if (el.offsetParent !== null) {
        const rect = el.getBoundingClientRect();
        if (rect.right >= window.innerWidth - 130 && rect.bottom >= window.innerHeight - 130) {
          if (rect.width >= 30 && rect.width <= 90 && rect.height >= 30 && rect.height <= 90) {
            return el;
          }
        }
      }
    }

    return null;
  }

  // Insert prompt into caption container in Media Preview without duplication
  async function insertCaptionText(container, promptText) {
    if (!container) return false;

    console.log('[MetaAI Bridge] Inserting caption into:', container, 'Prompt:', promptText);

    container.scrollIntoView({ block: 'nearest' });
    container.focus();
    container.click();
    await sleep(80);

    const p = container.querySelector('p') || container;
    p.focus();
    p.click();
    await sleep(80);

    const target = promptText.trim();
    const isExactMatch = () => (container.textContent || '').trim() === target;

    // If already exactly matching, do not type again!
    if (isExactMatch()) {
      console.log('[MetaAI Bridge] Caption already matches prompt exactly:', container.textContent);
      return true;
    }

    // Step 1: Cleanly wipe out any existing text (or duplicate text)
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(p);
      sel.removeAllRanges();
      sel.addRange(range);

      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
    } catch (e) {
      console.warn('[MetaAI Bridge] Clear notice:', e);
    }
    await sleep(60);

    // Step 2: Method 1 - Native execCommand('insertText')
    // In Chromium, execCommand('insertText') fires native beforeinput & input events directly into Lexical.
    try {
      document.execCommand('insertText', false, target);
    } catch (e) {
      console.warn('[MetaAI Bridge] execCommand notice:', e);
    }
    await sleep(150);

    // If Method 1 succeeded and text matches exactly, DO NOT fire any more events!
    if (isExactMatch()) {
      console.log('[MetaAI Bridge] Method 1 (execCommand) cleanly inserted single caption:', container.textContent);
      const placeholder = container.parentElement?.querySelector('div[aria-hidden="true"]');
      if (placeholder) placeholder.style.display = 'none';
      return true;
    }

    // Step 3: Method 2 (Fallback only) - If text is still completely empty
    const current = (container.textContent || '').trim();
    if (!current.includes(target)) {
      console.log('[MetaAI Bridge] Trying fallback beforeinput...');
      try {
        p.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: target
        }));
      } catch (e) {}

      await sleep(150);
      if (isExactMatch()) {
        const placeholder = container.parentElement?.querySelector('div[aria-hidden="true"]');
        if (placeholder) placeholder.style.display = 'none';
        return true;
      }
    }

    // Step 4: Anti-duplicate Safeguard
    // If container text ended up doubled (e.g. "animateanimate"), clean it!
    const afterCheck = (container.textContent || '').trim();
    if (afterCheck === target + target || (afterCheck.length > target.length && afterCheck.startsWith(target))) {
      console.warn('[MetaAI Bridge] Detected duplicate caption (' + afterCheck + '), wiping and re-inserting once...');
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(p);
        sel.removeAllRanges();
        sel.addRange(range);

        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await sleep(50);
        document.execCommand('insertText', false, target);
      } catch (e) {}
      await sleep(100);
    }

    // Hide placeholder text overlay if present
    const placeholder = container.parentElement?.querySelector('div[aria-hidden="true"]');
    if (placeholder) {
      placeholder.style.display = 'none';
    }

    container.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

    const verified = (container.textContent || '').trim().includes(target);
    console.log('[MetaAI Bridge] Caption verification status:', verified, 'Content:', container.textContent);
    return verified;
  }

  // End-to-end Media Preview opener, captioner, and sender
  async function handleOpenAndSendMedia(jobId, base64Data, filename, promptText) {
    activeJobId = jobId;
    console.log('[MetaAI Bridge] handleOpenAndSendMedia started for:', filename, 'Prompt:', promptText);

    try {
      // Step 0: Close any lingering old preview
      if (isMediaPreviewOpen()) {
        console.log('[MetaAI Bridge] Lingering preview found, closing...');
        const closeBtn = document.querySelector('button[aria-label="Close"], span[data-icon="ic-close"], span[data-icon="x"], [data-testid="ic-close"]');
        if (closeBtn) {
          closeBtn.closest('button')?.click();
          await sleep(600);
        }
      }

      // Step 1: Create native File & DataTransfer in MAIN world
      const res = await fetch(base64Data);
      const rawBlob = await res.blob();
      const pngBlob = await ensurePngBlob(rawBlob);
      const file = new File([pngBlob], filename || 'photo.png', { type: 'image/png' });

      const dt = new DataTransfer();
      dt.items.add(file);

      let previewOpened = false;

      // =========================================================================
      // Strategy 1: System Clipboard Write & Trusted Paste
      // Writes the real image to the OS clipboard, then triggers paste on composer
      // =========================================================================
      try {
        console.log('[MetaAI Bridge] Strategy 1: Writing image to system clipboard...');
        if (navigator.clipboard && navigator.clipboard.write) {
          const item = new ClipboardItem({ 'image/png': pngBlob });
          await navigator.clipboard.write([item]);
          console.log('[MetaAI Bridge] Image written to system clipboard successfully!');

          const composer = document.querySelector('#main footer div[contenteditable="true"]');
          if (composer) {
            composer.focus();
            composer.click();
            await sleep(150);

            // Trigger paste command
            try {
              document.execCommand('paste');
            } catch (e) {}

            // Also dispatch ClipboardEvent with clipboardData
            const pasteEvt = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              composed: true
            });
            Object.defineProperty(pasteEvt, 'clipboardData', {
              value: dt,
              writable: false,
              configurable: true
            });

            const reactKey = Object.keys(composer).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
            if (reactKey && composer[reactKey] && typeof composer[reactKey].onPaste === 'function') {
              try {
                composer[reactKey].onPaste(pasteEvt);
              } catch (e) {}
            }

            composer.dispatchEvent(pasteEvt);
            document.querySelector('#main')?.dispatchEvent(pasteEvt);
            document.dispatchEvent(pasteEvt);

            const startWait = Date.now();
            while (Date.now() - startWait < 2500) {
              if (isMediaPreviewOpen()) {
                previewOpened = true;
                console.log('[MetaAI Bridge] Strategy 1 (Clipboard Paste) SUCCEEDED! Preview is open.');
                break;
              }
              await sleep(200);
            }
          }
        }
      } catch (err1) {
        console.warn('[MetaAI Bridge] Strategy 1 notice:', err1);
      }

      // =========================================================================
      // Strategy 2: Attach Menu -> "Photos & videos" File Input
      // =========================================================================
      if (!previewOpened) {
        try {
          console.log('[MetaAI Bridge] Strategy 2: Attach Menu File Input...');
          
          let attachBtn = document.querySelector(
            '#main footer span[data-testid="ic-attach-file"], ' +
            '#main footer span[data-icon="ic-attach-file"], ' +
            '#main footer [data-icon="ic-attach-file"], ' +
            '#main footer span[data-icon="plus"], ' +
            '#main footer button[title="Attach"], ' +
            '#main footer div[role="button"][title="Attach"]'
          );
          attachBtn = attachBtn?.closest('button') || attachBtn?.closest('div[role="button"]') || attachBtn;

          let fileInput = document.querySelector('input[type="file"][accept*="image"]');
          if (!fileInput && attachBtn) {
            console.log('[MetaAI Bridge] Clicking attach button once to open popup menu...');
            attachBtn.focus();
            attachBtn.click();
            
            const startPoll = Date.now();
            while (Date.now() - startPoll < 2500) {
              fileInput = document.querySelector('input[type="file"][accept*="image"]') ||
                          document.querySelector('input[type="file"][accept*="video"]') ||
                          document.querySelector('input[type="file"]');
              if (fileInput) break;
              await sleep(150);
            }
          }

          if (fileInput) {
            console.log('[MetaAI Bridge] Found fileInput, assigning files:', fileInput);

            try {
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set;
              if (nativeSetter) {
                nativeSetter.call(fileInput, dt.files);
              } else {
                fileInput.files = dt.files;
              }
            } catch (e) {
              fileInput.files = dt.files;
            }

            // Clear React value tracker so change is detected
            if (fileInput._valueTracker) {
              try {
                fileInput._valueTracker.setValue('');
              } catch (e) {}
            }

            // Call React onChange directly
            let el = fileInput;
            while (el && el !== document.body) {
              const reactKey = Object.keys(el).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
              if (reactKey && el[reactKey] && typeof el[reactKey].onChange === 'function') {
                try {
                  el[reactKey].onChange({
                    target: fileInput,
                    currentTarget: fileInput,
                    bubbles: true,
                    defaultPrevented: false,
                    nativeEvent: new Event('change')
                  });
                } catch (e) {}
              }
              el = el.parentElement;
            }

            fileInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            fileInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

            const startWait = Date.now();
            while (Date.now() - startWait < 3000) {
              if (isMediaPreviewOpen()) {
                previewOpened = true;
                console.log('[MetaAI Bridge] Strategy 2 (Attach Menu) SUCCEEDED! Preview is open.');
                break;
              }
              await sleep(200);
            }
          }
        } catch (err2) {
          console.warn('[MetaAI Bridge] Strategy 2 notice:', err2);
        }
      }

      // =========================================================================
      // Strategy 3: Native Drag & Drop Event
      // =========================================================================
      if (!previewOpened) {
        try {
          console.log('[MetaAI Bridge] Strategy 3: Drag & Drop...');
          const dropEvt = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            composed: true
          });
          Object.defineProperty(dropEvt, 'dataTransfer', {
            value: dt,
            writable: false,
            configurable: true
          });

          const mainPanel = document.querySelector('#main') || document.body;
          mainPanel.dispatchEvent(new DragEvent('dragenter', { bubbles: true, composed: true, dataTransfer: dt }));
          await sleep(60);
          mainPanel.dispatchEvent(new DragEvent('dragover', { bubbles: true, composed: true, dataTransfer: dt }));
          await sleep(60);
          mainPanel.dispatchEvent(dropEvt);

          const startWait = Date.now();
          while (Date.now() - startWait < 3000) {
            if (isMediaPreviewOpen()) {
              previewOpened = true;
              console.log('[MetaAI Bridge] Strategy 3 (Drag & Drop) SUCCEEDED! Preview is open.');
              break;
            }
            await sleep(200);
          }
        } catch (err3) {
          console.warn('[MetaAI Bridge] Strategy 3 notice:', err3);
        }
      }

      if (!previewOpened && !isMediaPreviewOpen()) {
        throw new Error('Media preview screen did not open after all upload strategies.');
      }

      console.log('[MetaAI Bridge] ✓ Media preview is OPEN on screen! Finding caption input...');

      // =========================================================================
      // Step 2: Locate Media Caption Input & Insert Prompt
      // =========================================================================
      let captionContainer = null;
      const startCaptionFind = Date.now();
      while (Date.now() - startCaptionFind < 7000) {
        captionContainer = document.querySelector(
          'div[data-testid="media-caption-input-container"], ' +
          '[data-testid="media-caption-input-container"]'
        );
        if (captionContainer && captionContainer.offsetParent !== null) break;
        await sleep(200);
      }

      if (!captionContainer) {
        throw new Error('Caption input box (media-caption-input-container) was not found in Media Preview.');
      }

      console.log('[MetaAI Bridge] Typing prompt into caption box:', promptText);
      let textEntered = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        textEntered = await insertCaptionText(captionContainer, promptText);
        if (textEntered) break;
        await sleep(250);
      }

      // Settle Lexical state
      await sleep(400);

      // =========================================================================
      // Step 3: Locate Media Preview Send Button & Click
      // =========================================================================
      const sendBtn = findMediaSendButton();
      if (sendBtn) {
        console.log('[MetaAI Bridge] Clicking Media Send Button:', sendBtn);
        sendBtn.focus();
        sendBtn.click();
        sendBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      } else {
        console.warn('[MetaAI Bridge] Send button not found, pressing Enter on caption container...');
        captionContainer.focus();
        captionContainer.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        }));
      }

      // =========================================================================
      // Step 4: Wait for Media Preview to Close
      // =========================================================================
      const startClose = Date.now();
      let closed = false;
      while (Date.now() - startClose < 10000) {
        if (!isMediaPreviewOpen()) {
          closed = true;
          break;
        }
        await sleep(250);
      }

      console.log('[MetaAI Bridge] Media preview closed status:', closed);

      window.postMessage({
        type: 'MAI_MEDIA_PREVIEW_SENT',
        jobId,
        success: true,
        captionInserted: textEntered
      }, '*');

    } catch (err) {
      console.error('[MetaAI Bridge] handleOpenAndSendMedia failed:', err);
      try {
        const closeBtn = document.querySelector('button[aria-label="Close"], span[data-icon="ic-close"], span[data-icon="x"], [data-testid="ic-close"]');
        if (closeBtn) closeBtn.closest('button')?.click();
      } catch (e) {}
      window.postMessage({
        type: 'MAI_MEDIA_PREVIEW_SENT',
        jobId,
        success: false,
        error: err.message || 'Media preview upload error'
      }, '*');
    }
  }

  // Handle messages from Extension Content Script (queue-manager)
  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data || !event.data.type) return;

    // Ping check
    if (event.data.type === 'MAI_PING') {
      window.postMessage({
        type: 'MAI_PONG',
        timestamp: Date.now()
      }, '*');
      return;
    }

    if (event.data.type === 'MAI_OPEN_AND_SEND_MEDIA') {
      const { jobId, base64Data, filename, prompt } = event.data;
      await handleOpenAndSendMedia(jobId, base64Data, filename, prompt);
      return;
    }
  });

  // Announce bridge readiness immediately
  window.postMessage({ type: 'MAI_BRIDGE_READY' }, '*');
})();
