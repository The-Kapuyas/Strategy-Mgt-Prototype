import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Objective, Personnel, Dependency } from '../types';
import { useDetailData, type SelectedItem } from '../hooks/useDetailData';
import { useSessionState } from '../hooks/useSessionState';
import StrategyDetailPanel from './StrategyDetailPanel';
import { getProjectResourceStatus } from '../utils/strategyHelpers';
import { CheckInBrief, CheckInItem, CheckInItemStatus, CheckInChange, LeaderUpdatesBrief, LeaderDraftUpdate, CustomProposal, LeaderRole, SourceDocument } from '../types/checkin';
import { getLeaderPortfolio, buildLeaderContext } from '../utils/leaderHelpers';
import { generateLeaderSuggestions, chatWithLeaderItem, generateImpactAnalysis, LeaderChatResponse } from '../services/openaiService';
import LeaderItemCard, { STATUS_DISPLAY as LEADER_STATUS_DISPLAY, ALL_STATUSES as LEADER_ALL_STATUSES, normalizeStatus as leaderNormalizeStatus, type KRMetrics } from './LeaderItemCard';
import SourceDocumentViewer from './SourceDocumentViewer';
import { SOURCE_DOCUMENTS } from '../fixtures/sourceDocuments';

type CheckInSubView = 'leader-updates' | 'checkin' | 'summary';

interface CheckInPrepViewProps {
  objectives: Objective[];
  setObjectives: (objectives: Objective[]) => void;
  companyName: string;
  personnel: Personnel[];
  checkInBrief?: CheckInBrief;
  leaderUpdates?: LeaderUpdatesBrief;
  onNavigateToBlueprint?: (view?: string) => void;
  dependencies?: Dependency[];
}

// Re-export from LeaderItemCard for local usage
const STATUS_DISPLAY = LEADER_STATUS_DISPLAY;
const normalizeStatus = leaderNormalizeStatus;

const LEADER_ROLES: { role: LeaderRole; dept: string; icon: string }[] = [
  { role: 'VP Product', dept: 'Product', icon: '🎯' },
  { role: 'VP Engineering', dept: 'Engineering', icon: '🔧' },
  { role: 'VP Sales', dept: 'Sales', icon: '📈' },
  { role: 'VP People', dept: 'People', icon: '👥' },
  { role: 'VP Customer Success', dept: 'Customer Success', icon: '🤝' },
];

// ─── RefText: renders text with clickable project/KR reference pills ───
type ItemRefInfo = { type: string; name: string; status?: string; progress?: number; owner?: string; startDate?: string; endDate?: string; description?: string; risks?: string; nextMilestone?: string };

