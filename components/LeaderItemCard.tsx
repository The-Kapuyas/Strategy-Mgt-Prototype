import React, { useState } from 'react';
import { LeaderDraftUpdate, CheckInChange, ProposedAction, UpdateStatus, SourceDocument, DetailedAnalysis, OutcomeStatus, TimeStatus, ExecutionHealthStatus } from '../types/checkin';

// ─── Shared constants ───

export const STATUS_DISPLAY: Record<UpdateStatus, { label: string; color: string }> = {
  on_track: { label: 'On Track', color: 'bg-emerald-100 text-emerald-700' },
  at_risk: { label: 'At Risk', color: 'bg-amber-100 text-amber-700' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700' },
  ahead: { label: 'Ahead', color: 'bg-blue-100 text-blue-700' },
  done: { label: 'Done', color: 'bg-slate-100 text-slate-600' },
};

export const ALL_STATUSES: UpdateStatus[] = ['on_track', 'at_risk', 'blocked', 'ahead', 'done'];

export const normalizeStatus = (raw: string): UpdateStatus => {
  const s = raw?.toLowerCase().replace(/[\s-]+/g, '_') || '';
  if (ALL_STATUSES.includes(s as UpdateStatus)) return s as UpdateStatus;
  if (s.includes('risk')) return 'at_risk';
  if (s.includes('block')) return 'blocked';
  if (s.includes('ahead')) return 'ahead';
  if (s.includes('done') || s.includes('complete')) return 'done';
  return 'on_track';
};

// ─── Types ───

export interface KRMetrics {
  metric: string;
  current: number;
  target: number;
}

interface LeaderItemCardProps {
  item: LeaderDraftUpdate;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateItem: (updates: Partial<LeaderDraftUpdate>) => void;
  onAddChange: () => void;
  onUpdateChange: (idx: number, updates: Partial<CheckInChange>) => void;
  onRemoveChange: (idx: number) => void;
  krMetrics?: KRMetrics;
  onOpenChat: () => void;
  isChatActive: boolean;
  sourceDocuments?: SourceDocument[];
  onOpenSourceDocument?: (doc: SourceDocument) => void;
  isSubmitted?: boolean;
  onSubmitItem?: () => void;
  onDirectApplyChange?: (idx: number) => void;
  onDismissAction?: (actionId: string) => void;
  onRefineAction?: (actionId: string) => void;
  itemLookup?: Map<string, { type: string; name: string; status?: string; progress?: number; owner?: string; startDate?: string; endDate?: string }>;
  onRefClick?: (id: string) => void;
  className?: string;
  showStatusOverride?: boolean;
}

// ─── Citation link icons by protocol ───

const CITATION_ICONS: Record<string, React.ReactNode> = {
  'notion://': (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block mr-0.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  'linear://': (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block mr-0.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  'email://': (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block mr-0.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  'slack://': (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block mr-0.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
};

function getCitationIcon(url: string): React.ReactNode {
  for (const [protocol, icon] of Object.entries(CITATION_ICONS)) {
    if (url.startsWith(protocol)) return icon;
  }
  return null;
}

// ─── Detailed Analysis dimension display ───

const OUTCOME_DISPLAY: Record<OutcomeStatus, { label: string; dot: string }> = {
  on_target: { label: 'On Target', dot: 'bg-emerald-500' },
  partial: { label: 'Partial', dot: 'bg-amber-500' },
  missed: { label: 'Missed', dot: 'bg-red-500' },
};

const TIME_DISPLAY: Record<TimeStatus, { label: string; dot: string }> = {
  on_time: { label: 'On Time', dot: 'bg-emerald-500' },
  delayed: { label: 'Delayed', dot: 'bg-amber-500' },
  overdue: { label: 'Overdue', dot: 'bg-red-500' },
};

const EXEC_HEALTH_DISPLAY: Record<ExecutionHealthStatus, { label: string; dot: string }> = {
  stable: { label: 'Stable', dot: 'bg-emerald-500' },
  watch: { label: 'Watch', dot: 'bg-amber-500' },
  at_risk: { label: 'At Risk', dot: 'bg-red-500' },
};

// ─── Component ───

const LeaderItemCard: React.FC<LeaderItemCardProps> = ({
  item,
  isExpanded,
  onToggle,
  onUpdateItem,
  onAddChange,
  onUpdateChange,
  onRemoveChange,
  krMetrics,
  onOpenChat,
  isChatActive,
  sourceDocuments,
  onOpenSourceDocument,
  isSubmitted,
  onSubmitItem,
  onDirectApplyChange,
  onDismissAction,
  onRefineAction,
  itemLookup,
  onRefClick,
  className,
  showStatusOverride,
}) => {
  const aiStatus = STATUS_DISPLAY[item.aiSuggestedStatus];
  const currentStatus = STATUS_DISPLAY[item.leaderStatus];
  const hasFlags = item.aiFlags && item.aiFlags.length > 0;

  // Proposed actions collapsible state
  const openActions = (item.proposedActions || []).filter(a => a.status !== 'dismissed');
  const [showActions, setShowActions] = useState(openActions.length > 0);
  // Proposed changes collapsible state
  const [showChanges, setShowChanges] = useState(item.proposedChanges.length > 0);
  // Verbose assessment toggle
  const [showVerbose, setShowVerbose] = useState(false);
  // Applied changes log (per-card)
  const [appliedChanges, setAppliedChanges] = useState<{ change: CheckInChange; appliedAt: string }[]>([]);

  // Format generatedAt timestamp as relative or short date
  const formatTimestamp = (iso?: string): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const timestampLabel = formatTimestamp(item.generatedAt);

  // Render text with clickable project/KR reference pills
  const renderRefText = (text: string) => {
    if (!itemLookup || !onRefClick) return text;
    const refPattern = /\b(P\d+|KR\d+\.\d+)\b/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = refPattern.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      const id = match[1];
      const info = itemLookup.get(id);
      if (info) {
        parts.push(
          <button
            key={`${id}-${match.index}`}
            onClick={(e) => { e.stopPropagation(); onRefClick(id); }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px] font-medium cursor-pointer hover:bg-indigo-100 transition-colors"
          >
            {id}: {info.name}
          </button>
        );
      } else {
        parts.push(match[0]);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return <>{parts}</>;
  };

  // Build URL→SourceDocument lookup
  const docByUrl = React.useMemo(() => {
    const map = new Map<string, SourceDocument>();
    if (sourceDocuments) {
      sourceDocuments.forEach(doc => map.set(doc.url, doc));
    }
    return map;
  }, [sourceDocuments]);

  /**
   * Turn plain text segments into ref pills (P5, KR2.1) where applicable.
   */
  const inlineRefText = (text: string, keyPrefix: string): React.ReactNode[] => {
    if (!itemLookup || !onRefClick) return [text];
    const refPattern = /\b(P\d+|KR\d+\.\d+)\b/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = refPattern.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      const id = match[1];
      const info = itemLookup.get(id);
      if (info) {
        parts.push(
          <button
            key={`${keyPrefix}-ref-${id}-${match.index}`}
            onClick={(e) => { e.stopPropagation(); onRefClick(id); }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px] font-medium cursor-pointer hover:bg-indigo-100 transition-colors"
          >
            {id}: {info.name}
          </button>
        );
      } else {
        parts.push(match[0]);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

  /**
   * Parse inline markdown: **bold**, [text](url) citation links, and P5/KR2.1 ref pills.
   */
  const formatInlineWithLinks = (text: string, lineKey: number) => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    const pushPlainText = (t: string) => {
      parts.push(...inlineRefText(t, `${lineKey}-${key++}`));
    };

    while (remaining.length > 0) {
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);

      const matches = [
        linkMatch ? { type: 'link' as const, match: linkMatch, index: linkMatch.index! } : null,
        boldMatch ? { type: 'bold' as const, match: boldMatch, index: boldMatch.index! } : null,
      ].filter(Boolean).sort((a, b) => a!.index - b!.index);

      if (matches.length === 0) {
        pushPlainText(remaining);
        break;
      }

      const first = matches[0]!;
      if (first.index > 0) {
        pushPlainText(remaining.slice(0, first.index));
      }

      if (first.type === 'link') {
        const linkText = first.match[1];
        const linkUrl = first.match[2];
        const doc = docByUrl.get(linkUrl);
        const icon = getCitationIcon(linkUrl);

        parts.push(
          <button
            key={`link-${lineKey}-${key++}`}
            onClick={(e) => {
              e.stopPropagation();
              if (doc && onOpenSourceDocument) {
                onOpenSourceDocument(doc);
              }
            }}
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-500 font-medium transition-colors cursor-pointer"
            title={doc?.summary || linkUrl}
          >
            {icon}{linkText}
          </button>
        );
      } else {
        parts.push(
          <strong key={`bold-${lineKey}-${key++}`} className="font-semibold text-slate-800">
            {first.match[1]}
          </strong>
        );
      }

      remaining = remaining.slice(first.index + first.match[0].length);
    }

    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
  };

  /**
   * Render verbose assessment markdown with rich formatting.
   * Handles: ## headings, ### subheadings, --- rules, - lists, **bold**, [text](url) citations
   */
  const renderVerboseAssessment = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Horizontal rule
      if (/^---+$/.test(line.trim())) {
        elements.push(<hr key={i} className="my-3 border-indigo-100" />);
        continue;
      }

      // H2 heading
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={i} className="text-xs font-bold text-slate-800 mt-4 mb-1.5 first:mt-0">
            {formatInlineWithLinks(line.slice(3), i)}
          </h3>
        );
        continue;
      }

      // H3 heading
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={i} className="text-[11px] font-bold text-slate-700 mt-3 mb-1">
            {formatInlineWithLinks(line.slice(4), i)}
          </h4>
        );
        continue;
      }

      // List items (bullet or numbered)
      if (/^[-*] /.test(line.trim()) || /^\d+\. /.test(line.trim())) {
        const content = line.replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+\.\s+/, '');
        elements.push(
          <div key={i} className="flex gap-2 text-xs text-slate-600 ml-2 my-0.5 leading-relaxed">
            <span className="text-indigo-400 flex-shrink-0 mt-0.5">•</span>
            <span>{formatInlineWithLinks(content, i)}</span>
          </div>
        );
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        elements.push(<div key={i} className="h-1.5" />);
        continue;
      }

      // Regular paragraph
      elements.push(
        <p key={i} className="text-xs text-slate-600 leading-relaxed mb-1">
          {formatInlineWithLinks(line, i)}
        </p>
      );
    }

    return elements;
  };

  /**
   * Render structured detailed analysis with three dimensions: Outcome, Time, Execution Health.
   */
  const renderDetailedAnalysis = (analysis: DetailedAnalysis) => {
    const dimensions = [
      { label: 'Outcome', data: analysis.outcome, display: OUTCOME_DISPLAY as Record<string, { label: string; dot: string }> },
      { label: 'Time', data: analysis.time, display: TIME_DISPLAY as Record<string, { label: string; dot: string }> },
      { label: 'Execution health', data: analysis.executionHealth, display: EXEC_HEALTH_DISPLAY as Record<string, { label: string; dot: string }> },
    ];

    return dimensions.map((dim, idx) => {
      const statusInfo = dim.display[dim.data.status] || { label: dim.data.status, dot: 'bg-slate-400' };
      return (
        <div key={idx} className={idx > 0 ? 'mt-3' : ''}>
          <div className="text-xs text-slate-700 flex items-center gap-1.5">
            <span>{dim.label}:</span>
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusInfo.dot}`} />
            <strong className="font-bold text-slate-800">{statusInfo.label}</strong>
          </div>
          <div className="mt-1 space-y-0.5">
            {dim.data.bullets.map((bullet, bIdx) => (
              <div key={bIdx} className="flex gap-2 text-xs text-slate-600 ml-2 leading-relaxed">
                <span className="text-indigo-400 flex-shrink-0 mt-0.5">&bull;</span>
                <span className="flex-1">{formatInlineWithLinks(bullet, idx * 100 + bIdx)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  // Submitted state: compact card with expandable read-only preview
  if (isSubmitted) {
    return (
      <div className="bg-emerald-50/30 border border-emerald-200 rounded-xl">
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {item.itemId}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-slate-700">{item.itemLabel}</span>
            <span className="text-xs text-slate-400 ml-2">({item.itemType})</span>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_DISPLAY[item.leaderStatus].color}`}>
            {STATUS_DISPLAY[item.leaderStatus].label}
          </span>
          {!item.confirmed && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Override</span>
          )}
          {timestampLabel && (
            <span className="text-[10px] text-slate-400">{timestampLabel}</span>
          )}
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-3">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assessment</span>
              <p className="text-xs text-slate-600 leading-relaxed mt-1 whitespace-pre-line">{renderRefText(item.leaderNarrative)}</p>
            </div>

            {item.proposedChanges.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Proposed Changes</span>
                <div className="mt-1.5 space-y-1.5">
                  {item.proposedChanges.map((c, i) => (
                    <div key={i} className="text-xs text-slate-600 bg-white/60 rounded-lg px-3 py-2 border border-emerald-100">
                      <span className="font-medium text-slate-700">{c.targetLabel}</span>
                      <span className="text-slate-400 mx-1.5">&middot;</span>
                      <span className="text-slate-500">{c.field}:</span>
                      <span className="text-slate-400 ml-1">{c.from}</span>
                      <span className="text-slate-400 mx-1">&rarr;</span>
                      <span className="text-slate-700">{c.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-150 ${
        isChatActive ? 'ring-2 ring-indigo-300 border-indigo-200' :
        item.aiSuggestedStatus === 'at_risk' || item.aiSuggestedStatus === 'blocked' ? 'border-amber-200' : 'border-slate-200'
      } ${className || ''}`}
    >
      {/* Card Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
            {item.itemId}
          </span>
          <span className="text-sm font-medium text-slate-800">{item.itemLabel}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${currentStatus.color}`}>
            {currentStatus.label}
          </span>
          {!item.confirmed && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Override</span>
          )}
          {item.proposedChanges.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              {item.proposedChanges.length} change{item.proposedChanges.length > 1 ? 's' : ''}
            </span>
          )}
          {timestampLabel && (
            <span className="text-[10px] text-slate-400">{timestampLabel}</span>
          )}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">

          {/* ── Assessment (narrative + status) ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assessment</span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                {item.leaderNarrative === item.aiRationale ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
                    </svg>
                    AI draft
                  </>
                ) : (
                  <span className="text-indigo-500">Edited</span>
                )}
              </span>
            </div>
            <textarea
              value={item.leaderNarrative}
              onChange={e => onUpdateItem({ leaderNarrative: e.target.value })}
              placeholder="What changed? Any risks or blockers? What's next?"
              rows={3}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 placeholder-slate-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 resize-none"
            />
            {item.leaderNarrative !== item.aiRationale && (
              <button
                onClick={() => onUpdateItem({ leaderNarrative: item.aiRationale })}
                className="mt-1.5 text-[11px] text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset to AI draft
              </button>
            )}

            {/* ── Detailed Analysis (expandable) ── */}
            {(item.detailedAnalysis || item.verboseAssessment) && (
              <div className="mt-2">
                <button
                  onClick={() => setShowVerbose(!showVerbose)}
                  className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5 transition-colors hover:text-indigo-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showVerbose ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
                  </svg>
                  Detailed Analysis
                  {item.sourceDocumentIds && item.sourceDocumentIds.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                      ({item.sourceDocumentIds.length} sources)
                    </span>
                  )}
                </button>

                {showVerbose && (
                  <div className="mt-2 bg-gradient-to-br from-indigo-50/50 to-violet-50/50 border border-indigo-100 rounded-lg p-4">
                    {item.detailedAnalysis
                      ? renderDetailedAnalysis(item.detailedAnalysis)
                      : renderVerboseAssessment(item.verboseAssessment!)}
                  </div>
                )}
              </div>
            )}

            {showStatusOverride && (
              <>
                <div className="flex gap-1.5 flex-wrap mt-3">
                  {ALL_STATUSES.map(status => {
                    const s = STATUS_DISPLAY[status];
                    const isSelected = item.leaderStatus === status;
                    return (
                      <button
                        key={status}
                        onClick={() => onUpdateItem({
                          leaderStatus: status,
                          confirmed: status === item.aiSuggestedStatus,
                        })}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                          isSelected
                            ? `${s.color} border-current shadow-sm ring-1 ring-current/20`
                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                {/* Override comparison */}
                {!item.confirmed && (
                  <div className="mt-2 flex items-center gap-2 text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <span className="text-slate-500">AI suggested:</span>
                    <span className={`font-medium px-1.5 py-0.5 rounded ${STATUS_DISPLAY[item.aiSuggestedStatus].color}`}>
                      {STATUS_DISPLAY[item.aiSuggestedStatus].label}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-500">You set:</span>
                    <span className={`font-medium px-1.5 py-0.5 rounded ${STATUS_DISPLAY[item.leaderStatus].color}`}>
                      {STATUS_DISPLAY[item.leaderStatus].label}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── d) Metric Update (KR items only) ── */}
          {item.itemType === 'keyResult' && krMetrics && (
            <div className="border border-slate-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Metric</span>
                <span className="text-xs font-medium text-slate-700">{krMetrics.metric}</span>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">Current:</span>
                  <span className="font-medium text-slate-700">{krMetrics.current}</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-400">Target:</span>
                  <span className="font-medium text-slate-700">{krMetrics.target}</span>
                </div>
                <div className="flex-1 min-w-[80px]">
                  <div className="w-full bg-slate-100 rounded-full h-1">
                    <div
                      className="bg-slate-400 h-1 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round((krMetrics.current / krMetrics.target) * 100))}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-400">Update:</label>
                  <input
                    type="number"
                    value={item.metricUpdate?.to ?? krMetrics.current}
                    onChange={e => onUpdateItem({
                      metricUpdate: { field: krMetrics.metric, from: krMetrics.current, to: Number(e.target.value) },
                    })}
                    className="text-xs border border-slate-200 rounded px-2 py-0.5 w-20 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── e1) Proposed Actions (collapsible) ── */}
          {openActions.length > 0 && (
            <div>
              <button
                onClick={() => setShowActions(!showActions)}
                className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showActions ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Proposed Actions ({openActions.length})
              </button>

              {showActions && (
                <div className="mt-2 bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-3">
                  {openActions.map(action => (
                    <div key={action.id} className="bg-white rounded-lg p-3 border border-slate-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              action.severity === 'critical' ? 'bg-red-100 text-red-700' :
                              action.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {action.severity}
                            </span>
                            {action.status === 'refined' && (
                              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                {action.refinedChanges.length} change{action.refinedChanges.length !== 1 ? 's' : ''} refined
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-slate-800">{action.title}</h4>
                          <p className="text-xs text-slate-600 mt-1">{action.description}</p>
                          {action.bullets.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {action.bullets.map((bullet, i) => (
                                <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                                  <span className="text-slate-300 mt-0.5">•</span>
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {action.affectedEntityLabels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {action.affectedEntityLabels.map((label, i) => (
                                <span
                                  key={i}
                                  className={`text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 ${onRefClick ? 'cursor-pointer hover:bg-slate-200' : ''}`}
                                  onClick={() => onRefClick?.(action.affectedEntityIds[i])}
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {onRefineAction && action.status === 'open' && (
                            <button
                              onClick={() => onRefineAction(action.id)}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                            >
                              Discuss
                            </button>
                          )}
                          {onDismissAction && action.status === 'open' && (
                            <button
                              onClick={() => onDismissAction(action.id)}
                              className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                              title="Dismiss action"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── e) Proposed Changes (collapsible) ── */}
          <div>
            <button
              onClick={() => setShowChanges(!showChanges)}
              className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showChanges ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Proposed Changes{item.proposedChanges.length > 0 ? ` (${item.proposedChanges.length})` : ''}
            </button>

            {showChanges && (
              <div className="mt-2 space-y-2">
                {item.proposedChanges.length > 0 && (
                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 space-y-2">
                    {item.proposedChanges.map((change, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-2 border border-indigo-100">
                        <div className="flex items-center gap-2 text-xs">
                          <select
                            value={change.targetType}
                            onChange={e => onUpdateChange(idx, { targetType: e.target.value as CheckInChange['targetType'] })}
                            className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white"
                          >
                            <option value="project">Project</option>
                            <option value="keyResult">Key Result</option>
                            <option value="personnel">Personnel</option>
                            <option value="budget">Budget</option>
                          </select>
                          <input
                            value={change.targetId}
                            onChange={e => onUpdateChange(idx, { targetId: e.target.value })}
                            placeholder="Target ID"
                            className="text-xs border border-slate-200 rounded px-2 py-1 w-20"
                          />
                          <input
                            value={change.field}
                            onChange={e => onUpdateChange(idx, { field: e.target.value })}
                            placeholder="Field"
                            className="text-xs border border-slate-200 rounded px-2 py-1 w-24"
                          />
                          <input
                            value={change.from}
                            onChange={e => onUpdateChange(idx, { from: e.target.value })}
                            placeholder="From"
                            className="text-xs border border-slate-200 rounded px-2 py-1 w-24"
                          />
                          <span className="text-slate-400">→</span>
                          <input
                            value={change.to}
                            onChange={e => onUpdateChange(idx, { to: e.target.value })}
                            placeholder="To"
                            className="text-xs border border-slate-200 rounded px-2 py-1 w-24"
                          />
                          {onDirectApplyChange && (
                            <button
                              onClick={() => {
                                setAppliedChanges(prev => [...prev, {
                                  change: item.proposedChanges[idx],
                                  appliedAt: new Date().toISOString(),
                                }]);
                                onDirectApplyChange(idx);
                              }}
                              disabled={!change.targetId || !change.field}
                              className={`flex-shrink-0 flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                                !change.targetId || !change.field
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                              title="Apply this change now"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Apply
                            </button>
                          )}
                          <button
                            onClick={() => onRemoveChange(idx)}
                            className="text-red-400 hover:text-red-600 flex-shrink-0"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {/* Rationale */}
                        <textarea
                          value={change.rationale || ''}
                          onChange={e => onUpdateChange(idx, { rationale: e.target.value })}
                          placeholder="Why is this change needed?"
                          rows={1}
                          className="w-full text-xs border border-slate-200 rounded px-2 py-1 mt-1.5 text-slate-600 placeholder-slate-300 resize-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Proposed Change Button */}
                <button
                  onClick={() => { onAddChange(); setShowChanges(true); }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Propose a change
                </button>

                {/* Applied Changes Log */}
                {appliedChanges.length > 0 && (
                  <div className="mt-2 bg-emerald-50 rounded-lg p-2.5 border border-emerald-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      Applied ({appliedChanges.length})
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {appliedChanges.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="capitalize text-slate-500">{entry.change.targetType}</span>
                            <span className="text-slate-600">{entry.change.targetId}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500">{entry.change.field}:</span>
                            <span className="text-red-400 line-through">{entry.change.from}</span>
                            <span className="text-slate-400">→</span>
                            <span className="text-emerald-600 font-medium">{entry.change.to}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                            {new Date(entry.appliedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── f) Actions row ── */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onOpenChat}
              className={`text-xs font-medium flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all ${
                isChatActive
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
              </svg>
              {isChatActive ? 'Chatting with AI...' : 'Chat with AI'}
            </button>

            {onSubmitItem && (
              <button
                onClick={(e) => { e.stopPropagation(); onSubmitItem(); }}
                className="text-xs font-semibold flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Submit Item
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderItemCard;
