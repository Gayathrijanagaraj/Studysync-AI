/**
 * StudySync AI - Shared Collaborative Notes Client
 */
function initNotes(socket, roomId) {
  const textarea = document.getElementById('sharedNotesTextarea');
  const statusLabel = document.getElementById('notesSaveStatus');
  let isReceivingSocketUpdate = false;

  // 1. Fetch initial notes
  loadNotes();

  // 2. Socket listener for real-time text sync
  socket.on('notes:changed', (data) => {
    if (!textarea) return;
    isReceivingSocketUpdate = true;
    
    // Save current cursor position
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    textarea.value = data.content || '';
    
    // Restore cursor position
    textarea.setSelectionRange(start, end);
    isReceivingSocketUpdate = false;

    if (statusLabel) {
      statusLabel.textContent = `Edited by ${data.lastEditedBy || 'peer'}`;
    }
  });

  // 3. Textarea input listener
  if (textarea) {
    textarea.addEventListener('input', () => {
      if (isReceivingSocketUpdate) return;

      const content = textarea.value;
      if (statusLabel) statusLabel.textContent = 'Saving...';

      // Broadcast update to peers
      socket.emit('notes:update', { roomId, content });
    });
  }

  // 4. Formatting Toolbar Actions
  document.querySelectorAll('.notes-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!textarea) return;
      const action = btn.getAttribute('data-tool');
      applyMarkdownFormatting(action);
    });
  });

  async function loadNotes() {
    try {
      const res = await API.request(`/api/rooms/${roomId}/notes`);
      if (res.success && res.data) {
        if (textarea) textarea.value = res.data.content || '';
        if (statusLabel) statusLabel.textContent = 'All changes saved';
      }
    } catch (err) {
      console.warn('Failed to load shared notes:', err.message);
    }
  }

  function applyMarkdownFormatting(tool) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    let replacement = '';

    switch (tool) {
      case 'h1':
        replacement = `\n# ${selected || 'Heading 1'}\n`;
        break;
      case 'h2':
        replacement = `\n## ${selected || 'Heading 2'}\n`;
        break;
      case 'bold':
        replacement = `**${selected || 'bold text'}**`;
        break;
      case 'italic':
        replacement = `*${selected || 'italic text'}*`;
        break;
      case 'bullet':
        replacement = `\n- ${selected || 'List item'}`;
        break;
      case 'number':
        replacement = `\n1. ${selected || 'Numbered item'}`;
        break;
      case 'clear':
        if (confirm('Clear all note content?')) {
          textarea.value = '';
          socket.emit('notes:update', { roomId, content: '' });
          return;
        }
        return;
      default:
        return;
    }

    textarea.setRangeText(replacement, start, end, 'end');
    socket.emit('notes:update', { roomId, content: textarea.value });
  }
}
