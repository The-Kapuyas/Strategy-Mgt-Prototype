import React, { useState, useEffect } from 'react';
import { Objective, KeyResult, DepartmentalKeyResult, DepartmentalProject, ProjectAssignment, Team, Personnel } from '../types';
import { DetailData } from '../hooks/useDetailData';
import { getElementName } from '../utils/strategyHelpers';
import { PROJECT_STATUS_STYLES, ResourceStatus, getAvatarColor, getInitials } from '../utils/constants';
import { AssessmentAlert, SuggestedAction, ChildIssueSummary } from '../types/assessment';

interface StrategyDetailPanelProps {
  detailData: DetailData | null;
  show: boolean;
  onClose: () => void;
  getProjectResourceStatus: (p: DepartmentalProject) => { status: ResourceStatus; message: string };
  allObjectives: Objective[];
  className?: string;
  elementAlerts?: AssessmentAlert[];
  onApplyAction?: (alert: AssessmentAlert, action: SuggestedAction) => void;
  onDismissAlert?: (alertId: string) => void;
  childIssues?: ChildIssueSummary[];
  onNavigateToChild?: (type: 'keyResult' | 'departmentalKeyResult' | 'project' | 'team', id: string, name: string) => void;
  onUpdatePersonnel?: (id: string, updates: Partial<Personnel>) => void;
  personnel?: Personnel[];
  onAddHeadcount?: (objId: string, krId: string, projectId: string, name: string, role: string, allocation?: string) => void;
  onAddPersonnelToProject?: (objId: string, krId: string, projectId: string, person: Personnel) => void;
  autoOpenAddMember?: boolean;
  onAutoOpenAddMemberHandled?: () => void;
  onUpdateProject?: (objId: string, krId: string, projectId: string, updates: Partial<DepartmentalProject>) => void;
  onUpdateKeyResult?: (objId: string, krId: string, updates: Partial<KeyResult>) => void;
  onUpdateDepartmentalKeyResult?: (objId: string, krId: string, dkrId: string, updates: Partial<DepartmentalKeyResult>) => void;
  onUpdateObjective?: (objId: string, updates: Partial<Objective>) => void;
  onDeleteObjective?: (objId: string) => void;
  onDeleteKeyResult?: (objId: string, krId: string) => void;
  onDeleteProject?: (objId: string, krId: string, projectId: string) => void;
  onAddKeyResult?: (objId: string, title: string) => void;
  onAddProject?: (objId: string, krId: string, title: string) => void;
  onUpdateTeam?: (objId: string, krId: string, projectId: string, teamId: string, updates: Partial<Team>) => void;
  showAlerts?: boolean;
}

