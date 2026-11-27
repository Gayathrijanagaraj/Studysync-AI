const { Server } = require('socket.io');
const Room = require('../models/Room');
const Message = require('../models/Message');
const SharedNote = require('../models/SharedNote');
const Whiteboard = require('../models/Whiteboard');
const RoomMember = require('../models/RoomMember');
const sessionConfig = require('../config/session');

// In-memory active presence tracker: roomId -> Map(userId -> { id, name, socketCount })
const activeRoomUsers = new Map();

// Active WebRTC Call Peers: roomId -> Map(socketId -> { socketId, userId, userName, micMuted, camOff })
const activeCallPeers = new Map();

// Active Screen Sharers: roomId -> { socketId, userId, userName }
const activeScreenSharers = new Map();

// Debounce timer map for saving notes to avoid DB saturation: roomId -> timeoutId
const notesSaveTimers = new Map();

function initSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || true,
      credentials: true
    }
  });

  // Share express-session with Socket.IO
  const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
  io.use(wrap(sessionConfig));

  // Authenticate socket connection
  io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.user) {
      socket.user = session.user;
      return next();
    }
    return next(new Error('Unauthorized: Session required for real-time collaboration.'));
  });

  io.on('connection', (socket) => {
    const currentUser = socket.user;
    let joinedRooms = new Set();

    console.log(`[Socket.IO] Student connected: ${currentUser.name} (${socket.id})`);

    // 1. Join Room
    socket.on('room:join', async (data) => {
      try {
        if (!data || typeof data !== 'object') return;
        const roomId = data.roomId;
        if (!roomId || typeof roomId !== 'string') return;

        // Verify membership in database
        const isMember = await RoomMember.findOne({ roomId, userId: currentUser.id });
        if (!isMember && currentUser.role !== 'admin') {
          socket.emit('error', { message: 'You are not an authorized member of this room.' });
          return;
        }

        socket.join(roomId);
        joinedRooms.add(roomId);

        // Update presence
        if (!activeRoomUsers.has(roomId)) {
          activeRoomUsers.set(roomId, new Map());
        }
        const roomMap = activeRoomUsers.get(roomId);
        const existing = roomMap.get(currentUser.id) || { id: currentUser.id, name: currentUser.name, socketCount: 0 };
        existing.socketCount += 1;
        roomMap.set(currentUser.id, existing);

        // Broadcast presence list to the room
        broadcastPresence(io, roomId);

        console.log(`[Socket.IO] ${currentUser.name} joined room: ${roomId}`);
      } catch (err) {
        console.error('[Socket room:join Error]:', err.message);
      }
    });

    // 2. Leave Room
    socket.on('room:leave', (data) => {
      if (!data || typeof data !== 'object') return;
      const roomId = data.roomId;
      if (!roomId || typeof roomId !== 'string') return;

      socket.leave(roomId);
      joinedRooms.delete(roomId);
      removeUserFromRoomPresence(roomId, currentUser.id);
      broadcastPresence(io, roomId);
    });

    // 3. Real-Time Chat Message
    socket.on('chat:send', async (data) => {
      try {
        if (!data || typeof data !== 'object') return;
        const { roomId, message } = data;
        if (!roomId || typeof roomId !== 'string' || !message || typeof message !== 'string' || !message.trim()) return;

        // Ensure user has authorized membership and has joined the socket room
        if (!socket.rooms.has(roomId)) return;

        // Check if room is closed (read-only)
        const room = await Room.findById(roomId);
        if (!room || room.status === 'closed') {
          socket.emit('error', { message: 'This study room is closed and currently in read-only mode.' });
          return;
        }

        // Persist message to database
        const savedMsg = await Message.create({
          roomId,
          senderId: currentUser.id,
          message: message.trim()
        });

        // Broadcast to all participants in the room (including sender)
        io.to(roomId).emit('chat:new', {
          id: savedMsg._id,
          sender: {
            id: currentUser.id,
            name: currentUser.name
          },
          message: savedMsg.message,
          createdAt: savedMsg.createdAt
        });
      } catch (err) {
        console.error('[Socket chat:send Error]:', err.message);
      }
    });

    // 4. Typing Indicator
    socket.on('user:typing', (data) => {
      if (!data || typeof data !== 'object') return;
      const { roomId, isTyping } = data;
      if (!roomId || typeof roomId !== 'string') return;

      // Ensure user has authorized membership and has joined the socket room
      if (!socket.rooms.has(roomId)) return;

      socket.to(roomId).emit('user:typing', {
        user: { id: currentUser.id, name: currentUser.name },
        isTyping: !!isTyping
      });
    });

    // 4b. Doubt Typing Indicator
    socket.on('doubt:typing', (data) => {
      if (!data || typeof data !== 'object') return;
      const { roomId, doubtId, isTyping } = data;
      if (!roomId || typeof roomId !== 'string' || !doubtId) return;

      if (!socket.rooms.has(roomId)) return;

      socket.to(roomId).emit('doubt:typing', {
        doubtId,
        user: { id: currentUser.id, name: currentUser.name },
        isTyping: !!isTyping
      });
    });

    // 4c. Study Session Timer Sync
    socket.on('session:timer_sync', (data) => {
      if (!data || typeof data !== 'object') return;
      const { roomId, action, elapsedSeconds, mode } = data;
      if (!roomId || typeof roomId !== 'string') return;

      if (!socket.rooms.has(roomId)) return;

      socket.to(roomId).emit('session:timer_sync', {
        action,
        elapsedSeconds,
        mode,
        user: { id: currentUser.id, name: currentUser.name },
        timestamp: Date.now()
      });
    });

    // 5. Shared Notes Real-Time Sync
    socket.on('notes:update', async (data) => {
      if (!data || typeof data !== 'object') return;
      const { roomId, content } = data;
      if (!roomId || typeof roomId !== 'string' || typeof content !== 'string') return;

      // Ensure user has authorized membership and has joined the socket room
      if (!socket.rooms.has(roomId)) return;

      // Check if room is closed (read-only)
      const room = await Room.findById(roomId);
      if (!room || room.status === 'closed') return;

      // Broadcast changes immediately to peers in the room
      socket.to(roomId).emit('notes:changed', {
        content,
        lastEditedBy: currentUser.name,
        updatedAt: new Date()
      });

      // Debounce saving to MongoDB (write every 2 seconds of inactivity)
      if (notesSaveTimers.has(roomId)) {
        clearTimeout(notesSaveTimers.get(roomId));
      }
      const timer = setTimeout(async () => {
        try {
          await SharedNote.findOneAndUpdate(
            { roomId },
            { content, lastEditedBy: currentUser.id },
            { upsert: true }
          );
          notesSaveTimers.delete(roomId);
        } catch (dbErr) {
          console.error('[Notes DB Save Error]:', dbErr.message);
        }
      }, 2000);
      notesSaveTimers.set(roomId, timer);
    });

    // 6. Collaborative Whiteboard Vector Strokes
    socket.on('whiteboard:draw', async (data) => {
      if (!data || typeof data !== 'object') return;
      const { roomId, stroke } = data;
      if (!roomId || typeof roomId !== 'string' || !stroke || typeof stroke !== 'object') return;

      // Ensure user has authorized membership and has joined the socket room
      if (!socket.rooms.has(roomId)) return;

      const room = await Room.findById(roomId);
      if (!room || room.status === 'closed') return;

      // Broadcast stroke to all other participants
      socket.to(roomId).emit('whiteboard:draw', stroke);
    });

    // 7. Clear Whiteboard
    socket.on('whiteboard:clear', async (data) => {
      try {
        if (!data || typeof data !== 'object') return;
        const { roomId } = data;
        if (!roomId || typeof roomId !== 'string') return;

        // Ensure user has authorized membership and has joined the socket room
        if (!socket.rooms.has(roomId)) return;

        const room = await Room.findById(roomId);
        if (!room || room.status === 'closed') return;

        io.to(roomId).emit('whiteboard:clear');

        await Whiteboard.findOneAndUpdate(
          { roomId },
          { strokes: [], lastUpdatedBy: currentUser.id },
          { upsert: true }
        );
      } catch (err) {
        console.error('[Whiteboard Clear DB Error]:', err.message);
      }
    });

    // ============================================================
    // WebRTC Live Audio, Video Calling & Screen Sharing Signaling
    // ============================================================

    // 7. Join Live Audio/Video Call
    socket.on('webrtc:join-call', async (data) => {
      try {
        if (!data || typeof data !== 'object') return;
        const { roomId, micMuted, camOff } = data;
        if (!roomId || typeof roomId !== 'string') return;

        // Verify membership in database
        const isMember = await RoomMember.findOne({ roomId, userId: currentUser.id });
        if (!isMember && currentUser.role !== 'admin') {
          socket.emit('webrtc:error', { message: 'Unauthorized: You must be a member of this study room to join the call.' });
          return;
        }

        // Check if room is closed
        const room = await Room.findById(roomId);
        if (!room || room.status === 'closed') {
          socket.emit('webrtc:error', { message: 'This study room is closed and currently in read-only mode.' });
          return;
        }

        if (!activeCallPeers.has(roomId)) {
          activeCallPeers.set(roomId, new Map());
        }
        const callMap = activeCallPeers.get(roomId);

        // Gather existing peers in call before adding current user
        const existingPeers = Array.from(callMap.values()).map(p => ({
          socketId: p.socketId,
          userId: p.userId,
          userName: p.userName,
          micMuted: !!p.micMuted,
          camOff: !!p.camOff,
          isSharingScreen: p.isSharingScreen || false
        }));

        const newPeerInfo = {
          socketId: socket.id,
          userId: currentUser.id,
          userName: currentUser.name,
          micMuted: !!micMuted,
          camOff: !!camOff,
          isSharingScreen: false
        };

        callMap.set(socket.id, newPeerInfo);

        // Send existing peers & current screen sharer back to the joiner
        const currentSharer = activeScreenSharers.get(roomId) || null;
        socket.emit('webrtc:existing-peers', {
          peers: existingPeers,
          activeScreenSharer: currentSharer
        });

        // Notify other participants in the room
        socket.to(roomId).emit('webrtc:peer-joined-call', {
          peer: newPeerInfo
        });

        // Broadcast updated call roster to the room
        broadcastCallRoster(io, roomId);
        console.log(`[WebRTC] ${currentUser.name} (${socket.id}) joined audio/video call in room: ${roomId}`);
      } catch (err) {
        console.error('[WebRTC join-call Error]:', err.message);
      }
    });

    // 8. Relay WebRTC Signal (Offer / Answer / ICE Candidate)
    socket.on('webrtc:signal', (data) => {
      try {
        if (!data || typeof data !== 'object') return;
        const { to, signal, roomId } = data;
        if (!to || !signal) return;

        // Direct forward to target peer
        io.to(to).emit('webrtc:signal', {
          from: socket.id,
          signal,
          fromUser: {
            id: currentUser.id,
            name: currentUser.name
          }
        });
      } catch (err) {
        console.error('[WebRTC signal Error]:', err.message);
      }
    });

    // 9. Update Participant Media State (Microphone / Camera)
    socket.on('webrtc:media-state', (data) => {
      try {
        if (!data || typeof data !== 'object') return;
        const { roomId, micMuted, camOff } = data;
        if (!roomId || typeof roomId !== 'string') return;

        if (activeCallPeers.has(roomId)) {
          const callMap = activeCallPeers.get(roomId);
          if (callMap.has(socket.id)) {
            const peer = callMap.get(socket.id);
            if (typeof micMuted === 'boolean') peer.micMuted = micMuted;
            if (typeof camOff === 'boolean') peer.camOff = camOff;
          }
        }

        socket.to(roomId).emit('webrtc:peer-media-state', {
          socketId: socket.id,
          micMuted: !!micMuted,
          camOff: !!camOff
        });

        broadcastCallRoster(io, roomId);
      } catch (err) {
        console.error('[WebRTC media-state Error]:', err.message);
      }
    });

    // 10. Start Screen Sharing
    socket.on('webrtc:screen-share-start', (data) => {
      try {
        if (!data || typeof data !== 'object') return;
        const { roomId } = data;
        if (!roomId || typeof roomId !== 'string') return;

        const currentSharer = activeScreenSharers.get(roomId);
        if (currentSharer && currentSharer.socketId !== socket.id) {
          socket.emit('webrtc:screen-share-rejected', {
            message: `${currentSharer.userName} is already sharing their screen. Only one participant can share at a time.`
          });
          return;
        }

        const sharerInfo = {
          socketId: socket.id,
          userId: currentUser.id,
          userName: currentUser.name
        };
        activeScreenSharers.set(roomId, sharerInfo);

        if (activeCallPeers.has(roomId)) {
          const peer = activeCallPeers.get(roomId).get(socket.id);
          if (peer) peer.isSharingScreen = true;
        }

        io.to(roomId).emit('webrtc:screen-share-started', sharerInfo);
        broadcastCallRoster(io, roomId);
        console.log(`[WebRTC] ${currentUser.name} started screen sharing in room: ${roomId}`);
      } catch (err) {
        console.error('[WebRTC screen-share-start Error]:', err.message);
      }
    });

    // 11. Stop Screen Sharing
    socket.on('webrtc:screen-share-stop', (data) => {
      try {
        if (!data || typeof data !== 'object') return;
        const { roomId } = data;
        if (!roomId || typeof roomId !== 'string') return;

        const currentSharer = activeScreenSharers.get(roomId);
        if (currentSharer && currentSharer.socketId === socket.id) {
          activeScreenSharers.delete(roomId);

          if (activeCallPeers.has(roomId)) {
            const peer = activeCallPeers.get(roomId).get(socket.id);
            if (peer) peer.isSharingScreen = false;
          }

          io.to(roomId).emit('webrtc:screen-share-stopped', {
            socketId: socket.id,
            userName: currentUser.name
          });
          broadcastCallRoster(io, roomId);
          console.log(`[WebRTC] ${currentUser.name} stopped screen sharing in room: ${roomId}`);
        }
      } catch (err) {
        console.error('[WebRTC screen-share-stop Error]:', err.message);
      }
    });

    // 12. Leave Live Audio/Video Call
    socket.on('webrtc:leave-call', (data) => {
      try {
        if (!data || typeof data !== 'object') return;
        const { roomId } = data;
        if (!roomId || typeof roomId !== 'string') return;

        const wasSharing = removePeerFromCall(roomId, socket.id);
        if (wasSharing) {
          io.to(roomId).emit('webrtc:screen-share-stopped', {
            socketId: socket.id,
            userName: currentUser.name
          });
        }

        socket.to(roomId).emit('webrtc:peer-left-call', {
          socketId: socket.id,
          userName: currentUser.name
        });

        broadcastCallRoster(io, roomId);
        console.log(`[WebRTC] ${currentUser.name} (${socket.id}) left audio/video call in room: ${roomId}`);
      } catch (err) {
        console.error('[WebRTC leave-call Error]:', err.message);
      }
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Student disconnected: ${currentUser.name}`);
      joinedRooms.forEach((roomId) => {
        removeUserFromRoomPresence(roomId, currentUser.id);
        broadcastPresence(io, roomId);

        // Also clean up from WebRTC calls if connected
        const wasSharing = removePeerFromCall(roomId, socket.id);
        if (wasSharing) {
          io.to(roomId).emit('webrtc:screen-share-stopped', {
            socketId: socket.id,
            userName: currentUser.name
          });
        }
        socket.to(roomId).emit('webrtc:peer-left-call', {
          socketId: socket.id,
          userName: currentUser.name
        });
        broadcastCallRoster(io, roomId);
      });
      joinedRooms.clear();
    });
  });

  function removeUserFromRoomPresence(roomId, userId) {
    if (activeRoomUsers.has(roomId)) {
      const roomMap = activeRoomUsers.get(roomId);
      if (roomMap.has(userId)) {
        const item = roomMap.get(userId);
        item.socketCount -= 1;
        if (item.socketCount <= 0) {
          roomMap.delete(userId);
        }
      }
      if (roomMap.size === 0) {
        activeRoomUsers.delete(roomId);
      }
    }
  }

  function broadcastPresence(io, roomId) {
    const roomMap = activeRoomUsers.get(roomId);
    const activeUsers = roomMap
      ? Array.from(roomMap.values()).map(u => ({ id: u.id, name: u.name }))
      : [];
    io.to(roomId).emit('presence:update', { activeUsers });
  }

  function removePeerFromCall(roomId, socketId) {
    let wasSharing = false;
    if (activeScreenSharers.has(roomId)) {
      const sharer = activeScreenSharers.get(roomId);
      if (sharer && sharer.socketId === socketId) {
        activeScreenSharers.delete(roomId);
        wasSharing = true;
      }
    }
    if (activeCallPeers.has(roomId)) {
      const callMap = activeCallPeers.get(roomId);
      callMap.delete(socketId);
      if (callMap.size === 0) {
        activeCallPeers.delete(roomId);
      }
    }
    return wasSharing;
  }

  function broadcastCallRoster(io, roomId) {
    const callMap = activeCallPeers.get(roomId);
    const activePeers = callMap
      ? Array.from(callMap.values()).map(p => ({
          socketId: p.socketId,
          userId: p.userId,
          userName: p.userName,
          micMuted: !!p.micMuted,
          camOff: !!p.camOff,
          isSharingScreen: !!p.isSharingScreen
        }))
      : [];
    const currentSharer = activeScreenSharers.get(roomId) || null;
    io.to(roomId).emit('webrtc:call-roster-update', {
      activePeers,
      activeScreenSharer: currentSharer
    });
  }

  return io;
}

module.exports = initSocketIO;
