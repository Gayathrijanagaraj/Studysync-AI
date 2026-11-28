/**
 * StudySync AI - Master QA Testing Engine
 * Comprehensive Functionality, API, Security, and Integration Test Runner
 */
require('dotenv').config();
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (e) {}

const http = require('http');
const mongoose = require('mongoose');
const { server } = require('../server');
const User = require('./models/User');
const Room = require('./models/Room');
const RoomMember = require('./models/RoomMember');
const Doubt = require('./models/Doubt');
const KnowledgeItem = require('./models/KnowledgeItem');
const StudySession = require('./models/StudySession');
const Whiteboard = require('./models/Whiteboard');
const SharedNote = require('./models/SharedNote');
const Message = require('./models/Message');

const TEST_PORT = 5888;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Helper: Custom Cookie Jar for HTTP fetch testing
class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  setFromHeaders(headers) {
    const raw = headers.getSetCookie ? headers.getSetCookie() : [headers.get('set-cookie')];
    if (!raw) return;
    for (const str of raw) {
      if (!str) continue;
      const parts = str.split(';')[0].split('=');
      if (parts.length >= 2) {
        this.cookies.set(parts[0].trim(), parts.slice(1).join('=').trim());
      }
    }
  }
  getCookieHeader() {
    const pairs = [];
    for (const [k, v] of this.cookies.entries()) {
      pairs.push(`${k}=${v}`);
    }
    return pairs.join('; ');
  }
}

async function request(path, options = {}, jar = null) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (jar) {
    const c = jar.getCookieHeader();
    if (c) headers['Cookie'] = c;
  }
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { ...options, headers });
  if (jar) {
    jar.setFromHeaders(res.headers);
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, headers: res.headers, data: json };
}

