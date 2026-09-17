// UI Overlay for WhatsApp Web - Floating Bulk Meta AI Animator Dashboard

window.UIOverlay = (function () {
  'use strict';

  let currentTab = 'queue'; // 'queue' | 'settings' | 'logs'
  let isPanelVisible = false;

  function init() {
    if (document.getElementById('mai-overlay-root')) return;

    const root = document.createElement('div');
    root.id = 'mai-overlay-root';
    document.body.appendChild(root);

    injectLauncherPill(root);
    injectDashboardModal(root);
    bindEvents();
    subscribeQueueManager();
  }

  // 1. Floating Launcher Pill
  function injectLauncherPill(root) {
    const pill = document.createElement('div');
    pill.id = 'mai-launcher-pill';
    pill.innerHTML = `
      <div class="mai-pill-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
        </svg>
      </div>
      <span class="mai-pill-title">MetaMotion Pro</span>
      <span class="mai-pill-badge" id="mai-pill-count">0</span>
    `;
    (root || document.body).appendChild(pill);
  }

  // 2. Main Floating Modal
  function injectDashboardModal(root) {
    const modal = document.createElement('div');
    modal.id = 'mai-panel-modal';
    modal.className = 'mai-hidden';
    modal.innerHTML = `
      <!-- Header -->
      <div class="mai-header">
        <div class="mai-header-brand">
          <div class="mai-header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          <div>
            <h3 class="mai-header-title">MetaMotion Pro</h3>
            <p class="mai-header-subtitle">WhatsApp AI Bulk Video Studio</p>
          </div>
        </div>
        <div class="mai-header-actions">
          <button class="mai-icon-btn" id="mai-btn-minimize" title="Minimize">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13H5v-2h14v2z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="mai-nav-tabs">
        <button class="mai-nav-tab active" data-tab="queue">Queue (<span id="mai-tab-count">0</span>)</button>
        <button class="mai-nav-tab" data-tab="settings">Settings</button>
        <button class="mai-nav-tab" data-tab="logs">Live Logs</button>
      </div>

      <!-- Tab 1: Queue -->
      <div class="mai-body" id="mai-tab-content-queue">
        <!-- Dropzone -->
        <div class="mai-dropzone" id="mai-dropzone">
          <input type="file" id="mai-file-input" accept="image/*" multiple style="display:none;" />
          <div class="mai-dropzone-icon">📁</div>
          <div class="mai-dropzone-title">Drag & Drop Multiple Images Here</div>
          <div class="mai-dropzone-subtitle">or click to browse photos from your computer</div>
        </div>

        <!-- Global Prompt Box -->
        <div class="mai-section-box">
          <label class="mai-input-label">Default Prompt / Caption</label>
          <input type="text" id="mai-global-prompt" class="mai-text-input" value="animate" placeholder="e.g. animate" />
          <div class="mai-chips-row">
            <span class="mai-chip" data-prompt="animate">⚡ animate</span>
            <span class="mai-chip" data-prompt="create video of this">🎬 create video</span>
            <span class="mai-chip" data-prompt="cinematic 3D slow motion motion">🌟 3D cinematic</span>
            <span class="mai-chip" data-prompt="turn into lively animated video">✨ lively motion</span>
          </div>
        </div>

        <!-- Bulk Prompts Box (Sequential Matching) -->
        <div class="mai-section-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <label class="mai-input-label" style="margin-bottom:0; display:flex; align-items:center; gap:6px;">
              <span>📝 Bulk Prompts (Sequential 1-by-1)</span>
              <span class="mai-badge-pill" id="mai-bulk-prompts-count">0 prompts</span>
            </label>
            <div style="display:flex; gap:6px;">
              <input type="file" id="mai-prompts-file-input" accept=".txt,.csv" style="display:none;" />
              <button type="button" class="mai-btn-xs" id="mai-btn-upload-prompts" title="Upload Prompts file (.txt / .csv)">
                📂 Upload .txt
              </button>
              <button type="button" class="mai-btn-xs mai-btn-primary" id="mai-btn-apply-bulk-prompts" title="Map prompts to images in queue">
                ⚡ Apply to Queue
              </button>
            </div>
          </div>
          <textarea id="mai-bulk-prompts-text" class="mai-textarea-input" rows="3" 
            placeholder="Paste prompts here (1 per line) or upload a .txt file...&#10;Line 1 -> Image 1&#10;Line 2 -> Image 2&#10;Line 3 -> Image 3"></textarea>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
            <span style="font-size:11px; color:var(--mai-text-muted);">
              Images automatically match these prompts in sequential order.
            </span>
            <button type="button" class="mai-btn-xs" id="mai-btn-clear-bulk-prompts" style="padding:2px 6px; font-size:10px;">Clear</button>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="mai-action-bar">
          <button class="mai-btn mai-btn-primary" id="mai-btn-start">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            <span id="mai-start-text">Start Bulk Animation</span>
          </button>
          <button class="mai-btn mai-btn-secondary" id="mai-btn-pause" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            Pause
          </button>
          <button class="mai-btn mai-btn-danger" id="mai-btn-stop" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
            Stop
          </button>
          <button class="mai-btn mai-btn-secondary" id="mai-btn-retry-failed" style="display:none;" title="Retry all failed / skipped images">
            🔄 Retry Failed
          </button>
          <button class="mai-btn mai-btn-secondary" id="mai-btn-clear" title="Clear Completed / All">
            Clear
          </button>
        </div>

        <!-- Stats Bar -->
        <div class="mai-stats-row">
          <div class="mai-stat-item">Total: <b id="mai-stat-total">0</b></div>
          <div class="mai-stat-item">Queued: <b id="mai-stat-queued">0</b></div>
          <div class="mai-stat-item">Done: <b id="mai-stat-completed" style="color:var(--mai-success)">0</b></div>
          <div class="mai-stat-item">Failed: <b id="mai-stat-failed" style="color:var(--mai-danger)">0</b></div>
        </div>

        <!-- Queue Item List -->
        <div class="mai-queue-list" id="mai-queue-container">
          <!-- Dynamically populated -->
        </div>
      </div>

      <!-- Tab 2: Settings -->
      <div class="mai-body" id="mai-tab-content-settings" style="display:none;">
        <div class="mai-section-box mai-setting-group">
          <div class="mai-setting-row">
            <div>
              <div class="mai-setting-title">Auto-Download Generated Videos</div>
              <div class="mai-setting-desc">Immediately save generated MP4 videos to your Downloads folder</div>
            </div>
            <input type="checkbox" id="mai-set-autodownload" checked style="width:18px;height:18px;accent-color:var(--mai-primary);" />
          </div>
        </div>

        <div class="mai-section-box mai-setting-group">
          <label class="mai-input-label">Downloaded Video Filename Format</label>
          <select id="mai-set-filenamescheme" class="mai-select-input">
            <option value="original" selected>Original Image Name (e.g. photo1.mp4 - preserves timestamp & flags)</option>
            <option value="prompt">Prompt as Filename (e.g. cinematic_slowmo.mp4)</option>
            <option value="image_prompt">Image Name + Prompt (e.g. photo1_cinematic_slowmo.mp4)</option>
          </select>
          <span class="mai-setting-desc" style="margin-top:4px;">Downloaded video will match the exact image name / prompt name.</span>
        </div>

        <div class="mai-section-box mai-setting-group">
          <label class="mai-input-label">Filename Prefix (Optional)</label>
          <input type="text" id="mai-set-prefix" class="mai-text-input" value="" placeholder="Leave blank for exact name" />
          <span class="mai-setting-desc" style="margin-top:4px;">Optional prefix added before filename (leave empty to keep original file name)</span>
        </div>

        <div class="mai-section-box mai-setting-group">
          <label class="mai-input-label">Cooldown Delay Between Images</label>
          <div class="mai-setting-row">
            <span class="mai-setting-desc">Pause between each generation to avoid Meta AI rate limit</span>
            <b id="mai-delay-display">8s</b>
          </div>
          <input type="range" id="mai-set-delay" min="3" max="30" value="8" style="width:100%;accent-color:var(--mai-primary);margin-top:6px;" />
        </div>

        <div class="mai-section-box mai-setting-group">
          <label class="mai-input-label">Generation Timeout (Seconds)</label>
          <div class="mai-setting-row">
            <span class="mai-setting-desc">Max wait time for Meta AI to send the video</span>
            <b id="mai-timeout-display">120s</b>
          </div>
          <input type="range" id="mai-set-timeout" min="45" max="240" step="15" value="120" style="width:100%;accent-color:var(--mai-primary);margin-top:6px;" />
        </div>

        <div class="mai-section-box mai-setting-group">
          <div class="mai-setting-row">
            <div>
              <div class="mai-setting-title">Auto-Scroll Chat</div>
              <div class="mai-setting-desc">Keep chat scrolled to bottom to reveal newly arriving video messages</div>
            </div>
            <input type="checkbox" id="mai-set-autoscroll" checked style="width:18px;height:18px;accent-color:var(--mai-primary);" />
          </div>
        </div>
      </div>

      <!-- Tab 3: Live Logs -->
      <div class="mai-body" id="mai-tab-content-logs" style="display:none;">
        <div class="mai-logs-container" id="mai-logs-viewer">
          <div class="mai-log-entry mai-log-info">
            <span class="mai-log-time">[${new Date().toLocaleTimeString()}]</span>
            <span>Meta AI WhatsApp Animator Engine Ready.</span>
          </div>
        </div>
      </div>
    `;
    (root || document.body).appendChild(modal);
  }

  // 3. Bind UI Events
  function bindEvents() {
    const pill = document.getElementById('mai-launcher-pill');
    const modal = document.getElementById('mai-panel-modal');
    const btnMinimize = document.getElementById('mai-btn-minimize');

    // Toggle modal
    pill.addEventListener('click', () => {
      isPanelVisible = !isPanelVisible;
      modal.classList.toggle('mai-hidden', !isPanelVisible);
    });

    btnMinimize.addEventListener('click', () => {
      isPanelVisible = false;
      modal.classList.add('mai-hidden');
    });

    // Tab Navigation
    const tabs = modal.querySelectorAll('.mai-nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;

        document.getElementById('mai-tab-content-queue').style.display = currentTab === 'queue' ? 'flex' : 'none';
        document.getElementById('mai-tab-content-settings').style.display = currentTab === 'settings' ? 'flex' : 'none';
        document.getElementById('mai-tab-content-logs').style.display = currentTab === 'logs' ? 'flex' : 'none';
      });
    });

    // File Dropzone
    const dropzone = document.getElementById('mai-dropzone');
    const fileInput = document.getElementById('mai-file-input');

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('mai-dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('mai-dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('mai-dragover');
      if (e.dataTransfer && e.dataTransfer.files.length) {
        handleIncomingFiles(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length) {
        handleIncomingFiles(fileInput.files);
        fileInput.value = '';
      }
    });

    // Prompt Chips
    const promptInput = document.getElementById('mai-global-prompt');
    const chips = modal.querySelectorAll('.mai-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        promptInput.value = chip.dataset.prompt;
      });
    });

    // Control Buttons
    const btnStart = document.getElementById('mai-btn-start');
    const btnPause = document.getElementById('mai-btn-pause');
    const btnStop = document.getElementById('mai-btn-stop');
    const btnClear = document.getElementById('mai-btn-clear');

    btnStart.addEventListener('click', () => {
      QueueManager.start();
    });

    btnPause.addEventListener('click', () => {
      const state = QueueManager.getSettings();
      // Toggle pause/resume
      const isPaused = btnPause.textContent.includes('Resume');
      if (isPaused) {
        QueueManager.resume();
      } else {
        QueueManager.pause();
      }
    });

    btnStop.addEventListener('click', () => {
      QueueManager.stop();
    });

    btnClear.addEventListener('click', () => {
      const queue = QueueManager.getQueue();
      const hasCompleted = queue.some(q => q.status === 'COMPLETED' || q.status === 'FAILED');
      if (hasCompleted) {
        QueueManager.clearCompleted();
      } else {
        if (confirm('Clear all images from the queue?')) {
          QueueManager.clearAll();
        }
      }
    });

    const btnRetryFailed = document.getElementById('mai-btn-retry-failed');
    if (btnRetryFailed) {
      btnRetryFailed.addEventListener('click', () => {
        QueueManager.retryAllFailed();
      });
    }

    // Bulk Prompts Controls
    const bulkPromptsInput = document.getElementById('mai-bulk-prompts-text');
    const bulkPromptsCount = document.getElementById('mai-bulk-prompts-count');
    const btnUploadPrompts = document.getElementById('mai-btn-upload-prompts');
    const promptsFileInput = document.getElementById('mai-prompts-file-input');
    const btnApplyBulkPrompts = document.getElementById('mai-btn-apply-bulk-prompts');
    const btnClearBulkPrompts = document.getElementById('mai-btn-clear-bulk-prompts');

    function updateBulkPromptsBadge() {
      const list = getBulkPromptsList();
      if (bulkPromptsCount) {
        bulkPromptsCount.textContent = `${list.length} prompt${list.length === 1 ? '' : 's'}`;
      }
    }

    function syncAndApplyPrompts() {
      updateBulkPromptsBadge();
      const lines = getBulkPromptsList();
      if (lines.length > 0) {
        QueueManager.applyBulkPrompts(lines);
      }
    }

    if (bulkPromptsInput) {
      bulkPromptsInput.addEventListener('input', syncAndApplyPrompts);
      bulkPromptsInput.addEventListener('change', syncAndApplyPrompts);
      bulkPromptsInput.addEventListener('paste', () => {
        setTimeout(syncAndApplyPrompts, 50);
      });
    }

    if (btnUploadPrompts && promptsFileInput) {
      btnUploadPrompts.addEventListener('click', () => promptsFileInput.click());

      promptsFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          const text = evt.target?.result || '';
          bulkPromptsInput.value = text;
          syncAndApplyPrompts();
          promptsFileInput.value = '';
        };
        reader.readAsText(file);
      });
    }

    if (btnApplyBulkPrompts) {
      btnApplyBulkPrompts.addEventListener('click', () => {
        syncAndApplyPrompts();
      });
    }

    if (btnClearBulkPrompts) {
      btnClearBulkPrompts.addEventListener('click', () => {
        bulkPromptsInput.value = '';
        updateBulkPromptsBadge();
      });
    }

    // Settings bindings
    const setAutoDownload = document.getElementById('mai-set-autodownload');
    const setFilenameScheme = document.getElementById('mai-set-filenamescheme');
    const setPrefix = document.getElementById('mai-set-prefix');
    const setDelay = document.getElementById('mai-set-delay');
    const delayDisplay = document.getElementById('mai-delay-display');
    const setTimeoutEl = document.getElementById('mai-set-timeout');
    const timeoutDisplay = document.getElementById('mai-timeout-display');
    const setAutoScroll = document.getElementById('mai-set-autoscroll');

    setAutoDownload.addEventListener('change', () => {
      QueueManager.updateSettings({ autoDownload: setAutoDownload.checked });
    });

    if (setFilenameScheme) {
      setFilenameScheme.addEventListener('change', () => {
        QueueManager.updateSettings({ filenameScheme: setFilenameScheme.value });
      });
    }

    setPrefix.addEventListener('input', () => {
      QueueManager.updateSettings({ filenamePrefix: setPrefix.value });
    });

    setDelay.addEventListener('input', () => {
      delayDisplay.textContent = setDelay.value + 's';
      QueueManager.updateSettings({ cooldownDelay: parseInt(setDelay.value, 10) });
    });

    setTimeoutEl.addEventListener('input', () => {
      timeoutDisplay.textContent = setTimeoutEl.value + 's';
      QueueManager.updateSettings({ timeoutLimit: parseInt(setTimeoutEl.value, 10) });
    });

    setAutoScroll.addEventListener('change', () => {
      QueueManager.updateSettings({ autoScroll: setAutoScroll.checked });
    });
  }

  function getBulkPromptsList() {
    const textarea = document.getElementById('mai-bulk-prompts-text');
    if (!textarea || !textarea.value.trim()) return [];
    return textarea.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  function handleIncomingFiles(files) {
    const bulkList = getBulkPromptsList();
    if (bulkList.length > 0) {
      QueueManager.addFiles(files, bulkList);
    } else {
      const promptInput = document.getElementById('mai-global-prompt');
      const currentPrompt = promptInput ? promptInput.value : 'animate';
      QueueManager.addFiles(files, currentPrompt);
    }
  }

  // 4. Subscribe to Queue Updates
  function subscribeQueueManager() {
    QueueManager.onQueueUpdate(({ queue, activeId, isProcessing, isPaused, cooldownRemaining, stats, settings }) => {
      // Update counts
      document.getElementById('mai-pill-count').textContent = stats.queued + stats.processing;
      document.getElementById('mai-tab-count').textContent = queue.length;
      document.getElementById('mai-stat-total').textContent = stats.total;
      document.getElementById('mai-stat-queued').textContent = stats.queued;
      document.getElementById('mai-stat-completed').textContent = stats.completed;
      document.getElementById('mai-stat-failed').textContent = stats.failed;

      // Update control buttons
      const btnStart = document.getElementById('mai-btn-start');
      const btnPause = document.getElementById('mai-btn-pause');
      const btnStop = document.getElementById('mai-btn-stop');
      const startText = document.getElementById('mai-start-text');

      if (isProcessing) {
        btnStart.disabled = true;
        btnPause.disabled = false;
        btnStop.disabled = false;
        btnPause.innerHTML = isPaused ? '▶ Resume' : '⏸ Pause';
        if (cooldownRemaining > 0) {
          startText.textContent = `Cooldown (${cooldownRemaining}s)...`;
        } else {
          startText.textContent = 'Processing...';
        }
      } else {
        btnStart.disabled = stats.queued === 0;
        btnPause.disabled = true;
        btnStop.disabled = true;
        btnPause.innerHTML = '⏸ Pause';
        startText.textContent = 'Start Bulk Animation';
      }

      const btnRetryFailed = document.getElementById('mai-btn-retry-failed');
      if (btnRetryFailed) {
        btnRetryFailed.style.display = stats.failed > 0 ? 'inline-flex' : 'none';
      }

      // Sync settings controls if not actively being edited
      if (settings) {
        const setAutoDownload = document.getElementById('mai-set-autodownload');
        const setFilenameScheme = document.getElementById('mai-set-filenamescheme');
        const setPrefix = document.getElementById('mai-set-prefix');
        if (setAutoDownload && document.activeElement !== setAutoDownload) {
          setAutoDownload.checked = !!settings.autoDownload;
        }
        if (setFilenameScheme && document.activeElement !== setFilenameScheme && settings.filenameScheme) {
          setFilenameScheme.value = settings.filenameScheme;
        }
        if (setPrefix && document.activeElement !== setPrefix && settings.filenamePrefix !== undefined) {
          setPrefix.value = settings.filenamePrefix;
        }
      }

      // Render queue items
      renderQueueItems(queue, activeId);
    });

    // Subscribe to Logs
    QueueManager.onLog((entry) => {
      const viewer = document.getElementById('mai-logs-viewer');
      if (!viewer) return;

      const row = document.createElement('div');
      row.className = `mai-log-entry mai-log-${entry.level}`;
      row.innerHTML = `
        <span class="mai-log-time">[${entry.timestamp}]</span>
        <span>${escapeHtml(entry.message)}</span>
      `;
      viewer.appendChild(row);
      viewer.scrollTop = viewer.scrollHeight;
    });
  }

  // Render Queue Items (avoids re-rendering inputs while user is typing)
  function renderQueueItems(queue, activeId) {
    const container = document.getElementById('mai-queue-container');
    if (!container) return;

    if (queue.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--mai-text-muted);font-size:13px;">
          No images in queue yet.<br/>Drag & drop your photos above to get started!
        </div>
      `;
      return;
    }

    // Check existing item cards
    const existingIds = new Set(Array.from(container.children).map(c => c.dataset.id));
    const newIds = new Set(queue.map(q => q.id));

    // Remove deleted elements
    Array.from(container.children).forEach(child => {
      if (!newIds.has(child.dataset.id)) {
        container.removeChild(child);
      }
    });

    // Update or append
    queue.forEach((item, index) => {
      let card = container.querySelector(`[data-id="${item.id}"]`);
      const isActive = item.id === activeId;

      if (!card) {
        card = document.createElement('div');
        card.className = `mai-queue-item ${isActive ? 'active' : ''}`;
        card.dataset.id = item.id;
        card.innerHTML = `
          <img class="mai-item-thumb" src="${item.previewUrl}" alt="${escapeHtml(item.name)}" />
          <div class="mai-item-info">
            <div class="mai-item-name" title="${escapeHtml(item.name)}">
              <span class="mai-item-idx-badge">#${index + 1}</span>
              ${escapeHtml(item.name)} <span style="font-size:11px;color:var(--mai-text-muted);">(${item.size})</span>
            </div>
            <input type="text" class="mai-item-prompt-input" value="${escapeHtml(item.prompt)}" placeholder="Prompt (e.g. animate)" ${item.status !== 'QUEUED' ? 'disabled' : ''} />
            <div class="mai-item-status-row">
              <span class="mai-status-badge ${item.status}">${item.status}</span>
              <span class="mai-item-progress-text" style="color:var(--mai-text-muted);font-size:11px;">${escapeHtml(item.progressText)}</span>
            </div>
          </div>
          <div class="mai-item-actions">
            ${item.status === 'FAILED' ? `<button class="mai-icon-btn mai-btn-retry" title="Retry">🔄</button>` : ''}
            <button class="mai-icon-btn mai-btn-remove" title="Remove">✕</button>
          </div>
        `;

        // Event: edit prompt
        const promptInput = card.querySelector('.mai-item-prompt-input');
        promptInput.addEventListener('change', (e) => {
          QueueManager.updateItemPrompt(item.id, e.target.value);
        });

        // Event: remove
        card.querySelector('.mai-btn-remove').addEventListener('click', () => {
          QueueManager.removeItem(item.id);
        });

        container.appendChild(card);
      } else {
        // Update dynamic fields
        card.className = `mai-queue-item ${isActive ? 'active' : ''}`;

        const idxBadge = card.querySelector('.mai-item-idx-badge');
        if (idxBadge) idxBadge.textContent = `#${index + 1}`;

        const badge = card.querySelector('.mai-status-badge');
        if (badge) {
          badge.className = `mai-status-badge ${item.status}`;
          badge.textContent = item.status;
        }

        const progress = card.querySelector('.mai-item-progress-text');
        if (progress) {
          progress.textContent = item.progressText;
        }

        // Keep promptInput value synced if user isn't actively focused on it
        const promptInput = card.querySelector('.mai-item-prompt-input');
        if (promptInput) {
          if (document.activeElement !== promptInput) {
            promptInput.value = item.prompt || '';
          }
          promptInput.disabled = item.status !== 'QUEUED';
        }

        // Retry button handling
        const actionsBox = card.querySelector('.mai-item-actions');
        if (item.status === 'FAILED' && !actionsBox.querySelector('.mai-btn-retry')) {
          const retryBtn = document.createElement('button');
          retryBtn.className = 'mai-icon-btn mai-btn-retry';
          retryBtn.title = 'Retry';
          retryBtn.textContent = '🔄';
          retryBtn.addEventListener('click', () => QueueManager.retryItem(item.id));
          actionsBox.prepend(retryBtn);
        }
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    init
  };
})();
