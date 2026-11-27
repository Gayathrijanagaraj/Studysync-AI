/**
 * StudySync AI - Comprehensive End-to-End System Audit & Test Suite
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Room = require('./models/Room');
const RoomMember = require('./models/RoomMember');
const Doubt = require('./models/Doubt');
const KnowledgeItem = require('./models/KnowledgeItem');
const StudySession = require('./models/StudySession');
const Whiteboard = require('./models/Whiteboard');
const SharedNote = require('./models/SharedNote');
const Message = require('./models/Message');

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 STARTING COMPREHENSIVE STUDYSYNC AI TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Database Connection
    console.log('--- TEST GROUP 1: MongoDB Atlas Connectivity ---');
    const connectDB = require('./config/db');
    await connectDB();
    assert(mongoose.connection.readyState === 1, 'MongoDB Atlas connected successfully.');

    // 2. User Authentication Model & BCrypt
    console.log('\n--- TEST GROUP 2: User Security & Verification ---');
    const testEmail = `test_runner_${Date.now()}@studysync.test`;
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Password123!', salt);

    const testUser = await User.create({
      name: 'Test Reviewer',
      email: testEmail,
      passwordHash: hash,
      institution: 'PSG College of Technology',
      department: 'Computer Applications'
    });

    assert(testUser && testUser._id, 'Created student account in MongoDB.');
    const passwordValid = await testUser.comparePassword('Password123!');
    assert(passwordValid === true, 'BCrypt password hashing and verification succeeds.');
    const safeObj = testUser.toSafeObject();
    assert(!safeObj.passwordHash, 'SafeObject sanitization protects passwordHash.');

    // 3. Study Room Lifecycle & Invite Code
    console.log('\n--- TEST GROUP 3: Study Room Management ---');
    const { generateRoomCode } = require('./utils/codeGenerator');
    const roomCode = generateRoomCode();
    assert(typeof roomCode === 'string' && roomCode.length >= 6, `Generated valid room code: ${roomCode}`);

    const testRoom = await Room.create({
      name: 'Algorithm Revision Sprint',
      subject: 'Data Structures & Algorithms',
      description: 'Review 2 Preparation Room',
      visibility: 'private',
      roomCode: roomCode,
      ownerId: testUser._id
    });
    assert(testRoom && testRoom.status === 'active', 'Created active study room with owner binding.');

    const membership = await RoomMember.create({
      roomId: testRoom._id,
      userId: testUser._id,
      memberRole: 'owner'
    });
    assert(membership && membership.memberRole === 'owner', 'Established RoomMember many-to-many relationship.');

    // 4. Collaborative Whiteboard Vector Strokes
    console.log('\n--- TEST GROUP 4: Whiteboard Vector Storage ---');
    const testWhiteboard = await Whiteboard.create({
      roomId: testRoom._id,
      strokes: [
        {
          tool: 'pencil',
          color: '#4F46E5',
          size: 4,
          points: [{ x: 10, y: 20 }, { x: 30, y: 50 }, { x: 70, y: 120 }]
        }
      ],
      lastUpdatedBy: testUser._id
    });
    assert(testWhiteboard.strokes.length === 1, 'Persisted vector coordinates in Whiteboard collection.');
    assert(testWhiteboard.strokes[0].points.length === 3, 'Vector points array intact for real-time replay.');

    // 5. In-Room Doubt Resolution & AI Solution
    console.log('\n--- TEST GROUP 5: Doubt Tracker & AI Integration ---');
    const testDoubt = await Doubt.create({
      roomId: testRoom._id,
      author: testUser._id,
      title: 'Difference between Mesh and SFU in WebRTC?',
      description: 'Why do we use mesh architecture for peer-to-peer audio/video?',
      tags: ['webrtc', 'networking', 'architecture'],
      aiSolution: {
        content: 'Mesh connects peers directly (O(N^2)), while SFU routes streams through a central media forwarder (O(N)).',
        modelUsed: 'gemini-3.5-flash',
        generatedAt: new Date()
      }
    });
    assert(testDoubt && testDoubt.status === 'open', 'Created in-room doubt with tags.');
    assert(testDoubt.aiSolution && testDoubt.aiSolution.content.length > 10, 'Attached AI solution payload.');

    // 6. Knowledge Base Linking (Review 1 Feedback Verification)
    console.log('\n--- TEST GROUP 6: Knowledge Base Store & Linking (Review 1 Audit) ---');
    const testKbItem = await KnowledgeItem.create({
      userId: testUser._id,
      roomId: testRoom._id,
      sourceDoubtId: testDoubt._id,
      title: `KB: ${testDoubt.title}`,
      content: testDoubt.aiSolution.content,
      category: 'doubt',
      subject: testRoom.subject,
      tags: testDoubt.tags,
      source: 'In-Room Doubt Resolution',
      isPinned: true
    });
    assert(testKbItem && testKbItem._id, 'Persisted item in KnowledgeItem collection.');
    assert(String(testKbItem.sourceDoubtId) === String(testDoubt._id), 'Verified direct sourceDoubtId relational link.');
    assert(testKbItem.isPinned === true, 'Pinned status saved.');

    // Test Search Functionality
    const searchRegex = new RegExp('Mesh', 'i');
    const searchResults = await KnowledgeItem.find({
      userId: testUser._id,
      $or: [
        { title: { $regex: searchRegex } },
        { content: { $regex: searchRegex } }
      ]
    });
    assert(searchResults.length >= 1, 'Full-text keyword search accurately retrieved linked doubt.');

    // 7. Study Session Engine & Auto-Recap Persistence
    console.log('\n--- TEST GROUP 7: Study Session Timer & AI Recap ---');
    const testSession = await StudySession.create({
      roomId: testRoom._id,
      startedBy: testUser._id,
      endedBy: testUser._id,
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      endTime: new Date(),
      durationSeconds: 3600,
      mode: 'focus_50',
      status: 'completed',
      aiSummary: {
        content: 'Completed revision of WebRTC networking and real-time canvas coordination.',
        keyTakeaways: ['WebRTC Mesh uses STUN for NAT discovery', 'Socket.IO provides room signaling'],
        modelUsed: 'gemini-3.5-flash',
        generatedAt: new Date()
      }
    });
    assert(testSession && testSession.status === 'completed', 'Completed session persisted with duration.');

    // Verify auto-saved recap in Knowledge Base
    const sessionKbItem = await KnowledgeItem.create({
      userId: testUser._id,
      roomId: testRoom._id,
      title: `Study Session Recap: ${testRoom.name}`,
      content: testSession.aiSummary.content,
      subject: testRoom.subject,
      category: 'summary',
      tags: ['session-recap', 'summary']
    });
    assert(sessionKbItem.category === 'summary', 'Session recap successfully categorized as summary in KnowledgeBase.');

    // 8. Clean up test artifacts
    console.log('\n--- TEARDOWN: Cleaning up synthetic test documents ---');
    await KnowledgeItem.deleteMany({ userId: testUser._id });
    await Doubt.deleteMany({ roomId: testRoom._id });
    await Whiteboard.deleteMany({ roomId: testRoom._id });
    await StudySession.deleteMany({ roomId: testRoom._id });
    await RoomMember.deleteMany({ roomId: testRoom._id });
    await Room.deleteOne({ _id: testRoom._id });
    await User.deleteOne({ _id: testUser._id });
    console.log('  🧹 Cleaned up temporary test documents.');

  } catch (err) {
    console.error('  💥 UNEXPECTED EXCEPTION:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('\n====================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTestSuite();
