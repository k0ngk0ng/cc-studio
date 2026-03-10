import React, { useState } from 'react';
import type { PendingQuestionItem } from '../../stores/appStore';

interface AskUserQuestionCardProps {
  questions: PendingQuestionItem[];
  answered?: boolean;
  /** Selected answers to display in read-only mode */
  selectedAnswers?: string[];
  onSubmit?: (answer: string) => void;
}

export function AskUserQuestionCard({
  questions,
  answered = false,
  selectedAnswers,
  onSubmit,
}: AskUserQuestionCardProps) {
  // Per-question selections: Map<questionIndex, Set<optionIndex>>
  const [selections, setSelections] = useState<Map<number, Set<number>>>(new Map());

  const toggleOption = (qIdx: number, optIdx: number, multiSelect: boolean) => {
    if (answered) return;
    setSelections((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(qIdx) || []);
      if (multiSelect) {
        if (current.has(optIdx)) current.delete(optIdx);
        else current.add(optIdx);
      } else {
        current.clear();
        current.add(optIdx);
      }
      next.set(qIdx, current);
      return next;
    });
  };

  const hasSelection = questions.some((_, qIdx) => {
    const sel = selections.get(qIdx);
    return sel && sel.size > 0;
  });

  const handleSubmit = () => {
    if (!onSubmit || answered) return;
    // Build answer text from selections
    const parts: string[] = [];
    questions.forEach((q, qIdx) => {
      const sel = selections.get(qIdx);
      if (!sel || sel.size === 0) return;
      const chosen = [...sel].map((i) => q.options[i]?.label).filter(Boolean);
      if (questions.length > 1) {
        parts.push(`${q.header || q.question}: ${chosen.join(', ')}`);
      } else {
        parts.push(chosen.join(', '));
      }
    });
    if (parts.length > 0) {
      onSubmit(parts.join('\n'));
    }
  };

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        answered
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-accent/40 bg-accent/5'
      }`}
    >
      <div className="px-3 py-2.5">
        {questions.map((q, qIdx) => (
          <div key={qIdx} className={qIdx > 0 ? 'mt-3' : ''}>
            {/* Header */}
            {q.header && (
              <div className="flex items-center gap-2 mb-1">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={answered ? 'text-green-400' : 'text-accent'}
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6.5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <text
                    x="8"
                    y="11.5"
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    ?
                  </text>
                </svg>
                <span className="text-[13px] font-medium text-text-primary">
                  {q.header}
                </span>
              </div>
            )}

            {/* Question text */}
            <div className="text-sm text-text-secondary mb-2">{q.question}</div>

            {/* Read-only: show selected answers */}
            {answered && selectedAnswers ? (
              <div className="text-[11px] text-green-400/80 mb-1">
                ✓ {selectedAnswers[qIdx] || '(no selection)'}
              </div>
            ) : answered ? (
              <div className="text-[11px] text-green-400/80 mb-1">
                ✓ Answered
              </div>
            ) : (
              /* Options */
              <div className="space-y-1 mb-2">
                {q.options.map((opt, optIdx) => {
                  const selected = selections.get(qIdx)?.has(optIdx) ?? false;
                  return (
                    <button
                      key={optIdx}
                      onClick={() => toggleOption(qIdx, optIdx, q.multiSelect)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors border ${
                        selected
                          ? 'border-accent/60 bg-accent/15 text-text-primary'
                          : 'border-border bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {/* Radio / Checkbox indicator */}
                        <span className="mt-0.5 shrink-0">
                          {q.multiSelect ? (
                            <span
                              className={`inline-block w-3 h-3 rounded-sm border ${
                                selected
                                  ? 'border-accent bg-accent text-white'
                                  : 'border-text-muted'
                              }`}
                            >
                              {selected && (
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                >
                                  <path
                                    d="M3 6l2 2 4-4"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </span>
                          ) : (
                            <span
                              className={`inline-block w-3 h-3 rounded-full border ${
                                selected
                                  ? 'border-accent bg-accent shadow-[inset_0_0_0_2px_var(--color-bg)]'
                                  : 'border-text-muted'
                              }`}
                            />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium">{opt.label}</div>
                          {opt.description && (
                            <div className="text-text-muted text-[11px] mt-0.5">
                              {opt.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Submit button */}
        {!answered && onSubmit && (
          <button
            onClick={handleSubmit}
            disabled={!hasSelection}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              hasSelection
                ? 'bg-accent/20 text-accent hover:bg-accent/30'
                : 'bg-surface text-text-muted cursor-not-allowed'
            }`}
          >
            Submit
          </button>
        )}
      </div>
    </div>
  );
}