const RefText: React.FC<{ text: string; lookup: Map<string, ItemRefInfo>; onRefClick: (id: string) => void; className?: string }> = ({ text, lookup, onRefClick, className }) => {
  const refPattern = /\b(P\d+|KR\d+\.\d+)\b/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  while ((match = refPattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const id = match[1];
    const info = lookup.get(id);
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
  return <span className={className}>{parts}</span>;
};

// ─── DrillDownTabs: tab bar for in-place drill-down navigation ───
const DrillDownTabs: React.FC<{
  tabs: { id: string; type: string; label: string }[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}> = ({ tabs, activeTabId, onTabSelect, onTabClose }) => {
  const badgeColors: Record<string, string> = {
    keyResult: 'bg-emerald-100 text-emerald-700',
    project: 'bg-indigo-100 text-indigo-700',
    departmentalKeyResult: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {tabs.map((entry, idx) => {
        const isActive = entry.id === activeTabId;
        const isRoot = idx === 0;
        const badge = badgeColors[entry.type] || 'bg-slate-100 text-slate-700';
        return (
          <div
            key={entry.id}
            className={`group flex items-center text-[11px] transition-colors flex-shrink-0 max-w-[220px] rounded-t-lg ${
              isActive
                ? 'bg-white text-slate-800 font-semibold'
                : 'text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer font-medium'
            }`}
          >
            <button
              onClick={() => onTabSelect(entry.id)}
              className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 min-w-0"
            >
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${isActive ? badge : 'bg-slate-200/70 text-slate-500'}`}>{entry.id}</span>
              <span className="truncate">{entry.label}</span>
            </button>
            {!isRoot && (
              <button
                onClick={(e) => { e.stopPropagation(); onTabClose(entry.id); }}
                className={`p-0.5 mr-1.5 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-600 transition-all flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                title="Close tab"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Set serialization helpers for sessionStorage ───
const serializeSetMap = (map: Partial<Record<LeaderRole, Set<string>>>): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v) out[k] = [...v];
  }
  return out;
};
const deserializeSetMap = (raw: unknown): Partial<Record<LeaderRole, Set<string>>> => {
  const out: Partial<Record<LeaderRole, Set<string>>> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, string[]>)) {
      if (Array.isArray(v)) out[k as LeaderRole] = new Set(v);
    }
  }
  return out;
};
const setMapOptions = { serialize: serializeSetMap, deserialize: deserializeSetMap };

// ─── LEADER UPDATE VIEW ───
const LeaderUpdateView: React.FC<{
  objectives: Objective[];
  setObjectives: (objectives: Objective[]) => void;
  personnel: Personnel[];
  companyName: string;
  onAddCheckInItems: (items: CheckInItem[]) => void;
  onNavigate: (view: CheckInSubView) => void;
  leaderUpdates?: LeaderUpdatesBrief;
  dependencies?: Dependency[];
  hasCheckInItems: boolean;
}> = ({ objectives, setObjectives, personnel, companyName, onAddCheckInItems, onNavigate, leaderUpdates, dependencies = [], hasCheckInItems }) => {
  // Per-leader state maps (cached in sessionStorage across navigation)
  const [activeLeader, setActiveLeader] = useSessionState<LeaderRole>('leader-update-activeLeader', LEADER_ROLES[0].role);
  const [leaderPhases, setLeaderPhases] = useSessionState<Partial<Record<LeaderRole, 'loading' | 'review' | 'submitted'>>>('leader-update-phases', {});
  const [leaderDraftItems, setLeaderDraftItems] = useSessionState<Partial<Record<LeaderRole, LeaderDraftUpdate[]>>>('leader-update-draftItems', {});
  const [leaderCustomProposals, setLeaderCustomProposals] = useSessionState<Partial<Record<LeaderRole, CustomProposal[]>>>('leader-update-customProposals', {});
  const [leaderAiSummaries, setLeaderAiSummaries] = useSessionState<Partial<Record<LeaderRole, string>>>('leader-update-aiSummaries', {});
  const [leaderKrMetricsMaps, setLeaderKrMetricsMaps] = useSessionState<Partial<Record<LeaderRole, Record<string, KRMetrics>>>>('leader-update-krMetricsMaps', {});
  const [leaderPortfolioContexts, setLeaderPortfolioContexts] = useSessionState<Partial<Record<LeaderRole, string>>>('leader-update-portfolioContexts', {});
  const [leaderExpandedItems, setLeaderExpandedItems] = useSessionState<Partial<Record<LeaderRole, Set<string>>>>('leader-update-expandedItems', {}, setMapOptions);
  const [leaderSubmittedItems, setLeaderSubmittedItems] = useSessionState<Partial<Record<LeaderRole, Set<string>>>>('leader-update-submittedItems', {}, setMapOptions);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState('');
  const [showNewProposal, setShowNewProposal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Clean up any stuck 'loading' phases from a previous session
  useEffect(() => {
    setLeaderPhases(prev => {
      const cleaned = { ...prev };
      let changed = false;
      for (const [k, v] of Object.entries(cleaned)) {
        if (v === 'loading') { delete cleaned[k as LeaderRole]; changed = true; }
      }
      return changed ? cleaned : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived aliases for the active leader
  const currentPhase = leaderPhases[activeLeader];
  const draftItems = leaderDraftItems[activeLeader] || [];
  const customProposals = leaderCustomProposals[activeLeader] || [];
  const aiSummary = leaderAiSummaries[activeLeader] || '';
  const krMetricsMap = leaderKrMetricsMaps[activeLeader] || {};
  const portfolioContext = leaderPortfolioContexts[activeLeader] || '';
  const expandedItems = leaderExpandedItems[activeLeader] || new Set<string>();
  const submittedItemIds = leaderSubmittedItems[activeLeader] || new Set<string>();

  // Leader completion: all items submitted
  const isLeaderComplete = (role: LeaderRole) => {
    const items = leaderDraftItems[role] || [];
    const submitted = leaderSubmittedItems[role] || new Set();
    return items.length > 0 && items.every(i => submitted.has(i.itemId));
  };

  // Progress tracking
  const leadersWithItems = LEADER_ROLES.filter(lr => {
    const p = getLeaderPortfolio(lr.role, objectives);
    return p.projects.length + p.keyResults.length > 0;
  });
  const completedCount = leadersWithItems.filter(lr => isLeaderComplete(lr.role)).length;


  // Dropdown click-outside and escape
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [dropdownOpen]);

  // AI Chat panel state
  const [aiChatItemId, setAiChatItemId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<LeaderChatResponse['suggestedUpdates'] | null>(null);
  const [activeRefinementAction, setActiveRefinementAction] = useState<{ itemId: string; actionId: string } | null>(null);

  // Source document viewer state
  const [viewingDocument, setViewingDocument] = useState<SourceDocument | null>(null);

  // Customization: status override visibility
  const [showStatusOverride] = useState<boolean>(() => {
    try { return localStorage.getItem('pulley-show-status-override') === 'true'; } catch { return false; }
  });

  // Detail side panel state (for reference drill-in via StrategyDetailPanel)
  const [detailSelectedItem, setDetailSelectedItem] = useState<SelectedItem | null>(null);

  // Build list of source documents relevant to the current leader's items
  const sourceDocumentsList = React.useMemo(() => {
    return Object.values(SOURCE_DOCUMENTS);
  }, []);

  // Lookup map for project/KR references (used by RefText pills)
  const itemLookup = useMemo(() => {
    const map = new Map<string, { type: string; name: string }>();
    objectives.forEach(obj => {
      obj.keyResults.forEach(kr => {
        map.set(kr.id, { type: 'keyResult', name: kr.title });
        (kr.departmentalProjects || []).forEach(p => {
          map.set(p.id, { type: 'project', name: p.title });
        });
      });
    });
    return map;
  }, [objectives]);

  // Detail data for StrategyDetailPanel
  const detailData = useDetailData(detailSelectedItem, objectives, objectives, dependencies, getProjectResourceStatus, personnel);

  const handleOpenDetail = (id: string) => {
    setAiChatItemId(null);
    setChatMessages([]);
    setAiDraft(null);
    const info = itemLookup.get(id);
    if (!info) return;
    setDetailSelectedItem(prev => prev?.id === id ? null : { id, type: info.type === 'keyResult' ? 'keyResult' : 'project', label: info.name });
  };

  // Drill-down tabs: maps root parent itemId → set of open tab itemIds
  const [drillDownTabs, setDrillDownTabs] = useState<Record<string, string[]>>({});
  // Which tab is active per root item (null/undefined = root itself is active)
  const [activeDrillTab, setActiveDrillTab] = useState<Record<string, string>>({});

  const handleDrillDown = (rootItemId: string, childRefId: string) => {
    setDrillDownTabs(prev => {
      const tabs = prev[rootItemId] || [];
      // Add tab if not already open
      if (tabs.includes(childRefId)) return prev;
      return { ...prev, [rootItemId]: [...tabs, childRefId] };
    });
    setActiveDrillTab(prev => ({ ...prev, [rootItemId]: childRefId }));
  };

  const handleTabSelect = (rootItemId: string, tabId: string) => {
    setActiveDrillTab(prev => ({ ...prev, [rootItemId]: tabId }));
  };

  const handleTabClose = (rootItemId: string, tabId: string) => {
    setDrillDownTabs(prev => {
      const tabs = (prev[rootItemId] || []).filter(t => t !== tabId);
      if (tabs.length === 0) {
        const { [rootItemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [rootItemId]: tabs };
    });
    // If closing the active tab, switch to root
    setActiveDrillTab(prev => {
      if (prev[rootItemId] === tabId) {
        const { [rootItemId]: _, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  };

  // Build a basic LeaderDraftUpdate from raw objective data for items not in current leader's drafts
  const buildFallbackDraftItem = (itemId: string): LeaderDraftUpdate | null => {
    for (const obj of objectives) {
      for (const kr of obj.keyResults) {
        if (kr.id === itemId) {
          const statusMap: Record<string, LeaderDraftUpdate['aiSuggestedStatus']> = { at_risk: 'at_risk', blocked: 'blocked', on_track: 'on_track', ahead: 'ahead', done: 'done' };
          return {
            itemId: kr.id,
            itemType: 'keyResult',
            itemLabel: kr.title,
            aiSuggestedStatus: statusMap[kr.status || ''] || 'on_track',
            aiRationale: kr.risks || `Progress: ${kr.progress ?? 0}%`,
            leaderStatus: statusMap[kr.status || ''] || 'on_track',
            leaderNarrative: kr.risks || `Progress: ${kr.progress ?? 0}%`,
            confirmed: false,
            proposedActions: [],
            proposedChanges: [],
            generatedAt: new Date().toISOString(),
          };
        }
        for (const p of kr.departmentalProjects || []) {
          if (p.id === itemId) {
            const pStatus = p.status === 'Done' ? 'done' : p.progress >= 80 ? 'ahead' : p.progress >= 40 ? 'on_track' : 'at_risk';
            return {
              itemId: p.id,
              itemType: 'project',
              itemLabel: p.title,
              aiSuggestedStatus: pStatus,
              aiRationale: [p.risks, p.actual, `Progress: ${p.progress}%`].filter(Boolean).join('. '),
              leaderStatus: pStatus,
              leaderNarrative: [p.risks, p.actual, `Progress: ${p.progress}%`].filter(Boolean).join('. '),
              confirmed: false,
              proposedActions: [],
              proposedChanges: [],
              generatedAt: new Date().toISOString(),
            };
          }
        }
      }
    }
    return null;
  };

  // New proposal form state
  const [newProposalTitle, setNewProposalTitle] = useState('');
  const [newProposalSummary, setNewProposalSummary] = useState('');
  const [newProposalRationale, setNewProposalRationale] = useState('');
  const [newProposalSeverity, setNewProposalSeverity] = useState<'critical' | 'warning' | 'info'>('warning');

  const toggleItem = (itemId: string) => {
    setLeaderExpandedItems(prev => {
      const current = prev[activeLeader] || new Set<string>();
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return { ...prev, [activeLeader]: next };
    });
  };

  const switchLeader = (role: LeaderRole) => {
    setAiChatItemId(null);
    setChatMessages([]);
    setAiDraft(null);
    setDetailSelectedItem(null);
    setError('');
    setActiveLeader(role);
  };

  const startAnalysis = async (role: LeaderRole) => {
    // Already generated? Nothing to do
    if (leaderPhases[role] === 'review' || leaderPhases[role] === 'submitted') {
      return;
    }

    setLeaderPhases(prev => ({ ...prev, [role]: 'loading' }));

    const portfolio = getLeaderPortfolio(role, objectives);
    const totalItems = portfolio.projects.length + portfolio.keyResults.length;
    setLoadingStatus(`Analyzing ${portfolio.projects.length} projects and ${portfolio.keyResults.length} KRs for ${role}...`);

    if (totalItems === 0) {
      setError(`No projects or key results found for ${role}. This leader may not have items in the current blueprint.`);
      setLeaderPhases(prev => { const next = { ...prev }; delete next[role]; return next; });
      return;
    }

    try {
      const context = buildLeaderContext(portfolio, personnel);
      setLeaderPortfolioContexts(prev => ({ ...prev, [role]: context }));

      // Build KR metrics map from portfolio
      const metricsMap: Record<string, KRMetrics> = {};
      for (const kr of portfolio.keyResults) {
        if (kr.keyResult.metric && kr.keyResult.current !== undefined && kr.keyResult.target !== undefined) {
          metricsMap[kr.id] = { metric: kr.keyResult.metric, current: Number(kr.keyResult.current), target: Number(kr.keyResult.target) };
        }
      }
      setLeaderKrMetricsMaps(prev => ({ ...prev, [role]: metricsMap }));

      const sourceDocsList = Object.values(SOURCE_DOCUMENTS);
      const result = await generateLeaderSuggestions(role, companyName, context, sourceDocsList);
      setLeaderAiSummaries(prev => ({ ...prev, [role]: result.summary }));

      // Convert AI suggestions to draft items (verbose assessments included for at-risk/blocked items)
      const drafts: LeaderDraftUpdate[] = result.items.map(item => ({
        itemId: item.itemId,
        itemType: item.itemType,
        itemLabel: item.itemLabel,
        aiSuggestedStatus: normalizeStatus(item.suggestedStatus),
        aiRationale: item.rationale,
        aiFlags: item.flags || [],
        leaderStatus: normalizeStatus(item.suggestedStatus),
        leaderNarrative: item.rationale,
        confirmed: true,
        proposedActions: (item.proposedActions || []).map(a => ({
          id: `PA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: a.title,
          description: a.description,
          bullets: a.bullets || [],
          affectedEntityIds: a.affectedEntityIds || [],
          affectedEntityLabels: a.affectedEntityLabels || [],
          severity: a.severity || 'info',
          status: 'open' as const,
          refinedChanges: [],
        })),
        proposedChanges: [],
        verboseAssessment: item.verboseAssessment,
        detailedAnalysis: item.detailedAnalysis as LeaderDraftUpdate['detailedAnalysis'],
        sourceDocumentIds: item.citedSourceDocumentIds,
        generatedAt: new Date().toISOString(),
      }));

      // Backfill any portfolio items the AI missed with default "on_track" entries
      const aiItemIds = new Set(drafts.map(d => d.itemId));
      for (const kr of portfolio.keyResults) {
        if (!aiItemIds.has(kr.id)) {
          drafts.push({
            itemId: kr.id,
            itemType: 'keyResult',
            itemLabel: `${kr.id}: ${kr.title}`,
            aiSuggestedStatus: 'on_track',
            aiRationale: 'No issues detected.',
            aiFlags: [],
            leaderStatus: 'on_track',
            leaderNarrative: 'No issues detected.',
            confirmed: true,
            proposedActions: [],
            proposedChanges: [],
            generatedAt: new Date().toISOString(),
          });
        }
      }
      for (const proj of portfolio.projects) {
        if (!aiItemIds.has(proj.id)) {
          drafts.push({
            itemId: proj.id,
            itemType: 'project',
            itemLabel: `${proj.id}: ${proj.title}`,
            aiSuggestedStatus: 'on_track',
            aiRationale: 'No issues detected.',
            aiFlags: [],
            leaderStatus: 'on_track',
            leaderNarrative: 'No issues detected.',
            confirmed: true,
            proposedActions: [],
            proposedChanges: [],
            generatedAt: new Date().toISOString(),
          });
        }
      }

      setLeaderDraftItems(prev => ({ ...prev, [role]: drafts }));
      setLeaderExpandedItems(prev => ({ ...prev, [role]: new Set(drafts.filter(d => d.aiSuggestedStatus !== 'on_track').map(d => d.itemId)) }));
      setLeaderPhases(prev => ({ ...prev, [role]: 'review' }));
    } catch (err) {
      setError(`Failed to generate suggestions. ${err instanceof Error ? err.message : 'Please check your API key and try again.'}`);
      setLeaderPhases(prev => { const next = { ...prev }; delete next[role]; return next; });
    }
  };

  const updateDraftItem = (itemId: string, updates: Partial<LeaderDraftUpdate>) => {
    setLeaderDraftItems(prev => ({
      ...prev,
      [activeLeader]: (prev[activeLeader] || []).map(item => {
        if (item.itemId !== itemId) return item;
        const updated = { ...item, ...updates };
        if (updates.leaderStatus && updates.leaderStatus !== item.aiSuggestedStatus) {
          updated.confirmed = false;
        }
        return updated;
      }),
    }));
  };

  const addProposedChange = (itemId: string) => {
    setLeaderDraftItems(prev => ({
      ...prev,
      [activeLeader]: (prev[activeLeader] || []).map(item => {
        if (item.itemId !== itemId) return item;
        return {
          ...item,
          proposedChanges: [...item.proposedChanges, {
            targetType: 'project' as const,
            targetId: '',
            targetLabel: '',
            field: '',
            from: '',
            to: '',
          }],
        };
      }),
    }));
  };

  const updateProposedChange = (itemId: string, changeIdx: number, updates: Partial<CheckInChange>) => {
    setLeaderDraftItems(prev => ({
      ...prev,
      [activeLeader]: (prev[activeLeader] || []).map(item => {
        if (item.itemId !== itemId) return item;
        const changes = [...item.proposedChanges];
        changes[changeIdx] = { ...changes[changeIdx], ...updates };
        return { ...item, proposedChanges: changes };
      }),
    }));
  };

  const removeProposedChange = (itemId: string, changeIdx: number) => {
    setLeaderDraftItems(prev => ({
      ...prev,
      [activeLeader]: (prev[activeLeader] || []).map(item => {
        if (item.itemId !== itemId) return item;
        return { ...item, proposedChanges: item.proposedChanges.filter((_, i) => i !== changeIdx) };
      }),
    }));
  };

  const directApplyChange = (itemId: string, changeIdx: number) => {
    const draftItems = leaderDraftItems[activeLeader] || [];
    const item = draftItems.find(d => d.itemId === itemId);
    if (!item) return;
    const change = item.proposedChanges[changeIdx];
    if (!change || !change.targetId || !change.field) return;

    const updated = JSON.parse(JSON.stringify(objectives)) as Objective[];

    if (change.targetType === 'project') {
      for (const obj of updated) {
        for (const kr of obj.keyResults) {
          for (const proj of (kr.departmentalProjects || [])) {
            if (proj.id === change.targetId) {
              if (change.field === 'start_date') proj.startDate = change.to;
              if (change.field === 'end_date') proj.endDate = change.to;
              if (change.field === 'status' && (change.to === 'completed' || change.to === 'Done')) {
                proj.status = 'Done';
                proj.progress = 100;
              }
            }
          }
        }
      }
    }
    if (change.targetType === 'keyResult') {
      for (const obj of updated) {
        for (const kr of obj.keyResults) {
          if (kr.id === change.targetId) {
            if (change.field === 'target_date') kr.targetDate = change.to;
          }
        }
      }
    }
    if (change.targetType === 'personnel' && change.field === 'remove_from_project') {
      const projIdMatch = change.from.match(/^(P\d+)/);
      if (projIdMatch) {
        const projId = projIdMatch[1];
        for (const obj of updated) {
          for (const kr of obj.keyResults) {
            for (const proj of (kr.departmentalProjects || [])) {
              if (proj.id === projId) {
                proj.headcount = (proj.headcount || []).filter(hc => hc.name !== change.targetLabel);
              }
            }
          }
        }
      }
    }
    if (change.targetType === 'personnel' && change.field === 'add_to_project') {
      const projIdMatch = change.to.match(/^(P\d+)/);
      if (projIdMatch) {
        const projId = projIdMatch[1];
        for (const obj of updated) {
          for (const kr of obj.keyResults) {
            for (const proj of (kr.departmentalProjects || [])) {
              if (proj.id === projId) {
                const person = personnel.find(p => p.name === change.targetLabel);
                (proj.headcount || []).push({
                  id: `${projId}-direct-${Date.now()}`,
                  personnelId: person?.id,
                  name: change.targetLabel,
                  role: person?.role || 'Team Member',
                  allocation: 'Full-time',
                });
              }
            }
          }
        }
      }
    }

    setObjectives(updated);
    removeProposedChange(itemId, changeIdx);
  };

  const dismissAction = (itemId: string, actionId: string) => {
    setLeaderDraftItems(prev => ({
      ...prev,
      [activeLeader]: (prev[activeLeader] || []).map(item => {
        if (item.itemId !== itemId) return item;
        return {
          ...item,
          proposedActions: item.proposedActions.map(a =>
            a.id === actionId ? { ...a, status: 'dismissed' as const } : a
          ),
        };
      }),
    }));
  };

  const refineAction = async (itemId: string, actionId: string) => {
    const item = draftItems.find(d => d.itemId === itemId);
    if (!item) return;
    const action = item.proposedActions.find(a => a.id === actionId);
    if (!action) return;

    setActiveRefinementAction({ itemId, actionId });

    // Open chat and immediately seed with a user message + AI call
    // so the user lands directly in a conversation, not the prompt page
    setDetailSelectedItem(null);
    const userPrompt = `Let's refine this proposed action into concrete changes: "${action.title}" — ${action.description}`;
    const userMsg = { role: 'user' as const, content: userPrompt };
    setChatMessages([userMsg]);
    setChatInput('');
    setAiDraft(null);
    setAiChatItemId(itemId);
    setChatLoading(true);

    try {
      const krM = item.itemType === 'keyResult' ? krMetricsMap[item.itemId] : undefined;
      const itemContext = [
        `Item: ${item.itemId} - ${item.itemLabel} (${item.itemType})`,
        `AI Assessment: ${LEADER_STATUS_DISPLAY[item.aiSuggestedStatus].label} - ${item.aiRationale}`,
        `Current leader status: ${LEADER_STATUS_DISPLAY[item.leaderStatus].label}`,
        `Leader notes: ${item.leaderNarrative || '(none)'}`,
        krM ? `Metric: ${krM.metric}, Current: ${krM.current}, Target: ${krM.target}` : '',
        `Proposed changes: ${item.proposedChanges.length}`,
        `Flags: ${item.aiFlags?.join(', ') || 'none'}`,
        '',
        'ACTIVE PROPOSED ACTION BEING REFINED:',
        `Title: ${action.title}`,
        `Description: ${action.description}`,
        `Key points: ${action.bullets.join('; ')}`,
        `Affected entities: ${action.affectedEntityIds.join(', ')}`,
        `Severity: ${action.severity}`,
        '',
        'Full portfolio context:',
        portfolioContext,
      ].filter(Boolean).join('\n');

      const response = await chatWithLeaderItem(userPrompt, itemContext, companyName, []);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      if (response.suggestedUpdates) {
        setAiDraft(response.suggestedUpdates);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleOpenChat = (itemId: string) => {
    setDetailSelectedItem(null);
    if (aiChatItemId !== itemId) {
      setChatMessages([]);
      setChatInput('');
      setAiDraft(null);
    }
    setAiChatItemId(itemId);
  };

  const handleCloseChat = () => {
    setAiChatItemId(null);
  };

  const getPromptSuggestions = (item: LeaderDraftUpdate): { label: string; prompt: string }[] => {
    const staticPrompts = [
      { label: 'Help me draft a status narrative', prompt: 'Draft a narrative for this update' },
      { label: item.proposedChanges.length > 0
        ? 'Walk me through the proposed changes'
        : 'Suggest proposed changes for this item',
        prompt: item.proposedChanges.length > 0
        ? 'Walk me through the proposed changes and whether I should accept them'
        : 'Are there any proposed changes I should make for this item?' },
    ];

    // Add action-specific refinement prompts
    const openActions = (item.proposedActions || []).filter(a => a.status === 'open');
    for (const action of openActions.slice(0, 2)) {
      staticPrompts.push({
        label: `Refine: ${action.title}`,
        prompt: `Let's refine this proposed action into concrete changes: "${action.title}" — ${action.description}`,
      });
    }

    const contextPrompts: { label: string; prompt: string }[] = [];

    if (item.aiSuggestedStatus !== item.leaderStatus) {
      const aiLabel = LEADER_STATUS_DISPLAY[item.aiSuggestedStatus]?.label || item.aiSuggestedStatus;
      contextPrompts.push({ label: `Why does AI suggest ${aiLabel}?`, prompt: `Why does AI suggest ${aiLabel} instead of ${LEADER_STATUS_DISPLAY[item.leaderStatus]?.label}?` });
    }
    if (item.aiFlags && item.aiFlags.length > 0) {
      contextPrompts.push({ label: 'What do the flags mean for this item?', prompt: 'Tell me more about the flags on this item and what I should do about them' });
    }
    if (item.itemType === 'keyResult' && krMetricsMap[item.itemId]) {
      contextPrompts.push({ label: 'How are we tracking against target?', prompt: 'How are we tracking against the target metric?' });
    }
    if (!item.leaderNarrative) {
      contextPrompts.push({ label: 'Help me write the update', prompt: 'Help me write the update narrative for this item' });
    }
    if (item.aiSuggestedStatus === 'blocked' || item.aiSuggestedStatus === 'at_risk') {
      contextPrompts.push({ label: 'What would help unblock this?', prompt: 'What actions could help unblock or de-risk this item?' });
    }

    return [...staticPrompts, ...contextPrompts.slice(0, 2)];
  };

  const handleChatSend = async (overrideMsg?: string) => {
    const msg = overrideMsg ?? chatInput.trim();
    if (!msg || chatLoading || !aiChatItemId) return;

    const item = draftItems.find(d => d.itemId === aiChatItemId);
    if (!item) return;

    const userMsg = { role: 'user' as const, content: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const krM = item.itemType === 'keyResult' ? krMetricsMap[item.itemId] : undefined;
      // Include active refinement action context if applicable
      const refinementAction = activeRefinementAction?.itemId === item.itemId
        ? item.proposedActions.find(a => a.id === activeRefinementAction.actionId)
        : null;

      const itemContext = [
        `Item: ${item.itemId} - ${item.itemLabel} (${item.itemType})`,
        `AI Assessment: ${LEADER_STATUS_DISPLAY[item.aiSuggestedStatus].label} - ${item.aiRationale}`,
        `Current leader status: ${LEADER_STATUS_DISPLAY[item.leaderStatus].label}`,
        `Leader notes: ${item.leaderNarrative || '(none)'}`,
        krM ? `Metric: ${krM.metric}, Current: ${krM.current}, Target: ${krM.target}` : '',
        `Proposed changes: ${item.proposedChanges.length}`,
        `Flags: ${item.aiFlags?.join(', ') || 'none'}`,
        refinementAction ? [
          '',
          'ACTIVE PROPOSED ACTION BEING REFINED:',
          `Title: ${refinementAction.title}`,
          `Description: ${refinementAction.description}`,
          `Key points: ${refinementAction.bullets.join('; ')}`,
          `Affected entities: ${refinementAction.affectedEntityIds.join(', ')}`,
          `Severity: ${refinementAction.severity}`,
        ].join('\n') : '',
        '',
        'Full portfolio context:',
        portfolioContext,
      ].filter(Boolean).join('\n');

      const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
      const response = await chatWithLeaderItem(msg, itemContext, companyName, history);

      setChatMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      if (response.suggestedUpdates) {
        setAiDraft(response.suggestedUpdates);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAcceptDraft = () => {
    if (!aiDraft || !aiChatItemId) return;
    const updates: Partial<LeaderDraftUpdate> = {};
    const item = draftItems.find(d => d.itemId === aiChatItemId);
    if (!item) return;

    if (aiDraft.status) {
      updates.leaderStatus = aiDraft.status;
      updates.confirmed = aiDraft.status === item.aiSuggestedStatus;
    }
    if (aiDraft.narrative) {
      updates.leaderNarrative = aiDraft.narrative;
    }
    if (aiDraft.proposedChanges && aiDraft.proposedChanges.length > 0) {
      updates.proposedChanges = [...item.proposedChanges, ...aiDraft.proposedChanges];

      // Mark the active refinement action as refined
      if (activeRefinementAction?.itemId === aiChatItemId) {
        updates.proposedActions = item.proposedActions.map(a =>
          a.id === activeRefinementAction.actionId
            ? { ...a, status: 'refined' as const, refinedChanges: [...a.refinedChanges, ...aiDraft.proposedChanges!] }
            : a
        );
        setActiveRefinementAction(null);
      }
    }
    updateDraftItem(aiChatItemId, updates);
    setAiDraft(null);
  };

  const handleAddCustomProposal = () => {
    if (!newProposalTitle.trim()) return;
    const proposal: CustomProposal = {
      id: `CP-${Date.now()}`,
      title: newProposalTitle,
      summary: newProposalSummary,
      rationale: newProposalRationale,
      changes: [],
      severity: newProposalSeverity,
    };
    setLeaderCustomProposals(prev => ({ ...prev, [activeLeader]: [...(prev[activeLeader] || []), proposal] }));
    setNewProposalTitle('');
    setNewProposalSummary('');
    setNewProposalRationale('');
    setNewProposalSeverity('warning');
    setShowNewProposal(false);
  };

  const handleSubmitItem = (itemId: string) => {
    const item = draftItems.find(d => d.itemId === itemId);
    if (!item) return;

    // Convert to CheckInItem
    const checkInItem: CheckInItem = {
      id: `LU-${item.itemId}-${Date.now()}`,
      type: item.proposedChanges.length > 0 ? 'decision' : 'fyi',
      severity: item.leaderStatus === 'blocked' ? 'critical' : item.leaderStatus === 'at_risk' ? 'warning' : 'info',
      title: `${item.itemLabel} — ${STATUS_DISPLAY[item.leaderStatus].label}`,
      proposedBy: activeLeader,
      summary: item.leaderNarrative || `${activeLeader} marked ${item.itemLabel} as ${STATUS_DISPLAY[item.leaderStatus].label}.`,
      rationale: item.confirmed ? item.aiRationale : item.leaderNarrative || '',
      changes: item.proposedChanges.filter(c => c.targetId && c.field),
      impact: '',
      status: 'pending',
    };

    onAddCheckInItems([checkInItem]);

    // Mark as submitted
    const newSubmitted = new Set([...(leaderSubmittedItems[activeLeader] || []), itemId]);
    setLeaderSubmittedItems(prev => ({
      ...prev,
      [activeLeader]: newSubmitted,
    }));

    // Collapse the card
    setLeaderExpandedItems(prev => {
      const current = new Set(prev[activeLeader] || new Set<string>());
      current.delete(itemId);
      return { ...prev, [activeLeader]: current };
    });

    // Close chat if open for this item
    if (aiChatItemId === itemId) {
      setAiChatItemId(null);
      setChatMessages([]);
    }

  };

  const handleSubmitCustomProposal = (cpId: string) => {
    const cp = customProposals.find(p => p.id === cpId);
    if (!cp) return;

    const checkInItem: CheckInItem = {
      id: cp.id,
      type: 'decision',
      severity: cp.severity === 'critical' ? 'critical' : cp.severity === 'warning' ? 'warning' : 'info',
      title: cp.title,
      proposedBy: activeLeader,
      summary: cp.summary,
      rationale: cp.rationale,
      changes: cp.changes.filter(c => c.targetId && c.field),
      impact: '',
      status: 'pending',
    };

    onAddCheckInItems([checkInItem]);

    // Remove from custom proposals (it's now in the brief)
    setLeaderCustomProposals(prev => ({
      ...prev,
      [activeLeader]: (prev[activeLeader] || []).filter(p => p.id !== cpId),
    }));
  };

  // Stats
  const overrideCount = draftItems.filter(i => !i.confirmed).length;
  const proposalCount = draftItems.filter(i => i.proposedChanges.length > 0).length + customProposals.length;

  // ─── Leader Dropdown + Content ───
  const activeLeaderInfo = LEADER_ROLES.find(lr => lr.role === activeLeader)!;
  const activePortfolio = getLeaderPortfolio(activeLeader, objectives);

  // All leaders submitted — show completion
  const allDone = completedCount === leadersWithItems.length && leadersWithItems.length > 0;
  // Fallback: if draft items were lost on remount but check-in items exist, treat as done
  const alreadyAdvanced = hasCheckInItems && leadersWithItems.length === 0;
  const showCompletion = allDone || alreadyAdvanced;

  // Auto-advance to Check-in Brief after a short pause
  useEffect(() => {
    if (showCompletion) {
      const timer = setTimeout(() => onNavigate('checkin'), 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCompletion]);

  if (showCompletion) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">All Leader Updates Submitted</h2>
        <p className="text-sm text-slate-500 mb-6">
          {leadersWithItems.length > 0
            ? `${completedCount} of ${leadersWithItems.length} leaders complete. Updates have been added to the Check-in Brief.`
            : 'Updates have been added to the Check-in Brief.'
          }
        </p>
        <button
          onClick={() => onNavigate('checkin')}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
        >
          View Check-in Brief →
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header: Dropdown + Progress + Stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {/* Leader Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 hover:border-indigo-300 transition-all shadow-sm cursor-pointer"
            >
              <span className="text-xl">{activeLeaderInfo.icon}</span>
              <div className="text-left">
                <span className="text-sm font-semibold text-slate-800 block">{activeLeader}</span>
                <span className="text-xs text-slate-500">{activeLeaderInfo.dept} &middot; {activePortfolio.projects.length}P, {activePortfolio.keyResults.length}KR</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 ml-1 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                {LEADER_ROLES.map(({ role, dept, icon }) => {
                  const portfolio = getLeaderPortfolio(role, objectives);
                  const itemCount = portfolio.projects.length + portfolio.keyResults.length;
                  const phase = leaderPhases[role];
                  const isActive = role === activeLeader;
                  const isDisabled = itemCount === 0;

                  return (
                    <button
                      key={role}
                      onClick={() => {
                        if (!isDisabled) {
                          switchLeader(role);
                          setDropdownOpen(false);
                        }
                      }}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className="text-lg">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm block ${isActive ? 'font-semibold text-indigo-700' : 'font-medium text-slate-800'}`}>{role}</span>
                        <span className="text-xs text-slate-500">{dept} &middot; {portfolio.projects.length}P, {portfolio.keyResults.length}KR</span>
                      </div>
                      {/* Status indicator */}
                      {isLeaderComplete(role) ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : phase === 'loading' ? (
                        <svg className="animate-spin h-3.5 w-3.5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : phase === 'review' ? (
                        <span className="text-xs text-indigo-500 font-medium">
                          {(leaderSubmittedItems[role] || new Set()).size}/{(leaderDraftItems[role] || []).length}
                        </span>
                      ) : !isDisabled ? (
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {currentPhase === 'review' && (
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="font-medium text-indigo-600">{submittedItemIds.size}/{draftItems.length} submitted</span>
            <span className={overrideCount > 0 ? 'text-amber-600 font-medium' : ''}>{overrideCount} overrides</span>
            <span className={proposalCount > 0 ? 'text-indigo-600 font-medium' : ''}>{proposalCount} proposals</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => startAnalysis(activeLeader)} className="text-xs font-medium text-red-600 hover:text-red-800 ml-4">Retry</button>
        </div>
      )}

      {/* Welcome banner — analysis not yet started */}
      {!currentPhase && !error && (
        <div className="max-w-xl mx-auto text-center py-16">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-2xl mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Check-in prep is open</h2>
          <p className="text-sm text-slate-500 mb-6">
            Review your portfolio items and submit status updates for the upcoming check-in.
          </p>
          <button
            onClick={() => startAnalysis(activeLeader)}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Start Reviewing Items
          </button>
        </div>
      )}

      {/* Loading state — analysis in progress */}
      {currentPhase === 'loading' && !error && (
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-3 px-6 py-4 bg-white rounded-2xl shadow-sm border border-slate-200">
            <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">{loadingStatus}</span>
          </div>
        </div>
      )}


      {/* Review content */}
      {currentPhase === 'review' && (<>
      <div className="flex">
      <div className="flex-1 min-w-0">
      {/* (review content starts here — keep original indentation) */}

      {/* AI Summary */}
      {aiSummary && (
        <div className="mb-5 bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1z" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">AI Portfolio Summary</span>
          </div>
          <p className="text-xs text-indigo-800 leading-relaxed"><RefText text={aiSummary} lookup={itemLookup} onRefClick={handleOpenDetail} /></p>
        </div>
      )}

      {/* Item Cards */}
      <div className="space-y-3">
        {draftItems.map(item => {
          const openTabs = drillDownTabs[item.itemId];
          const hasTabs = openTabs && openTabs.length > 0;
          const activeTabId = activeDrillTab[item.itemId] || item.itemId;
          const isShowingChild = hasTabs && activeTabId !== item.itemId;

          // Determine which item to display based on active tab
          const activeItem = isShowingChild
            ? (draftItems.find(d => d.itemId === activeTabId) || buildFallbackDraftItem(activeTabId))
            : item;

          // Build tab list: root + all open tabs
          const tabList = hasTabs ? [
            { id: item.itemId, type: item.itemType, label: item.itemLabel },
            ...openTabs.map(tid => {
              const di = draftItems.find(d => d.itemId === tid);
              return di ? { id: di.itemId, type: di.itemType, label: di.itemLabel }
                       : { id: tid, type: 'project', label: itemLookup.get(tid)?.name || tid };
            }),
          ] : null;

          // When tabs are present, determine card border style so the wrapper can own it
          const isChatActiveForItem = tabList && aiChatItemId === activeItem?.itemId;
          const isWarningBorder = tabList && activeItem && (activeItem.aiSuggestedStatus === 'at_risk' || activeItem.aiSuggestedStatus === 'blocked');
          const wrapperBorder = tabList
            ? isChatActiveForItem
              ? 'rounded-xl border border-indigo-200 ring-2 ring-indigo-300'
              : isWarningBorder
                ? 'rounded-xl border border-amber-200'
                : 'rounded-xl border border-slate-200'
            : '';

          return (
            <div key={item.itemId} className={tabList ? wrapperBorder : ''}>
              {/* Tabs when drill-down tabs are open */}
              {tabList && (
                <div className="bg-slate-50/80 rounded-t-xl pt-1.5 px-1.5">
                  <DrillDownTabs
                    tabs={tabList}
                    activeTabId={activeTabId}
                    onTabSelect={(tabId) => handleTabSelect(item.itemId, tabId)}
                    onTabClose={(tabId) => handleTabClose(item.itemId, tabId)}
                  />
                </div>
              )}
              {/* Single card — shows root item OR active tab's item */}
              <div className="transition-all duration-200">
                {activeItem ? (
                  <LeaderItemCard
                    item={activeItem}
                    isExpanded={isShowingChild || expandedItems.has(item.itemId)}
                    isSubmitted={submittedItemIds.has(activeItem.itemId)}
                    onSubmitItem={() => handleSubmitItem(activeItem.itemId)}
                    onToggle={() => !isShowingChild && toggleItem(item.itemId)}
                    onUpdateItem={(updates) => updateDraftItem(activeItem.itemId, updates)}
                    onAddChange={() => addProposedChange(activeItem.itemId)}
                    onUpdateChange={(idx, updates) => updateProposedChange(activeItem.itemId, idx, updates)}
                    onRemoveChange={(idx) => removeProposedChange(activeItem.itemId, idx)}
                    onDirectApplyChange={(idx) => directApplyChange(activeItem.itemId, idx)}
                    onDismissAction={(actionId) => dismissAction(activeItem.itemId, actionId)}
                    onRefineAction={(actionId) => refineAction(activeItem.itemId, actionId)}
                    krMetrics={activeItem.itemType === 'keyResult' ? krMetricsMap[activeItem.itemId] : undefined}
                    onOpenChat={() => handleOpenChat(activeItem.itemId)}
                    isChatActive={aiChatItemId === activeItem.itemId}
                    sourceDocuments={activeItem.sourceDocumentIds ? sourceDocumentsList.filter(d => activeItem.sourceDocumentIds!.includes(d.id)) : undefined}
                    onOpenSourceDocument={(doc) => setViewingDocument(doc)}
                    itemLookup={itemLookup}
                    onRefClick={(refId) => handleDrillDown(item.itemId, refId)}
                    showStatusOverride={showStatusOverride}
                    className={tabList ? 'border-0 ring-0 shadow-none rounded-t-none' : ''}
                  />
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{activeTabId}</span> is not in this leader&apos;s portfolio. It may belong to a different department&apos;s assessment.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Proposals */}
      {customProposals.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Additional Proposals</h3>
          <div className="space-y-2">
            {customProposals.map(cp => (
              <div key={cp.id} className="bg-white rounded-xl border border-indigo-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cp.severity === 'critical' ? 'bg-red-100 text-red-700' : cp.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {cp.severity}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{cp.title}</span>
                  </div>
                  <button
                    onClick={() => setLeaderCustomProposals(prev => ({ ...prev, [activeLeader]: (prev[activeLeader] || []).filter(p => p.id !== cp.id) }))}
                    className="text-red-400 hover:text-red-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {cp.summary && <p className="text-xs text-slate-600 mt-2">{cp.summary}</p>}
                {cp.rationale && <p className="text-xs text-slate-500 mt-1 italic">{cp.rationale}</p>}
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => handleSubmitCustomProposal(cp.id)}
                    className="text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Submit Proposal
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Proposal Form */}
      {showNewProposal ? (
        <div className="mt-4 bg-white rounded-xl border border-indigo-200 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">New Proposal</h4>
          <input
            value={newProposalTitle}
            onChange={e => setNewProposalTitle(e.target.value)}
            placeholder="Proposal title"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 placeholder-slate-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
          />
          <textarea
            value={newProposalSummary}
            onChange={e => setNewProposalSummary(e.target.value)}
            placeholder="What are you proposing?"
            rows={2}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 placeholder-slate-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 resize-none"
          />
          <textarea
            value={newProposalRationale}
            onChange={e => setNewProposalRationale(e.target.value)}
            placeholder="Why is this needed?"
            rows={2}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 placeholder-slate-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 resize-none"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Severity:</label>
            {(['info', 'warning', 'critical'] as const).map(sev => (
              <button
                key={sev}
                onClick={() => setNewProposalSeverity(sev)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  newProposalSeverity === sev
                    ? sev === 'critical' ? 'bg-red-100 text-red-700 border-red-200' : sev === 'warning' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAddCustomProposal} className="text-xs px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
              Add Proposal
            </button>
            <button onClick={() => setShowNewProposal(false)} className="text-xs px-4 py-2 text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewProposal(true)}
          className="mt-4 w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add a new proposal
        </button>
      )}

      {/* Progress Bar */}
      <div className="mt-6 flex items-center gap-4 bg-slate-50 rounded-xl px-5 py-4 border border-slate-200">
        <div className="text-xs text-slate-500">
          {submittedItemIds.size} of {draftItems.length} items submitted
        </div>
        <div className="flex-1 bg-slate-200 rounded-full h-1.5">
          <div
            className="bg-indigo-600 rounded-full h-1.5 transition-all"
            style={{ width: `${draftItems.length > 0 ? (submittedItemIds.size / draftItems.length) * 100 : 0}%` }}
          />
        </div>
        {submittedItemIds.size === draftItems.length && draftItems.length > 0 && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      </div>{/* end main content column */}

      {/* ── Side Panel (Chat, in-flow) ── */}
      {(() => {
        const activeItem = aiChatItemId ? draftItems.find(d => d.itemId === aiChatItemId) || null : null;
        return (
          <div
            className={`flex-shrink-0 sticky top-[4.5rem] self-start transition-[width,margin] duration-300 ease-in-out overflow-hidden ${aiChatItemId ? 'w-[400px] ml-4' : 'w-0 ml-0'}`}
            style={{ height: 'calc(100vh - 5.5rem)' }}
          >
            <div className="w-[400px] h-full bg-white border border-slate-200 rounded-2xl shadow-lg flex flex-col overflow-hidden">

              {/* ── Chat View ── */}
              {aiChatItemId && activeItem && (<>
              {/* Header */}
              <div className="bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-2 min-w-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
                  </svg>
                  <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                    {activeItem?.itemId}
                  </span>
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {activeItem?.itemLabel}
                  </span>
                </div>
                <button
                  onClick={handleCloseChat}
                  className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 ml-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && activeItem && (
                  <div className="text-center py-8">
                    <p className="text-xs text-slate-400">Tell the AI what's happening with this item.</p>
                    <p className="text-xs text-slate-300 mt-1">It can suggest status changes, draft narratives, and propose plan changes.</p>
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                      {getPromptSuggestions(activeItem).map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleChatSend(s.prompt)}
                          disabled={chatLoading}
                          className="text-xs px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`text-xs p-2.5 rounded-lg leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-slate-100 text-slate-700 ml-8'
                        : 'bg-indigo-50 text-indigo-800 mr-8'
                    }`}
                  >
                    {msg.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="bg-indigo-50 text-indigo-400 text-xs p-2.5 rounded-lg mr-8 animate-pulse">
                    Thinking...
                  </div>
                )}

                {/* AI Draft Preview */}
                {aiDraft && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">AI Suggestion</span>
                    <div className="mt-1.5 space-y-1.5 text-xs text-indigo-800">
                      {aiDraft.status && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Status:</span>
                          <span className={`font-medium px-1.5 py-0.5 rounded ${LEADER_STATUS_DISPLAY[aiDraft.status]?.color || ''}`}>
                            {LEADER_STATUS_DISPLAY[aiDraft.status]?.label || aiDraft.status}
                          </span>
                        </div>
                      )}
                      {aiDraft.narrative && (
                        <div>
                          <span className="text-slate-500">Narrative:</span>
                          <p className="mt-0.5 text-slate-700">{aiDraft.narrative}</p>
                        </div>
                      )}
                      {aiDraft.proposedChanges && aiDraft.proposedChanges.length > 0 && (
                        <div>
                          <span className="text-slate-500">{aiDraft.proposedChanges.length} proposed change{aiDraft.proposedChanges.length > 1 ? 's' : ''}:</span>
                          {aiDraft.proposedChanges.map((c, ci) => (
                            <div key={ci} className="mt-1 pl-2 border-l-2 border-indigo-200 text-slate-600">
                              <span>{c.targetType} {c.targetId}: {c.field} {c.from} → {c.to}</span>
                              {c.rationale && (
                                <p className="text-[11px] text-slate-500 italic mt-0.5">{c.rationale}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={handleAcceptDraft}
                        className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => setAiDraft(null)}
                        className="text-xs px-3 py-1.5 text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-slate-100 p-3">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                    placeholder="Tell the AI what's happening..."
                    disabled={chatLoading}
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-700 placeholder-slate-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 disabled:bg-slate-50"
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={chatLoading || !chatInput.trim()}
                    className="text-xs px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {chatLoading ? '...' : 'Send'}
                  </button>
                </div>
              </div>
              </>)}
            </div>
          </div>
        );
      })()}
      </div>{/* end flex container */}

      {/* ── Source Document Viewer ── */}
      <SourceDocumentViewer
        document={viewingDocument}
        onClose={() => setViewingDocument(null)}
      />

      {/* ── Strategy Detail Panel (fixed overlay) ── */}
      <StrategyDetailPanel
        detailData={detailData}
        show={!!detailSelectedItem && !aiChatItemId}
        onClose={() => setDetailSelectedItem(null)}
        getProjectResourceStatus={getProjectResourceStatus}
        allObjectives={objectives}
        className="fixed top-[72px] right-4 bottom-4 z-40"
      />
      </>)}
    </div>
  );
};

// ─── CHECK-IN BRIEF VIEW ───
const CheckInBriefView: React.FC<{
  brief?: CheckInBrief;
  items: CheckInItem[];
  onUpdateItem: (itemId: string, status: CheckInItemStatus) => void;
  objectives: Objective[];
  setObjectives: (objectives: Objective[]) => void;
  personnel: Personnel[];
  onNavigateToBlueprint?: (view?: string) => void;
  onNavigate?: (view: CheckInSubView) => void;
  onUpdateImpact?: (itemId: string, impact: string) => void;
}> = ({ brief, items, onUpdateItem, objectives, setObjectives, personnel, onNavigateToBlueprint, onNavigate, onUpdateImpact }) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(items.map(i => i.id)));
  const [impactLoading, setImpactLoading] = useState(false);

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const approvedCount = items.filter(i => i.status === 'approved').length;
  const rejectedCount = items.filter(i => i.status === 'rejected').length;
  const deferredCount = items.filter(i => i.status === 'deferred').length;
  const resolvedCount = approvedCount + rejectedCount + deferredCount;
  const totalCount = items.length;
  const allResolved = pendingCount === 0;

  // Auto-generate impact analysis for items missing it
  useEffect(() => {
    const itemsNeedingImpact = items.filter(i => !i.impact && i.status === 'pending');
    if (itemsNeedingImpact.length === 0 || impactLoading || !onUpdateImpact) return;

    setImpactLoading(true);

    const context = objectives.map(o => {
      const krs = (o.keyResults || []).map(kr => kr.title).join(', ');
      return `${o.title}${krs ? `: ${krs}` : ''}`;
    }).join('\n');

    generateImpactAnalysis(
      itemsNeedingImpact.map(i => ({
        id: i.id, title: i.title, summary: i.summary,
        rationale: i.rationale,
        changes: i.changes.map(c => ({ targetLabel: c.targetLabel, field: c.field, from: c.from, to: c.to })),
        severity: i.severity, proposedBy: i.proposedBy,
      })),
      context,
    ).then(results => {
      if (results) {
        results.forEach(r => onUpdateImpact(r.id, r.impact));
      }
      setImpactLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const decisions = items.filter(i => i.type === 'decision');
  const accelerations = items.filter(i => i.type === 'acceleration');
  const fyis = items.filter(i => i.type === 'fyi');

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const severityConfig = {
    critical: { border: 'border-l-red-500', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700', label: 'Blocked' },
    warning: { border: 'border-l-amber-500', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700', label: 'At Risk' },
    info: { border: 'border-l-blue-500', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', label: 'For Review' },
    good: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', label: 'Good News' },
  };

  const applyCheckInAction = (item: CheckInItem) => {
    const updated = JSON.parse(JSON.stringify(objectives)) as Objective[];

    for (const change of item.changes) {
      if (change.targetType === 'project') {
        for (const obj of updated) {
          for (const kr of obj.keyResults) {
            for (const proj of (kr.departmentalProjects || [])) {
              if (proj.id === change.targetId) {
                if (change.field === 'start_date') proj.startDate = change.to;
                if (change.field === 'end_date') proj.endDate = change.to;
                if (change.field === 'status' && (change.to === 'completed' || change.to === 'Done')) {
                  proj.status = 'Done';
                  proj.progress = 100;
                }
              }
            }
          }
        }
      }
      if (change.targetType === 'keyResult') {
        for (const obj of updated) {
          for (const kr of obj.keyResults) {
            if (kr.id === change.targetId) {
              if (change.field === 'target_date') kr.targetDate = change.to;
            }
          }
        }
      }
      if (change.targetType === 'personnel' && change.field === 'remove_from_project') {
        const projIdMatch = change.from.match(/^(P\d+)/);
        if (projIdMatch) {
          const projId = projIdMatch[1];
          for (const obj of updated) {
            for (const kr of obj.keyResults) {
              for (const proj of (kr.departmentalProjects || [])) {
                if (proj.id === projId) {
                  proj.headcount = (proj.headcount || []).filter(hc => hc.name !== change.targetLabel);
                }
              }
            }
          }
        }
      }
      if (change.targetType === 'personnel' && change.field === 'add_to_project') {
        const projIdMatch = change.to.match(/^(P\d+)/);
        if (projIdMatch) {
          const projId = projIdMatch[1];
          for (const obj of updated) {
            for (const kr of obj.keyResults) {
              for (const proj of (kr.departmentalProjects || [])) {
                if (proj.id === projId) {
                  const person = personnel.find(p => p.name === change.targetLabel);
                  (proj.headcount || []).push({
                    id: `${projId}-checkin-${Date.now()}`,
                    personnelId: person?.id,
                    name: change.targetLabel,
                    role: person?.role || 'Team Member',
                    allocation: 'Full-time',
                  });
                }
              }
            }
          }
        }
      }
    }

    setObjectives(updated);
  };

  const handleApprove = (item: CheckInItem) => {
    applyCheckInAction(item);
    onUpdateItem(item.id, 'approved');
  };

  const handleReject = (item: CheckInItem) => {
    onUpdateItem(item.id, 'rejected');
  };

  const handleDefer = (item: CheckInItem) => {
    onUpdateItem(item.id, 'deferred');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderItemCard = (item: CheckInItem) => {
    const config = severityConfig[item.severity];
    const isExpanded = expandedItems.has(item.id);
    const isResolved = item.status !== 'pending';

    return (
      <div
        key={item.id}
        className={`border-l-4 ${config.border} rounded-xl bg-white shadow-sm transition-all duration-300 ${
          isResolved ? 'opacity-75' : 'hover:shadow-md'
        }`}
      >
        {/* Card Header */}
        <button
          onClick={() => toggleExpanded(item.id)}
          className="w-full text-left px-5 py-4 flex items-start gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
                {item.type === 'acceleration' ? 'Acceleration' : config.label}
              </span>
              <span className="text-[10px] text-slate-400">proposed by {item.proposedBy}</span>
              {isResolved && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  item.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {item.status}
                </span>
              )}
            </div>
            <h3 className={`text-sm font-semibold ${isResolved ? 'text-slate-500' : 'text-slate-900'}`}>
              {item.title}
            </h3>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 text-slate-400 transition-transform flex-shrink-0 mt-1 ${isExpanded ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Card Body */}
        {isExpanded && (
          <div className="px-5 pb-5 space-y-4">
            {/* Summary */}
            <p className="text-sm text-slate-600 leading-relaxed">{item.summary}</p>

            {/* Rationale */}
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Rationale</p>
              <p className="text-xs text-slate-600 leading-relaxed italic">{item.rationale}</p>
            </div>

            {/* Changes */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Proposed Changes</p>
              <div className="space-y-2">
                {item.changes.map((change, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                    <span className="font-medium text-slate-700">{change.targetLabel}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{change.field.replace(/_/g, ' ')}</span>
                    <span className="text-slate-400">:</span>
                    <span className="text-red-600 line-through">{change.from}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span className="text-emerald-600 font-medium">{change.to}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Impact */}
            {(item.impact || impactLoading) && (
              <div className={`rounded-lg p-3 ${item.severity === 'good' ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${item.severity === 'good' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {item.severity === 'good' ? 'Positive Impact' : 'Impact Analysis'}
                </p>
                {item.impact ? (
                  <p className="text-xs text-slate-700 leading-relaxed">{item.impact}</p>
                ) : (
                  <p className="text-xs text-slate-400 animate-pulse">Analyzing impact...</p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {!isResolved && (
              <div className="flex items-center gap-3 pt-2">
                {item.type === 'fyi' ? (
                  <button
                    onClick={() => handleApprove(item)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Acknowledge
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleApprove(item)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(item)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleDefer(item)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Defer
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">Check-in Brief</h2>
            <span className="text-sm text-slate-400 font-medium">{formatDate(brief?.date || new Date().toISOString().slice(0, 10))}</span>
            {brief?.period && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-medium">{brief.period}</span>}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {brief?.lastCheckIn ? `Since last check-in (${formatDate(brief.lastCheckIn)}) · ` : ''}{decisions.length} decision{decisions.length !== 1 ? 's' : ''} needed · {accelerations.length} acceleration{accelerations.length !== 1 ? 's' : ''}{fyis.length > 0 ? ` · ${fyis.length} update${fyis.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <span className={`text-sm font-bold ${allResolved ? 'text-emerald-600' : 'text-slate-700'}`}>
              {resolvedCount}/{totalCount}
            </span>
            <span className="text-xs text-slate-400">resolved</span>
          </div>
          {allResolved && (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold">All resolved</span>
            </div>
          )}
        </div>
      </div>

      {/* Decision Cards */}
      {decisions.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Decisions ({decisions.filter(d => d.status === 'pending').length} pending)
          </p>
          <div className="space-y-3">
            {decisions.map(renderItemCard)}
          </div>
        </div>
      )}

      {/* Acceleration Cards */}
      {accelerations.length > 0 && (
        <div>
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">
            Accelerations
          </p>
          <div className="space-y-3">
            {accelerations.map(renderItemCard)}
          </div>
        </div>
      )}

      {/* FYI / Updates Cards */}
      {fyis.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Updates ({fyis.length})
          </p>
          <div className="space-y-3">
            {fyis.map(renderItemCard)}
          </div>
        </div>
      )}

      {/* All resolved — advance to summary */}
      {allResolved && items.length > 0 && onNavigate && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => onNavigate('summary')}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            View Check-in Summary
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};


// ─── CHECK-IN SUMMARY VIEW ───
const CheckInSummaryView: React.FC<{
  items: CheckInItem[];
  onNavigateToBlueprint?: (view?: string) => void;
}> = ({ items, onNavigateToBlueprint }) => {
  const approved = items.filter(i => i.status === 'approved');
  const rejected = items.filter(i => i.status === 'rejected');
  const deferred = items.filter(i => i.status === 'deferred');

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 rounded-full mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Check-in Summary</h2>
        <p className="text-sm text-slate-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <div className="flex items-center justify-center gap-3 mt-3">
          {approved.length > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              {approved.length} approved
            </span>
          )}
          {rejected.length > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              {rejected.length} rejected
            </span>
          )}
          {deferred.length > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              {deferred.length} deferred
            </span>
          )}
        </div>
      </div>

      {/* Approved Changes */}
      {approved.length > 0 && (
        <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden">
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Changes Applied to Plan</p>
          </div>
          <div className="divide-y divide-slate-100">
            {approved.map(item => (
              <div key={item.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                </div>
                <p className="text-[10px] text-slate-400 ml-6 mb-2">proposed by {item.proposedBy}</p>
                {item.changes.length > 0 && (
                  <div className="ml-6 space-y-1">
                    {item.changes.map((change, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">{change.targetLabel || change.targetId}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{change.field.replace(/_/g, ' ')}</span>
                        <span className="text-slate-400">:</span>
                        <span className="text-red-400 line-through">{change.from}</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-emerald-600 font-medium">{change.to}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected Items */}
      {rejected.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Rejected</p>
          </div>
          <ul className="px-5 py-3 space-y-2">
            {rejected.map(item => (
              <li key={item.id} className="flex items-center gap-2 text-xs text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                {item.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deferred Items */}
      {deferred.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Deferred</p>
          </div>
          <ul className="px-5 py-3 space-y-2">
            {deferred.map(item => (
              <li key={item.id} className="flex items-center gap-2 text-xs text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {item.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* View Updated Plan */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => onNavigateToBlueprint?.('explorer')}
          className="flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-primary/80 transition-colors"
        >
          View Updated Plan
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ─── CHECK-IN PREP PAGE ───
const CheckInPrepView: React.FC<CheckInPrepViewProps> = ({
  objectives,
  setObjectives,
  companyName,
  personnel,
  checkInBrief,
  leaderUpdates,
  onNavigateToBlueprint,
  dependencies,
}) => {
  const [activeSubView, setActiveSubView] = useSessionState<CheckInSubView>(
    'checkin-prep-activeSubView',
    leaderUpdates ? 'leader-updates' : 'checkin'
  );
  const [checkInItems, setCheckInItems] = useSessionState<CheckInItem[]>(
    'checkin-prep-checkInItems',
    []
  );

  const allItemsResolved = checkInItems.length > 0 && checkInItems.every(i => i.status !== 'pending');

  return (
    <div className="w-full">
      {/* Process Guide Stepper */}
      {(() => {
        const step2Enabled = checkInItems.length > 0 || !!checkInBrief;
        const steps = [
          { key: 'leader-updates' as const, label: 'Leader Updates', enabled: !!leaderUpdates },
          { key: 'checkin' as const, label: 'Check-in Brief', enabled: step2Enabled },
          { key: 'summary' as const, label: 'Summary', enabled: allItemsResolved },
        ];
        const activeIndex = steps.findIndex(s => s.key === activeSubView);

        return (
          <div className="bg-slate-50/80 -mx-6 px-6 py-3 mb-6 border-b border-slate-100">
            <div className="flex items-center gap-2 max-w-[640px]">
              {steps.map((step, index) => {
                const isActive = activeSubView === step.key;
                const isCompleted = step.enabled && index < activeIndex;
                return (
                  <React.Fragment key={step.key}>
                    <div
                      className={`flex items-center gap-2.5 ${step.enabled ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => { if (step.enabled) setActiveSubView(step.key); }}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200
                          ${isActive ? 'bg-brand-primary text-white scale-110 shadow-[0_0_0_3px_var(--brand-light)]' : ''}
                          ${isCompleted ? 'bg-brand-primary text-white' : ''}
                          ${!isActive && !isCompleted ? 'bg-slate-100 text-slate-400' : ''}
                        `}
                      >
                        {isCompleted ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                          </svg>
                        ) : (
                          <span className="text-[13px] font-bold">{index + 1}</span>
                        )}
                      </div>
                      <span className={`text-[13px] whitespace-nowrap ${isActive ? 'font-semibold text-slate-900' : 'font-medium text-slate-500'}`}>
                        {step.label}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 min-w-[24px] rounded-full transition-all duration-150 ${isCompleted ? 'bg-brand-primary' : 'bg-slate-200'}`}></div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* View Content */}
      {activeSubView === 'leader-updates' && leaderUpdates ? (
        <LeaderUpdateView
          objectives={objectives}
          setObjectives={setObjectives}
          personnel={personnel}
          companyName={companyName}
          onAddCheckInItems={(newItems: CheckInItem[]) => setCheckInItems(prev => [...prev, ...newItems])}
          onNavigate={(view: CheckInSubView) => setActiveSubView(view)}
          leaderUpdates={leaderUpdates}
          dependencies={dependencies}
          hasCheckInItems={checkInItems.length > 0}
        />
      ) : activeSubView === 'summary' && checkInItems.length > 0 ? (
        <CheckInSummaryView
          items={checkInItems}
          onNavigateToBlueprint={onNavigateToBlueprint}
        />
      ) : (checkInItems.length > 0 || checkInBrief) ? (
        <CheckInBriefView
          brief={checkInBrief}
          items={checkInItems}
          onUpdateItem={(itemId: string, status: CheckInItemStatus) => {
            setCheckInItems(prev => prev.map(item =>
              item.id === itemId ? { ...item, status, resolvedAt: new Date().toISOString() } : item
            ));
          }}
          objectives={objectives}
          setObjectives={setObjectives}
          personnel={personnel}
          onNavigateToBlueprint={onNavigateToBlueprint}
          onNavigate={(view: CheckInSubView) => setActiveSubView(view)}
          onUpdateImpact={(itemId: string, impact: string) => {
            setCheckInItems(prev => prev.map(item =>
              item.id === itemId ? { ...item, impact } : item
            ));
          }}
        />
      ) : (
        <div className="text-center py-16">
          <p className="text-sm text-slate-500">
            {activeSubView === 'summary'
              ? 'Complete the Check-in Brief to view the summary.'
              : 'No items submitted yet. Complete the Leader Updates step to populate the Check-in Brief.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default CheckInPrepView;
