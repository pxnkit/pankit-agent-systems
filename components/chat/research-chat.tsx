"use client";

import Link from "next/link";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
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
  fallback?: string;
};

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "auto";
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SUGGESTED_PROMPTS = [
  "What connects Pankit’s agent-memory projects?",
  "Who is Pankit?",
  "Explain MemEquiv in simple terms.",
  "Compare RKA-Lab and MemIntervene.",
  "Which projects focus on search and evidence provenance?",
  "Which systems have runnable public implementations?",
  "What projects study memory correction or forgetting?",
  "What are the portfolio’s documented limitations?",
];

const STORAGE_KEY = "pxnkit-portfolio-conversation-v2";
const SESSION_KEY = "pxnkit-chat-session";
const GENERATED_ATTEMPTS_KEY = "pxnkit-generated-attempts";
const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-api";
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
const MAX_INPUT = 700;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanAnswer(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
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
      .map((message) => ({
        ...message,
        text: cleanAnswer(message.text),
        status: "complete",
      }));
  } catch {
    return [];
  }
}

function getSessionId() {
  try {
    const current = sessionStorage.getItem(SESSION_KEY);
    if (current) return current;
    const created = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return "anonymous-session";
  }
}

function readGeneratedAttempts() {
  try {
    const parsed = Number(
      sessionStorage.getItem(GENERATED_ATTEMPTS_KEY) ?? "0",
    );
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function InlineAnswer({
  text,
  sources,
}: {
  text: string;
  sources: TrustedSource[];
}) {
  const sourceIndex = new Map(
    sources.map((source, index) => [source.id, { source, index }]),
  );
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*|\[source:[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}\])/g)
        .map((part, index) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
            );
          }
          const citation = part.match(/^\[source:([^\]]+)\]$/);
          if (citation) {
            const match = sourceIndex.get(citation[1]);
            if (!match) return null;
            const href =
              match.source.internalUrl ??
              (match.source.projectSlug
                ? `/projects/${match.source.projectSlug}`
                : match.source.url);
            if (!href) return null;
            const label = `Source ${match.index + 1}: ${match.source.title}`;
            const marker = `[${match.index + 1}]`;
            return href.startsWith("https://") ? (
              <a
                key={`${part}-${index}`}
                className="inline-citation"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
              >
                {marker}
              </a>
            ) : (
              <Link
                key={`${part}-${index}`}
                className="inline-citation"
                href={href}
                aria-label={label}
              >
                {marker}
              </Link>
            );
          }
          return <span key={`${part}-${index}`}>{part}</span>;
        })}
    </>
  );
}

function AnswerText({
  text,
  sources,
}: {
  text: string;
  sources: TrustedSource[];
}) {
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>
            <InlineAnswer text={item} sources={sources} />
          </li>
        ))}
      </ul>,
    );
  };

  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.trim();
    const bullet = line.match(/^[-•]\s+(.+)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();
    if (line) {
      nodes.push(
        <p key={`paragraph-${nodes.length}`}>
          <InlineAnswer text={line} sources={sources} />
        </p>,
      );
    }
  }
  flushBullets();
  return <div className="answer-text">{nodes}</div>;
}

