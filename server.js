// server.js
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());


// In-memory sessions (pilot)
const SESSIONS = new Map();

const DEFAULT_TOPIC_VOCAB = [
  "food","snack","pizza","sandwich","juice","water","like","don't like",
  "I like...","My favorite..."
];

function getSession(sessionId) {
  if (!SESSIONS.has(sessionId)) {
    SESSIONS.set(sessionId, {
      stage: "greeting",
      askedNameOnce: false,
      studentName: "Student",
      turns: 0,
      topic_vocab_list: DEFAULT_TOPIC_VOCAB
    });
  }
  return SESSIONS.get(sessionId);
}

function setSession(sessionId, state) {
  SESSIONS.set(sessionId, state);
}

function buildNextState(userText, state) {
  let detectedName;
  if (!/\d/.test(t)) {
    if (m) {
      detectedName = m[2];
    } else if (/^[a-záàâãéèêíïóôõöúçñ]+$/i.test(t) && t.length <= 14) {
      detectedName = t;
    }
  }

  const newState = { ...state };

  if (state.stage === "greeting" && !state.askedNameOnce) {
    newState.askedNameOnce = true; // asked once
  }

  if (detectedName) {
    const cap = detectedName.charAt(0).toUpperCase() + detectedName.slice(1);
    newState.studentName = cap;
    newState.stage = "conversation";
  } else if (state.stage === "greeting") {
    newState.stage = "conversation";
  }

  return newState;
}

function generateMockResponse(userText) {
  const likeItem = likeMatch ? likeMatch[1] : null;

  const display = likeItem
    ? `Nice! ${likeItem} is tasty. What do you like to drink with it?`
    : "Let's practice. What food do you like?";

  return {
    display_text: display,
    tts_text: display,
    keywords: ["food","like","pizza","juice"],
    feedback_short: "Great! Use short sentences.",
    state: {
      stage: "conversation",
      askedNameOnce: true,
      studentName: "Student",
      turns: 0
    },
    state_capsule: "stage=conversation; askedNameOnce=true; studentName=Student; turns=0"
  };
}

app.post("/api/chat", (req, res) => {
    return res.status(400).json({ ok: false, error: "Missing sessionId or userText" });
  }

  const state = getSession(sessionId);
  const nextState = buildNextState(userText, state);

  const payload = generateMockResponse(userText);

  const finalState = {
    ...nextState,
    stage: "conversation",
    askedNameOnce: true,
  };

  setSession(sessionId, finalState);
  return res.json({ ok: true, response: payload, state: finalState });
});

app.post("/api/set-topic", (req, res) => {
    return res.status(400).json({ ok: false, error: "sessionId and topic_vocab_list required" });
  }
  const state = getSession(sessionId);
  state.topic_vocab_list = topic_vocab_list;
  setSession(sessionId, state);
  return res.json({ ok: true, state });
});

app.get("/", (_req, res) => {
  return res.send("VivoBot backend OK");
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