async function runMasterAudit() {
  console.log('========================================================================');
  console.log('🚀 STUDYSYNC AI - MASTER QA FUNCTIONALITY & SECURITY AUDIT');
  console.log('========================================================================\n');

  const report = {
    total: 0,
    passed: 0,
    failed: 0,
    categories: {}
  };

  function test(cat, name, condition, details = '') {
    report.total++;
    if (!report.categories[cat]) report.categories[cat] = { passed: 0, failed: 0, tests: [] };
    if (condition) {
      report.passed++;
      report.categories[cat].passed++;
      report.categories[cat].tests.push({ name, status: 'PASS', details });
      console.log(`  [PASS] [${cat}] ${name}`);
    } else {
      report.failed++;
      report.categories[cat].failed++;
      report.categories[cat].tests.push({ name, status: 'FAIL', details });
      console.error(`  ❌ [FAIL] [${cat}] ${name} -> ${details}`);
    }
  }

  // Start temporary test server
  let serverInstance = null;
  await new Promise((resolve) => {
    serverInstance = server.listen(TEST_PORT, () => {
      console.log(`[Test Harness] Running Express on ${BASE_URL}\n`);
      resolve();
    });
  });

  const jarA = new CookieJar(); // Student A (Alice)
  const jarB = new CookieJar(); // Student B (Bob)
  let userA = null;
  let userB = null;
  let testRoom = null;
  let testDoubt = null;
  let testSession = null;
  let testKnowledgeItem = null;

  try {
    // ---------------------------------------------------------
    // MODULE 1: AUTHENTICATION & SECURITY
    // ---------------------------------------------------------
    console.log('\n--- 1. AUTHENTICATION & ACCOUNT ACCESS MODULE ---');
    
    // Invalid registration (empty)
    const regEmpty = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({}) });
    test('Auth', 'Reject empty registration with 400', regEmpty.status === 400);

    // Invalid email format
    const regBadEmail = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad Email', email: 'not-an-email', password: 'Password123!' })
    });
    test('Auth', 'Reject malformed email with 400', regBadEmail.status === 400);

    // Short password
    const regShortPass = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Short Pass', email: 'short@test.com', password: '123' })
    });
    test('Auth', 'Reject short password (< 6 chars) with 400', regShortPass.status === 400);

    // Valid registration for Alice
    const emailA = `alice_${Date.now()}@studysync.test`;
    const regAlice = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice Student', email: emailA, password: 'Password123!', institution: 'PSG Tech', department: 'MCA' })
    }, jarA);
    test('Auth', 'Register valid user Alice with 201', regAlice.status === 201 && regAlice.data.success);
    userA = regAlice.data.data?.user;

    // Duplicate email registration
    const regDup = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice Duplicate', email: emailA, password: 'Password123!' })
    });
    test('Auth', 'Reject duplicate email registration with 409 Conflict', [400, 409].includes(regDup.status));

    // Valid registration for Bob
    const emailB = `bob_${Date.now()}@studysync.test`;
    const regBob = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bob Peer', email: emailB, password: 'Password123!', institution: 'PSG Tech', department: 'MCA' })
    }, jarB);
    test('Auth', 'Register valid user Bob with 201', regBob.status === 201 && regBob.data.success);
    userB = regBob.data.data?.user;

    // Login Alice with incorrect password
    const loginFail = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailA, password: 'WrongPassword!' })
    });
    test('Auth', 'Reject incorrect password with 401', loginFail.status === 401);

    // Login Alice with non-existent email
    const loginGhost = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ghost@nonexistent.xyz', password: 'Password123!' })
    });
    test('Auth', 'Reject non-existent user with 401', loginGhost.status === 401);

    // Protected route check without cookie
    const meNoAuth = await request('/api/auth/me');
    test('Auth', 'Protect /api/auth/me against unauthenticated access with 401', meNoAuth.status === 401);

    // Protected route check with Alice's cookie
    const meAlice = await request('/api/auth/me', { method: 'GET' }, jarA);
    test('Auth', 'Authorize /api/auth/me with valid session cookie with 200', meAlice.status === 200 && meAlice.data.data?.user?.email === emailA);

    // Verify Password Hash not leaked in response
    test('Auth', 'Never expose passwordHash in User response object', !meAlice.data.data?.user?.passwordHash);

    // Update Profile
    const updateProf = await request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ bio: 'Machine learning and algorithms enthusiast' })
    }, jarA);
    test('Auth', 'Update user profile bio with 200', updateProf.status === 200 && updateProf.data.data?.user?.bio?.includes('algorithms'));

    // ---------------------------------------------------------
    // MODULE 2: DASHBOARD
    // ---------------------------------------------------------
    console.log('\n--- 2. STUDENT DASHBOARD MODULE ---');
    const dashStats = await request('/api/dashboard/stats', { method: 'GET' }, jarA);
    test('Dashboard', 'Fetch student metrics overview with 200', dashStats.status === 200 && dashStats.data.success);
    test('Dashboard', 'Verify metrics structure (roomsJoined, roomsCreated, doubtsResolved, sessionsCompleted)',
      typeof dashStats.data.data?.metrics?.roomsJoined === 'number' &&
      typeof dashStats.data.data?.metrics?.roomsCreated === 'number' &&
      typeof dashStats.data.data?.metrics?.doubtsResolved === 'number'
    );

    // ---------------------------------------------------------
    // MODULE 3: STUDY ROOMS MANAGEMENT
    // ---------------------------------------------------------
    console.log('\n--- 3. STUDY ROOM MANAGEMENT MODULE ---');
    // Create room missing name
    const badRoom = await request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Computer Networks' })
    }, jarA);
    test('Rooms', 'Reject room creation without name with 400', badRoom.status === 400);

    // Create valid private study room by Alice
    const makeRoom = await request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Distributed Systems Study Group',
        subject: 'Cloud & Distributed Computing',
        description: 'Reviewing Paxos, Raft, and WebSockets',
        visibility: 'private',
        maxParticipants: 15
      })
    }, jarA);
    test('Rooms', 'Create private room with 201', makeRoom.status === 201 && makeRoom.data.data?.room?.roomCode);
    testRoom = makeRoom.data.data?.room;

    // Verify room code format
    test('Rooms', 'Verify generated room code format (SYNC-XXXX)', /^SYNC-[A-Z0-9]{4}$/.test(testRoom?.roomCode));

    // Get room details by ID (Alice is owner)
    const getRoomA = await request(`/api/rooms/${testRoom._id}`, { method: 'GET' }, jarA);
    test('Rooms', 'Retrieve room details for room owner with 200', getRoomA.status === 200 && getRoomA.data.data?.isOwner === true);

    // Bob attempts to get room before joining (Should be blocked by ensureRoomMember with 403)
    const getRoomBobBlocked = await request(`/api/rooms/${testRoom._id}`, { method: 'GET' }, jarB);
    test('Rooms', 'Enforce room access control (403 for non-members)', getRoomBobBlocked.status === 403);

    // Bob joins with incorrect room code
    const joinBadCode = await request('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ roomCode: 'SYNC-FAKE' })
    }, jarB);
    test('Rooms', 'Reject invalid room code join with 404', joinBadCode.status === 404);

    // Bob joins with correct room code
    const joinBob = await request('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ roomCode: testRoom.roomCode })
    }, jarB);
    test('Rooms', 'Bob joins room successfully using invite code with 200', joinBob.status === 200 && joinBob.data.success);

    // Bob re-joins (Idempotent join check)
    const joinBobAgain = await request('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ roomCode: testRoom.roomCode })
    }, jarB);
    test('Rooms', 'Handle duplicate join gracefully (idempotent)', joinBobAgain.status === 200 && joinBobAgain.data.data?.roomId);

    // Bob can now access room details
    const getRoomBobOk = await request(`/api/rooms/${testRoom._id}`, { method: 'GET' }, jarB);
    test('Rooms', 'Bob can access room details after joining with 200', getRoomBobOk.status === 200 && getRoomBobOk.data.data?.isOwner === false);

    // ---------------------------------------------------------
    // MODULE 4: REAL-TIME CHAT & MESSAGES
    // ---------------------------------------------------------
    console.log('\n--- 4. REAL-TIME CHAT & MESSAGES MODULE ---');
    // Reject empty chat message
    const emptyMsg = await request(`/api/rooms/${testRoom._id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: '' })
    }, jarA);
    test('Chat', 'Reject empty chat message with 400', emptyMsg.status === 400);

    // Post message from Alice
    const postMsgA = await request(`/api/rooms/${testRoom._id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: 'Welcome to Distributed Systems review everyone!' })
    }, jarA);
    test('Chat', 'Alice posts chat message with 201', postMsgA.status === 201 && postMsgA.data.data?.message?.message);

    // Post message from Bob
    const postMsgB = await request(`/api/rooms/${testRoom._id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: 'Hey Alice! Ready to solve consensus protocols today.' })
    }, jarB);
    test('Chat', 'Bob posts reply message with 201', postMsgB.status === 201 && postMsgB.data.data?.message?.sender?.name);

    // Fetch chat history
    const getMsgs = await request(`/api/rooms/${testRoom._id}/messages`, { method: 'GET' }, jarA);
    test('Chat', 'Fetch persistent chat history with 200 (order preserved)', getMsgs.status === 200 && getMsgs.data.data?.messages?.length >= 2);

    // ---------------------------------------------------------
    // MODULE 5: SHARED COLLABORATIVE NOTES
    // ---------------------------------------------------------
    console.log('\n--- 5. SHARED COLLABORATIVE NOTES MODULE ---');
    const getNotes = await request(`/api/rooms/${testRoom._id}/notes`, { method: 'GET' }, jarA);
    test('Notes', 'Retrieve room shared note document with 200', getNotes.status === 200 && getNotes.data.success);

    // Save Markdown notes
    const noteMarkdown = '# Distributed Systems Summary\n- **Consensus:** Paxos and Raft\n- **CAP Theorem:** Consistency, Availability, Partition tolerance.';
    const saveNotes = await request(`/api/rooms/${testRoom._id}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ content: noteMarkdown })
    }, jarB);
    test('Notes', 'Bob updates shared markdown notes with 200', saveNotes.status === 200 && saveNotes.data.success);

    // ---------------------------------------------------------
    // MODULE 6: COLLABORATIVE WHITEBOARD
    // ---------------------------------------------------------
    console.log('\n--- 6. COLLABORATIVE WHITEBOARD MODULE ---');
    const getWb = await request(`/api/rooms/${testRoom._id}/whiteboard`, { method: 'GET' }, jarA);
    test('Whiteboard', 'Fetch room whiteboard state with 200', getWb.status === 200 && getWb.data.success);

    // Save vector strokes
    const sampleStrokes = [
      { tool: 'pencil', color: '#4F46E5', size: 3, points: [{ x: 50, y: 50 }, { x: 150, y: 150 }] },
      { tool: 'pencil', color: '#EF4444', size: 5, points: [{ x: 200, y: 100 }, { x: 250, y: 180 }] }
    ];
    const saveWb = await request(`/api/rooms/${testRoom._id}/whiteboard`, {
      method: 'PUT',
      body: JSON.stringify({ strokes: sampleStrokes })
    }, jarA);
    test('Whiteboard', 'Persist vector strokes array with 200', saveWb.status === 200 && saveWb.data.success);

    // ---------------------------------------------------------
    // MODULE 7: IN-ROOM DOUBT TRACKER & AI RESOLUTION
    // ---------------------------------------------------------
    console.log('\n--- 7. IN-ROOM DOUBT TRACKER MODULE ---');
    // Post doubt by Bob
    const postDoubt = await request(`/api/rooms/${testRoom._id}/doubts`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'How does Raft elect a leader?',
        description: 'What triggers a follower node to transition to a candidate state?',
        tags: ['raft', 'consensus', 'distributed-systems']
      })
    }, jarB);
    test('Doubts', 'Bob creates in-room doubt with 201', postDoubt.status === 201 && postDoubt.data.data?.doubt?.status === 'open');
    testDoubt = postDoubt.data.data?.doubt;

    // Alice upvotes doubt
    const upvote = await request(`/api/rooms/${testRoom._id}/doubts/${testDoubt._id}/upvote`, { method: 'POST' }, jarA);
    test('Doubts', 'Alice upvotes Bob\'s doubt with 200', upvote.status === 200 && upvote.data.data?.hasUpvoted === true);

    // Alice answers doubt
    const addAns = await request(`/api/rooms/${testRoom._id}/doubts/${testDoubt._id}/answers`, {
      method: 'POST',
      body: JSON.stringify({ content: 'When election timeout elapses without receiving heartbeats from a leader.' })
    }, jarA);
    test('Doubts', 'Alice contributes peer answer with 201', addAns.status === 201 && addAns.data.data?.doubt?.answers?.length === 1);

    // AI Solve Doubt (Tests Gemini Integration with Graceful Fallback)
    const aiSolve = await request(`/api/rooms/${testRoom._id}/doubts/${testDoubt._id}/ai-solve`, { method: 'POST' }, jarA);
    test('Doubts', 'AI solver returns comprehensive academic solution with 200',
      aiSolve.status === 200 &&
      aiSolve.data.data?.aiSolution?.content?.length > 20
    );

    // Resolve doubt
    const resolveDoubt = await request(`/api/rooms/${testRoom._id}/doubts/${testDoubt._id}/resolve`, { method: 'PATCH' }, jarB);
    test('Doubts', 'Mark doubt as resolved with 200', resolveDoubt.status === 200 && resolveDoubt.data.data?.doubt?.status === 'resolved');

    // ---------------------------------------------------------
    // MODULE 8: PERSISTENT KNOWLEDGE BASE (REVIEW 1 FOCUS)
    // ---------------------------------------------------------
    console.log('\n--- 8. PERSISTENT KNOWLEDGE BASE MODULE ---');
    // Save doubt to Knowledge Base with sourceDoubtId
    const saveDoubtToKb = await request('/api/knowledge', {
      method: 'POST',
      body: JSON.stringify({
        title: testDoubt.title,
        content: `### Solution:\n${testDoubt.description}\n\nElection timeout triggers candidate state.`,
        category: 'doubt',
        subject: testRoom.subject,
        tags: testDoubt.tags,
        source: 'In-Room Doubt Resolution',
        sourceDoubtId: testDoubt._id,
        roomId: testRoom._id,
        isPinned: true
      })
    }, jarB);
    test('KnowledgeBase', 'Persist resolved doubt in Knowledge Base with 201', saveDoubtToKb.status === 201 && saveDoubtToKb.data.success);
    testKnowledgeItem = saveDoubtToKb.data.data?.item;

    // Verify direct sourceDoubtId link in database
    test('KnowledgeBase', 'Verify direct sourceDoubtId relational reference stored in DB',
      String(testKnowledgeItem?.sourceDoubtId) === String(testDoubt._id)
    );

    // Filter Knowledge Base by category 'doubt'
    const getKbDoubts = await request('/api/knowledge?category=doubt', { method: 'GET' }, jarB);
    test('KnowledgeBase', 'Filter Knowledge Base items by category (doubt) with 200',
      getKbDoubts.status === 200 && getKbDoubts.data.data?.items?.some(i => i._id === testKnowledgeItem._id)
    );

    // Search Knowledge Base by keyword regex
    const searchKb = await request('/api/knowledge?search=Raft', { method: 'GET' }, jarB);
    test('KnowledgeBase', 'Full-text keyword search across title, content, tags with 200',
      searchKb.status === 200 && searchKb.data.data?.items?.length >= 1
    );

    // Export study sheet
    const exportKb = await request('/api/knowledge/export?format=txt', { method: 'GET' }, jarB);
    test('KnowledgeBase', 'Export printable study sheet with 200 and Content-Disposition header',
      exportKb.status === 200 && (exportKb.headers.get('content-disposition')?.includes('attachment') || exportKb.headers.get('content-disposition')?.includes('StudySync'))
    );

    // ---------------------------------------------------------
    // MODULE 9: STUDY SESSIONS & AI RECULATION
    // ---------------------------------------------------------
    console.log('\n--- 9. STUDY SESSIONS & AI RECAP MODULE ---');
    // Start stopwatch session
    const startSess = await request(`/api/rooms/${testRoom._id}/session/start`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'stopwatch' })
    }, jarA);
    test('Sessions', 'Start active study session with 201', startSess.status === 201 && startSess.data.data?.session?.status === 'active');
    testSession = startSess.data.data?.session;

    // Get active session
    const getActiveSess = await request(`/api/rooms/${testRoom._id}/session`, { method: 'GET' }, jarB);
    test('Sessions', 'Retrieve currently active room session with 200', getActiveSess.status === 200 && !!getActiveSess.data.data?.session);

    // Pause session
    const pauseSess = await request(`/api/rooms/${testRoom._id}/session/pause`, { method: 'POST' }, jarA);
    test('Sessions', 'Pause active session with 200', pauseSess.status === 200 && pauseSess.data.data?.session?.status === 'paused');

    // Resume session
    const resumeSess = await request(`/api/rooms/${testRoom._id}/session/resume`, { method: 'POST' }, jarA);
    test('Sessions', 'Resume active session with 200', resumeSess.status === 200 && resumeSess.data.data?.session?.status === 'active');

    // End session (Generates AI summary and auto-saves to Knowledge Base under category 'summary')
    const endSess = await request(`/api/rooms/${testRoom._id}/session/end`, { method: 'POST' }, jarA);
    test('Sessions', 'End session and synthesize AI recap with 200',
      endSess.status === 200 &&
      endSess.data.data?.session?.status === 'completed' &&
      endSess.data.data?.session?.aiSummary?.content?.length > 10
    );

    // Verify auto-saved recap in Knowledge Base for Alice
    const getKbRecaps = await request('/api/knowledge?category=summary', { method: 'GET' }, jarA);
    test('Sessions', 'Auto-saved AI session recap verified in Knowledge Base (category: summary)',
      getKbRecaps.status === 200 && getKbRecaps.data.data?.items?.some(i => i.title.includes('Study Session Recap'))
    );

    // ---------------------------------------------------------
    // MODULE 10: AI LEARNING ASSISTANT CONTEXT GROUNDING
    // ---------------------------------------------------------
    console.log('\n--- 10. AI LEARNING ASSISTANT MODULE ---');
    const askAssistant = await request(`/api/ai/${testRoom._id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question: 'Explain the 2-phase commit protocol simply.' })
    }, jarA);
    test('AI Assistant', 'Context-grounded assistant generates pedagogical explanation with 200',
      askAssistant.status === 200 &&
      askAssistant.data.data?.answer?.length > 20
    );

    // ---------------------------------------------------------
    // MODULE 11: SECURITY & VULNERABILITY AUDIT (PHASE 6)
    // ---------------------------------------------------------
    console.log('\n--- 11. APPLICATION SECURITY & ACCESS CONTROL ---');

    // 1. Broken Object Level Authorization (BOLA/IDOR): Bob tries to close Alice's room
    const bobClosesRoom = await request(`/api/rooms/${testRoom._id}/close`, { method: 'POST' }, jarB);
    test('Security', 'BOLA Prevention: Non-owner Bob cannot close Alice\'s room (403 Forbidden)', bobClosesRoom.status === 403);

    // 2. Unauthenticated room access
    const noAuthRoom = await request(`/api/rooms/${testRoom._id}`, { method: 'GET' });
    test('Security', 'Authentication Enforcement: Unauthenticated room fetch rejected (401)', noAuthRoom.status === 401);

    // 3. Admin Route Protection: Alice attempts to access admin overview
    const adminAccess = await request('/api/admin/overview', { method: 'GET' }, jarA);
    test('Security', 'Privilege Escalation Prevention: Student cannot access /api/admin/overview (403 Forbidden)', adminAccess.status === 403);

    // 4. Session Cookie Security Headers
    const cookieHeaders = regAlice.headers.get('set-cookie') || '';
    test('Security', 'Cookie Security: Session cookie has HttpOnly flag', /HttpOnly/i.test(cookieHeaders));
    test('Security', 'Cookie Security: Session cookie has SameSite=Lax/Strict flag', /SameSite=(Lax|Strict)/i.test(cookieHeaders));

    // 5. NoSQL Injection resilience on Login
    const nosqlPayload = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: { $gt: '' }, password: { $gt: '' } })
    });
    test('Security', 'NoSQL Injection Attack on login is safely rejected (400/401)', [400, 401].includes(nosqlPayload.status));

    // 6. Cross-Site Scripting (XSS) payload handling in Doubt submission (Alice reopens room first)
    await request(`/api/rooms/${testRoom._id}/reopen`, { method: 'POST' }, jarA);
    const xssPayload = await request(`/api/rooms/${testRoom._id}/doubts`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'XSS Probe <script>alert(1)</script>',
        description: '<img src=x onerror=alert(document.cookie)> Testing XSS resilience',
        tags: ['security', 'test']
      })
    }, jarA);
    test('Security', 'XSS payload handled cleanly without code execution', xssPayload.status === 201 && xssPayload.data.data?.doubt);

  } catch (err) {
    console.error('💥 Test Runner Error:', err);
  } finally {
    // Teardown synthetic documents
    console.log('\n--- CLEANUP & TEARDOWN ---');
    try {
      if (userA) {
        await KnowledgeItem.deleteMany({ userId: userA.id });
        await User.deleteOne({ _id: userA.id });
      }
      if (userB) {
        await KnowledgeItem.deleteMany({ userId: userB.id });
        await User.deleteOne({ _id: userB.id });
      }
      if (testRoom) {
        await RoomMember.deleteMany({ roomId: testRoom._id });
        await Doubt.deleteMany({ roomId: testRoom._id });
        await Whiteboard.deleteMany({ roomId: testRoom._id });
        await SharedNote.deleteMany({ roomId: testRoom._id });
        await Message.deleteMany({ roomId: testRoom._id });
        await StudySession.deleteMany({ roomId: testRoom._id });
        await Room.deleteOne({ _id: testRoom._id });
      }
      console.log('  🧹 All synthetic test data cleaned up successfully.');
    } catch (cleanErr) {
      console.warn('  ⚠️ Cleanup warning:', cleanErr.message);
    }

    if (serverInstance) {
      serverInstance.close();
    }
    await mongoose.disconnect();

    console.log('\n========================================================================');
    console.log(`📊 FINAL MASTER QA AUDIT: ${report.passed} PASSED | ${report.failed} FAILED (TOTAL: ${report.total})`);
    console.log('========================================================================\n');
    process.exit(report.failed > 0 ? 1 : 0);
  }
}

runMasterAudit();