export function ResearchChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [promptPage, setPromptPage] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [generatedAttempts, setGeneratedAttempts] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const hydrated = useRef(false);
  const verificationVisible =
    Boolean(TURNSTILE_SITE_KEY) && generatedAttempts >= 3;

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
      setGeneratedAttempts(readGeneratedAttempts());
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
          messages
            .filter((message) => message.status !== "streaming")
            .slice(-12),
        ),
      );
    } catch {
      // Conversation history is an optional device-local convenience.
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      conversationEndRef.current?.scrollIntoView({
        block: "end",
        behavior: "smooth",
      });
    }
  }, [messages]);

  useEffect(() => {
    if (!verificationVisible || !turnstileContainerRef.current) return;
    let active = true;

    const renderWidget = () => {
      if (
        !active ||
        !window.turnstile ||
        !turnstileContainerRef.current ||
        turnstileWidgetIdRef.current
      ) {
        return;
      }
      turnstileWidgetIdRef.current = window.turnstile.render(
        turnstileContainerRef.current,
        {
          sitekey: TURNSTILE_SITE_KEY,
          action: "portfolio-chat",
          theme: "auto",
          size: "flexible",
          callback: (token) => {
            setTurnstileToken(token);
            setAnnouncement("Human verification complete.");
          },
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => {
            setTurnstileToken("");
            setAnnouncement(
              "Verification was unavailable. Curated and retrieval-only answers remain available.",
            );
          },
        },
      );
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById(
        TURNSTILE_SCRIPT_ID,
      ) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = TURNSTILE_SCRIPT_ID;
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget, { once: true });
    }

    return () => {
      active = false;
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [verificationVisible]);

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

    const history = messages
      .filter((message) => message.status !== "streaming")
      .slice(-6)
      .map(({ role, text }) => ({ role, content: text }));
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

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setStreaming(true);
    setAnnouncement("Searching verified portfolio sources.");
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("q", trimmed);
    nextUrl.searchParams.delete("project");
    window.history.pushState({ question: trimmed }, "", nextUrl);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";
    let sources: TrustedSource[] = [];
    let fallback = "";
    let responseIntent = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          sessionId: getSessionId(),
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        throw new Error(
          payload?.error ??
            payload?.message ??
            "The guide is temporarily unavailable. You can still browse the verified project catalogue.",
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as {
          answer?: string;
          text?: string;
          sources?: TrustedSource[];
          fallback?: string;
        };
        accumulated = payload.answer ?? payload.text ?? "";
        sources = payload.sources ?? [];
        fallback = payload.fallback ?? "";
        updateAssistant(assistantId, {
          text: cleanAnswer(accumulated),
          sources,
          fallback,
          status: "complete",
        });
        setAnnouncement("Answer complete.");
        return;
      }

      if (!response.body) {
        throw new Error("The answer stream was unavailable.");
      }

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
          if (
            rawLine.startsWith("event:") ||
            rawLine.startsWith(":") ||
            rawLine.startsWith("id:")
          ) {
            continue;
          }
          const line = rawLine.startsWith("data:")
            ? rawLine.slice(5).trim()
            : rawLine.trim();
          if (!line) continue;
          const event = JSON.parse(line) as {
            type?: string;
            delta?: string;
            text?: string;
            sources?: TrustedSource[];
            message?: string;
            reason?: string;
            intent?: string;
          };
          if (event.type === "metadata") {
            responseIntent = event.intent ?? "";
          } else if (
            event.type === "text-delta" ||
            event.type === "delta" ||
            event.delta
          ) {
            accumulated += event.delta ?? event.text ?? "";
          } else if (
            (event.type === "source-list" || event.type === "sources") &&
            event.sources
          ) {
            sources = event.sources;
          } else if (event.type === "fallback") {
            fallback =
              event.message ??
              event.reason ??
              "A grounded retrieval fallback completed this answer.";
          } else if (event.type === "error") {
            throw new Error(
              event.message ?? "The answer could not be completed.",
            );
          }

          updateAssistant(assistantId, {
            text: cleanAnswer(accumulated),
            sources,
            fallback,
            status: "streaming",
          });
        }
      }

      updateAssistant(assistantId, {
        text:
          cleanAnswer(accumulated) ||
          "I found nearby verified projects, but the indexed sources do not establish a precise answer. Try naming a project or research theme.",
        sources,
        fallback,
        status: "complete",
      });
      if (responseIntent === "unknown") {
        setGeneratedAttempts((current) => {
          const next = current + 1;
          try {
            sessionStorage.setItem(GENERATED_ATTEMPTS_KEY, String(next));
          } catch {
            // The server still enforces its own session allowance.
          }
          return next;
        });
        setTurnstileToken("");
        if (turnstileWidgetIdRef.current && window.turnstile) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        }
      }
      setAnnouncement("Answer complete.");
    } catch (error) {
      if (controller.signal.aborted) {
        updateAssistant(assistantId, {
          text: cleanAnswer(accumulated) || "Generation stopped.",
          sources,
          status: "stopped",
        });
        setAnnouncement("Generation stopped.");
      } else {
        updateAssistant(assistantId, {
          text:
            error instanceof Error
              ? error.message
              : "The guide is temporarily unavailable. You can still browse the verified project catalogue.",
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
    setHiddenSources(new Set());
    setAnnouncement("Conversation cleared.");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // In-memory state is already clear.
    }
    window.history.pushState({}, "", "/");
  }

  const suggestions = useMemo(
    () =>
      promptPage === 0
        ? SUGGESTED_PROMPTS.slice(0, 4)
        : SUGGESTED_PROMPTS.slice(4),
    [promptPage],
  );

  return (
    <div className={messages.length ? "chat-shell has-messages" : "chat-shell"}>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {messages.length === 0 ? (
        <section className="chat-empty" aria-labelledby="chat-heading">
          <p className="eyebrow">Pankit’s portfolio research guide</p>
          <h1 id="chat-heading">Follow the evidence.</h1>
          <p className="chat-intro">
            Ask about agent memory, retrieval, verification, test-time learning,
            or the connections between Pankit’s public research systems.
          </p>
          <div className="suggestion-grid" aria-label="Suggested questions">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="suggestion"
                onClick={() => {
                  setInput(suggestion);
                  textareaRef.current?.focus();
                }}
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
            {messages.map((message, index) => {
              const projectSlug = message.sources?.find(
                (source) => source.projectSlug,
              )?.projectSlug;
              const sourcesVisible = !hiddenSources.has(message.id);
              const previousUser = [...messages.slice(0, index)]
                .reverse()
                .find((candidate) => candidate.role === "user");
              return (
                <article
                  key={message.id}
                  className={`message ${message.role} ${message.status ?? ""}`}
                >
                  <p className="message-label">
                    {message.role === "user" ? "You" : "Portfolio guide"}
                  </p>
                  <div className="message-copy">
                    {message.text ? (
                      <AnswerText
                        text={message.text}
                        sources={message.sources ?? []}
                      />
                    ) : message.status === "streaming" ? (
                      <span className="thinking">
                        Searching verified sources…
                      </span>
                    ) : null}
                  </div>
                  {message.fallback ? (
                    <p className="fallback-note">{message.fallback}</p>
                  ) : null}
                  {message.role === "assistant" &&
                  message.status !== "streaming" ? (
                    <div
                      className="message-actions"
                      aria-label="Answer actions"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(message.text)
                            .then(() => setAnnouncement("Answer copied."))
                            .catch(() =>
                              setAnnouncement("Copy was not available."),
                            );
                        }}
                      >
                        Copy
                      </button>
                      {previousUser ? (
                        <button
                          type="button"
                          disabled={streaming}
                          onClick={() => void submitQuestion(previousUser.text)}
                        >
                          Retry
                        </button>
                      ) : null}
                      {message.sources?.length ? (
                        <button
                          type="button"
                          aria-expanded={sourcesVisible}
                          onClick={() =>
                            setHiddenSources((current) => {
                              const next = new Set(current);
                              if (next.has(message.id)) next.delete(message.id);
                              else next.add(message.id);
                              return next;
                            })
                          }
                        >
                          {sourcesVisible ? "Hide sources" : "Show sources"}
                        </button>
                      ) : null}
                      {projectSlug ? (
                        <Link href={`/projects/${projectSlug}`}>
                          Open project
                        </Link>
                      ) : null}
                      {projectSlug ? (
                        <button
                          type="button"
                          onClick={() => {
                            setInput(
                              `What limitations are documented for ${projectSlug}?`,
                            );
                            textareaRef.current?.focus();
                          }}
                        >
                          Ask a follow-up
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {message.sources?.length && sourcesVisible ? (
                    <div className="source-grid" aria-label="Sources">
                      {message.sources.map((source) => (
                        <SourceCard key={source.id} source={source} />
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
            <div
              ref={conversationEndRef}
              className="conversation-end"
              aria-hidden="true"
            />
          </div>
        </section>
      )}

      <div className="composer-dock">
        {verificationVisible ? (
          <div className="turnstile-panel">
            <p>
              Generated synthesis now needs a quick human check. Canonical and
              retrieval-only answers remain available without it.
            </p>
            <div
              ref={turnstileContainerRef}
              className="turnstile-widget"
              aria-label="Human verification"
            />
          </div>
        ) : null}
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
          />
          {input.length > 560 ? (
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
          Grounded in curated public portfolio sources. No server-side chat
          history. <Link href="/privacy">Privacy</Link>
        </p>
      </div>
    </div>
  );
}
