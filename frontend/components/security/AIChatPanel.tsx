"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FiSend, FiAlertTriangle, FiCheck, FiRefreshCw } from "react-icons/fi";
import { fetchChatReply, type ChatMessage } from "@/lib/api/ai";

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  const renderInline = (line: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} className="font-semibold text-text-primary">{part.slice(2, -2)}</strong>
        : part
    );
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (line.startsWith("## ")) {
      elements.push(
        <p key={key++} className="text-xs font-semibold text-text-muted uppercase tracking-wide mt-3 mb-1 first:mt-0">
          {line.slice(3)}
        </p>
      );
      i++;
      continue;
    }

    // Collect consecutive numbered list items
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={key++} className="space-y-1 my-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-brand-1/15 text-brand-2 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Collect consecutive bullet items
    if (line.startsWith("- ") || line.startsWith("• ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("• "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className="space-y-1 my-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-text-muted shrink-0 mt-2" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    elements.push(<p key={key++} className="leading-relaxed">{renderInline(line)}</p>);
    i++;
  }

  return elements;
}

const COMMANDS = [
  { cmd: "/overview",  label: "Overview",   prompt: "Give me an overview of this environment's current security posture." },
  { cmd: "/nextsteps", label: "Next steps",  prompt: "What are the most important next steps my team should take right now to remediate vulnerabilities?" },
];

const MAX_VISIBLE = 6;

type Props = {
  environmentId: string;
  hasActiveScan: boolean;
  vulnCount: number;
};

export default function AIChatPanel({ environmentId, hasActiveScan, vulnCount }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);

  const sendMessage = useCallback(async (userText: string, hidden = false) => {
    const userMsg: ChatMessage = { role: "user", content: userText };

    setMessages((prev) => {
      if (hidden) return prev;
      return [...prev, userMsg];
    });
    setIsLoading(true);
    setError(null);

    try {
      const history = hidden
        ? [userMsg]
        : [...messages, userMsg];

      const res = await fetchChatReply(environmentId, history.slice(-MAX_VISIBLE));
      const assistantMsg: ChatMessage = { role: "assistant", content: res.data.reply };

      setMessages((prev) => {
        if (hidden) return [assistantMsg];
        return [...prev, assistantMsg];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }, [environmentId, messages]);

  // Auto-load initial briefing
  useEffect(() => {
    if (!hasActiveScan || vulnCount === 0 || initialized.current) return;
    initialized.current = true;
    sendMessage("Give me an overview of this environment's current security posture.", true);
  }, [hasActiveScan, vulnCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    setShowCommands(false);
    sendMessage(text);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    setShowCommands(val.startsWith("/") && val.length <= 12);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") setShowCommands(false);
  };

  const selectCommand = (prompt: string) => {
    setInput("");
    setShowCommands(false);
    sendMessage(prompt);
    inputRef.current?.focus();
  };

  const filteredCommands = COMMANDS.filter((c) =>
    input.length <= 1 || c.cmd.startsWith(input)
  );

  // ── Guards ────────────────────────────────────────────────────

  if (!hasActiveScan) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mb-3">
          <FiAlertTriangle className="w-5 h-5 text-text-muted" />
        </div>
        <p className="text-sm text-text-secondary">No scan data available. Run a scan first to enable AI analysis.</p>
      </div>
    );
  }

  if (vulnCount === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-success-bg flex items-center justify-center mb-3 border border-success-border">
          <FiCheck className="w-5 h-5 text-success-text" />
        </div>
        <p className="text-sm text-text-secondary">No active vulnerabilities. Your environment looks clean.</p>
      </div>
    );
  }

  // ── Chat UI ───────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && isLoading && (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <div className="w-4 h-4 border-2 border-brand-1 border-t-transparent rounded-full animate-spin shrink-0" />
            Analyzing environment...
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-brand-1 text-brand-2 rounded-br-sm leading-relaxed"
                  : "bg-surface-secondary border border-border text-text-secondary rounded-bl-sm space-y-1"
              }`}
            >
              {msg.role === "user" ? msg.content : renderMarkdown(msg.content)}
            </div>
          </div>
        ))}

        {messages.length > 0 && isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface-secondary border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-error-text text-xs bg-error-bg border border-error-border rounded-xl px-3 py-2">
            <FiAlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => sendMessage(messages[messages.length - 1]?.content ?? "")} className="shrink-0">
              <FiRefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border px-4 py-3 relative">
        {/* Command suggestions */}
        {showCommands && filteredCommands.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
            {filteredCommands.map((c) => (
              <button
                key={c.cmd}
                onClick={() => selectCommand(c.prompt)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-secondary text-left transition-colors"
              >
                <span className="font-mono text-brand-2 font-medium text-xs">{c.cmd}</span>
                <span className="text-text-muted">{c.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder='Ask anything or type "/" for commands...'
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-surface-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1/30 disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-brand-1 text-brand-2 flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-40 shrink-0"
          >
            <FiSend className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
