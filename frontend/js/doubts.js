/**
 * StudySync AI - In-Room Doubt Tracker & AI Solver Client Logic
 */
let doubtsState = {
  doubts: [],
  activeFilter: 'all', // 'all' | 'open' | 'resolved'
  searchQuery: '',
  roomId: null,
  socket: null,
  currentUser: null,
  isOwner: false
};

function initDoubts(socket, roomId, currentUser, isOwner = false) {
  doubtsState.socket = socket;
  doubtsState.roomId = roomId;
  doubtsState.currentUser = currentUser;
  doubtsState.isOwner = isOwner;

  setupDoubtDOMListeners();
  setupDoubtSocketListeners();
  loadDoubts();
}

/**
 * 1. Load Doubts from Backend API
 */
async function loadDoubts() {
  try {
    const res = await API.getDoubts(doubtsState.roomId);
    if (res && res.success && res.data && Array.isArray(res.data.doubts)) {
      doubtsState.doubts = res.data.doubts;
      renderDoubts();
      updateDoubtsBadge();
    }
  } catch (err) {
    console.error('[Doubts] Failed to fetch doubts:', err.message);
  }
}

/**
 * 2. Setup Socket.IO Event Listeners for Real-Time Sync
 */
function setupDoubtSocketListeners() {
  const socket = doubtsState.socket;
  if (!socket) return;

  // New doubt raised
  socket.on('doubt:created', (doubt) => {
    if (!doubt || !doubt._id) return;
    // Check if already in state
    const exists = doubtsState.doubts.some(d => d._id === doubt._id);
    if (!exists) {
      doubtsState.doubts.unshift(doubt);
      renderDoubts();
      updateDoubtsBadge();
    }
  });

  // Upvote updated
  socket.on('doubt:upvoted', ({ doubtId, upvotes, upvoteCount }) => {
    const target = doubtsState.doubts.find(d => d._id === doubtId);
    if (target) {
      target.upvotes = upvotes || [];
      renderDoubts();
    }
  });

  // New answer posted
  socket.on('doubt:answered', ({ doubtId, answer }) => {
    const target = doubtsState.doubts.find(d => d._id === doubtId);
    if (target && answer) {
      if (!Array.isArray(target.answers)) target.answers = [];
      const answerExists = target.answers.some(a => a._id === answer._id);
      if (!answerExists) {
        target.answers.push(answer);
      }
      renderDoubts();
    }
  });

  // Doubt resolved or reopened
  socket.on('doubt:resolved', (updatedDoubt) => {
    if (!updatedDoubt || !updatedDoubt.doubtId) return;
    const target = doubtsState.doubts.find(d => d._id === updatedDoubt.doubtId);
    if (target) {
      target.status = updatedDoubt.status;
      target.resolvedAt = updatedDoubt.resolvedAt;
      target.resolvedBy = updatedDoubt.resolvedBy;
      renderDoubts();
      updateDoubtsBadge();
    }
  });

  // AI solution generated
  socket.on('doubt:ai_solved', ({ doubtId, aiSolution }) => {
    const target = doubtsState.doubts.find(d => d._id === doubtId);
    if (target && aiSolution) {
      target.aiSolution = aiSolution;
      renderDoubts();
    }
  });

  // Doubt deleted
  socket.on('doubt:deleted', ({ doubtId }) => {
    doubtsState.doubts = doubtsState.doubts.filter(d => d._id !== doubtId);
    renderDoubts();
    updateDoubtsBadge();
  });
}

/**
 * 3. Render Doubts List to DOM
 */
