/**
 * StudySync AI - Contextual AI Learning Assistant Client
 */
function initAI(roomId) {
  const container = document.getElementById('aiResponsesContainer');
  const askForm = document.getElementById('aiAskForm');
  const questionInput = document.getElementById('aiCustomQuestion');
  const submitBtn = document.getElementById('btnSubmitAIQuestion');

  // 1. Submit Custom Question
  if (askForm) {
    askForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = questionInput.value.trim();
      if (!question) return;

      renderLoading('Thinking and consulting study room context...');
      submitBtn.disabled = true;

      try {
        const res = await API.request(`/api/ai/${roomId}/ask`, {
          method: 'POST',
          body: JSON.stringify({ question })
        });

        if (res.success && res.data) {
          removeLoading();
          renderAICard('StudySync Assistant', res.data.answer, question);
          questionInput.value = '';
        }
      } catch (err) {
        removeLoading();
        renderAICard('AI Error', `Could not complete explanation: ${err.message}. Please try again.`);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // 2. Quick Action: Explain Recent Chat
  document.getElementById('btnQuickExplainChat')?.addEventListener('click', async () => {
    renderLoading('Analyzing confusing points in recent messages...');
    try {
      const res = await API.request(`/api/ai/${roomId}/analyze`, { method: 'POST' });
      removeLoading();
      if (res.success && res.data) {
        renderAICard('Discussion Analysis', res.data.analysis);
      }
    } catch (err) {
      removeLoading();
      renderAICard('Error', err.message);
    }
  });

  // 3. Quick Action: Identify Conceptual Gaps
  document.getElementById('btnQuickIdentifyGaps')?.addEventListener('click', async () => {
    renderLoading('Identifying prerequisite knowledge gaps...');
    try {
      const res = await API.request(`/api/ai/${roomId}/gaps`, { method: 'POST' });
      removeLoading();
      if (res.success && res.data) {
        renderAICard('Conceptual Gaps Diagnosis', res.data.gaps);
      }
    } catch (err) {
      removeLoading();
      renderAICard('Error', err.message);
    }
  });

  function renderLoading(msg) {
    removeLoading();
    const loader = document.createElement('div');
    loader.id = 'aiLoadingIndicator';
    loader.className = 'ai-card';
    loader.style.borderStyle = 'dashed';
    loader.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="animation: spin 1s linear infinite; font-size:18px;">💡</span>
        <span style="font-size:13px; font-weight:600; color:#065F46;">${escapeHTML(msg)}</span>
      </div>
    `;
    container.prepend(loader);
  }

  function removeLoading() {
    document.getElementById('aiLoadingIndicator')?.remove();
  }

  function renderAICard(badgeTitle, markdownText, sourceQuestion = '') {
    const card = document.createElement('div');
    card.className = 'ai-card';
    card.innerHTML = `
      <div class="ai-card-header">
        <span class="ai-card-badge">🤖 ${escapeHTML(badgeTitle)}</span>
        <button type="button" class="btn-copy-ai" title="Copy explanation" style="font-size:11px; color:#047857; font-weight:700;">Copy</button>
      </div>
      ${sourceQuestion ? `<p style="font-size:12px; font-weight:700; color:#047857; margin-bottom:8px;">Q: ${escapeHTML(sourceQuestion)}</p>` : ''}
      <div class="ai-card-body">${formatMarkdown(markdownText)}</div>
      <div class="ai-card-actions">
        <button type="button" class="btn-save-kb">⭐ Save to Knowledge Base</button>
      </div>
    `;

    // Copy Handler
    card.querySelector('.btn-copy-ai')?.addEventListener('click', () => {
      navigator.clipboard.writeText(markdownText);
      alert('AI explanation copied to clipboard!');
    });

    // Save to Knowledge Base Handler
    card.querySelector('.btn-save-kb')?.addEventListener('click', () => {
      alert('Saved to Knowledge Base! Future students can now search and study this explanation.');
    });

    container.prepend(card);
  }

  function formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/### (.*?)\n/g, '<h4 style="font-size:14px; font-weight:800; margin:10px 0 4px;">$1</h4>')
      .replace(/## (.*?)\n/g, '<h3 style="font-size:15px; font-weight:800; margin:12px 0 6px;">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:#DCFCE7; padding:2px 4px; border-radius:4px; font-size:12px;">$1</code>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n- /g, '<br>• ');
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
