# StudySync AI – Real-Time AI-Powered Collaborative Learning Workspace

Students studying in groups frequently face a recurring problem: doubts raised during self-study or group sessions go unresolved for hours, the same questions get repeated across scattered chat groups, and there is no shared context that persists for future reference.

StudySync AI addresses this by providing a real-time collaborative workspace where students study together on a shared document or whiteboard, with an integrated AI assistant that observes the live session and responds specifically to points of confusion or disagreement between participants, rather than answering generic queries.

Edits, cursors, chat, doubts, and timer clocks sync instantly across all participants, while the AI analyzes shared content to generate contextual explanations, flag conceptual gaps, solve tricky doubts step-by-step, and summarize session outcomes. A persistent knowledge base stores resolved doubts and AI study recaps so future students can search past discussions instead of repeating them.

---

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-v24-green.svg)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.8-black.svg)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%26%20Mongoose-brightgreen.svg)](https://www.mongodb.com/)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%203.5-orange.svg)](https://ai.google.dev/)

> **Course:** Web Development | **Programme:** Master of Computer Applications (MCA)  
> **Team:** Gayathri, Srithanvarsha, Swetha  
> **Version:** 2.0 (November 2026)

---

## 🌟 Key Features

1. **Authentication & Security:**
   - Pixel-matched two-column split layout from official design reference.
   - HttpOnly session cookies, bcrypt password hashing, and role-based access control (`student` / `admin`).
2. **Collaborative Study Rooms:**
   - Public and private study rooms with 6-character unique codes (`SYNC-XXXX`).
   - Real-time online participant roster and presence indicators.
3. **Multi-Modal Workspace:**
   - **Real-Time Group Chat:** Instant messaging with typing indicators and socket room security.
   - **Collaborative Notes:** Live notes drafting with rich markdown formatting and debounced auto-save.
   - **Interactive Whiteboard:** Canvas drawing with multiple colors, eraser, and synchronized strokes.
4. **Context-Grounded Gemini AI Assistant:**
   - In-room AI proxy analyzing discussion context, explaining confusing messages, and identifying conceptual gaps with zero client token exposure.
5. **In-Room Doubt Tracker & AI Solver:**
   - Raise doubts during live sessions, collect peer answers, upvote questions, and request step-by-step AI solutions with exam takeaways.
6. **Live Study Session Timer & Automated AI Recap:**
   - Synchronized Stopwatch, Pomodoro (25m), and Deep Focus (50m) timers with Web Audio chime.
   - Automated post-session study recap summarizing discussion, notes, and revision checklist.
7. **Persistent Knowledge Base (`knowledge-base.html`):**
   - Centralized revision library with multi-category filtering, full-text search, pin to top, and 1-click export as Markdown study sheet.
8. **Student Profile & Settings (`profile.html`):**
   - Academic profile details, study bio & goals, live learning metrics, secure password changer.
9. **Platform Administrator Console (`admin.html`):**
   - Protected with RBAC `ensureAdmin`.
   - Live platform metrics, user accounts management table (activate/suspend), study rooms oversight table (close rooms), and server diagnostics.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | Semantic pages, design tokens, responsive layouts, native Fetch API, HTML5 Canvas API |
| **Backend** | Node.js, Express.js | Modular REST APIs, session middleware, route guards |
| **Database** | MongoDB Atlas, Mongoose ODM | Strictly-typed document schemas, unique compound indexes, text search |
| **Real-Time** | Socket.IO | Room-scoped chat broadcasts, live presence, typing indicators, stroke sync |
| **AI Layer** | Google Gemini API (3.5 Flash) | Server-side prompt engineering, discussion analysis, doubt solving, session summaries |
| **Security** | bcryptjs, express-session | Adaptive password hashing, HttpOnly session cookies, RBAC |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or v24 LTS)
- **MongoDB** (MongoDB Atlas connection URI or local MongoDB)

### 2. Environment Configuration
Ensure `.env` contains:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/studysync_ai?retryWrites=true&w=majority
SESSION_SECRET=studysync_development_session_secret_key_2026
GEMINI_API_KEY=your_gemini_api_key_here
CLIENT_ORIGIN=http://localhost:5000
```

### 3. Database Seeding (Demo Data)
```bash
node backend/database/seed.js
```
**Default Credentials:**
- **Admin:** `admin@studysync.ai` / `Admin@123`
- **Student:** `gayathri@studysync.ai` / `Student@123`
- **Student:** `swetha@studysync.ai` / `Student@123`
- **Student:** `srithanvarsha@studysync.ai` / `Student@123`

### 4. Run the Application
```bash
# Start server
node server.js
```

Open your browser at: **`http://localhost:5000`**

---

## 📁 Project Structure

```
studysync-ai/
├── frontend/
│   ├── pages/            # login, register, dashboard, rooms, workspace, knowledge-base, profile, admin
│   ├── css/              # variables, base, auth, dashboard, workspace, chat, whiteboard, doubts, session, knowledge, profile, admin
│   └── js/               # api.js, auth.js, dashboard.js, rooms.js, workspace.js, chat.js, notes.js, whiteboard.js, doubts.js, session.js, knowledge.js, profile.js, admin.js
├── backend/
│   ├── config/           # Database (db.js) & session (session.js) configuration
│   ├── controllers/      # authController, roomController, messageController, noteController, whiteboardController, doubtController, sessionController, knowledgeController, adminController, aiController
│   ├── database/         # seed.js
│   ├── middleware/       # authMiddleware, roomAccessMiddleware, errorHandler
│   ├── models/           # User, Room, RoomMember, Message, SharedNote, Whiteboard, Doubt, StudySession, KnowledgeItem, AIInteraction
│   ├── routes/           # authRoutes, roomRoutes, dashboardRoutes, aiRoutes, knowledgeRoutes, adminRoutes
│   ├── services/         # geminiService.js (Gemini API with fallback)
│   └── sockets/          # socketHandler.js (Socket.IO real-time engine)
├── server.js             # HTTP & Socket.IO server entrypoint
├── package.json          # Dependencies & scripts
└── README.md
```

---

## 🛡️ License
Developed for educational purposes under the **ISC License**.
