/**
 * StudySync AI - HTML5 Canvas Collaborative Whiteboard Client
 */
function initWhiteboard(socket, roomId) {
  const canvas = document.getElementById('whiteboardCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Drawing state
  let isDrawing = false;
  let currentTool = 'pencil'; // pencil | eraser
  let currentColor = '#1A1D36';
  let currentSize = 3;
  let lastX = 0;
  let lastY = 0;
  let strokesHistory = [];

  // 1. Setup Canvas Resolution
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // 2. Fetch Saved Board State
  loadSavedWhiteboard();

  // 3. Socket Event Listeners
  socket.on('whiteboard:draw', (stroke) => {
    renderStrokeSegment(stroke);
    strokesHistory.push(stroke);
  });

  socket.on('whiteboard:clear', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesHistory = [];
  });

  // 4. Mouse & Touch Drawing Handlers
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    draw({ clientX: touch.clientX, clientY: touch.clientY });
  });

  canvas.addEventListener('touchend', stopDrawing);

  function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
  }

  function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const stroke = {
      fromX: lastX / canvas.width,   // Normalized 0 to 1 for responsive screens
      fromY: lastY / canvas.height,
      toX: x / canvas.width,
      toY: y / canvas.height,
      tool: currentTool,
      color: currentTool === 'eraser' ? '#FAF8F3' : currentColor,
      size: currentTool === 'eraser' ? 24 : currentSize
    };

    renderStrokeSegment(stroke);
    strokesHistory.push(stroke);

    // Broadcast stroke vector to room peers
    socket.emit('whiteboard:draw', { roomId, stroke });

    lastX = x;
    lastY = y;
  }

  function stopDrawing() {
    isDrawing = false;
  }

  function renderStrokeSegment(s) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(s.fromX * canvas.width, s.fromY * canvas.height);
    ctx.lineTo(s.toX * canvas.width, s.toY * canvas.height);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  // 5. Toolbar Buttons (Tools & Colors)
  document.getElementById('toolPencil')?.addEventListener('click', () => {
    currentTool = 'pencil';
    setActiveTool('toolPencil');
  });

  document.getElementById('toolEraser')?.addEventListener('click', () => {
    currentTool = 'eraser';
    setActiveTool('toolEraser');
  });

  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      e.target.classList.add('active');
      currentColor = e.target.getAttribute('data-color');
      currentTool = 'pencil';
      setActiveTool('toolPencil');
    });
  });

  document.getElementById('toolClearBoard')?.addEventListener('click', () => {
    if (confirm('Clear the entire whiteboard for all participants?')) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokesHistory = [];
      socket.emit('whiteboard:clear', { roomId });
    }
  });

  function setActiveTool(toolBtnId) {
    document.querySelectorAll('.btn-wb-tool').forEach(b => b.classList.remove('active'));
    document.getElementById(toolBtnId)?.classList.add('active');
  }

  function resizeCanvas() {
    const parent = canvas.parentElement;
    if (!parent) return;
    // Set actual canvas size matching container dimensions
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    // Replay strokes on resize
    redrawAllStrokes();
  }

  function redrawAllStrokes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesHistory.forEach(s => renderStrokeSegment(s));
  }

  async function loadSavedWhiteboard() {
    try {
      const res = await API.request(`/api/rooms/${roomId}/whiteboard`);
      if (res.success && res.data && Array.isArray(res.data.strokes)) {
        strokesHistory = res.data.strokes;
        redrawAllStrokes();
      }
    } catch (err) {
      console.warn('Could not load whiteboard history:', err.message);
    }
  }
}
