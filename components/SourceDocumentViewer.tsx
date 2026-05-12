import React from 'react';
import { SourceDocument, SourceDocumentType } from '../types/checkin';

interface SourceDocumentViewerProps {
  document: SourceDocument | null;
  onClose: () => void;
}

const DOC_TYPE_CONFIG: Record<SourceDocumentType, { label: string; color: string; icon: React.ReactNode }> = {
  notion_doc: {
    label: 'Notion',
    color: 'bg-slate-100 text-slate-700',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  linear_update: {
    label: 'Linear',
    color: 'bg-violet-100 text-violet-700',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  email: {
    label: 'Email',
    color: 'bg-blue-100 text-blue-700',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  slack_message: {
    label: 'Slack',
    color: 'bg-green-100 text-green-700',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  meeting_notes: {
    label: 'Meeting Notes',
    color: 'bg-amber-100 text-amber-700',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
};

/**
 * Render markdown-ish content with basic formatting.
 * Handles: **bold**, `code`, ## headings, ---, - lists, ~~strikethrough~~, @mentions, ✅/✓/🔴 emojis
 */
function renderContent(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="my-3 border-slate-200" />);
      continue;
    }

    // H2 heading
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-sm font-bold text-slate-800 mt-4 mb-2">
          {formatInline(line.slice(3))}
        </h2>
      );
      continue;
    }

    // H3 heading
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-xs font-bold text-slate-700 mt-3 mb-1.5">
          {formatInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    // List items
    if (/^[-*] /.test(line.trim()) || /^\d+\. /.test(line.trim())) {
      const content = line.replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+\.\s+/, '');
      elements.push(
        <div key={i} className="flex gap-2 text-xs text-slate-600 ml-2 my-0.5">
          <span className="text-slate-400 flex-shrink-0">•</span>
          <span>{formatInline(content)}</span>
        </div>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-xs text-slate-600 leading-relaxed">
        {formatInline(line)}
      </p>
    );
  }

  return elements;
}

/**
 * Handle inline formatting: **bold**, `code`, ~~strike~~, @mentions
 */
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Code
    const codeMatch = remaining.match(/`(.+?)`/);
    // Strikethrough
    const strikeMatch = remaining.match(/~~(.+?)~~/);
    // @mention
    const mentionMatch = remaining.match(/@(\w[\w\s]*?\w)(?=\s|$|[.,;])/);

    // Find the earliest match
    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch } : null,
      codeMatch ? { type: 'code', match: codeMatch } : null,
      strikeMatch ? { type: 'strike', match: strikeMatch } : null,
      mentionMatch ? { type: 'mention', match: mentionMatch } : null,
    ].filter(Boolean).sort((a, b) => (a!.match.index ?? 0) - (b!.match.index ?? 0));

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0]!;
    const idx = first.match.index!;

    if (idx > 0) {
      parts.push(remaining.slice(0, idx));
    }

    switch (first.type) {
      case 'bold':
        parts.push(<strong key={key++} className="font-semibold text-slate-800">{first.match[1]}</strong>);
        break;
      case 'code':
        parts.push(<code key={key++} className="text-[11px] bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-mono">{first.match[1]}</code>);
        break;
      case 'strike':
        parts.push(<s key={key++} className="text-slate-400">{first.match[1]}</s>);
        break;
      case 'mention':
        parts.push(<span key={key++} className="text-indigo-600 font-medium">@{first.match[1]}</span>);
        break;
    }

    remaining = remaining.slice(idx + first.match[0].length);
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

const SourceDocumentViewer: React.FC<SourceDocumentViewerProps> = ({ document, onClose }) => {
  if (!document) return null;

  const typeConfig = DOC_TYPE_CONFIG[document.type];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${typeConfig.color}`}>
                {typeConfig.icon}
                {typeConfig.label}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <h2 className="text-base font-bold text-slate-900 leading-snug">{document.title}</h2>

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                {document.author.split(' ').map(n => n[0]).join('')}
              </div>
              <span className="font-medium text-slate-700">{document.author}</span>
              {document.authorRole && (
                <span className="text-slate-400">· {document.authorRole}</span>
              )}
            </div>
            <span className="text-slate-300">|</span>
            <span>{new Date(document.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {renderContent(document.content)}
        </div>

        {/* Footer — Related Items */}
        {document.relatedItemIds.length > 0 && (
          <div className="flex-shrink-0 border-t border-slate-200 px-5 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Related Items</span>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {document.relatedItemIds.map(id => (
                <span
                  key={id}
                  className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded"
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SourceDocumentViewer;
