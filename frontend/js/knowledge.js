/**
 * StudySync AI - Persistent Knowledge Base Client Logic
 */
let kbState = {
  items: [],
  subjects: [],
  currentUser: null,
  filter: {
    category: 'all',
    subject: 'all',
    search: '',
    isPinned: false
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify User Session
  try {
    const meRes = await API.getMe();
    if (!meRes || !meRes.success || !meRes.data || !meRes.data.user) {
      window.location.replace('/pages/login.html');
      return;
    }
    kbState.currentUser = meRes.data.user;

    const navName = document.getElementById('userNavName');
    const navAvatar = document.getElementById('userAvatar');
    if (navName) navName.textContent = kbState.currentUser.name;
    if (navAvatar) {
      const initials = (kbState.currentUser.name || 'ST').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
      navAvatar.textContent = initials;
    }

  } catch (err) {
    window.location.replace('/pages/login.html');
    return;
  }

  // 2. Setup Logout Handler
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await API.logout();
    } finally {
      window.location.replace('/pages/login.html');
    }
  });

  // 3. Setup Filter & Search Listeners
  setupFilterListeners();

  // 4. Initial Load
  loadKnowledgeItems();
});

/**
 * Fetch and populate items from backend API
 */
async function loadKnowledgeItems() {
  try {
    const res = await API.getKnowledgeItems(kbState.filter);
    if (res && res.success && res.data) {
      kbState.items = res.data.items || [];
      kbState.subjects = res.data.subjects || [];

      populateSubjectDropdown();
      renderKnowledgeGrid();
    }
  } catch (err) {
    console.error('[Knowledge Base] Failed to load items:', err.message);
  }
}

/**
 * Populate Distinct Subject Filter Options
 */
