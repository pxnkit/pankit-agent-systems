"use client";

import Link from "next/link";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SourceCard, type TrustedSource } from "./source-card";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: TrustedSource[];
  status?: "streaming" | "complete" | "stopped" | "error";
};

const SUGGESTED_PROMPTS = [
  "What connects Pankit’s agent-memory projects?",
  "Explain MemEquiv in simple terms.",
  "Compare RKA-Lab, MemIntervene, and MemEquiv.",
  "Which projects focus on search and evidence provenance?",
  "Which systems have runnable public implementations?",
  "Which project limitations are explicitly documented?",
  "What projects study memory correction or forgetting?",
  "How do the search projects decide when enough evidence has been found?",
];

const STORAGE_KEY = "pxnkit-portfolio-conversation-v1";
const MAX_INPUT = 700;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function safeStoredMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (message): message is ChatMessage =>
          typeof message === "object" &&
          message !== null &&
          "role" in message &&
          (message.role === "user" || message.role === "assistant") &&
          "text" in message &&
          typeof message.text === "string",
      )
      .slice(-12)
      .map((message) => ({ ...message, status: "complete" }));
  } catch {
    return [];
  }
}

export function ChatShell() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [promptPage, setPromptPage] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMessages(safeStoredMessages());
      const params = new URLSearchParams(window.location.search);
      const question = params.get("q");
      const project = params.get("project");
      if (question) {
        setInput(question.slice(0, MAX_INPUT));
      } else if (project) {
        setInput(`What is documented about ${project}?`);
      }
      hydrated.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          messages.filter((message) => message.status !== "streaming"),
        ),
      );
    } catch {
      // Conversation history is optional and device-local.
    }
  }, [messages]);

  const updateAssistant = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, ...patch } : message,
        ),
      );
    },
    [],
  );

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || trimmed.length > MAX_INPUT || streaming) return;

    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      text: trimmed,
      status: "complete",
    };
    const assistantId = makeId("assistant");
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      text: "",
      sources: [],
      status: "streaming",
    };

    const history = messages
      .slice(-6)
      .map(({ role, text }) => ({ role, content: text }));

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setStreaming(true);
    setAnnouncement("Pankit’s portfolio research guide is answering.");

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";
    let sources: TrustedSource[] = [];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          sessionId: getSessionId(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
          sources?: TrustedSource[];
        } | null;
        throw new Error(
          payload?.error ??
            payload?.message ??
            "The guide is temporarily unavailable. The portfolio remains available.",
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as {
          answer?: string;
          text?: string;
          sources?: TrustedSource[];
        };
        accumulated = payload.answer ?? payload.text ?? "";
        sources = payload.sources ?? [];
        updateAssistant(assistantId, {
          text: accumulated,
          sources,
          status: "complete",
        });
      } else if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.startsWith("data:")
              ? rawLine.slice(5).trim()
              : rawLine.trim();
            if (!line) continue;
            try {
              const event = JSON.parse(line) as {
                type?: string;
                delta?: string;
                text?: string;
                sources?: TrustedSource[];
                message?: string;
              };
              if (
                event.type === "delta" ||
                event.type === "text-delta" ||
                event.delta
              ) {
                accumulated += event.delta ?? event.text ?? "";
              } else if (event.type === "sources" && event.sources) {
                sources = event.sources;
              } else if (event.type === "error") {
                throw new Error(
                  event.message ??
                    "The generated answer could not be completed.",
                );
              }
              updateAssistant(assistantId, {
                text: accumulated,
                sources,
                status: "streaming",
              });
            } catch (error) {
              if (error instanceof SyntaxError) {
                accumulated += line;
                updateAssistant(assistantId, { text: accumulated });
              } else {
                throw error;
              }
            }
          }
        }

        updateAssistant(assistantId, {
          text:
            accumulated ||
            "Generated answers are temporarily unavailable. Browse the verified project catalogue for the indexed sources.",
          sources,
          status: "complete",
        });
      }

      setAnnouncement("Answer complete.");
    } catch (error) {
      if (controller.signal.aborted) {
        updateAssistant(assistantId, {
          text: accumulated || "Generation stopped.",
          sources,
          status: "stopped",
        });
        setAnnouncement("Generation stopped.");
      } else {
        updateAssistant(assistantId, {
          text:
            error instanceof Error
              ? error.message
              : "The guide is temporarily unavailable. The portfolio remains available.",
          sources,
          status: "error",
        });
        setAnnouncement("The answer could not be completed.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      textareaRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(input);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && streaming) {
      event.preventDefault();
      abortRef.current?.abort();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitQuestion(input);
    }
  }

  function clearConversation() {
    abortRef.current?.abort();
    setMessages([]);
    setAnnouncement("Conversation cleared.");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The in-memory conversation has still been cleared.
    }
  }

  const suggestions =
    promptPage === 0
      ? SUGGESTED_PROMPTS.slice(0, 4)
      : SUGGESTED_PROMPTS.slice(4);

  return (
    <div className={messages.length ? "chat-shell has-messages" : "chat-shell"}>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {messages.length === 0 ? (
        <section className="chat-empty" aria-labelledby="chat-heading">
          <p className="eyebrow">Pankit’s portfolio research guide</p>
          <h1 id="chat-heading">Ask about my work.</h1>
          <p className="chat-intro">
            Explore projects in agent memory, retrieval, verification, test-time
            learning, and reliable agent execution.
          </p>

          <div className="suggestion-grid" aria-label="Suggested questions">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="suggestion"
                onClick={() => setInput(suggestion)}
              >
                <span>{suggestion}</span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="quiet-button"
            onClick={() => setPromptPage((page) => (page === 0 ? 1 : 0))}
          >
            {promptPage === 0 ? "More questions" : "Earlier questions"}
          </button>
        </section>
      ) : (
        <section className="conversation" aria-label="Conversation">
          <div className="conversation-toolbar">
            <p>Pankit’s portfolio research guide</p>
            <button
              type="button"
              className="quiet-button"
              onClick={clearConversation}
            >
              Clear conversation
            </button>
          </div>
          <div className="message-list" role="log" aria-live="off">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`message ${message.role} ${message.status ?? ""}`}
              >
                <p className="message-label">
                  {message.role === "user" ? "You" : "Portfolio guide"}
                </p>
                <div className="message-copy">
                  {message.text ||
                    (message.status === "streaming" ? (
                      <span className="thinking">
                        Searching verified sources…
                      </span>
                    ) : null)}
                </div>
                {message.sources?.length ? (
                  <div className="source-grid" aria-label="Sources">
                    {message.sources.map((source) => (
                      <SourceCard key={source.id} source={source} />
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="composer-dock">
        <form className="composer" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="portfolio-question">
            Ask about Pankit’s research portfolio
          </label>
          <textarea
            ref={textareaRef}
            id="portfolio-question"
            value={input}
            rows={1}
            maxLength={MAX_INPUT}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder="Ask about a project, research question, implementation, or limitation"
            disabled={streaming}
          />
          {input.length > 580 ? (
            <span className="character-count" aria-live="polite">
              {input.length}/{MAX_INPUT}
            </span>
          ) : null}
          {streaming ? (
            <button
              type="button"
              className="send-button stop-button"
              onClick={() => abortRef.current?.abort()}
              aria-label="Stop generation"
            >
              <span aria-hidden="true">■</span>
            </button>
          ) : (
            <button
              type="submit"
              className="send-button"
              disabled={!input.trim()}
              aria-label="Send question"
            >
              <span aria-hidden="true">↑</span>
            </button>
          )}
        </form>
        <p className="composer-note">
          Answers are grounded in verified portfolio sources.{" "}
          <Link href="/privacy">Privacy</Link>
        </p>
      </div>
    </div>
  );
}

function getSessionId() {
  try {
    const key = "pxnkit-chat-session";
    const current = sessionStorage.getItem(key);
    if (current) return current;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return "anonymous-session";
  }
}
