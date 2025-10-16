// server.js
// Execução local: `npm i` e depois `npm start`
// Em produção (Render), configure as variáveis de ambiente indicadas abaixo.

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());


const SESSIONS = new Map();

// Substitua via variáveis no Render se/quando tiver IA real:
const MODEL_ENDPOINT = process.env.ADAPTA_AGENT_ENDPOINT; // ex.: https://api.seu-agente/v1/chat
const MODEL_API_KEY = process.env.ADAPTA_AGENT_API_KEY;   // defina no Render

// Vocabulário padrão (vamos trocar depois pela Unidade 1/2 do PDF)
const DEFAULT_TOPIC_VOCAB = [
  "food", "snack", "pizza", "sandwich", "juice", "water", "like", "don’t like",
  "I like...", "My favorite..."
];

// ------------------------------
// Sessões em memória (piloto)
// ------------------------------
function getSession(sessionId) {
  if (!SESSIONS.has(sessionId)) {
    SESSIONS.set(sessionId, {
      stage: 'greeting',
      askedNameOnce: false,
      studentName: 'Student',
      turns: 0,
      topic_vocab_list: DEFAULT_TOPIC_VOCAB
    });
  }
  return SESSIONS.get(sessionId);
}

function setSession(sessionId, state) {
  SESSIONS.set(sessionId, state);
}

// ------------------------------
// Prompts do tutor
// ------------------------------
function buildSystemPrompt() {
  return `
You are VivoBot, a kind, concise English conversation tutor for 5th graders (A1–A2). Use short, simple sentences and a friendly tone. Align with the morning class content (vocabulary and structures). The main goal is: practice vocabulary, build sentences, and keep Q&A flowing.

HARD RULES (non-negotiable):
- Ask the student’s name at most once in the entire session.
- If askedNameOnce=true OR turns>0, NEVER ask the name again.
- If no name is detected, use “Student” and proceed. Do not ask again.
- Never go back from stage="conversation" to "greeting".
- Never restart small talk; always continue the current topic.
- Be empathetic: if the student mentions personal interests (e.g., video games like Super Mario), briefly connect to that topic while keeping the lesson goal and vocabulary focus.
- Output must be JSON only (see Output Format).

STATE MODEL:
- stage: "greeting" | "conversation"
- askedNameOnce: boolean
- studentName: string | "Student"
- turns: number (increment by 1 each assistant reply)

OUTPUT FORMAT (JSON only, nothing outside JSON):
{
  "display_text": "1–2 short supportive sentences, then ONE question.",
  "tts_text": "Same as display_text, short and clear for TTS.",
  "keywords": ["2-4 simple words to help the student answer"],
  "feedback_short": "Optional, tiny praise or correction.",
  "state": {
    "stage": "greeting|conversation",
    "askedNameOnce": true|false,
    "studentName": "Student or real name",
    "turns": <number>
  },
  "state_capsule": "stage=...; askedNameOnce=...; studentName=...; turns=..."
}

STYLE:
- Language: English (A1–A2).
- One clear question per turn.
- Stay on today’s topic and vocabulary.
- Keep answers short (max ~2 sentences + 1 question).
  `;
}

