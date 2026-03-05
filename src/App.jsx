import { useState, useCallback, useRef, useEffect } from "react";

// ============================================================
// EPISTEMISCHER ASSISTENT v4.3
// Dirk Hermann | dirkdenkt.de
// Kant: "Sapere Aude" — Freire: Kritische Pädagogik
// ============================================================

const C = {
  bg: "#0F1419", surface: "#1A2029", surfaceAlt: "#232B36", border: "#2E3842",
  accent: "#D4A853", accentDim: "#B8923F", accentBg: "rgba(212,168,83,0.08)",
  text: "#E8E6E3", textDim: "#9BA4AE", textMuted: "#6B7681",
  success: "#4CAF7D", warning: "#E6A23C", danger: "#E25555",
};

const SYSTEM_PROMPT = `Du bist ein epistemischer Assistent. Deine einzige Aufgabe: Menschen zum selbständigen Denken anleiten.

KERNREGELN:
- Stelle EINE Frage pro Antwort. Nie mehr.
- Gib keine Meinungen oder Urteile ab.
- Bestätige keine Annahmen des Users.
- Zeige Widersprüche auf, ohne sie aufzulösen.
- Frage nach Quellen, Annahmen, Alternativen.
- Halte Antworten kurz (max 3 Sätze + 1 Frage).

MODI:
- SCHNELL: Eine direkte Antwort mit Einschränkungshinweis, dann eine Reflexionsfrage.
- VERSTEHEN: Socratischer Dialog in 7 Schritten (Wissensstand → Validierung).
- ENTWICKELN: Ideen-Entwicklung in 7 Schritten (Brainstorm → Verfeinerung).

ANTI-SYCOPHANCY: Beginne nie mit Lob. Keine Phrasen wie "Gute Frage" oder "Das stimmt".

Antworte immer auf Deutsch.`;

// Simulated responses für Demo-Modus
const demoResponses = {
  welcome: `Dieses System ist ein Werkzeug — kein Gesprächspartner. Es folgt einem Algorithmus, keinem echten Interesse an dir.\n\nWas es kann: Strukturen zeigen, Fragen stellen, Widersprüche aufdecken.\nWas es nicht kann: Für dich denken.\n\nWähle einen Modus und beginne.`,

  schnell: (thema) => `Zum Thema "${thema}" — vereinfachte Kurzantwort:\n\nDie Faktenlage ist mehrdeutig. Je nach Perspektive (wissenschaftlich, politisch, alltagspraktisch) gibt es unterschiedliche Lesarten.\n\n⚠️ Diese Antwort ist eine Vereinfachung. Prüfe sie gegen unabhängige Quellen.\n\nWelche konkrete Frage zu diesem Thema möchtest du wirklich beantwortet haben?`,

  verstehen: [
    (t) => `Was weißt du bereits über "${t}"? Beschreibe kurz deinen aktuellen Wissensstand — ohne Bewertung, nur was du kennst.`,
    () => `Was hat dich zu diesem Thema gebracht? Was ist das eigentliche Interesse dahinter?`,
    () => `Welche Perspektive hast du noch nicht berücksichtigt? Wer würde deiner Einschätzung widersprechen — und warum?`,
    () => `Woher stammt dein Wissen darüber? Hast du es selbst überprüft, oder übernommen?`,
    () => `Was ist die präziseste Version deiner eigentlichen Frage? Formuliere sie in einem Satz.`,
    () => `Was hat sich durch dieses Gespräch für dich verändert — im Denken, nicht im Wissen?`,
    () => `Welche eine Sache wirst du jetzt konkret anders machen oder prüfen?`,
  ],

  entwickeln: [
    (t) => `Erste Brainstorm-Runde zu "${t}": Nenne drei völlig unterschiedliche Ansätze — ohne Selbstzensur, auch unfertige Ideen.`,
    () => `Welcher dieser Ansätze überrascht dich selbst am meisten? Entwickle ihn weiter.`,
    () => `Was wäre das Gegenteil deiner stärksten Idee? Was könnte man damit gewinnen?`,
    () => `Welches Muster siehst du zwischen deinen Ideen? Was verbindet sie?`,
    () => `Welche Annahme steckt hinter deiner Lieblingsidee, die du noch nicht überprüft hast?`,
    () => `Verfeinere: Wie würde deine beste Idee aussehen, wenn du alle Ressourcen hättest — und wie, wenn du fast keine hast?`,
    () => `Was ist dein nächster konkreter Schritt? Nicht "ich denke nach" — eine Handlung in den nächsten 48 Stunden.`,
  ],
};

