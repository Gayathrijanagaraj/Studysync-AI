# StudySync AI – Real-Time AI-Powered Collaborative Learning Workspace

Students studying in groups frequently face a recurring problem: doubts raised during self-study or group sessions go unresolved for hours, the same questions get repeated across scattered chat groups, and there is no shared context that persists for future reference.

StudySync AI addresses this by providing a real-time collaborative workspace where students study together on a shared document or whiteboard, with an integrated AI assistant that observes the live session and responds specifically to points of confusion or disagreement between participants, rather than answering generic queries. 

Edits, cursors, and chat sync instantly across all participants, while the AI analyzes shared content to generate contextual explanations, flag conceptual gaps, and summarize session outcomes. A persistent knowledge base stores resolved doubts so future students can search past discussions instead of repeating them. The project aims to reduce redundant doubt-resolution effort, improve group-study efficiency, and demonstrate practical use of real-time collaboration combined with AI-assisted learning.

---

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-v24-green.svg)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.8-black.svg)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen.svg)](https://www.mongodb.com/)

> **Course:** Web Development | **Programme:** Master of Computer Applications (MCA)  
> **Team:** Gayathri, Srithanvarsha, Swetha  
> **Version:** 1.0 (November 2026)

---

## 🎨 Visual Identity & UI References

The authentication interfaces (Login & Registration) are pixel-matched to the official study workspace design references:
- **Two-Column Split Layout**: 50/50 desktop split view (`auth-hero-panel` + `auth-form-panel`).
- **Left Hero Panel**: Deep royal purple (`#5448DC`), abstract geometric shapes (yellow circle, coral semi-circle, tilted mint squircle), brand pill badge, conversational preview featuring **Gayathri (GK)** and the AI Assistant.
- **Right Form Panel**: Warm ivory background (`#FAF8F3`), outline Google pill button, labeled rounded inputs, custom checkbox, and royal purple pill action button (`#4F46E5`).

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | Semantic pages, design tokens, responsive layouts, native Fetch API, HTML5 Canvas API |
| **Backend** | Node.js, Express.js | Modular REST APIs, session middleware, route guards |
| **Database** | MongoDB, Mongoose ODM | Strictly-typed document schemas, unique compound indexes, text search |
| **Real-Time** | Socket.IO | Room-scoped chat broadcasts, live presence, typing indicators, stroke sync |
| **AI Layer** | Google Gemini API | Server-side prompt engineering, discussion analysis, conceptual gap identification |
| **Security** | bcryptjs, express-session | Adaptive password hashing, HttpOnly session cookies |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or v24 LTS)
- **MongoDB** (Local instance running at `mongodb://127.0.0.1:27017` or MongoDB Atlas URI)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Gayathrijanagaraj/Studysync-AI.git
cd Studysync-AI

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your `.env` contains:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/studysync_ai
SESSION_SECRET=studysync_development_session_secret_key_2026
GEMINI_API_KEY=your_gemini_api_key_here
CLIENT_ORIGIN=http://localhost:5000
```

### 4. Database Seeding (Optional Demo Data)
To seed initial admin and student accounts:
```bash
node backend/database/seed.js
```
**Seed Accounts:**
- **Admin:** `admin@studysync.ai` / `Admin@123`
- **Student:** `gayathri@studysync.ai` / `Student@123`
- **Student:** `swetha@studysync.ai` / `Student@123`
- **Student:** `srithanvarsha@studysync.ai` / `Student@123`

### 5. Run the Application
```bash
# Production start
npm start

# Development mode (with file watcher)
npm run dev
```

Open your browser at: **`http://localhost:5000`**

---

## 📁 Project Structure

```
studysync-ai/
├── frontend/
│   ├── pages/            # HTML pages (login, register, dashboard, workspace, etc.)
│   ├── css/              # Modular stylesheets (variables, base, auth, workspace, etc.)
│   ├── js/               # Client-side controllers (api.js, auth.js, chat.js, whiteboard.js)
│   └── assets/           # Icons and brand assets
├── backend/
│   ├── config/           # Database & session configuration
│   ├── controllers/      # Route logic handlers (auth, room, ai, doubts, sessions)
│   ├── database/         # Seeding script
│   ├── middleware/       # Auth guards and error handlers
│   ├── models/           # Mongoose schemas (User, Room, Message, SharedNote, etc.)
│   ├── routes/           # REST endpoints
│   ├── services/         # Gemini AI proxy service
│   ├── sockets/          # Socket.IO event handlers
│   └── utils/            # Room code generator & sanitizers
├── server.js             # HTTP server entrypoint
├── package.json          # Dependencies & scripts
└── .gitignore            # Git exclusion rules
```

---

## 🛡️ License
This project is developed for educational purposes under the **ISC License**.
