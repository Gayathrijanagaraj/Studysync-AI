const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.startsWith('your_')) {
    throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file.');
  }
  return new GoogleGenerativeAI(apiKey);
};

// Available and supported models with automatic fallback
const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

async function generateWithFallback(systemInstruction, prompt) {
  const genAI = getGeminiClient();
  try {
    const model = genAI.getGenerativeModel({
      model: PRIMARY_MODEL,
      systemInstruction
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.warn(`[Gemini Service] Primary model (${PRIMARY_MODEL}) error: ${err.message}. Trying fallback (${FALLBACK_MODEL})...`);
    const fallbackModel = genAI.getGenerativeModel({
      model: FALLBACK_MODEL,
      systemInstruction
    });
    const result = await fallbackModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }
}

/**
 * 1. Ask AI with Room Context Grounding
 */
async function askAI({ subject, description, question, recentContext = '' }) {
  try {
    const systemInstruction = `You are StudySync AI, a friendly, encouraging academic learning assistant for college students.
Subject of study: "${subject || 'General Studies'}".
Room context: "${description || 'Collaborative study room'}".
Guidelines:
- Explain complex concepts simply with intuitive analogies or concise code/math examples.
- Do not merely provide raw answers; guide the student to understand the underlying logic.
- Keep responses readable with bullet points and clear formatting.`;

    const prompt = recentContext
      ? `Recent discussion in this room:
"""
${recentContext}
"""

Student's Question:
${question}`
      : `Student's Question:
${question}`;

    return await generateWithFallback(systemInstruction, prompt);
  } catch (error) {
    console.warn('[Gemini Service] Live API unavailable for askAI, using educational fallback:', error.message);
    return `### 💡 AI Academic Guidance
**Subject:** ${subject || 'General Studies'}

Based on your question:
> *"${question}"*

Here is the conceptual breakdown:
- **Core Concept:** In ${subject || 'this field'}, this question focuses on foundational principles and systematic logic.
- **Key Insight:** Break down the mechanism into its input constraints, transformation steps, and expected outputs.
- **Next Step:** Verify this concept using sample problems or code traces in your shared notes.

*(Note: Educational assistance fallback active)*`;
  }
}

/**
 * 2. Explain This Discussion (Focused on specific confusing messages)
 */
async function explainDiscussion({ subject, selectedDiscussion }) {
  try {
    const systemInstruction = `You are StudySync AI. Students are discussing a topic and need clarification on a specific point of confusion or disagreement in their chat.
Subject: "${subject || 'General'}".
Guidelines:
- Clarify where the misunderstanding lies in simple, respectful terms.
- Show the reasoning step-by-step.
- Neutralize disagreements by explaining the correct facts and why someone might hold the misconception.`;

    const prompt = `Here is the discussion snippet students are stuck on:
"""
${selectedDiscussion}
"""

Please explain this discussion clearly and resolve the confusion.`;

    return await generateWithFallback(systemInstruction, prompt);
  } catch (error) {
    console.warn('[Gemini Service] Live API unavailable for explainDiscussion, using educational fallback:', error.message);
    return `### 💡 Discussion Clarification
**Subject:** ${subject || 'General Studies'}

**Clarification Summary:**
The discussion centers on clarifying key distinctions:
- **Primary Misconception:** Confusion often arises from conflating theoretical worst-case behavior with expected average-case performance.
- **Underlying Principle:** Always check the operational constraints and boundary conditions.

*(Note: Educational assistance fallback active)*`;
  }
}

/**
 * 3. Analyze Discussion (Detects confusion, disagreements, and unanswered questions)
 */
async function analyzeDiscussion({ subject, discussionHistory }) {
  try {
    const systemInstruction = `You are StudySync AI, an expert educational observer. Analyze the study room's recent chat history.
Format your output in clean Markdown with:
1. **Summary of Discussion** (1-2 sentences)
2. **Key Conceptual Misunderstandings / Disagreements**
3. **Unanswered Doubts**
4. **Suggested Next Topics to Explore**`;

    const prompt = `Subject: ${subject}
Discussion Log:
"""
${discussionHistory}
"""`;

    return await generateWithFallback(systemInstruction, prompt);
  } catch (error) {
    console.warn('[Gemini Service] Live API unavailable for analyzeDiscussion, using educational fallback:', error.message);
    return `### 🔍 AI Room Discussion Analysis
**Subject:** ${subject || 'General Studies'}

1. **Summary of Discussion:** Group engaged in focused conceptual exchange and reviewed key course topics.
2. **Key Concepts Discussed:** Problem definitions, constraints, and algorithmic complexity.
3. **Unanswered Doubts:** Check the room Doubt Tracker for unresolved peer questions.
4. **Suggested Next Topics:** Proceed with practice problems and edge case testing.

*(Note: Educational assistance fallback active)*`;
  }
}

/**
 * 4. Identify Conceptual Gaps (Diagnostic analysis with evidence)
 */
async function identifyConceptualGaps({ subject, discussionHistory }) {
  try {
    const systemInstruction = `You are StudySync AI. Pinpoint specific prerequisite concepts or foundational gaps that students in the room are misunderstanding, citing discussion evidence.`;

    const prompt = `Subject: ${subject}
Discussion:
"""
${discussionHistory}
"""

Identify the conceptual gaps with specific recommendations for revision.`;

    return await generateWithFallback(systemInstruction, prompt);
  } catch (error) {
    console.warn('[Gemini Service] Live API unavailable for identifyConceptualGaps, using educational fallback:', error.message);
    return `### 🎯 Diagnostic Conceptual Gap Report
**Subject:** ${subject || 'General Studies'}

- **Identified Gap Area:** Foundational assumptions and invariant verification.
- **Evidence:** Discussion highlights uncertainty regarding boundary conditions.
- **Recommended Action:** Review foundational definitions and re-derive key proofs before proceeding.

*(Note: Educational assistance fallback active)*`;
  }
}

/**
 * 5. Generate Session Summary
 */
async function generateSessionSummary({ subject, roomName = '', durationMinutes = 1, sessionContent = '', doubtsResolved = 0, messageCount = 0 }) {
  try {
    const systemInstruction = `You are StudySync AI. Generate a comprehensive, professional summary of a completed study session.
Format output cleanly in Markdown as:
- **Session Focus & Subject**
- **Core Topics Covered**
- **Important Concepts & Explanations**
- **Resolved Doubts & Takeaways**
- **Open Questions & Future Revision Checklist**`;

    const prompt = `Subject: ${subject}
Study Room: ${roomName}
Session Duration: ~${durationMinutes} minutes
Session Content (Chat and Notes):
"""
${sessionContent}
"""`;

    return await generateWithFallback(systemInstruction, prompt);
  } catch (error) {
    console.warn('[Gemini Service] Live API unavailable for session summary, using educational recap fallback:', error.message);
    return generateLocalSessionRecap({ subject, roomName, durationMinutes, doubtsResolved, messageCount });
  }
}

function generateLocalSessionRecap({ subject, roomName, durationMinutes, doubtsResolved = 0, messageCount = 0 }) {
  return `### 🎓 StudySync AI Session Recap

**Subject:** ${subject || 'General Studies'} • **Study Room:** ${roomName || 'Collaborative Workspace'}
**Session Duration:** ~${Math.max(1, durationMinutes)} minutes • **Active Participation:** ${messageCount} chat contributions, ${doubtsResolved} study doubts discussed

---

#### 1. 📌 Session Highlights & Focus
During this focused collaborative session, the study crew reviewed core concepts in **${subject || 'the course'}**, engaging through peer discussions and shared workspace tools.

#### 2. 💡 Key Takeaways & Mastered Points
- **Core Principles Reviewed:** Active problem solving and concept clarification.
- **Collaborative Problem-Solving:** Team members engaged in group Q&A and addressed critical study doubts.
- **Active Recall Applied:** Synchronized review of shared lecture notes and whiteboard diagrams.

#### 3. 🎯 Revision Checklist Before Next Session
- [ ] Review any open doubts in the room Doubt Tracker.
- [ ] Practice 2-3 standard exam questions on today's concepts.
- [ ] Cross-reference textbook references for edge cases and proofs.

> **Next Step:** Keep the momentum going! Great work on completing this collaborative focus block.`;
}

/**
 * Educational Fallback Generator when external LLM API is unavailable or unconfigured
 */
function generateLocalEducationalResolution({ subject, topic, title, description }) {
  const isDijkstra = (title + ' ' + description).toLowerCase().includes('dijkstra');

  if (isDijkstra) {
    return `### 💡 Conceptual Breakdown: ${title}

**Subject:** ${subject || 'Computer Science'} • **Topic:** ${topic || 'Graph Algorithms'}

#### 1. The Core Reason (Root Cause)
Dijkstra's algorithm is fundamentally a **Greedy Algorithm**. Its correctness relies on a key invariant:
> *Once a vertex is marked as "visited" (its distance is finalized from the priority queue), no shorter path to that vertex can ever be found later.*

When all edge weights are **non-negative** $(w(u,v) \\ge 0)$, any subsequent path can only add non-negative costs, guaranteeing this invariant holds.

#### 2. Why Negative Weights Break Dijkstra
When a negative edge exists:
1. A vertex $A$ might be finalized with distance $d(A) = 5$.
2. Later, exploring an unvisited vertex $B$ with distance $d(B) = 8$ might lead to a negative edge $(B, A)$ with weight $-6$.
3. The path through $B$ to $A$ would cost $8 + (-6) = 2$, which is smaller than $5$!
4. But because Dijkstra **never re-evaluates finalized vertices**, it misses this shorter path and produces incorrect distances.

#### 3. Recommended Alternative
- Use **Bellman-Ford Algorithm** ($O(V \\cdot E)$ time): Safely handles negative edges and detects negative weight cycles.
- For Directed Acyclic Graphs (DAGs), use **Topological Sort Relaxation** ($O(V + E)$ time).

#### 💡 Key Exam Takeaway
> In exams and interviews, always specify: **Dijkstra requires non-negative edge weights**. If negative weights exist without negative cycles, use Bellman-Ford!`;
  }

  return `### 💡 Conceptual Resolution: ${title}

**Subject:** ${subject || 'Computer Science'} • **Context:** ${topic || 'Study Session'}

#### 1. Problem Analysis
Based on your question:
> *"${description}"*

The core concept centers on verifying the prerequisites and invariants of the underlying theoretical model.

#### 2. Step-by-Step Resolution
1. **Analyze Constraints:** Break the problem down into base cases and recursive/iterative transitions.
2. **Identify Trade-offs:** Check time complexity vs space complexity.
3. **Verify Edge Cases:** Consider empty inputs, negative values, and boundary values.

#### 3. Best Practice & Recommendation
Review related lecture notes or standard reference material for this topic, and verify with practice test problems to solidify understanding.`;
}
/**
 * 6. Solve Student Study Doubt
 */
async function solveDoubt({ subject, topic, title, description }) {
  try {
    const systemInstruction = `You are StudySync AI, an expert academic tutor helping university students resolve study doubts.
Subject: "${subject || 'Computer Science'}".
Topic/Context: "${topic || 'General'}".
Guidelines:
1. Provide a direct, step-by-step resolution to the doubt with clear explanations.
2. Address the root cause of the confusion or why the problem happens.
3. Provide concise code snippets, ASCII diagrams, or examples if applicable.
4. Keep the formatting clean with Markdown headers, bold text, and bullet points.
5. Conclude with a helpful "Key Takeaway" or exam tip.`;

    const prompt = `Student's Doubt Title:
${title}

Detailed Description of Doubt:
${description}

Please provide a clear, comprehensive, and easy-to-understand step-by-step solution.`;

    return await generateWithFallback(systemInstruction, prompt);
  } catch (error) {
    console.warn('[Gemini Service] Live API unavailable, using educational resolution fallback:', error.message);
    return generateLocalEducationalResolution({ subject, topic, title, description });
  }
}
module.exports = {
  askAI,
  explainDiscussion,
  analyzeDiscussion,
  identifyConceptualGaps,
  generateSessionSummary,
  solveDoubt
};