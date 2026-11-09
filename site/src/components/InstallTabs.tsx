"use client";

import { useEffect, useState } from "react";

const OPTIONS = [
  {
    id: "claude",
    label: "Claude Code",
    hint: "Run in your terminal:",
    code: "claude mcp add perflens -- npx -y perflens-mcp",
    note: "On native Windows: claude mcp add perflens -- cmd /c npx -y perflens-mcp",
  },
  {
    id: "cursor",
    label: "Cursor",
    hint: "Add to ~/.cursor/mcp.json (or .cursor/mcp.json in a project):",
    code: `{
  "mcpServers": {
    "perflens": {
      "command": "npx",
      "args": ["-y", "perflens-mcp"]
    }
  }
}`,
    note: null,
  },
  {
    id: "other",
    label: "Other clients",
    hint: "Any MCP client that supports stdio servers:",
    code: "npx -y perflens-mcp",
    note: null,
  },
] as const;

export function InstallTabs() {
  const [active, setActive] = useState<(typeof OPTIONS)[number]["id"]>("claude");
  const [copied, setCopied] = useState(false);
  const option = OPTIONS.find((o) => o.id === active)!;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(option.code);
      setCopied(true);
    } catch {
      // Clipboard blocked: the text is still selectable.
    }
  }

  return (
    <div>
      <div role="tablist" aria-label="Install instructions" className="inline-flex border border-rule">
        {OPTIONS.map((o, i) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active === o.id}
            onClick={() => {
              setActive(o.id);
              setCopied(false);
            }}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
              i > 0 ? "border-l border-rule" : ""
            } ${active === o.id ? "bg-ink text-bg" : "hover:bg-bg-2"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-5">
        <p className="text-sm text-ink-2">{option.hint}</p>
        <div className="relative mt-2 border border-rule">
          <pre className="overflow-x-auto bg-code-bg p-4 pr-20 font-mono text-[13px] leading-relaxed text-code-ink">
            <code>{option.code}</code>
          </pre>
          <button
            type="button"
            onClick={copy}
            className="absolute right-0 top-0 border-b border-l border-rule bg-brand px-3 py-1.5 font-mono text-xs font-medium text-brand-ink transition-opacity hover:opacity-90"
          >
            <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
        {option.note ? <p className="mt-2 font-mono text-xs text-ink-3">{option.note}</p> : null}
      </div>
    </div>
  );
}
