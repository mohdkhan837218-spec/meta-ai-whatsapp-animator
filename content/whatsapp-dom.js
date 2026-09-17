// WhatsApp Web DOM Selectors & Automation Helpers
// Resilient multi-strategy automation specifically tailored for Meta AI chat

window.WhatsAppDOM = (function () {
  'use strict';

  const SELECTORS = {
    // Chat containers
    mainPanel: '#main',
    chatHistory: '#main [data-testid="conversation-panel-messages"], #main .copyable-area > div[tabindex="-1"], #main div[role="application"]',
    headerTitle: '#main header .copyable-text span[title], #main header span[dir="auto"], #main header span[title]',
    
    // Attach buttons in footer
    attachButton: [
      '#main footer span[data-icon="ic-attach-file"]',
      '#main footer span[data-testid="ic-attach-file"]',
      '#main footer [data-icon="ic-attach-file"]',
      '#main footer [data-testid="ic-attach-file"]',
      'span[data-icon="ic-attach-file"]',
      'span[data-testid="ic-attach-file"]',
      '#main footer span[data-icon="plus"]',
      '#main footer span[data-icon="attach-menu-plus"]',
      '#main footer span[data-icon="clip"]',
      '#main footer span[data-icon="attach-clip"]',
      '#main footer button[title="Attach"]',
      '#main footer button[aria-label="Attach"]',
      '#main footer div[role="button"][title="Attach"]',
      '#main footer div[role="button"][aria-label="Attach"]'
    ],
    fileInput: 'input[type="file"][accept*="image"], input[type="file"][accept*="video"], input[type="file"]',
    
    // Normal footer composer
    composerInput: '#main footer div[contenteditable="true"][role="textbox"], #main footer div[contenteditable="true"]',
    composerSendButton: [
      '#main footer span[data-icon="send-ai-filled"]',
      '#main footer span[data-testid="send-ai-filled"]',
      '#main footer [data-icon="send-ai-filled"]',
      '#main footer [data-testid="send-ai-filled"]',
      '#main footer span[data-icon="send"]',
      '#main footer [data-testid="send"]',
      '#main footer button[aria-label="Send"]',
      '#main footer button[title="Send"]',
      '#main footer div[role="button"][aria-label="Send"]',
      'span[data-icon="send-ai-filled"]',
      'span[data-testid="send-ai-filled"]'
    ].join(', '),
    
    // Messages
    messageIn: 'div.message-in, div[data-testid="msg-container"]:has(div[class*="message-in"])',
    messageOut: 'div.message-out, div[data-testid="msg-container"]:has(div[class*="message-out"])',
    videoElement: 'video, div[data-testid="video-player"], div[data-icon="media-play"]',
    downloadButton: 'span[data-icon="download"], span[data-icon="media-download"], button[aria-label="Download"]',
    downContextMenu: 'span[data-icon="down-context"], span[data-icon="menu"], div[role="button"][aria-label*="Menu"]'
  };

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isElementVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // 1. Check if WhatsApp Web is loaded
  function isWhatsAppReady() {
    return Boolean(document.querySelector('#app') && (document.querySelector('#main') || document.querySelector('#side')));
  }

  // 2. Check if current open chat is Meta AI
  function getActiveChatInfo() {
    const headerTitleEl = document.querySelector(SELECTORS.headerTitle);
    const title = headerTitleEl ? (headerTitleEl.getAttribute('title') || headerTitleEl.textContent || '').trim() : '';
    const isMetaAI = title.toLowerCase().includes('meta ai');
    return {
      isOpen: Boolean(document.querySelector(SELECTORS.mainPanel)),
      title: title || 'Unknown',
      isMetaAI
    };
  }

  // 3. Try to click Meta AI in sidebar if not active
  async function openMetaAIChat() {
    const active = getActiveChatInfo();
    if (active.isMetaAI) return true;

    // Search for Meta AI in the chat list
    const chatCells = document.querySelectorAll('div[data-testid="cell-frame-container"], div[role="listitem"]');
    for (const cell of chatCells) {
      const titleEl = cell.querySelector('span[title*="Meta AI" i], span[dir="auto"]');
      if (titleEl && titleEl.textContent.toLowerCase().includes('meta ai')) {
        cell.click();
        await sleep(1500);
        return getActiveChatInfo().isMetaAI;
      }
    }
    return false;
  }

  // 4. Media Preview Detection - Bulletproof detection matching WhatsApp Web Media Editor
  function isMediaPreviewOpen() {
    // Check 1: Exact testids from user's inspected Media Editor preview (MUST be visible on screen)
    const previewSelectors = [
      '[data-testid="media-caption-input-container"]',
      '[data-testid="media-editor-canvas"]',
      '[data-testid="crop-rotate-button"]',
      '[data-testid="media-editor-copy-button"]',
      '[data-testid="filter-button"]',
      '[data-testid="paint-button"]',
      '[data-testid="shape-button"]',
      '[data-testid="blur-button"]',
      'div[role="button"][title*="media caption" i]'
    ];

    for (const sel of previewSelectors) {
      const el = document.querySelector(sel);
      if (el && isElementVisible(el)) {
        return true;
      }
    }

    // Check 2: Top toolbar icons in media editor
    const toolbarIcon = document.querySelector(
      'span[data-icon="crop"], span[data-icon="ic-crop"], ' +
      'span[data-icon="pen"], span[data-icon="ic-pen"], ' +
      'span[data-icon="text"], span[data-icon="ic-text"], ' +
      'span[data-icon="sticker"], span[data-icon="ic-sticker"], ' +
      'span[data-icon="hd"], span[data-icon="ic-hd"], ' +
      'span[data-icon="x"], span[data-icon="x-alt"], span[data-icon="ic-close"], span[data-icon="close"], ' +
      'span[data-testid="x"], span[data-testid="x-alt"], span[data-testid="ic-close"]'
    );
    if (toolbarIcon && isElementVisible(toolbarIcon) && !toolbarIcon.closest('#mai-overlay-root')) {
      return true;
    }

    // Check 3: Thumbnail strip at the bottom
    const thumbnail = document.querySelector('img[src*="blob:"]');
    if (thumbnail && isElementVisible(thumbnail) && !thumbnail.closest('#mai-overlay-root')) {
      const rect = thumbnail.getBoundingClientRect();
      if (rect.top > window.innerHeight / 2) {
        return true;
      }
    }

    // Check 4: Send button outside normal footer
    const sendBtn = findMediaSendButton();
    if (sendBtn && isElementVisible(sendBtn)) {
      const composer = document.querySelector(SELECTORS.composerInput);
      if (!composer || !isElementVisible(composer) || !sendBtn.closest('#main footer')) {
        return true;
      }
    }

    return false;
  }

  // Find the exact caption input container specifically belonging to WhatsApp Web Media Preview
  function findMediaCaptionInput() {
    // Priority 1: Exact testid from inspected DOM
    // <div contenteditable="true" data-testid="media-caption-input-container" data-lexical-editor="true">
    const exactContainer = document.querySelector('div[data-testid="media-caption-input-container"], [data-testid="media-caption-input-container"]');
    if (exactContainer && isElementVisible(exactContainer)) {
      return exactContainer;
    }

    // Priority 2: Element adjacent to the "Open emojis panel, media caption" button
    const captionEmojiBtn = document.querySelector('div[role="button"][title*="caption" i], div[role="button"][aria-label*="caption" i]');
    if (captionEmojiBtn) {
      const parentRow = captionEmojiBtn.closest('div.x1c4vz4f')?.parentElement || captionEmojiBtn.parentElement;
      if (parentRow) {
        const editable = parentRow.querySelector('[contenteditable="true"]');
        if (editable && isElementVisible(editable)) {
          return editable;
        }
      }
    }

    // Priority 3: Lexical editor outside #main footer and #mai-overlay-root
    const lexicalEditors = Array.from(document.querySelectorAll('div[data-lexical-editor="true"][contenteditable="true"]'))
      .filter(el => !el.closest('#main footer') && !el.closest('#mai-overlay-root'));
    if (lexicalEditors.length > 0) {
      return lexicalEditors[lexicalEditors.length - 1];
    }

    // Priority 4: Tag-agnostic search for caption testids or labels outside #main footer
    const captionMatches = Array.from(document.querySelectorAll(
      '[data-testid*="caption" i], ' +
      '[aria-label*="caption" i], ' +
      '[placeholder*="caption" i]'
    )).filter(el => !el.closest('#mai-overlay-root') && !el.closest('#main footer'));

    for (const el of captionMatches) {
      if (isElementVisible(el)) {
        return el.matches('[contenteditable="true"], input, textarea') ? el : (el.querySelector('[contenteditable="true"]') || el);
      }
    }

    return null;
  }

  // Find the paragraph <p> inside the caption container
  function findCaptionParagraph() {
    const container = findMediaCaptionInput();
    if (container) {
      const p = container.querySelector('p');
      if (p) return p;
      return container;
    }
    return null;
  }

  // Unified, battle-tested Lexical text injection for WhatsApp Web Media Preview
  async function insertTextIntoLexicalParagraph(p, text) {
    const container = p.closest('[contenteditable="true"]') || p.parentElement || p;
    return insertCaptionText(container, text);
  }

  async function insertTextIntoEditable(el, text) {
    const container = el.closest('[contenteditable="true"]') || el;
    return insertCaptionText(container, text);
  }

  // Robust multi-tier caption insertion into Meta's Lexical contenteditable
  async function insertCaptionText(container, text) {
    if (!container) return false;

    console.log('[MetaAI Animator DOM] insertCaptionText targeting:', container, 'Prompt:', text);

    // 1. Scroll and focus container
    container.scrollIntoView({ block: 'nearest' });
    container.focus();
    container.click();
    await sleep(80);

    let p = container.querySelector('p');
    if (!p) {
      p = container;
    }
    p.focus();
    p.click();
    await sleep(80);

    const target = text.trim();
    const isExact = () => (container.textContent || '').trim() === target;
    const isPresent = () => (container.textContent || '').trim().includes(target);

    // If already exactly matching, do not re-insert!
    if (isExact()) {
      console.log('[MetaAI Animator DOM] Caption already cleanly matches:', container.textContent);
      return true;
    }

    function notifyEvents() {
      try {
        container.dispatchEvent(new Event('input', { bubbles: true }));
        container.dispatchEvent(new Event('change', { bubbles: true }));
        container.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
        if (p && p !== container) {
          p.dispatchEvent(new Event('input', { bubbles: true }));
          p.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (e) {}
    }

    // Method 1: Range selection inside <p> + document.execCommand('insertText')
    // In Chromium, execCommand('insertText') fires native, trusted beforeinput & input events!
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(p);
      sel.removeAllRanges();
      sel.addRange(range);

      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, target);
    } catch (e) {
      console.warn('[MetaAI Animator DOM] Method 1 execCommand notice:', e);
    }
    await sleep(150);
    if (isExact()) {
      notifyEvents();
      console.log('[MetaAI Animator DOM] Method 1 (execCommand) verified clean single caption text:', container.textContent);
      return true;
    }

    // Method 2: Synthetic ClipboardEvent('paste') - Lexical PASTE_COMMAND hook
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const pasteEvt = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData: dt
      });
      container.dispatchEvent(pasteEvt);
      p.dispatchEvent(pasteEvt);
    } catch (e) {
      console.warn('[MetaAI Animator DOM] Method 2 paste notice:', e);
    }
    await sleep(120);
    if (isPresent()) {
      notifyEvents();
      console.log('[MetaAI Animator DOM] Method 2 (ClipboardEvent paste) verified caption text:', container.textContent);
      return true;
    }

    // Method 3: React Props direct invocation (onPaste / onBeforeInput / onInput)
    try {
      const reactKey = Object.keys(container).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
      if (reactKey && container[reactKey]) {
        const props = container[reactKey];
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const pasteEvt = new ClipboardEvent('paste', { bubbles: true, cancelable: true, composed: true, clipboardData: dt });

        if (typeof props.onPaste === 'function') props.onPaste(pasteEvt);
        if (typeof props.onBeforeInput === 'function') {
          props.onBeforeInput({
            data: text,
            inputType: 'insertText',
            preventDefault: () => {},
            stopPropagation: () => {},
            isDefaultPrevented: () => false
          });
        }
        if (typeof props.onInput === 'function') {
          props.onInput({ target: container, currentTarget: container, bubbles: true, data: text });
        }
      }
    } catch (e) {
      console.warn('[MetaAI Animator DOM] Method 3 React Props notice:', e);
    }
    await sleep(120);
    if (isPresent()) {
      notifyEvents();
      console.log('[MetaAI Animator DOM] Method 3 (React Props) verified caption text:', container.textContent);
      return true;
    }

    // Method 4: Synthetic InputEvents beforeinput + input
    try {
      container.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: text
      }));
      container.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: text
      }));
    } catch (e) {}
    await sleep(120);
    if (isPresent()) {
      notifyEvents();
      console.log('[MetaAI Animator DOM] Method 4 (InputEvents) verified caption text:', container.textContent);
      return true;
    }

    // Method 5: Direct Lexical DOM node injection fallback
    try {
      const br = p.querySelector('br');
      if (br) br.remove();

      let span = p.querySelector('span[data-lexical-text="true"]');
      if (!span) {
        span = document.createElement('span');
        span.className = 'selectable-text copyable-text';
        span.setAttribute('data-lexical-text', 'true');
        p.appendChild(span);
      }
      span.textContent = text;

      // Hide placeholder overlay if present
      const placeholder = container.parentElement?.querySelector('div[aria-hidden="true"]');
      if (placeholder) {
        placeholder.style.display = 'none';
      }

      notifyEvents();
    } catch (e) {
      console.warn('[MetaAI Animator DOM] Method 5 DOM fallback notice:', e);
    }
    await sleep(120);
    return isPresent();
  }

  // Find the Send button specifically belonging to the Media Preview (Outside #main footer)
  function findMediaSendButton() {
    // 1. Send button in media preview (send-ai-filled, send, send-light) explicitly OUTSIDE #main footer
    const sendIcons = Array.from(document.querySelectorAll(
      'span[data-icon="send-ai-filled"], ' +
      'span[data-testid="send-ai-filled"], ' +
      '[data-icon="send-ai-filled"], ' +
      '[data-testid="send-ai-filled"], ' +
      'span[data-icon="send"], ' +
      'span[data-icon="send-light"], ' +
      'span[data-icon*="send" i], ' +
      '[data-testid="send"], ' +
      '[data-testid*="send" i]'
    )).filter(icon => !icon.closest('#main footer') && !icon.closest('#mai-overlay-root'));

    for (let i = sendIcons.length - 1; i >= 0; i--) {
      const icon = sendIcons[i];
      const btn = icon.closest('button') || icon.closest('div[role="button"]') || icon;
      if (isElementVisible(btn)) {
        return btn;
      }
    }

    // 2. Direct search by aria-label="Send" outside #main footer
    const ariaSend = Array.from(document.querySelectorAll(
      'button[aria-label="Send"], ' +
      'div[role="button"][aria-label="Send"], ' +
      'button[title="Send"], ' +
      'div[role="button"][title="Send"]'
    )).filter(btn => !btn.closest('#main footer') && !btn.closest('#mai-overlay-root'));

    for (let i = ariaSend.length - 1; i >= 0; i--) {
      const btn = ariaSend[i];
      if (isElementVisible(btn)) {
        return btn;
      }
    }

    // 3. Geometric search: Circular green button at bottom-right corner of screen (outside footer)
    const allClickables = Array.from(document.querySelectorAll('div[role="button"], button'));
    for (let i = allClickables.length - 1; i >= 0; i--) {
      const el = allClickables[i];
      if (el.closest('#mai-overlay-root') || el.closest('#main footer')) continue;
      if (isElementVisible(el)) {
        const rect = el.getBoundingClientRect();
        // WhatsApp's green circular send button is always within 120px from bottom and right
        if (rect.right >= window.innerWidth - 120 && rect.bottom >= window.innerHeight - 120) {
          if (rect.width >= 35 && rect.width <= 90 && rect.height >= 35 && rect.height <= 90) {
            return el;
          }
        }
      }
    }

    return null;
  }

  // Wait for Media Preview to appear
  async function waitForMediaPreview(timeoutMs = 12000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (isMediaPreviewOpen()) {
        return true;
      }
      await sleep(200);
    }
    return false;
  }

  // Wait for Media Preview to close
  async function waitForMediaPreviewToClose(timeoutMs = 8000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (!isMediaPreviewOpen()) {
        return true;
      }
      await sleep(250);
    }
    return false;
  }

  // 5. Inject an image file into WhatsApp Web
  async function injectImageFile(file) {
    const mainPanel = document.querySelector(SELECTORS.mainPanel);
    if (!mainPanel) {
      throw new Error('WhatsApp chat (#main) is not active. Please open a chat first.');
    }

    console.log('[MetaAI Animator DOM] Starting image injection for:', file.name, 'Size:', file.size);

    // If an old media preview is lingering on screen, close it first so we upload THIS image cleanly
    if (isMediaPreviewOpen()) {
      console.log('[MetaAI Animator DOM] Lingering preview found. Closing it to upload new image...');
      const closeBtn = document.querySelector('button[aria-label="Close"], span[data-icon="ic-close"], span[data-icon="x"], span[data-icon="close"], [data-testid="ic-close"]');
      if (closeBtn && isElementVisible(closeBtn)) {
        closeBtn.click();
        await sleep(600);
      }
    }

    // ==========================================
    // Strategy 1: Attach Menu -> "Photos & videos" Input (Primary)
    // ==========================================
    try {
      console.log('[MetaAI Animator DOM] Strategy 1: Triggering Attach Menu...');
      const attached = await triggerAttachMenuInput(file);
      if (attached) {
        const previewOpened = await waitForMediaPreview(10000);
        if (previewOpened) {
          console.log('[MetaAI Animator DOM] Strategy 1 (Attach Menu) succeeded! Media preview is open.');
          return true;
        }
      }
    } catch (e) {
      console.warn('[MetaAI Animator DOM] Strategy 1 failed:', e);
    }

    // ==========================================
    // Strategy 2: Clipboard Paste Event
    // ==========================================
    try {
      console.log('[MetaAI Animator DOM] Strategy 2: Triggering Clipboard Paste...');
      const pasted = await simulatePasteFile(file);
      if (pasted) {
        const previewOpened = await waitForMediaPreview(6000);
        if (previewOpened) {
          console.log('[MetaAI Animator DOM] Strategy 2 (Paste) succeeded! Media preview is open.');
          return true;
        }
      }
    } catch (e) {
      console.warn('[MetaAI Animator DOM] Strategy 2 failed:', e);
    }

    // ==========================================
    // Strategy 3: Drag & Drop Event
    // ==========================================
    try {
      console.log('[MetaAI Animator DOM] Strategy 3: Triggering Drag & Drop...');
      const dropped = await simulateFileDrop(mainPanel, file);
      if (dropped) {
        const previewOpened = await waitForMediaPreview(6000);
        if (previewOpened) {
          console.log('[MetaAI Animator DOM] Strategy 3 (Drag & Drop) succeeded! Media preview is open.');
          return true;
        }
      }
    } catch (e) {
      console.warn('[MetaAI Animator DOM] Strategy 3 failed:', e);
    }

    // Check if media preview opened after all strategies
    if (isMediaPreviewOpen()) {
      return true;
    }

    throw new Error('Could not attach image to WhatsApp. Media preview did not open. Please make sure Meta AI chat is active and try again.');
  }

  // Helper Strategy 1: Attach menu -> File input
  async function triggerAttachMenuInput(file) {
    // 1. Locate the Attach Button (Paperclip or Plus icon in footer)
    let attachBtn = null;
    for (const sel of SELECTORS.attachButton) {
      const el = document.querySelector(sel);
      if (el && isElementVisible(el) && !el.closest('#mai-overlay-root')) {
        attachBtn = el.closest('button') || el.closest('div[role="button"]') || el;
        break;
      }
    }

    if (!attachBtn) {
      const composer = document.querySelector(SELECTORS.composerInput);
      if (composer) {
        const composerRect = composer.getBoundingClientRect();
        const footerButtons = Array.from(document.querySelectorAll('#main footer button, #main footer div[role="button"]'));
        const leftButtons = footerButtons.filter(b => {
          if (b.closest('#mai-overlay-root')) return false;
          const r = b.getBoundingClientRect();
          return r.left < composerRect.left && r.width > 0 && r.height > 0;
        });
        if (leftButtons.length > 0) {
          attachBtn = leftButtons[0];
        }
      }
    }

    // 2. Check if attach popup menu is already open, if not click attach button ONCE
    const isMenuOpen = Boolean(
      document.querySelector('input[type="file"][accept*="image"]') ||
      document.querySelector('span[data-icon="attach-image"], span[data-icon="image"], span[data-icon="photos"], span[data-icon="ic-attach-image"]') ||
      attachBtn?.getAttribute('aria-expanded') === 'true'
    );
    if (!isMenuOpen) {
      console.log('[MetaAI Animator DOM] Clicking attach button once to open menu:', attachBtn);
      attachBtn.focus();
      attachBtn.click();
      await sleep(400);
    }

    // 3. Poll for the active "Photos & videos" input[type="file"]
    let fileInput = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      // Look inside popup menu items first
      const menuItems = Array.from(document.querySelectorAll('li, div[role="button"], button'));
      for (const item of menuItems) {
        if (item.closest('#mai-overlay-root') || item.closest('#main header')) continue;
        const text = (item.textContent || '').toLowerCase();
        const icon = item.querySelector('span[data-icon*="photo" i], span[data-icon*="image" i], span[data-icon="image"], span[data-icon="photos"], span[data-icon="attach-image"]');
        if (icon || text.includes('photos') || text.includes('photos & videos') || text.includes('fotos') || text.includes('gallery')) {
          const inp = item.querySelector('input[type="file"]');
          if (inp) {
            fileInput = inp;
            break;
          }
        }
      }

      // Look for input with accept attribute containing image/video
      if (!fileInput) {
        const allFileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
        fileInput = allFileInputs.find(inp => {
          const acc = (inp.getAttribute('accept') || '').toLowerCase();
          return acc.includes('image') || acc.includes('video');
        });
      }

      if (fileInput) break;
      await sleep(150);
    }

    // Fallback: any file input currently in DOM
    if (!fileInput) {
      fileInput = document.querySelector('input[type="file"][accept*="image"]') ||
                  document.querySelector('input[type="file"][accept*="video"]') ||
                  document.querySelector('input[type="file"]');
    }

    if (!fileInput) {
      console.warn('[MetaAI Animator DOM] input[type="file"] not found in attach menu.');
      return false;
    }

    console.log('[MetaAI Animator DOM] Setting file onto file input:', fileInput);

    const dt = new DataTransfer();
    dt.items.add(file);

    try {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files').set;
      nativeSetter.call(fileInput, dt.files);
    } catch (e) {
      fileInput.files = dt.files;
    }

    // Call React's internal onChange if available
    const reactKey = Object.keys(fileInput).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
    if (reactKey && fileInput[reactKey] && typeof fileInput[reactKey].onChange === 'function') {
      try {
        fileInput[reactKey].onChange({
          target: fileInput,
          currentTarget: fileInput,
          bubbles: true,
          preventDefault: () => {},
          stopPropagation: () => {}
        });
      } catch (err) {
        console.warn('[MetaAI Animator DOM] Direct React onChange notice:', err);
      }
    }

    fileInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    return true;
  }

  // Helper Strategy 2: Simulate Clipboard Paste
  async function simulatePasteFile(file) {
    const composer = document.querySelector(SELECTORS.composerInput);
    if (!composer) return false;

    composer.focus();
    await sleep(100);

    const dt = new DataTransfer();
    dt.items.add(file);

    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      composed: true
    });

    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: dt,
      writable: false,
      configurable: true
    });

    const reactKey = Object.keys(composer).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
    if (reactKey && composer[reactKey] && typeof composer[reactKey].onPaste === 'function') {
      try {
        composer[reactKey].onPaste(pasteEvent);
      } catch (err) {
        console.warn('[MetaAI Animator DOM] Direct React onPaste notice:', err);
      }
    }

    composer.dispatchEvent(pasteEvent);
    document.dispatchEvent(pasteEvent);
    return true;
  }

  // Helper Strategy 3: Simulate Drag & Drop
  async function simulateFileDrop(targetEl, file) {
    const dt = new DataTransfer();
    dt.items.add(file);

    function createDragEvent(type) {
      const event = new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true
      });
      Object.defineProperty(event, 'dataTransfer', {
        value: dt,
        writable: false,
        configurable: true
      });
      return event;
    }

    const targets = [
      targetEl,
      document.querySelector(SELECTORS.chatHistory) || targetEl,
      document.body
    ];

    for (const t of targets) {
      if (t) {
        t.dispatchEvent(createDragEvent('dragenter'));
        await sleep(50);
        t.dispatchEvent(createDragEvent('dragover'));
        await sleep(50);
        t.dispatchEvent(createDragEvent('drop'));
      }
    }

    return true;
  }

  // 6. Enter prompt in Media Preview caption box and click Send
  async function setCaptionAndSend(promptText = 'animate') {
    console.log('[MetaAI Animator DOM] setCaptionAndSend executing with prompt:', promptText);

    let captionContainer = null;

    // 1. Wait up to 8 seconds for Media Preview Caption Input to be present and visible
    const startFind = Date.now();
    while (Date.now() - startFind < 8000) {
      captionContainer = findMediaCaptionInput();
      if (captionContainer && isElementVisible(captionContainer)) {
        console.log('[MetaAI Animator DOM] Found Media Caption Container:', captionContainer);
        break;
      }
      await sleep(250);
    }

    let captionInserted = false;

    // 2. Insert prompt into caption container and verify presence
    if (captionContainer) {
      for (let attempt = 1; attempt <= 4; attempt++) {
        console.log(`[MetaAI Animator DOM] Inserting caption attempt #${attempt}...`);
        captionInserted = await insertCaptionText(captionContainer, promptText);
        if (captionInserted) {
          console.log('[MetaAI Animator DOM] ✓ Caption text verified inside container:', captionContainer.textContent);
          break;
        }
        await sleep(300);
      }
    } else {
      console.warn('[MetaAI Animator DOM] Media preview caption container was not found before sending!');
    }

    // Give React and Lexical state 400ms to register
    await sleep(400);

    // 3. Locate Media Preview Send Button (Prioritize outside #main footer)
    const sendBtn = findMediaSendButton();
    if (sendBtn) {
      console.log('[MetaAI Animator DOM] Clicking Media Preview Send Button:', sendBtn);
      const clickable = sendBtn.closest('button') || sendBtn.closest('div[role="button"]') || sendBtn;
      clickable.focus();
      clickable.click();
      clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      await sleep(800);
    } else if (captionContainer) {
      console.warn('[MetaAI Animator DOM] Send button not found, triggering Enter on caption container...');
      captionContainer.focus();
      captionContainer.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));
      await sleep(800);
    } else {
      throw new Error('Cannot send: Neither Send button nor Caption container was found in Media Preview.');
    }

    // 4. Wait for Media Preview to close
    const previewClosed = await waitForMediaPreviewToClose(8000);
    if (!previewClosed) {
      // Last-resort fallback: click any round green button in the bottom right corner outside footer
      const allButtons = Array.from(document.querySelectorAll('div[role="button"], button'));
      for (let i = allButtons.length - 1; i >= 0; i--) {
        const btn = allButtons[i];
        if (btn.closest('#mai-overlay-root') || btn.closest('#main footer')) continue;
        const rect = btn.getBoundingClientRect();
        if (rect.right >= window.innerWidth - 120 && rect.bottom >= window.innerHeight - 120) {
          btn.focus();
          btn.click();
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          await sleep(1000);
          break;
        }
      }
    }

    console.log('[MetaAI Animator DOM] Image sent successfully from media preview! captionInserted:', captionInserted);
    return {
      captionInserted
    };
  }

  // 7. Send text message in normal chat (used if caption wasn't inserted in preview)
  async function sendChatMessage(text) {
    const composer = document.querySelector(SELECTORS.composerInput);
    if (!composer) return false;

    console.log('[MetaAI Animator DOM] Sending follow-up chat message:', text);
    composer.focus();
    await sleep(150);

    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, text);

    composer.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));
    await sleep(300);

    const sendBtn = document.querySelector(SELECTORS.composerSendButton);
    if (sendBtn) {
      const clickable = sendBtn.closest('button') || sendBtn.closest('div[role="button"]') || sendBtn;
      clickable.click();
    } else {
      composer.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));
    }
    await sleep(1000);
    return true;
  }

  // 8. Wait for New Outgoing Message to appear (Confirming image upload & send)
  async function waitForNewOutgoingMessage(knownOutgoingIdsOrCount, timeoutMs = 25000) {
    const startTime = Date.now();
    console.log('[MetaAI Animator DOM] Waiting for newly sent image message in chat...');

    const isSet = knownOutgoingIdsOrCount instanceof Set;
    const prevCount = typeof knownOutgoingIdsOrCount === 'number' ? knownOutgoingIdsOrCount : 0;

    while (Date.now() - startTime < timeoutMs) {
      const outMessages = Array.from(document.querySelectorAll('div.message-out, div[class*="message-out"]'));

      if (isSet) {
        for (let i = outMessages.length - 1; i >= 0; i--) {
          const msg = outMessages[i];
          const id = msg.getAttribute('data-id') || msg;
          if (!knownOutgoingIdsOrCount.has(id)) {
            console.log('[MetaAI Animator DOM] Outgoing image message confirmed by ID difference!', msg);
            msg.dataset.maiSentAnchor = 'true';
            return msg;
          }
        }
      } else if (outMessages.length > prevCount) {
        const latestOut = outMessages[outMessages.length - 1];
        console.log('[MetaAI Animator DOM] Outgoing image message confirmed by count!', latestOut);
        latestOut.dataset.maiSentAnchor = 'true';
        return latestOut;
      }

      await sleep(500);
    }

    // Check count increase if Set was used but WhatsApp didn't assign unique data-id yet
    if (isSet) {
      const currentOut = Array.from(document.querySelectorAll('div.message-out, div[class*="message-out"]'));
      if (currentOut.length > knownOutgoingIdsOrCount.size) {
        const latest = currentOut[currentOut.length - 1];
        latest.dataset.maiSentAnchor = 'true';
        return latest;
      }
    }

    // IMPORTANT: Do NOT return a stale past message! Return null.
    console.warn('[MetaAI Animator DOM] Notice: Could not isolate outgoing message element within timeout.');
    return null;
  }

  // Close any lingering Media Preview or modal if open
  async function closeMediaPreviewIfOpen() {
    try {
      const closeBtn = document.querySelector(
        'button[aria-label="Close"], ' +
        'span[data-icon="ic-close"], ' +
        'span[data-icon="x"], ' +
        '[data-testid="ic-close"]'
      );
      if (closeBtn) {
        console.log('[MetaAI Animator DOM] Closing lingering media preview...');
        const btn = closeBtn.closest('button') || closeBtn;
        btn.click();
        await sleep(500);
      }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      await sleep(200);
    } catch (e) {}
  }

  // Check if Meta AI sent an error, refusal, or generation failure message AFTER anchor
  function checkMetaAIErrorAfterAnchor(sentAnchorEl, sendTimestamp, knownIncomingIds) {
    const chatContainer = document.querySelector(SELECTORS.chatHistory) || document.querySelector(SELECTORS.mainPanel);
    if (!chatContainer) return null;

    const incomingMessages = Array.from(chatContainer.querySelectorAll('div.message-in, div[class*="message-in"]'));
    if (!incomingMessages.length) return null;

    // Filter incoming messages strictly AFTER sentAnchorEl (or after sendTimestamp and not in knownIncomingIds)
    const subsequentIncoming = incomingMessages.filter(msg => {
      // If already consumed by an earlier job, ignore
      if (msg.dataset.maiConsumed === 'true') return false;

      if (sentAnchorEl) {
        const relation = sentAnchorEl.compareDocumentPosition(msg);
        return Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING);
      } else if (knownIncomingIds && knownIncomingIds instanceof Set) {
        const id = msg.getAttribute('data-id') || msg;
        return !knownIncomingIds.has(id);
      }
      return false;
    });

    for (let i = subsequentIncoming.length - 1; i >= 0; i--) {
      const msg = subsequentIncoming[i];

      // If message contains a video element or video player, it's NOT an error!
      if (msg.querySelector('video, div[data-testid="video-player"], div[data-icon="media-play"]')) {
        continue;
      }

      const text = (msg.textContent || '').trim();
      if (!text) continue;
      const lower = text.toLowerCase();

      // Common refusal and failure phrases returned by Meta AI
      const refusalKeywords = [
        "can't create a video",
        "cannot create a video",
        "can't create video",
        "cannot create video",
        "can't animate",
        "cannot animate",
        "couldn't animate",
        "unable to animate",
        "unable to create",
        "unable to generate",
        "couldn't generate",
        "couldn't create",
        "cannot generate",
        "can't generate",
        "something went wrong",
        "generation failed",
        "imagine api",
        "video server",
        "still down",
        "hasn't come back online",
        "haven't come back online",
        "server hasn't come back",
        "server is down",
        "servers are down",
        "server down",
        "server load",
        "server overload",
        "high demand",
        "temporarily unavailable",
        "service is unavailable",
        "come back online",
        "moment the service is back",
        "please try again",
        "try another image",
        "try again later",
        "violates our",
        "community guidelines",
        "safety policy",
        "i am unable to",
        "i'm unable to",
        "video nahi bana sakta",
        "error generating"
      ];

      for (const kw of refusalKeywords) {
        if (lower.includes(kw)) {
          return text.length > 90 ? text.substring(0, 90) + '...' : text;
        }
      }
    }

    return null;
  }

  // 9. Watch for Meta AI Video Generation Response (STRICTLY AFTER sentAnchorEl)
  async function waitForMetaAIVideo(sentAnchorEl, jobId, sendTimestamp, knownIncomingIds, onProgress, timeoutMs = 180000) {
    const startTime = Date.now();
    const totalSec = Math.round(timeoutMs / 1000);
    console.log('[MetaAI Animator DOM] Watching for Meta AI video reply AFTER anchor message. Total timeout:', totalSec, 's');
    let lastLogTime = startTime;
    let lastScrollTime = startTime;

    while (Date.now() - startTime < timeoutMs) {
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);

      // Keep chat scrolled to bottom so newest incoming messages render in DOM
      if (Date.now() - lastScrollTime > 3500) {
        lastScrollTime = Date.now();
        scrollToBottom();
      }

      if (Date.now() - lastLogTime > 1500) {
        lastLogTime = Date.now();
        if (typeof onProgress === 'function') {
          onProgress({ elapsedSec, status: `⏳ Meta AI is generating video... (${elapsedSec}s / ${totalSec}s)` });
        }
      }

      // Check 1: Did Meta AI send an error or refusal text instead of a video?
      const metaError = checkMetaAIErrorAfterAnchor(sentAnchorEl, sendTimestamp, knownIncomingIds);
      if (metaError) {
        console.warn('[MetaAI Animator DOM] Meta AI refusal/error message detected:', metaError);
        throw new Error(`Meta AI error: "${metaError}"`);
      }

      // Guard: Meta AI video generation takes minimum 10-15 seconds in real world.
      // Don't check for completed video until at least 10s elapsed to prevent any race condition with older chat nodes.
      if (elapsedSec >= 10) {
        const videoResult = await findGeneratedVideoAfterAnchor(sentAnchorEl, jobId, sendTimestamp, knownIncomingIds);
        if (videoResult) {
          console.log('[MetaAI Animator DOM] Real Meta AI Video confirmed & ready!', videoResult);
          if (typeof onProgress === 'function') {
            onProgress({ elapsedSec, status: '✓ Video generated! Preparing download...' });
          }
          await sleep(1500);
          return videoResult;
        }
      }

      await sleep(1500);
    }

    throw new Error(`Timeout: Video not generated by Meta AI within ${totalSec}s.`);
  }

  // Helper: Find newly generated video that is strictly AFTER sentAnchorEl in DOM
  async function findGeneratedVideoAfterAnchor(sentAnchorEl, jobId, sendTimestamp, knownIncomingIds) {
    const chatContainer = document.querySelector(SELECTORS.chatHistory) || document.querySelector(SELECTORS.mainPanel);
    if (!chatContainer) return null;

    const incomingMessages = Array.from(chatContainer.querySelectorAll('div.message-in, div[class*="message-in"]'));
    if (!incomingMessages.length) return null;

    // Filter incoming messages that come AFTER sentAnchorEl
    const subsequentIncoming = incomingMessages.filter(msg => {
      // Must not have been consumed by earlier jobs!
      if (msg.dataset.maiConsumed === 'true') return false;

      if (sentAnchorEl) {
        const relation = sentAnchorEl.compareDocumentPosition(msg);
        return Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING);
      } else if (knownIncomingIds && knownIncomingIds instanceof Set) {
        const id = msg.getAttribute('data-id') || msg;
        return !knownIncomingIds.has(id);
      }
      return false;
    });

    if (!subsequentIncoming.length) return null;

    for (let i = subsequentIncoming.length - 1; i >= 0; i--) {
      const msg = subsequentIncoming[i];

      // Check for video element or video container
      let videoEl = msg.querySelector('video');
      const videoPlayer = msg.querySelector('div[data-testid="video-player"], div[data-icon="media-play"], span[data-icon="media-play"], span[data-icon="video-play"]');
      const downloadBtn = msg.querySelector(SELECTORS.downloadButton);

      // If it has a download button or video player but video element isn't attached yet, click to load
      if (!videoEl && (downloadBtn || videoPlayer)) {
        const clickTarget = downloadBtn || videoPlayer;
        console.log('[MetaAI Animator DOM] Video media container found, clicking to load stream...');
        try { clickTarget.click(); } catch (e) {}
        await sleep(1500);
        videoEl = msg.querySelector('video');
      }

      // If we have a video element
      if (videoEl) {
        let videoSrc = videoEl.src || '';
        if (!videoSrc) {
          const source = videoEl.querySelector('source');
          if (source) videoSrc = source.src || '';
        }

        // Check if video is loaded with a valid blob: or http(s): URL
        const isValidSrc = videoSrc && (videoSrc.startsWith('blob:') || videoSrc.startsWith('http'));

        // Wait if video element exists but src is still buffering/empty
        if (!isValidSrc) {
          console.log('[MetaAI Animator DOM] Video element detected but buffering/empty src. Waiting...');
          continue;
        }

        let base64Data = null;
        if (isValidSrc) {
          base64Data = await fetchBlobAsDataUrl(videoSrc).catch(() => null);
        }

        // Only return if we have a valid playable src or fetched blob data!
        if (isValidSrc || base64Data) {
          // Mark this message element as CONSUMED for this specific jobId so it can never be reused
          msg.dataset.maiConsumed = 'true';
          msg.dataset.maiJobId = jobId || 'completed';

          return {
            success: true,
            videoUrl: videoSrc,
            base64Data,
            messageEl: msg
          };
        }
      }
    }

    return null;
  }

  async function fetchBlobAsDataUrl(blobUrl) {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('[MetaAI Animator DOM] Could not fetch blob URL directly:', e);
      return null;
    }
  }

  function scrollToBottom() {
    const chatContainer = document.querySelector(SELECTORS.chatHistory) || document.querySelector(SELECTORS.mainPanel);
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  return {
    SELECTORS,
    sleep,
    isWhatsAppReady,
    getActiveChatInfo,
    openMetaAIChat,
    isMediaPreviewOpen,
    findMediaCaptionInput,
    findMediaSendButton,
    injectImageFile,
    waitForMediaPreview,
    waitForMediaPreviewToClose,
    setCaptionAndSend,
    sendChatMessage,
    waitForNewOutgoingMessage,
    waitForMetaAIVideo,
    closeMediaPreviewIfOpen,
    scrollToBottom
  };
})();
