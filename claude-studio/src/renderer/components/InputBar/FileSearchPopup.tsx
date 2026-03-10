import React, { useState, useEffect, useRef, useCallback } from 'react';

interface FileSearchResult {
  name: string;
  path: string;
}

interface FileSearchPopupProps {
  query: string;
  projectPath: string;
  visible: boolean;
  onSelect: (filePath: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function FileSearchPopup({
  query,
  projectPath,
  visible,
  onSelect,
  onClose,
  anchorRef,
}: FileSearchPopupProps) {
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search files when query changes
  useEffect(() => {
    if (!visible || !projectPath) {
      setResults([]);
      return;
    }

    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const files = await window.api.git.searchFiles(projectPath, query);
        setResults(files);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 100);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, visible, projectPath]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        onSelect(results[selectedIndex].path);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && results.length > 0) {
        e.preventDefault();
        onSelect(results[selectedIndex].path);
      }
    },
    [visible, results, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    if (visible) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [visible, handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!visible) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border
                 rounded-lg shadow-lg z-50 overflow-hidden"
    >
      {/* Search header */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span>Type to search for files</span>
        </div>
      </div>

      {/* Results list */}
      <div ref={listRef} className="max-h-[280px] overflow-y-auto py-1">
        {loading && results.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-text-muted">
            Searching…
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <div className="px-3 py-4 text-center text-xs text-text-muted">
            No files found for "{query}"
          </div>
        )}

        {results.map((file, index) => {
          // Split path into directory and filename
          const lastSlash = file.path.lastIndexOf('/');
          const dir = lastSlash >= 0 ? file.path.slice(0, lastSlash + 1) : '';
          const fileName = lastSlash >= 0 ? file.path.slice(lastSlash + 1) : file.path;

          return (
            <button
              key={file.path}
              onClick={() => onSelect(file.path)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors
                          ${index === selectedIndex ? 'bg-surface-hover' : ''}`}
            >
              {/* File icon */}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-text-muted">
                <path
                  d="M4 1.5h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-12a1 1 0 011-1z"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
                <path d="M9 1.5v4h4" stroke="currentColor" strokeWidth="1.1" />
              </svg>

              {/* File name + path */}
              <div className="flex-1 min-w-0 flex items-baseline gap-2">
                <span className="text-xs font-medium text-text-primary truncate">
                  {fileName}
                </span>
                {dir && (
                  <span className="text-[10px] text-text-muted truncate">
                    {dir}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