function populateSubjectDropdown() {
  const select = document.getElementById('kbSubjectSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="all">All Subjects</option>';

  kbState.subjects.forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub;
    opt.textContent = sub;
    if (sub === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

/**
 * Render Knowledge Cards Grid
 */
function renderKnowledgeGrid() {
  const grid = document.getElementById('knowledgeGrid');
  if (!grid) return;

  if (kbState.items.length === 0) {
    grid.innerHTML = `
      <div class="knowledge-empty-state" id="knowledgeEmptyState">
        <div class="kb-empty-icon">💡</div>
        <h3 class="kb-empty-title">
          ${kbState.filter.search ? 'No matching revision items' : 'Your knowledge base is ready!'}
        </h3>
        <p class="kb-empty-desc">
          ${kbState.filter.search 
            ? 'Try searching with a different keyword, tag, or adjust filters.' 
            : 'Save AI study summaries from your sessions, bookmark resolved doubts, or create custom revision cards for exams.'}
        </p>
        <button type="button" class="btn-kb-primary" onclick="openCreateModal()">
          + Create First Note
        </button>
      </div>
    `;
    return;
  }

  const categoryMeta = {
    summary: { label: '🎓 AI Recap', class: 'kb-badge-summary' },
    doubt: { label: '❓ Solved Doubt', class: 'kb-badge-doubt' },
    note: { label: '📝 Note', class: 'kb-badge-note' },
    flashcard: { label: '⚡ Flashcard', class: 'kb-badge-flashcard' }
  };

  grid.innerHTML = kbState.items.map(item => {
    const cat = categoryMeta[item.category] || categoryMeta.note;
    const dateFormatted = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return `
      <div class="knowledge-card ${item.isPinned ? 'pinned' : ''}" id="kbCard-${item._id}">
        <div class="kb-card-header">
          <div class="kb-card-meta-left">
            <span class="kb-badge ${cat.class}">${cat.label}</span>
            <span class="kb-subject-chip">${escapeHTML(item.subject)}</span>
          </div>
          <button 
            type="button" 
            class="btn-kb-pin ${item.isPinned ? 'pinned' : ''}" 
            data-action="pin" 
            data-id="${item._id}" 
            title="${item.isPinned ? 'Unpin from top' : 'Pin to top'}"
          >
            📌
          </button>
        </div>

        <h3 class="kb-card-title">${escapeHTML(item.title)}</h3>
        <div class="kb-card-excerpt">${escapeHTML(item.content)}</div>

        ${item.tags && item.tags.length > 0 ? `
          <div class="kb-card-tags">
            ${item.tags.map(t => `<span class="kb-tag-chip">#${escapeHTML(t)}</span>`).join('')}
          </div>
        ` : ''}

        <div class="kb-card-footer">
          <span>${item.source || 'Saved Note'} • ${dateFormatted}</span>
          <div class="kb-card-actions">
            <button type="button" class="btn-kb-action-sm btn-kb-action-view" data-action="view" data-id="${item._id}">
              Read
            </button>
            <button type="button" class="btn-kb-action-sm" data-action="edit" data-id="${item._id}">
              Edit
            </button>
            <button type="button" class="btn-kb-action-sm" style="color:#EF4444;" data-action="delete" data-id="${item._id}">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Filter & Search Listeners
 */
function setupFilterListeners() {
  // Category filter pills
  document.querySelectorAll('.kb-filter-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.kb-filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      kbState.filter.category = btn.dataset.category || 'all';
      loadKnowledgeItems();
    });
  });

  // Subject select dropdown
  const subjectSelect = document.getElementById('kbSubjectSelect');
  subjectSelect?.addEventListener('change', (e) => {
    kbState.filter.subject = e.target.value;
    loadKnowledgeItems();
  });

  // Search input with debounce
  const searchInput = document.getElementById('kbSearchInput');
  let searchTimer = null;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      kbState.filter.search = e.target.value.trim();
      loadKnowledgeItems();
    }, 250);
  });

  // Pinned toggle
  const pinToggle = document.getElementById('kbPinnedToggle');
  pinToggle?.addEventListener('change', (e) => {
    kbState.filter.isPinned = e.target.checked;
    loadKnowledgeItems();
  });

  // Grid Action Delegation
  const grid = document.getElementById('knowledgeGrid');
  grid?.addEventListener('click', handleGridActionClick);

  // New Note Modal Button
  document.getElementById('btnOpenCreateModal')?.addEventListener('click', () => openCreateModal());

  // Form Submit Handler
  document.getElementById('knowledgeItemForm')?.addEventListener('submit', handleFormSubmit);

  // Export Study Sheet (.md) Button
  document.getElementById('btnExportMarkdown')?.addEventListener('click', handleExportMarkdown);

  // Copy Content in View Modal
  document.getElementById('btnCopyViewContent')?.addEventListener('click', () => {
    const content = document.getElementById('viewItemContent')?.innerText;
    if (content) {
      navigator.clipboard.writeText(content);
      alert('Content copied to clipboard!');
    }
  });
}

/**
 * Handle Card Action Clicks
 */
async function handleGridActionClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!id) return;

  const item = kbState.items.find(i => i._id === id);
  if (!item) return;

  if (action === 'view') {
    openViewModal(item);
    return;
  }

  if (action === 'edit') {
    openCreateModal(item);
    return;
  }

  if (action === 'pin') {
    try {
      const res = await API.togglePinKnowledgeItem(id);
      if (res && res.success && res.data && res.data.item) {
        item.isPinned = res.data.item.isPinned;
        loadKnowledgeItems();
      }
    } catch (err) {
      alert(err.message || 'Could not update pin status.');
    }
    return;
  }

  if (action === 'delete') {
    if (!confirm(`Are you sure you want to delete "${item.title}"?`)) return;
    try {
      await API.deleteKnowledgeItem(id);
      kbState.items = kbState.items.filter(i => i._id !== id);
      renderKnowledgeGrid();
    } catch (err) {
      alert(err.message || 'Could not delete item.');
    }
    return;
  }
}

/**
 * Modals
 */
function openViewModal(item) {
  const modal = document.getElementById('viewKnowledgeModal');
  if (!modal) return;

  const categoryMeta = {
    summary: { label: '🎓 AI Recap', class: 'kb-badge-summary' },
    doubt: { label: '❓ Solved Doubt', class: 'kb-badge-doubt' },
    note: { label: '📝 Note', class: 'kb-badge-note' },
    flashcard: { label: '⚡ Flashcard', class: 'kb-badge-flashcard' }
  };
  const cat = categoryMeta[item.category] || categoryMeta.note;

  const badge = document.getElementById('viewItemBadge');
  if (badge) {
    badge.textContent = cat.label;
    badge.className = `kb-badge ${cat.class}`;
  }

  document.getElementById('viewItemSubject').textContent = item.subject || 'General';
  document.getElementById('viewItemTitle').textContent = item.title;

  const tagsContainer = document.getElementById('viewItemTags');
  if (tagsContainer) {
    tagsContainer.innerHTML = (item.tags || []).map(t => `<span class="kb-tag-chip">#${escapeHTML(t)}</span>`).join('');
  }

  document.getElementById('viewItemContent').innerHTML = renderSafeMarkdown(item.content);
  modal.classList.remove('hidden');
}

function closeViewModal() {
  document.getElementById('viewKnowledgeModal')?.classList.add('hidden');
}

function openCreateModal(item = null) {
  const modal = document.getElementById('createKnowledgeModal');
  if (!modal) return;

  const formTitle = document.getElementById('modalFormTitle');
  const editId = document.getElementById('editItemId');
  const title = document.getElementById('kbItemTitle');
  const subject = document.getElementById('kbItemSubject');
  const category = document.getElementById('kbItemCategory');
  const content = document.getElementById('kbItemContent');
  const tags = document.getElementById('kbItemTags');
  const pinned = document.getElementById('kbItemPinned');

  if (item) {
    formTitle.textContent = '✏️ Edit Knowledge Item';
    editId.value = item._id;
    title.value = item.title;
    subject.value = item.subject;
    category.value = item.category;
    content.value = item.content;
    tags.value = (item.tags || []).join(', ');
    pinned.checked = !!item.isPinned;
  } else {
    formTitle.textContent = '✨ Save to Knowledge Base';
    editId.value = '';
    title.value = '';
    subject.value = kbState.filter.subject !== 'all' ? kbState.filter.subject : '';
    category.value = 'note';
    content.value = '';
    tags.value = '';
    pinned.checked = false;
  }

  modal.classList.remove('hidden');
  title.focus();
}

function closeCreateModal() {
  document.getElementById('createKnowledgeModal')?.classList.add('hidden');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('editItemId').value;
  const title = document.getElementById('kbItemTitle').value.trim();
  const subject = document.getElementById('kbItemSubject').value.trim();
  const category = document.getElementById('kbItemCategory').value;
  const content = document.getElementById('kbItemContent').value.trim();
  const tags = document.getElementById('kbItemTags').value.trim();
  const isPinned = document.getElementById('kbItemPinned').checked;

  const btnSubmit = document.getElementById('btnSaveKnowledgeItem');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Saving...';
  }

  try {
    if (editId) {
      await API.updateKnowledgeItem(editId, {
        title,
        subject,
        category,
        content,
        tags,
        isPinned
      });
    } else {
      await API.createKnowledgeItem({
        title,
        subject,
        category,
        content,
        tags,
        isPinned
      });
    }
    closeCreateModal();
    loadKnowledgeItems();
  } catch (err) {
    alert(err.message || 'Failed to save knowledge item.');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Save to Knowledge Base';
    }
  }
}

/**
 * Export Study Sheet (.md)
 */
function handleExportMarkdown() {
  const subjectParam = kbState.filter.subject !== 'all' ? `?subject=${encodeURIComponent(kbState.filter.subject)}` : '';
  window.open(`/api/knowledge/export${subjectParam}`, '_blank');
}

/**
 * Utilities
 */
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderSafeMarkdown(text) {
  if (!text) return '';
  return escapeHTML(text)
    .replace(/^### (.*$)/gim, '<h3 style="font-size:16px; font-weight:700; color:#1E1B4B; margin: 12px 0 6px;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="font-size:18px; font-weight:800; color:#1E1B4B; margin: 14px 0 8px;">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:#E0E7FF; padding:1px 5px; border-radius:4px; font-family:monospace;">$1</code>')
    .replace(/^\* (.*$)/gim, '• $1')
    .replace(/^- (.*$)/gim, '• $1')
    .replace(/^> (.*$)/gim, '<blockquote style="border-left: 3px solid #6366F1; padding-left: 10px; color: #4338CA; margin: 8px 0; font-style: italic;">$1</blockquote>');
}