function buildUserPrompt(userText, state) {
  // Heurística mínima para detectar nome
  let detectedName = undefined;
  if (!/\d/.test(t)) {
    if (m) {
      detectedName = m[2];
    } else if (/^[a-záàâãéèêíïóôõöúçñ]+$/i.test(t) && t.length <= 14) {
      detectedName = t;
    }
  }

  const newState = { ...state };

  // Se ainda está em greeting e nunca perguntou, marque que perguntou agora (uma vez)
  if (state.stage === 'greeting' && !state.askedNameOnce) {
    newState.askedNameOnce = true;
  }

  // Se detectou nome, salva e entra em conversation
  if (detectedName) {
    const cap = detectedName.charAt(0).toUpperCase() + detectedName.slice(1);
    newState.studentName = cap;
    newState.stage = 'conversation';
  } else if (state.stage === 'greeting') {
    // Mesmo sem nome, avançar para evitar loop
    newState.stage = 'conversation';
  }

  return {
    prompt: `
State:
- stage: ${newState.stage}
- askedNameOnce: ${newState.askedNameOnce}
- studentName: ${newState.studentName}
- turns: ${newState.turns}

Today’s topic and target vocabulary: ${JSON.stringify(newState.topic_vocab_list)}

The student said: "${userText}"

Your task:
- Follow rules strictly.
- If greeting and name not set, acknowledge and move to topic anyway.
- Stay on topic; connect empathetically to student's interests only as a bridge.
- JSON only in the exact output format.
    `.trim(),
    nextState: newState
  };
}

// ------------------------------
// Chamada ao modelo (com MOCK MODE)
// ------------------------------
async function callModel(messages) {
  // MOCK MODE: sem endpoint/key => resposta simulada estável
    const likesMatch = userMsg.match(/I like ([a-z ]+)/i);
    const likeItem = likesMatch ? likesMatch[1] : null;

    const display = likeItem
      ? `Nice! ${likeItem} is tasty. What do you like to drink with it?`
      : `Let's practice. What food do you like?`;

    const payload = {
      content: JSON.stringify({
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
      })
    };
    return payload;
  }

  // MODO REAL (quando você tiver API)
  const resp = await fetch(MODEL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(MODEL_API_KEY ? { 'Authorization': `Bearer ${MODEL_API_KEY}` } : {})
    },
    body: JSON.stringify({
      messages, // [{role:'system', content:...}, {role:'user', content:...}]
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 300
    })
  });
  if (!resp.ok) throw new Error('Model call failed: ' + resp.status);
  return resp.json(); // espere algo como { content: '...JSON...' } ou choices[0].message.content
}

// ------------------------------
// Rotas
// ------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, userText } = req.body;
      return res.status(400).json({ ok: false, error: 'Missing sessionId or userText' });
    }

    const state = getSession(sessionId);
    const sys = buildSystemPrompt();
    const { prompt, nextState } = buildUserPrompt(userText, state);

    const messages = [
      { role: 'system', content: sys },
      { role: 'user', content: prompt }
    ];

    const modelResp = await callModel(messages);

    // Extrai texto do retorno em formatos comuns
    const text =
      JSON.stringify(modelResp);

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      // Fallback: empacota resposta mínima, mantendo fluxo
      payload = {
        keywords: ["food","like","pizza","juice"],
        feedback_short: "",
        state: {
          stage: nextState.stage,
          askedNameOnce: nextState.askedNameOnce,
          studentName: nextState.studentName,
          turns: nextState.turns + 1
        },
        state_capsule: `stage=${nextState.stage}; askedNameOnce=${nextState.askedNameOnce}; studentName=${nextState.studentName}; turns=${nextState.turns + 1}`
      };
    }

    // Garante: nunca voltar a greeting; incrementa turnos; preserva nome
    const finalState = {
      ...nextState,
      stage: payload?.state?.stage === 'greeting' ? 'conversation' : nextState.stage,
      askedNameOnce: payload?.state?.askedNameOnce ?? nextState.askedNameOnce,
      turns: (payload?.state?.turns ?? nextState.turns) + 1
    };

    setSession(sessionId, finalState);
    res.json({ ok: true, response: payload, state: finalState });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Trocar rapidamente o vocabulário conforme Unidade 1/2
app.post('/api/set-topic', (req, res) => {
  const { sessionId, topic_vocab_list } = req.body;
    return res.status(400).json({ ok: false, error: 'sessionId and topic_vocab_list required' });
  }
  const state = getSession(sessionId);
  state.topic_vocab_list = topic_vocab_list;
  setSession(sessionId, state);
  res.json({ ok: true, state });
});

app.listen(PORT, () => console.log('Server running on port', PORT));