function renderDoubts() {
  const container = document.getElementById('doubtsScrollArea');
  if (!container) return;

  const currentUserId = doubtsState.currentUser ? (doubtsState.currentUser.id || doubtsState.currentUser._id) : null;

  // Apply Filter & Search
  let filtered = doubtsState.doubts.filter(d => {
    if (doubtsState.activeFilter === 'open' && d.status !== 'open') return false;
    if (doubtsState.activeFilter === 'resolved' && d.status !== 'resolved') return false;

    if (doubtsState.searchQuery) {
      const q = doubtsState.searchQuery.toLowerCase();
      const inTitle = (d.title || '').toLowerCase().includes(q);
      const inDesc = (d.description || '').toLowerCase().includes(q);
      const inTags = (d.tags || []).some(t => t.toLowerCase().includes(q));
      if (!inTitle && !inDesc && !inTags) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="doubts-empty-state">
        <div class="doubts-empty-icon">💡</div>
        <div class="doubts-empty-title">
          ${doubtsState.searchQuery ? 'No matching doubts found' : 'No doubts raised yet'}
        </div>
        <div class="doubts-empty-desc">
          ${doubtsState.searchQuery 
            ? 'Try adjusting your search terms or filter.' 
            : 'Got stuck on a tricky concept or homework question? Raise a doubt and collaborate with your study crew!'}
        </div>
        ${!doubtsState.searchQuery ? `
          <button type="button" class="btn-raise-doubt" onclick="openRaiseDoubtModal()">
            + Raise a Doubt
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(doubt => {
    const authorName = doubt.author ? doubt.author.name : 'Student';
    const authorInitials = (authorName || 'ST').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const upvotes = Array.isArray(doubt.upvotes) ? doubt.upvotes : [];
    const hasUpvoted = currentUserId && upvotes.some(uid => uid.toString() === currentUserId.toString());
    const isResolved = doubt.status === 'resolved';
    const isAuthor = currentUserId && doubt.author && (doubt.author._id || doubt.author.id || doubt.author).toString() === currentUserId.toString();
    const canManage = isAuthor || doubtsState.isOwner || (doubtsState.currentUser && doubtsState.currentUser.role === 'admin');
    const answers = Array.isArray(doubt.answers) ? doubt.answers : [];

    return `
      <div class="doubt-card ${isResolved ? 'status-resolved' : ''}" id="doubtCard-${doubt._id}">
        <!-- Upvote -->
        <div class="doubt-upvote-col">
          <button 
            type="button" 
            class="btn-upvote ${hasUpvoted ? 'upvoted' : ''}" 
            data-action="upvote" 
            data-doubt-id="${doubt._id}"
            title="${hasUpvoted ? 'Remove upvote' : 'Upvote this doubt'}"
          >
            <span class="upvote-icon">▲</span>
            <span class="upvote-count">${upvotes.length}</span>
          </button>
        </div>

        <!-- Main Body -->
        <div class="doubt-main">
          <div class="doubt-header">
            <div class="doubt-meta">
              <span class="doubt-author-badge">
                <span class="doubt-author-avatar">${authorInitials}</span>
                ${escapeHTML(authorName)}
              </span>
              <span>•</span>
              <span>${formatRelativeTime(doubt.createdAt)}</span>
            </div>
            <span class="doubt-status-pill ${isResolved ? 'resolved' : 'open'}">
              ${isResolved ? '✓ Resolved' : 'Open'}
            </span>
          </div>

          <h3 class="doubt-title">${escapeHTML(doubt.title)}</h3>
          <div class="doubt-desc">${escapeHTML(doubt.description)}</div>

          ${doubt.tags && doubt.tags.length > 0 ? `
            <div class="doubt-tags-list">
              ${doubt.tags.map(t => `<span class="doubt-tag">#${escapeHTML(t)}</span>`).join('')}
            </div>
          ` : ''}

          <!-- AI Solution Box (if present) -->
          ${doubt.aiSolution && doubt.aiSolution.content ? `
            <div class="doubt-ai-box">
              <div class="doubt-ai-header">
                <span class="doubt-ai-badge">✨ StudySync AI Resolution</span>
                <span class="doubt-ai-model-tag">Gemini 3.5 Flash</span>
              </div>
              <div class="doubt-ai-content">${renderMarkdownText(doubt.aiSolution.content)}</div>
            </div>
          ` : ''}

          <!-- Peer Answers Section -->
          <div class="doubt-answers-section">
            <button type="button" class="doubt-answers-toggle" data-action="toggle-answers" data-doubt-id="${doubt._id}">
              💬 ${answers.length} ${answers.length === 1 ? 'Answer' : 'Answers'} ▼
            </button>

            <div class="doubt-answers-list ${answers.length > 0 ? '' : 'hidden'}" id="answersList-${doubt._id}">
              ${answers.map(ans => {
                const ansAuthor = ans.author ? ans.author.name : 'Peer';
                return `
                  <div class="doubt-answer-item">
                    <div class="doubt-answer-author">
                      <span>${escapeHTML(ansAuthor)}</span>
                      <span class="doubt-answer-time">• ${formatRelativeTime(ans.createdAt)}</span>
                    </div>
                    <div class="doubt-answer-text">${escapeHTML(ans.content)}</div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Add Answer Input -->
            <form class="doubt-answer-input-row" data-action="submit-answer" data-doubt-id="${doubt._id}">
              <input 
                type="text" 
                class="doubt-answer-input" 
                placeholder="Write an answer, explanation, or hint..." 
                required
              >
              <button type="submit" class="btn-answer-send">Answer</button>
            </form>
          </div>

          <!-- Card Actions Footer -->
          <div class="doubt-actions-footer">
            <button 
              type="button" 
              class="btn-doubt-action btn-doubt-ai" 
              data-action="ai-solve" 
              data-doubt-id="${doubt._id}"
              ${doubt.aiSolution && doubt.aiSolution.content ? 'title="Regenerate AI solution"' : ''}
            >
              ✨ ${doubt.aiSolution && doubt.aiSolution.content ? 'Regenerate AI Solution' : 'Solve with AI'}
            </button>

            ${doubt.aiSolution && doubt.aiSolution.content ? `
              <button 
                type="button" 
                class="btn-doubt-action" 
                data-action="save-to-kb" 
                data-doubt-id="${doubt._id}"
                title="Save this doubt & AI solution to your personal Knowledge Base"
              >
                💾 Save to KB
              </button>
            ` : ''}

            ${canManage ? `
              <button 
                type="button" 
                class="btn-doubt-action btn-doubt-resolve" 
                data-action="resolve" 
                data-doubt-id="${doubt._id}"
              >
                ${isResolved ? '↺ Reopen Doubt' : '✓ Mark as Resolved'}
              </button>

              <button 
                type="button" 
                class="btn-doubt-action btn-doubt-delete" 
                data-action="delete" 
                data-doubt-id="${doubt._id}"
                title="Delete this doubt"
              >
                🗑️ Delete
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 4. Setup DOM Event Listeners
 */
function setupDoubtDOMListeners() {
  // Filter pills
  document.querySelectorAll('.doubts-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.doubts-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      doubtsState.activeFilter = btn.dataset.filter || 'all';
      renderDoubts();
    });
  });

  // Search input
  const searchInput = document.getElementById('doubtsSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      doubtsState.searchQuery = e.target.value.trim();
      renderDoubts();
    });
  }

  // Raise Doubt Button
  const btnRaise = document.getElementById('btnOpenRaiseDoubtModal');
  if (btnRaise) {
    btnRaise.addEventListener('click', openRaiseDoubtModal);
  }

  // Raise Doubt Modal Form
  const modalForm = document.getElementById('raiseDoubtForm');
  if (modalForm) {
    modalForm.addEventListener('submit', handleRaiseDoubtSubmit);
  }

  // Event Delegation for Doubt Card Buttons
  const scrollArea = document.getElementById('doubtsScrollArea');
  if (scrollArea) {
    scrollArea.addEventListener('click', handleDoubtCardClick);
    scrollArea.addEventListener('submit', handleDoubtAnswerSubmit);
  }
}

/**
 * 5. Handle Click Actions on Doubt Cards
 */
async function handleDoubtCardClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const doubtId = target.dataset.doubtId;
  if (!doubtId) return;

  // Upvote Action
  if (action === 'upvote') {
    try {
      const res = await API.toggleUpvoteDoubt(doubtsState.roomId, doubtId);
      if (res && res.success) {
        const doubt = doubtsState.doubts.find(d => d._id === doubtId);
        if (doubt) {
          const userId = doubtsState.currentUser.id || doubtsState.currentUser._id;
          if (res.data.hasUpvoted) {
            if (!doubt.upvotes.includes(userId)) doubt.upvotes.push(userId);
          } else {
            doubt.upvotes = doubt.upvotes.filter(id => id.toString() !== userId.toString());
          }
          renderDoubts();
        }
      }
    } catch (err) {
      alert(err.message || 'Could not update upvote.');
    }
    return;
  }

  // Toggle Answers List
  if (action === 'toggle-answers') {
    const list = document.getElementById(`answersList-${doubtId}`);
    if (list) {
      list.classList.toggle('hidden');
    }
    return;
  }

  // Solve with AI Action
  if (action === 'ai-solve') {
    target.classList.add('loading');
    target.disabled = true;
    target.textContent = '⏳ Thinking...';
    try {
      const res = await API.solveDoubtWithAI(doubtsState.roomId, doubtId);
      if (res && res.success && res.data && res.data.aiSolution) {
        const doubt = doubtsState.doubts.find(d => d._id === doubtId);
        if (doubt) {
          doubt.aiSolution = res.data.aiSolution;
          renderDoubts();
        }
      }
    } catch (err) {
      alert(err.message || 'AI solution failed. Please try again.');
      renderDoubts();
    }
    return;
  }

  // Save to Knowledge Base Action
  if (action === 'save-to-kb') {
    const doubt = doubtsState.doubts.find(d => d._id === doubtId);
    if (!doubt) return;
    target.disabled = true;
    target.textContent = 'Saving...';
    try {
      const subjectTag = document.getElementById('workspaceSubjectTag')?.textContent || 'General Studies';
      let fullContent = `### Question / Doubt:\n${doubt.description}\n\n`;
      if (doubt.aiSolution && doubt.aiSolution.content) {
        fullContent += `### ✨ StudySync AI Solution:\n${doubt.aiSolution.content}\n\n`;
      }
      if (doubt.answers && doubt.answers.length > 0) {
        fullContent += `### 💬 Peer Discussions:\n` + doubt.answers.map(a => `- ${a.author ? a.author.name : 'Peer'}: ${a.content}`).join('\n');
      }

      await API.createKnowledgeItem({
        title: doubt.title,
        subject: subjectTag,
        category: 'doubt',
        content: fullContent,
        tags: doubt.tags || ['doubt', 'solved'],
        source: 'In-Room Doubt Resolution'
      });

      target.textContent = '✓ Saved to KB!';
      target.style.color = '#10B981';
      target.style.borderColor = '#10B981';
    } catch (err) {
      alert(err.message || 'Could not save to Knowledge Base.');
      target.disabled = false;
      target.textContent = '💾 Save to KB';
    }
    return;
  }

  // Resolve / Reopen Doubt Action
  if (action === 'resolve') {
    try {
      const res = await API.resolveDoubt(doubtsState.roomId, doubtId);
      if (res && res.success && res.data && res.data.doubt) {
        const index = doubtsState.doubts.findIndex(d => d._id === doubtId);
        if (index > -1) {
          doubtsState.doubts[index] = res.data.doubt;
          renderDoubts();
          updateDoubtsBadge();
        }
      }
    } catch (err) {
      alert(err.message || 'Could not update resolution status.');
    }
    return;
  }

  // Delete Doubt Action
  if (action === 'delete') {
    if (!confirm('Are you sure you want to delete this doubt?')) return;
    try {
      await API.deleteDoubt(doubtsState.roomId, doubtId);
      doubtsState.doubts = doubtsState.doubts.filter(d => d._id !== doubtId);
      renderDoubts();
      updateDoubtsBadge();
    } catch (err) {
      alert(err.message || 'Could not delete doubt.');
    }
    return;
  }
}

/**
 * 6. Handle Adding an Answer to a Doubt
 */
async function handleDoubtAnswerSubmit(e) {
  e.preventDefault();
  const form = e.target.closest('[data-action="submit-answer"]');
  if (!form) return;

  const doubtId = form.dataset.doubtId;
  const input = form.querySelector('.doubt-answer-input');
  if (!input || !input.value.trim()) return;

  const content = input.value.trim();
  input.value = '';

  try {
    const res = await API.addDoubtAnswer(doubtsState.roomId, doubtId, content);
    if (res && res.success && res.data && res.data.answer) {
      const target = doubtsState.doubts.find(d => d._id === doubtId);
      if (target) {
        if (!Array.isArray(target.answers)) target.answers = [];
        target.answers.push(res.data.answer);
        renderDoubts();
      }
    }
  } catch (err) {
    alert(err.message || 'Could not post answer.');
  }
}

/**
 * 7. Raise Doubt Modal Handlers
 */
function openRaiseDoubtModal() {
  const modal = document.getElementById('raiseDoubtModal');
  if (modal) {
    modal.classList.remove('hidden');
    const input = document.getElementById('doubtInputTitle');
    if (input) input.focus();
  }
}

function closeRaiseDoubtModal() {
  const modal = document.getElementById('raiseDoubtModal');
  if (modal) {
    modal.classList.add('hidden');
    const form = document.getElementById('raiseDoubtForm');
    if (form) form.reset();
  }
}

async function handleRaiseDoubtSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('doubtInputTitle')?.value.trim();
  const description = document.getElementById('doubtInputDesc')?.value.trim();
  const tags = document.getElementById('doubtInputTags')?.value.trim();

  if (!title || !description) {
    alert('Please provide both a title and description for your doubt.');
    return;
  }

  const btnSubmit = document.getElementById('btnSubmitDoubt');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Posting...';
  }

  try {
    const res = await API.createDoubt(doubtsState.roomId, {
      title,
      description,
      tags
    });

    if (res && res.success && res.data && res.data.doubt) {
      const exists = doubtsState.doubts.some(d => d._id === res.data.doubt._id);
      if (!exists) {
        doubtsState.doubts.unshift(res.data.doubt);
        renderDoubts();
        updateDoubtsBadge();
      }
      closeRaiseDoubtModal();
    }
  } catch (err) {
    alert(err.message || 'Failed to raise doubt.');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Post Doubt';
    }
  }
}

/**
 * 8. Update Badge Count on Tab
 */
function updateDoubtsBadge() {
  const badge = document.getElementById('doubtsBadge');
  if (!badge) return;

  const openCount = doubtsState.doubts.filter(d => d.status === 'open').length;
  badge.textContent = openCount;
  if (openCount === 0) {
    badge.className = 'tab-badge badge-zero';
  } else {
    badge.className = 'tab-badge';
  }
}

/**
 * Utilities
 */
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Just now';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderMarkdownText(text) {
  if (!text) return '';
  // Basic safe markdown parser for bold, headers, code, bullet lists
  return escapeHTML(text)
    .replace(/^### (.*$)/gim, '<h4 style="font-size:13px; font-weight:700; margin: 8px 0 4px;">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="font-size:14px; font-weight:700; margin: 10px 0 4px;">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:#E0E7FF; padding:1px 4px; border-radius:3px; font-family:monospace;">$1</code>')
    .replace(/^\* (.*$)/gim, '• $1')
    .replace(/^- (.*$)/gim, '• $1');
}
