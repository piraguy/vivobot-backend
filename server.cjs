// server.cjs
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());


// In-memory sessions
const SESSIONS = new Map();

const DEFAULT_TOPIC_VOCAB = [
  "food","snack","pizza","sandwich","juice","water","like","dont like",
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

// Very simple next state (no regex)
function buildNextState(userText, state) {
  const newState = { ...state };

  // Ask name only once; then move to conversation
  if (state.stage === "greeting" && !state.askedNameOnce) {
    newState.askedNameOnce = true;
    newState.stage = "conversation";
  } else {
    newState.stage = "conversation";
  }

  // Name detection: super simple (if message starts with: my name is / i am / im)
  const lower = text.toLowerCase();
  let name = null;
  if (lower.startsWith("my name is ")) {
    name = text.slice(11).trim().split(" ")[0];
  } else if (lower.startsWith("i am ")) {
    name = text.slice(5).trim().split(" ")[0];
  } else if (lower.startsWith("im ")) {
    name = text.slice(3).trim().split(" ")[0];
  }

  if (name && name.length <= 14 && /^[a-zA-Z]+$/.test(name)) {
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    newState.studentName = cap;
  }

  return newState;
}

// Mock response (no accents, no template literals)
function generateMockResponse(userText) {
  let display = "Lets practice. What food do you like?";
  if (text.includes("i like ")) {
    const item = after.split(/[.!?,]/)[0].trim();
    if (item && item.length < 25) {
      display = "Nice! " + item + " is tasty. What do you like to drink with it?";
    } else {
      display = "Great! What do you like to drink with your favorite food?";
    }
  }
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
  const sessionId = body.sessionId;
  const userText = body.userText;

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
  const sessionId = body.sessionId;
  const topic_vocab_list = body.topic_vocab_list;
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
