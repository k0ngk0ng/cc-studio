import React, { useState } from 'react';

// ─── Shared Tool Card (used for both live streaming and history) ─────

export interface ToolCardProps {
  name: string;
  input?: string;        // brief description shown inline
  inputFull?: string;    // full JSON input (for expandable details)
  output?: string;       // tool result
  status: 'running' | 'done';
}

export function ToolCard({ name, input, inputFull, output, status }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = status === 'running';

  // Format the full input JSON for display
  const formattedInput = React.useMemo(() => {
    if (!inputFull) return null;
    try {
      const parsed = JSON.parse(inputFull);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return inputFull;
    }
  }, [inputFull]);

  const hasDetails = formattedInput || output;

  return (
    <div className="rounded-lg bg-surface border border-border overflow-hidden">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-left
                   transition-colors ${hasDetails ? 'hover:bg-surface-hover cursor-pointer' : 'cursor-default'}`}
      >
        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`shrink-0 text-text-muted transition-transform duration-150 ${
            expanded ? 'rotate-90' : ''
          } ${!hasDetails ? 'opacity-30' : ''}`}
        >
          <path
            d="M4.5 2.5l3.5 3.5-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Spinner / checkmark */}
        {isRunning ? (
          <div className="w-4 h-4 shrink-0">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="animate-spin"
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-border"
              />
              <path
                d="M14 8a6 6 0 00-6-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="text-accent"
              />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 shrink-0 text-accent">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M5.5 8l2 2 3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Tool name */}
        <span className="text-[13px] text-text-primary font-medium">
          {name}
        </span>

        {/* Brief input (shown inline when collapsed) */}
        {!expanded && input && (
          <span className="text-xs text-text-muted font-mono truncate ml-1">
            {input}
          </span>
        )}
      </button>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="border-t border-border">
          {/* Input */}
          {formattedInput && (
            <div className="px-3 py-2">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-medium">Input</div>
              <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap break-all
                              bg-bg rounded-md px-2.5 py-2 max-h-[200px] overflow-y-auto">
                {formattedInput}
              </pre>
            </div>
          )}
          {/* Output */}
          {output && (
            <div className="px-3 py-2 border-t border-border">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-medium">Output</div>
              <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap break-all
                              bg-bg rounded-md px-2.5 py-2 max-h-[300px] overflow-y-auto">
                {output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