// API Call zur Anthropic API
async function callClaude(messages, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

// ── Komponenten ──────────────────────────────────────────────

function Msg({ role, text }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: role === "user" ? "flex-end" : "flex-start",
      marginBottom: "1rem",
    }}>
      <div style={{
        maxWidth: "80%",
        background: role === "user" ? C.accentBg : C.surface,
        border: `1px solid ${role === "user" ? C.accentDim : C.border}`,
        borderRadius: "12px",
        padding: "0.85rem 1.1rem",
        color: C.text,
        fontSize: "0.9rem",
        lineHeight: 1.65,
        whiteSpace: "pre-wrap",
      }}>
        {role === "assistant" && (
          <div style={{ fontSize: "0.6rem", color: C.accent, letterSpacing: "0.2em", marginBottom: "0.5rem" }}>
            ASSISTENT
          </div>
        )}
        {text}
      </div>
    </div>
  );
}

function ProgressBar({ step, total, labels }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <span style={{ fontSize: "0.65rem", color: C.textMuted, letterSpacing: "0.15em" }}>
          SCHRITT {step + 1} / {total}
        </span>
        <span style={{ fontSize: "0.65rem", color: C.accent }}>
          {labels[step] || ""}
        </span>
      </div>
      <div style={{ height: "3px", background: C.border, borderRadius: "2px" }}>
        <div style={{
          height: "100%",
          width: `${((step + 1) / total) * 100}%`,
          background: C.accent,
          borderRadius: "2px",
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("welcome"); // welcome | mode | chat
  const [mode, setMode] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("ea_apikey") || "");
  const [useLive, setUseLive] = useState(false);
  const [showApiInput, setShowApiInput] = useState(false);
  const [thema, setThema] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem("ea_apikey", key);
  };

  const startChat = useCallback((selectedMode) => {
    setMode(selectedMode);
    setStep(0);
    setMessages([{
      role: "assistant",
< truncated lines 172-283 >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showApiInput ? "0.75rem" : 0 }}>
            <span style={{ fontSize: "0.75rem", color: C.textMuted }}>
              {useLive && apiKey ? "🟢 Live-Modus aktiv" : "⚪ Demo-Modus"}
            </span>
            <button
              onClick={() => setShowApiInput(v => !v)}
              style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "4px", color: C.textDim, fontSize: "0.7rem", padding: "0.25rem 0.6rem", cursor: "pointer" }}
            >
              {showApiInput ? "Schließen" : "API-Key eingeben"}
            </button>
          </div>
          {showApiInput && (
            <div>
              <input
                type="password"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={e => saveApiKey(e.target.value)}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: "6px", padding: "0.5rem 0.75rem", color: C.text, fontSize: "0.8rem", fontFamily: "monospace", outline: "none", marginBottom: "0.5rem" }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.75rem", color: C.textDim }}>
                <input
                  type="checkbox"
                  checked={useLive}
                  onChange={e => setUseLive(e.target.checked)}
                  disabled={!apiKey}
                />
                Live-Modus aktivieren (API-Key erforderlich)
              </label>
            </div>
          )}
        </div>

        <button
          onClick={() => setScreen("mode")}
          style={{ background: C.accent, color: "#000", border: "none", borderRadius: "8px", padding: "1rem 3rem", fontSize: "1rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}
        >
          Beginnen →
        </button>

        <div style={{ marginTop: "2rem", fontSize: "0.7rem", color: C.textMuted }}>
          Dirk Hermann · <a href="https://dirkdenkt.de" target="_blank" rel="noreferrer" style={{ color: C.accentDim }}>dirkdenkt.de</a>
        </div>
      </div>
    </div>
  );

  if (screen === "mode") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "'Georgia', serif" }}>
      <div style={{ maxWidth: "540px", width: "100%" }}>
        <button onClick={reset} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: "0.8rem", marginBottom: "2rem" }}>
          ← Zurück
        </button>
        <h2 style={{ color: C.text, fontSize: "1.5rem", marginBottom: "0.5rem" }}>Modus wählen</h2>
        <p style={{ color: C.textMuted, fontSize: "0.85rem", marginBottom: "2rem" }}>Was brauchst du gerade?</p>

        {[
          { id: "schnell", label: "SCHNELL", desc: "Eine direkte Antwort mit Reflexionsfrage. Für wenn du wenig Zeit hast." },
          { id: "verstehen", label: "VERSTEHEN", desc: "7-Schritte Socratischer Dialog. Für wenn du ein Thema wirklich durchdenken willst." },
          { id: "entwickeln", label: "ENTWICKELN", desc: "7-Schritte Ideenentwicklung. Für wenn du etwas Neues erarbeiten willst." },
        ].map(m => (
          <button key={m.id} onClick={() => startChat(m.id)} style={{
            display: "block", width: "100%", textAlign: "left",
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: "10px", padding: "1.25rem 1.5rem",
            marginBottom: "1rem", cursor: "pointer", transition: "border-color 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            <div style={{ fontSize: "0.7rem", color: C.accent, letterSpacing: "0.2em", marginBottom: "0.4rem" }}>{m.label}</div>
            <div style={{ color: C.text, fontSize: "0.9rem", lineHeight: 1.5 }}>{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );

  if (screen === "thema") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "'Georgia', serif" }}>
      <div style={{ maxWidth: "540px", width: "100%" }}>
        <div style={{ fontSize: "0.65rem", color: C.accent, letterSpacing: "0.3em", marginBottom: "1.5rem" }}>
          MODUS: {mode?.toUpperCase()}
        </div>
        <h2 style={{ color: C.text, fontSize: "1.5rem", marginBottom: "0.75rem" }}>
          Womit möchtest du beginnen?
        </h2>
        <p style={{ color: C.textMuted, fontSize: "0.85rem", marginBottom: "2rem", lineHeight: 1.6 }}>
          Ein Thema, eine Frage, eine Idee. Kein vollständiger Satz nötig.
        </p>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <input
            autoFocus
            type="text"
            placeholder={mode === "entwickeln" ? "z.B. Neues Geschäftsmodell" : "z.B. KI und Demokratie"}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submitThema()}
            style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "0.85rem 1rem", color: C.text, fontSize: "0.95rem", outline: "none", fontFamily: "inherit" }}
          />
          <button onClick={submitThema} style={{ background: C.accent, color: "#000", border: "none", borderRadius: "8px", padding: "0 1.5rem", fontWeight: 700, cursor: "pointer", fontSize: "1.1rem" }}>
            →
          </button>
        </div>
      </div>
    </div>
  );

  // Chat Screen
  const totalSteps = mode === "schnell" ? 2 : 7;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", fontFamily: "'Georgia', serif" }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0.85rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: "0.7rem", color: C.accent, letterSpacing: "0.2em" }}>
            {mode?.toUpperCase()} · {thema}
          </span>
        </div>
        <button onClick={reset} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: "6px", color: C.textMuted, fontSize: "0.75rem", padding: "0.35rem 0.75rem", cursor: "pointer" }}>
          Neu starten
        </button>
      </div>

      {/* Progress */}
      {mode !== "schnell" && (
        <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
          <ProgressBar step={Math.min(step, totalSteps - 1)} total={totalSteps} labels={stepLabels[mode] || []} />
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1.25rem" }}>
        {messages.map((m, i) => <Msg key={i} role={m.role} text={m.text} />)}
        {loading && (
          <div style={{ display: "flex", gap: "6px", padding: "1rem 0" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: C.accent, animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "1rem 1.25rem", borderTop: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <textarea
            rows={2}
            placeholder="Deine Antwort..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            style={{ flex: 1, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "0.75rem 1rem", color: C.text, fontSize: "0.9rem", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5 }}
          />
          <button onClick={send} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? C.border : C.accent, color: loading || !input.trim() ? C.textMuted : "#000", border: "none", borderRadius: "8px", padding: "0 1.25rem", fontWeight: 700, cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontSize: "1.2rem", transition: "all 0.2s" }}>
            →
          </button>
        </div>
        <div style={{ fontSize: "0.65rem", color: C.textMuted, marginTop: "0.5rem" }}>
          Enter senden · Shift+Enter neue Zeile · {useLive && apiKey ? "🟢 Live" : "⚪ Demo"}
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:1} }`}</style>
    </div>
  );
}
