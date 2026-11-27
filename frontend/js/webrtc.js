/**
 * StudySync AI - WebRTC Real-Time Audio, Video Calling & Screen Sharing Client Engine
 * 
 * Mesh Architecture with STUN ICE servers and Socket.IO signaling.
 * Handles microphone mute/unmute, camera start/stop, screen sharing (getDisplayMedia),
 * dynamic video gallery layout, spotlight screen viewer, and participant presence.
 */

(function () {
  'use strict';

  // Global WebRTC Call State
  const webrtcState = {
    socket: null,
    roomId: null,
    currentUser: null,
    isOwner: false,
    inCall: false,
    localStream: null,
    screenStream: null,
    micMuted: false,
    camOff: false,
    isSharingScreen: false,
    // Active WebRTC Peer Connections: peerSocketId -> { pc, userName, userId, stream, videoEl, audioEl, micMuted, camOff, isSharingScreen }
    peers: new Map(),
    // ICE candidate queue for trickle candidates arriving before remote description is set
    iceCandidateQueues: new Map(),
    activeScreenSharer: null,
    activeCallPeersList: []
  };

  // Google Public STUN Configuration for WebRTC NAT Traversal
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' }
    ]
  };

  /**
   * Main Initialization Function called from workspace.js
   */
  function initWebRTC(socket, roomId, currentUser, isOwner = false) {
    webrtcState.socket = socket;
    webrtcState.roomId = roomId;
    webrtcState.currentUser = currentUser;
    webrtcState.isOwner = isOwner;

    // Check browser compatibility
    if (!navigator.mediaDevices || !window.RTCPeerConnection) {
      console.warn('[WebRTC] WebRTC APIs not supported in this browser.');
      const statusText = document.getElementById('callStatusText');
      if (statusText) statusText.textContent = 'WebRTC Unsupported';
      return;
    }

    setupDOMEventListeners();
    setupSocketEventListeners();

    // Populate local avatar initials
    const initials = (currentUser.name || 'ST')
      .split(' ')
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    const localAvatar = document.getElementById('localAvatarInitials');
    if (localAvatar) localAvatar.textContent = initials;

    const localTileName = document.getElementById('localTileName');
    if (localTileName) localTileName.textContent = `${currentUser.name} (You)`;

    // Clean up tracks when tab closes
    window.addEventListener('beforeunload', () => {
      leaveCall();
    });

    console.log('[WebRTC Engine] Initialized for room:', roomId);
  }

  /**
   * 1. Setup DOM Event Listeners
   */
  function setupDOMEventListeners() {
    const btnToggleCall = document.getElementById('btnToggleCall');
    const btnPrejoinStart = document.getElementById('btnPrejoinStart');
    const btnToggleMic = document.getElementById('btnToggleMic');
    const btnToggleCam = document.getElementById('btnToggleCam');
    const btnToggleScreen = document.getElementById('btnToggleScreen');
    const btnFullscreenScreen = document.getElementById('btnFullscreenScreen');

    btnToggleCall?.addEventListener('click', () => {
      if (!webrtcState.inCall) {
        joinCall();
      } else {
        leaveCall();
      }
    });

    btnPrejoinStart?.addEventListener('click', () => {
      joinCall();
    });

    btnToggleMic?.addEventListener('click', toggleMicrophone);
    btnToggleCam?.addEventListener('click', toggleCamera);
    btnToggleScreen?.addEventListener('click', toggleScreenShare);

    btnFullscreenScreen?.addEventListener('click', () => {
      const screenVid = document.getElementById('screenShareVideo');
      if (screenVid) {
        if (!document.fullscreenElement) {
          screenVid.requestFullscreen().catch(err => console.warn(err));
        } else {
          document.exitFullscreen().catch(err => console.warn(err));
        }
      }
    });

    // Keyboard Shortcuts (Ctrl+M: Mic, Ctrl+E: Cam, Ctrl+S: Screen)
    window.addEventListener('keydown', (e) => {
      if (!webrtcState.inCall) return;
      // Do not trigger if typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMicrophone();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        toggleCamera();
      }
    });
  }

  /**
   * 2. Setup Socket.IO Signaling Event Listeners
   */
  function setupSocketEventListeners() {
    const socket = webrtcState.socket;
    if (!socket) return;

    // A. Received list of existing peers in the call upon joining
    socket.on('webrtc:existing-peers', async (data) => {
      const peers = data.peers || [];
      console.log(`[WebRTC] Existing peers in call:`, peers.length);

      // If someone is already sharing their screen
      if (data.activeScreenSharer) {
        handleRemoteScreenShareStarted(data.activeScreenSharer);
      }

      // As the new joiner, initiate peer connection with all existing peers
      for (const peer of peers) {
        await initiatePeerConnection(peer.socketId, peer.userName, peer.userId, peer.micMuted, peer.camOff, peer.isSharingScreen);
      }
    });

    // B. Another peer joined the call
    socket.on('webrtc:peer-joined-call', (data) => {
      if (!data || !data.peer) return;
      const peer = data.peer;
      console.log(`[WebRTC] Peer joined call: ${peer.userName} (${peer.socketId})`);
      showToast(`${peer.userName} joined the study call.`);

      // Wait for the new peer to send an SDP offer
      ensurePeerRecord(peer.socketId, peer.userName, peer.userId, peer.micMuted, peer.camOff, peer.isSharingScreen);
    });

    // C. WebRTC Signaling Message (Offer / Answer / ICE Candidate)
    socket.on('webrtc:signal', async (data) => {
      const { from, signal, fromUser } = data;
      if (!signal || !from) return;

      if (signal.type === 'offer') {
        await handleOffer(from, signal.sdp, fromUser);
      } else if (signal.type === 'answer') {
        await handleAnswer(from, signal.sdp);
      } else if (signal.type === 'ice-candidate') {
        await handleIceCandidate(from, signal.candidate);
      }
    });

    // D. Remote peer updated media state (Mute / Camera)
    socket.on('webrtc:peer-media-state', (data) => {
      const { socketId, micMuted, camOff } = data;
      const peerData = webrtcState.peers.get(socketId);
      if (peerData) {
        peerData.micMuted = micMuted;
        peerData.camOff = camOff;
        updatePeerTileState(socketId);
      }
    });

    // E. Screen Sharing Events
    socket.on('webrtc:screen-share-started', (data) => {
      console.log(`[WebRTC] Screen sharing started by: ${data.userName}`);
      showToast(`🖥️ ${data.userName} started sharing their screen.`);
      handleRemoteScreenShareStarted(data);
    });

    socket.on('webrtc:screen-share-stopped', (data) => {
      console.log(`[WebRTC] Screen sharing stopped by: ${data.userName}`);
      showToast(`🖥️ Screen sharing stopped.`);
      handleRemoteScreenShareStopped();
    });

    socket.on('webrtc:screen-share-rejected', (data) => {
      alert(data.message || 'Cannot share screen right now.');
      stopLocalScreenShare();
    });

    // F. Peer left the call
    socket.on('webrtc:peer-left-call', (data) => {
      const { socketId, userName } = data;
      if (socketId) {
        console.log(`[WebRTC] Peer left call: ${socketId}`);
        if (userName) showToast(`${userName} left the study call.`);
        closePeerConnection(socketId);
      }
    });

    // G. Roster updates for all connected peers
    socket.on('webrtc:call-roster-update', (data) => {
      webrtcState.activeCallPeersList = data.activePeers || [];
      webrtcState.activeScreenSharer = data.activeScreenSharer || null;
      updateRosterCallIcons();
      updateCallBadgeCount();
    });

    // H. General WebRTC error from server
    socket.on('webrtc:error', (err) => {
      alert(err.message || 'Call signaling error.');
    });
  }

  /**
   * 3. Join the Live Audio & Video Call
   */
  async function joinCall() {
    if (webrtcState.inCall) return;

    setCallStatus('connecting', 'Connecting...');
    const btnToggle = document.getElementById('btnToggleCall');
    if (btnToggle) btnToggle.disabled = true;

    try {
      // Request microphone and camera permissions
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: {
            width: { ideal: 640 },
            height: { ideal: 360 },
            frameRate: { ideal: 24 }
          }
        });
      } catch (mediaErr) {
        console.warn('[WebRTC] Video+Audio permission failed, trying audio only:', mediaErr.message);
        // Fallback: Attempt Audio Only if camera was blocked or unavailable
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: false
          });
          webrtcState.camOff = true;
        } catch (audioErr) {
          throw new Error('Microphone permission was denied or no input device was found. Please allow microphone access in your browser settings to join the call.');
        }
      }

      webrtcState.localStream = stream;
      webrtcState.inCall = true;

      // Attach local stream to self-view
      const localVideo = document.getElementById('localVideoFeed');
      if (localVideo) {
        localVideo.srcObject = stream;
      }

      // Check initial camera state
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        webrtcState.camOff = true;
      }
      updateLocalTileVisuals();

      // Emit join event via Socket.IO
      webrtcState.socket.emit('webrtc:join-call', {
        roomId: webrtcState.roomId,
        micMuted: webrtcState.micMuted,
        camOff: webrtcState.camOff
      });

      // Update UI Controls
      updateCallControlsState(true);
      setCallStatus('connected', 'Call Connected');
      showToast('Joined live study call.');

      // Switch stage to Live Call view if currently on notes
      const tabMedia = document.getElementById('tabBtnMedia');
      tabMedia?.click();

    } catch (err) {
      console.error('[WebRTC Join Error]:', err);
      alert(err.message || 'Could not join live call.');
      setCallStatus('offline', 'Call Disconnected');
      updateCallControlsState(false);
    } finally {
      if (btnToggle) btnToggle.disabled = false;
    }
  }

  /**
   * 4. Leave the Live Call
   */
  function leaveCall() {
    if (!webrtcState.inCall) return;

    console.log('[WebRTC] Leaving live call...');

    // Stop screen sharing if active
    if (webrtcState.isSharingScreen) {
      stopLocalScreenShare();
    }

    // Stop local camera and microphone tracks
    if (webrtcState.localStream) {
      webrtcState.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`[WebRTC] Stopped track: ${track.kind}`);
      });
      webrtcState.localStream = null;
    }

    // Disconnect local video element
    const localVideo = document.getElementById('localVideoFeed');
    if (localVideo) localVideo.srcObject = null;

    // Close all P2P connections
    webrtcState.peers.forEach((peer, socketId) => {
      closePeerConnection(socketId);
    });
    webrtcState.peers.clear();
    webrtcState.iceCandidateQueues.clear();

    // Notify backend
    if (webrtcState.socket && webrtcState.socket.connected) {
      webrtcState.socket.emit('webrtc:leave-call', {
        roomId: webrtcState.roomId
      });
    }

    webrtcState.inCall = false;
    webrtcState.micMuted = false;
    webrtcState.camOff = false;
    webrtcState.isSharingScreen = false;

    // Reset UI
    updateCallControlsState(false);
    setCallStatus('offline', 'Call Disconnected');
    handleRemoteScreenShareStopped();

    const gallery = document.getElementById('videoGridGallery');
    const prejoin = document.getElementById('callPrejoinBanner');
    if (gallery) gallery.classList.add('hidden');
    if (prejoin) prejoin.classList.remove('hidden');

    showToast('Left study call.');
  }

  /**
   * 5. Initiate P2P Connection (Caller / Offer Role)
   */
  async function initiatePeerConnection(peerSocketId, peerUserName, peerUserId, micMuted = false, camOff = false, isSharingScreen = false) {
    if (webrtcState.peers.has(peerSocketId)) return;

    console.log(`[WebRTC] Creating P2P offer for peer: ${peerUserName} (${peerSocketId})`);
    const pc = createPeerConnection(peerSocketId, peerUserName, peerUserId, micMuted, camOff, isSharingScreen);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      webrtcState.socket.emit('webrtc:signal', {
        to: peerSocketId,
        signal: { type: 'offer', sdp: offer },
        roomId: webrtcState.roomId
      });
    } catch (err) {
      console.error(`[WebRTC Offer Error] peer ${peerSocketId}:`, err);
    }
  }

  /**
   * 6. Handle Incoming SDP Offer (Callee / Answer Role)
   */
  async function handleOffer(fromSocketId, offerSdp, fromUser) {
    console.log(`[WebRTC] Received offer from: ${fromUser?.name || fromSocketId}`);
    let pc;

    if (webrtcState.peers.has(fromSocketId)) {
      pc = webrtcState.peers.get(fromSocketId).pc;
    } else {
      pc = createPeerConnection(fromSocketId, fromUser?.name || 'Peer', fromUser?.id);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));

      // Flush any queued ICE candidates received before remote description
      await flushIceCandidates(fromSocketId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      webrtcState.socket.emit('webrtc:signal', {
        to: fromSocketId,
        signal: { type: 'answer', sdp: answer },
        roomId: webrtcState.roomId
      });
    } catch (err) {
      console.error(`[WebRTC Handle Offer Error] from ${fromSocketId}:`, err);
    }
  }

  /**
   * 7. Handle Incoming SDP Answer
   */
  async function handleAnswer(fromSocketId, answerSdp) {
    console.log(`[WebRTC] Received answer from: ${fromSocketId}`);
    const peerData = webrtcState.peers.get(fromSocketId);
    if (!peerData || !peerData.pc) return;

    try {
      await peerData.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
      // Flush queued candidates
      await flushIceCandidates(fromSocketId, peerData.pc);
    } catch (err) {
      console.error(`[WebRTC Handle Answer Error] from ${fromSocketId}:`, err);
    }
  }

  /**
   * 8. Handle Incoming ICE Candidate
   */
  async function handleIceCandidate(fromSocketId, candidate) {
    const peerData = webrtcState.peers.get(fromSocketId);
    if (peerData && peerData.pc && peerData.pc.remoteDescription) {
      try {
        await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(`[WebRTC ICE Add Error] from ${fromSocketId}:`, err.message);
      }
    } else {
      // Queue candidate until remote description is set
      if (!webrtcState.iceCandidateQueues.has(fromSocketId)) {
        webrtcState.iceCandidateQueues.set(fromSocketId, []);
      }
      webrtcState.iceCandidateQueues.get(fromSocketId).push(candidate);
    }
  }

  async function flushIceCandidates(fromSocketId, pc) {
    const queue = webrtcState.iceCandidateQueues.get(fromSocketId) || [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC Flush ICE Error]:', err.message);
      }
    }
    webrtcState.iceCandidateQueues.delete(fromSocketId);
  }

  /**
   * 9. Create and Configure an RTCPeerConnection Instance
   */
  function createPeerConnection(peerSocketId, peerUserName, peerUserId, micMuted = false, camOff = false, isSharingScreen = false) {
    const pc = new RTCPeerConnection(rtcConfig);

    // Add local media tracks to peer connection
    if (webrtcState.localStream) {
      webrtcState.localStream.getTracks().forEach(track => {
        pc.addTrack(track, webrtcState.localStream);
      });
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && webrtcState.socket) {
        webrtcState.socket.emit('webrtc:signal', {
          to: peerSocketId,
          signal: { type: 'ice-candidate', candidate: event.candidate },
          roomId: webrtcState.roomId
        });
      }
    };

    // Remote Track Listener (Audio & Video)
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track (${event.track.kind}) from ${peerUserName}`);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      attachRemoteMediaStream(peerSocketId, peerUserName, remoteStream, micMuted, camOff);
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${peerUserName}: ${pc.connectionState}`);
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        // Handle peer disconnection gracefully
        setTimeout(() => {
          if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
            closePeerConnection(peerSocketId);
          }
        }, 3000);
      }
    };

    ensurePeerRecord(peerSocketId, peerUserName, peerUserId, micMuted, camOff, isSharingScreen, pc);
    return pc;
  }

  function ensurePeerRecord(peerSocketId, peerUserName, peerUserId, micMuted = false, camOff = false, isSharingScreen = false, pc = null) {
    if (!webrtcState.peers.has(peerSocketId)) {
      webrtcState.peers.set(peerSocketId, {
        pc,
        userName: peerUserName,
        userId: peerUserId,
        stream: null,
        videoEl: null,
        audioEl: null,
        micMuted,
        camOff,
        isSharingScreen
      });
      createRemoteVideoTile(peerSocketId, peerUserName, micMuted, camOff);
    } else {
      const record = webrtcState.peers.get(peerSocketId);
      if (pc) record.pc = pc;
      if (peerUserName) record.userName = peerUserName;
      record.micMuted = micMuted;
      record.camOff = camOff;
      record.isSharingScreen = isSharingScreen;
      updatePeerTileState(peerSocketId);
    }
  }

  /**
   * 10. Attach Remote Stream to Dynamic Video Tile
   */
  function attachRemoteMediaStream(peerSocketId, peerUserName, stream, micMuted, camOff) {
    let peer = webrtcState.peers.get(peerSocketId);
    if (!peer) {
      ensurePeerRecord(peerSocketId, peerUserName);
      peer = webrtcState.peers.get(peerSocketId);
    }
    peer.stream = stream;

    // Attach to remote video element
    const videoEl = document.getElementById(`remoteVideo-${peerSocketId}`);
    if (videoEl) {
      videoEl.srcObject = stream;
      videoEl.play().catch(e => console.warn('[Video Play Error]:', e.message));
    }

    // Monitor remote video track state
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onmute = () => {
        peer.camOff = true;
        updatePeerTileState(peerSocketId);
      };
      videoTrack.onunmute = () => {
        peer.camOff = false;
        updatePeerTileState(peerSocketId);
      };
    }

    updatePeerTileState(peerSocketId);
  }

  /**
   * 11. Create Remote Video Tile DOM Element
   */
  function createRemoteVideoTile(peerSocketId, peerUserName, micMuted = false, camOff = false) {
    const gallery = document.getElementById('videoGridGallery');
    if (!gallery) return;

    // Remove if tile already exists
    const existing = document.getElementById(`tile-${peerSocketId}`);
    if (existing) existing.remove();

    const initials = (peerUserName || 'Peer')
      .split(' ')
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = `tile-${peerSocketId}`;

    tile.innerHTML = `
      <div class="video-feed-wrap">
        <video id="remoteVideo-${peerSocketId}" autoplay playsinline></video>
        <div class="cam-off-avatar ${camOff ? '' : 'hidden'}" id="avatar-${peerSocketId}">
          <div class="avatar-circle-lg">${initials}</div>
          <span class="avatar-status-label">Camera is off</span>
        </div>
      </div>
      <div class="video-tile-footer">
        <span class="tile-user-name">${escapeHTML(peerUserName)}</span>
        <div class="tile-status-badges">
          <span class="badge-mic ${micMuted ? 'muted' : 'active'}" id="micBadge-${peerSocketId}">
            ${micMuted ? '🔇' : '🎤'}
          </span>
          <span class="badge-screen hidden" id="screenBadge-${peerSocketId}">🖥️</span>
        </div>
      </div>
    `;

    gallery.appendChild(tile);
  }

  function updatePeerTileState(peerSocketId) {
    const peer = webrtcState.peers.get(peerSocketId);
    if (!peer) return;

    const avatar = document.getElementById(`avatar-${peerSocketId}`);
    const video = document.getElementById(`remoteVideo-${peerSocketId}`);
    const micBadge = document.getElementById(`micBadge-${peerSocketId}`);
    const screenBadge = document.getElementById(`screenBadge-${peerSocketId}`);

    if (avatar && video) {
      if (peer.camOff) {
        avatar.classList.remove('hidden');
        video.style.opacity = '0';
      } else {
        avatar.classList.add('hidden');
        video.style.opacity = '1';
      }
    }

    if (micBadge) {
      if (peer.micMuted) {
        micBadge.className = 'badge-mic muted';
        micBadge.textContent = '🔇';
      } else {
        micBadge.className = 'badge-mic active';
        micBadge.textContent = '🎤';
      }
    }

    if (screenBadge) {
      if (peer.isSharingScreen) {
        screenBadge.classList.remove('hidden');
      } else {
        screenBadge.classList.add('hidden');
      }
    }
  }

  function closePeerConnection(peerSocketId) {
    if (webrtcState.peers.has(peerSocketId)) {
      const peer = webrtcState.peers.get(peerSocketId);
      if (peer.pc) {
        peer.pc.close();
      }
      webrtcState.peers.delete(peerSocketId);
    }
    webrtcState.iceCandidateQueues.delete(peerSocketId);

    // Remove video tile from DOM
    const tile = document.getElementById(`tile-${peerSocketId}`);
    if (tile) tile.remove();

    // If this peer was sharing screen, close spotlight
    if (webrtcState.activeScreenSharer && webrtcState.activeScreenSharer.socketId === peerSocketId) {
      handleRemoteScreenShareStopped();
    }
  }

  /**
   * 12. Microphone Toggle (Mute / Unmute)
   */
  function toggleMicrophone() {
    if (!webrtcState.inCall || !webrtcState.localStream) return;

    const audioTrack = webrtcState.localStream.getAudioTracks()[0];
    if (!audioTrack) {
      alert('No active microphone track found.');
      return;
    }

    webrtcState.micMuted = !webrtcState.micMuted;
    audioTrack.enabled = !webrtcState.micMuted;

    // Update UI button
    const btnMic = document.getElementById('btnToggleMic');
    const lblMic = document.getElementById('lblMic');
    const iconMic = document.getElementById('iconMic');
    const localMicBadge = document.getElementById('localMicBadge');

    if (webrtcState.micMuted) {
      btnMic?.classList.add('muted');
      if (lblMic) lblMic.textContent = 'Unmute';
      if (iconMic) iconMic.textContent = '🔇';
      if (localMicBadge) {
        localMicBadge.className = 'badge-mic muted';
        localMicBadge.textContent = '🔇';
      }
    } else {
      btnMic?.classList.remove('muted');
      if (lblMic) lblMic.textContent = 'Mute';
      if (iconMic) iconMic.textContent = '🎤';
      if (localMicBadge) {
        localMicBadge.className = 'badge-mic active';
        localMicBadge.textContent = '🎤';
      }
    }

    // Broadcast media state update to peers
    webrtcState.socket.emit('webrtc:media-state', {
      roomId: webrtcState.roomId,
      micMuted: webrtcState.micMuted,
      camOff: webrtcState.camOff
    });
  }

  /**
   * 13. Camera Toggle (Start / Stop Video)
   */
  async function toggleCamera() {
    if (!webrtcState.inCall || !webrtcState.localStream) return;

    const videoTrack = webrtcState.localStream.getVideoTracks()[0];
    const btnCam = document.getElementById('btnToggleCam');
    const lblCam = document.getElementById('lblCam');
    const iconCam = document.getElementById('iconCam');

    if (!videoTrack) {
      // Camera was not acquired during join; attempt to acquire now
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = camStream.getVideoTracks()[0];
        webrtcState.localStream.addTrack(newTrack);

        // Add track to all active peer connections
        webrtcState.peers.forEach(peer => {
          if (peer.pc) peer.pc.addTrack(newTrack, webrtcState.localStream);
        });

        webrtcState.camOff = false;
        const localVideo = document.getElementById('localVideoFeed');
        if (localVideo) localVideo.srcObject = webrtcState.localStream;
      } catch (err) {
        alert('Could not enable camera: ' + err.message);
        return;
      }
    } else {
      webrtcState.camOff = !webrtcState.camOff;
      videoTrack.enabled = !webrtcState.camOff;
    }

    if (webrtcState.camOff) {
      btnCam?.classList.add('cam-off');
      if (lblCam) lblCam.textContent = 'Start Video';
      if (iconCam) iconCam.textContent = '📷';
    } else {
      btnCam?.classList.remove('cam-off');
      if (lblCam) lblCam.textContent = 'Stop Video';
      if (iconCam) iconCam.textContent = '📹';
    }

    updateLocalTileVisuals();

    // Broadcast media state update to peers
    webrtcState.socket.emit('webrtc:media-state', {
      roomId: webrtcState.roomId,
      micMuted: webrtcState.micMuted,
      camOff: webrtcState.camOff
    });
  }

  function updateLocalTileVisuals() {
    const avatar = document.getElementById('localAvatarPlaceholder');
    const video = document.getElementById('localVideoFeed');

    if (avatar && video) {
      if (webrtcState.camOff) {
        avatar.classList.remove('hidden');
        video.style.opacity = '0';
      } else {
        avatar.classList.add('hidden');
        video.style.opacity = '1';
      }
    }
  }

  /**
   * 14. Screen Sharing Toggle (getDisplayMedia)
   */
  async function toggleScreenShare() {
    if (!webrtcState.inCall) return;

    if (webrtcState.isSharingScreen) {
      stopLocalScreenShare();
      return;
    }

    try {
      // Request screen capture from browser
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      webrtcState.screenStream = screenStream;
      webrtcState.isSharingScreen = true;

      // Handle user ending share via browser's native stop button
      screenTrack.onended = () => {
        stopLocalScreenShare();
      };

      // Replace video track on all peer connections with the screen share track
      replaceVideoTrackOnPeers(screenTrack);

      // Show screen share in self preview / spotlight
      const localScreenBadge = document.getElementById('localScreenBadge');
      if (localScreenBadge) localScreenBadge.classList.remove('hidden');

      const btnScreen = document.getElementById('btnToggleScreen');
      const lblScreen = document.getElementById('lblScreen');
      if (btnScreen) {
        btnScreen.classList.add('screen-active');
        if (lblScreen) lblScreen.textContent = 'Stop Sharing';
      }

      // Notify room via Socket.IO
      webrtcState.socket.emit('webrtc:screen-share-start', {
        roomId: webrtcState.roomId
      });

      // Display spotlight
      handleRemoteScreenShareStarted({
        socketId: webrtcState.socket.id,
        userName: `${webrtcState.currentUser.name} (You)`
      }, screenStream);

    } catch (err) {
      console.warn('[Screen Share Error]:', err.message);
      if (err.name !== 'NotAllowedError') {
        alert('Screen share failed: ' + err.message);
      }
      stopLocalScreenShare();
    }
  }

  function stopLocalScreenShare() {
    if (!webrtcState.isSharingScreen) return;

    if (webrtcState.screenStream) {
      webrtcState.screenStream.getTracks().forEach(t => t.stop());
      webrtcState.screenStream = null;
    }
    webrtcState.isSharingScreen = false;

    // Restore camera video track on all active peer connections
    const camTrack = webrtcState.localStream ? webrtcState.localStream.getVideoTracks()[0] : null;
    if (camTrack) {
      replaceVideoTrackOnPeers(camTrack);
    }

    const localScreenBadge = document.getElementById('localScreenBadge');
    if (localScreenBadge) localScreenBadge.classList.add('hidden');

    const btnScreen = document.getElementById('btnToggleScreen');
    const lblScreen = document.getElementById('lblScreen');
    if (btnScreen) {
      btnScreen.classList.remove('screen-active');
      if (lblScreen) lblScreen.textContent = 'Share Screen';
    }

    // Notify backend
    if (webrtcState.socket && webrtcState.socket.connected) {
      webrtcState.socket.emit('webrtc:screen-share-stop', {
        roomId: webrtcState.roomId
      });
    }

    handleRemoteScreenShareStopped();
  }

  function replaceVideoTrackOnPeers(newVideoTrack) {
    webrtcState.peers.forEach(peer => {
      if (peer.pc) {
        const senders = peer.pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack).catch(err => {
            console.warn('[ReplaceTrack Error]:', err);
          });
        }
      }
    });
  }

  /**
   * 15. Remote Screen Sharing Spotlight Handlers
   */
  function handleRemoteScreenShareStarted(sharerData, localScreenStream = null) {
    webrtcState.activeScreenSharer = sharerData;
    const spotlight = document.getElementById('screenShareSpotlight');
    const nameEl = document.getElementById('screenSharerName');
    const screenVid = document.getElementById('screenShareVideo');

    if (spotlight) spotlight.classList.remove('hidden');
    if (nameEl) nameEl.textContent = sharerData.userName;

    if (screenVid) {
      if (localScreenStream) {
        screenVid.srcObject = localScreenStream;
      } else {
        // Find stream from active peer
        const peer = webrtcState.peers.get(sharerData.socketId);
        if (peer && peer.stream) {
          screenVid.srcObject = peer.stream;
        }
      }
      screenVid.play().catch(e => console.warn(e));
    }
  }

  function handleRemoteScreenShareStopped() {
    webrtcState.activeScreenSharer = null;
    const spotlight = document.getElementById('screenShareSpotlight');
    const screenVid = document.getElementById('screenShareVideo');

    if (spotlight) spotlight.classList.add('hidden');
    if (screenVid) screenVid.srcObject = null;
  }

  /**
   * 16. UI Call Control State Updates
   */
  function updateCallControlsState(connected) {
    const btnToggle = document.getElementById('btnToggleCall');
    const lblToggle = document.getElementById('lblToggleCall');
    const btnMic = document.getElementById('btnToggleMic');
    const btnCam = document.getElementById('btnToggleCam');
    const btnScreen = document.getElementById('btnToggleScreen');
    const topbarShortcut = document.getElementById('btnTopbarCallShortcut');

    const prejoin = document.getElementById('callPrejoinBanner');
    const gallery = document.getElementById('videoGridGallery');

    if (connected) {
      if (btnToggle) {
        btnToggle.className = 'btn-call-control btn-call-primary leave-mode';
        if (lblToggle) lblToggle.textContent = 'Leave Call';
      }
      if (topbarShortcut) {
        topbarShortcut.classList.add('in-call');
        topbarShortcut.textContent = '🟢 In Call';
      }
      if (btnMic) btnMic.disabled = false;
      if (btnCam) btnCam.disabled = false;
      if (btnScreen) btnScreen.disabled = false;

      if (prejoin) prejoin.classList.add('hidden');
      if (gallery) gallery.classList.remove('hidden');
    } else {
      if (btnToggle) {
        btnToggle.className = 'btn-call-control btn-call-primary';
        if (lblToggle) lblToggle.textContent = 'Join Call';
      }
      if (topbarShortcut) {
        topbarShortcut.classList.remove('in-call');
        topbarShortcut.textContent = '📹 Live Call';
      }
      if (btnMic) btnMic.disabled = true;
      if (btnCam) btnCam.disabled = true;
      if (btnScreen) btnScreen.disabled = true;

      if (prejoin) prejoin.classList.remove('hidden');
      if (gallery) gallery.classList.add('hidden');
    }
  }

  function setCallStatus(status, text) {
    const dot = document.getElementById('callStatusDot');
    const statusText = document.getElementById('callStatusText');
    const badge = document.getElementById('callStatusBadge');

    if (dot) {
      dot.className = `call-status-dot ${status}`;
    }
    if (statusText) {
      statusText.textContent = text;
    }
    if (badge) {
      if (status === 'connected') {
        badge.classList.add('connected');
      } else {
        badge.classList.remove('connected');
      }
    }
  }

  function updateCallBadgeCount() {
    const count = webrtcState.activeCallPeersList.length;
    const badge = document.getElementById('callBadge');
    if (!badge) return;

    if (count > 0) {
      badge.textContent = `${count} Live`;
      badge.className = 'tab-badge badge-call-live';
    } else {
      badge.textContent = 'Off';
      badge.className = 'tab-badge badge-zero';
    }
  }

  function updateRosterCallIcons() {
    const activePeers = webrtcState.activeCallPeersList || [];
    document.querySelectorAll('.participant-item').forEach(item => {
      const userId = item.id.replace('participant-', '');
      const peer = activePeers.find(p => p.userId.toString() === userId.toString());

      let mediaIcons = item.querySelector('.roster-media-icons');
      if (!mediaIcons) {
        mediaIcons = document.createElement('div');
        mediaIcons.className = 'roster-media-icons';
        item.insertBefore(mediaIcons, item.querySelector('.presence-dot'));
      }

      if (peer) {
        const micIcon = peer.micMuted ? '🔇' : '🎤';
        const camIcon = peer.camOff ? '' : '📹';
        const screenIcon = peer.isSharingScreen ? '🖥️' : '';
        mediaIcons.innerHTML = `<span>${micIcon}</span>${camIcon ? `<span>${camIcon}</span>` : ''}${screenIcon ? `<span>${screenIcon}</span>` : ''}`;
      } else {
        mediaIcons.innerHTML = '';
      }
    });
  }

  function showToast(message) {
    let toast = document.getElementById('webrtcToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'webrtcToast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(15, 23, 42, 0.9);
        color: #FFFFFF;
        padding: 10px 20px;
        border-radius: 9999px;
        font-size: 13px;
        font-weight: 600;
        z-index: 1000;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        transition: opacity 200ms ease;
        backdrop-filter: blur(6px);
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.opacity = '0';
    }, 3200);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Expose methods on window for coordination with workspace.js
  window.initWebRTC = initWebRTC;
  window.webrtcJoinCall = joinCall;
  window.webrtcLeaveCall = leaveCall;
  window.webrtcIsInCall = () => webrtcState.inCall;

})();
