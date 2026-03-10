import React, { useEffect, useMemo, useRef, useState } from 'react';
import { html as diff2htmlHtml } from 'diff2html';
import { SearchBar } from './SearchBar';

interface DiffViewerModalProps {
  filePath: string;
  diff: string;
  onClose: () => void;
}

export function DiffViewerModal({ filePath, diff, onClose }: DiffViewerModalProps) {
  const fileName = filePath.split('/').pop() || filePath;
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSearch, setShowSearch] = useState(false);

  const htmlContent = useMemo(() => {
    if (!diff) return '';
    try {
      return diff2htmlHtml(diff, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: 'side-by-side',
        colorScheme: 'dark' as any,
      });
    } catch {
      return '';
    }
  }, [diff]);

  // Synchronize scroll between left and right side-by-side panels
  useEffect(() => {
    if (!containerRef.current || !htmlContent) return;

    const container = containerRef.current;
    // diff2html side-by-side renders two .d2h-file-side-diff elements
    const sides = container.querySelectorAll('.d2h-file-side-diff');
    if (sides.length < 2) return;

    const left = sides[0] as HTMLElement;
    const right = sides[1] as HTMLElement;
    let syncing = false;

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      return () => {
        if (syncing) return;
        syncing = true;
        target.scrollTop = source.scrollTop;
        target.scrollLeft = source.scrollLeft;
        syncing = false;
      };
    };

    const leftHandler = syncScroll(left, right);
    const rightHandler = syncScroll(right, left);

    left.addEventListener('scroll', leftHandler);
    right.addEventListener('scroll', rightHandler);

    return () => {
      left.removeEventListener('scroll', leftHandler);
      right.removeEventListener('scroll', rightHandler);
    };
  }, [htmlContent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showSearch) onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, showSearch]);

  return (
    <div className="fixed inset-0 top-12 z-50 flex flex-col bg-bg" onClick={onClose}>
      <div
        className="flex flex-col w-full h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-text-muted">
              <circle cx="4.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="11.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="4.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4.5 5.5v5M11.5 5.5C11.5 8.5 4.5 7 4.5 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-medium text-text-primary truncate">{fileName}</span>
            <span className="text-xs text-text-muted truncate">{filePath}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        {showSearch && (
          <SearchBar
            containerRef={containerRef}
            onClose={() => setShowSearch(false)}
          />
        )}

        {/* Diff content */}
        <div className="flex-1 overflow-hidden min-h-0 diff-viewer-modal">
          {htmlContent ? (
            <div
              ref={containerRef}
              className="diff-view-container h-full"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              No diff available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
