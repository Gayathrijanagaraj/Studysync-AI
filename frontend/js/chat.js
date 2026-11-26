/**
 * StudySync AI - Live Group Chat Client
 */
function initChat(socket, roomId, currentUser) {
  const messagesContainer = document.getElementById('chatMessagesContainer');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const typingBanner = document.getElementById('typingIndicatorBanner');

  let typingTimeout = null;

  // 1. Load Recent Message History
  loadMessageHistory();

  // 2. Socket Listeners
  socket.on('chat:new', (msg) => {
    appendMessage(msg);
  });

  socket.on('user:typing', (data) => {
    if (!typingBanner) return;
    if (data.isTyping && data.user.id !== currentUser.id) {
      typingBanner.textContent = `${data.user.name} is typing...`;
    } else {
      typingBanner.textContent = '';
    }
  });

  // 3. Form Submit Handler
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      // Emit to server
      socket.emit('chat:send', { roomId, message: text });
      chatInput.value = '';

      // Clear typing indicator
      socket.emit('user:typing', { roomId, isTyping: false });
    });

    // Keystroke typing detector
    chatInput.addEventListener('input', () => {
      socket.emit('user:typing', { roomId, isTyping: true });

      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.emit('user:typing', { roomId, isTyping: false });
      }, 1500);
    });
  }

  async function loadMessageHistory() {
    try {
      const res = await API.request(`/api/rooms/${roomId}/messages`);
      if (res.success && res.data && Array.isArray(res.data.messages)) {
        messagesContainer.innerHTML = '';
        res.data.messages.forEach(msg => appendMessage(msg, false));
        scrollToBottom();
      }
    } catch (err) {
      console.warn('Failed to load message history:', err.message);
    }
  }

  function appendMessage(msg, scroll = true) {
    if (!messagesContainer) return;

    const isMine = msg.sender && msg.sender.id.toString() === currentUser.id.toString();
    const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgElement = document.createElement('div');
    msgElement.className = `chat-message-row ${isMine ? 'mine' : 'peer'}`;
    msgElement.innerHTML = `
      ${!isMine ? `<span class="message-sender-name">${escapeHTML(msg.sender.name)}</span>` : ''}
      <div class="message-bubble">${escapeHTML(msg.message)}</div>
      <div style="display:flex; align-items:center; gap:6px;">
        <span class="message-time">${formattedTime}</span>
        ${!isMine ? `<button type="button" class="btn-ask-ai-msg" data-msg="${escapeHTML(msg.message)}">Ask AI 💡</button>` : ''}
      </div>
    `;

    // "Ask AI" quick button handler
    const askAIBtn = msgElement.querySelector('.btn-ask-ai-msg');
    if (askAIBtn) {
      askAIBtn.addEventListener('click', (e) => {
        const textToExplain = e.target.getAttribute('data-msg');
        // Switch to AI tab and populate question
        document.getElementById('tabBtnAI')?.click();
        const aiPromptInput = document.getElementById('aiCustomQuestion');
        if (aiPromptInput) {
          aiPromptInput.value = `Can you explain what this means in our study topic: "${textToExplain}"?`;
          aiPromptInput.focus();
        }
      });
    }

    messagesContainer.appendChild(msgElement);
    if (scroll) scrollToBottom();
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