const StrategyDetailPanel: React.FC<StrategyDetailPanelProps> = ({
  detailData,
  show,
  onClose,
  getProjectResourceStatus,
  allObjectives,
  className = '',
  elementAlerts,
  onApplyAction,
  onDismissAlert,
  childIssues,
  onNavigateToChild,
  onUpdatePersonnel,
  personnel = [],
  onAddHeadcount,
  onAddPersonnelToProject,
  autoOpenAddMember,
  onAutoOpenAddMemberHandled,
  onUpdateProject,
  onUpdateKeyResult,
  onUpdateDepartmentalKeyResult,
  onUpdateObjective,
  onDeleteObjective,
  onDeleteKeyResult,
  onDeleteProject,
  onAddKeyResult,
  onAddProject,
  onUpdateTeam,
  showAlerts = true,
}) => {
  const [expandedPanelAlerts, setExpandedPanelAlerts] = useState<Set<string>>(new Set());
  const [personEditField, setPersonEditField] = useState<string | null>(null);
  const [personEditValue, setPersonEditValue] = useState('');
  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldDraft, setFieldDraft] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState('');

  useEffect(() => {
    if (autoOpenAddMember && detailData?.type === 'project') {
      setAddingMember(true);
      onAutoOpenAddMemberHandled?.();
    }
  }, [autoOpenAddMember, detailData?.type]);

  const projectId = detailData?.type === 'project' ? detailData.proj.id : null;
  useEffect(() => {
    setAddingMember(false);
    setMemberSearch('');
    setEditingField(null);
    setFieldDraft('');
    setMenuOpen(false);
    setConfirmingDelete(false);
    setAddingChild(false);
    setChildTitle('');
  }, [projectId]);

  const krIdForReset = detailData?.type === 'keyResult' ? detailData.kr.id : null;
  useEffect(() => {
    setEditingField(null);
    setFieldDraft('');
    setMenuOpen(false);
    setConfirmingDelete(false);
    setAddingChild(false);
    setChildTitle('');
  }, [krIdForReset]);

  const objIdForReset = detailData?.type === 'objective' ? detailData.obj.id : null;
  useEffect(() => {
    setEditingField(null);
    setFieldDraft('');
    setMenuOpen(false);
    setConfirmingDelete(false);
    setAddingChild(false);
    setChildTitle('');
  }, [objIdForReset]);

  if (!detailData) return null;

  const findObjIndex = (id: string) => allObjectives.findIndex(o => o.id === id);

  const togglePanelAlert = (alertId: string) => {
    setExpandedPanelAlerts(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) next.delete(alertId);
      else next.add(alertId);
      return next;
    });
  };

  const activeAlerts = (elementAlerts?.filter(a => a.status === 'active') ?? [])
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });

  const AlertsSection = () => {
    if (!showAlerts || activeAlerts.length === 0) return null;

    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Assessment Alerts</h4>
          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{activeAlerts.length}</span>
        </div>
        <div className="space-y-2">
          {activeAlerts.map(alert => {
            const isExpanded = expandedPanelAlerts.has(alert.id);
            const sevStyles = alert.severity === 'critical'
              ? 'bg-red-50 border-l-red-400' : alert.severity === 'warning'
              ? 'bg-amber-50 border-l-amber-400' : 'bg-blue-50 border-l-blue-400';
            const sevBadgeStyles = alert.severity === 'critical'
              ? 'bg-red-100 text-red-700' : alert.severity === 'warning'
              ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';

            return (
              <div key={alert.id} className={`rounded-lg border-l-[3px] overflow-hidden ${sevStyles}`}>
                {/* Collapsed header */}
                <div
                  className="flex items-start gap-1.5 px-3 py-2.5 cursor-pointer"
                  onClick={() => togglePanelAlert(alert.id)}
                >
                  <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded flex-shrink-0 mt-0.5 ${sevBadgeStyles}`}>
                    {alert.severity}
                  </span>
                  <p className="text-[11px] font-medium text-slate-800 leading-snug flex-grow min-w-0">{alert.title}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {onDismissAlert && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDismissAlert(alert.id); }}
                        className="p-0.5 rounded hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Dismiss"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <svg className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-2.5 pb-2.5 space-y-2">
                    <p className="text-[10px] text-slate-600 leading-relaxed">{alert.description}</p>

                    {alert.rationale && (
                      <div>
                        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Rationale</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{alert.rationale}</p>
                      </div>
                    )}

                    {/* Affected elements */}
                    {alert.affectedElements.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {alert.affectedElements.map((el, idx) => (
                          <span
                            key={idx}
                            className={`px-1.5 py-0.5 text-[9px] rounded ${
                              el.type === 'person' ? 'bg-purple-100 text-purple-700'
                              : el.type === 'project' ? 'bg-emerald-100 text-emerald-700'
                              : el.type === 'keyResult' ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {el.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Fix actions */}
                    {onApplyAction && (() => {
                      const fixActions = alert.suggestedActions.filter(
                        a => a.type !== 'view_capacity' && a.type !== 'view_timeline'
                      );
                      if (fixActions.length === 0) return null;
                      return (
                        <div className="space-y-1">
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Suggested Fixes</p>
                          {fixActions.map(action => (
                            <div key={action.id} className="bg-white/70 rounded-lg p-2">
                              <p className="text-[10px] font-medium text-slate-800">{action.label}</p>
                              <p className="text-[9px] text-slate-500 mt-0.5">{action.description}</p>
                              <button
                                onClick={() => onApplyAction(alert, action)}
                                className="mt-1.5 w-full px-2 py-1 text-[10px] font-medium bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors"
                              >
                                Apply Fix
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Navigation actions */}
                    {onApplyAction && (() => {
                      const navActions = alert.suggestedActions.filter(
                        a => a.type === 'view_capacity' || a.type === 'view_timeline'
                      );
                      if (navActions.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5">
                          {navActions.map(action => (
                            <button
                              key={action.id}
                              onClick={() => onApplyAction(alert, action)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-indigo-600 bg-white/70 rounded-md border border-indigo-200 hover:bg-indigo-50 transition-colors"
                              title={action.description}
                            >
                              {action.label}
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const ChildIssuesSection = () => {
    if (!showAlerts || !childIssues || childIssues.length === 0) return null;

    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Issues Below</h4>
        </div>
        <div className="space-y-1">
          {childIssues.map(child => {
            const sevDot = child.maxSeverity === 'critical' ? 'bg-red-500'
              : child.maxSeverity === 'warning' ? 'bg-amber-500' : 'bg-blue-400';
            const sevBg = child.maxSeverity === 'critical' ? 'bg-red-50 border-red-100'
              : child.maxSeverity === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100';
            const typeLabel = child.type === 'keyResult' ? 'KR' : 'Project';

            return (
              <div
                key={child.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${sevBg}`}
                onClick={() => onNavigateToChild?.(child.type, child.id, child.name)}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sevDot}`} />
                <span className="text-[10px] font-medium text-slate-400 flex-shrink-0">{typeLabel}</span>
                <span className="text-[11px] font-medium text-slate-700 truncate flex-grow">{child.name}</span>
                <span className="text-[10px] font-bold text-slate-500 flex-shrink-0">{child.alertCount}</span>
                <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`transition-transform duration-300 ${show ? 'translate-x-0' : 'translate-x-full'} ${className}`}
      style={{ width: 'min(420px, calc(100vw - 2rem))' }}
    >
      <div className="h-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-y-auto">
        {/* Panel header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10 rounded-t-2xl">
          <div className="flex items-center gap-1.5">
            <div className={`w-5 h-5 rounded flex items-center justify-center text-white text-[8px] font-bold ${
              detailData.type === 'objective' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
              detailData.type === 'keyResult' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
              detailData.type === 'departmentalKeyResult' ? 'bg-gradient-to-br from-amber-500 to-amber-600' :
              detailData.type === 'project' ? 'bg-gradient-to-br from-indigo-500 to-indigo-600' :
              detailData.type === 'team' ? 'bg-gradient-to-br from-indigo-400 to-indigo-500' :
              'bg-gradient-to-br from-purple-500 to-purple-600'
            }`}>
              {detailData.type === 'objective' ? 'O' : detailData.type === 'keyResult' ? 'KR' : detailData.type === 'departmentalKeyResult' ? 'DKR' : detailData.type === 'project' ? 'P' : detailData.type === 'team' ? 'TM' : 'T'}
            </div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {detailData.type === 'objective' ? 'Objective' : detailData.type === 'keyResult' ? 'Key Result' : detailData.type === 'departmentalKeyResult' ? 'Dept. Key Result' : detailData.type === 'project' ? 'Project' : detailData.type === 'team' ? 'Team' : 'Team Member'}
            </span>
          </div>
          {/* Actions kebab menu */}
          {(detailData.type === 'objective' || detailData.type === 'keyResult' || detailData.type === 'project') && (
            <div className="relative ml-auto mr-1">
              <button
                onClick={() => { setMenuOpen(!menuOpen); setConfirmingDelete(false); }}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Actions"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => { setMenuOpen(false); setConfirmingDelete(false); }} />
                  <div className="absolute right-0 top-7 bg-white rounded-lg shadow-lg border border-slate-200 py-1 w-44 z-20">
                  {confirmingDelete ? (
                    <div className="px-3 py-2">
                      <p className="text-[11px] text-slate-600 mb-2 leading-snug">
                        {detailData.type === 'objective' ? 'Delete this objective and all its key results?' :
                         detailData.type === 'keyResult' ? 'Delete this key result and all its projects?' :
                         'Delete this project?'}
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setConfirmingDelete(false)}
                          className="flex-1 text-[11px] px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600"
                        >Cancel</button>
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setConfirmingDelete(false);
                            if (detailData.type === 'objective') {
                              onDeleteObjective?.(detailData.obj.id);
                            } else if (detailData.type === 'keyResult' && detailData.parentObj) {
                              onDeleteKeyResult?.(detailData.parentObj.id, detailData.kr.id);
                            } else if (detailData.type === 'project' && detailData.parentObj && detailData.parentKR) {
                              onDeleteProject?.(detailData.parentObj.id, detailData.parentKR.id, detailData.proj.id);
                            }
                            onClose();
                          }}
                          className="flex-1 text-[11px] px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                        >Delete</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {detailData.type === 'objective' && onAddKeyResult && (
                        <button
                          onClick={() => { setMenuOpen(false); setAddingChild(true); setChildTitle(''); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                          Add Key Result
                        </button>
                      )}
                      {detailData.type === 'keyResult' && onAddProject && (
                        <button
                          onClick={() => { setMenuOpen(false); setAddingChild(true); setChildTitle(''); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                          Add Project
                        </button>
                      )}
                      {(detailData.type === 'objective' ? !!onDeleteObjective :
                        detailData.type === 'keyResult' ? !!onDeleteKeyResult :
                        !!onDeleteProject) && (
                        <>
                          {(detailData.type === 'objective' && onAddKeyResult) ||
                           (detailData.type === 'keyResult' && onAddProject) ? (
                            <div className="border-t border-slate-100 my-1" />
                          ) : null}
                          <button
                            onClick={() => setConfirmingDelete(true)}
                            className="w-full text-left px-3 py-1.5 text-[13px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            Delete {detailData.type === 'objective' ? 'Objective' : detailData.type === 'keyResult' ? 'Key Result' : 'Project'}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* ─── OBJECTIVE DETAILS ─── */}
          {detailData.type === 'objective' && (() => {
            const { obj, deps } = detailData;
            const canEditObj = !!onUpdateObjective;
            const saveObjField = (updates: Partial<Objective>) => {
              if (canEditObj) onUpdateObjective!(obj.id, updates);
            };

            const OBJ_STATUS_OPTIONS = ['On Track', 'At Risk', 'Blocked', 'Completed'] as const;
            const OBJ_STATUS_STYLES: Record<string, string> = {
              'On Track': 'bg-emerald-50 text-emerald-600 border-emerald-200',
              'At Risk': 'bg-amber-50 text-amber-600 border-amber-200',
              'Blocked': 'bg-red-50 text-red-600 border-red-200',
              'Completed': 'bg-blue-50 text-blue-600 border-blue-200',
            };
            const KR_STATUS_STYLES: Record<string, string> = {
              on_track: 'bg-green-100 text-green-700',
              'On Track': 'bg-green-100 text-green-700',
              at_risk: 'bg-amber-100 text-amber-700',
              'At Risk': 'bg-amber-100 text-amber-700',
              in_progress: 'bg-blue-100 text-blue-700',
              behind: 'bg-red-100 text-red-700',
              Blocked: 'bg-red-100 text-red-700',
              completed: 'bg-emerald-100 text-emerald-700',
              Completed: 'bg-emerald-100 text-emerald-700',
            };

            const objTextRow = (
              icon: React.ReactNode,
              label: string,
              fieldKey: string,
              value: string | undefined,
              placeholder: string
            ) => {
              const isEditing = editingField === fieldKey;
              return (
                <div
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2 ${canEditObj && !isEditing ? 'hover:bg-slate-50 cursor-text' : ''}`}
                  onClick={() => { if (canEditObj && !isEditing) { setEditingField(fieldKey); setFieldDraft(value ?? ''); } }}
                >
                  <span className="text-slate-400 flex-shrink-0 w-3.5">{icon}</span>
                  <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">{label}</span>
                  {isEditing ? (
                    <input
                      autoFocus
                      className="flex-1 text-[13px] text-slate-800 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5"
                      value={fieldDraft}
                      placeholder={placeholder}
                      onChange={e => setFieldDraft(e.target.value)}
                      onBlur={() => { saveObjField({ [fieldKey]: fieldDraft } as Partial<Objective>); setEditingField(null); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setEditingField(null);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className={`flex-1 text-[13px] truncate py-0.5 ${value ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                      {value || placeholder}
                    </span>
                  )}
                </div>
              );
            };

            return (
              <>
                <div
                  className={canEditObj && editingField !== 'title' ? 'cursor-text' : ''}
                  onClick={() => { if (canEditObj && editingField !== 'title') { setEditingField('title'); setFieldDraft(obj.title); } }}
                >
                  {editingField === 'title' ? (
                    <textarea
                      autoFocus
                      rows={2}
                      className="w-full text-sm font-semibold text-slate-900 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5 resize-none leading-snug"
                      value={fieldDraft}
                      onChange={e => setFieldDraft(e.target.value)}
                      onBlur={() => { saveObjField({ title: fieldDraft }); setEditingField(null); }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <p className="text-base font-semibold text-slate-900 leading-snug">{obj.title}</p>
                  )}
                </div>

                <div
                  className={`mt-2 rounded-md ${canEditObj && editingField !== 'description' ? 'hover:bg-slate-50 cursor-text' : ''}`}
                  onClick={() => { if (canEditObj && editingField !== 'description') { setEditingField('description'); setFieldDraft(obj.description ?? ''); } }}
                >
                  {editingField === 'description' ? (
                    <textarea
                      autoFocus
                      rows={3}
                      className="w-full text-sm text-slate-600 bg-transparent outline-none ring-1 ring-brand-primary rounded px-2 py-1.5 resize-none leading-relaxed"
                      value={fieldDraft}
                      placeholder="Add a description..."
                      onChange={e => setFieldDraft(e.target.value)}
                      onBlur={() => { saveObjField({ description: fieldDraft }); setEditingField(null); }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <p className={`text-sm leading-relaxed px-1 py-0.5 ${obj.description ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                      {obj.description || 'Add a description...'}
                    </p>
                  )}
                </div>

                {AlertsSection()}
                {ChildIssuesSection()}

                {/* ─── OBJECTIVE CHECK-IN METADATA ─── */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Check-in</h4>
                  <div>
                    {/* Status */}
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2">
                      <span className="text-slate-400 flex-shrink-0 w-3.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Status</span>
                      <div className="flex flex-wrap gap-1">
                        {OBJ_STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            disabled={!canEditObj}
                            className={`px-3 py-0.5 rounded text-[9px] font-bold border transition-all ${
                              obj.status === opt
                                ? (OBJ_STATUS_STYLES[opt] || 'bg-slate-100 text-slate-600') + ' border-transparent'
                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                            } ${canEditObj ? 'cursor-pointer' : 'cursor-default'}`}
                            onClick={() => saveObjField({ status: opt })}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Owner */}
                    {objTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>,
                      'Owner', 'owner', obj.owner, 'Assign owner…'
                    )}
                    {/* Period */}
                    {objTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                      </svg>,
                      'Period', 'timePeriod', obj.timePeriod, 'e.g. Q1 2026…'
                    )}
                    {/* Summary */}
                    {objTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>,
                      'Summary', 'summary', obj.summary, 'Key update for check-in…'
                    )}
                    {/* Risks */}
                    {objTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>,
                      'Risks', 'risks', obj.risks, 'Key blockers or risks…'
                    )}
                    {/* Milestone */}
                    {objTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>,
                      'Milestone', 'nextMilestone', obj.nextMilestone, 'Next key deliverable…'
                    )}
                  </div>
                </div>

                {/* ─── KEY RESULTS (simplified) ─── */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Key Results ({obj.keyResults.length})</h4>
                  {addingChild && (
                    <div className="mb-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                      <input
                        autoFocus
                        placeholder="Key result title…"
                        className="w-full text-[11px] bg-transparent outline-none text-slate-800 placeholder-slate-400"
                        value={childTitle}
                        onChange={e => setChildTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && childTitle.trim()) {
                            onAddKeyResult!(obj.id, childTitle.trim());
                            setChildTitle('');
                            setAddingChild(false);
                          }
                          if (e.key === 'Escape') { setAddingChild(false); setChildTitle(''); }
                        }}
                        onBlur={() => { setAddingChild(false); setChildTitle(''); }}
                      />
                      <p className="text-[9px] text-emerald-600 mt-1">Enter to add · Esc to cancel</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {obj.keyResults.map((kr, ki) => {
                      const krStatusStyle = kr.status ? (KR_STATUS_STYLES[kr.status] ?? 'bg-slate-100 text-slate-600') : null;
                      return (
                        <div key={kr.id} className="bg-slate-50 rounded-lg px-3 py-2.5 flex items-start gap-1.5">
                          <span className="text-[8px] font-bold text-emerald-600 bg-emerald-100 px-1 py-0.5 rounded mt-0.5 flex-shrink-0">{kr.id}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-slate-800 leading-snug">{kr.title}</p>
                            {krStatusStyle && kr.status && (
                              <span className={`mt-0.5 inline-block px-1.5 py-0.5 text-[8px] font-semibold rounded-full ${krStatusStyle}`}>
                                {kr.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {deps.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Dependencies</h4>
                    <div className="space-y-1">
                      {deps.map(dep => {
                        const isSource = dep.sourceId === obj.id;
                        const otherType = isSource ? dep.targetType : dep.sourceType;
                        const otherId = isSource ? dep.targetId : dep.sourceId;
                        const otherName = getElementName(allObjectives, otherType as 'objective' | 'keyResult' | 'project', otherId);
                        return (
                          <div key={dep.id} className="px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-[11px]">
                            <span className="text-blue-600 font-medium">{dep.dependencyType.replace('_', ' ')}</span>
                            <span className="text-slate-600"> → {otherName}</span>
                            {dep.description && <p className="text-slate-500 mt-0.5">{dep.description}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* ─── KEY RESULT DETAILS ─── */}
          {detailData.type === 'keyResult' && (() => {
            const { kr, parentObj, projects, deps } = detailData;
            const canEditKr = !!(parentObj && onUpdateKeyResult);
            const saveKrField = (updates: Partial<KeyResult>) => {
              if (canEditKr) onUpdateKeyResult!(parentObj!.id, kr.id, updates);
            };

            const KR_STATUS_OPTIONS = ['On Track', 'At Risk', 'Blocked'] as const;
            const KR_STATUS_STYLES: Record<string, string> = {
              'On Track': 'bg-emerald-50 text-emerald-600 border-emerald-200',
              'At Risk': 'bg-amber-50 text-amber-600 border-amber-200',
              'Blocked': 'bg-red-50 text-red-600 border-red-200',
            };

            const krTextRow = (
              icon: React.ReactNode,
              label: string,
              fieldKey: string,
              value: string | number | undefined,
              placeholder: string,
              inputType: string = 'text'
            ) => {
              const strVal = value !== undefined ? String(value) : undefined;
              const isEditing = editingField === fieldKey;
              return (
                <div
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2 ${canEditKr && !isEditing ? 'hover:bg-slate-50 cursor-text' : ''}`}
                  onClick={() => { if (canEditKr && !isEditing) { setEditingField(fieldKey); setFieldDraft(strVal ?? ''); } }}
                >
                  <span className="text-slate-400 flex-shrink-0 w-3.5">{icon}</span>
                  <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">{label}</span>
                  {isEditing ? (
                    <input
                      autoFocus
                      type={inputType}
                      className="flex-1 text-[13px] text-slate-800 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5"
                      value={fieldDraft}
                      placeholder={placeholder}
                      onChange={e => setFieldDraft(e.target.value)}
                      onBlur={() => {
                        const parsed = inputType === 'number' ? (fieldDraft === '' ? undefined : Number(fieldDraft)) : fieldDraft;
                        saveKrField({ [fieldKey]: parsed } as Partial<KeyResult>);
                        setEditingField(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setEditingField(null);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className={`flex-1 text-[13px] truncate py-0.5 ${strVal ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                      {strVal || placeholder}
                    </span>
                  )}
                </div>
              );
            };

            return (
              <>
                <div>
                  <div
                    className={canEditKr && editingField !== 'title' ? 'cursor-text' : ''}
                    onClick={() => { if (canEditKr && editingField !== 'title') { setEditingField('title'); setFieldDraft(kr.title); } }}
                  >
                    {editingField === 'title' ? (
                      <textarea
                        autoFocus
                        rows={2}
                        className="w-full text-sm font-semibold text-slate-900 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5 resize-none leading-snug"
                        value={fieldDraft}
                        onChange={e => setFieldDraft(e.target.value)}
                        onBlur={() => { saveKrField({ title: fieldDraft }); setEditingField(null); }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <p className="text-base font-semibold text-slate-900 leading-snug">{kr.title}</p>
                    )}
                  </div>
                  {/* Editable description */}
                  <div
                    className={`mt-2 rounded-md ${canEditKr && editingField !== 'description' ? 'hover:bg-slate-50 cursor-text' : ''}`}
                    onClick={() => { if (canEditKr && editingField !== 'description') { setEditingField('description'); setFieldDraft(kr.description ?? ''); } }}
                  >
                    {editingField === 'description' ? (
                      <textarea
                        autoFocus
                        rows={3}
                        className="w-full text-sm text-slate-600 bg-transparent outline-none ring-1 ring-brand-primary rounded px-2 py-1.5 resize-none leading-relaxed"
                        value={fieldDraft}
                        placeholder="Add a description..."
                        onChange={e => setFieldDraft(e.target.value)}
                        onBlur={() => { saveKrField({ description: fieldDraft }); setEditingField(null); }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <p className={`text-sm leading-relaxed px-1 py-0.5 ${kr.description ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                        {kr.description || 'Add a description...'}
                      </p>
                    )}
                  </div>
                </div>

                {AlertsSection()}
                {ChildIssuesSection()}

                {/* ─── KR CHECK-IN METADATA ─── */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Check-in</h4>
                  <div>
                    {/* Status */}
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2">
                      <span className="text-slate-400 flex-shrink-0 w-3.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Status</span>
                      <div className="flex flex-wrap gap-1">
                        {KR_STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            disabled={!canEditKr}
                            className={`px-3 py-0.5 rounded text-[9px] font-bold border transition-all ${
                              kr.status === opt.toLowerCase().replace(' ', '_') || kr.status === opt
                                ? (KR_STATUS_STYLES[opt] || 'bg-slate-100 text-slate-600') + ' border-transparent'
                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                            } ${canEditKr ? 'cursor-pointer' : 'cursor-default'}`}
                            onClick={() => saveKrField({ status: opt })}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Owner */}
                    {krTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>,
                      'Owner', 'owner', kr.owner, 'Assign owner…'
                    )}
                    {/* Due date */}
                    {(() => {
                      const isEditingDate = editingField === 'targetDate';
                      return (
                        <div
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2 ${canEditKr && !isEditingDate ? 'hover:bg-slate-50 cursor-text' : ''}`}
                          onClick={() => { if (canEditKr && !isEditingDate) { setEditingField('targetDate'); setFieldDraft(kr.targetDate ?? ''); } }}
                        >
                          <span className="text-slate-400 flex-shrink-0 w-3.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                            </svg>
                          </span>
                          <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Due</span>
                          {isEditingDate ? (
                            <input
                              autoFocus
                              type="date"
                              className="flex-1 text-[13px] bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5 text-slate-700"
                              defaultValue={kr.targetDate ?? ''}
                              onBlur={e => { saveKrField({ targetDate: e.target.value }); setEditingField(null); }}
                              onKeyDown={e => { if (e.key === 'Escape') setEditingField(null); }}
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <span className={`flex-1 text-[13px] truncate py-0.5 ${kr.targetDate ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                              {kr.targetDate ? `${new Date(kr.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, '${new Date(kr.targetDate).toLocaleDateString('en-US', { year: '2-digit' })}` : 'Set due date…'}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {/* Metric */}
                    {krTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>,
                      'Metric', 'metric', kr.metric, 'e.g. ARR, NPS…'
                    )}
                    {/* Baseline */}
                    {krTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" />
                      </svg>,
                      'Baseline', 'baseline', kr.baseline, '0', 'number'
                    )}
                    {/* Current */}
                    {krTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                      </svg>,
                      'Current', 'current', kr.current, 'Current value…', 'number'
                    )}
                    {/* Target */}
                    {krTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                      </svg>,
                      'Target', 'target', kr.target, 'Target value…', 'number'
                    )}
                    {/* Risks */}
                    {krTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>,
                      'Risks', 'risks', kr.risks, 'Key blockers or risks…'
                    )}
                    {/* Milestone */}
                    {krTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>,
                      'Milestone', 'nextMilestone', kr.nextMilestone, 'Next key deliverable…'
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Projects ({projects.length})</h4>
                  {addingChild && (
                    <div className="mb-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5">
                      <input
                        autoFocus
                        placeholder="Project title…"
                        className="w-full text-[11px] bg-transparent outline-none text-slate-800 placeholder-slate-400"
                        value={childTitle}
                        onChange={e => setChildTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && childTitle.trim() && detailData.parentObj) {
                            onAddProject!(detailData.parentObj.id, kr.id, childTitle.trim());
                            setChildTitle('');
                            setAddingChild(false);
                          }
                          if (e.key === 'Escape') { setAddingChild(false); setChildTitle(''); }
                        }}
                        onBlur={() => { setAddingChild(false); setChildTitle(''); }}
                      />
                      <p className="text-[9px] text-indigo-600 mt-1">Enter to add · Esc to cancel</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {projects.map(p => (
                      <div key={p.id} className="bg-slate-50 rounded-lg px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-slate-800 truncate">{p.title}</span>
                          <span className={`px-1 py-0.5 rounded text-[8px] font-bold ml-1.5 flex-shrink-0 ${PROJECT_STATUS_STYLES[p.status] || 'bg-slate-100 text-slate-600'}`}>{p.status}</span>
                        </div>
                        {p.department && (
                          <p className="text-[9px] text-slate-400 mt-0.5">{p.department}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {deps.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Dependencies</h4>
                    <div className="space-y-1">
                      {deps.map(dep => {
                        const isSource = dep.sourceId === kr.id;
                        const otherType = isSource ? dep.targetType : dep.sourceType;
                        const otherId = isSource ? dep.targetId : dep.sourceId;
                        const otherName = getElementName(allObjectives, otherType as 'objective' | 'keyResult' | 'project', otherId);
                        return (
                          <div key={dep.id} className="px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-[11px]">
                            <span className="text-blue-600 font-medium">{dep.dependencyType.replace('_', ' ')}</span>
                            <span className="text-slate-600"> → {otherName}</span>
                            {dep.description && <p className="text-slate-500 mt-0.5">{dep.description}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* ─── PROJECT DETAILS ─── */}
          {detailData.type === 'project' && (() => {
            const { proj, parentKR, parentObj, deps } = detailData;
            return (
              <>
                <div>
                  {(() => {
                    const canEditTitle = !!onUpdateProject && !!parentObj && !!parentKR;
                    return (
                      <div
                        className={canEditTitle && editingField !== 'title' ? 'cursor-text' : ''}
                        onClick={() => { if (canEditTitle && editingField !== 'title') { setEditingField('title'); setFieldDraft(proj.title); } }}
                      >
                        {editingField === 'title' ? (
                          <textarea
                            autoFocus
                            rows={2}
                            className="w-full text-sm font-semibold text-slate-900 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5 resize-none leading-snug"
                            value={fieldDraft}
                            onChange={e => setFieldDraft(e.target.value)}
                            onBlur={() => { onUpdateProject!(parentObj!.id, parentKR!.id, proj.id, { title: fieldDraft }); setEditingField(null); }}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <p className="text-base font-semibold text-slate-900 leading-snug">{proj.title}</p>
                        )}
                      </div>
                    );
                  })()}
                  {proj.department && (
                    <p className="text-xs text-slate-500 mt-1.5">{proj.department}</p>
                  )}
                </div>

                {AlertsSection()}

                {/* ─── CHECK-IN METADATA ─── */}
                {(() => {
                  const checkinObjId = parentObj?.id;
                  const checkinKrId = parentKR?.id;
                  const canEdit = !!(checkinObjId && checkinKrId && onUpdateProject);
                  const saveField = (updates: Partial<DepartmentalProject>) => {
                    if (canEdit) onUpdateProject!(checkinObjId!, checkinKrId!, proj.id, updates);
                  };

                  const STATUS_OPTIONS: Array<'To Do' | 'Doing' | 'Done'> = ['To Do', 'Doing', 'Done'];
                  const PRIORITY_OPTIONS: Array<'High' | 'Medium' | 'Low'> = ['High', 'Medium', 'Low'];
                  const PRIORITY_STYLES: Record<string, string> = {
                    High: 'bg-red-50 text-red-600 border-red-200',
                    Medium: 'bg-amber-50 text-amber-600 border-amber-200',
                    Low: 'bg-slate-50 text-slate-500 border-slate-200',
                  };

                  const textRow = (
                    icon: React.ReactNode,
                    label: string,
                    fieldKey: string,
                    value: string | undefined,
                    placeholder: string
                  ) => {
                    const isEditing = editingField === fieldKey;
                    return (
                      <div
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2 ${canEdit && !isEditing ? 'hover:bg-slate-50 cursor-text' : ''}`}
                        onClick={() => { if (canEdit && !isEditing) { setEditingField(fieldKey); setFieldDraft(value ?? ''); } }}
                      >
                        <span className="text-slate-400 flex-shrink-0 w-3.5">{icon}</span>
                        <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">{label}</span>
                        {isEditing ? (
                          <input
                            autoFocus
                            className="flex-1 text-[13px] text-slate-800 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5"
                            value={fieldDraft}
                            placeholder={placeholder}
                            onChange={e => setFieldDraft(e.target.value)}
                            onBlur={() => { saveField({ [fieldKey]: fieldDraft } as Partial<DepartmentalProject>); setEditingField(null); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                              if (e.key === 'Escape') setEditingField(null);
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span className={`flex-1 text-[13px] truncate py-0.5 ${value ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                            {value || placeholder}
                          </span>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div>
                      <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Check-in</h4>
                      <div>
                        {/* Status */}
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2">
                          <span className="text-slate-400 flex-shrink-0 w-3.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                          <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Status</span>
                          <div className="flex flex-wrap gap-1">
                            {STATUS_OPTIONS.map(opt => (
                              <button
                                key={opt}
                                disabled={!canEdit}
                                className={`px-3 py-0.5 rounded text-[9px] font-bold border transition-all ${
                                  proj.status === opt
                                    ? (PROJECT_STATUS_STYLES[opt] || 'bg-slate-100 text-slate-600') + ' border-transparent'
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                                onClick={() => saveField({ status: opt })}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Priority */}
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2">
                          <span className="text-slate-400 flex-shrink-0 w-3.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M3 12h12M3 16.5h6" />
                            </svg>
                          </span>
                          <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Priority</span>
                          <div className="flex flex-wrap gap-1">
                            {PRIORITY_OPTIONS.map(opt => (
                              <button
                                key={opt}
                                disabled={!canEdit}
                                className={`px-3 py-0.5 rounded text-[9px] font-bold border transition-all ${
                                  proj.priority === opt
                                    ? PRIORITY_STYLES[opt] + ' border-transparent'
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                                onClick={() => saveField({ priority: opt })}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Owner */}
                        {textRow(
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>,
                          'Owner', 'owner', proj.owner, 'Assign owner…'
                        )}
                        {/* Timeframe */}
                        {(() => {
                          const isEditingDate = editingField === 'startDate' || editingField === 'endDate';
                          const hasDate = proj.startDate || proj.endDate;
                          const fmt = (d?: string) => {
                            if (!d) return '?';
                            const date = new Date(d);
                            const month = date.toLocaleDateString('en-US', { month: 'short' });
                            const year = date.toLocaleDateString('en-US', { year: '2-digit' });
                            return `${month} '${year}`;
                          };
                          return (
                            <div
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2 ${canEdit && !isEditingDate ? 'hover:bg-slate-50 cursor-text' : ''}`}
                              onClick={() => { if (canEdit && !isEditingDate) setEditingField('startDate'); }}
                            >
                              <span className="text-slate-400 flex-shrink-0 w-3.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                                </svg>
                              </span>
                              <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Timeframe</span>
                              {isEditingDate ? (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="date"
                                    className="text-[10px] bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5 text-slate-700"
                                    defaultValue={proj.startDate ?? ''}
                                    onBlur={e => saveField({ startDate: e.target.value })}
                                    onKeyDown={e => { if (e.key === 'Escape') setEditingField(null); }}
                                  />
                                  <span className="text-[10px] text-slate-400">–</span>
                                  <input
                                    type="date"
                                    className="text-[10px] bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5 text-slate-700"
                                    defaultValue={proj.endDate ?? ''}
                                    onBlur={e => { saveField({ endDate: e.target.value }); setEditingField(null); }}
                                    onKeyDown={e => { if (e.key === 'Escape') setEditingField(null); }}
                                  />
                                </div>
                              ) : (
                                <span className={`flex-1 text-[13px] truncate py-0.5 ${hasDate ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                                  {hasDate ? `${fmt(proj.startDate)} – ${fmt(proj.endDate)}` : 'Set dates…'}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        {/* Target */}
                        {textRow(
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                          </svg>,
                          'Target', 'target', proj.target, 'What does success look like?'
                        )}
                        {/* Actual */}
                        {textRow(
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                          </svg>,
                          'Actual', 'actual', proj.actual, 'Where are we today?'
                        )}
                        {/* Risks */}
                        {textRow(
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>,
                          'Risks', 'risks', proj.risks, 'Key blockers or risks…'
                        )}
                        {/* Milestone */}
                        {textRow(
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                          </svg>,
                          'Milestone', 'nextMilestone', proj.nextMilestone, 'Next key deliverable…'
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  {(() => {
                    const hasTeams = proj.teams && proj.teams.length > 0;
                    const teamMemberNames = hasTeams
                      ? new Set(proj.teams!.flatMap(t => (t.members || []).map(m => m.name)))
                      : new Set<string>();
                    const unaffiliated = hasTeams
                      ? (proj.headcount || []).filter(hc => !teamMemberNames.has(hc.name))
                      : (proj.headcount || []);
                    const totalPeople = hasTeams
                      ? teamMemberNames.size + unaffiliated.length
                      : (proj.headcount || []).length;

                    const MemberCard: React.FC<{ hc: ProjectAssignment }> = ({ hc }) => (
                      <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(hc.name)} flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0`}>
                          {getInitials(hc.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-slate-800 truncate">{hc.name}</p>
                          <p className="text-[9px] text-slate-500 truncate">{hc.role}</p>
                        </div>
                        {hc.allocation && (
                          <span className="text-[9px] font-medium text-slate-400 flex-shrink-0">{hc.allocation}</span>
                        )}
                      </div>
                    );

                    return (
                      <>
                        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          {hasTeams ? 'Teams & People' : 'Team'}{totalPeople > 0 ? ` (${totalPeople})` : ''}
                        </h4>
                        <div className="space-y-1">
                          {hasTeams && proj.teams!.map(team => (
                            <div key={team.id}>
                              <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                </svg>
                                <span className="text-[11px] font-semibold text-indigo-700">{team.name}</span>
                                {team.department && (
                                  <span className="px-1 py-px bg-brand-light text-brand-dark text-[8px] font-bold rounded uppercase">{team.department}</span>
                                )}
                                <span className="text-[10px] text-slate-400">({team.members?.length || 0})</span>
                              </div>
                              <div className="pl-3 space-y-1">
                                {(team.members || []).map(m => (
                                  <MemberCard key={m.id} hc={m} />
                                ))}
                              </div>
                            </div>
                          ))}
                          {unaffiliated.map(hc => (
                            <MemberCard key={hc.id} hc={hc} />
                          ))}
                        </div>
                      </>
                    );
                  })()}

                  <div className="space-y-1">
                    {/* Notion-style inline add member */}
                    {(onAddHeadcount || onAddPersonnelToProject) && (() => {
                      const objId = parentObj?.id;
                      const krId = parentKR?.id;
                      if (!objId || !krId) return null;

                      const filteredRoster = personnel
                        .filter(p => p.name.toLowerCase().includes(memberSearch.toLowerCase()))
                        .slice(0, 6);
                      const hasExactMatch = personnel.some(
                        p => p.name.toLowerCase() === memberSearch.toLowerCase()
                      );

                      if (addingMember) {
                        return (
                          <div className="relative mt-0.5">
                            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded-lg ring-1 ring-brand-primary/40">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <input
                                autoFocus
                                className="flex-1 text-[11px] bg-transparent outline-none text-slate-800 placeholder-slate-400"
                                placeholder="Search by name…"
                                value={memberSearch}
                                onChange={e => setMemberSearch(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Escape') { setAddingMember(false); setMemberSearch(''); }
                                }}
                              />
                            </div>
                            {(filteredRoster.length > 0 || memberSearch.trim()) && (
                              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                                {filteredRoster.map(person => (
                                  <button
                                    key={person.id}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 transition-colors text-left"
                                    onMouseDown={e => {
                                      e.preventDefault();
                                      onAddPersonnelToProject?.(objId, krId, proj.id, person);
                                      setAddingMember(false);
                                      setMemberSearch('');
                                    }}
                                  >
                                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(person.name)} flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0`}>
                                      {getInitials(person.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-medium text-slate-800 truncate">{person.name}</p>
                                      <p className="text-[9px] text-slate-500 truncate">{person.role}</p>
                                    </div>
                                  </button>
                                ))}
                                {memberSearch.trim() && !hasExactMatch && (
                                  <>
                                    {filteredRoster.length > 0 && <div className="border-t border-slate-100" />}
                                    <button
                                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 transition-colors text-left"
                                      onMouseDown={e => {
                                        e.preventDefault();
                                        onAddHeadcount?.(objId, krId, proj.id, memberSearch.trim(), '', 'Full-time');
                                        setAddingMember(false);
                                        setMemberSearch('');
                                      }}
                                    >
                                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-[8px] font-bold flex-shrink-0">
                                        +
                                      </div>
                                      <p className="text-[11px] text-slate-600">
                                        Add <span className="font-medium text-slate-800">"{memberSearch.trim()}"</span> as new member
                                      </p>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <button
                          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 px-2 py-1 -mx-2 rounded-md hover:bg-slate-50 transition-colors w-full mt-0.5"
                          onClick={() => setAddingMember(true)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          Add member
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {deps.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Dependencies</h4>
                    <div className="space-y-1">
                      {deps.map(dep => {
                        const isSource = dep.sourceId === proj.id;
                        const otherType = isSource ? dep.targetType : dep.sourceType;
                        const otherId = isSource ? dep.targetId : dep.sourceId;
                        const otherName = getElementName(allObjectives, otherType as 'objective' | 'keyResult' | 'project', otherId);
                        return (
                          <div key={dep.id} className="px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-[11px]">
                            <span className="text-blue-600 font-medium">{dep.dependencyType.replace('_', ' ')}</span>
                            <span className="text-slate-600"> → {otherName}</span>
                            {dep.description && <p className="text-slate-500 mt-0.5">{dep.description}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* ─── DEPARTMENTAL KEY RESULT DETAILS ─── */}
          {detailData.type === 'departmentalKeyResult' && (() => {
            const { dkr, parentKR, parentObj, projects } = detailData;
            const canEditDkr = !!(parentObj && parentKR && onUpdateDepartmentalKeyResult);
            const saveDkrField = (updates: Partial<DepartmentalKeyResult>) => {
              if (canEditDkr) onUpdateDepartmentalKeyResult!(parentObj.id, parentKR.id, dkr.id, updates);
            };

            const DKR_STATUS_OPTIONS = ['On Track', 'At Risk', 'Blocked'] as const;
            const DKR_STATUS_STYLES: Record<string, string> = {
              'On Track': 'bg-emerald-50 text-emerald-600 border-emerald-200',
              'At Risk': 'bg-amber-50 text-amber-600 border-amber-200',
              'Blocked': 'bg-red-50 text-red-600 border-red-200',
            };

            const dkrTextRow = (
              icon: React.ReactNode,
              label: string,
              fieldKey: string,
              value: string | number | undefined,
              placeholder: string,
              inputType: string = 'text'
            ) => {
              const strVal = value !== undefined ? String(value) : undefined;
              const isEditing = editingField === fieldKey;
              return (
                <div
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2 ${canEditDkr && !isEditing ? 'hover:bg-slate-50 cursor-text' : ''}`}
                  onClick={() => { if (canEditDkr && !isEditing) { setEditingField(fieldKey); setFieldDraft(strVal ?? ''); } }}
                >
                  <span className="text-slate-400 flex-shrink-0 w-3.5">{icon}</span>
                  <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">{label}</span>
                  {isEditing ? (
                    <input
                      autoFocus
                      type={inputType}
                      className="flex-1 text-[13px] text-slate-800 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5"
                      value={fieldDraft}
                      placeholder={placeholder}
                      onChange={e => setFieldDraft(e.target.value)}
                      onBlur={() => {
                        const parsed = inputType === 'number' ? (fieldDraft === '' ? undefined : Number(fieldDraft)) : fieldDraft;
                        saveDkrField({ [fieldKey]: parsed } as Partial<DepartmentalKeyResult>);
                        setEditingField(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setEditingField(null);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className={`flex-1 text-[13px] truncate py-0.5 ${strVal ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                      {strVal || placeholder}
                    </span>
                  )}
                </div>
              );
            };

            return (
              <>
                {/* Title */}
                <div>
                  <div
                    className={canEditDkr && editingField !== 'title' ? 'cursor-text' : ''}
                    onClick={() => { if (canEditDkr && editingField !== 'title') { setEditingField('title'); setFieldDraft(dkr.title); } }}
                  >
                    {editingField === 'title' ? (
                      <textarea
                        autoFocus
                        rows={2}
                        className="w-full text-sm font-semibold text-slate-900 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5 resize-none leading-snug"
                        value={fieldDraft}
                        onChange={e => setFieldDraft(e.target.value)}
                        onBlur={() => { saveDkrField({ title: fieldDraft }); setEditingField(null); }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <p className="text-base font-semibold text-slate-900 leading-snug">{dkr.title}</p>
                    )}
                  </div>
                  <span className="inline-block mt-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded uppercase">{dkr.department}</span>

                  {/* Editable description */}
                  <div
                    className={`mt-2 rounded-md ${canEditDkr && editingField !== 'description' ? 'hover:bg-slate-50 cursor-text' : ''}`}
                    onClick={() => { if (canEditDkr && editingField !== 'description') { setEditingField('description'); setFieldDraft(dkr.description ?? ''); } }}
                  >
                    {editingField === 'description' ? (
                      <textarea
                        autoFocus
                        rows={3}
                        className="w-full text-sm text-slate-600 bg-transparent outline-none ring-1 ring-brand-primary rounded px-2 py-1.5 resize-none leading-relaxed"
                        value={fieldDraft}
                        placeholder="Add a description..."
                        onChange={e => setFieldDraft(e.target.value)}
                        onBlur={() => { saveDkrField({ description: fieldDraft }); setEditingField(null); }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <p className={`text-sm leading-relaxed px-1 py-0.5 ${dkr.description ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                        {dkr.description || 'Add a description...'}
                      </p>
                    )}
                  </div>
                </div>

                {AlertsSection()}
                {ChildIssuesSection()}

                {/* ─── DKR CHECK-IN METADATA ─── */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Check-in</h4>
                  <div>
                    {/* Status */}
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2">
                      <span className="text-slate-400 flex-shrink-0 w-3.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Status</span>
                      <div className="flex flex-wrap gap-1">
                        {DKR_STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            disabled={!canEditDkr}
                            className={`px-3 py-0.5 rounded text-[9px] font-bold border transition-all ${
                              dkr.status === opt.toLowerCase().replace(' ', '_') || dkr.status === opt
                                ? (DKR_STATUS_STYLES[opt] || 'bg-slate-100 text-slate-600') + ' border-transparent'
                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                            } ${canEditDkr ? 'cursor-pointer' : 'cursor-default'}`}
                            onClick={() => saveDkrField({ status: opt })}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Owner */}
                    {dkrTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>,
                      'Owner', 'owner', dkr.owner, 'Assign owner…'
                    )}
                    {/* Due date */}
                    {(() => {
                      const isEditingDate = editingField === 'targetDate';
                      return (
                        <div
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2 ${canEditDkr && !isEditingDate ? 'hover:bg-slate-50 cursor-text' : ''}`}
                          onClick={() => { if (canEditDkr && !isEditingDate) { setEditingField('targetDate'); setFieldDraft(dkr.targetDate ?? ''); } }}
                        >
                          <span className="text-slate-400 flex-shrink-0 w-3.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                            </svg>
                          </span>
                          <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Due</span>
                          {isEditingDate ? (
                            <input
                              autoFocus
                              type="date"
                              className="flex-1 text-[13px] bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5 text-slate-700"
                              defaultValue={dkr.targetDate ?? ''}
                              onBlur={e => { saveDkrField({ targetDate: e.target.value }); setEditingField(null); }}
                              onKeyDown={e => { if (e.key === 'Escape') setEditingField(null); }}
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <span className={`flex-1 text-[13px] truncate py-0.5 ${dkr.targetDate ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                              {dkr.targetDate ? `${new Date(dkr.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, '${new Date(dkr.targetDate).toLocaleDateString('en-US', { year: '2-digit' })}` : 'Set due date…'}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {/* Metric */}
                    {dkrTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>,
                      'Metric', 'metric', dkr.metric, 'e.g. ARR, NPS…'
                    )}
                    {/* Baseline */}
                    {dkrTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" />
                      </svg>,
                      'Baseline', 'baseline', dkr.baseline, '0', 'number'
                    )}
                    {/* Current */}
                    {dkrTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                      </svg>,
                      'Current', 'current', dkr.current, 'Current value…', 'number'
                    )}
                    {/* Target */}
                    {dkrTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                      </svg>,
                      'Target', 'target', dkr.target, 'Target value…', 'number'
                    )}
                    {/* Risks */}
                    {dkrTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>,
                      'Risks', 'risks', dkr.risks, 'Key blockers or risks…'
                    )}
                    {/* Milestone */}
                    {dkrTextRow(
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>,
                      'Milestone', 'nextMilestone', dkr.nextMilestone, 'Next key deliverable…'
                    )}
                  </div>
                </div>

                {/* Projects */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Projects ({projects.length})</h4>
                  <div className="space-y-2">
                    {projects.map(p => (
                      <div key={p.id} className="bg-slate-50 rounded-lg px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-slate-800 truncate">{p.title}</span>
                          <span className={`px-1 py-0.5 rounded text-[8px] font-bold ml-1.5 flex-shrink-0 ${PROJECT_STATUS_STYLES[p.status] || 'bg-slate-100 text-slate-600'}`}>{p.status}</span>
                        </div>
                        {p.department && (
                          <p className="text-[9px] text-slate-400 mt-0.5">{p.department}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}

          {/* ─── TEAM DETAILS ─── */}
          {detailData.type === 'team' && (() => {
            const { team, parentProject, parentKR, parentObj, members } = detailData;
            const canEditTeam = !!(onUpdateTeam);
            const saveTeamField = (updates: Partial<Team>) => {
              if (canEditTeam) onUpdateTeam!(parentObj.id, parentKR.id, parentProject.id, team.id, updates);
            };

            return (
              <>
                {/* Title */}
                <div>
                  <div
                    className={canEditTeam && editingField !== 'teamName' ? 'cursor-text' : ''}
                    onClick={() => { if (canEditTeam && editingField !== 'teamName') { setEditingField('teamName'); setFieldDraft(team.name); } }}
                  >
                    {editingField === 'teamName' ? (
                      <input
                        autoFocus
                        className="w-full text-base font-semibold text-slate-900 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5 leading-snug"
                        value={fieldDraft}
                        onChange={e => setFieldDraft(e.target.value)}
                        onBlur={() => { saveTeamField({ name: fieldDraft }); setEditingField(null); }}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <p className="text-base font-semibold text-slate-900 leading-snug">{team.name}</p>
                    )}
                  </div>
                  {/* Description */}
                  <div
                    className={`mt-2 rounded-md ${canEditTeam && editingField !== 'teamDescription' ? 'hover:bg-slate-50 cursor-text' : ''}`}
                    onClick={() => { if (canEditTeam && editingField !== 'teamDescription') { setEditingField('teamDescription'); setFieldDraft(team.description ?? ''); } }}
                  >
                    {editingField === 'teamDescription' ? (
                      <textarea
                        autoFocus
                        rows={3}
                        className="w-full text-sm text-slate-600 bg-transparent outline-none ring-1 ring-brand-primary rounded px-2 py-1.5 resize-none leading-relaxed"
                        value={fieldDraft}
                        placeholder="Add a team description..."
                        onChange={e => setFieldDraft(e.target.value)}
                        onBlur={() => { saveTeamField({ description: fieldDraft }); setEditingField(null); }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <p className={`text-sm leading-relaxed px-1 py-0.5 ${team.description ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                        {team.description || 'Add a team description...'}
                      </p>
                    )}
                  </div>
                </div>

                {AlertsSection()}

                {/* Details */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Details</h4>
                  <div>
                    {/* Department */}
                    <div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2 ${canEditTeam && editingField !== 'teamDepartment' ? 'hover:bg-slate-50 cursor-text' : ''}`}
                      onClick={() => { if (canEditTeam && editingField !== 'teamDepartment') { setEditingField('teamDepartment'); setFieldDraft(team.department ?? ''); } }}
                    >
                      <span className="text-slate-400 flex-shrink-0 w-3.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
                      </span>
                      <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Department</span>
                      {editingField === 'teamDepartment' ? (
                        <input
                          autoFocus
                          className="flex-1 text-[13px] text-slate-800 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5"
                          value={fieldDraft}
                          placeholder="Add department..."
                          onChange={e => setFieldDraft(e.target.value)}
                          onBlur={() => { saveTeamField({ department: fieldDraft }); setEditingField(null); }}
                          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className={`flex-1 text-[13px] truncate py-0.5 ${team.department ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                          {team.department || 'Add department...'}
                        </span>
                      )}
                    </div>
                    {/* Members count */}
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2">
                      <span className="text-slate-400 flex-shrink-0 w-3.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
                      </span>
                      <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">Members</span>
                      <span className="flex-1 text-[13px] text-slate-800 truncate py-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Members */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Members</h4>
                  <div className="space-y-1">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md -mx-2 hover:bg-slate-50">
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(m.name)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                          {getInitials(m.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-slate-700 truncate">{m.name}</p>
                          <p className="text-[10px] text-slate-500">{m.role}</p>
                        </div>
                        {m.allocation && (
                          <span className="ml-auto px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-medium rounded">{m.allocation}</span>
                        )}
                      </div>
                    ))}
                    {members.length === 0 && (
                      <p className="text-[10px] text-slate-300 italic px-2">No members assigned</p>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

          {/* ─── PERSON DETAILS ─── */}
          {detailData.type === 'person' && (() => {
            const { person, personnelRecord } = detailData;

            const savePersonField = (field: string, value: string) => {
              if (personnelRecord && onUpdatePersonnel) {
                onUpdatePersonnel(personnelRecord.id, { [field]: value });
              }
              setPersonEditField(null);
            };

            const startEdit = (field: string, currentValue: string) => {
              setPersonEditField(field);
              setPersonEditValue(currentValue);
            };

            const removeSkill = (skill: string) => {
              if (personnelRecord && onUpdatePersonnel) {
                onUpdatePersonnel(personnelRecord.id, {
                  skills: (personnelRecord.skills || []).filter(s => s !== skill),
                });
              }
            };

            const addSkill = () => {
              const trimmed = newSkillInput.trim();
              if (trimmed && personnelRecord && onUpdatePersonnel) {
                onUpdatePersonnel(personnelRecord.id, {
                  skills: [...(personnelRecord.skills || []), trimmed],
                });
              }
              setNewSkillInput('');
              setAddingSkill(false);
            };

            // Notion-style property row
            const PropertyRow = ({
              icon,
              label,
              field,
              value,
              placeholder = 'Empty',
            }: {
              icon: React.ReactNode;
              label: string;
              field: string;
              value?: string;
              placeholder?: string;
            }) => {
              const isEditing = personEditField === field;
              const canEdit = !!personnelRecord && !!onUpdatePersonnel;
              return (
                <div
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md -mx-2 group ${canEdit ? 'hover:bg-slate-50 cursor-text' : ''}`}
                  onClick={() => canEdit && !isEditing && startEdit(field, value || '')}
                >
                  <span className="text-slate-400 flex-shrink-0 w-3.5">{icon}</span>
                  <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">{label}</span>
                  {isEditing ? (
                    <input
                      autoFocus
                      className="flex-1 text-[13px] text-slate-800 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5"
                      value={personEditValue}
                      onChange={e => setPersonEditValue(e.target.value)}
                      onBlur={() => savePersonField(field, personEditValue)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') savePersonField(field, personEditValue);
                        if (e.key === 'Escape') setPersonEditField(null);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className={`flex-1 text-[13px] truncate py-0.5 ${value ? 'text-slate-800' : 'text-slate-300 italic'}`}>
                      {value || placeholder}
                    </span>
                  )}
                </div>
              );
            };

            const displayName = personnelRecord?.name || person.name;

            return (
              <>
                {/* Avatar + name header */}
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(displayName)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                    {getInitials(displayName)}
                  </div>
                  <div
                    className={`flex-1 min-w-0 group ${personnelRecord && onUpdatePersonnel ? 'cursor-text' : ''}`}
                    onClick={() => personnelRecord && onUpdatePersonnel && personEditField !== 'name' && startEdit('name', displayName)}
                  >
                    {personEditField === 'name' ? (
                      <input
                        autoFocus
                        className="w-full text-sm font-semibold text-slate-900 bg-transparent outline-none ring-1 ring-brand-primary rounded px-1 py-0.5"
                        value={personEditValue}
                        onChange={e => setPersonEditValue(e.target.value)}
                        onBlur={() => savePersonField('name', personEditValue)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') savePersonField('name', personEditValue);
                          if (e.key === 'Escape') setPersonEditField(null);
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <p className={`text-sm font-semibold text-slate-900 truncate ${personnelRecord && onUpdatePersonnel ? 'group-hover:text-slate-600' : ''}`}>
                        {displayName}
                      </p>
                    )}
                    {!personnelRecord && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Not in personnel roster</p>
                    )}
                  </div>
                </div>
                {AlertsSection()}

                {/* Properties */}
                <div className="space-y-0.5">
                  <PropertyRow
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                    label="Role"
                    field="role"
                    value={personnelRecord?.role ?? person.role}
                  />
                  <PropertyRow
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>}
                    label="Department"
                    field="department"
                    value={personnelRecord?.department}
                  />
                  <PropertyRow
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>}
                    label="Email"
                    field="email"
                    value={personnelRecord?.email}
                  />
                  <PropertyRow
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    label="Availability"
                    field="availability"
                    value={personnelRecord?.availability}
                  />
                </div>

                {/* Skills */}
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-1">
                    {(personnelRecord?.skills || []).map(skill => (
                      <span key={skill} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full group/skill">
                        {skill}
                        {onUpdatePersonnel && (
                          <button
                            onClick={() => removeSkill(skill)}
                            className="text-slate-400 hover:text-slate-600 opacity-0 group-hover/skill:opacity-100 transition-opacity leading-none"
                            title="Remove skill"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          </button>
                        )}
                      </span>
                    ))}
                    {onUpdatePersonnel && personnelRecord && (
                      addingSkill ? (
                        <input
                          autoFocus
                          className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full outline-none ring-1 ring-brand-primary w-24"
                          placeholder="Add skill…"
                          value={newSkillInput}
                          onChange={e => setNewSkillInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') addSkill();
                            if (e.key === 'Escape') { setAddingSkill(false); setNewSkillInput(''); }
                          }}
                          onBlur={() => { if (newSkillInput.trim()) addSkill(); else { setAddingSkill(false); setNewSkillInput(''); } }}
                        />
                      ) : (
                        <button
                          onClick={() => setAddingSkill(true)}
                          className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 px-2 py-0.5 rounded-full transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                          Add
                        </button>
                      )
                    )}
                    {(!personnelRecord?.skills || personnelRecord.skills.length === 0) && !addingSkill && (
                      <span className="text-[10px] text-slate-300 italic">No skills listed</span>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default StrategyDetailPanel;
