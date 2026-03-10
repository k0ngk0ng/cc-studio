import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SearchBarProps {
  /** The container element to search within */
  containerRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function SearchBar({ containerRef, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightsRef = useRef<HTMLElement[]>([]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearHighlights();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const clearHighlights = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    // Remove all mark elements
    const marks = container.querySelectorAll('mark.search-highlight');
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });
    highlightsRef.current = [];
    setMatchCount(0);
    setCurrentMatch(0);
  }, [containerRef]);

  const doSearch = useCallback((searchQuery: string) => {
    clearHighlights();
    if (!searchQuery.trim() || !containerRef.current) return;

    const container = containerRef.current;
    const q = searchQuery.toLowerCase();
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
    );

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent && node.textContent.toLowerCase().includes(q)) {
        textNodes.push(node);
      }
    }

    const marks: HTMLElement[] = [];

    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      const lowerText = text.toLowerCase();
      const parts: (string | { match: string })[] = [];
      let lastIndex = 0;

      let idx = lowerText.indexOf(q, lastIndex);
      while (idx !== -1) {
        if (idx > lastIndex) {
          parts.push(text.slice(lastIndex, idx));
        }
        parts.push({ match: text.slice(idx, idx + q.length) });
        lastIndex = idx + q.length;
        idx = lowerText.indexOf(q, lastIndex);
      }
      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
      }

      if (parts.length <= 1 && typeof parts[0] === 'string') continue;

      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (typeof part === 'string') {
          frag.appendChild(document.createTextNode(part));
        } else {
          const mark = document.createElement('mark');
          mark.className = 'search-highlight';
          mark.textContent = part.match;
          frag.appendChild(mark);
          marks.push(mark);
        }
      }

      textNode.parentNode?.replaceChild(frag, textNode);
    }

    highlightsRef.current = marks;
    setMatchCount(marks.length);
    if (marks.length > 0) {
      setCurrentMatch(1);
      scrollToMatch(marks[0]);
    }
  }, [containerRef, clearHighlights]);

  const scrollToMatch = (el: HTMLElement) => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Remove active from all, add to current
    highlightsRef.current.forEach(m => m.classList.remove('search-active'));
    el.classList.add('search-active');
  };

  const goToMatch = useCallback((direction: 'next' | 'prev') => {
    const marks = highlightsRef.current;
    if (marks.length === 0) return;

    let next: number;
    if (direction === 'next') {
      next = currentMatch >= marks.length ? 1 : currentMatch + 1;
    } else {
      next = currentMatch <= 1 ? marks.length : currentMatch - 1;
    }
    setCurrentMatch(next);
    scrollToMatch(marks[next - 1]);
  }, [currentMatch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToMatch('prev');
      } else {
        goToMatch('next');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    doSearch(val);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border-b border-border shrink-0">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-text-muted shrink-0">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search…"
        className="flex-1 bg-transparent text-xs text-text-primary placeholder-text-muted outline-none min-w-0"
      />
      {query && (
        <span className="text-[10px] text-text-muted shrink-0">
          {matchCount > 0 ? `${currentMatch}/${matchCount}` : 'No results'}
        </span>
      )}
      {/* Prev / Next */}
      <button
        onClick={() => goToMatch('prev')}
        disabled={matchCount === 0}
        className="p-0.5 rounded hover:bg-surface-hover text-text-muted disabled:opacity-30 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M9 8L6 5 3 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={() => goToMatch('next')}
        disabled={matchCount === 0}
        className="p-0.5 rounded hover:bg-surface-hover text-text-muted disabled:opacity-30 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Close */}
      <button
        onClick={() => { clearHighlights(); onClose(); }}
        className="p-0.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
