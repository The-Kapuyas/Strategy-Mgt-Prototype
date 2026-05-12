import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Objective, KeyResult, DepartmentalKeyResult, DepartmentalProject, ProjectAssignment, Team, Personnel, Dependency } from '../types';
import { generateExecutionInsights, chatWithStrategy, ChatMessage, type ExecutionInsights, type RiskWithReasoning, type FocusAreaWithReasoning } from '../services/openaiService';
import AIAssistButton from './common/AIAssistButton';
import AlertBadge from './common/AlertBadge';
import StrategyDetailPanel from './StrategyDetailPanel';
import { useDetailData, type SelectedItem, type DetailData } from '../hooks/useDetailData';
import {
  calculateProjectFTEYears,
  calculateKRFTEYears,
  calculateObjectiveFTEYears,
  formatFTEYears,
  calculateProjectCost,
  calculateKRCost,
  calculateObjectiveCost,
  formatResourceCost,
} from '../utils/fteCalculations';
import {
  getDepartmentStyle,
  getDepartmentBgColor,
  STATUS_STYLES,
  PROJECT_STATUS_STYLES,
  TIMELINE_OBJECTIVE_COLORS,
  TIMELINE_OBJECTIVE_HEX,
  ResourceStatus,
  MS_PER_DAY,
  getAvatarColor,
  getInitials,
} from '../utils/constants';
import {
  getElementName,
  getDependenciesForElement,
  getAllProjectsWithContext,
  getProjectResourceStatus,
  type ProjectWithContext,
} from '../utils/strategyHelpers';
import { AssessmentResult, AssessmentAlert, SuggestedAction, CascadedAlertSummary, ChildIssueSummary } from '../types/assessment';
import { runAssessment, applyAction } from '../services/assessmentService';
import { buildChatStrategyContext } from '../utils/chatContextBuilder';
import { TreeRowMenu, DeleteConfirmPopover, ActionMenuDropdown, type MenuAction } from './common/TreeRowMenu';

interface WorkspaceViewProps {
  priorities: Objective[];
  setObjectives: (objectives: Objective[]) => void;
  companyName: string;
  personnel: Personnel[];
  setPersonnel: (personnel: Personnel[]) => void;
  dependencies: Dependency[];
  setDependencies: (dependencies: Dependency[]) => void;
}

// Icons
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const CardsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const TreeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13m-7 6h7M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

const TimelineIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DepartmentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const OverviewIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
  </svg>
);

const ExplorerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill="currentColor" stroke="none" />
  </svg>
);

const ChevronDownIcon = ({ open }: { open: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const DragHandleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
  </svg>
);

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
  </svg>
);

// Reusable member row renderer
const MemberRow: React.FC<{
  hc: ProjectAssignment;
  objective: Objective;
  kr: KeyResult;
  proj: DepartmentalProject;
  draggedItem: any;
  selectedItemId?: string | null;
  treeEditingItemId?: string | null;
  treeEditValue?: string;
  treeConfirmingDeleteId?: string | null;
  onSelectItem?: (id: string, type: 'objective' | 'keyResult' | 'departmentalKeyResult' | 'project' | 'team' | 'person', label: string) => void;
  onTreeEditStart?: (id: string, currentTitle: string) => void;
  onTreeEditValueChange?: (value: string) => void;
  onTreeEditSave?: (id: string, type: string, objectiveId: string, krId?: string, projectId?: string) => void;
  onTreeEditCancel?: () => void;
  onTreeDeleteRequest?: (id: string, type: string, label: string, objectiveId: string, krId?: string, projectId?: string) => void;
  onTreeDeleteConfirm?: () => void;
  onTreeDeleteCancel?: () => void;
  onDragStart: (e: React.DragEvent, type: 'kr' | 'project' | 'headcount' | 'team', id: string, sourceObjectiveId: string, sourceKRId?: string, sourceProjectId?: string) => void;
  onDragEnd: () => void;
  openContextMenu: (e: React.MouseEvent, actions: MenuAction[]) => void;
  AlertIndicator: React.FC<{ elementKey: string }>;
  isTeamMember?: boolean;
}> = ({ hc, objective, kr, proj, draggedItem, selectedItemId, treeEditingItemId, treeEditValue, treeConfirmingDeleteId, onSelectItem, onTreeEditStart, onTreeEditValueChange, onTreeEditSave, onTreeEditCancel, onTreeDeleteRequest, onTreeDeleteConfirm, onTreeDeleteCancel, onDragStart, onDragEnd, openContextMenu, AlertIndicator, isTeamMember }) => (
  <div
    key={hc.id}
    className={`flex items-center gap-2 text-[11px] group/hc py-1 px-3 rounded hover:bg-white cursor-pointer ${draggedItem?.type === 'headcount' && draggedItem.id === hc.id ? 'opacity-50' : ''} ${selectedItemId === hc.id ? 'bg-blue-50/70 border-l-2 border-blue-500' : ''}`}
    {...(!isTeamMember ? { draggable: true, onDragStart: (e: React.DragEvent) => onDragStart(e, 'headcount', hc.id, objective.id, kr.id, proj.id), onDragEnd } : {})}
    onClick={() => onSelectItem?.(hc.id, 'person', hc.name)}
    onContextMenu={(e) => openContextMenu(e, [
      { label: 'Edit name', icon: 'edit', onClick: () => onTreeEditStart?.(hc.id, hc.name) },
      { label: 'Remove member', icon: 'delete', destructive: true, onClick: () => onTreeDeleteRequest?.(hc.id, 'headcount', hc.name, objective.id, kr.id, proj.id) },
    ])}
  >
    {!isTeamMember && <span className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"><DragHandleIcon /></span>}
    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(hc.name)} flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0`}>
      {getInitials(hc.name)}
    </div>
    {treeEditingItemId === hc.id ? (
      <input
        type="text"
        value={treeEditValue}
        onChange={(e) => onTreeEditValueChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onTreeEditSave?.(hc.id, 'headcount', objective.id, kr.id, proj.id);
          if (e.key === 'Escape') onTreeEditCancel?.();
        }}
        onBlur={() => onTreeEditSave?.(hc.id, 'headcount', objective.id, kr.id, proj.id)}
        className="text-[11px] text-slate-700 px-1 py-0.5 border border-purple-400 rounded focus:ring-2 focus:ring-purple-400/30 outline-none"
        autoFocus
        onClick={(e) => e.stopPropagation()}
      />
    ) : (
      <span className="text-slate-700 font-medium">{hc.name}</span>
    )}
    <span className="text-slate-400">•</span>
    <span className="text-slate-500">{hc.role}</span>
    {hc.allocation && (
      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] rounded">{hc.allocation}</span>
    )}
    <AlertIndicator elementKey={`person:${hc.name}`} />
    <div className="relative ml-auto opacity-0 group-hover/hc:opacity-100 transition-opacity flex-shrink-0">
      {treeConfirmingDeleteId === hc.id ? (
        <DeleteConfirmPopover
          itemLabel="this team member"
          onConfirm={() => onTreeDeleteConfirm?.()}
          onCancel={() => onTreeDeleteCancel?.()}
        />
      ) : (
        <TreeRowMenu
          actions={[
            { label: 'Edit name', icon: 'edit', onClick: () => onTreeEditStart?.(hc.id, hc.name) },
            { label: 'Remove member', icon: 'delete', destructive: true, onClick: () => onTreeDeleteRequest?.(hc.id, 'headcount', hc.name, objective.id, kr.id, proj.id) },
          ]}
        />
      )}
    </div>
  </div>
);

// Project tree row with support for optional Team layer
const ProjectTreeRow: React.FC<{
  proj: DepartmentalProject;
  projIndex: number;
  objective: Objective;
  kr: KeyResult;
  draggedItem: any;
  dropTarget: any;
  selectedItemId?: string | null;
  expandedProjects: Set<string>;
  expandedTeams: Set<string>;
  treeEditingItemId?: string | null;
  treeEditValue?: string;
  treeConfirmingDeleteId?: string | null;
  onSelectItem?: (id: string, type: 'objective' | 'keyResult' | 'departmentalKeyResult' | 'project' | 'team' | 'person', label: string) => void;
  onTreeEditStart?: (id: string, currentTitle: string) => void;
  onTreeEditValueChange?: (value: string) => void;
  onTreeEditSave?: (id: string, type: string, objectiveId: string, krId?: string, projectId?: string) => void;
  onTreeEditCancel?: () => void;
  onTreeDeleteRequest?: (id: string, type: string, label: string, objectiveId: string, krId?: string, projectId?: string) => void;
  onTreeDeleteConfirm?: () => void;
  onTreeDeleteCancel?: () => void;
  onAddHeadcount: (projId: string) => void;
  onDragStart: (e: React.DragEvent, type: 'kr' | 'project' | 'headcount' | 'team', id: string, sourceObjectiveId: string, sourceKRId?: string, sourceProjectId?: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnterProject: (e: React.DragEvent, objectiveId: string, krId: string, projectId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDropOnProject: (e: React.DragEvent, targetObjectiveId: string, targetKRId: string, targetProjectId: string) => void;
  toggleProject: (id: string) => void;
  toggleTeam: (id: string) => void;
  openContextMenu: (e: React.MouseEvent, actions: MenuAction[]) => void;
  AlertIndicator: React.FC<{ elementKey: string }>;
  indentClass: string;
  expandedIndentClass: string;
}> = ({
  proj, projIndex, objective, kr, draggedItem, dropTarget, selectedItemId,
  expandedProjects, expandedTeams,
  treeEditingItemId, treeEditValue, treeConfirmingDeleteId,
  onSelectItem, onTreeEditStart, onTreeEditValueChange, onTreeEditSave, onTreeEditCancel,
  onTreeDeleteRequest, onTreeDeleteConfirm, onTreeDeleteCancel,
  onAddHeadcount, onDragStart, onDragEnd, onDragOver, onDragEnterProject, onDragLeave, onDropOnProject,
  toggleProject, toggleTeam, openContextMenu, AlertIndicator, indentClass, expandedIndentClass,
}) => {
  const memberProps = {
    objective, kr, proj, draggedItem, selectedItemId, treeEditingItemId, treeEditValue,
    treeConfirmingDeleteId, onSelectItem, onTreeEditStart, onTreeEditValueChange, onTreeEditSave,
    onTreeEditCancel, onTreeDeleteRequest, onTreeDeleteConfirm, onTreeDeleteCancel,
    onDragStart, onDragEnd, openContextMenu, AlertIndicator,
  };

  return (
    <div className="group/proj">
      {/* Project Row */}
      <div
        className={`flex items-center gap-3 ${indentClass} pr-6 py-2 hover:bg-white cursor-pointer transition-colors ${draggedItem?.type === 'project' && draggedItem.id === proj.id ? 'opacity-50' : ''} ${dropTarget?.type === 'project' && dropTarget.id === proj.id ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''} ${selectedItemId === proj.id ? 'bg-blue-50/70 border-l-2 border-blue-500' : ''}`}
        onClick={() => onSelectItem ? onSelectItem(proj.id, 'project', proj.title) : toggleProject(proj.id)}
        onContextMenu={(e) => openContextMenu(e, [
          { label: 'Edit title', icon: 'edit', onClick: () => onTreeEditStart?.(proj.id, proj.title) },
          { label: 'Add team member', icon: 'add', onClick: () => onAddHeadcount(proj.id) },
          { label: 'Delete project', icon: 'delete', destructive: true, onClick: () => onTreeDeleteRequest?.(proj.id, 'project', proj.title, objective.id, kr.id) },
        ])}
        draggable
        onDragStart={(e) => onDragStart(e, 'project', proj.id, objective.id, kr.id)}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragEnter={(e) => onDragEnterProject(e, objective.id, kr.id, proj.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDropOnProject(e, objective.id, kr.id, proj.id)}
      >
        <span className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"><DragHandleIcon /></span>
        <span onClick={(e) => { e.stopPropagation(); toggleProject(proj.id); }} className="flex-shrink-0">
          <ChevronDownIcon open={expandedProjects.has(proj.id)} />
        </span>
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">{proj.id}</span>
        <div className="flex-grow min-w-0">
          {treeEditingItemId === proj.id ? (
            <input
              type="text"
              value={treeEditValue}
              onChange={(e) => onTreeEditValueChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onTreeEditSave?.(proj.id, 'project', objective.id, kr.id);
                if (e.key === 'Escape') onTreeEditCancel?.();
              }}
              onBlur={() => onTreeEditSave?.(proj.id, 'project', objective.id, kr.id)}
              className="text-xs text-slate-700 w-full px-1 py-0.5 border border-blue-400 rounded focus:ring-2 focus:ring-blue-400/30 outline-none"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-xs text-slate-700 truncate">{proj.title}</p>
          )}
        </div>
        <AlertIndicator elementKey={`project:${proj.id}`} />
        <div className="relative opacity-0 group-hover/proj:opacity-100 transition-opacity flex-shrink-0">
          {treeConfirmingDeleteId === proj.id ? (
            <DeleteConfirmPopover
              itemLabel="this project"
              onConfirm={() => onTreeDeleteConfirm?.()}
              onCancel={() => onTreeDeleteCancel?.()}
            />
          ) : (
            <TreeRowMenu
              actions={[
                { label: 'Edit title', icon: 'edit', onClick: () => onTreeEditStart?.(proj.id, proj.title) },
                { label: 'Add team member', icon: 'add', onClick: () => onAddHeadcount(proj.id) },
                { label: 'Delete project', icon: 'delete', destructive: true, onClick: () => onTreeDeleteRequest?.(proj.id, 'project', proj.title, objective.id, kr.id) },
              ]}
            />
          )}
        </div>
      </div>

      {/* Expanded Project Content */}
      {expandedProjects.has(proj.id) && (
        <div className={`${expandedIndentClass} pr-6 py-2 bg-slate-50/30 space-y-2`}>
          {/* Teams + People */}
          {proj.teams && proj.teams.length > 0 ? (
            <div className="space-y-1">
              {/* Teams (collapsible) */}
              {proj.teams.map(team => (
                <div key={team.id}>
                  {/* Team Row */}
                  <div
                    className={`flex items-center gap-2 text-[11px] group/team py-1.5 px-3 rounded hover:bg-white cursor-pointer ${draggedItem?.type === 'team' && draggedItem.id === team.id ? 'opacity-50' : ''} ${selectedItemId === team.id ? 'bg-blue-50/70 border-l-2 border-blue-500' : ''}`}
                    onClick={() => onSelectItem ? onSelectItem(team.id, 'team', team.name) : toggleTeam(team.id)}
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); onDragStart(e, 'team', team.id, objective.id, kr.id, proj.id); }}
                    onDragEnd={onDragEnd}
                  >
                    <span className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"><DragHandleIcon /></span>
                    <span onClick={(e) => { e.stopPropagation(); toggleTeam(team.id); }} className="flex-shrink-0">
                      <ChevronDownIcon open={expandedTeams.has(team.id)} />
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <span className="text-indigo-700 font-semibold">{team.name}</span>
                    {team.department && (
                      <span className="px-1.5 py-0.5 bg-brand-light text-brand-dark text-[9px] font-bold rounded uppercase tracking-tighter">
                        {team.department}
                      </span>
                    )}
                    <span className="text-slate-400 text-[10px]">({team.members?.length || 0})</span>
                  </div>
                  {/* Team Members */}
                  {expandedTeams.has(team.id) && team.members && team.members.length > 0 && (
                    <div className="pl-6 space-y-1">
                      {team.members.map(hc => (
                        <MemberRow key={hc.id} hc={hc} {...memberProps} isTeamMember />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {/* Individual people not in any team */}
              {(() => {
                const teamMemberNames = new Set(
                  proj.teams!.flatMap(t => (t.members || []).map(m => m.name))
                );
                const unaffiliated = (proj.headcount || []).filter(hc => !teamMemberNames.has(hc.name));
                return unaffiliated.length > 0 ? unaffiliated.map(hc => (
                  <MemberRow key={hc.id} hc={hc} {...memberProps} />
                )) : null;
              })()}
            </div>
          ) : (
            /* Direct Headcount (no teams) */
            proj.headcount && proj.headcount.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-purple-600 font-bold uppercase tracking-wider px-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  Team ({proj.headcount.length})
                </div>
                {proj.headcount.map(hc => (
                  <MemberRow key={hc.id} hc={hc} {...memberProps} />
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

// Tree View Component
const TreeView: React.FC<{
  objectives: Objective[];
  allObjectives: Objective[];
  onRemoveHeadcount: (objId: string, krId: string, projId: string, hcId: string) => void;
  onCreateObjective?: (title: string) => void;
  onCreateKR?: (objId: string, title: string) => void;
  onCreateProject?: (objId: string, krId: string, dept: string, title: string) => void;
  onAddHeadcount: (projId: string) => void;
  draggedItem: { type: 'kr' | 'project' | 'headcount' | 'team'; id: string; sourceObjectiveId: string; sourceKRId?: string; sourceProjectId?: string } | null;
  dropTarget: { type: 'objective' | 'kr' | 'project'; id: string; objectiveId?: string; krId?: string } | null;
  onDragStart: (e: React.DragEvent, type: 'kr' | 'project' | 'headcount' | 'team', id: string, sourceObjectiveId: string, sourceKRId?: string, sourceProjectId?: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragEnterObjective: (e: React.DragEvent, objectiveId: string) => void;
  onDragEnterKR: (e: React.DragEvent, objectiveId: string, krId: string) => void;
  onDragEnterProject: (e: React.DragEvent, objectiveId: string, krId: string, projectId: string) => void;
  onDropOnObjective: (e: React.DragEvent, targetObjectiveId: string) => void;
  onDropOnKR: (e: React.DragEvent, targetObjectiveId: string, targetKRId: string) => void;
  onDropOnProject: (e: React.DragEvent, targetObjectiveId: string, targetKRId: string, targetProjectId: string) => void;
  onSelectItem?: (id: string, type: 'objective' | 'keyResult' | 'departmentalKeyResult' | 'project' | 'team' | 'person', label: string) => void;
  selectedItemId?: string | null;
  cascadedAlertsByElement?: Map<string, CascadedAlertSummary>;
  showAlertOverlay?: boolean;
  expandedObjectives: Set<string>;
  setExpandedObjectives: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedKRs: Set<string>;
  setExpandedKRs: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedProjects: Set<string>;
  setExpandedProjects: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedDKRs: Set<string>;
  setExpandedDKRs: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedTeams: Set<string>;
  setExpandedTeams: React.Dispatch<React.SetStateAction<Set<string>>>;
  treeEditingItemId?: string | null;
  treeEditValue?: string;
  onTreeEditValueChange?: (value: string) => void;
  onTreeEditStart?: (id: string, currentTitle: string) => void;
  onTreeEditSave?: (id: string, type: 'objective' | 'keyResult' | 'project' | 'headcount', objectiveId: string, krId?: string, projectId?: string) => void;
  onTreeEditCancel?: () => void;
  treeConfirmingDeleteId?: string | null;
  onTreeDeleteRequest?: (id: string, type: 'objective' | 'keyResult' | 'project' | 'headcount', label: string, objectiveId: string, krId?: string, projectId?: string) => void;
  onTreeDeleteConfirm?: () => void;
  onTreeDeleteCancel?: () => void;
}> = ({
  objectives,
  allObjectives,
  onRemoveHeadcount,
  onCreateObjective,
  onCreateKR,
  onCreateProject,
  onAddHeadcount,
  draggedItem,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDragEnterObjective,
  onDragEnterKR,
  onDragEnterProject,
  onDropOnObjective,
  onDropOnKR,
  onDropOnProject,
  onSelectItem,
  selectedItemId,
  cascadedAlertsByElement,
  showAlertOverlay,
  expandedObjectives,
  setExpandedObjectives,
  expandedKRs,
  setExpandedKRs,
  expandedProjects,
  setExpandedProjects,
  expandedDKRs,
  setExpandedDKRs,
  expandedTeams,
  setExpandedTeams,
  treeEditingItemId,
  treeEditValue,
  onTreeEditValueChange,
  onTreeEditStart,
  onTreeEditSave,
  onTreeEditCancel,
  treeConfirmingDeleteId,
  onTreeDeleteRequest,
  onTreeDeleteConfirm,
  onTreeDeleteCancel,
}) => {

    // Update expanded objectives when objectives change
    useEffect(() => {
      const currentIds = new Set(objectives.map(o => o.id));
      setExpandedObjectives(prev => {
        const newSet = new Set(prev);
        // Remove IDs that no longer exist
        for (const id of newSet) {
          if (!currentIds.has(id)) newSet.delete(id);
        }
        return newSet;
      });
    }, [objectives.map(o => o.id).join(',')]);

    const toggleObjective = (id: string) => {
      const newSet = new Set(expandedObjectives);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedObjectives(newSet);
    };

    const toggleKR = (id: string) => {
      const newSet = new Set(expandedKRs);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedKRs(newSet);
    };

    const toggleProject = (id: string) => {
      const newSet = new Set(expandedProjects);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedProjects(newSet);
    };

    const toggleDKR = (id: string) => {
      const newSet = new Set(expandedDKRs);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedDKRs(newSet);
    };

    const toggleTeam = (id: string) => {
      const newSet = new Set(expandedTeams);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedTeams(newSet);
    };

    // Inline add state (Notion-style)
    const [inlineAdd, setInlineAdd] = useState<{
      type: 'objective' | 'kr' | 'project';
      parentObjId?: string;
      parentKrId?: string;
    } | null>(null);
    const [inlineValue, setInlineValue] = useState('');
    const [inlineDept, setInlineDept] = useState('');

    const resetInlineAdd = () => {
      setInlineAdd(null);
      setInlineValue('');
      setInlineDept('');
    };

    const startInlineAdd = (type: 'objective' | 'kr' | 'project', parentObjId?: string, parentKrId?: string) => {
      resetInlineAdd();
      setInlineAdd({ type, parentObjId, parentKrId });
      // Expand parent if collapsed
      if (type === 'kr' && parentObjId && !expandedObjectives.has(parentObjId)) {
        const newSet = new Set(expandedObjectives);
        newSet.add(parentObjId);
        setExpandedObjectives(newSet);
      }
      if (type === 'project' && parentKrId && !expandedKRs.has(parentKrId)) {
        const newSet = new Set(expandedKRs);
        newSet.add(parentKrId);
        setExpandedKRs(newSet);
      }
    };

    // Right-click context menu state
    const [contextMenu, setContextMenu] = useState<{
      x: number; y: number; actions: MenuAction[];
    } | null>(null);

    const openContextMenu = (e: React.MouseEvent, actions: MenuAction[]) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, actions });
    };

    const AlertIndicator = ({ elementKey }: { elementKey: string }) => {
      if (!showAlertOverlay || !cascadedAlertsByElement) return null;
      const summary = cascadedAlertsByElement.get(elementKey);
      if (!summary || summary.totalCount === 0) return null;
      return (
        <AlertBadge
          count={summary.totalCount}
          severity={summary.totalMaxSeverity}
        />
      );
    };

    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        {/* Tree Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
          <h3 className="font-bold text-slate-800">OKR Hierarchy</h3>
        </div>

        {/* Tree Content */}
        <div className="divide-y divide-slate-100">
          {objectives.map((objective, oIndex) => (
            <div key={objective.id} className="group">
              {/* Objective Row */}
              <div
                className={`group/obj flex items-center gap-3 px-6 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${dropTarget?.type === 'objective' && dropTarget.id === objective.id ? 'ring-2 ring-emerald-400 bg-emerald-50/50' : ''} ${selectedItemId === objective.id ? 'bg-blue-50/70 border-l-2 border-blue-500' : ''}`}
                onClick={() => onSelectItem ? onSelectItem(objective.id, 'objective', objective.title) : toggleObjective(objective.id)}
                onContextMenu={(e) => openContextMenu(e, [
                  { label: 'Edit title', icon: 'edit', onClick: () => onTreeEditStart?.(objective.id, objective.title) },
                  { label: 'Add key result', icon: 'add', onClick: () => startInlineAdd('kr', objective.id) },
                  { label: 'Delete objective', icon: 'delete', destructive: true, onClick: () => onTreeDeleteRequest?.(objective.id, 'objective', objective.title, objective.id) },
                ])}
                onDragOver={onDragOver}
                onDragEnter={(e) => onDragEnterObjective(e, objective.id)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDropOnObjective(e, objective.id)}
              >
                <span onClick={(e) => { e.stopPropagation(); toggleObjective(objective.id); }} className="flex-shrink-0">
                  <ChevronDownIcon open={expandedObjectives.has(objective.id)} />
                </span>
                <div className="w-8 h-8 rounded-lg bg-brand-primary text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {objective.id}
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Objective</p>
                  {treeEditingItemId === objective.id ? (
                    <input
                      type="text"
                      value={treeEditValue}
                      onChange={(e) => onTreeEditValueChange?.(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onTreeEditSave?.(objective.id, 'objective', objective.id);
                        if (e.key === 'Escape') onTreeEditCancel?.();
                      }}
                      onBlur={() => onTreeEditSave?.(objective.id, 'objective', objective.id)}
                      className="font-semibold text-slate-800 w-full px-1 py-0.5 border border-brand-primary rounded focus:ring-2 focus:ring-brand-primary/30 outline-none"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <h4 className="font-semibold text-slate-800 truncate">{objective.title}</h4>
                  )}
                </div>
                <AlertIndicator elementKey={`objective:${objective.id}`} />
                <div className="relative opacity-0 group-hover/obj:opacity-100 transition-opacity flex-shrink-0">
                  {treeConfirmingDeleteId === objective.id ? (
                    <DeleteConfirmPopover
                      itemLabel="this objective and all its key results"
                      onConfirm={() => onTreeDeleteConfirm?.()}
                      onCancel={() => onTreeDeleteCancel?.()}
                    />
                  ) : (
                    <TreeRowMenu
                      actions={[
                        { label: 'Edit title', icon: 'edit', onClick: () => onTreeEditStart?.(objective.id, objective.title) },
                        { label: 'Add key result', icon: 'add', onClick: () => startInlineAdd('kr', objective.id) },
                        { label: 'Delete objective', icon: 'delete', destructive: true, onClick: () => onTreeDeleteRequest?.(objective.id, 'objective', objective.title, objective.id) },
                      ]}
                    />
                  )}
                </div>
              </div>

              {/* Key Results */}
              {expandedObjectives.has(objective.id) && (
                <div className="bg-slate-50/50">
                  {objective.keyResults.map((kr, krIndex) => (
                    <div key={kr.id} className="group/kr">
                      {/* KR Row */}
                      <div
                        className={`flex items-center gap-3 pl-14 pr-6 py-2.5 hover:bg-slate-100/50 cursor-pointer transition-colors ${draggedItem?.type === 'kr' && draggedItem.id === kr.id ? 'opacity-50' : ''} ${dropTarget?.type === 'kr' && dropTarget.id === kr.id ? 'ring-2 ring-amber-400 bg-amber-50/50' : ''} ${selectedItemId === kr.id ? 'bg-blue-50/70 border-l-2 border-blue-500' : ''}`}
                        onClick={() => onSelectItem ? onSelectItem(kr.id, 'keyResult', kr.title) : toggleKR(kr.id)}
                        onContextMenu={(e) => openContextMenu(e, [
                          { label: 'Edit title', icon: 'edit', onClick: () => onTreeEditStart?.(kr.id, kr.title) },
                          { label: 'Add project', icon: 'add', onClick: () => startInlineAdd('project', objective.id, kr.id) },
                          { label: 'Delete key result', icon: 'delete', destructive: true, onClick: () => onTreeDeleteRequest?.(kr.id, 'keyResult', kr.title, objective.id) },
                        ])}
                        draggable
                        onDragStart={(e) => onDragStart(e, 'kr', kr.id, objective.id)}
                        onDragEnd={onDragEnd}
                        onDragOver={onDragOver}
                        onDragEnter={(e) => onDragEnterKR(e, objective.id, kr.id)}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDropOnKR(e, objective.id, kr.id)}
                      >
                        <span className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"><DragHandleIcon /></span>
                        <span onClick={(e) => { e.stopPropagation(); toggleKR(kr.id); }} className="flex-shrink-0">
                          <ChevronDownIcon open={expandedKRs.has(kr.id)} />
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">{kr.id}</span>
                        <div className="flex-grow min-w-0">
                          {treeEditingItemId === kr.id ? (
                            <input
                              type="text"
                              value={treeEditValue}
                              onChange={(e) => onTreeEditValueChange?.(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') onTreeEditSave?.(kr.id, 'keyResult', objective.id);
                                if (e.key === 'Escape') onTreeEditCancel?.();
                              }}
                              onBlur={() => onTreeEditSave?.(kr.id, 'keyResult', objective.id)}
                              className="text-sm text-slate-700 w-full px-1 py-0.5 border border-emerald-400 rounded focus:ring-2 focus:ring-emerald-400/30 outline-none"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p className="text-sm text-slate-700 truncate">{kr.title}</p>
                          )}
                        </div>
                        <AlertIndicator elementKey={`keyResult:${kr.id}`} />
                        <div className="relative opacity-0 group-hover/kr:opacity-100 transition-opacity flex-shrink-0">
                          {treeConfirmingDeleteId === kr.id ? (
                            <DeleteConfirmPopover
                              itemLabel="this key result and its projects"
                              onConfirm={() => onTreeDeleteConfirm?.()}
                              onCancel={() => onTreeDeleteCancel?.()}
                            />
                          ) : (
                            <TreeRowMenu
                              actions={[
                                { label: 'Edit title', icon: 'edit', onClick: () => onTreeEditStart?.(kr.id, kr.title) },
                                { label: 'Add project', icon: 'add', onClick: () => startInlineAdd('project', objective.id, kr.id) },
                                { label: 'Delete key result', icon: 'delete', destructive: true, onClick: () => onTreeDeleteRequest?.(kr.id, 'keyResult', kr.title, objective.id) },
                              ]}
                            />
                          )}
                        </div>
                      </div>

                      {/* Projects (with optional DKR and Team layers) */}
                      {expandedKRs.has(kr.id) && (
                        <div className="bg-white/50">
                          {/* Departmental Key Results layer (optional) */}
                          {kr.departmentalKeyResults && kr.departmentalKeyResults.length > 0 && (
                            <>
                              {kr.departmentalKeyResults.map((dkr, dkrIndex) => (
                                <div key={dkr.id} className="group/dkr">
                                  {/* DKR Row */}
                                  <div
                                    className={`flex items-center gap-3 pl-20 pr-6 py-2 hover:bg-slate-100/50 cursor-pointer transition-colors border-l-2 ${selectedItemId === dkr.id ? 'bg-blue-50/70 border-blue-500' : 'border-amber-200'}`}
                                    onClick={() => onSelectItem ? onSelectItem(dkr.id, 'departmentalKeyResult', dkr.title) : toggleDKR(dkr.id)}
                                  >
                                    <span onClick={(e) => { e.stopPropagation(); toggleDKR(dkr.id); }} className="flex-shrink-0">
                                      <ChevronDownIcon open={expandedDKRs.has(dkr.id)} />
                                    </span>
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">{dkr.id}</span>
                                    <span className="px-1 py-px bg-brand-light text-brand-dark text-[9px] font-bold rounded uppercase tracking-tighter">
                                      {dkr.department}
                                    </span>
                                    <div className="flex-grow min-w-0">
                                      <p className="text-sm text-slate-600 truncate">{dkr.title}</p>
                                    </div>
                                    <AlertIndicator elementKey={`departmentalKeyResult:${dkr.id}`} />
                                  </div>

                                  {/* Projects under DKR */}
                                  {expandedDKRs.has(dkr.id) && (
                                    <div className="bg-white/30">
                                      {dkr.departmentalProjects?.map((proj, projIndex) => (
                                        <ProjectTreeRow
                                          key={proj.id}
                                          proj={proj}
                                          projIndex={projIndex}
                                          objective={objective}
                                          kr={kr}
                                          draggedItem={draggedItem}
                                          dropTarget={dropTarget}
                                          selectedItemId={selectedItemId}
                                          expandedProjects={expandedProjects}
                                          expandedTeams={expandedTeams}
                                          treeEditingItemId={treeEditingItemId}
                                          treeEditValue={treeEditValue}
                                          treeConfirmingDeleteId={treeConfirmingDeleteId}
                                          onSelectItem={onSelectItem}
                                          onTreeEditStart={onTreeEditStart}
                                          onTreeEditValueChange={onTreeEditValueChange}
                                          onTreeEditSave={onTreeEditSave}
                                          onTreeEditCancel={onTreeEditCancel}
                                          onTreeDeleteRequest={onTreeDeleteRequest}
                                          onTreeDeleteConfirm={onTreeDeleteConfirm}
                                          onTreeDeleteCancel={onTreeDeleteCancel}
                                          onAddHeadcount={onAddHeadcount}
                                          onDragStart={onDragStart}
                                          onDragEnd={onDragEnd}
                                          onDragOver={onDragOver}
                                          onDragEnterProject={onDragEnterProject}
                                          onDragLeave={onDragLeave}
                                          onDropOnProject={onDropOnProject}
                                          toggleProject={toggleProject}
                                          toggleTeam={toggleTeam}
                                          openContextMenu={openContextMenu}
                                          AlertIndicator={AlertIndicator}
                                          indentClass="pl-28"
                                          expandedIndentClass="pl-36"
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </>
                          )}

                          {/* Direct projects under KR (when no DKRs, or unclaimed projects) */}
                          {kr.departmentalProjects?.map((proj, projIndex) => (
                            <ProjectTreeRow
                              key={proj.id}
                              proj={proj}
                              projIndex={projIndex}
                              objective={objective}
                              kr={kr}
                              draggedItem={draggedItem}
                              dropTarget={dropTarget}
                              selectedItemId={selectedItemId}
                              expandedProjects={expandedProjects}
                              expandedTeams={expandedTeams}
                              treeEditingItemId={treeEditingItemId}
                              treeEditValue={treeEditValue}
                              treeConfirmingDeleteId={treeConfirmingDeleteId}
                              onSelectItem={onSelectItem}
                              onTreeEditStart={onTreeEditStart}
                              onTreeEditValueChange={onTreeEditValueChange}
                              onTreeEditSave={onTreeEditSave}
                              onTreeEditCancel={onTreeEditCancel}
                              onTreeDeleteRequest={onTreeDeleteRequest}
                              onTreeDeleteConfirm={onTreeDeleteConfirm}
                              onTreeDeleteCancel={onTreeDeleteCancel}
                              onAddHeadcount={onAddHeadcount}
                              onDragStart={onDragStart}
                              onDragEnd={onDragEnd}
                              onDragOver={onDragOver}
                              onDragEnterProject={onDragEnterProject}
                              onDragLeave={onDragLeave}
                              onDropOnProject={onDropOnProject}
                              toggleProject={toggleProject}
                              toggleTeam={toggleTeam}
                              openContextMenu={openContextMenu}
                              AlertIndicator={AlertIndicator}
                              indentClass="pl-24"
                              expandedIndentClass="pl-32"
                            />
                          ))}
                          {/* Inline Add Project */}
                          {inlineAdd?.type === 'project' && inlineAdd.parentKrId === kr.id && (
                            <div className="flex items-center gap-2 pl-24 pr-6 py-2 bg-blue-50/50">
                              <input
                                type="text"
                                value={inlineDept}
                                onChange={(e) => setInlineDept(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') resetInlineAdd();
                                }}
                                placeholder="Dept"
                                className="w-20 px-2 py-1 text-[11px] font-bold uppercase text-slate-700 border border-blue-300 rounded focus:ring-2 focus:ring-blue-400/30 outline-none bg-white"
                                autoFocus
                              />
                              <input
                                type="text"
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && inlineValue.trim() && inlineDept.trim()) {
                                    onCreateProject?.(objective.id, kr.id, inlineDept.trim(), inlineValue.trim());
                                    resetInlineAdd();
                                  }
                                  if (e.key === 'Escape') resetInlineAdd();
                                }}
                                placeholder="Type project title..."
                                className="flex-grow px-2 py-1 text-xs text-slate-700 border border-blue-300 rounded focus:ring-2 focus:ring-blue-400/30 outline-none bg-white"
                              />
                              <button onClick={resetInlineAdd} className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0">
                                <CloseIcon />
                              </button>
                            </div>
                          )}
                          {/* Add Project Button */}
                          <button
                            onClick={() => startInlineAdd('project', objective.id, kr.id)}
                            className="w-full text-left pl-24 pr-6 py-2 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-white font-medium flex items-center gap-2"
                          >
                            <PlusIcon /> Add Project
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Inline Add KR */}
                  {inlineAdd?.type === 'kr' && inlineAdd.parentObjId === objective.id && (
                    <div className="flex items-center gap-3 pl-14 pr-6 py-2 bg-emerald-50/50">
                      <span className="px-2 py-0.5 bg-emerald-100/50 text-emerald-500 text-[10px] font-bold rounded">KR{objective.keyResults.length + 1}</span>
                      <input
                        type="text"
                        value={inlineValue}
                        onChange={(e) => setInlineValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && inlineValue.trim()) {
                            onCreateKR?.(objective.id, inlineValue.trim());
                            resetInlineAdd();
                          }
                          if (e.key === 'Escape') resetInlineAdd();
                        }}
                        placeholder="Type key result..."
                        className="flex-grow px-2 py-1 text-sm text-slate-700 border border-emerald-300 rounded focus:ring-2 focus:ring-emerald-400/30 outline-none bg-white"
                        autoFocus
                      />
                      <button onClick={resetInlineAdd} className="p-1 text-slate-400 hover:text-slate-600">
                        <CloseIcon />
                      </button>
                    </div>
                  )}
                  {/* Add KR Button */}
                  <button
                    onClick={() => startInlineAdd('kr', objective.id)}
                    className="w-full text-left pl-14 pr-6 py-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-white font-medium flex items-center gap-2"
                  >
                    <PlusIcon /> Add Key Result
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Inline Add Objective */}
        {inlineAdd?.type === 'objective' && (
          <div className="flex items-center gap-3 px-6 py-3 bg-blue-50/50 border-t border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/50 text-white flex items-center justify-center text-xs font-bold shadow-sm">
              O{objectives.length + 1}
            </div>
            <input
              type="text"
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inlineValue.trim()) {
                  onCreateObjective?.(inlineValue.trim());
                  resetInlineAdd();
                }
                if (e.key === 'Escape') resetInlineAdd();
              }}
              placeholder="Type objective title..."
              className="flex-grow px-2 py-1 text-sm font-semibold text-slate-800 border border-brand-primary/30 rounded focus:ring-2 focus:ring-brand-primary/30 outline-none bg-white"
              autoFocus
            />
            <button onClick={resetInlineAdd} className="p-1 text-slate-400 hover:text-slate-600">
              <CloseIcon />
            </button>
          </div>
        )}
        {/* Add Objective Button */}
        <button
          onClick={() => startInlineAdd('objective')}
          className="w-full text-left px-6 py-3 text-sm text-brand-primary hover:text-brand-dark hover:bg-slate-50 font-medium flex items-center gap-2 border-t border-slate-100"
        >
          <PlusIcon /> Add Objective
        </button>

        {/* Right-click context menu */}
        {contextMenu && (
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}>
            <ActionMenuDropdown
              actions={contextMenu.actions}
              onClose={() => setContextMenu(null)}
              style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
            />
          </div>
        )}
      </div>
    );
  };

// Timeline View Component
type TimelineProjectWithContext = { project: DepartmentalProject; objective: Objective; keyResult: KeyResult };

const TimelineView: React.FC<{
  objectives: Objective[];
  getProjectResourceStatus: (project: DepartmentalProject) => { status: 'ok' | 'under' | 'over' | 'critical'; message: string };
  highlightKR?: { krId: string; deadline: string } | null;
  onClearHighlight?: () => void;
  onSelectProject?: (id: string, label: string) => void;
  selectedProjectId?: string | null;
}> = ({ objectives, getProjectResourceStatus, highlightKR, onClearHighlight, onSelectProject, selectedProjectId }) => {
  const [timeScope, setTimeScope] = useState<'year' | 'quarter' | 'month'>('year');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));

  // Get all projects with their context (including DKR-nested projects)
  const allProjectsWithContext = React.useMemo((): TimelineProjectWithContext[] => {
    const projects: TimelineProjectWithContext[] = [];
    objectives.forEach(obj => {
      obj.keyResults.forEach(kr => {
        const seen = new Set<string>();
        const addProj = (proj: DepartmentalProject) => {
          if (proj.startDate && proj.endDate && !seen.has(proj.id)) {
            seen.add(proj.id);
            projects.push({ project: proj, objective: obj, keyResult: kr });
          }
        };
        kr.departmentalProjects?.forEach(addProj);
        kr.departmentalKeyResults?.forEach(dkr => {
          dkr.departmentalProjects?.forEach(addProj);
        });
      });
    });
    return projects.sort((a, b) =>
      new Date(a.project.startDate!).getTime() - new Date(b.project.startDate!).getTime()
    );
  }, [objectives]);

  // Generate time periods based on scope
  const timePeriods = React.useMemo(() => {
    const periods: { key: string; label: string; startDate: Date; endDate: Date }[] = [];

    if (timeScope === 'year') {
      // Show all 4 quarters of the selected year
      for (let q = 1; q <= 4; q++) {
        const startMonth = (q - 1) * 3;
        periods.push({
          key: `${selectedYear}-Q${q}`,
          label: `Q${q}`,
          startDate: new Date(selectedYear, startMonth, 1),
          endDate: new Date(selectedYear, startMonth + 3, 0)
        });
      }
    } else if (timeScope === 'quarter') {
      // Show 3 months of the selected quarter
      const startMonth = (selectedQuarter - 1) * 3;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let m = 0; m < 3; m++) {
        const monthIndex = startMonth + m;
        periods.push({
          key: `${selectedYear}-${monthIndex + 1}`,
          label: monthNames[monthIndex],
          startDate: new Date(selectedYear, monthIndex, 1),
          endDate: new Date(selectedYear, monthIndex + 1, 0)
        });
      }
    } else {
      // Month view - show weeks
      const startMonth = (selectedQuarter - 1) * 3;
      const monthStart = new Date(selectedYear, startMonth, 1);
      const monthEnd = new Date(selectedYear, startMonth + 1, 0);
      let weekStart = new Date(monthStart);
      let weekNum = 1;

      while (weekStart <= monthEnd) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());

        periods.push({
          key: `week-${weekNum}`,
          label: `W${weekNum}`,
          startDate: new Date(weekStart),
          endDate: new Date(weekEnd)
        });

        weekStart.setDate(weekStart.getDate() + 7);
        weekNum++;
      }
    }

    return periods;
  }, [timeScope, selectedYear, selectedQuarter]);

  // Calculate position and width for a project bar
  const getProjectBarStyle = (project: DepartmentalProject) => {
    if (!project.startDate || !project.endDate || timePeriods.length === 0) {
      return { left: '0%', width: '0%', visible: false };
    }

    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    const timelineStart = timePeriods[0].startDate;
    const timelineEnd = timePeriods[timePeriods.length - 1].endDate;

    // Check if project overlaps with timeline
    if (projectEnd < timelineStart || projectStart > timelineEnd) {
      return { left: '0%', width: '0%', visible: false };
    }

    const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);

    const clampedStart = projectStart < timelineStart ? timelineStart : projectStart;
    const clampedEnd = projectEnd > timelineEnd ? timelineEnd : projectEnd;

    const startOffset = (clampedStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    const duration = (clampedEnd.getTime() - clampedStart.getTime()) / (1000 * 60 * 60 * 24);

    const left = (startOffset / totalDays) * 100;
    const width = Math.max(2, (duration / totalDays) * 100);

    return { left: `${left}%`, width: `${width}%`, visible: true };
  };

  // Parse timePeriod text (e.g. "Q4 2026") into an end-of-quarter date
  const parseTimePeriodEnd = (timePeriod?: string): Date | null => {
    if (!timePeriod) return null;
    const match = timePeriod.match(/^Q([1-4])\s*(\d{4})$/);
    if (!match) return null;
    const quarter = parseInt(match[1]);
    const year = parseInt(match[2]);
    const endMonth = quarter * 3; // Q1→3, Q2→6, Q3→9, Q4→12
    return new Date(year, endMonth, 0); // last day of end month
  };

  // Calculate bar style for a generic date range
  const getDateRangeBarStyle = (start: Date, end: Date) => {
    if (timePeriods.length === 0) return { left: '0%', width: '0%', visible: false };
    const timelineStart = timePeriods[0].startDate;
    const timelineEnd = timePeriods[timePeriods.length - 1].endDate;
    if (end < timelineStart || start > timelineEnd) {
      return { left: '0%', width: '0%', visible: false };
    }
    const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    const clampedStart = start < timelineStart ? timelineStart : start;
    const clampedEnd = end > timelineEnd ? timelineEnd : end;
    const startOffset = (clampedStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    const duration = (clampedEnd.getTime() - clampedStart.getTime()) / (1000 * 60 * 60 * 24);
    const left = (startOffset / totalDays) * 100;
    const width = Math.max(1, (duration / totalDays) * 100);
    return { left: `${left}%`, width: `${width}%`, visible: true };
  };

  // Get earliest startDate from a list of projects
  const getEarliestProjectStart = (projects: DepartmentalProject[]): Date | null => {
    let earliest: Date | null = null;
    for (const p of projects) {
      if (p.startDate) {
        const d = new Date(p.startDate);
        if (!earliest || d < earliest) earliest = d;
      }
    }
    return earliest;
  };

  // Calculate position for the KR deadline marker
  const getDeadlineMarkerPosition = React.useCallback((deadlineDate: string): { left: string; visible: boolean } | null => {
    if (!deadlineDate || timePeriods.length === 0) return null;

    const deadline = new Date(deadlineDate);
    const timelineStart = timePeriods[0].startDate;
    const timelineEnd = timePeriods[timePeriods.length - 1].endDate;

    // Check if deadline is within the visible timeline
    if (deadline < timelineStart || deadline > timelineEnd) {
      return { left: '0%', visible: false };
    }

    const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    const deadlineOffset = (deadline.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    const left = (deadlineOffset / totalDays) * 100;

    return { left: `${left}%`, visible: true };
  }, [timePeriods]);

  // Get the KR title for the highlighted deadline
  const highlightedKRTitle = React.useMemo(() => {
    if (!highlightKR) return null;
    for (const obj of objectives) {
      for (const kr of obj.keyResults) {
        if (kr.id === highlightKR.krId) {
          return kr.title;
        }
      }
    }
    return null;
  }, [highlightKR, objectives]);

  // Calculate deadline marker position
  const deadlineMarkerPos = highlightKR?.deadline ? getDeadlineMarkerPosition(highlightKR.deadline) : null;

  // Objective colors for timeline bars
  const objectiveColorMap = React.useMemo((): Record<string, string> => {
    const map: Record<string, string> = {};
    objectives.forEach((obj, idx) => {
      map[obj.id] = TIMELINE_OBJECTIVE_COLORS[idx % TIMELINE_OBJECTIVE_COLORS.length];
    });
    return map;
  }, [objectives]);

  const getObjectiveColor = (objectiveId: string) => {
    return objectiveColorMap[objectiveId] || 'bg-slate-500';
  };

  // Hex color map for inline styles (summary bars need opacity control)
  const objectiveHexMap = React.useMemo((): Record<string, string> => {
    const map: Record<string, string> = {};
    objectives.forEach((obj, idx) => {
      map[obj.id] = TIMELINE_OBJECTIVE_HEX[idx % TIMELINE_OBJECTIVE_HEX.length];
    });
    return map;
  }, [objectives]);

  const getObjectiveHex = (objectiveId: string) => {
    return objectiveHexMap[objectiveId] || '#64748b';
  };

  // Group projects by Objective → Key Result
  type ObjectiveGroup = {
    objective: Objective;
    keyResultGroups: { keyResult: KeyResult; projects: TimelineProjectWithContext[] }[];
  };

  const projectsByObjective = React.useMemo((): ObjectiveGroup[] => {
    const groups: ObjectiveGroup[] = [];
    objectives.forEach(obj => {
      const krGroups: { keyResult: KeyResult; projects: TimelineProjectWithContext[] }[] = [];
      obj.keyResults.forEach(kr => {
        const projects = allProjectsWithContext.filter(
          item => item.objective.id === obj.id && item.keyResult.id === kr.id
        );
        if (projects.length > 0) {
          krGroups.push({ keyResult: kr, projects });
        }
      });
      if (krGroups.length > 0) {
        groups.push({ objective: obj, keyResultGroups: krGroups });
      }
    });
    return groups;
  }, [objectives, allProjectsWithContext]);

  const years = [2024, 2025, 2026, 2027];
  const quarters = [1, 2, 3, 4];

  return (
    <div className="flex gap-6">
      {/* Main Timeline Area */}
      <div className="space-y-6 w-full">

      {/* Assessment Navigation Filter Banner */}
      {highlightKR && highlightedKRTitle && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">
                Showing KR deadline: {highlightedKRTitle}
              </p>
              <p className="text-xs text-amber-600">
                Target date: {new Date(highlightKR.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {deadlineMarkerPos && !deadlineMarkerPos.visible && ' (not in current view - adjust time period)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClearHighlight}
            className="text-amber-600 hover:text-amber-800 text-xs font-medium hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Timeline Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">View:</label>
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setTimeScope('year')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${timeScope === 'year' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-600'
                }`}
            >
              Fiscal Year
            </button>
            <button
              onClick={() => setTimeScope('quarter')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${timeScope === 'quarter' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-600'
                }`}
            >
              Quarter
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
          >
            {years.map(y => (
              <option key={y} value={y}>FY {y}</option>
            ))}
          </select>
        </div>

        {timeScope !== 'year' && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Quarter:</label>
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(Number(e.target.value))}
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
            >
              {quarters.map(q => (
                <option key={q} value={q}>Q{q}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1" />

        <div className="text-xs text-slate-500">
          {allProjectsWithContext.filter(p => getProjectBarStyle(p.project).visible).length} of {allProjectsWithContext.length} projects in view
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden relative">
        {/* KR Deadline Marker - spans entire grid height */}
        {deadlineMarkerPos && deadlineMarkerPos.visible && (
          <div
            className="absolute top-0 bottom-0 z-20 pointer-events-none flex"
            style={{
              left: '12rem',
              right: 0,
            }}
          >
            <div
              className="absolute top-0 bottom-0"
              style={{ left: deadlineMarkerPos.left }}
            >
              {/* Vertical line */}
              <div className="absolute inset-y-0 w-0.5 bg-amber-500 shadow-sm -translate-x-1/2" />
              {/* Top label */}
              <div className="absolute top-1 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                KR Deadline
              </div>
              {/* Diamond marker at the header/body junction */}
              <div className="absolute top-10 -translate-x-1/2 w-2 h-2 bg-amber-500 rotate-45 shadow-sm" />
            </div>
          </div>
        )}

        {/* Timeline Header */}
        <div className="flex border-b border-slate-200">
          <div className="w-48 flex-shrink-0 px-4 py-3 bg-slate-50 border-r border-slate-200">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Objective / KR / Project</span>
          </div>
          <div className="flex-1 flex relative">
            {timePeriods.map((period, idx) => (
              <div
                key={period.key}
                className={`flex-1 px-2 py-3 text-center border-r border-slate-100 last:border-r-0 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'
                  }`}
              >
                <span className="text-xs font-bold text-slate-600">{period.label}</span>
                {timeScope === 'year' && (
                  <p className="text-[10px] text-slate-400">{selectedYear}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Body */}
        <div className="divide-y divide-slate-100">
          {projectsByObjective.map(({ objective, keyResultGroups }) => (
            <div key={objective.id}>
              {/* Objective Header */}
              <div className="flex items-center bg-slate-50/80">
                <div className="w-48 flex-shrink-0 px-4 py-2 border-r border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${getObjectiveColor(objective.id)}`}></div>
                    <span className="text-xs font-bold text-slate-700 truncate" title={objective.title}>
                      {objective.title}
                    </span>
                  </div>
                </div>
                {(() => {
                  const allProjects = keyResultGroups.flatMap(g => g.projects.map(p => p.project));
                  const earliest = getEarliestProjectStart(allProjects);
                  const periodEnd = parseTimePeriodEnd(objective.timePeriod);
                  const objBar = earliest && periodEnd ? getDateRangeBarStyle(earliest, periodEnd) : null;
                  const hexColor = getObjectiveHex(objective.id);
                  return (
                    <div className="flex-1 h-10 relative">
                      <div className="absolute inset-0 flex">
                        {timePeriods.map((period, idx) => (
                          <div
                            key={period.key}
                            className={`flex-1 border-r border-slate-100 last:border-r-0 ${idx % 2 === 0 ? 'bg-slate-50/30' : ''}`}
                          />
                        ))}
                      </div>
                      {objBar?.visible && (
                        <>
                          {/* Summary line */}
                          <div
                            className="absolute top-[19px] h-[2px] rounded-full"
                            style={{ left: objBar.left, width: objBar.width, backgroundColor: hexColor, opacity: 0.35 }}
                          />
                          {/* Diamond end marker */}
                          <div
                            className="absolute top-[13px]"
                            style={{ left: objBar.left, marginLeft: `calc(${objBar.width} - 6px)` }}
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12">
                              <rect x="6" y="0" width="7" height="7" rx="1.5" transform="rotate(45 6 0)" fill={hexColor} opacity={0.5} stroke={hexColor} strokeWidth="1" />
                            </svg>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Key Result Groups */}
              {keyResultGroups.map(({ keyResult, projects }) => (
                <div key={keyResult.id}>
                  {/* Key Result Sub-header */}
                  <div className="flex items-center bg-slate-50/30">
                    <div className="w-48 flex-shrink-0 px-4 py-1.5 border-r border-slate-200 pl-8">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${getObjectiveColor(objective.id)} opacity-60`}></div>
                        <span className="text-[11px] font-semibold text-slate-600 truncate" title={keyResult.title}>
                          {keyResult.title}
                        </span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">({projects.length})</span>
                      </div>
                    </div>
                    {(() => {
                      const krProjects = projects.map(p => p.project);
                      const earliest = getEarliestProjectStart(krProjects);
                      const krEnd = keyResult.targetDate ? new Date(keyResult.targetDate) : null;
                      const krBar = earliest && krEnd ? getDateRangeBarStyle(earliest, krEnd) : null;
                      const hexColor = getObjectiveHex(objective.id);
                      return (
                        <div className="flex-1 h-8 relative">
                          <div className="absolute inset-0 flex">
                            {timePeriods.map((period, idx) => (
                              <div
                                key={period.key}
                                className={`flex-1 border-r border-slate-100 last:border-r-0 ${idx % 2 === 0 ? 'bg-slate-50/20' : ''}`}
                              />
                            ))}
                          </div>
                          {krBar?.visible && (
                            <>
                              {/* Summary line */}
                              <div
                                className="absolute top-[15px] h-[2px] rounded-full"
                                style={{ left: krBar.left, width: krBar.width, backgroundColor: hexColor, opacity: 0.2 }}
                              />
                              {/* Circle end marker at targetDate */}
                              <div
                                className="absolute top-[11px]"
                                style={{ left: krBar.left, marginLeft: `calc(${krBar.width} - 5px)` }}
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10">
                                  <circle cx="5" cy="5" r="4" fill="none" stroke={hexColor} strokeWidth="1.5" opacity={0.5} />
                                </svg>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Projects under this KR */}
                  {projects.map(({ project, objective: obj, keyResult: kr }) => {
                    const barStyle = getProjectBarStyle(project);
                    if (!barStyle.visible) return null;
                    const isSelected = selectedProjectId === project.id;

                    return (
                      <div
                        key={project.id}
                        className={`flex items-center hover:bg-slate-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
                        onClick={() => onSelectProject?.(project.id, project.title)}
                      >
                        <div className="w-48 flex-shrink-0 px-4 py-2 border-r border-slate-200 pl-12">
                          <p className={`text-xs font-medium truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`} title={project.title}>
                            {project.title}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {project.department}
                          </p>
                        </div>
                        <div className="flex-1 h-10 relative">
                          {/* Grid lines */}
                          <div className="absolute inset-0 flex">
                            {timePeriods.map((period, idx) => (
                              <div
                                key={period.key}
                                className={`flex-1 border-r border-slate-100 last:border-r-0 ${idx % 2 === 0 ? 'bg-slate-50/30' : ''}`}
                              />
                            ))}
                          </div>
                          {/* Project bar */}
                          <div
                            className={`absolute top-2 h-6 ${getObjectiveColor(obj.id)} rounded-md shadow-sm flex items-center px-2 cursor-pointer hover:opacity-90 transition-opacity ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                            style={{ left: barStyle.left, width: barStyle.width, minWidth: '20px' }}
                            title={`${project.title}\n${project.department}\n${project.startDate} → ${project.endDate}\n${project.headcount?.length || 0} team members`}
                          >
                            <span className="text-[9px] text-white font-medium truncate">
                              {project.title}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {allProjectsWithContext.length === 0 && (
          <div className="p-12 text-center">
            <TimelineIcon />
            <p className="text-slate-500 mt-4">No projects with timeframes to display</p>
            <p className="text-slate-400 text-sm mt-1">Add start and end dates to projects to see them on the timeline</p>
          </div>
        )}

        {allProjectsWithContext.length > 0 && allProjectsWithContext.filter(p => getProjectBarStyle(p.project).visible).length === 0 && (
          <div className="p-8 text-center border-t border-slate-100">
            <p className="text-slate-500 text-sm">No projects scheduled in this time period</p>
            <p className="text-slate-400 text-xs mt-1">Try selecting a different year or quarter</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Objectives</p>
        <div className="flex flex-wrap gap-3">
          {projectsByObjective.map(({ objective }) => (
            <div key={objective.id} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${getObjectiveColor(objective.id)}`}></div>
              <span className="text-xs text-slate-600">{objective.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    </div>
  );
};

// Strategy Map View Component - Progressive disclosure with neighborhood focus
type StrategyMapElementType = 'objective' | 'keyResult' | 'departmentalKeyResult' | 'project' | 'team' | 'person';
interface StrategyMapPathEntry { id: string; type: StrategyMapElementType; label: string }

const StrategyMapView: React.FC<{
  objectives: Objective[];
  filteredObjectives: Objective[];
  getProjectResourceStatus: (project: DepartmentalProject) => { status: 'ok' | 'under' | 'over' | 'critical'; message: string };
  companyName?: string;
  dependencies?: Dependency[];
  deptFilter: string;
  setDeptFilter: (v: string) => void;
  personFilter: string;
  setPersonFilter: (v: string) => void;
  allDepartments: string[];
  allPeople: { name: string }[];
  getElementAlerts?: (data: DetailData | null) => AssessmentAlert[];
  onApplyAction?: (alert: AssessmentAlert, action: SuggestedAction) => void;
  onDismissAlert?: (alertId: string) => void;
  cascadedAlertsByElement?: Map<string, CascadedAlertSummary>;
  getChildIssues?: (data: DetailData | null) => ChildIssueSummary[];
  showAlertOverlay?: boolean;
  personnel?: Personnel[];
  onUpdatePersonnel?: (id: string, updates: Partial<Personnel>) => void;
  onAddHeadcount?: (objId: string, krId: string, projectId: string, name: string, role: string, allocation?: string) => void;
  onAddPersonnelToProject?: (objId: string, krId: string, projectId: string, person: Personnel) => void;
  onUpdateProject?: (objId: string, krId: string, projectId: string, updates: Partial<DepartmentalProject>) => void;
  onUpdateTeam?: (objId: string, krId: string, projectId: string, teamId: string, updates: Partial<Team>) => void;
  onUpdateKeyResult?: (objId: string, krId: string, updates: Partial<KeyResult>) => void;
  onUpdateDepartmentalKeyResult?: (objId: string, krId: string, dkrId: string, updates: Partial<DepartmentalKeyResult>) => void;
  onUpdateObjective?: (objId: string, updates: Partial<Objective>) => void;
  onDeleteObjective?: (objId: string) => void;
  onDeleteKeyResult?: (objId: string, krId: string) => void;
  onDeleteProject?: (objId: string, krId: string, projectId: string) => void;
  onAddKeyResult?: (objId: string, title: string) => void;
  onAddProject?: (objId: string, krId: string, title: string) => void;
}> = ({ objectives, filteredObjectives, getProjectResourceStatus, companyName = 'Strategy', dependencies = [], deptFilter, setDeptFilter, personFilter, setPersonFilter, allDepartments, allPeople, getElementAlerts, onApplyAction, onDismissAlert, cascadedAlertsByElement, getChildIssues, showAlertOverlay, personnel = [], onUpdatePersonnel, onAddHeadcount, onAddPersonnelToProject, onUpdateProject, onUpdateTeam, onUpdateKeyResult, onUpdateDepartmentalKeyResult, onUpdateObjective, onDeleteObjective, onDeleteKeyResult, onDeleteProject, onAddKeyResult, onAddProject }) => {
  const [canvasPosition, setCanvasPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [explorationPath, setExplorationPath] = useState<StrategyMapPathEntry[]>([]);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Compute the neighborhood for current exploration target
  const currentTarget = explorationPath.length > 0 ? explorationPath[explorationPath.length - 1] : null;
  const isExploring = currentTarget !== null;

  // Build neighborhood data: what to show + connections + computed positions
  // Uses filteredObjectives so exploration respects department/person filters
  const neighborhood = useMemo(() => {
    if (!currentTarget) return null;

    type LayoutItem = { id: string; type: StrategyMapElementType; column: number; row: number };
    const items: LayoutItem[] = [];
    const connections: Array<{ fromId: string; toId: string; color: string; label: string }> = [];

    // Detect which optional layers exist in the data
    const hasDKRs = filteredObjectives.some(o => o.keyResults.some(kr => kr.departmentalKeyResults && kr.departmentalKeyResults.length > 0));
    const hasTeams = filteredObjectives.some(o => o.keyResults.some(kr => {
      const allProjs = [...(kr.departmentalProjects || []), ...(kr.departmentalKeyResults || []).flatMap(d => d.departmentalProjects || [])];
      return allProjs.some(p => p.teams && p.teams.length > 0);
    }));

    // Dynamic column indices
    const COL_OBJ = 0;
    const COL_KR = 1;
    const COL_DKR = hasDKRs ? 2 : -1;
    const COL_PROJ = hasDKRs ? 3 : 2;
    const COL_TEAM = hasTeams ? (COL_PROJ + 1) : -1;
    const COL_PERSON = (hasTeams ? COL_TEAM : COL_PROJ) + 1;

    // Helpers to add items/connections without duplicates
    const addItem = (id: string, type: StrategyMapElementType, column: number) => {
      if (!items.find(it => it.id === id)) {
        items.push({ id, type, column, row: items.filter(it => it.column === column).length });
      }
    };
    const addConn = (fromId: string, toId: string, color: string) => {
      if (!connections.find(c => c.fromId === fromId && c.toId === toId)) {
        connections.push({ fromId, toId, color, label: '' });
      }
    };

    // Helper: add projects + teams + people for a project
    const addProjectChain = (proj: DepartmentalProject, parentId: string, parentToProjectColor: string) => {
      addItem(proj.id, 'project', COL_PROJ);
      addConn(parentId, proj.id, parentToProjectColor);

      if (hasTeams && proj.teams && proj.teams.length > 0) {
        proj.teams.forEach(team => {
          addItem(team.id, 'team', COL_TEAM);
          addConn(proj.id, team.id, '#7c3aed');
          team.members?.forEach(m => {
            addItem(m.id, 'person', COL_PERSON);
            addConn(team.id, m.id, '#0d9488');
          });
        });
        // People not in any team
        const teamMemberIds = new Set((proj.teams || []).flatMap(t => (t.members || []).map(m => m.id)));
        proj.headcount?.forEach(hc => {
          if (!teamMemberIds.has(hc.id)) {
            addItem(hc.id, 'person', COL_PERSON);
            addConn(proj.id, hc.id, '#0d9488');
          }
        });
      } else {
        proj.headcount?.forEach(hc => {
          addItem(hc.id, 'person', COL_PERSON);
          addConn(proj.id, hc.id, '#0d9488');
        });
      }
    };

    // Helper: add KR children (DKRs or direct projects)
    const addKRChildren = (kr: KeyResult) => {
      if (hasDKRs && kr.departmentalKeyResults && kr.departmentalKeyResults.length > 0) {
        kr.departmentalKeyResults.forEach(dkr => {
          addItem(dkr.id, 'departmentalKeyResult', COL_DKR);
          addConn(kr.id, dkr.id, '#d97706');
          dkr.departmentalProjects?.forEach(proj => addProjectChain(proj, dkr.id, '#6366f1'));
        });
        // Unclaimed direct projects still connect to KR
        kr.departmentalProjects?.forEach(proj => addProjectChain(proj, kr.id, '#6366f1'));
      } else {
        kr.departmentalProjects?.forEach(proj => addProjectChain(proj, kr.id, '#6366f1'));
      }
    };

    if (currentTarget.type === 'objective') {
      const obj = filteredObjectives.find(o => o.id === currentTarget.id);
      if (!obj) return null;
      addItem(obj.id, 'objective', COL_OBJ);
      obj.keyResults.forEach((kr) => {
        addItem(kr.id, 'keyResult', COL_KR);
        addConn(obj.id, kr.id, '#3b82f6');
        addKRChildren(kr);
      });
    } else if (currentTarget.type === 'keyResult') {
      for (const obj of filteredObjectives) {
        const kr = obj.keyResults.find(k => k.id === currentTarget.id);
        if (kr) {
          addItem(obj.id, 'objective', COL_OBJ);
          addItem(kr.id, 'keyResult', COL_KR);
          addConn(obj.id, kr.id, '#3b82f6');
          addKRChildren(kr);
          break;
        }
      }
    } else if (currentTarget.type === 'departmentalKeyResult') {
      for (const obj of filteredObjectives) {
        for (const kr of obj.keyResults) {
          const dkr = kr.departmentalKeyResults?.find(d => d.id === currentTarget.id);
          if (dkr) {
            addItem(obj.id, 'objective', COL_OBJ);
            addItem(kr.id, 'keyResult', COL_KR);
            addConn(obj.id, kr.id, '#3b82f6');
            addItem(dkr.id, 'departmentalKeyResult', COL_DKR >= 0 ? COL_DKR : 2);
            addConn(kr.id, dkr.id, '#d97706');
            dkr.departmentalProjects?.forEach(proj => addProjectChain(proj, dkr.id, '#6366f1'));
            break;
          }
        }
      }
    } else if (currentTarget.type === 'project') {
      // Search both direct and DKR-nested projects
      for (const obj of filteredObjectives) {
        for (const kr of obj.keyResults) {
          const directProj = kr.departmentalProjects?.find(p => p.id === currentTarget.id);
          if (directProj) {
            addItem(obj.id, 'objective', COL_OBJ);
            addItem(kr.id, 'keyResult', COL_KR);
            addConn(obj.id, kr.id, '#3b82f6');
            addProjectChain(directProj, kr.id, '#6366f1');
            break;
          }
          for (const dkr of kr.departmentalKeyResults || []) {
            const dkrProj = dkr.departmentalProjects?.find(p => p.id === currentTarget.id);
            if (dkrProj) {
              addItem(obj.id, 'objective', COL_OBJ);
              addItem(kr.id, 'keyResult', COL_KR);
              addConn(obj.id, kr.id, '#3b82f6');
              addItem(dkr.id, 'departmentalKeyResult', COL_DKR >= 0 ? COL_DKR : 2);
              addConn(kr.id, dkr.id, '#d97706');
              addProjectChain(dkrProj, dkr.id, '#6366f1');
              break;
            }
          }
        }
      }
    } else if (currentTarget.type === 'team') {
      for (const obj of filteredObjectives) {
        for (const kr of obj.keyResults) {
          const allProjs = [...(kr.departmentalProjects || []), ...(kr.departmentalKeyResults || []).flatMap(d => d.departmentalProjects || [])];
          for (const proj of allProjs) {
            const team = proj.teams?.find(t => t.id === currentTarget.id);
            if (team) {
              addItem(obj.id, 'objective', COL_OBJ);
              addItem(kr.id, 'keyResult', COL_KR);
              addConn(obj.id, kr.id, '#3b82f6');
              // Find DKR parent if any
              const parentDkr = kr.departmentalKeyResults?.find(d => d.departmentalProjects?.some(p => p.id === proj.id));
              if (parentDkr) {
                addItem(parentDkr.id, 'departmentalKeyResult', COL_DKR >= 0 ? COL_DKR : 2);
                addConn(kr.id, parentDkr.id, '#d97706');
                addItem(proj.id, 'project', COL_PROJ);
                addConn(parentDkr.id, proj.id, '#6366f1');
              } else {
                addItem(proj.id, 'project', COL_PROJ);
                addConn(kr.id, proj.id, '#6366f1');
              }
              addItem(team.id, 'team', COL_TEAM >= 0 ? COL_TEAM : COL_PROJ + 1);
              addConn(proj.id, team.id, '#7c3aed');
              team.members?.forEach(m => {
                addItem(m.id, 'person', COL_PERSON);
                addConn(team.id, m.id, '#0d9488');
              });
              break;
            }
          }
        }
      }
    } else if (currentTarget.type === 'person') {
      // Find all projects this person is on, walk up (search both direct and DKR-nested)
      type PersonContext = { proj: DepartmentalProject; kr: KeyResult; obj: Objective; dkr?: DepartmentalKeyResult };
      const personProjects: PersonContext[] = [];
      for (const obj of filteredObjectives) {
        for (const kr of obj.keyResults) {
          for (const proj of kr.departmentalProjects || []) {
            if (proj.headcount?.some(hc => hc.id === currentTarget.id) ||
                proj.teams?.some(t => t.members?.some(m => m.id === currentTarget.id))) {
              personProjects.push({ proj, kr, obj });
            }
          }
          for (const dkr of kr.departmentalKeyResults || []) {
            for (const proj of dkr.departmentalProjects || []) {
              if (proj.headcount?.some(hc => hc.id === currentTarget.id) ||
                  proj.teams?.some(t => t.members?.some(m => m.id === currentTarget.id))) {
                personProjects.push({ proj, kr, obj, dkr });
              }
            }
          }
        }
      }
      addItem(currentTarget.id, 'person', COL_PERSON);

      personProjects.forEach(({ proj, kr, obj, dkr }) => {
        // Check if person is in a team on this project
        const personTeam = proj.teams?.find(t => t.members?.some(m => m.id === currentTarget.id));
        if (personTeam && COL_TEAM >= 0) {
          addItem(personTeam.id, 'team', COL_TEAM);
          addConn(personTeam.id, currentTarget.id, '#0d9488');
          addItem(proj.id, 'project', COL_PROJ);
          addConn(proj.id, personTeam.id, '#7c3aed');
        } else {
          addItem(proj.id, 'project', COL_PROJ);
          addConn(proj.id, currentTarget.id, '#0d9488');
        }
        if (dkr && COL_DKR >= 0) {
          addItem(dkr.id, 'departmentalKeyResult', COL_DKR);
          addConn(dkr.id, proj.id, '#6366f1');
          addItem(kr.id, 'keyResult', COL_KR);
          addConn(kr.id, dkr.id, '#d97706');
        } else {
          addItem(kr.id, 'keyResult', COL_KR);
          addConn(kr.id, proj.id, '#6366f1');
        }
        addItem(obj.id, 'objective', COL_OBJ);
        addConn(obj.id, kr.id, '#3b82f6');
      });
    }

    // Compute positions: columns are 290px apart, row heights vary by card type
    const COL_WIDTH = 290;
    const CARD_W = 250;
    const positions = new Map<string, { x: number; y: number; w: number; h: number }>();

    // Different card types have different heights
    const getCardHeight = (type: StrategyMapElementType) => {
      switch (type) {
        case 'objective': return 110;
        case 'keyResult': return 135;
        case 'departmentalKeyResult': return 120;
        case 'project': return 160;
        case 'team': return 100;
        case 'person': return 90;
        default: return 110;
      }
    };

    // Calculate row spacing per column based on actual card heights + gap
    const GAP = 16;

    // Group items by column and calculate cumulative Y positions
    const columnItems: Record<number, typeof items> = {};
    items.forEach(it => {
      if (!columnItems[it.column]) columnItems[it.column] = [];
      columnItems[it.column].push(it);
    });

    // Sort items within each column by row index
    Object.values(columnItems).forEach(colItems => {
      colItems.sort((a, b) => a.row - b.row);
    });

    // Calculate total height per column for vertical centering
    const columnHeights: Record<number, number> = {};
    Object.entries(columnItems).forEach(([col, colItems]) => {
      columnHeights[Number(col)] = colItems.reduce((sum, it) => sum + getCardHeight(it.type) + GAP, 0) - GAP;
    });
    const maxColumnHeight = Math.max(...Object.values(columnHeights), 0);

    // Position items with cumulative Y based on actual card heights
    Object.entries(columnItems).forEach(([col, colItems]) => {
      const colNum = Number(col);
      const colHeight = columnHeights[colNum];
      const colOffset = (maxColumnHeight - colHeight) / 2;

      let currentY = colOffset;
      colItems.forEach(it => {
        const cardHeight = getCardHeight(it.type);
        positions.set(it.id, {
          x: colNum * COL_WIDTH,
          y: currentY,
          w: it.type === 'person' ? 220 : CARD_W,
          h: cardHeight,
        });
        currentY += cardHeight + GAP;
      });
    });

    return { items, connections, positions };
  }, [currentTarget, filteredObjectives, dependencies]);

  // Auto-center when exploration changes
  useEffect(() => {
    if (!canvasRef.current) return;
    if (isExploring && neighborhood) {
      const rect = canvasRef.current.getBoundingClientRect();
      // Calculate center of neighborhood content
      let minX = Infinity, maxX = 0, minY = Infinity, maxY = 0;
      neighborhood.positions.forEach(pos => {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x + pos.w);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y + pos.h);
      });
      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const newX = (rect.width / 2 - (minX + contentW / 2) * zoom);
      const newY = (rect.height / 2 - (minY + contentH / 2) * zoom);
      setCanvasPosition({ x: newX, y: newY });
    } else {
      setCanvasPosition({ x: 50, y: 50 });
    }
  }, [isExploring, neighborhood, zoom]);

  // Navigation helpers
  const navigateTo = (id: string, type: StrategyMapElementType, label: string) => {
    setExplorationPath(prev => [...prev, { id, type, label }]);
    setShowDetailPanel(true);
  };
  const navigateBack = () => {
    setExplorationPath(prev => prev.slice(0, -1));
  };
  const navigateToBreadcrumb = (index: number) => {
    setExplorationPath(prev => prev.slice(0, index + 1));
  };

  // Canvas handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.explorer-card')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - canvasPosition.x, y: e.clientY - canvasPosition.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setCanvasPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(prev => Math.min(Math.max(prev + (e.deltaY > 0 ? -0.05 : 0.05), 0.3), 1.5));
    }
  };

  // ─── Card renderers ───

  const renderObjectiveCard = (obj: Objective, oIdx: number, isFocused: boolean, isExpanded: boolean = false) => {
    const totalKRs = obj.keyResults.length;
    // Deduplicate projects by ID (a project may appear under multiple KRs)
    const uniqueProjects = new Map<string, DepartmentalProject>();
    obj.keyResults.forEach(kr => (kr.departmentalProjects || []).forEach(p => uniqueProjects.set(p.id, p)));
    const totalProjects = uniqueProjects.size;
    const fteYears = calculateObjectiveFTEYears(obj);
    const cost = calculateObjectiveCost(obj);
    const alertSummary = showAlertOverlay ? cascadedAlertsByElement?.get(`objective:${obj.id}`) : undefined;
    return (
      <div className={`explorer-card cursor-pointer bg-white rounded-xl shadow-md border transition-all duration-200 hover:shadow-lg ${
        isFocused ? 'border-blue-400 ring-2 ring-blue-200' :
        alertSummary?.totalMaxSeverity === 'critical' ? 'border-red-300 hover:-translate-y-0.5' :
        alertSummary?.totalMaxSeverity === 'warning' ? 'border-amber-300 hover:-translate-y-0.5' :
        'border-slate-200 hover:-translate-y-0.5'
      }`}>
        <div className={isExpanded ? "p-5" : "p-4"}>
          <div className={`flex ${isExpanded ? 'items-start' : 'items-center'} gap-3`}>
            <div className={`${isExpanded ? 'w-11 h-11 text-base' : 'w-9 h-9 text-sm'} rounded-lg text-white flex items-center justify-center font-bold shadow-sm ${
              alertSummary?.totalMaxSeverity === 'critical' ? 'bg-gradient-to-br from-red-500 to-red-600' :
              'bg-gradient-to-br from-blue-500 to-blue-600'
            }`}>
              {obj.id}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-slate-900 ${isExpanded ? 'text-base leading-snug line-clamp-3' : 'text-sm leading-tight line-clamp-2'}`}>{obj.title}</p>
              {isExpanded && obj.timePeriod && (
                <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 font-medium text-[11px]">
                  {obj.timePeriod}
                </span>
              )}
            </div>
            <AlertBadge count={alertSummary?.totalCount ?? 0} severity={alertSummary?.totalMaxSeverity ?? 'warning'} />
          </div>
          {isExpanded ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Key Results</p>
                <p className="text-lg font-bold text-slate-800">{totalKRs}</p>
              </div>
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Projects</p>
                <p className="text-lg font-bold text-slate-800">{totalProjects}</p>
              </div>
              {fteYears > 0 && (
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">FTE-Years</p>
                  <p className="text-lg font-bold text-slate-800">{formatFTEYears(fteYears)}</p>
                </div>
              )}
              {cost > 0 && (
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Est. Cost</p>
                  <p className="text-lg font-bold text-slate-800">{formatResourceCost(cost)}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {(obj.timePeriod || fteYears > 0 || cost > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {obj.timePeriod && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium text-[10px]">{obj.timePeriod}</span>
                  )}
                  {fteYears > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium text-[10px]">{formatFTEYears(fteYears)} FTE-yr</span>
                  )}
                  {cost > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium text-[10px]">{formatResourceCost(cost)}</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderKRCard = (kr: KeyResult, objIndex: number, krIndex: number, isFocused: boolean) => {
    const projCount = kr.departmentalProjects?.length || 0;
    const progress = kr.progress ?? 0;
    const fteYears = calculateKRFTEYears(kr);
    const cost = calculateKRCost(kr);
    const alertSummary = showAlertOverlay ? cascadedAlertsByElement?.get(`keyResult:${kr.id}`) : undefined;
    return (
      <div className={`explorer-card cursor-pointer bg-white rounded-xl shadow-md border transition-all duration-200 hover:shadow-lg ${
        isFocused ? 'border-emerald-400 ring-2 ring-emerald-200' :
        alertSummary?.totalMaxSeverity === 'critical' ? 'border-red-300 hover:-translate-y-0.5' :
        alertSummary?.totalMaxSeverity === 'warning' ? 'border-amber-300 hover:-translate-y-0.5' :
        'border-slate-200 hover:-translate-y-0.5'
      }`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">{kr.id}</span>
            <AlertBadge count={alertSummary?.totalCount ?? 0} severity={alertSummary?.totalMaxSeverity ?? 'warning'} className="ml-auto" />
          </div>
          <p className="font-medium text-slate-800 text-sm leading-tight line-clamp-2">{kr.title}</p>
          {(kr.targetDate || fteYears > 0 || cost > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {kr.targetDate && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium text-[10px]">
                  {new Date(kr.targetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              )}
              {fteYears > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium text-[10px]">{formatFTEYears(fteYears)} FTE-yr</span>
              )}
              {cost > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium text-[10px]">{formatResourceCost(cost)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProjectCard = (proj: DepartmentalProject, isFocused: boolean) => {
    const deptStyle = getDepartmentStyle(proj.department);
    const teamCount = proj.headcount?.length || 0;
    const fteYears = calculateProjectFTEYears(proj);
    const cost = calculateProjectCost(proj);
    const alertSummary = showAlertOverlay ? cascadedAlertsByElement?.get(`project:${proj.id}`) : undefined;
    return (
      <div className={`explorer-card cursor-pointer bg-white rounded-xl shadow-md border transition-all duration-200 hover:shadow-lg ${
        isFocused ? 'border-indigo-400 ring-2 ring-indigo-200' :
        alertSummary?.totalMaxSeverity === 'critical' ? 'border-red-300 hover:-translate-y-0.5' :
        alertSummary?.totalMaxSeverity === 'warning' ? 'border-amber-300 hover:-translate-y-0.5' :
        `${deptStyle.border} hover:-translate-y-0.5`
      }`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-5 h-5 rounded ${deptStyle.bg} flex items-center justify-center`}>
              <span className="text-[8px] font-bold text-white">{proj.department.charAt(0)}</span>
            </div>
            <span className={`text-[10px] font-semibold ${deptStyle.text}`}>{proj.department}</span>
            <AlertBadge count={alertSummary?.totalCount ?? 0} severity={alertSummary?.totalMaxSeverity ?? 'warning'} className="ml-auto" />
          </div>
          <p className="font-medium text-slate-800 text-sm leading-tight line-clamp-2">{proj.title}</p>
          {proj.startDate && proj.endDate && (
            <span className="mt-2 inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium text-[10px]">
              {new Date(proj.startDate).toLocaleDateString('en-US', { month: 'short' })} '{new Date(proj.startDate).toLocaleDateString('en-US', { year: '2-digit' })} - {new Date(proj.endDate).toLocaleDateString('en-US', { month: 'short' })} '{new Date(proj.endDate).toLocaleDateString('en-US', { year: '2-digit' })}
            </span>
          )}
          {(fteYears > 0 || cost > 0) && (
            <div className="mt-1.5 flex items-center gap-1.5">
              {fteYears > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium text-[10px]">{formatFTEYears(fteYears)} FTE-yr</span>
              )}
              {cost > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium text-[10px]">{formatResourceCost(cost)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPersonCard = (person: ProjectAssignment, projectCount: number, isFocused: boolean) => (
    <div className={`explorer-card cursor-pointer bg-white rounded-xl shadow-md border transition-all duration-200 hover:shadow-lg ${isFocused ? 'border-teal-400 ring-2 ring-teal-200' : 'border-slate-200 hover:-translate-y-0.5'}`}>
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(person.name)} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>{getInitials(person.name)}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{person.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{person.role}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
          {person.allocation && <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 font-medium">{person.allocation}</span>}
          <span>{projectCount} project{projectCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );

  // Render DKR card
  const renderDKRCard = (dkr: DepartmentalKeyResult, dkrIndex: number, isFocused: boolean) => {
    const projCount = dkr.departmentalProjects?.length || 0;
    return (
      <div className={`explorer-card cursor-pointer bg-white rounded-xl shadow-md border transition-all duration-200 hover:shadow-lg ${
        isFocused ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200 hover:-translate-y-0.5'
      }`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold">{dkr.id}</span>
            <span className="px-1.5 py-0.5 rounded bg-brand-light text-brand-dark text-[9px] font-bold uppercase tracking-tighter">{dkr.department}</span>
          </div>
          <p className="font-medium text-slate-800 text-sm leading-tight line-clamp-2">{dkr.title}</p>
          {projCount > 0 && (
            <div className="mt-2">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium text-[10px]">{projCount} project{projCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Team card
  const renderTeamCard = (team: Team, isFocused: boolean) => (
    <div className={`explorer-card cursor-pointer bg-white rounded-xl shadow-md border transition-all duration-200 hover:shadow-lg ${
      isFocused ? 'border-purple-400 ring-2 ring-purple-200' : 'border-slate-200 hover:-translate-y-0.5'
    }`}>
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {team.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{team.name}</p>
            {team.department && <p className="text-[11px] text-slate-500">{team.department}</p>}
          </div>
        </div>
        <div className="mt-2 text-[10px] text-slate-500">
          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">{team.members?.length || 0} members</span>
        </div>
      </div>
    </div>
  );

  // Find element info for rendering neighborhood cards
  const findObjIndex = (id: string) => objectives.findIndex(o => o.id === id);
  const findKRInfo = (id: string) => {
    for (let oi = 0; oi < objectives.length; oi++) {
      const ki = objectives[oi].keyResults.findIndex(k => k.id === id);
      if (ki >= 0) return { kr: objectives[oi].keyResults[ki], objIndex: oi, krIndex: ki };
    }
    return null;
  };
  const findDKRInfo = (id: string) => {
    for (let oi = 0; oi < objectives.length; oi++) {
      for (let ki = 0; ki < objectives[oi].keyResults.length; ki++) {
        const kr = objectives[oi].keyResults[ki];
        const di = (kr.departmentalKeyResults || []).findIndex(d => d.id === id);
        if (di >= 0) return { dkr: kr.departmentalKeyResults![di], dkrIndex: di, objIndex: oi, krIndex: ki };
      }
    }
    return null;
  };
  const findProject = (id: string) => {
    for (const obj of objectives) for (const kr of obj.keyResults) {
      const p = kr.departmentalProjects?.find(p => p.id === id);
      if (p) return p;
      for (const dkr of kr.departmentalKeyResults || []) {
        const dp = dkr.departmentalProjects?.find(p => p.id === id);
        if (dp) return dp;
      }
    }
    return null;
  };
  const findTeamInfo = (id: string) => {
    for (const obj of objectives) for (const kr of obj.keyResults) {
      const allProjs = [...(kr.departmentalProjects || []), ...(kr.departmentalKeyResults || []).flatMap(d => d.departmentalProjects || [])];
      for (const proj of allProjs) {
        const team = proj.teams?.find(t => t.id === id);
        if (team) return team;
      }
    }
    return null;
  };
  const findPersonInfo = (id: string) => {
    let projectCount = 0;
    let person: ProjectAssignment | null = null;
    for (const obj of objectives) for (const kr of obj.keyResults) {
      const allProjs = [...(kr.departmentalProjects || []), ...(kr.departmentalKeyResults || []).flatMap(d => d.departmentalProjects || [])];
      for (const proj of allProjs) {
        const hc = proj.headcount?.find(h => h.id === id);
        if (hc) { person = hc; projectCount++; }
        // Also check team members
        for (const t of proj.teams || []) {
          const tm = t.members?.find(m => m.id === id);
          if (tm && !person) { person = tm; projectCount++; }
        }
      }
    }
    return person ? { person, projectCount } : null;
  };

  // Dependencies helper for strategy map (uses imported getDependenciesForElement)
  const getStrategyMapDeps = (type: 'objective' | 'keyResult' | 'project', id: string) =>
    getDependenciesForElement(dependencies, type, id);

  // Detail panel data - uses shared hook
  const detailData = useDetailData(
    currentTarget ? { id: currentTarget.id, type: currentTarget.type, label: currentTarget.label } : null,
    filteredObjectives,
    objectives,
    dependencies,
    getProjectResourceStatus,
    personnel
  );

  // Column labels for neighborhood view (dynamic based on which layers exist)
  const neighborhoodColumnLabels = useMemo(() => {
    const labels: Array<{ label: string; color: string }> = [
      { label: 'Objectives', color: 'from-blue-500 to-blue-600' },
      { label: 'Key Results', color: 'from-emerald-500 to-emerald-600' },
    ];
    const hasDKRs = filteredObjectives.some(o => o.keyResults.some(kr => kr.departmentalKeyResults && kr.departmentalKeyResults.length > 0));
    const hasTeams = filteredObjectives.some(o => o.keyResults.some(kr => {
      const allProjs = [...(kr.departmentalProjects || []), ...(kr.departmentalKeyResults || []).flatMap(d => d.departmentalProjects || [])];
      return allProjs.some(p => p.teams && p.teams.length > 0);
    }));
    if (hasDKRs) labels.push({ label: 'Dept. KRs', color: 'from-amber-500 to-amber-600' });
    labels.push({ label: 'Projects', color: 'from-indigo-500 to-indigo-600' });
    if (hasTeams) labels.push({ label: 'Teams', color: 'from-purple-500 to-purple-600' });
    labels.push({ label: 'People', color: 'from-teal-500 to-teal-600' });
    return labels;
  }, [filteredObjectives]);
  const columnLabels = neighborhoodColumnLabels.map(c => c.label);
  const columnColors = neighborhoodColumnLabels.map(c => c.color);

  return (
    <div className="relative">
      {/* Canvas Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 px-3 py-2 shadow-lg">
        <button onClick={() => setZoom(prev => Math.min(prev + 0.1, 1.5))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
        </button>
        <span className="text-xs font-medium text-slate-600 min-w-[48px] text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.3))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1"></div>
        <button onClick={() => { setCanvasPosition({ x: 50, y: 50 }); setZoom(0.85); setExplorationPath([]); }} className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Reset</button>
      </div>

      {/* Navigation bar with filters and breadcrumb */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 px-3 py-2 shadow-lg">
        {/* Filter Controls */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
        </svg>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="text-xs border-0 bg-transparent focus:ring-0 text-slate-700 font-medium cursor-pointer pr-6"
        >
          <option value="all">All Departments</option>
          {allDepartments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        <div className="w-px h-4 bg-slate-200" />
        <select
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value)}
          className="text-xs border-0 bg-transparent focus:ring-0 text-slate-700 font-medium cursor-pointer pr-6"
        >
          <option value="all">All People</option>
          {allPeople.map(p => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        {(deptFilter !== 'all' || personFilter !== 'all') && (
          <button
            onClick={() => { setDeptFilter('all'); setPersonFilter('all'); }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear
          </button>
        )}

        {/* Breadcrumb (when exploring) */}
        {isExploring && (
          <>
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <button
              onClick={() => setExplorationPath([])}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
              All
            </button>
            {explorationPath.map((entry, idx) => {
              const typeColors: Record<StrategyMapElementType, string> = {
                objective: 'bg-blue-100 text-blue-700',
                keyResult: 'bg-emerald-100 text-emerald-700',
                departmentalKeyResult: 'bg-amber-100 text-amber-700',
                project: 'bg-indigo-100 text-indigo-700',
                team: 'bg-purple-100 text-purple-700',
                person: 'bg-teal-100 text-teal-700',
              };
              return (
                <React.Fragment key={idx}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-300 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  <button
                    onClick={() => navigateToBreadcrumb(idx)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors max-w-[140px] truncate ${
                      idx === explorationPath.length - 1 ? typeColors[entry.type] : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {entry.label}
                  </button>
                </React.Fragment>
              );
            })}
            {explorationPath.length > 1 && (
              <>
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <button onClick={navigateBack} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="Back">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden relative select-none"
        style={{ height: '700px', cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, #e2e8f0 1.5px, transparent 1.5px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${canvasPosition.x % (24 * zoom)}px ${canvasPosition.y % (24 * zoom)}px`,
        }} />

        {/* Content */}
        <div ref={contentRef} className="absolute" style={{
          transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}>
          {objectives.length === 0 ? (
            <div className="flex items-center justify-center" style={{ width: '800px', height: '500px' }}>
              <div className="text-center p-8 bg-white rounded-2xl border-2 border-dashed border-slate-300 shadow-lg">
                <ExplorerIcon />
                <p className="text-slate-500 text-lg mt-4">No strategy elements yet</p>
                <p className="text-slate-400 text-sm mt-1">Add objectives to visualize your strategy</p>
              </div>
            </div>
          ) : !isExploring ? (
            /* ─── DEFAULT VIEW: Objectives only ─── */
            <div style={{ padding: '40px' }}>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800">
                    {deptFilter !== 'all' || personFilter !== 'all' ? (
                      <>
                        {personFilter !== 'all' && allPeople.find(p => p.id === personFilter)?.name}
                        {personFilter !== 'all' && deptFilter !== 'all' && ' · '}
                        {deptFilter !== 'all' && deptFilter}
                        {' View'}
                      </>
                    ) : (
                      `${companyName} Strategy`
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    {filteredObjectives.length === objectives.length
                      ? `${objectives.length} objectives — click to explore`
                      : `${filteredObjectives.length} of ${objectives.length} objectives — click to explore`}
                  </p>
                </div>
              </div>
              {filteredObjectives.length === 0 ? (
                <div className="flex items-center justify-center" style={{ minHeight: '300px' }}>
                  <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                    <p className="text-slate-500 mt-4">No objectives match the current filters</p>
                    <button
                      onClick={() => { setDeptFilter('all'); setPersonFilter('all'); }}
                      className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-5" style={{
                  width: canvasRef.current ? `${(canvasRef.current.getBoundingClientRect().width / zoom) - 80}px` : '100%',
                  gridTemplateColumns: filteredObjectives.length <= 6
                    ? `repeat(${Math.min(filteredObjectives.length, 3)}, 1fr)`
                    : `repeat(auto-fill, minmax(240px, 1fr))`
                }}>
                  {filteredObjectives.map((obj, oIdx) => {
                    // Find original index for display
                    const originalIdx = objectives.findIndex(o => o.id === obj.id);
                    return (
                      <div
                        key={obj.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          const label = `O${originalIdx + 1}: ${obj.title.length > 24 ? obj.title.slice(0, 24) + '...' : obj.title}`;
                          navigateTo(obj.id, 'objective', label);
                        }}
                      >
                        {renderObjectiveCard(obj, originalIdx, false, filteredObjectives.length <= 6)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : neighborhood ? (
            /* ─── NEIGHBORHOOD VIEW: Focused element + related items ─── */
            <div style={{ position: 'relative', minWidth: '1200px', minHeight: '500px' }}>
              {/* Objective pills for quick switching (only show when exploring, not at top level) */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', position: 'relative', zIndex: 5 }}>
                {filteredObjectives.map((obj) => {
                  const originalIdx = objectives.findIndex(o => o.id === obj.id);
                  const isActive = currentTarget?.type === 'objective' ? currentTarget.id === obj.id :
                    explorationPath.some(e => e.id === obj.id);
                  return (
                    <button
                      key={obj.id}
                      className={`explorer-card px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isActive ? 'bg-blue-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const label = `${obj.id}: ${obj.title.length > 24 ? obj.title.slice(0, 24) + '...' : obj.title}`;
                        setExplorationPath([{ id: obj.id, type: 'objective', label }]);
                        setShowDetailPanel(true);
                      }}
                    >
                      {obj.id}: {obj.title.length > 20 ? obj.title.slice(0, 20) + '...' : obj.title}
                    </button>
                  );
                })}
              </div>

              {/* Neighborhood content container — flows below pills */}
              <div style={{ position: 'relative' }}>
              {/* Column headers */}
              {[0, 1, 2, 3].map(col => {
                const hasItems = neighborhood.items.some(it => it.column === col);
                if (!hasItems) return null;
                return (
                  <div key={col} style={{ position: 'absolute', left: col * 290, top: 0 }}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-5 h-5 rounded bg-gradient-to-br ${columnColors[col]} flex items-center justify-center`}>
                        <span className="text-[9px] font-bold text-white">{columnLabels[col].charAt(0)}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{columnLabels[col]}</span>
                    </div>
                  </div>
                );
              })}

              {/* Cards at computed positions */}
              {neighborhood.items.map(item => {
                const pos = neighborhood.positions.get(item.id);
                if (!pos) return null;
                const isFocused = item.id === currentTarget?.id;

                let card: React.ReactNode = null;
                if (item.type === 'objective') {
                  const idx = findObjIndex(item.id);
                  if (idx >= 0) card = renderObjectiveCard(objectives[idx], idx, isFocused);
                } else if (item.type === 'keyResult') {
                  const info = findKRInfo(item.id);
                  if (info) card = renderKRCard(info.kr, info.objIndex, info.krIndex, isFocused);
                } else if (item.type === 'departmentalKeyResult') {
                  const info = findDKRInfo(item.id);
                  if (info) card = renderDKRCard(info.dkr, info.dkrIndex, isFocused);
                } else if (item.type === 'project') {
                  const proj = findProject(item.id);
                  if (proj) card = renderProjectCard(proj, isFocused);
                } else if (item.type === 'team') {
                  const team = findTeamInfo(item.id);
                  if (team) card = renderTeamCard(team, isFocused);
                } else if (item.type === 'person') {
                  const pInfo = findPersonInfo(item.id);
                  if (pInfo) card = renderPersonCard(pInfo.person, pInfo.projectCount, isFocused);
                }
                if (!card) return null;

                return (
                  <div
                    key={item.id}
                    data-node-id={item.id}
                    style={{
                      position: 'absolute',
                      left: pos.x,
                      top: pos.y + 36, // offset below column headers
                      width: pos.w,
                      transition: 'left 0.3s ease, top 0.3s ease',
                      outline: 'none',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.id === currentTarget?.id) { setShowDetailPanel(prev => !prev); return; } // toggle detail panel

                      let label = '';
                      if (item.type === 'objective') {
                        const idx = findObjIndex(item.id);
                        label = `${objectives[idx]?.id}: ${objectives[idx]?.title.slice(0, 24) || ''}`;
                      } else if (item.type === 'keyResult') {
                        const info = findKRInfo(item.id);
                        if (info) label = `${info.kr.id}: ${info.kr.title.slice(0, 24)}`;
                      } else if (item.type === 'departmentalKeyResult') {
                        const info = findDKRInfo(item.id);
                        if (info) label = `${info.dkr.id}: ${info.dkr.title.slice(0, 22)}`;
                      } else if (item.type === 'project') {
                        const proj = findProject(item.id);
                        if (proj) label = proj.title.slice(0, 28);
                      } else if (item.type === 'team') {
                        const team = findTeamInfo(item.id);
                        if (team) label = team.name;
                      } else if (item.type === 'person') {
                        const pInfo = findPersonInfo(item.id);
                        if (pInfo) label = pInfo.person.name;
                      }
                      navigateTo(item.id, item.type, label);
                    }}
                  >
                    {card}
                  </div>
                );
              })}

              {/* SVG connectors */}
              <svg style={{ position: 'absolute', left: 0, top: 0, width: '2000px', height: '2000px', pointerEvents: 'none' }}>
                <defs>
                  <marker id="nh-arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" /></marker>
                  <marker id="nh-arrow-indigo" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" /></marker>
                  <marker id="nh-arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#0d9488" /></marker>
                  <marker id="nh-arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" /></marker>
                  <marker id="nh-arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#d97706" /></marker>
                  <marker id="nh-arrow-purple" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed" /></marker>
                  <marker id="nh-arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" /></marker>
                </defs>
                {neighborhood.connections.map((conn, i) => {
                  const from = neighborhood.positions.get(conn.fromId);
                  const to = neighborhood.positions.get(conn.toId);
                  if (!from || !to) return null;

                  const cardOffset = 36; // must match the card top offset
                  const x1 = from.x + from.w;
                  const y1 = from.y + cardOffset + from.h / 2;
                  const x2 = to.x;
                  const y2 = to.y + cardOffset + to.h / 2;
                  const cpOffset = Math.abs(x2 - x1) * 0.4;

                  const markerId = conn.color === '#3b82f6' ? 'nh-arrow-blue' :
                    conn.color === '#6366f1' ? 'nh-arrow-indigo' :
                    conn.color === '#d97706' ? 'nh-arrow-amber' :
                    conn.color === '#7c3aed' ? 'nh-arrow-purple' :
                    conn.color === '#0d9488' ? 'nh-arrow-teal' :
                    conn.color === '#ef4444' ? 'nh-arrow-red' : 'nh-arrow-gray';

                  return (
                    <g key={`nh-${i}`}>
                      <path
                        d={`M ${x1} ${y1} C ${x1 + cpOffset} ${y1} ${x2 - cpOffset} ${y2} ${x2} ${y2}`}
                        fill="none" stroke={conn.color} strokeWidth="4" opacity="0.1"
                      />
                      <path
                        d={`M ${x1} ${y1} C ${x1 + cpOffset} ${y1} ${x2 - cpOffset} ${y2} ${x2} ${y2}`}
                        fill="none" stroke={conn.color} strokeWidth="1.5" opacity="0.5" markerEnd={`url(#${markerId})`}
                      />
                    </g>
                  );
                })}
              </svg>
              </div>{/* end neighborhood content container */}
            </div>
          ) : null}
        </div>

        {/* Detail Panel */}
        {isExploring && (
          <StrategyDetailPanel
            detailData={detailData}
            show={showDetailPanel}
            onClose={() => setShowDetailPanel(false)}
            getProjectResourceStatus={getProjectResourceStatus}
            allObjectives={objectives}
            className="fixed top-[72px] right-4 bottom-4 z-40"
            elementAlerts={getElementAlerts?.(detailData)}
            onApplyAction={onApplyAction}
            onDismissAlert={onDismissAlert}
            childIssues={getChildIssues?.(detailData)}
            onNavigateToChild={(type, id, name) => {
              navigateTo(id, type, name);
            }}
            onUpdatePersonnel={onUpdatePersonnel}
            personnel={personnel}
            onAddHeadcount={onAddHeadcount}
            onAddPersonnelToProject={onAddPersonnelToProject}
            onUpdateProject={onUpdateProject}
            onUpdateTeam={onUpdateTeam}
            onUpdateKeyResult={onUpdateKeyResult}
            onUpdateDepartmentalKeyResult={onUpdateDepartmentalKeyResult}
            onUpdateObjective={onUpdateObjective}
            onDeleteObjective={onDeleteObjective}
            onDeleteKeyResult={onDeleteKeyResult}
            onDeleteProject={onDeleteProject}
            onAddKeyResult={onAddKeyResult}
            onAddProject={onAddProject}
            showAlerts={showAlertOverlay}
          />
        )}

        {/* Bottom hint */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200 px-3 py-2 shadow-sm">
          <p className="text-[11px] text-slate-500">
            {isExploring ? 'Click any card to explore deeper • Use pills to switch objectives • Esc to go back' : 'Click an objective to start exploring • Drag to pan • Ctrl+Scroll to zoom'}
          </p>
        </div>

        {/* Legend (only in neighborhood view) */}
        {isExploring && (
          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200 px-3 py-2 shadow-sm">
            <div className="flex items-center gap-4 text-[10px]">
              <div className="flex items-center gap-1"><div className="w-4 h-0.5 bg-blue-500 rounded"></div><span className="text-slate-600">Obj → KR</span></div>
              {filteredObjectives.some(o => o.keyResults.some(kr => kr.departmentalKeyResults && kr.departmentalKeyResults.length > 0)) && (
                <div className="flex items-center gap-1"><div className="w-4 h-0.5 bg-amber-500 rounded"></div><span className="text-slate-600">KR → DKR</span></div>
              )}
              <div className="flex items-center gap-1"><div className="w-4 h-0.5 bg-indigo-500 rounded"></div><span className="text-slate-600">{filteredObjectives.some(o => o.keyResults.some(kr => kr.departmentalKeyResults && kr.departmentalKeyResults.length > 0)) ? 'DKR' : 'KR'} → Proj</span></div>
              {filteredObjectives.some(o => o.keyResults.some(kr => [...(kr.departmentalProjects || []), ...(kr.departmentalKeyResults || []).flatMap(d => d.departmentalProjects || [])].some(p => p.teams && p.teams.length > 0))) && (
                <div className="flex items-center gap-1"><div className="w-4 h-0.5 bg-purple-500 rounded"></div><span className="text-slate-600">Proj → Team</span></div>
              )}
              <div className="flex items-center gap-1"><div className="w-4 h-0.5 bg-teal-500 rounded"></div><span className="text-slate-600">→ People</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   RESOURCE LENS VIEW
   People-centric view: who works on what, allocation, must-retain
   ═══════════════════════════════════════════════════════════════════════ */

interface ResourcePersonData {
  id: string;
  name: string;
  role: string;
  department: string;
  skills: string[];
  availability: string;
  email: string;
  isRostered: boolean; // true if from personnel[], false if only from headcount
  assignments: {
    project: DepartmentalProject;
    objectiveTitle: string;
    objectiveIndex: number;
    krTitle: string;
    krIndex: number;
    role: string;
    allocation: string;
    projectStatus: { status: 'ok' | 'under' | 'over' | 'critical'; message: string };
    timeCategory: 'now' | 'later' | 'completed' | 'overdue' | 'no-timeline';
  }[];
  projectCount: number;
  status: 'unassigned' | 'available' | 'loaded' | 'overloaded';
  mustRetain: boolean;
}

const ResourceLensView: React.FC<{
  objectives: Objective[];
  personnel: Personnel[];
  getProjectResourceStatus: (project: DepartmentalProject) => { status: 'ok' | 'under' | 'over' | 'critical'; message: string };
  mode: 'allocation' | 'assignments';
  filterPersons?: string[];
  onClearFilter?: () => void;
}> = ({ objectives, personnel, getProjectResourceStatus, mode, filterPersons = [], onClearFilter }) => {
  const capacitySubTab = mode;
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [skillFilter, setSkillFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'projects' | 'status'>('name');
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [objectiveFilter, setObjectiveFilter] = useState<string | null>(null);
  const [selectedCostObjective, setSelectedCostObjective] = useState<string | null>(null);
  const [selectedCostKR, setSelectedCostKR] = useState<string | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<{
    type: 'objective' | 'kr' | 'project';
    label: string;
    title: string;
    cost: number;
    percentage: number;
  } | null>(null);

  // Timeline state for Assignments tab
  const [timelineYear, setTimelineYear] = useState(new Date().getFullYear());
  const [timelineScope, setTimelineScope] = useState<'year' | 'quarter'>('year');
  const [timelineQuarter, setTimelineQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [expandedTimelinePerson, setExpandedTimelinePerson] = useState<string | null>(null);

  // Compute resource data
  const resourceData = useMemo(() => {
    const today = new Date();
    const getTimeCategory = (proj: DepartmentalProject): 'now' | 'later' | 'completed' | 'overdue' | 'no-timeline' => {
      if (proj.status === 'Done') return 'completed';
      if (!proj.startDate || !proj.endDate) return 'no-timeline';
      const start = new Date(proj.startDate);
      const end = new Date(proj.endDate);
      if (today > end) return 'overdue'; // past end date but not Done
      if (today < start) return 'later';
      return 'now';
    };

    // Build a map of all assignments: personnelId/name → assignments
    const personMap = new Map<string, ResourcePersonData>();

    // Start with rostered personnel
    personnel.forEach(p => {
      personMap.set(p.id, {
        id: p.id,
        name: p.name,
        role: p.role,
        department: p.department,
        skills: p.skills || [],
        availability: p.availability || 'Full-time',
        email: p.email || '',
        isRostered: true,
        assignments: [],
        projectCount: 0,
        status: 'unassigned',
        mustRetain: false,
      });
    });

    // Walk all projects and build assignments
    objectives.forEach((obj, oi) => {
      obj.keyResults.forEach((kr, ki) => {
        const seenProjects = new Set<string>();
        const processProject = (proj: DepartmentalProject) => {
          if (seenProjects.has(proj.id)) return;
          seenProjects.add(proj.id);
          const projStatus = getProjectResourceStatus(proj);
          const timeCat = getTimeCategory(proj);

          // Collect all assignees: direct headcount + team members
          const allAssignees: ProjectAssignment[] = [
            ...(proj.headcount || []),
            ...(proj.teams || []).flatMap(t => t.members || []),
          ];

          allAssignees.forEach(hc => {
            // Try to match to rostered personnel
            const matchId = hc.personnelId || hc.id;
            let person = personMap.get(matchId);

            // Fallback: try matching by personnelId explicitly
            if (!person && hc.personnelId) {
              person = personMap.get(hc.personnelId);
            }

            // If not found, create unrostered entry
            if (!person) {
              person = {
                id: hc.id,
                name: hc.name,
                role: hc.role,
                department: proj.department,
                skills: [],
                availability: hc.allocation || 'Unknown',
                email: '',
                isRostered: false,
                assignments: [],
                projectCount: 0,
                status: 'available',
                mustRetain: false,
              };
              personMap.set(hc.id, person);
            }

            // Deduplicate: if this person already has an assignment for this project
            // (project supports multiple KRs), don't count it again
            const existingAssignment = person.assignments.find(a => a.project.id === proj.id);
            if (!existingAssignment) {
              person.assignments.push({
                project: proj,
                objectiveTitle: obj.title,
                objectiveIndex: oi,
                krTitle: kr.title,
                krIndex: ki,
                role: hc.role,
                allocation: hc.allocation || 'Full-time',
                projectStatus: projStatus,
                timeCategory: timeCat,
              });
            }
          });
        };

        (kr.departmentalProjects || []).forEach(processProject);
        (kr.departmentalKeyResults || []).forEach(dkr => {
          (dkr.departmentalProjects || []).forEach(processProject);
        });
      });
    });

    // Compute derived fields
    personMap.forEach(person => {
      person.projectCount = person.assignments.length;
      if (person.projectCount === 0) person.status = 'unassigned';
      else if (person.projectCount <= 2) person.status = 'available';
      else if (person.projectCount === 3) person.status = 'loaded';
      else person.status = 'overloaded';

      // Must-retain: 2+ projects and at least one critical/under
      person.mustRetain = person.projectCount >= 2 &&
        person.assignments.some(a => a.projectStatus.status === 'critical' || a.projectStatus.status === 'under');
    });

    return Array.from(personMap.values());
  }, [objectives, personnel, getProjectResourceStatus]);

  // Time periods for allocation timeline
  const allocationTimePeriods = useMemo(() => {
    const periods: { key: string; label: string; shortLabel: string; startDate: Date; endDate: Date }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (timelineScope === 'year') {
      // Show all 12 months
      for (let m = 0; m < 12; m++) {
        periods.push({
          key: `${timelineYear}-${m + 1}`,
          label: monthNames[m],
          shortLabel: monthNames[m].substring(0, 1),
          startDate: new Date(timelineYear, m, 1),
          endDate: new Date(timelineYear, m + 1, 0)
        });
      }
    } else {
      // Show 3 months of the selected quarter
      const startMonth = (timelineQuarter - 1) * 3;
      for (let m = 0; m < 3; m++) {
        const monthIndex = startMonth + m;
        periods.push({
          key: `${timelineYear}-${monthIndex + 1}`,
          label: monthNames[monthIndex],
          shortLabel: monthNames[monthIndex].substring(0, 1),
          startDate: new Date(timelineYear, monthIndex, 1),
          endDate: new Date(timelineYear, monthIndex + 1, 0)
        });
      }
    }
    return periods;
  }, [timelineYear, timelineScope, timelineQuarter]);

  // Parse allocation string to decimal (reuse from fteCalculations logic)
  const parseAllocationValue = (allocation?: string): number => {
    if (!allocation) return 1.0;
    const lower = allocation.toLowerCase().trim();
    if (lower === 'full-time' || lower === 'full time' || lower === '100%') return 1.0;
    if (lower === 'part-time' || lower === 'part time') return 0.5;
    if (lower === 'half-time' || lower === 'half time') return 0.5;
    if (lower === 'quarter-time' || lower === 'quarter time') return 0.25;
    const percentMatch = allocation.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch) return parseFloat(percentMatch[1]) / 100;
    const decimalMatch = allocation.match(/^(\d*\.?\d+)$/);
    if (decimalMatch) {
      const val = parseFloat(decimalMatch[1]);
      return val > 1 ? val / 100 : val;
    }
    return 1.0;
  };

  // Allocation timeline data for each person
  const allocationTimelineData = useMemo(() => {
    return resourceData.map(person => {
      // Calculate allocation for each time period
      const periodAllocations = allocationTimePeriods.map(period => {
        let totalAllocation = 0;
        const activeProjects: { project: typeof person.assignments[0]['project']; allocation: number; role: string }[] = [];

        person.assignments.forEach(assignment => {
          const proj = assignment.project;
          if (!proj.startDate || !proj.endDate) return;

          const projStart = new Date(proj.startDate);
          const projEnd = new Date(proj.endDate);

          // Check if project overlaps with this period
          if (projStart <= period.endDate && projEnd >= period.startDate) {
            const allocationValue = parseAllocationValue(assignment.allocation);
            totalAllocation += allocationValue;
            activeProjects.push({
              project: proj,
              allocation: allocationValue,
              role: assignment.role,
            });
          }
        });

        return {
          period,
          totalAllocation,
          activeProjects,
          isOverAllocated: totalAllocation > 1,
          isUnderUtilized: totalAllocation > 0 && totalAllocation < 0.5,
        };
      });

      // Find allocation segments (consecutive periods with same allocation level)
      type AllocationSegment = {
        startPeriodIndex: number;
        endPeriodIndex: number;
        allocation: number;
        isOverAllocated: boolean;
        projects: typeof periodAllocations[0]['activeProjects'];
      };
      const segments: AllocationSegment[] = [];
      let currentSegment: AllocationSegment | null = null;

      periodAllocations.forEach((pa, idx) => {
        if (pa.totalAllocation === 0) {
          if (currentSegment) {
            segments.push(currentSegment);
            currentSegment = null;
          }
          return;
        }

        // Round to nearest 10% for grouping similar allocations
        const roundedAlloc = Math.round(pa.totalAllocation * 10) / 10;

        if (!currentSegment || Math.abs(currentSegment.allocation - roundedAlloc) > 0.15) {
          if (currentSegment) segments.push(currentSegment);
          currentSegment = {
            startPeriodIndex: idx,
            endPeriodIndex: idx,
            allocation: pa.totalAllocation,
            isOverAllocated: pa.isOverAllocated,
            projects: pa.activeProjects,
          };
        } else {
          currentSegment.endPeriodIndex = idx;
          // Update to max allocation in segment
          if (pa.totalAllocation > currentSegment.allocation) {
            currentSegment.allocation = pa.totalAllocation;
          }
          if (pa.isOverAllocated) currentSegment.isOverAllocated = true;
          // Merge projects
          pa.activeProjects.forEach(p => {
            if (!currentSegment!.projects.find(cp => cp.project.id === p.project.id)) {
              currentSegment!.projects.push(p);
            }
          });
        }
      });
      if (currentSegment) segments.push(currentSegment);

      // Determine overall status
      const maxAllocation = Math.max(...periodAllocations.map(p => p.totalAllocation), 0);
      const avgAllocation = periodAllocations.reduce((s, p) => s + p.totalAllocation, 0) / periodAllocations.length;
      const hasOverAllocation = periodAllocations.some(p => p.isOverAllocated);

      return {
        person,
        periodAllocations,
        segments,
        maxAllocation,
        avgAllocation,
        hasOverAllocation,
        hasAnyAllocation: maxAllocation > 0,
      };
    }).filter(d => d.hasAnyAllocation || d.person.isRostered) // Show rostered people even with no allocation
      .sort((a, b) => {
        // Sort by: over-allocated first, then by max allocation desc, then by name
        if (a.hasOverAllocation !== b.hasOverAllocation) return a.hasOverAllocation ? -1 : 1;
        if (Math.abs(a.maxAllocation - b.maxAllocation) > 0.1) return b.maxAllocation - a.maxAllocation;
        return a.person.name.localeCompare(b.person.name);
      });
  }, [resourceData, allocationTimePeriods]);

  // Filtered allocation timeline data (for Assignments tab filters)
  const filteredAllocationTimelineData = useMemo(() => {
    let data = allocationTimelineData;

    // Filter by person names (from assessment navigation)
    if (filterPersons.length > 0) {
      data = data.filter(d => filterPersons.includes(d.person.name));
    }

    // Filter by department
    if (deptFilter !== 'all') {
      data = data.filter(d => d.person.department === deptFilter);
    }

    // Filter by skill
    if (skillFilter !== 'all') {
      data = data.filter(d => d.person.skills.includes(skillFilter));
    }

    // Filter by project
    if (projectFilter !== 'all') {
      data = data.filter(d => d.person.assignments.some(a => a.project.id === projectFilter));
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(d =>
        d.person.name.toLowerCase().includes(q) ||
        d.person.role.toLowerCase().includes(q)
      );
    }

    return data;
  }, [allocationTimelineData, deptFilter, skillFilter, projectFilter, searchQuery, filterPersons]);

  // Cost allocation by objective (for donut chart)
  const costAllocationData = useMemo(() => {
    const objColors = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];
    const data = objectives.map((obj, oi) => {
      const cost = calculateObjectiveCost(obj);
      const krCosts = obj.keyResults.map((kr, ki) => {
        // Calculate project costs for each KR
        const projectCosts = (kr.departmentalProjects || []).map((proj, pi) => ({
          id: proj.id,
          title: proj.title,
          department: proj.department,
          cost: calculateProjectCost(proj),
          index: pi,
        }));
        return {
          id: kr.id,
          title: kr.title,
          cost: calculateKRCost(kr),
          index: ki,
          projects: projectCosts,
        };
      });
      return {
        id: obj.id,
        title: obj.title,
        index: oi,
        cost,
        color: objColors[oi % objColors.length],
        keyResults: krCosts,
      };
    });
    const totalCost = data.reduce((sum, d) => sum + d.cost, 0);
    return { objectives: data, totalCost };
  }, [objectives]);

  // All unique departments and skills for filters
  const allDepartments = useMemo(() => {
    const depts = new Set<string>();
    resourceData.forEach(p => { if (p.department) depts.add(p.department); });
    return Array.from(depts).sort();
  }, [resourceData]);

  const allSkills = useMemo(() => {
    const skills = new Set<string>();
    resourceData.forEach(p => p.skills.forEach(s => skills.add(s)));
    return Array.from(skills).sort();
  }, [resourceData]);

  // All unique projects for filter
  const allProjects = useMemo(() => {
    const projects = new Map<string, { id: string; title: string; department: string }>();
    resourceData.forEach(p => {
      p.assignments.forEach(a => {
        if (!projects.has(a.project.id)) {
          projects.set(a.project.id, { id: a.project.id, title: a.project.title, department: a.project.department });
        }
      });
    });
    return Array.from(projects.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [resourceData]);

  // Summary stats
  const stats = useMemo(() => {
    const total = resourceData.length;
    const assigned = resourceData.filter(p => p.projectCount > 0).length;
    const unassigned = resourceData.filter(p => p.projectCount === 0).length;
    const overloaded = resourceData.filter(p => p.status === 'overloaded').length;
    const mustRetain = resourceData.filter(p => p.mustRetain).length;
    return { total, assigned, unassigned, overloaded, mustRetain };
  }, [resourceData]);

  // Filter and sort people
  const filteredPeople = useMemo(() => {
    let people = resourceData;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      people = people.filter(p => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
    }
    if (deptFilter !== 'all') people = people.filter(p => p.department === deptFilter);
    if (skillFilter !== 'all') people = people.filter(p => p.skills.includes(skillFilter));
    if (statusFilter !== 'all') people = people.filter(p => p.status === statusFilter);
    if (objectiveFilter) {
      people = people.filter(p => p.assignments.some(a => {
        const obj = objectives[a.objectiveIndex];
        return obj && obj.id === objectiveFilter;
      }));
    }

    people = [...people].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'department') return a.department.localeCompare(b.department);
      if (sortBy === 'projects') return b.projectCount - a.projectCount;
      if (sortBy === 'status') {
        const order = { overloaded: 0, loaded: 1, available: 2, unassigned: 3 };
        return (order[a.status] ?? 4) - (order[b.status] ?? 4);
      }
      return 0;
    });

    return people;
  }, [resourceData, searchQuery, deptFilter, skillFilter, statusFilter, sortBy, objectiveFilter, objectives]);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      unassigned: 'bg-red-100 text-red-700',
      available: 'bg-emerald-100 text-emerald-700',
      loaded: 'bg-amber-100 text-amber-700',
      overloaded: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      unassigned: 'Unassigned',
      available: 'Available',
      loaded: 'Fully Loaded',
      overloaded: 'Overloaded',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ─── ALLOCATION TAB ─── */}
      {capacitySubTab === 'allocation' && (
        <>
          {/* ─── Cost Allocation Sunburst Chart ─── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            {/* Header with breadcrumb navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">Cost Allocation</h3>
                {/* Breadcrumb */}
                {(selectedCostObjective || selectedCostKR) && (
                  <div className="flex items-center text-xs text-slate-500">
                    <span className="mx-2">›</span>
                    <button
                      onClick={() => { setSelectedCostObjective(null); setSelectedCostKR(null); }}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      All ({formatResourceCost(costAllocationData.totalCost)})
                    </button>
                    {selectedCostObjective && (() => {
                      const obj = costAllocationData.objectives.find(o => o.id === selectedCostObjective);
                      if (!obj) return null;
                      const isCurrentLevel = !selectedCostKR;
                      return (
                        <>
                          <span className="mx-2">›</span>
                          <button
                            onClick={() => setSelectedCostKR(null)}
                            className={`font-medium ${selectedCostKR ? 'text-blue-600 hover:text-blue-800' : 'text-slate-700'} ${isCurrentLevel ? 'max-w-xs truncate' : ''}`}
                            title={isCurrentLevel ? obj.title : undefined}
                          >
                            {obj.id} ({formatResourceCost(obj.cost)}){isCurrentLevel && `: ${obj.title}`}
                          </button>
                        </>
                      );
                    })()}
                    {selectedCostKR && (() => {
                      const obj = costAllocationData.objectives.find(o => o.id === selectedCostObjective);
                      const kr = obj?.keyResults.find(k => k.id === selectedCostKR);
                      if (!kr) return null;
                      return (
                        <>
                          <span className="mx-2">›</span>
                          <span className="text-slate-700 font-medium max-w-xs truncate" title={kr.title}>
                            {kr.id} ({formatResourceCost(kr.cost)}): {kr.title}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              {(selectedCostObjective || selectedCostKR) && (
                <button
                  onClick={() => {
                    if (selectedCostKR) {
                      setSelectedCostKR(null);
                    } else {
                      setSelectedCostObjective(null);
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  Zoom Out
                </button>
              )}
            </div>

            {costAllocationData.totalCost === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No cost data available. Add projects with timelines and headcount to see cost allocation.
              </div>
            ) : (
              <div className="flex flex-col xl:flex-row items-start gap-4">
                {/* Sunburst Chart */}
                <div className="relative w-80 h-80 lg:w-[400px] lg:h-[400px] flex-shrink-0 mx-auto xl:mx-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {(() => {
                      const centerX = 50;
                      const centerY = 50;
                      const objColors = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

                      // Helper to create arc path
                      const createArc = (startAngle: number, endAngle: number, innerR: number, outerR: number) => {
                        const startRad = (startAngle * Math.PI) / 180;
                        const endRad = (endAngle * Math.PI) / 180;
                        const x1 = centerX + outerR * Math.cos(startRad);
                        const y1 = centerY + outerR * Math.sin(startRad);
                        const x2 = centerX + outerR * Math.cos(endRad);
                        const y2 = centerY + outerR * Math.sin(endRad);
                        const x3 = centerX + innerR * Math.cos(endRad);
                        const y3 = centerY + innerR * Math.sin(endRad);
                        const x4 = centerX + innerR * Math.cos(startRad);
                        const y4 = centerY + innerR * Math.sin(startRad);
                        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                        return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
                      };

                      // Lighten color helper
                      const lightenColor = (hex: string, percent: number) => {
                        const num = parseInt(hex.slice(1), 16);
                        const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent));
                        const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * percent));
                        const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * percent));
                        return `rgb(${r}, ${g}, ${b})`;
                      };

                      const paths: React.ReactElement[] = [];
                      const selectedObj = selectedCostObjective ? costAllocationData.objectives.find(o => o.id === selectedCostObjective) : null;
                      const selectedKR = selectedCostKR && selectedObj ? selectedObj.keyResults.find(k => k.id === selectedCostKR) : null;

                      // ZOOMED VIEW: Projects only (when KR is selected)
                      if (selectedKR && selectedObj) {
                        const projects = selectedKR.projects.filter(p => p.cost > 0);
                        const total = projects.reduce((sum, p) => sum + p.cost, 0);

                        // Helper to get label position on arc
                        const getLabelPos = (startAngle: number, endAngle: number, radius: number) => {
                          const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180;
                          return {
                            x: centerX + radius * Math.cos(midAngle),
                            y: centerY + radius * Math.sin(midAngle),
                            rotation: (startAngle + endAngle) / 2
                          };
                        };

                        let angle = 0;
                        projects.forEach((proj, pi) => {
                          const projAngle = total > 0 ? (proj.cost / total) * 360 : 0;
                          const projPercentage = total > 0 ? (proj.cost / total) * 100 : 0;
                          if (projAngle > 0.5) {
                            paths.push(
                              <path
                                key={proj.id}
                                d={createArc(angle, angle + projAngle, 18, 46)}
                                fill={lightenColor(selectedObj.color, 0.3 + (pi % 3) * 0.15)}
                                className="transition-all duration-200 hover:brightness-95"
                                onMouseEnter={() => setHoveredSegment({
                                  type: 'project',
                                  label: proj.department,
                                  title: proj.title,
                                  cost: proj.cost,
                                  percentage: projPercentage
                                })}
                                onMouseLeave={() => setHoveredSegment(null)}
                                stroke="white"
                                strokeWidth="0.5"
                              />
                            );

                            // Label for projects > 15%
                            if (projAngle > 54) {
                              const pos = getLabelPos(angle, angle + projAngle, 32);
                              paths.push(
                                <text
                                  key={`label-${proj.id}`}
                                  x={pos.x}
                                  y={pos.y}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  className="pointer-events-none select-none"
                                  style={{
                                    fontSize: '3px',
                                    fontWeight: 600,
                                    fill: '#374151',
                                    transform: 'rotate(90deg)',
                                    transformOrigin: `${pos.x}px ${pos.y}px`
                                  }}
                                >
                                  {Math.round(projPercentage)}%
                                </text>
                              );
                            }
                          }
                          angle += projAngle;
                        });
                      }
                      // ZOOMED VIEW: KRs and Projects (when Objective is selected)
                      else if (selectedObj) {
                        const krs = selectedObj.keyResults.filter(k => k.cost > 0);
                        const total = krs.reduce((sum, k) => sum + k.cost, 0);

                        // Helper to get label position on arc
                        const getLabelPos = (startAngle: number, endAngle: number, radius: number) => {
                          const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180;
                          return {
                            x: centerX + radius * Math.cos(midAngle),
                            y: centerY + radius * Math.sin(midAngle),
                            rotation: (startAngle + endAngle) / 2
                          };
                        };

                        let angle = 0;
                        krs.forEach((kr, ki) => {
                          const krAngle = total > 0 ? (kr.cost / total) * 360 : 0;
                          const krPercentage = total > 0 ? (kr.cost / total) * 100 : 0;
                          if (krAngle > 0.5) {
                            // KR ring (inner)
                            paths.push(
                              <path
                                key={kr.id}
                                d={createArc(angle, angle + krAngle, 18, 32)}
                                fill={lightenColor(selectedObj.color, 0.2 + (ki % 4) * 0.1)}
                                className="cursor-pointer transition-all duration-200 hover:brightness-105"
                                onClick={() => setSelectedCostKR(kr.id)}
                                onMouseEnter={() => setHoveredSegment({
                                  type: 'kr',
                                  label: `${kr.id}`,
                                  title: kr.title,
                                  cost: kr.cost,
                                  percentage: krPercentage
                                })}
                                onMouseLeave={() => setHoveredSegment(null)}
                                stroke="white"
                                strokeWidth="0.5"
                              />
                            );

                            // Label for KRs > 12%
                            if (krAngle > 43) {
                              const pos = getLabelPos(angle, angle + krAngle, 25);
                              paths.push(
                                <text
                                  key={`label-${kr.id}`}
                                  x={pos.x}
                                  y={pos.y}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  className="pointer-events-none select-none"
                                  style={{
                                    fontSize: '3.5px',
                                    fontWeight: 700,
                                    fill: '#374151',
                                    transform: 'rotate(90deg)',
                                    transformOrigin: `${pos.x}px ${pos.y}px`
                                  }}
                                >
                                  {kr.id}
                                </text>
                              );
                            }

                            // Projects ring (outer) for this KR
                            const projects = kr.projects.filter(p => p.cost > 0);
                            const krTotal = projects.reduce((sum, p) => sum + p.cost, 0);
                            let projAngleStart = angle;
                            projects.forEach((proj, pi) => {
                              const projAngle = krTotal > 0 ? (proj.cost / krTotal) * krAngle : 0;
                              const projPercentage = krTotal > 0 ? (proj.cost / krTotal) * 100 : 0;
                              if (projAngle > 0.5) {
                                paths.push(
                                  <path
                                    key={`${kr.id}-${proj.id}`}
                                    d={createArc(projAngleStart, projAngleStart + projAngle, 32, 46)}
                                    fill={lightenColor(selectedObj.color, 0.4 + (pi % 3) * 0.12)}
                                    className="transition-all duration-200 hover:brightness-95"
                                    onMouseEnter={() => setHoveredSegment({
                                      type: 'project',
                                      label: proj.department,
                                      title: proj.title,
                                      cost: proj.cost,
                                      percentage: projPercentage
                                    })}
                                    onMouseLeave={() => setHoveredSegment(null)}
                                    stroke="white"
                                    strokeWidth="0.3"
                                  />
                                );
                              }
                              projAngleStart += projAngle;
                            });
                          }
                          angle += krAngle;
                        });
                      }
                      // FULL VIEW: All three levels
                      else {
                        // Helper to get label position on arc
                        const getLabelPos = (startAngle: number, endAngle: number, radius: number) => {
                          const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180;
                          return {
                            x: centerX + radius * Math.cos(midAngle),
                            y: centerY + radius * Math.sin(midAngle),
                            rotation: (startAngle + endAngle) / 2
                          };
                        };

                        let objAngle = 0;
                        costAllocationData.objectives.forEach((obj, oi) => {
                          const objPct = costAllocationData.totalCost > 0 ? (obj.cost / costAllocationData.totalCost) * 360 : 0;
                          const objPercentage = costAllocationData.totalCost > 0 ? (obj.cost / costAllocationData.totalCost) * 100 : 0;
                          if (objPct > 0.5) {
                            const color = objColors[oi % objColors.length];

                            // Objective ring (inner)
                            paths.push(
                              <path
                                key={obj.id}
                                d={createArc(objAngle, objAngle + objPct, 14, 26)}
                                fill={color}
                                className="cursor-pointer transition-all duration-200 hover:brightness-110"
                                onClick={() => setSelectedCostObjective(obj.id)}
                                onMouseEnter={() => setHoveredSegment({
                                  type: 'objective',
                                  label: `O${obj.index + 1}`,
                                  title: obj.title,
                                  cost: obj.cost,
                                  percentage: objPercentage
                                })}
                                onMouseLeave={() => setHoveredSegment(null)}
                                stroke="white"
                                strokeWidth="0.5"
                              />
                            );

                            // Label for objectives > 12%
                            if (objPct > 43) {
                              const pos = getLabelPos(objAngle, objAngle + objPct, 20);
                              paths.push(
                                <text
                                  key={`label-${obj.id}`}
                                  x={pos.x}
                                  y={pos.y}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  className="pointer-events-none select-none"
                                  style={{
                                    fontSize: '3.5px',
                                    fontWeight: 700,
                                    fill: 'white',
                                    transform: 'rotate(90deg)',
                                    transformOrigin: `${pos.x}px ${pos.y}px`
                                  }}
                                >
                                  {obj.id}
                                </text>
                              );
                            }

                            // KR ring (middle)
                            const krs = obj.keyResults.filter(k => k.cost > 0);
                            const objTotal = krs.reduce((sum, k) => sum + k.cost, 0);
                            let krAngleStart = objAngle;
                            krs.forEach((kr, ki) => {
                              const krAngle = objTotal > 0 ? (kr.cost / objTotal) * objPct : 0;
                              const krPercentage = objTotal > 0 ? (kr.cost / objTotal) * 100 : 0;
                              if (krAngle > 0.5) {
                                paths.push(
                                  <path
                                    key={kr.id}
                                    d={createArc(krAngleStart, krAngleStart + krAngle, 26, 36)}
                                    fill={lightenColor(color, 0.25)}
                                    className="cursor-pointer transition-all duration-200 hover:brightness-105"
                                    onClick={() => { setSelectedCostObjective(obj.id); setSelectedCostKR(kr.id); }}
                                    onMouseEnter={() => setHoveredSegment({
                                      type: 'kr',
                                      label: `${kr.id}`,
                                      title: kr.title,
                                      cost: kr.cost,
                                      percentage: krPercentage
                                    })}
                                    onMouseLeave={() => setHoveredSegment(null)}
                                    stroke="white"
                                    strokeWidth="0.3"
                                  />
                                );

                                // Project ring (outer)
                                const projects = kr.projects.filter(p => p.cost > 0);
                                const krTotal = projects.reduce((sum, p) => sum + p.cost, 0);
                                let projAngleStart = krAngleStart;
                                projects.forEach((proj, pi) => {
                                  const projAngle = krTotal > 0 ? (proj.cost / krTotal) * krAngle : 0;
                                  const projPercentage = krTotal > 0 ? (proj.cost / krTotal) * 100 : 0;
                                  if (projAngle > 0.5) {
                                    paths.push(
                                      <path
                                        key={`${kr.id}-${proj.id}`}
                                        d={createArc(projAngleStart, projAngleStart + projAngle, 36, 46)}
                                        fill={lightenColor(color, 0.45 + (pi % 3) * 0.1)}
                                        className="transition-all duration-200 hover:brightness-95"
                                        onMouseEnter={() => setHoveredSegment({
                                          type: 'project',
                                          label: proj.department,
                                          title: proj.title,
                                          cost: proj.cost,
                                          percentage: projPercentage
                                        })}
                                        onMouseLeave={() => setHoveredSegment(null)}
                                        stroke="white"
                                        strokeWidth="0.2"
                                      />
                                    );
                                  }
                                  projAngleStart += projAngle;
                                });
                              }
                              krAngleStart += krAngle;
                            });
                          }
                          objAngle += objPct;
                        });
                      }

                      return paths;
                    })()}
                  </svg>
                  {/* Center - clickable to zoom out */}
                  <button
                    onClick={() => {
                      if (selectedCostKR) setSelectedCostKR(null);
                      else if (selectedCostObjective) setSelectedCostObjective(null);
                    }}
                    className={`absolute inset-0 m-auto w-20 h-20 lg:w-28 lg:h-28 rounded-full bg-white shadow-md border border-slate-100 flex flex-col items-center justify-center ${
                      selectedCostObjective || selectedCostKR ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                    }`}
                  >
                    <span className="text-base lg:text-xl font-bold text-slate-800">
                      {formatResourceCost(
                        selectedCostKR
                          ? costAllocationData.objectives.find(o => o.id === selectedCostObjective)?.keyResults.find(kr => kr.id === selectedCostKR)?.cost || 0
                          : selectedCostObjective
                            ? costAllocationData.objectives.find(o => o.id === selectedCostObjective)?.cost || 0
                            : costAllocationData.totalCost
                      )}
                    </span>
                    {(selectedCostObjective || selectedCostKR) && (
                      <span className="text-[9px] lg:text-[10px] text-blue-500 font-medium">Click to zoom out</span>
                    )}
                  </button>

                  {/* Hover tooltip */}
                  {hoveredSegment && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg text-xs max-w-[200px] pointer-events-none z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 font-medium">
                          {hoveredSegment.type === 'objective' ? hoveredSegment.label :
                           hoveredSegment.type === 'kr' ? hoveredSegment.label :
                           hoveredSegment.label}
                        </span>
                        <span className="font-semibold">{hoveredSegment.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="text-slate-200 truncate">{hoveredSegment.title}</div>
                      <div className="text-slate-300 font-medium mt-0.5">{formatResourceCost(hoveredSegment.cost)}</div>
                    </div>
                  )}
                </div>

                {/* Legend - contextual based on selection */}
                <div className="flex-1 space-y-1 w-full max-h-[250px] overflow-y-auto text-xs">
                  {(() => {
                    const objColors = ['#3b82f6', '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
                    const selectedObj = selectedCostObjective ? costAllocationData.objectives.find(o => o.id === selectedCostObjective) : null;
                    const selectedKR = selectedCostKR && selectedObj ? selectedObj.keyResults.find(k => k.id === selectedCostKR) : null;

                    // Lighten color helper
                    const lightenColor = (hex: string, percent: number) => {
                      const num = parseInt(hex.slice(1), 16);
                      const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent));
                      const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * percent));
                      const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * percent));
                      return `rgb(${r}, ${g}, ${b})`;
                    };

                    // Level 3: Project breakdown
                    if (selectedKR && selectedObj) {
                      const total = selectedKR.projects.reduce((sum, p) => sum + p.cost, 0);
                      return (
                        <>
                          <div className="mb-2 pb-1.5 border-b border-slate-100">
                            <div className="text-[9px] text-slate-400 mb-0.5">Viewing projects in</div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: selectedObj.color }} />
                              <span className="text-[11px] font-medium text-slate-700 truncate">{selectedKR.id}: {selectedKR.title}</span>
                            </div>
                          </div>
                          {selectedKR.projects.length === 0 ? (
                            <div className="text-[11px] text-slate-400 text-center py-3">No projects in this KR</div>
                          ) : (
                            selectedKR.projects.map((proj, idx) => {
                              const percentage = total > 0 ? ((proj.cost / total) * 100).toFixed(1) : '0';
                              return (
                                <div key={proj.id} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-slate-50">
                                  <div
                                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: lightenColor(selectedObj.color, 0.3 + (idx % 3) * 0.15) }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-500 font-medium mr-1">{proj.department}</span>
                                    <span className="text-[11px] text-slate-700">{proj.title}</span>
                                  </div>
                                  <div className="text-right flex-shrink-0 whitespace-nowrap">
                                    <span className="text-[11px] font-semibold text-slate-700">{formatResourceCost(proj.cost)}</span>
                                    <span className="text-[9px] text-slate-400 ml-1">({percentage}%)</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </>
                      );
                    }

                    // Level 2: KR breakdown
                    if (selectedObj) {
                      const total = selectedObj.keyResults.reduce((sum, kr) => sum + kr.cost, 0);
                      return (
                        <>
                          <div className="mb-2 pb-1.5 border-b border-slate-100">
                            <div className="text-[9px] text-slate-400 mb-0.5">Viewing KRs in</div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: selectedObj.color }} />
                              <span className="text-[11px] font-medium text-slate-700 truncate">{selectedObj.id}: {selectedObj.title}</span>
                            </div>
                          </div>
                          {selectedObj.keyResults.map((kr, idx) => {
                            const percentage = total > 0 ? ((kr.cost / total) * 100).toFixed(1) : '0';
                            const hasProjects = kr.projects && kr.projects.length > 0;
                            return (
                              <button
                                key={kr.id}
                                onClick={() => hasProjects && kr.cost > 0 && setSelectedCostKR(kr.id)}
                                className={`w-full flex items-center gap-2 py-1 px-1.5 rounded transition-colors ${
                                  hasProjects && kr.cost > 0 ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
                                } ${kr.cost === 0 ? 'opacity-50' : ''}`}
                              >
                                <div
                                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: lightenColor(selectedObj.color, 0.2 + (idx % 4) * 0.1) }}
                                />
                                <div className="flex-1 min-w-0 text-left">
                                  <span className="text-[10px] text-slate-400 font-bold mr-1">{kr.id}</span>
                                  <span className="text-[11px] text-slate-700">{kr.title}</span>
                                </div>
                                <div className="text-right flex-shrink-0 whitespace-nowrap">
                                  <span className="text-[11px] font-semibold text-slate-700">{formatResourceCost(kr.cost)}</span>
                                  <span className="text-[9px] text-slate-400 ml-1">({percentage}%)</span>
                                </div>
                                {hasProjects && kr.cost > 0 && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        </>
                      );
                    }

                    // Level 1: Objectives
                    const total = costAllocationData.totalCost;
                    return (
                      <>
                        <div className="mb-2 pb-1.5 border-b border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-slate-600">All Objectives</span>
                            <div className="flex items-center gap-2 text-[9px] text-slate-400">
                              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Obj</span>
                              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> KR</span>
                              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-200" /> Proj</span>
                            </div>
                          </div>
                        </div>
                        {costAllocationData.objectives.map((obj, idx) => {
                          const percentage = total > 0 ? ((obj.cost / total) * 100).toFixed(1) : '0';
                          return (
                            <button
                              key={obj.id}
                              onClick={() => obj.cost > 0 && setSelectedCostObjective(obj.id)}
                              className={`w-full flex items-center gap-2 py-1 px-1.5 rounded transition-colors ${
                                obj.cost > 0 ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-50 cursor-default'
                              }`}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: objColors[idx % objColors.length] }}
                              />
                              <div className="flex-1 min-w-0 text-left">
                                <span className="text-[10px] text-slate-400 font-bold mr-1">{obj.id}</span>
                                <span className="text-[11px] text-slate-700 truncate">{obj.title}</span>
                              </div>
                              <div className="text-right flex-shrink-0 whitespace-nowrap">
                                <span className="text-[11px] font-semibold text-slate-700">{formatResourceCost(obj.cost)}</span>
                                <span className="text-[9px] text-slate-400 ml-1">({percentage}%)</span>
                              </div>
                              {obj.cost > 0 && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── ASSIGNMENTS TAB ─── */}
      {capacitySubTab === 'assignments' && (
        <div className="space-y-4">
          {/* Timeline Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">View:</label>
              <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setTimelineScope('year')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    timelineScope === 'year' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Full Year
                </button>
                <button
                  onClick={() => setTimelineScope('quarter')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    timelineScope === 'quarter' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Quarter
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Year:</label>
              <select
                value={timelineYear}
                onChange={(e) => setTimelineYear(Number(e.target.value))}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {timelineScope === 'quarter' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500">Quarter:</label>
                <select
                  value={timelineQuarter}
                  onChange={(e) => setTimelineQuarter(Number(e.target.value))}
                  className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {[1, 2, 3, 4].map(q => (
                    <option key={q} value={q}>Q{q}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="ml-auto flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500"></span>
                <span className="text-slate-600">&lt;80%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500"></span>
                <span className="text-slate-600">80-100%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500"></span>
                <span className="text-slate-600">&gt;100%</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[300px]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
              />
            </div>

            {/* Skill Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Skill:</label>
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white min-w-[140px]"
              >
                <option value="all">All Skills</option>
                {allSkills.map(skill => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Department:</label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white min-w-[140px]"
              >
                <option value="all">All Departments</option>
                {allDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Project Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Project:</label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white min-w-[180px] max-w-[250px]"
              >
                <option value="all">All Projects</option>
                {allProjects.map(proj => (
                  <option key={proj.id} value={proj.id}>{proj.title}</option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            {(searchQuery || skillFilter !== 'all' || deptFilter !== 'all' || projectFilter !== 'all' || filterPersons.length > 0) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSkillFilter('all');
                  setDeptFilter('all');
                  setProjectFilter('all');
                  if (onClearFilter) onClearFilter();
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Clear Filters
              </button>
            )}
          </div>

          {/* Assessment navigation filter indicator */}
          {filterPersons.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-blue-700">
                  Filtered from Assessment: Showing <strong>{filterPersons.join(', ')}</strong>
                </span>
              </div>
              <button
                onClick={onClearFilter}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Clear
              </button>
            </div>
          )}

          {/* Allocation Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header with time periods */}
            <div className="grid grid-cols-[200px_1fr] border-b border-slate-200">
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200">
                Team Member
              </div>
              <div className="flex">
                {allocationTimePeriods.map((period, idx) => (
                  <div
                    key={period.key}
                    className={`flex-1 px-1 py-2 text-center text-[10px] font-medium text-slate-500 ${
                      idx < allocationTimePeriods.length - 1 ? 'border-r border-slate-100' : ''
                    }`}
                  >
                    {period.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Person rows */}
            <div className="divide-y divide-slate-100">
              {filteredAllocationTimelineData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 text-sm">
                    {(searchQuery || skillFilter !== 'all' || deptFilter !== 'all' || projectFilter !== 'all')
                      ? 'No team members match your filters'
                      : 'No team members with assignments'
                    }
                  </p>
                  {(searchQuery || skillFilter !== 'all' || deptFilter !== 'all' || projectFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSkillFilter('all');
                        setDeptFilter('all');
                        setProjectFilter('all');
                      }}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                filteredAllocationTimelineData.map(({ person, periodAllocations, segments, maxAllocation, hasOverAllocation }) => (
                  <div key={person.id}>
                    {/* Main row */}
                    <button
                      onClick={() => setExpandedTimelinePerson(expandedTimelinePerson === person.id ? null : person.id)}
                      className={`w-full grid grid-cols-[200px_1fr] hover:bg-slate-50 transition-colors ${
                        expandedTimelinePerson === person.id ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      {/* Person info */}
                      <div className="px-4 py-3 flex items-center gap-2.5 border-r border-slate-100">
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(person.name)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                          {getInitials(person.name)}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-slate-800 truncate">{person.name}</p>
                            {hasOverAllocation && (
                              <span className="flex-shrink-0 px-1 py-0.5 rounded bg-red-100 text-red-600 text-[9px] font-bold flex items-center gap-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                OVER
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">{person.role}</p>
                        </div>
                      </div>

                      {/* Allocation bars */}
                      <div className="relative flex items-center px-1 py-2">
                        {/* Background grid */}
                        <div className="absolute inset-0 flex">
                          {allocationTimePeriods.map((period, idx) => (
                            <div
                              key={period.key}
                              className={`flex-1 ${idx < allocationTimePeriods.length - 1 ? 'border-r border-slate-100' : ''}`}
                            />
                          ))}
                        </div>

                        {/* Allocation segments */}
                        <div className="relative w-full h-8 flex items-center">
                          {segments.map((segment, sIdx) => {
                            const startPercent = (segment.startPeriodIndex / allocationTimePeriods.length) * 100;
                            const widthPercent = ((segment.endPeriodIndex - segment.startPeriodIndex + 1) / allocationTimePeriods.length) * 100;
                            const allocationPercent = Math.round(segment.allocation * 100);

                            // Color based on allocation level
                            let bgColor = 'bg-emerald-500';
                            if (segment.allocation > 1) bgColor = 'bg-red-500';
                            else if (segment.allocation >= 0.8) bgColor = 'bg-amber-500';
                            else if (segment.allocation >= 0.5) bgColor = 'bg-emerald-500';
                            else bgColor = 'bg-emerald-400';

                            return (
                              <div
                                key={sIdx}
                                className={`absolute h-6 ${bgColor} rounded flex items-center justify-center transition-all hover:h-7 hover:shadow-md`}
                                style={{
                                  left: `${startPercent}%`,
                                  width: `${Math.max(widthPercent - 0.5, 2)}%`,
                                }}
                                title={`${allocationPercent}% allocated`}
                              >
                                <span className="text-[10px] font-bold text-white drop-shadow-sm">
                                  {allocationPercent}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail: individual projects */}
                    {expandedTimelinePerson === person.id && (
                      <div className="bg-slate-50 border-t border-slate-200">
                        <div className="px-4 py-2 border-b border-slate-100">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Projects ({person.assignments.length})
                          </span>
                        </div>
                        {person.assignments.length === 0 ? (
                          <div className="px-4 py-4 text-xs text-slate-400 italic">
                            No project assignments
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {person.assignments.map(assignment => {
                              const proj = assignment.project;
                              const projStart = proj.startDate ? new Date(proj.startDate) : null;
                              const projEnd = proj.endDate ? new Date(proj.endDate) : null;
                              const timelineStart = allocationTimePeriods[0]?.startDate;
                              const timelineEnd = allocationTimePeriods[allocationTimePeriods.length - 1]?.endDate;

                              let leftPercent = 0;
                              let widthPercent = 100;
                              let isVisible = true;

                              if (projStart && projEnd && timelineStart && timelineEnd) {
                                const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);

                                // Check if project overlaps with timeline
                                if (projEnd < timelineStart || projStart > timelineEnd) {
                                  isVisible = false;
                                } else {
                                  const clampedStart = projStart < timelineStart ? timelineStart : projStart;
                                  const clampedEnd = projEnd > timelineEnd ? timelineEnd : projEnd;
                                  const startOffset = (clampedStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
                                  const duration = (clampedEnd.getTime() - clampedStart.getTime()) / (1000 * 60 * 60 * 24);
                                  leftPercent = (startOffset / totalDays) * 100;
                                  widthPercent = Math.max(3, (duration / totalDays) * 100);
                                }
                              }

                              const statusColors: Record<string, string> = {
                                'To Do': 'bg-slate-400',
                                'Doing': 'bg-blue-500',
                                'Done': 'bg-emerald-500'
                              };

                              return (
                                <div key={proj.id} className="grid grid-cols-[200px_1fr]">
                                  {/* Project info */}
                                  <div className="px-4 py-2 pl-12 border-r border-slate-100">
                                    <p className="text-xs font-medium text-slate-700 truncate">{proj.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                        proj.status === 'Done' ? 'bg-emerald-100 text-emerald-700'
                                          : proj.status === 'Doing' ? 'bg-blue-100 text-blue-700'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}>{proj.status}</span>
                                    </div>
                                  </div>

                                  {/* Project timeline bar */}
                                  <div className="relative flex items-center px-1 py-2">
                                    {/* Background grid */}
                                    <div className="absolute inset-0 flex">
                                      {allocationTimePeriods.map((period, idx) => (
                                        <div
                                          key={period.key}
                                          className={`flex-1 ${idx < allocationTimePeriods.length - 1 ? 'border-r border-slate-100' : ''}`}
                                        />
                                      ))}
                                    </div>

                                    {/* Project bar */}
                                    {isVisible && (
                                      <div
                                        className={`absolute h-5 ${statusColors[proj.status] || 'bg-slate-400'} rounded-sm flex items-center px-2 opacity-80`}
                                        style={{
                                          left: `${leftPercent}%`,
                                          width: `${Math.max(widthPercent - 0.5, 3)}%`,
                                        }}
                                      >
                                        {widthPercent > 10 && (
                                          <span className="text-[9px] font-bold text-white truncate">
                                            {Math.round(parseAllocationValue(assignment.allocation) * 100)}%
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {!isVisible && projStart && projEnd && (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[10px] text-slate-400 italic">
                                          {projEnd < (timelineStart || new Date()) ? 'Before this period' : 'After this period'}
                                        </span>
                                      </div>
                                    )}
                                    {!projStart || !projEnd ? (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[10px] text-slate-400 italic">No dates set</span>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>
                {filteredAllocationTimelineData.length} team members
                {filteredAllocationTimelineData.filter(d => d.hasOverAllocation).length > 0 && (
                  <span className="ml-2 text-red-600 font-medium">
                    • {filteredAllocationTimelineData.filter(d => d.hasOverAllocation).length} over-allocated
                  </span>
                )}
              </span>
              <span>
                {timelineScope === 'year' ? `FY ${timelineYear}` : `Q${timelineQuarter} ${timelineYear}`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// View mode type
type ViewMode = 'cards' | 'tree' | 'timeline' | 'department' | 'explorer' | 'resources' | 'allocation' | 'assignments' | 'assessment';

// View configuration
const VIEW_CONFIG: { key: ViewMode; label: string; icon: string }[] = [
  { key: 'explorer', label: 'Strategy Map', icon: 'explorer' },
  { key: 'tree', label: 'Tree View', icon: 'tree' },
  { key: 'allocation', label: 'Allocation', icon: 'allocation' },
  { key: 'assignments', label: 'Capacity', icon: 'assignments' },
  { key: 'timeline', label: 'Timeline', icon: 'timeline' },
  { key: 'cards', label: 'Cards', icon: 'cards' },
  { key: 'department', label: 'Department', icon: 'department' },
];

const DEFAULT_VISIBLE_VIEWS: ViewMode[] = ['explorer', 'tree'];

// Get initial visible views from localStorage
const getInitialVisibleViews = (): ViewMode[] => {
  if (typeof window === 'undefined') return DEFAULT_VISIBLE_VIEWS;
  try {
    const stored = localStorage.getItem('workspace-visible-views');
    if (stored) {
      const parsed = JSON.parse(stored) as ViewMode[];
      // Ensure at least one view is visible
      return parsed.length > 0 ? parsed : DEFAULT_VISIBLE_VIEWS;
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_VISIBLE_VIEWS;
};

const WorkspaceView: React.FC<WorkspaceViewProps> = ({ priorities: objectives, setObjectives, companyName, personnel, setPersonnel, dependencies, setDependencies }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('explorer');
  const [visibleViews, setVisibleViews] = useState<ViewMode[]>(getInitialVisibleViews);
  const [showViewSettings, setShowViewSettings] = useState(false);
  const viewSettingsRef = useRef<HTMLDivElement>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [editingObjective, setEditingObjective] = useState<string | null>(null);
  const [editingKR, setEditingKR] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [newObjective, setNewObjective] = useState('');
  const [showAddObjective, setShowAddObjective] = useState(false);
  const [addingKRToObjective, setAddingKRToObjective] = useState<string | null>(null);
  const [newKRTitle, setNewKRTitle] = useState('');
  const [addingProjectToKR, setAddingProjectToKR] = useState<string | null>(null);
  const [newProjectDept, setNewProjectDept] = useState('');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [addingHeadcountToProject, setAddingHeadcountToProject] = useState<string | null>(null);
  const [showPersonnelPicker, setShowPersonnelPicker] = useState<string | null>(null);
  const [editingTimeframe, setEditingTimeframe] = useState<string | null>(null);

  // Tree view inline CRUD state
  const [treeEditingItem, setTreeEditingItem] = useState<string | null>(null);
  const [treeEditValue, setTreeEditValue] = useState('');
  const [treeConfirmingDelete, setTreeConfirmingDelete] = useState<{
    id: string; type: 'objective' | 'keyResult' | 'project' | 'headcount';
    objectiveId: string; krId?: string; projectId?: string; label: string;
  } | null>(null);

  // OKR Analysis state (rendered inside Assessment view)
  const [insights, setInsights] = useState<ExecutionInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showStrategicOverview, setShowStrategicOverview] = useState(false);

  // Assessment state
  const assessmentEnabled = (() => { try { return localStorage.getItem('pulley-show-assessment') === 'true'; } catch { return false; } })();
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{ alert: AssessmentAlert; action: SuggestedAction } | null>(null);
  const [alertCategoryFilter, setAlertCategoryFilter] = useState<'all' | 'resource' | 'timeline' | 'coverage' | 'alignment'>('all');
  const [showAlertOverlay, setShowAlertOverlay] = useState(false);
  const [showAssessmentPopover, setShowAssessmentPopover] = useState(false);
  const assessmentPopoverRef = useRef<HTMLDivElement>(null);
  const [overlayCategories, setOverlayCategories] = useState<Set<string>>(
    new Set(['resource', 'timeline', 'alignment', 'coverage'])
  );

  // Navigation context for cross-view filtering (set by assessment actions)
  const [capacityFilterPersons, setCapacityFilterPersons] = useState<string[]>([]);
  const [timelineHighlightKR, setTimelineHighlightKR] = useState<{ krId: string; deadline: string } | null>(null);

  // Tree view detail panel state
  const [treeSelectedItem, setTreeSelectedItem] = useState<SelectedItem | null>(null);
  const [showTreeDetailPanel, setShowTreeDetailPanel] = useState(false);
  const [treeAutoAddMember, setTreeAutoAddMember] = useState(false);

  // Tree view expansion state (preserved across view switches)
  const [treeExpandedObjectives, setTreeExpandedObjectives] = useState<Set<string>>(new Set());
  const [treeExpandedKRs, setTreeExpandedKRs] = useState<Set<string>>(new Set());
  const [treeExpandedProjects, setTreeExpandedProjects] = useState<Set<string>>(new Set());
  const [treeExpandedDKRs, setTreeExpandedDKRs] = useState<Set<string>>(new Set());
  const [treeExpandedTeams, setTreeExpandedTeams] = useState<Set<string>>(new Set());

  // Timeline view detail panel state
  const [timelineSelectedItem, setTimelineSelectedItem] = useState<SelectedItem | null>(null);
  const [showTimelineDetailPanel, setShowTimelineDetailPanel] = useState(false);

  // Persist visible views to localStorage
  useEffect(() => {
    localStorage.setItem('workspace-visible-views', JSON.stringify(visibleViews));
  }, [visibleViews]);

  // Auto-enable alert overlay when assessment results arrive
  useEffect(() => {
    if (assessmentResult && assessmentResult.summary.active > 0) {
      setShowAlertOverlay(true);
    }
  }, [assessmentResult]);

  // Clear timeline detail panel when leaving timeline view
  useEffect(() => {
    if (viewMode !== 'timeline') {
      setTimelineSelectedItem(null);
      setShowTimelineDetailPanel(false);
    }
  }, [viewMode]);

  // Click outside to close view settings dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewSettingsRef.current && !viewSettingsRef.current.contains(event.target as Node)) {
        setShowViewSettings(false);
      }
    };
    if (showViewSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showViewSettings]);

  // Click outside to close assessment popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assessmentPopoverRef.current && !assessmentPopoverRef.current.contains(event.target as Node)) {
        setShowAssessmentPopover(false);
      }
    };
    if (showAssessmentPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAssessmentPopover]);

  // Toggle view visibility
  const toggleViewVisibility = (view: ViewMode) => {
    setVisibleViews(prev => {
      if (prev.includes(view)) {
        // Don't allow hiding the last visible view
        if (prev.length === 1) return prev;
        // If hiding the current view, switch to another visible one
        if (viewMode === view) {
          const remaining = prev.filter(v => v !== view);
          setViewMode(remaining[0]);
        }
        return prev.filter(v => v !== view);
      } else {
        return [...prev, view];
      }
    });
  };

  const handleUpdatePersonnel = useCallback((id: string, updates: Partial<Personnel>) => {
    setPersonnel(personnel.map(p => p.id === id ? { ...p, ...updates } : p));
  }, [personnel, setPersonnel]);

  const handleUpdateProject = useCallback((
    objId: string, krId: string, projectId: string, updates: Partial<DepartmentalProject>
  ) => {
    setObjectives(prev => prev.map(o => {
      if (o.id !== objId) return o;
      return {
        ...o,
        keyResults: o.keyResults.map(kr => {
          if (kr.id !== krId) return kr;
          return {
            ...kr,
            departmentalProjects: (kr.departmentalProjects || []).map(p =>
              p.id === projectId ? { ...p, ...updates } : p
            ),
          };
        }),
      };
    }));
  }, []);

  const handleUpdateTeam = useCallback((
    objId: string, krId: string, projectId: string, teamId: string, updates: Partial<Team>
  ) => {
    setObjectives(prev => prev.map(o => {
      if (o.id !== objId) return o;
      return {
        ...o,
        keyResults: o.keyResults.map(kr => {
          if (kr.id !== krId) return kr;
          return {
            ...kr,
            departmentalProjects: (kr.departmentalProjects || []).map(p => {
              if (p.id !== projectId) return p;
              return {
                ...p,
                teams: (p.teams || []).map(t =>
                  t.id === teamId ? { ...t, ...updates } : t
                ),
              };
            }),
          };
        }),
      };
    }));
  }, []);

  const handleUpdateKeyResult = useCallback((objId: string, krId: string, updates: Partial<KeyResult>) => {
    setObjectives(prev => prev.map(o => {
      if (o.id !== objId) return o;
      return {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? { ...kr, ...updates } : kr
        ),
      };
    }));
  }, []);

  const handleUpdateDepartmentalKeyResult = useCallback((objId: string, krId: string, dkrId: string, updates: Partial<DepartmentalKeyResult>) => {
    setObjectives(prev => prev.map(o => {
      if (o.id !== objId) return o;
      return {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? {
            ...kr,
            departmentalKeyResults: (kr.departmentalKeyResults || []).map(dkr =>
              dkr.id === dkrId ? { ...dkr, ...updates } : dkr
            ),
          } : kr
        ),
      };
    }));
  }, []);

  const handleUpdateObjective = useCallback((objId: string, updates: Partial<Objective>) => {
    setObjectives(prev => prev.map(o => o.id === objId ? { ...o, ...updates } : o));
  }, []);

  const handleDeleteObjective = useCallback((objId: string) => {
    setObjectives(prev => prev.filter(o => o.id !== objId));
  }, []);

  const handleDeleteKeyResult = useCallback((objId: string, krId: string) => {
    setObjectives(prev => prev.map(o =>
      o.id === objId ? { ...o, keyResults: o.keyResults.filter(kr => kr.id !== krId) } : o
    ));
  }, []);

  const handleDeleteProject = useCallback((objId: string, krId: string, projectId: string) => {
    setObjectives(prev => prev.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? { ...kr, departmentalProjects: (kr.departmentalProjects || []).filter(p => p.id !== projectId) } : kr
        )
      } : o
    ));
  }, []);

  const handleAddKeyResult = useCallback((objId: string, title: string) => {
    const newKR: KeyResult = { id: `kr-${Date.now()}`, title, departmentalProjects: [] };
    setObjectives(prev => prev.map(o =>
      o.id === objId ? { ...o, keyResults: [...o.keyResults, newKR] } : o
    ));
  }, []);

  const handleAddProject = useCallback((objId: string, krId: string, title: string) => {
    const newProject: DepartmentalProject = { id: `proj-${Date.now()}`, department: '', title, status: 'To Do', progress: 0, headcount: [] };
    setObjectives(prev => prev.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? { ...kr, departmentalProjects: [...(kr.departmentalProjects || []), newProject] } : kr
        )
      } : o
    ));
  }, []);

  const handleTreeAddMember = useCallback((projId: string) => {
    let projTitle = 'Project';
    for (const obj of objectives) {
      for (const kr of obj.keyResults) {
        const p = (kr.departmentalProjects || []).find(dp => dp.id === projId);
        if (p) { projTitle = p.title; break; }
      }
    }
    setTreeSelectedItem({ id: projId, type: 'project', label: projTitle });
    setShowTreeDetailPanel(true);
    setTreeAutoAddMember(true);
  }, [objectives]);

  // Assessment handlers
  const toggleOverlayCategory = (cat: string) => {
    setOverlayCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleRunAssessment = async () => {
    setIsAssessing(true);
    setLoadingInsights(true);
    try {
      const planSummary = JSON.stringify(objectives.map(o => ({
        objective: o.title,
        keyResults: o.keyResults.map(kr => ({
          title: kr.title,
          projects: kr.departmentalProjects?.map(dp => ({
            title: dp.title,
            dept: dp.department,
            status: dp.status,
            resources: dp.resources?.map(r => `${r.label}: ${r.value}`)
          }))
        }))
      })));

      const [assessmentSettled, insightsSettled] = await Promise.allSettled([
        runAssessment(objectives, personnel, dependencies),
        generateExecutionInsights(companyName, planSummary),
      ]);

      if (assessmentSettled.status === 'fulfilled') setAssessmentResult(assessmentSettled.value);
      if (insightsSettled.status === 'fulfilled') setInsights(insightsSettled.value);
      setExpandedAlerts(new Set());
    } finally {
      setIsAssessing(false);
      setLoadingInsights(false);
    }
  };

  const handleDismissAlert = (alertId: string, reason?: string) => {
    if (!assessmentResult) return;
    setAssessmentResult({
      ...assessmentResult,
      alerts: assessmentResult.alerts.map(a =>
        a.id === alertId
          ? { ...a, status: 'dismissed' as const, dismissedAt: new Date().toISOString(), dismissedReason: reason }
          : a
      ),
      summary: {
        ...assessmentResult.summary,
        active: assessmentResult.summary.active - 1,
        dismissed: assessmentResult.summary.dismissed + 1,
      },
    });
  };

  const handleApplyAction = (alert: AssessmentAlert, action: SuggestedAction) => {
    // Handle navigation actions differently - they don't modify data
    if (action.type === 'view_capacity') {
      // Switch to Capacity view and set person filter
      setViewMode('assignments');
      setCapacityFilterPersons(action.payload.filterPersonNames || []);
      setConfirmAction(null);
      return;
    }

    if (action.type === 'view_timeline') {
      // Switch to Timeline view and set KR highlight
      setViewMode('timeline');
      if (action.payload.filterKrId && action.payload.highlightDeadline) {
        setTimelineHighlightKR({
          krId: action.payload.filterKrId,
          deadline: action.payload.highlightDeadline,
        });
      }
      setConfirmAction(null);
      return;
    }

    // Apply the action to objectives
    const updatedObjectives = applyAction(action, objectives);
    setObjectives(updatedObjectives);

    // Mark alert as resolved
    if (assessmentResult) {
      setAssessmentResult({
        ...assessmentResult,
        alerts: assessmentResult.alerts.map(a =>
          a.id === alert.id
            ? { ...a, status: 'resolved' as const, resolvedAt: new Date().toISOString(), resolvedAction: action.label }
            : a
        ),
        summary: {
          ...assessmentResult.summary,
          active: assessmentResult.summary.active - 1,
          resolved: assessmentResult.summary.resolved + 1,
        },
      });
    }

    // Close confirmation dialog
    setConfirmAction(null);
  };

  const toggleAlertExpanded = (alertId: string) => {
    setExpandedAlerts(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  // Chatbot state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<{
    type: 'kr' | 'project' | 'headcount' | 'team';
    id: string;
    sourceObjectiveId: string;
    sourceKRId?: string;
    sourceProjectId?: string;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    type: 'objective' | 'kr' | 'project';
    id: string;
    objectiveId?: string;
    krId?: string;
  } | null>(null);

  // Resource alerts state - track dismissed alerts by project ID
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Dependency creation state
  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [dependencySource, setDependencySource] = useState<{
    type: 'objective' | 'keyResult' | 'project';
    id: string;
    title: string;
  } | null>(null);

  // Add a dependency
  const addDependency = (
    targetType: 'objective' | 'keyResult' | 'project',
    targetId: string,
    dependencyType: 'blocks' | 'depends_on' | 'relates_to' = 'depends_on'
  ) => {
    if (!dependencySource) return;

    // Check if dependency already exists
    const exists = dependencies.some(d =>
      d.sourceType === dependencySource.type &&
      d.sourceId === dependencySource.id &&
      d.targetType === targetType &&
      d.targetId === targetId
    );

    if (exists) return;

    const newDep: Dependency = {
      id: `dep-${Date.now()}`,
      sourceType: dependencySource.type,
      sourceId: dependencySource.id,
      targetType,
      targetId,
      dependencyType,
    };

    setDependencies([...dependencies, newDep]);
    setShowDependencyModal(false);
    setDependencySource(null);
  };

  // Remove a dependency
  const removeDependency = (depId: string) => {
    setDependencies(dependencies.filter(d => d.id !== depId));
  };

  // Get dependencies for an element
  const getDependenciesFor = (type: 'objective' | 'keyResult' | 'project', id: string) => {
    return dependencies.filter(d =>
      (d.sourceType === type && d.sourceId === id) ||
      (d.targetType === type && d.targetId === id)
    );
  };

  // Open dependency modal
  const openDependencyModal = (type: 'objective' | 'keyResult' | 'project', id: string, title: string) => {
    setDependencySource({ type, id, title });
    setShowDependencyModal(true);
  };

  // Extract all unique departments from projects (both direct and DKR-nested)
  const allDepartments = React.useMemo(() => {
    const depts = new Set<string>();
    objectives.forEach(obj => {
      obj.keyResults.forEach(kr => {
        kr.departmentalProjects?.forEach(proj => {
          if (proj.department) depts.add(proj.department);
        });
        kr.departmentalKeyResults?.forEach(dkr => {
          if (dkr.department) depts.add(dkr.department);
          dkr.departmentalProjects?.forEach(proj => {
            if (proj.department) depts.add(proj.department);
          });
        });
      });
    });
    return Array.from(depts).sort();
  }, [objectives]);

  // Get all unique people from project headcounts (shared across views)
  const allPeople = React.useMemo(() => {
    const peopleByName = new Map<string, { name: string }>();
    const addHeadcount = (proj: DepartmentalProject) => {
      (proj.headcount || []).forEach(hc => {
        if (hc.name && !peopleByName.has(hc.name)) {
          peopleByName.set(hc.name, { name: hc.name });
        }
      });
    };
    objectives.forEach(obj => {
      obj.keyResults.forEach(kr => {
        (kr.departmentalProjects || []).forEach(addHeadcount);
        (kr.departmentalKeyResults || []).forEach(dkr => {
          (dkr.departmentalProjects || []).forEach(addHeadcount);
        });
      });
    });
    return Array.from(peopleByName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [objectives]);

  // Filter objectives based on department and person filters (shared across views)
  const filteredObjectives = React.useMemo(() => {
    if (deptFilter === 'all' && personFilter === 'all') {
      return objectives;
    }

    const projMatch = (proj: DepartmentalProject) => {
      const deptMatch = deptFilter === 'all' || proj.department === deptFilter;
      const personMatch = personFilter === 'all' ||
        (proj.headcount || []).some(hc => hc.name === personFilter);
      return deptMatch && personMatch;
    };

    const dkrMatch = (dkr: DepartmentalKeyResult) => {
      const deptMatch = deptFilter === 'all' || dkr.department === deptFilter;
      const personMatch = personFilter === 'all' ||
        (dkr.departmentalProjects || []).some(proj =>
          (proj.headcount || []).some(hc => hc.name === personFilter)
        );
      return deptMatch && personMatch;
    };

    return objectives
      .map(obj => {
        const filteredKRs = obj.keyResults
          .map(kr => {
            const filteredProjects = (kr.departmentalProjects || []).filter(projMatch);
            const filteredDKRs = (kr.departmentalKeyResults || []).filter(dkrMatch);
            if (filteredProjects.length === 0 && filteredDKRs.length === 0) return null;
            return {
              ...kr,
              departmentalProjects: filteredProjects.length > 0 ? filteredProjects : undefined,
              departmentalKeyResults: filteredDKRs.length > 0 ? filteredDKRs : undefined,
            };
          })
          .filter((kr): kr is KeyResult => kr !== null);

        return filteredKRs.length > 0 ? { ...obj, keyResults: filteredKRs } : null;
      })
      .filter((obj): obj is Objective => obj !== null);
  }, [objectives, deptFilter, personFilter]);

  // Type for project with context
  type ProjectWithContext = { project: DepartmentalProject; objective: Objective; keyResult: KeyResult };

  // Get all projects with their parent context (both direct and DKR-nested)
  const allProjectsWithContext = React.useMemo((): ProjectWithContext[] => {
    const projects: ProjectWithContext[] = [];
    objectives.forEach(obj => {
      obj.keyResults.forEach(kr => {
        kr.departmentalProjects?.forEach(proj => {
          projects.push({ project: proj, objective: obj, keyResult: kr });
        });
        kr.departmentalKeyResults?.forEach(dkr => {
          dkr.departmentalProjects?.forEach(proj => {
            projects.push({ project: proj, objective: obj, keyResult: kr });
          });
        });
      });
    });
    return projects;
  }, [objectives]);

  // Filter projects by department
  const filteredProjectsByDept = React.useMemo((): ProjectWithContext[] => {
    if (departmentFilter === 'all') return allProjectsWithContext;
    return allProjectsWithContext.filter(p => p.project.department === departmentFilter);
  }, [allProjectsWithContext, departmentFilter]);

  // Group projects by department
  const projectsByDepartment = React.useMemo((): Record<string, ProjectWithContext[]> => {
    const grouped: Record<string, ProjectWithContext[]> = {};
    const projectsToGroup = departmentFilter === 'all' ? allProjectsWithContext : filteredProjectsByDept;

    projectsToGroup.forEach(item => {
      const dept = item.project.department || 'Unassigned';
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(item);
    });
    return grouped;
  }, [allProjectsWithContext, filteredProjectsByDept, departmentFilter]);

  // Imported from utils/strategyHelpers

  // Detail data for tree view panel
  const treeDetailData = useDetailData(
    treeSelectedItem,
    filteredObjectives,
    objectives,
    dependencies,
    getProjectResourceStatus,
    personnel
  );

  // Detail data for timeline view panel
  const timelineDetailData = useDetailData(
    timelineSelectedItem,
    filteredObjectives,
    objectives,
    dependencies,
    getProjectResourceStatus,
    personnel
  );

  // Build element-to-alerts lookup map for tree overlay
  type ElementAlertSummary = {
    count: number;
    maxSeverity: 'info' | 'warning' | 'critical';
    alerts: AssessmentAlert[];
  };

  const alertsByElement = useMemo((): Map<string, ElementAlertSummary> => {
    const map = new Map<string, ElementAlertSummary>();
    if (!assessmentResult) return map;
    const sevOrder: Record<string, number> = { info: 0, warning: 1, critical: 2 };

    for (const alert of assessmentResult.alerts) {
      if (alert.status !== 'active') continue;
      if (!overlayCategories.has(alert.category)) continue;
      for (const el of alert.affectedElements) {
        const key = `${el.type}:${el.id}`;
        const existing = map.get(key);
        if (existing) {
          existing.count++;
          existing.alerts.push(alert);
          if (sevOrder[alert.severity] > sevOrder[existing.maxSeverity]) {
            existing.maxSeverity = alert.severity;
          }
        } else {
          map.set(key, { count: 1, maxSeverity: alert.severity, alerts: [alert] });
        }
      }
    }
    return map;
  }, [assessmentResult, overlayCategories]);

  const getElementAlerts = (data: DetailData | null): AssessmentAlert[] => {
    if (!data || alertsByElement.size === 0) return [];
    let key = '';
    if (data.type === 'objective') key = `objective:${data.obj.id}`;
    else if (data.type === 'keyResult') key = `keyResult:${data.kr.id}`;
    else if (data.type === 'project') key = `project:${data.proj.id}`;
    else if (data.type === 'person') key = `person:${data.person.name}`;
    return alertsByElement.get(key)?.alerts ?? [];
  };

  // Build cascaded alert map — rolls alerts up from projects → KRs → objectives
  const cascadedAlertsByElement = useMemo((): Map<string, CascadedAlertSummary> => {
    const map = new Map<string, CascadedAlertSummary>();
    if (!assessmentResult) return map;

    const sevOrder: Record<string, number> = { info: 0, warning: 1, critical: 2 };
    const sevFromNum = (n: number): 'info' | 'warning' | 'critical' =>
      n >= 2 ? 'critical' : n >= 1 ? 'warning' : 'info';

    // Phase 1: Build hierarchy index
    const projectToKR = new Map<string, string>();
    const krToObjective = new Map<string, string>();
    const krToProjects = new Map<string, string[]>();
    const objToKRs = new Map<string, string[]>();
    const elementNames = new Map<string, string>();

    for (const obj of objectives) {
      objToKRs.set(obj.id, obj.keyResults.map(kr => kr.id));
      elementNames.set(`objective:${obj.id}`, obj.title);
      for (const kr of obj.keyResults) {
        krToObjective.set(kr.id, obj.id);
        elementNames.set(`keyResult:${kr.id}`, kr.title);
        const projIds: string[] = [];
        for (const proj of kr.departmentalProjects || []) {
          projectToKR.set(proj.id, kr.id);
          projIds.push(proj.id);
          elementNames.set(`project:${proj.id}`, proj.title);
        }
        krToProjects.set(kr.id, projIds);
      }
    }

    // Phase 2: Collect unique alerts per element using Sets
    const alertSetsPerElement = new Map<string, Set<string>>();
    const alertById = new Map<string, AssessmentAlert>();

    const addAlert = (key: string, alertId: string) => {
      let set = alertSetsPerElement.get(key);
      if (!set) { set = new Set(); alertSetsPerElement.set(key, set); }
      set.add(alertId);
    };

    for (const alert of assessmentResult.alerts) {
      if (alert.status !== 'active') continue;
      if (!overlayCategories.has(alert.category)) continue;
      alertById.set(alert.id, alert);

      for (const el of alert.affectedElements) {
        const directKey = `${el.type}:${el.id}`;
        addAlert(directKey, alert.id);

        // Cascade project alerts up to KR and Objective
        if (el.type === 'project') {
          const parentKRId = projectToKR.get(el.id);
          if (parentKRId) {
            addAlert(`keyResult:${parentKRId}`, alert.id);
            const parentObjId = krToObjective.get(parentKRId);
            if (parentObjId) addAlert(`objective:${parentObjId}`, alert.id);
          }
        }

        // Cascade KR alerts up to Objective
        if (el.type === 'keyResult') {
          const parentObjId = krToObjective.get(el.id);
          if (parentObjId) addAlert(`objective:${parentObjId}`, alert.id);
        }
      }
    }

    // Phase 3: Build CascadedAlertSummary for each element
    for (const [key, alertIdSet] of alertSetsPerElement) {
      const alerts = [...alertIdSet].map(id => alertById.get(id)!);
      const [elType, elId] = [key.substring(0, key.indexOf(':')), key.substring(key.indexOf(':') + 1)];

      // Direct alerts = those whose affectedElements explicitly include this element
      const directAlerts = alerts.filter(a =>
        a.affectedElements.some(ae => ae.type === elType && ae.id === elId)
      );

      let totalMaxSev = 0;
      for (const a of alerts) totalMaxSev = Math.max(totalMaxSev, sevOrder[a.severity]);

      // Build childIssues for objectives (list KRs) and KRs (list projects)
      const childIssues: ChildIssueSummary[] = [];

      if (elType === 'objective') {
        for (const krId of objToKRs.get(elId) || []) {
          const krAlertSet = alertSetsPerElement.get(`keyResult:${krId}`);
          if (krAlertSet && krAlertSet.size > 0) {
            let krMaxSev = 0;
            for (const aId of krAlertSet) {
              const a = alertById.get(aId)!;
              krMaxSev = Math.max(krMaxSev, sevOrder[a.severity]);
            }
            childIssues.push({
              type: 'keyResult', id: krId,
              name: elementNames.get(`keyResult:${krId}`) || 'Unknown',
              alertCount: krAlertSet.size, maxSeverity: sevFromNum(krMaxSev),
            });
          }
        }
      }

      if (elType === 'keyResult') {
        for (const projId of krToProjects.get(elId) || []) {
          const projAlertSet = alertSetsPerElement.get(`project:${projId}`);
          if (projAlertSet && projAlertSet.size > 0) {
            let projMaxSev = 0;
            for (const aId of projAlertSet) {
              const a = alertById.get(aId)!;
              projMaxSev = Math.max(projMaxSev, sevOrder[a.severity]);
            }
            childIssues.push({
              type: 'project', id: projId,
              name: elementNames.get(`project:${projId}`) || 'Unknown',
              alertCount: projAlertSet.size, maxSeverity: sevFromNum(projMaxSev),
            });
          }
        }
      }

      map.set(key, {
        directCount: directAlerts.length,
        directAlerts,
        totalCount: alerts.length,
        totalMaxSeverity: sevFromNum(totalMaxSev),
        childIssues,
      });
    }

    return map;
  }, [assessmentResult, objectives, overlayCategories]);

  const getChildIssues = (data: DetailData | null): ChildIssueSummary[] => {
    if (!data) return [];
    let key = '';
    if (data.type === 'objective') key = `objective:${data.obj.id}`;
    else if (data.type === 'keyResult') key = `keyResult:${data.kr.id}`;
    else return [];
    return cascadedAlertsByElement.get(key)?.childIssues ?? [];
  };

  // Reset tree panel when changing filters
  useEffect(() => {
    setTreeSelectedItem(null);
    setShowTreeDetailPanel(false);
  }, [deptFilter, personFilter]);

  const dismissAlert = (projectId: string) => {
    setDismissedAlerts(prev => new Set([...prev, projectId]));
  };


  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Build strategy context for chatbot
  const buildStrategyContext = () => {
    return buildChatStrategyContext(companyName, objectives, personnel, dependencies, assessmentResult);
  };

  const handleChatLink = (url: string) => {
    const match = url.match(/^app:\/\/view\/(\w+)(?:\?(.+))?$/);
    if (!match) return;

    const targetView = match[1] as ViewMode;
    const params = new URLSearchParams(match[2] || '');

    setViewMode(targetView);

    switch (targetView) {
      case 'assignments': {
        const personName = params.get('person');
        if (personName) setCapacityFilterPersons([decodeURIComponent(personName)]);
        break;
      }
      case 'department': {
        const dept = params.get('dept');
        if (dept) setDeptFilter(decodeURIComponent(dept));
        break;
      }
      case 'timeline': {
        // Navigate to timeline; project highlight can be added later
        break;
      }
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await chatWithStrategy(
        userMessage.content,
        buildStrategyContext(),
        companyName,
        chatMessages
      );

      const assistantMessage: ChatMessage = { role: 'assistant', content: response };
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }

    setIsChatLoading(false);
  };

  // Render markdown-formatted chat message content
  const renderChatMarkdown = (text: string): React.ReactNode => {
    // Split into blocks by double newline (paragraphs) or single newlines
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: { content: string; indent: number }[] = [];
    let listType: 'ol' | 'ul' | null = null;

    const flushList = () => {
      if (listItems.length === 0) return;
      const tag = listType;
      const items = [...listItems];
      // Build nested structure: group sub-items under their parent
      const rendered: React.ReactNode[] = [];
      let parentIdx = 0;
      for (let j = 0; j < items.length; j++) {
        if (items[j].indent === 0) {
          // Collect sub-items that follow this parent
          const subItems: string[] = [];
          let k = j + 1;
          while (k < items.length && items[k].indent > 0) {
            subItems.push(items[k].content);
            k++;
          }
          rendered.push(
            <li key={parentIdx++}>
              {formatInline(items[j].content)}
              {subItems.length > 0 && (
                <ul className="list-disc list-outside ml-5 mt-1 space-y-0.5">
                  {subItems.map((sub, si) => (
                    <li key={si}>{formatInline(sub)}</li>
                  ))}
                </ul>
              )}
            </li>
          );
          j = k - 1; // skip sub-items
        } else {
          // Orphan sub-item (no parent) — render as top-level
          rendered.push(<li key={parentIdx++}>{formatInline(items[j].content)}</li>);
        }
      }
      elements.push(
        tag === 'ol' ? (
          <ol key={`ol-${elements.length}`} className="list-decimal list-outside ml-5 my-1.5 space-y-1.5 text-sm">
            {rendered}
          </ol>
        ) : (
          <ul key={`ul-${elements.length}`} className="list-disc list-outside ml-5 my-1.5 space-y-1.5 text-sm">
            {rendered}
          </ul>
        )
      );
      listItems = [];
      listType = null;
    };

    // Inline formatting: [links](url), **bold**, `code`
    const formatInline = (str: string): React.ReactNode => {
      const parts: React.ReactNode[] = [];
      let remaining = str;
      let key = 0;
      while (remaining.length > 0) {
        // Markdown links: [text](url)
        const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)/s);
        if (linkMatch) {
          if (linkMatch[1]) parts.push(<span key={key++}>{linkMatch[1]}</span>);
          const linkText = linkMatch[2];
          const linkUrl = linkMatch[3];
          if (linkUrl.startsWith('app://')) {
            parts.push(
              <button
                key={key++}
                onClick={() => handleChatLink(linkUrl)}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline underline-offset-2 font-medium cursor-pointer"
              >
                {linkText}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            );
          } else {
            parts.push(
              <a key={key++} href={linkUrl} target="_blank" rel="noopener noreferrer"
                 className="text-blue-600 hover:underline">
                {linkText}
              </a>
            );
          }
          remaining = linkMatch[4];
          continue;
        }
        // Bold: **text**
        const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
        if (boldMatch) {
          if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
          parts.push(<strong key={key++} className="font-semibold">{boldMatch[2]}</strong>);
          remaining = boldMatch[3];
          continue;
        }
        // Inline code: `text`
        const codeMatch = remaining.match(/^(.*?)`(.+?)`(.*)/s);
        if (codeMatch) {
          if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
          parts.push(<code key={key++} className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-xs font-mono">{codeMatch[2]}</code>);
          remaining = codeMatch[3];
          continue;
        }
        // No more matches
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
      return parts.length === 1 ? parts[0] : <>{parts}</>;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line = paragraph break (but don't break numbered lists)
      if (trimmed === '') {
        if (listType === 'ol') {
          // Peek ahead: if next non-empty line is a numbered item, keep the list going
          let nextNonEmpty = '';
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].trim() !== '') { nextNonEmpty = lines[j].trim(); break; }
          }
          if (nextNonEmpty.match(/^\d+\.\s+/)) {
            continue; // skip flush, keep the ordered list continuous
          }
        }
        flushList();
        elements.push(<div key={`br-${i}`} className="h-2" />);
        continue;
      }

      // Detect list items: numbered, bulleted, and indented variants
      const olMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
      const ulMatch = trimmed.match(/^[-•]\s+(.+)/);
      const indentedOlMatch = line.match(/^(\s{2,})(\d+)\.\s+(.+)/);
      const indentedUlMatch = line.match(/^(\s{2,})[-•]\s+(.+)/);

      if (indentedOlMatch) {
        // Indented numbered item → treat as sub-item
        if (!listType) listType = 'ol';
        listItems.push({ content: indentedOlMatch[3], indent: 1 });
      } else if (indentedUlMatch) {
        // Indented bullet → treat as sub-item
        if (!listType) listType = 'ul';
        listItems.push({ content: indentedUlMatch[2], indent: 1 });
      } else if (olMatch) {
        const num = parseInt(olMatch[1]);
        // If we see "1." and already have items, flush to start a new list
        if (num === 1 && listItems.length > 0) flushList();
        if (listType === 'ul') flushList();
        listType = 'ol';
        listItems.push({ content: olMatch[2], indent: 0 });
      } else if (ulMatch) {
        if (listType === 'ol') flushList();
        listType = 'ul';
        listItems.push({ content: ulMatch[1], indent: 0 });
      } else {
        flushList();
        // Headings: ### text, ## text, # text
        const h3Match = trimmed.match(/^###\s+(.+)/);
        const h2Match = trimmed.match(/^##\s+(.+)/);
        const h1Match = trimmed.match(/^#\s+(.+)/);
        if (h3Match) {
          elements.push(<p key={`h3-${i}`} className="text-sm font-semibold text-slate-800 mt-1">{formatInline(h3Match[1])}</p>);
        } else if (h2Match) {
          elements.push(<p key={`h2-${i}`} className="text-sm font-bold text-slate-900 mt-1.5">{formatInline(h2Match[1])}</p>);
        } else if (h1Match) {
          elements.push(<p key={`h1-${i}`} className="text-base font-bold text-slate-900 mt-2">{formatInline(h1Match[1])}</p>);
        } else {
          elements.push(
            <p key={`p-${i}`} className="text-sm leading-relaxed">{formatInline(trimmed)}</p>
          );
        }
      }
    }

    flushList();
    return <div className="space-y-0.5">{elements}</div>;
  };

  // Objective operations
  const addObjective = () => {
    if (!newObjective.trim()) return;
    const newObj: Objective = {
      id: `obj-${Date.now()}`,
      title: newObjective.trim(),
      keyResults: [],
    };
    setObjectives([...objectives, newObj]);
    setNewObjective('');
    setShowAddObjective(false);
  };

  const updateObjectiveTitle = (objId: string, title: string) => {
    setObjectives(objectives.map(o => o.id === objId ? { ...o, title } : o));
  };

  const deleteObjective = (objId: string) => {
    if (confirm('Delete this objective and all its key results?')) {
      setObjectives(objectives.filter(o => o.id !== objId));
    }
  };

  // Key Result operations
  const addKeyResult = (objId: string) => {
    if (!newKRTitle.trim()) return;
    const newKR: KeyResult = {
      id: `kr-${Date.now()}`,
      title: newKRTitle.trim(),
      departmentalProjects: [],
    };
    setObjectives(objectives.map(o =>
      o.id === objId ? { ...o, keyResults: [...o.keyResults, newKR] } : o
    ));
    setNewKRTitle('');
    setAddingKRToObjective(null);
  };

  const updateKRTitle = (objId: string, krId: string, title: string) => {
    setObjectives(objectives.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.map(kr => kr.id === krId ? { ...kr, title } : kr)
      } : o
    ));
  };

  const deleteKeyResult = (objId: string, krId: string) => {
    setObjectives(objectives.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.filter(kr => kr.id !== krId)
      } : o
    ));
  };

  // Project operations
  const addProject = (objId: string, krId: string) => {
    if (!newProjectDept.trim() || !newProjectTitle.trim()) return;
    const newProject: DepartmentalProject = {
      id: `proj-${Date.now()}`,
      department: newProjectDept.trim(),
      title: newProjectTitle.trim(),
      status: 'To Do',
      progress: 0,
      headcount: [],
    };
    setObjectives(objectives.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? { ...kr, departmentalProjects: [...(kr.departmentalProjects || []), newProject] } : kr
        )
      } : o
    ));
    setNewProjectDept('');
    setNewProjectTitle('');
    setAddingProjectToKR(null);
  };

  const updateProject = (objId: string, krId: string, projectId: string, updates: Partial<DepartmentalProject>) => {
    setObjectives(objectives.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? {
            ...kr,
            departmentalProjects: kr.departmentalProjects?.map(p =>
              p.id === projectId ? { ...p, ...updates } : p
            )
          } : kr
        )
      } : o
    ));
  };

  const deleteProject = (objId: string, krId: string, projectId: string) => {
    setObjectives(objectives.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? {
            ...kr,
            departmentalProjects: kr.departmentalProjects?.filter(p => p.id !== projectId)
          } : kr
        )
      } : o
    ));
  };

  // Timeframe operations
  const updateTimeframe = (objId: string, krId: string, projectId: string, startDate: string, endDate: string) => {
    setObjectives(objectives.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? {
            ...kr,
            departmentalProjects: kr.departmentalProjects?.map(p =>
              p.id === projectId ? { ...p, startDate, endDate } : p
            )
          } : kr
        )
      } : o
    ));
  };

  // Headcount operations
  const addHeadcount = (objId: string, krId: string, projectId: string, name: string, role: string, allocation: string = 'Full-time') => {
    const newAssignment: ProjectAssignment = {
      id: `hc-${Date.now()}`,
      name,
      role,
      allocation,
    };
    setObjectives(prev => prev.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? {
            ...kr,
            departmentalProjects: kr.departmentalProjects?.map(p =>
              p.id === projectId ? { ...p, headcount: [...(p.headcount || []), newAssignment] } : p
            )
          } : kr
        )
      } : o
    ));
  };

  const addPersonnelToProject = (objId: string, krId: string, projectId: string, person: Personnel) => {
    const newAssignment: ProjectAssignment = {
      id: `hc-${Date.now()}`,
      personnelId: person.id,
      name: person.name,
      role: person.role,
      allocation: person.availability || 'Full-time',
    };
    setObjectives(prev => prev.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? {
            ...kr,
            departmentalProjects: kr.departmentalProjects?.map(p =>
              p.id === projectId ? { ...p, headcount: [...(p.headcount || []), newAssignment] } : p
            )
          } : kr
        )
      } : o
    ));
    setShowPersonnelPicker(null);
  };

  const removeHeadcount = (objId: string, krId: string, projectId: string, assignmentId: string) => {
    setObjectives(objectives.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? {
            ...kr,
            departmentalProjects: kr.departmentalProjects?.map(p =>
              p.id === projectId ? { ...p, headcount: p.headcount?.filter(h => h.id !== assignmentId) } : p
            )
          } : kr
        )
      } : o
    ));
  };

  // Tree view inline CRUD handlers
  const handleTreeEdit = (id: string, currentTitle: string) => {
    setTreeConfirmingDelete(null);
    setTreeEditingItem(id);
    setTreeEditValue(currentTitle);
  };

  const handleTreeEditSave = (
    id: string,
    type: 'objective' | 'keyResult' | 'project' | 'headcount',
    objectiveId: string,
    krId?: string,
    projectId?: string
  ) => {
    const trimmed = treeEditValue.trim();
    if (!trimmed) {
      setTreeEditingItem(null);
      return;
    }
    switch (type) {
      case 'objective':
        updateObjectiveTitle(id, trimmed);
        break;
      case 'keyResult':
        updateKRTitle(objectiveId, id, trimmed);
        break;
      case 'project':
        if (krId) updateProject(objectiveId, krId, id, { title: trimmed });
        break;
      case 'headcount':
        if (krId && projectId) {
          setObjectives(objectives.map(o =>
            o.id === objectiveId ? {
              ...o,
              keyResults: o.keyResults.map(kr =>
                kr.id === krId ? {
                  ...kr,
                  departmentalProjects: kr.departmentalProjects?.map(p =>
                    p.id === projectId ? {
                      ...p,
                      headcount: p.headcount?.map(h =>
                        h.id === id ? { ...h, name: trimmed } : h
                      )
                    } : p
                  )
                } : kr
              )
            } : o
          ));
        }
        break;
    }
    setTreeEditingItem(null);
  };

  const handleTreeEditCancel = () => {
    setTreeEditingItem(null);
    setTreeEditValue('');
  };

  const handleTreeDeleteRequest = (
    id: string,
    type: 'objective' | 'keyResult' | 'project' | 'headcount',
    label: string,
    objectiveId: string,
    krId?: string,
    projectId?: string
  ) => {
    setTreeEditingItem(null);
    setTreeConfirmingDelete({ id, type, objectiveId, krId, projectId, label });
  };

  const handleTreeDeleteConfirm = () => {
    if (!treeConfirmingDelete) return;
    const { id, type, objectiveId, krId, projectId } = treeConfirmingDelete;
    switch (type) {
      case 'objective':
        setObjectives(objectives.filter(o => o.id !== id));
        break;
      case 'keyResult':
        deleteKeyResult(objectiveId, id);
        break;
      case 'project':
        if (krId) deleteProject(objectiveId, krId, id);
        break;
      case 'headcount':
        if (krId && projectId) removeHeadcount(objectiveId, krId, projectId, id);
        break;
    }
    setTreeConfirmingDelete(null);
  };

  const handleTreeDeleteCancel = () => {
    setTreeConfirmingDelete(null);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, type: 'kr' | 'project' | 'headcount' | 'team', id: string, sourceObjectiveId: string, sourceKRId?: string, sourceProjectId?: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id, sourceObjectiveId, sourceKRId, sourceProjectId }));
    setDraggedItem({ type, id, sourceObjectiveId, sourceKRId, sourceProjectId });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnterObjective = (e: React.DragEvent, objectiveId: string) => {
    e.preventDefault();
    if (draggedItem?.type === 'kr' && draggedItem.sourceObjectiveId !== objectiveId) {
      setDropTarget({ type: 'objective', id: objectiveId });
    }
  };

  const handleDragEnterKR = (e: React.DragEvent, objectiveId: string, krId: string) => {
    e.preventDefault();
    if (draggedItem?.type === 'project' && draggedItem.sourceKRId !== krId) {
      setDropTarget({ type: 'kr', id: krId, objectiveId });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the actual drop zone
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDropTarget(null);
    }
  };

  const handleDropOnObjective = (e: React.DragEvent, targetObjectiveId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type !== 'kr') return;

    const { id: krId, sourceObjectiveId } = draggedItem;
    if (sourceObjectiveId === targetObjectiveId) return;

    // Find the KR to move
    const sourceObjective = objectives.find(o => o.id === sourceObjectiveId);
    const krToMove = sourceObjective?.keyResults.find(kr => kr.id === krId);
    if (!krToMove) return;

    // Remove from source and add to target
    setObjectives(objectives.map(o => {
      if (o.id === sourceObjectiveId) {
        return { ...o, keyResults: o.keyResults.filter(kr => kr.id !== krId) };
      }
      if (o.id === targetObjectiveId) {
        return { ...o, keyResults: [...o.keyResults, krToMove] };
      }
      return o;
    }));

    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDropOnKR = (e: React.DragEvent, targetObjectiveId: string, targetKRId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type !== 'project') return;

    const { id: projectId, sourceObjectiveId, sourceKRId } = draggedItem;
    if (sourceKRId === targetKRId) return;

    // Find the project to move
    const sourceObjective = objectives.find(o => o.id === sourceObjectiveId);
    const sourceKR = sourceObjective?.keyResults.find(kr => kr.id === sourceKRId);
    const projectToMove = sourceKR?.departmentalProjects?.find(p => p.id === projectId);
    if (!projectToMove) return;

    // Remove from source and add to target
    setObjectives(objectives.map(o => {
      let modified = { ...o };

      // Remove from source KR
      if (o.id === sourceObjectiveId) {
        modified = {
          ...modified,
          keyResults: modified.keyResults.map(kr =>
            kr.id === sourceKRId
              ? { ...kr, departmentalProjects: kr.departmentalProjects?.filter(p => p.id !== projectId) }
              : kr
          )
        };
      }

      // Add to target KR
      if (o.id === targetObjectiveId) {
        modified = {
          ...modified,
          keyResults: modified.keyResults.map(kr =>
            kr.id === targetKRId
              ? { ...kr, departmentalProjects: [...(kr.departmentalProjects || []), projectToMove] }
              : kr
          )
        };
      }

      return modified;
    }));

    setDraggedItem(null);
    setDropTarget(null);
  };

  // Handle drag enter for project (headcount drop zone)
  const handleDragEnterProject = (e: React.DragEvent, objectiveId: string, krId: string, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if ((draggedItem?.type === 'headcount' || draggedItem?.type === 'team') && draggedItem.sourceProjectId !== projectId) {
      setDropTarget({ type: 'project', id: projectId, objectiveId, krId });
    }
  };

  // Handle dropping headcount or team on a project
  const handleDropOnProject = (e: React.DragEvent, targetObjectiveId: string, targetKRId: string, targetProjectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || (draggedItem.type !== 'headcount' && draggedItem.type !== 'team')) return;

    const { id: itemId, sourceObjectiveId, sourceKRId, sourceProjectId } = draggedItem;
    if (sourceProjectId === targetProjectId) return;

    const sourceObjective = objectives.find(o => o.id === sourceObjectiveId);
    const sourceKR = sourceObjective?.keyResults.find(kr => kr.id === sourceKRId);
    const sourceProject = sourceKR?.departmentalProjects?.find(p => p.id === sourceProjectId);

    if (draggedItem.type === 'team') {
      // Move team between projects
      const teamToMove = sourceProject?.teams?.find(t => t.id === itemId);
      if (!teamToMove) return;

      setObjectives(objectives.map(o => {
        let modified = { ...o };

        // Remove team from source project
        if (o.id === sourceObjectiveId) {
          modified = {
            ...modified,
            keyResults: modified.keyResults.map(kr =>
              kr.id === sourceKRId
                ? {
                  ...kr,
                  departmentalProjects: kr.departmentalProjects?.map(p =>
                    p.id === sourceProjectId
                      ? { ...p, teams: p.teams?.filter(t => t.id !== itemId) }
                      : p
                  )
                }
                : kr
            )
          };
        }

        // Add team to target project
        if (o.id === targetObjectiveId) {
          modified = {
            ...modified,
            keyResults: modified.keyResults.map(kr =>
              kr.id === targetKRId
                ? {
                  ...kr,
                  departmentalProjects: kr.departmentalProjects?.map(p =>
                    p.id === targetProjectId
                      ? { ...p, teams: [...(p.teams || []), teamToMove] }
                      : p
                  )
                }
                : kr
            )
          };
        }

        return modified;
      }));
    } else {
      // Move headcount between projects
      const headcountToMove = sourceProject?.headcount?.find(h => h.id === itemId);
      if (!headcountToMove) return;

      setObjectives(objectives.map(o => {
        let modified = { ...o };

        // Remove from source project
        if (o.id === sourceObjectiveId) {
          modified = {
            ...modified,
            keyResults: modified.keyResults.map(kr =>
              kr.id === sourceKRId
                ? {
                  ...kr,
                  departmentalProjects: kr.departmentalProjects?.map(p =>
                    p.id === sourceProjectId
                      ? { ...p, headcount: p.headcount?.filter(h => h.id !== itemId) }
                      : p
                  )
                }
                : kr
            )
          };
        }

        // Add to target project
        if (o.id === targetObjectiveId) {
          modified = {
            ...modified,
            keyResults: modified.keyResults.map(kr =>
              kr.id === targetKRId
                ? {
                  ...kr,
                  departmentalProjects: kr.departmentalProjects?.map(p =>
                    p.id === targetProjectId
                      ? { ...p, headcount: [...(p.headcount || []), headcountToMove] }
                      : p
                  )
                }
                : kr
            )
          };
        }

        return modified;
      }));
    }

    setDraggedItem(null);
    setDropTarget(null);
  };

  // Find parent IDs for tree view operations
  const findProjectParents = (projectId: string): { objId: string; krId: string } | null => {
    if (!projectId || !objectives) return null;
    for (const obj of objectives) {
      if (!obj.keyResults) continue;
      for (const kr of obj.keyResults) {
        if (kr.departmentalProjects?.find(p => p.id === projectId)) {
          return { objId: obj.id, krId: kr.id };
        }
      }
    }
    return null;
  };

  const findKRParent = (krId: string): string | null => {
    if (!krId || !objectives) return null;
    for (const obj of objectives) {
      if (obj.keyResults?.find(kr => kr.id === krId)) {
        return obj.id;
      }
    }
    return null;
  };

  return (
    <div className="animate-in fade-in duration-700">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          {companyName} Strategy Blueprint
        </h1>
        <p className="text-slate-600 mt-3 max-w-2xl mx-auto">
          Your Objectives, Key Results, and granular resource allocations. Click to edit any item.
        </p>
      </div>

      {/* View Toggle & Add Button */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 flex-wrap gap-1">
            {/* View Tabs - only show visible ones */}
            {visibleViews.includes('explorer') && (
              <button
                onClick={() => setViewMode('explorer')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'explorer'
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                <ExplorerIcon />
                Strategy Map
              </button>
            )}
            {visibleViews.includes('tree') && (
              <button
                onClick={() => setViewMode('tree')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'tree'
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                <TreeIcon />
                Tree View
              </button>
            )}
            {visibleViews.includes('allocation') && (
              <button
                onClick={() => setViewMode('allocation')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'allocation'
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>
                Allocation
              </button>
            )}
            {visibleViews.includes('assignments') && (
              <button
                onClick={() => setViewMode('assignments')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'assignments'
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                Capacity
              </button>
            )}
            {visibleViews.includes('timeline') && (
              <button
                onClick={() => setViewMode('timeline')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'timeline'
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                <TimelineIcon />
                Timeline
              </button>
            )}
            {visibleViews.includes('cards') && (
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'cards'
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                <CardsIcon />
                Cards
              </button>
            )}
            {visibleViews.includes('department') && (
              <button
                onClick={() => setViewMode('department')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'department'
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                <DepartmentIcon />
                Department
              </button>
            )}

            {/* View Settings Dropdown */}
            <div className="relative ml-1" ref={viewSettingsRef}>
              <button
                onClick={() => setShowViewSettings(!showViewSettings)}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                  showViewSettings
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                }`}
                title="Configure visible views"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </button>
              {showViewSettings && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-lg border border-slate-200 py-2 min-w-[180px] z-50">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 mb-1">
                    Visible Views
                  </div>
                  {VIEW_CONFIG.map(view => (
                    <label
                      key={view.key}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleViews.includes(view.key)}
                        onChange={() => toggleViewVisibility(view.key)}
                        disabled={visibleViews.length === 1 && visibleViews.includes(view.key)}
                        className="w-4 h-4 text-brand-primary border-slate-300 rounded focus:ring-brand-primary focus:ring-offset-0 disabled:opacity-50"
                      />
                      <span className="text-sm text-slate-700">{view.label}</span>
                    </label>
                  ))}
                  {visibleViews.length < VIEW_CONFIG.length && (
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={() => setVisibleViews(DEFAULT_VISIBLE_VIEWS)}
                        className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                      >
                        Reset to default
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* AI Assessment Popover */}
          {assessmentEnabled && <div className="relative" ref={assessmentPopoverRef}>
            <button
              onClick={() => setShowAssessmentPopover(prev => !prev)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg ${
                showAssessmentPopover
                  ? 'bg-brand-secondary text-white'
                  : 'bg-brand-primary text-white hover:bg-brand-secondary'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
              </svg>
              Assessment
              {assessmentResult && assessmentResult.summary.active > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
                  {assessmentResult.summary.active}
                </span>
              )}
            </button>

            {showAssessmentPopover && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                {/* Popover Header */}
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h4 className="font-bold text-slate-800 text-sm">Plan Assessment</h4>
                  {assessmentResult && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Last run: {new Date(assessmentResult.runAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  {/* Run / Re-run Button */}
                  <button
                    onClick={handleRunAssessment}
                    disabled={isAssessing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:bg-brand-secondary transition-colors disabled:opacity-50"
                  >
                    {isAssessing ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
                        </svg>
                        {assessmentResult ? 'Re-run Assessment' : 'Run Assessment'}
                      </>
                    )}
                  </button>

                  {/* Alert Summary */}
                  {assessmentResult && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      {assessmentResult.summary.active === 0 ? (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">All clear</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {assessmentResult.summary.critical > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-xs font-semibold text-red-700">{assessmentResult.summary.critical} Critical</span>
                            </div>
                          )}
                          {assessmentResult.summary.warning > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="text-xs font-semibold text-amber-700">{assessmentResult.summary.warning} Warning</span>
                            </div>
                          )}
                          {assessmentResult.summary.info > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="text-xs font-semibold text-blue-700">{assessmentResult.summary.info} Info</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show Alert Indicators Toggle */}
                  {assessmentResult && assessmentResult.summary.active > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">Show Alert Indicators</span>
                        <button
                          onClick={() => setShowAlertOverlay(prev => !prev)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${showAlertOverlay ? 'bg-brand-primary' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showAlertOverlay ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>

                      {/* Category Filter Pills */}
                      {showAlertOverlay && (
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Filter</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {[
                              { key: 'resource', label: 'Resource' },
                              { key: 'timeline', label: 'Timeline' },
                              { key: 'alignment', label: 'Alignment' },
                              { key: 'coverage', label: 'Coverage' },
                            ].map(cat => (
                              <button
                                key={cat.key}
                                onClick={() => toggleOverlayCategory(cat.key)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                                  overlayCategories.has(cat.key)
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* View Full Assessment Link */}
                  {assessmentResult && (
                    <button
                      onClick={() => { setViewMode('assessment'); setShowAssessmentPopover(false); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors"
                    >
                      View Full Assessment
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>}
        </div>

        {/* Department Filter - below tabs when in department view */}
        {viewMode === 'department' && allDepartments.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Filter:</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
            >
              <option value="all">All Departments</option>
              {allDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {objectives.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-slate-500 text-lg">No objectives yet</p>
          <p className="text-slate-400 text-sm mt-1">Click "Add Objective" to get started</p>
        </div>
      ) : viewMode === 'tree' ? (
        /* Tree View */
        <div className="flex flex-col flex-1">
          {/* Shared filter bar for tree view */}
          <div className="mb-4 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 px-3 py-2 shadow-sm inline-flex self-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="text-xs border-0 bg-transparent focus:ring-0 text-slate-700 font-medium cursor-pointer pr-6"
            >
              <option value="all">All Departments</option>
              {allDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <div className="w-px h-4 bg-slate-200" />
            <select
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              className="text-xs border-0 bg-transparent focus:ring-0 text-slate-700 font-medium cursor-pointer pr-6"
            >
              <option value="all">All People</option>
              {allPeople.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            {(deptFilter !== 'all' || personFilter !== 'all') && (
              <button
                onClick={() => { setDeptFilter('all'); setPersonFilter('all'); }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear
              </button>
            )}
          </div>
        <div className="relative flex-1 overflow-hidden min-h-[calc(100vh-240px)]">
          <div className="transition-all duration-300">
            <TreeView
              objectives={filteredObjectives}
              allObjectives={objectives}
              onRemoveHeadcount={removeHeadcount}
              onCreateObjective={(title) => {
                const newObj: Objective = { id: `obj-${Date.now()}`, title, keyResults: [] };
                setObjectives([...objectives, newObj]);
              }}
              onCreateKR={(objId, title) => {
                const newKR: KeyResult = { id: `kr-${Date.now()}`, title, departmentalProjects: [] };
                setObjectives(objectives.map(o =>
                  o.id === objId ? { ...o, keyResults: [...o.keyResults, newKR] } : o
                ));
              }}
              onCreateProject={(objId, krId, dept, title) => {
                const newProject: DepartmentalProject = {
                  id: `proj-${Date.now()}`, department: dept, title, status: 'To Do' as const, progress: 0, headcount: [],
                };
                setObjectives(objectives.map(o =>
                  o.id === objId ? {
                    ...o, keyResults: o.keyResults.map(kr =>
                      kr.id === krId ? { ...kr, departmentalProjects: [...(kr.departmentalProjects || []), newProject] } : kr
                    )
                  } : o
                ));
              }}
              onAddHeadcount={handleTreeAddMember}
              draggedItem={draggedItem}
              dropTarget={dropTarget}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDragEnterObjective={handleDragEnterObjective}
              onDragEnterKR={handleDragEnterKR}
              onDragEnterProject={handleDragEnterProject}
              onDropOnObjective={handleDropOnObjective}
              onDropOnKR={handleDropOnKR}
              onDropOnProject={handleDropOnProject}
              onSelectItem={(id, type, label) => {
                setTreeSelectedItem({ id, type, label });
                setShowTreeDetailPanel(true);
              }}
              selectedItemId={treeSelectedItem?.id}
              cascadedAlertsByElement={cascadedAlertsByElement}
              showAlertOverlay={showAlertOverlay}
              expandedObjectives={treeExpandedObjectives}
              setExpandedObjectives={setTreeExpandedObjectives}
              expandedKRs={treeExpandedKRs}
              setExpandedKRs={setTreeExpandedKRs}
              expandedProjects={treeExpandedProjects}
              setExpandedProjects={setTreeExpandedProjects}
              expandedDKRs={treeExpandedDKRs}
              setExpandedDKRs={setTreeExpandedDKRs}
              expandedTeams={treeExpandedTeams}
              setExpandedTeams={setTreeExpandedTeams}
              treeEditingItemId={treeEditingItem}
              treeEditValue={treeEditValue}
              onTreeEditValueChange={setTreeEditValue}
              onTreeEditStart={handleTreeEdit}
              onTreeEditSave={handleTreeEditSave}
              onTreeEditCancel={handleTreeEditCancel}
              treeConfirmingDeleteId={treeConfirmingDelete?.id ?? null}
              onTreeDeleteRequest={handleTreeDeleteRequest}
              onTreeDeleteConfirm={handleTreeDeleteConfirm}
              onTreeDeleteCancel={handleTreeDeleteCancel}
            />
          </div>
          <StrategyDetailPanel
            detailData={treeDetailData}
            show={showTreeDetailPanel}
            onClose={() => { setShowTreeDetailPanel(false); setTreeSelectedItem(null); setTreeAutoAddMember(false); }}
            getProjectResourceStatus={getProjectResourceStatus}
            allObjectives={objectives}
            className="fixed top-[72px] right-4 bottom-4 z-40"
            elementAlerts={getElementAlerts(treeDetailData)}
            onApplyAction={handleApplyAction}
            onDismissAlert={handleDismissAlert}
            childIssues={getChildIssues(treeDetailData)}
            onNavigateToChild={(type, id, name) => {
              setTreeSelectedItem({ id, type, label: name });
            }}
            onUpdatePersonnel={handleUpdatePersonnel}
            personnel={personnel}
            onAddHeadcount={addHeadcount}
            autoOpenAddMember={treeAutoAddMember}
            onAutoOpenAddMemberHandled={() => setTreeAutoAddMember(false)}
            onAddPersonnelToProject={addPersonnelToProject}
            onUpdateProject={handleUpdateProject}
            onUpdateTeam={handleUpdateTeam}
            onUpdateKeyResult={handleUpdateKeyResult}
            onUpdateDepartmentalKeyResult={handleUpdateDepartmentalKeyResult}
            onUpdateObjective={handleUpdateObjective}
            onDeleteObjective={handleDeleteObjective}
            onDeleteKeyResult={handleDeleteKeyResult}
            onDeleteProject={handleDeleteProject}
            onAddKeyResult={handleAddKeyResult}
            onAddProject={handleAddProject}
            showAlerts={showAlertOverlay}
          />
        </div>
        </div>
      ) : viewMode === 'timeline' ? (
        /* Timeline View */
        <div className="relative flex-1 overflow-hidden min-h-[calc(100vh-240px)]">
          <TimelineView
            objectives={objectives}
            getProjectResourceStatus={getProjectResourceStatus}
            highlightKR={timelineHighlightKR}
            onClearHighlight={() => setTimelineHighlightKR(null)}
            onSelectProject={(id, label) => {
              setTimelineSelectedItem({ id, type: 'project', label });
              setShowTimelineDetailPanel(true);
            }}
            selectedProjectId={timelineSelectedItem?.id}
          />
          <StrategyDetailPanel
            detailData={timelineDetailData}
            show={showTimelineDetailPanel}
            onClose={() => { setShowTimelineDetailPanel(false); setTimelineSelectedItem(null); }}
            getProjectResourceStatus={getProjectResourceStatus}
            allObjectives={objectives}
            className="fixed top-[72px] right-4 bottom-4 z-40"
            elementAlerts={getElementAlerts(timelineDetailData)}
            onApplyAction={handleApplyAction}
            onDismissAlert={handleDismissAlert}
            childIssues={getChildIssues(timelineDetailData)}
            onNavigateToChild={(type, id, name) => {
              setTimelineSelectedItem({ id, type, label: name });
            }}
            onUpdatePersonnel={handleUpdatePersonnel}
            personnel={personnel}
            onAddHeadcount={addHeadcount}
            onAddPersonnelToProject={addPersonnelToProject}
            onUpdateProject={handleUpdateProject}
            onUpdateTeam={handleUpdateTeam}
            onUpdateKeyResult={handleUpdateKeyResult}
            onUpdateDepartmentalKeyResult={handleUpdateDepartmentalKeyResult}
            onUpdateObjective={handleUpdateObjective}
            onDeleteObjective={handleDeleteObjective}
            onDeleteKeyResult={handleDeleteKeyResult}
            onDeleteProject={handleDeleteProject}
            onAddKeyResult={handleAddKeyResult}
            onAddProject={handleAddProject}
            showAlerts={showAlertOverlay}
          />
        </div>
      ) : viewMode === 'explorer' ? (
        /* Strategy Map View */
        <StrategyMapView
          objectives={objectives}
          filteredObjectives={filteredObjectives}
          getProjectResourceStatus={getProjectResourceStatus}
          companyName={companyName}
          dependencies={dependencies}
          deptFilter={deptFilter}
          setDeptFilter={setDeptFilter}
          personFilter={personFilter}
          setPersonFilter={setPersonFilter}
          allDepartments={allDepartments}
          allPeople={allPeople}
          getElementAlerts={getElementAlerts}
          onApplyAction={handleApplyAction}
          onDismissAlert={handleDismissAlert}
          cascadedAlertsByElement={cascadedAlertsByElement}
          getChildIssues={getChildIssues}
          showAlertOverlay={showAlertOverlay}
          personnel={personnel}
          onUpdatePersonnel={handleUpdatePersonnel}
          onAddHeadcount={addHeadcount}
          onAddPersonnelToProject={addPersonnelToProject}
          onUpdateProject={handleUpdateProject}
          onUpdateTeam={handleUpdateTeam}
          onUpdateKeyResult={handleUpdateKeyResult}
          onUpdateDepartmentalKeyResult={handleUpdateDepartmentalKeyResult}
          onUpdateObjective={handleUpdateObjective}
          onDeleteObjective={handleDeleteObjective}
          onDeleteKeyResult={handleDeleteKeyResult}
          onDeleteProject={handleDeleteProject}
          onAddKeyResult={handleAddKeyResult}
          onAddProject={handleAddProject}
        />
      ) : viewMode === 'department' ? (
        /* Department View */
        <div className="space-y-6">
          {Object.keys(projectsByDepartment).length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <DepartmentIcon />
              <p className="text-slate-500 text-lg mt-4">No projects found</p>
              <p className="text-slate-400 text-sm mt-1">
                {departmentFilter !== 'all' ? 'Try selecting a different department' : 'Add projects to see them grouped by department'}
              </p>
            </div>
          ) : (
            (Object.entries(projectsByDepartment) as [string, ProjectWithContext[]][]).sort(([a], [b]) => a.localeCompare(b)).map(([dept, projects]) => {
              // Calculate resource stats for this department
              const resourceStats = projects.reduce((stats, { project }) => {
                const status = getProjectResourceStatus(project);
                if (status.status === 'critical') stats.critical++;
                else if (status.status === 'under') stats.under++;
                else if (status.status === 'over') stats.over++;
                else stats.ok++;
                return stats;
              }, { critical: 0, under: 0, over: 0, ok: 0 });

              const totalHeadcount = projects.reduce((sum, p) => sum + (p.project.headcount?.length || 0), 0);
              const hasIssues = resourceStats.critical > 0 || resourceStats.under > 0 || resourceStats.over > 0;

              return (
                <div key={dept} className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                  {/* Department Header */}
                  <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                        <DepartmentIcon />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">{dept}</h2>
                        <p className="text-xs text-slate-300">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-300" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        <span className="text-sm font-bold text-white">{totalHeadcount}</span>
                        <span className="text-[10px] text-slate-400">headcount</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                        {hasIssues ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-300" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="flex items-center gap-1">
                              {resourceStats.critical > 0 && (
                                <span className="text-xs font-bold px-1.5 py-0.5 bg-red-500 text-white rounded">{resourceStats.critical}</span>
                              )}
                              {resourceStats.under > 0 && (
                                <span className="text-xs font-bold px-1.5 py-0.5 bg-amber-500 text-white rounded">{resourceStats.under}</span>
                              )}
                              {resourceStats.over > 0 && (
                                <span className="text-xs font-bold px-1.5 py-0.5 bg-blue-500 text-white rounded">{resourceStats.over}</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">issues</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-[10px] text-emerald-400 font-medium">All healthy</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Resource Summary Bar */}
                  {hasIssues && (
                    <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-4 text-xs">
                      {resourceStats.critical > 0 && (
                        <span className="flex items-center gap-1.5 text-red-700">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          {resourceStats.critical} critical (no team)
                        </span>
                      )}
                      {resourceStats.under > 0 && (
                        <span className="flex items-center gap-1.5 text-amber-700">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          {resourceStats.under} under-resourced
                        </span>
                      )}
                      {resourceStats.over > 0 && (
                        <span className="flex items-center gap-1.5 text-blue-700">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          {resourceStats.over} over-resourced
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-emerald-700 ml-auto">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {resourceStats.ok} healthy
                      </span>
                    </div>
                  )}

                  {/* Projects List */}
                  <div className="p-6 space-y-4">
                    {projects.map(({ project, objective, keyResult }) => {
                      const resourceStatus = getProjectResourceStatus(project);
                      const statusBorderColor = resourceStatus.status === 'critical' ? 'border-l-red-500' :
                        resourceStatus.status === 'under' ? 'border-l-amber-500' :
                          resourceStatus.status === 'over' ? 'border-l-blue-500' : 'border-l-emerald-500';
                      const statusBgColor = resourceStatus.status === 'critical' ? 'bg-red-50' :
                        resourceStatus.status === 'under' ? 'bg-amber-50' :
                          resourceStatus.status === 'over' ? 'bg-blue-50' : 'bg-slate-50';

                      return (
                        <div
                          key={project.id}
                          className={`${statusBgColor} rounded-xl p-4 border border-slate-100 border-l-4 ${statusBorderColor} hover:shadow-md transition-all`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-slate-800">{project.title}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span className="bg-brand-light text-brand-dark px-1.5 py-0.5 rounded font-medium">
                                  {objective.title.substring(0, 30)}{objective.title.length > 30 ? '...' : ''}
                                </span>
                                <span>→</span>
                                <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                                  {keyResult.title.substring(0, 30)}{keyResult.title.length > 30 ? '...' : ''}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => setEditingProject(project.id)}
                                className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-brand-light rounded-lg transition-colors"
                                title="Edit"
                              >
                                <EditIcon />
                              </button>
                            </div>
                          </div>

                          {/* Resource Status Alert - Only show when there's an issue */}
                          {resourceStatus.status !== 'ok' && (
                            <div className={`mb-3 p-2 rounded-lg border flex items-start gap-2 ${resourceStatus.status === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
                              resourceStatus.status === 'under' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                'bg-blue-50 border-blue-200 text-blue-700'
                              }`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 flex-shrink-0 mt-0.5 ${resourceStatus.status === 'critical' ? 'text-red-500' :
                                resourceStatus.status === 'under' ? 'text-amber-500' : 'text-blue-500'
                                }`} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-wider">
                                  {resourceStatus.status === 'critical' ? 'Critical' :
                                    resourceStatus.status === 'under' ? 'Under-resourced' : 'Over-resourced'}
                                </p>
                                <p className="text-[10px]">{resourceStatus.message}</p>
                              </div>
                              {!dismissedAlerts.has(project.id) && (
                                <button
                                  onClick={() => setDismissedAlerts(prev => new Set([...prev, project.id]))}
                                  className="p-0.5 hover:bg-white/50 rounded transition-colors flex-shrink-0"
                                  title="Dismiss alert"
                                >
                                  <CloseIcon />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Timeframe & Headcount Details */}
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Timeframe */}
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${project.startDate && project.endDate ? 'bg-blue-50' : 'bg-slate-100'
                              }`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${project.startDate && project.endDate ? 'text-blue-500' : 'text-slate-400'
                                }`} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                              </svg>
                              <span className={`text-[10px] font-medium ${project.startDate && project.endDate ? 'text-blue-700' : 'text-slate-500 italic'
                                }`}>
                                {project.startDate && project.endDate
                                  ? `${project.startDate} → ${project.endDate}`
                                  : 'No timeframe set'}
                              </span>
                            </div>

                            {/* Headcount */}
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${project.headcount && project.headcount.length > 0 ? 'bg-purple-50' : 'bg-slate-100'
                              }`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${project.headcount && project.headcount.length > 0 ? 'text-purple-500' : 'text-slate-400'
                                }`} viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                              </svg>
                              {project.headcount && project.headcount.length > 0 ? (
                                <>
                                  <div className="flex -space-x-1">
                                    {project.headcount.slice(0, 3).map((hc) => (
                                      <div
                                        key={hc.id}
                                        className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(hc.name)} flex items-center justify-center text-white text-[7px] font-bold border-2 border-white`}
                                        title={`${hc.name} - ${hc.role}`}
                                      >
                                        {getInitials(hc.name)}
                                      </div>
                                    ))}
                                    {project.headcount.length > 3 && (
                                      <div className="w-5 h-5 rounded-full bg-slate-400 flex items-center justify-center text-white text-[7px] font-bold border-2 border-white">
                                        +{project.headcount.length - 3}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-purple-700 font-medium">
                                    {project.headcount.length} member{project.headcount.length !== 1 ? 's' : ''}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">No team assigned</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : viewMode === 'allocation' || viewMode === 'assignments' ? (
        /* ─── CAPACITY VIEW ─── */
        <ResourceLensView
          objectives={objectives}
          personnel={personnel}
          getProjectResourceStatus={getProjectResourceStatus}
          mode={viewMode}
          filterPersons={capacityFilterPersons}
          onClearFilter={() => setCapacityFilterPersons([])}
        />
      ) : viewMode === 'assessment' ? (
        /* ─── ASSESSMENT VIEW ─── */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Plan Assessment</h2>
              <p className="text-sm text-slate-500 mt-1">
                Strategic overview and detailed analysis of your plan's feasibility and effectiveness
              </p>
            </div>
            <button
              onClick={handleRunAssessment}
              disabled={isAssessing}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                isAssessing
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-brand-primary text-white hover:bg-brand-primary/90'
              }`}
            >
              {isAssessing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Run Assessment
                </>
              )}
            </button>
          </div>

          {/* Strategic Overview - collapsible, collapsed by default */}
          {(insights || loadingInsights) && (
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowStrategicOverview(!showStrategicOverview)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-indigo-50/30 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-primary" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Strategic Overview</h3>
                    {insights && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full font-medium">AI Generated</span>
                    )}
                  </div>
                  {!showStrategicOverview && insights && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{insights.summary}</p>
                  )}
                  {!showStrategicOverview && loadingInsights && !insights && (
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-brand-primary border-t-transparent rounded-full animate-spin inline-block" />
                      Generating...
                    </p>
                  )}
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 text-slate-400 transition-transform flex-shrink-0 ${showStrategicOverview ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {showStrategicOverview && (
                <div className="px-5 pb-5">
                  {loadingInsights && !insights ? (
                    <div className="py-6 text-center flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                      <p className="text-slate-500 text-xs">Generating strategic overview...</p>
                    </div>
                  ) : insights ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-indigo-100/60">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Strategy Summary</p>
                        <p className="text-sm text-slate-700 leading-relaxed italic border-l-2 border-brand-primary pl-3">
                          "{insights.summary}"
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-red-600 font-bold uppercase tracking-widest mb-3 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Risks to Key Results
                        </p>
                        <ul className="space-y-3">
                          {insights.risks.map((riskItem, i) => {
                            const risk = typeof riskItem === 'string' ? riskItem : riskItem.risk;
                            const reasoning = typeof riskItem === 'object' ? riskItem.reasoning : null;
                            return (
                              <li key={i} className="text-xs">
                                <div className="flex items-start text-slate-700">
                                  <span className="text-red-500 mr-2 font-black flex-shrink-0">•</span>
                                  <span>{risk}</span>
                                </div>
                                {reasoning && (
                                  <div className="ml-4 mt-1 text-[10px] text-slate-500 italic flex items-start">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                                    </svg>
                                    {reasoning}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      <div>
                        <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mb-3 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                          Focus Areas
                        </p>
                        <ul className="space-y-3">
                          {insights.focusAreas.map((focusItem, i) => {
                            const focus = typeof focusItem === 'string' ? focusItem : focusItem.area;
                            const reasoning = typeof focusItem === 'object' ? focusItem.reasoning : null;
                            return (
                              <li key={i} className="text-xs">
                                <div className="flex items-start text-slate-700">
                                  <span className="text-emerald-500 mr-2 font-black flex-shrink-0">→</span>
                                  <span>{focus}</span>
                                </div>
                                {reasoning && (
                                  <div className="ml-4 mt-1 text-[10px] text-slate-500 italic flex items-start">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                                    </svg>
                                    {reasoning}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {assessmentResult ? (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>Last run:</span>
                  <span className="font-medium text-slate-700">
                    {new Date(assessmentResult.runAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {assessmentResult.summary.critical > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs font-medium text-red-700">{assessmentResult.summary.critical} critical</span>
                    </div>
                  )}
                  {assessmentResult.summary.warning > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-xs font-medium text-amber-700">{assessmentResult.summary.warning} warnings</span>
                    </div>
                  )}
                  {assessmentResult.summary.active === 0 && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs font-medium text-green-700">All clear!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { key: 'all', label: 'All', count: assessmentResult.summary.active },
                  { key: 'resource', label: 'Resource', count: assessmentResult.summary.byCategory.resource, icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                  )},
                  { key: 'timeline', label: 'Timeline', count: assessmentResult.summary.byCategory.timeline, icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                  )},
                  { key: 'coverage', label: 'Coverage', count: assessmentResult.summary.byCategory.coverage, icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )},
                  { key: 'alignment', label: 'Alignment', count: assessmentResult.summary.byCategory.alignment, icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12zm0-2a4 4 0 100-8 4 4 0 000 8zm0-2a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  )},
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setAlertCategoryFilter(tab.key as typeof alertCategoryFilter)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      alertCategoryFilter === tab.key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {tab.icon && tab.icon}
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                        alertCategoryFilter === tab.key
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-slate-200/50 text-slate-500'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Alert list */}
              <div className="space-y-3">
                {assessmentResult.alerts
                  .filter(alert => alert.status === 'active')
                  .filter(alert => alertCategoryFilter === 'all' || alert.category === alertCategoryFilter)
                  .map(alert => (
                    <div
                      key={alert.id}
                      className={`bg-white rounded-xl border overflow-hidden transition-shadow hover:shadow-md ${
                        alert.severity === 'critical'
                          ? 'border-red-200'
                          : alert.severity === 'warning'
                          ? 'border-amber-200'
                          : 'border-blue-200'
                      }`}
                    >
                      {/* Alert header */}
                      <div
                        className={`px-4 py-3 flex items-center gap-3 cursor-pointer ${
                          alert.severity === 'critical'
                            ? 'bg-red-50'
                            : alert.severity === 'warning'
                            ? 'bg-amber-50'
                            : 'bg-blue-50'
                        }`}
                        onClick={() => toggleAlertExpanded(alert.id)}
                      >
                        {/* Severity badge */}
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${
                            alert.severity === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : alert.severity === 'warning'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {alert.severity}
                        </span>

                        {/* Category badge */}
                        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded bg-slate-100 text-slate-600">
                          {alert.category}
                        </span>

                        {/* Title & description */}
                        <div className="flex-grow min-w-0">
                          <h3 className="font-semibold text-slate-900">{alert.title}</h3>
                          <p className="text-sm text-slate-600">{alert.description}</p>
                        </div>

                        {/* Expand/collapse */}
                        <svg
                          className={`w-5 h-5 text-slate-400 transition-transform ${
                            expandedAlerts.has(alert.id) ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>

                        {/* Dismiss button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismissAlert(alert.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                          title="Dismiss"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Expanded content */}
                      {expandedAlerts.has(alert.id) && (
                        <div className="border-t border-slate-100">
                          <div className="px-4 py-4 space-y-4">
                            {/* Affected elements */}
                            <div>
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Affected</h4>
                              <div className="flex flex-wrap gap-2">
                                {alert.affectedElements.map((el, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-2 py-1 text-xs rounded-lg ${
                                      el.type === 'person'
                                        ? 'bg-purple-100 text-purple-700'
                                        : el.type === 'project'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : el.type === 'keyResult'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {el.name}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Rationale */}
                            <div>
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Rationale</h4>
                              <p className="text-sm text-slate-700 whitespace-pre-line">{alert.rationale}</p>
                            </div>

                            {/* Suggested fix actions */}
                            {(() => {
                              const fixActions = alert.suggestedActions.filter(
                                a => a.type !== 'view_capacity' && a.type !== 'view_timeline'
                              );
                              if (fixActions.length === 0) return null;

                              return (
                                <div>
                                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Suggested Fixes</h4>
                                  <div className="space-y-2">
                                    {fixActions.map(action => (
                                      <div
                                        key={action.id}
                                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                                      >
                                        <div>
                                          <p className="text-sm font-medium text-slate-900">{action.label}</p>
                                          <p className="text-xs text-slate-500">{action.description}</p>
                                        </div>
                                        <button
                                          onClick={() => setConfirmAction({ alert, action })}
                                          className="px-3 py-1.5 text-xs font-medium bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
                                        >
                                          Apply
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Navigation actions - at bottom as optional explore */}
                          {(() => {
                            const navigationActions = alert.suggestedActions.filter(
                              a => a.type === 'view_capacity' || a.type === 'view_timeline'
                            );
                            if (navigationActions.length === 0) return null;

                            return (
                              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 flex items-center gap-3 border-t border-indigo-100">
                                <span className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Explore</span>
                                <div className="flex flex-wrap gap-2">
                                  {navigationActions.map(action => (
                                    <button
                                      key={action.id}
                                      onClick={() => handleApplyAction(alert, action)}
                                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-white rounded-lg border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-all"
                                      title={action.description}
                                    >
                                      <span className={`w-6 h-6 rounded-md flex items-center justify-center ${
                                        action.type === 'view_capacity' ? 'bg-purple-100' : 'bg-blue-100'
                                      }`}>
                                        {action.type === 'view_capacity' ? (
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                          </svg>
                                        ) : (
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                        )}
                                      </span>
                                      {action.label}
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                      </svg>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))}

                {/* Empty state for filtered category */}
                {assessmentResult.alerts
                  .filter(alert => alert.status === 'active')
                  .filter(alert => alertCategoryFilter === 'all' || alert.category === alertCategoryFilter)
                  .length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-sm">No {alertCategoryFilter === 'all' ? 'active' : alertCategoryFilter} alerts</p>
                    {alertCategoryFilter !== 'all' && (
                      <button
                        onClick={() => setAlertCategoryFilter('all')}
                        className="mt-2 text-sm text-brand-primary hover:text-brand-primary/80"
                      >
                        View all alerts
                      </button>
                    )}
                  </div>
                )}

                {/* Show dismissed/resolved alerts */}
                {assessmentResult.alerts.filter(a => a.status !== 'active').length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <h3 className="text-sm font-medium text-slate-500 mb-3">
                      Dismissed & Resolved ({assessmentResult.alerts.filter(a => a.status !== 'active').length})
                    </h3>
                    <div className="space-y-2">
                      {assessmentResult.alerts
                        .filter(a => a.status !== 'active')
                        .map(alert => (
                          <div
                            key={alert.id}
                            className="px-4 py-2 bg-slate-50 rounded-lg flex items-center gap-3 opacity-60"
                          >
                            <span
                              className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded ${
                                alert.status === 'resolved'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {alert.status}
                            </span>
                            <span className="text-sm text-slate-600">{alert.title}</span>
                            {alert.resolvedAction && (
                              <span className="text-xs text-slate-400">• {alert.resolvedAction}</span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No analysis yet</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Run an analysis to get a strategic overview of your OKR strategy plus detailed alerts for resource conflicts, alignment issues, and other concerns.
              </p>
            </div>
          )}

          {/* Confirmation Dialog */}
          {confirmAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Confirm Action</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Are you sure you want to apply this fix?
                  </p>
                  <div className="p-3 bg-slate-50 rounded-lg mb-4">
                    <p className="font-medium text-slate-900">{confirmAction.action.label}</p>
                    <p className="text-sm text-slate-500 mt-1">{confirmAction.action.description}</p>
                  </div>
                  <p className="text-xs text-amber-600 mb-4">
                    This will modify your strategy plan. The change cannot be automatically undone.
                  </p>
                </div>
                <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApplyAction(confirmAction.alert, confirmAction.action)}
                    className="px-4 py-2 text-sm font-medium bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
                  >
                    Apply Fix
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Cards View */
        <>
          {/* Drag and drop hint */}
          <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
            <DragHandleIcon />
            <span>Drag Key Results between Objectives or Projects between Key Results to reorganize</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {objectives.map((objective, oIndex) => (
              <div key={objective.id} className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col border border-slate-100 hover:shadow-xl transition-shadow">
                {/* Objective Header */}
                <div className="p-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="bg-brand-primary text-white rounded-xl p-2 flex-shrink-0 shadow-md">
                      <span className="text-sm font-bold">{objective.id}</span>
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Objective</p>
                      {editingObjective === objective.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            defaultValue={objective.title}
                            className="flex-grow px-2 py-1 text-base font-bold border border-brand-primary rounded focus:ring-2 focus:ring-brand-primary"
                            autoFocus
                            onBlur={(e) => { updateObjectiveTitle(objective.id, e.target.value); setEditingObjective(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { updateObjectiveTitle(objective.id, (e.target as HTMLInputElement).value); setEditingObjective(null); } }}
                          />
                        </div>
                      ) : (
                        <h2 className="text-base font-bold text-slate-900 leading-tight">{objective.title}</h2>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Dependencies indicator */}
                      {getDependenciesFor('objective', objective.id).length > 0 && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold flex items-center gap-0.5">
                          <LinkIcon />
                          {getDependenciesFor('objective', objective.id).length}
                        </span>
                      )}
                      <button
                        onClick={() => openDependencyModal('objective', objective.id, objective.title)}
                        className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Add dependency"
                      >
                        <LinkIcon />
                      </button>
                      <button
                        onClick={() => setEditingObjective(objective.id)}
                        className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-brand-light rounded-lg transition-colors"
                        title="Edit"
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => deleteObjective(objective.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Key Results */}
                <div
                  className={`p-5 flex-grow space-y-5 transition-colors ${dropTarget?.type === 'objective' && dropTarget.id === objective.id
                    ? 'bg-emerald-50 ring-2 ring-emerald-400 ring-inset rounded-b-2xl'
                    : ''
                    }`}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnterObjective(e, objective.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnObjective(e, objective.id)}
                >
                  {objective.keyResults.map((keyResult, krIndex) => (
                    <div
                      key={keyResult.id}
                      className={`relative group/kr ${draggedItem?.type === 'kr' && draggedItem.id === keyResult.id ? 'opacity-50' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'kr', keyResult.id, objective.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-start gap-2 mb-3">
                        <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 cursor-grab active:cursor-grabbing">
                          <DragHandleIcon />
                          {keyResult.id}
                        </div>
                        {editingKR === keyResult.id ? (
                          <input
                            type="text"
                            defaultValue={keyResult.title}
                            className="flex-grow px-2 py-0.5 text-sm font-semibold border border-emerald-400 rounded focus:ring-2 focus:ring-emerald-400"
                            autoFocus
                            onBlur={(e) => { updateKRTitle(objective.id, keyResult.id, e.target.value); setEditingKR(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { updateKRTitle(objective.id, keyResult.id, (e.target as HTMLInputElement).value); setEditingKR(null); } }}
                          />
                        ) : (
                          <h3 className="text-sm font-semibold text-slate-800 flex-grow">{keyResult.title}</h3>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover/kr:opacity-100 transition-opacity">
                          {getDependenciesFor('keyResult', keyResult.id).length > 0 && (
                            <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[9px] font-bold flex items-center gap-0.5 opacity-100">
                              <LinkIcon />
                              {getDependenciesFor('keyResult', keyResult.id).length}
                            </span>
                          )}
                          <button onClick={() => openDependencyModal('keyResult', keyResult.id, keyResult.title)} className="p-1 text-slate-400 hover:text-blue-500 rounded" title="Add dependency">
                            <LinkIcon />
                          </button>
                          <button onClick={() => setEditingKR(keyResult.id)} className="p-1 text-slate-400 hover:text-emerald-600 rounded" title="Edit">
                            <EditIcon />
                          </button>
                          <button onClick={() => deleteKeyResult(objective.id, keyResult.id)} className="p-1 text-slate-400 hover:text-red-500 rounded" title="Delete">
                            <TrashIcon />
                          </button>
                        </div>
                      </div>

                      {/* Projects */}
                      <div
                        className={`ml-4 space-y-3 p-2 -m-2 rounded-lg transition-colors ${dropTarget?.type === 'kr' && dropTarget.id === keyResult.id
                          ? 'bg-amber-50 ring-2 ring-amber-400 ring-inset'
                          : ''
                          }`}
                        onDragOver={handleDragOver}
                        onDragEnter={(e) => handleDragEnterKR(e, objective.id, keyResult.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropOnKR(e, objective.id, keyResult.id)}
                      >
                        {keyResult.departmentalProjects?.map(dp => {
                          const projectStatus = getProjectResourceStatus(dp);
                          const hasActiveAlert = projectStatus.status !== 'ok' && !dismissedAlerts.has(dp.id);
                          const alertBorderClass = hasActiveAlert ? {
                            critical: 'border-l-4 border-l-red-400',
                            under: 'border-l-4 border-l-amber-400',
                            over: 'border-l-4 border-l-blue-400',
                          }[projectStatus.status] : '';

                          return (
                            <div
                              key={dp.id}
                              className={`bg-slate-50 p-3 rounded-lg border transition-all group/project ${alertBorderClass} ${draggedItem?.type === 'project' && draggedItem.id === dp.id ? 'opacity-50' : ''
                                } ${dropTarget?.type === 'project' && dropTarget.id === dp.id
                                  ? 'border-cyan-400 bg-cyan-50 ring-2 ring-cyan-400 ring-inset'
                                  : 'border-slate-100'
                                }`}
                              draggable
                              onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, 'project', dp.id, objective.id, keyResult.id); }}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              onDragEnter={(e) => handleDragEnterProject(e, objective.id, keyResult.id, dp.id)}
                              onDragLeave={(e) => { e.stopPropagation(); if (draggedItem?.type === 'headcount') handleDragLeave(e); }}
                              onDrop={(e) => handleDropOnProject(e, objective.id, keyResult.id, dp.id)}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-start gap-2 flex-grow min-w-0">
                                  {editingProject === dp.id ? (
                                    <div className="flex-grow space-y-2">
                                      <input
                                        type="text"
                                        defaultValue={dp.department}
                                        placeholder="Department"
                                        className="w-24 px-2 py-0.5 text-[10px] font-bold border border-slate-300 rounded"
                                        onBlur={(e) => updateProject(objective.id, keyResult.id, dp.id, { department: e.target.value })}
                                      />
                                      <input
                                        type="text"
                                        defaultValue={dp.title}
                                        placeholder="Project title"
                                        className="w-full px-2 py-0.5 text-[11px] border border-slate-300 rounded"
                                        onBlur={(e) => { updateProject(objective.id, keyResult.id, dp.id, { title: e.target.value }); setEditingProject(null); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') setEditingProject(null); }}
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-brand-light text-brand-dark rounded font-bold uppercase tracking-tighter flex-shrink-0 cursor-grab active:cursor-grabbing">
                                        <DragHandleIcon />
                                        {dp.department}
                                      </span>
                                      <p className="text-[11px] font-semibold text-slate-700 leading-tight">{dp.title}</p>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover/project:opacity-100 transition-opacity flex-shrink-0">
                                  {getDependenciesFor('project', dp.id).length > 0 && (
                                    <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[8px] font-bold flex items-center gap-0.5 opacity-100">
                                      <LinkIcon />
                                      {getDependenciesFor('project', dp.id).length}
                                    </span>
                                  )}
                                  <button onClick={() => openDependencyModal('project', dp.id, dp.title)} className="p-1 text-slate-400 hover:text-blue-500 rounded" title="Add dependency">
                                    <LinkIcon />
                                  </button>
                                  <button onClick={() => setEditingProject(dp.id)} className="p-1 text-slate-400 hover:text-brand-primary rounded" title="Edit">
                                    <EditIcon />
                                  </button>
                                  <button onClick={() => deleteProject(objective.id, keyResult.id, dp.id)} className="p-1 text-slate-400 hover:text-red-500 rounded" title="Delete">
                                    <TrashIcon />
                                  </button>
                                </div>
                              </div>

                              {/* Resource Alert */}
                              {(() => {
                                const resourceStatus = getProjectResourceStatus(dp);
                                const isAlertDismissed = dismissedAlerts.has(dp.id);

                                if (resourceStatus.status !== 'ok' && !isAlertDismissed) {
                                  const alertStyles = {
                                    critical: 'bg-red-50 border-red-200 text-red-700',
                                    under: 'bg-amber-50 border-amber-200 text-amber-700',
                                    over: 'bg-blue-50 border-blue-200 text-blue-700',
                                  };
                                  const iconStyles = {
                                    critical: 'text-red-500',
                                    under: 'text-amber-500',
                                    over: 'text-blue-500',
                                  };
                                  const labelText = {
                                    critical: 'Critical',
                                    under: 'Under-resourced',
                                    over: 'Over-resourced',
                                  };

                                  return (
                                    <div className={`mt-2 p-2 rounded-lg border flex items-start gap-2 animate-in fade-in duration-300 ${alertStyles[resourceStatus.status as keyof typeof alertStyles]}`}>
                                      {resourceStatus.status === 'critical' ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 flex-shrink-0 ${iconStyles[resourceStatus.status]}`} viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                      ) : resourceStatus.status === 'under' ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 flex-shrink-0 ${iconStyles[resourceStatus.status]}`} viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                      ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 flex-shrink-0 ${iconStyles[resourceStatus.status]}`} viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-bold uppercase tracking-wider">{labelText[resourceStatus.status as keyof typeof labelText]}</p>
                                        <p className="text-[10px]">{resourceStatus.message}</p>
                                      </div>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); dismissAlert(dp.id); }}
                                        className="p-0.5 hover:bg-white/50 rounded transition-colors flex-shrink-0"
                                        title="Dismiss alert"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 opacity-60 hover:opacity-100" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                      </button>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {/* Timeframe Section */}
                              <div className="mt-2 pt-2 border-t border-slate-200">
                                {editingTimeframe === dp.id ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                      </svg>
                                      <input
                                        type="date"
                                        defaultValue={dp.startDate || ''}
                                        className="px-2 py-1 text-[10px] border border-slate-200 rounded"
                                        id={`start-${dp.id}`}
                                      />
                                      <span className="text-[10px] text-slate-400">to</span>
                                      <input
                                        type="date"
                                        defaultValue={dp.endDate || ''}
                                        className="px-2 py-1 text-[10px] border border-slate-200 rounded"
                                        id={`end-${dp.id}`}
                                      />
                                      <button
                                        onClick={() => {
                                          const startDate = (document.getElementById(`start-${dp.id}`) as HTMLInputElement).value;
                                          const endDate = (document.getElementById(`end-${dp.id}`) as HTMLInputElement).value;
                                          updateTimeframe(objective.id, keyResult.id, dp.id, startDate, endDate);
                                          setEditingTimeframe(null);
                                        }}
                                        className="px-2 py-1 bg-blue-500 text-white text-[9px] rounded font-semibold"
                                      >
                                        Save
                                      </button>
                                      <button onClick={() => setEditingTimeframe(null)} className="text-[9px] text-slate-500">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className="flex items-center gap-2 text-[10px] cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 -mx-1 group/timeframe"
                                    onClick={() => setEditingTimeframe(dp.id)}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                    {dp.startDate && dp.endDate ? (
                                      <span className="text-slate-700">{dp.startDate} to {dp.endDate}</span>
                                    ) : (
                                      <span className="text-slate-400 italic">Set timeframe...</span>
                                    )}
                                    <EditIcon />
                                  </div>
                                )}
                              </div>

                              {/* Headcount Section - Draggable Team Cards */}
                              {(dp.headcount && dp.headcount.length > 0) || (dropTarget?.type === 'project' && dropTarget.id === dp.id) ? (
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                  <div className="flex items-center gap-1 mb-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                    </svg>
                                    <span className="text-[9px] font-bold text-purple-600 uppercase tracking-wider">Team</span>
                                    {dp.headcount && dp.headcount.length > 0 && (
                                      <span className="text-[8px] text-slate-400 ml-auto italic">drag to reassign</span>
                                    )}
                                  </div>

                                  {/* Drop zone indicator when dragging headcount */}
                                  {dropTarget?.type === 'project' && dropTarget.id === dp.id && (
                                    <div className="mb-2 p-2 border-2 border-dashed border-purple-400 rounded-lg bg-purple-50 flex items-center justify-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                      </svg>
                                      <span className="text-xs font-medium text-purple-700">Assign team member here</span>
                                    </div>
                                  )}

                                  <div className="flex flex-wrap gap-1.5">
                                    {dp.headcount?.map(hc => (
                                      <div
                                        key={hc.id}
                                        className={`group/hc flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${draggedItem?.type === 'headcount' && draggedItem.id === hc.id
                                          ? 'opacity-50 bg-purple-100 border-purple-300'
                                          : 'bg-white border-slate-200 hover:border-purple-300 hover:shadow-sm'
                                          }`}
                                        draggable
                                        onDragStart={(e) => {
                                          e.stopPropagation();
                                          handleDragStart(e, 'headcount', hc.id, objective.id, keyResult.id, dp.id);
                                        }}
                                        onDragEnd={handleDragEnd}
                                      >
                                        <DragHandleIcon />
                                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(hc.name)} flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0`}>
                                          {getInitials(hc.name)}
                                        </div>
                                        <div className="text-[10px]">
                                          <span className="text-slate-800 font-medium">{hc.name}</span>
                                          <span className="text-slate-400 ml-1">• {hc.role}</span>
                                          {hc.allocation && (
                                            <span className="text-purple-600 ml-1">({hc.allocation})</span>
                                          )}
                                        </div>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); removeHeadcount(objective.id, keyResult.id, dp.id, hc.id); }}
                                          className="opacity-0 group-hover/hc:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-opacity ml-1"
                                        >
                                          <CloseIcon />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {/* Add Team Member */}
                              {addingHeadcountToProject === dp.id ? (
                                <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      placeholder="Name"
                                      className="flex-grow px-2 py-1 text-[10px] border border-slate-200 rounded"
                                      id={`hc-name-${dp.id}`}
                                    />
                                    <input
                                      type="text"
                                      placeholder="Role"
                                      className="w-24 px-2 py-1 text-[10px] border border-slate-200 rounded"
                                      id={`hc-role-${dp.id}`}
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        const name = (document.getElementById(`hc-name-${dp.id}`) as HTMLInputElement).value;
                                        const role = (document.getElementById(`hc-role-${dp.id}`) as HTMLInputElement).value;
                                        if (name && role) {
                                          addHeadcount(objective.id, keyResult.id, dp.id, name, role);
                                          setAddingHeadcountToProject(null);
                                        }
                                      }}
                                      className="px-2 py-1 bg-purple-500 text-white text-[10px] rounded font-semibold"
                                    >
                                      Add
                                    </button>
                                    {personnel.length > 0 && (
                                      <button
                                        onClick={() => setShowPersonnelPicker(dp.id)}
                                        className="px-2 py-1 bg-emerald-500 text-white text-[10px] rounded font-semibold"
                                      >
                                        Pick from Roster
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setAddingHeadcountToProject(null)}
                                      className="px-2 py-1 text-slate-500 text-[10px] font-medium"
                                    >
                                      Cancel
                                    </button>
                                  </div>

                                  {/* Personnel Picker */}
                                  {showPersonnelPicker === dp.id && (
                                    <div className="mt-2 bg-white border border-emerald-200 rounded-lg max-h-40 overflow-y-auto shadow-lg">
                                      {personnel.filter(p => p.department.toLowerCase() === dp.department.toLowerCase()).length > 0 && (
                                        <div className="px-2 py-1 bg-emerald-50 text-[9px] font-bold text-emerald-700 uppercase">{dp.department}</div>
                                      )}
                                      {personnel.filter(p => p.department.toLowerCase() === dp.department.toLowerCase()).map(person => (
                                        <button
                                          key={person.id}
                                          onClick={() => addPersonnelToProject(objective.id, keyResult.id, dp.id, person)}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-emerald-50 text-left border-b border-slate-50 last:border-0"
                                        >
                                          <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(person.name)} flex items-center justify-center text-white text-[8px] font-bold`}>
                                            {getInitials(person.name)}
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-medium text-slate-800">{person.name}</p>
                                            <p className="text-[9px] text-slate-500">{person.role}</p>
                                          </div>
                                        </button>
                                      ))}
                                      {personnel.filter(p => p.department.toLowerCase() !== dp.department.toLowerCase()).slice(0, 5).map(person => (
                                        <button
                                          key={person.id}
                                          onClick={() => addPersonnelToProject(objective.id, keyResult.id, dp.id, person)}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0"
                                        >
                                          <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(person.name)} flex items-center justify-center text-white text-[8px] font-bold`}>
                                            {getInitials(person.name)}
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-medium text-slate-800">{person.name}</p>
                                            <p className="text-[9px] text-slate-500">{person.role} • {person.department}</p>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => setAddingHeadcountToProject(dp.id)}
                                  className="mt-2 text-[10px] text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1"
                                >
                                  <PlusIcon /> Add Team Member
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* Add Project */}
                        {addingProjectToKR === keyResult.id ? (
                          <div className="bg-white border-2 border-dashed border-brand-primary/30 rounded-lg p-3 space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newProjectDept}
                                onChange={(e) => setNewProjectDept(e.target.value)}
                                placeholder="Dept"
                                className="w-20 px-2 py-1 text-[11px] border border-slate-200 rounded focus:ring-1 focus:ring-brand-primary"
                              />
                              <input
                                type="text"
                                value={newProjectTitle}
                                onChange={(e) => setNewProjectTitle(e.target.value)}
                                placeholder="Project title..."
                                className="flex-grow px-2 py-1 text-[11px] border border-slate-200 rounded focus:ring-1 focus:ring-brand-primary"
                                onKeyDown={(e) => e.key === 'Enter' && addProject(objective.id, keyResult.id)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => addProject(objective.id, keyResult.id)}
                                disabled={!newProjectDept.trim() || !newProjectTitle.trim()}
                                className="px-3 py-1 bg-brand-primary text-white text-[10px] rounded font-semibold disabled:bg-slate-300"
                              >
                                Add Project
                              </button>
                              <button
                                onClick={() => { setAddingProjectToKR(null); setNewProjectDept(''); setNewProjectTitle(''); }}
                                className="px-3 py-1 text-slate-500 text-[10px] font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingProjectToKR(keyResult.id)}
                            className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-[11px] text-slate-500 hover:border-brand-primary hover:text-brand-primary font-medium flex items-center justify-center gap-1 transition-colors"
                          >
                            <PlusIcon /> Add Project
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Add Key Result */}
                  {addingKRToObjective === objective.id ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                      <input
                        type="text"
                        value={newKRTitle}
                        onChange={(e) => setNewKRTitle(e.target.value)}
                        placeholder="Enter key result..."
                        className="w-full px-3 py-2 text-sm border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-400"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && addKeyResult(objective.id)}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => addKeyResult(objective.id)}
                          disabled={!newKRTitle.trim()}
                          className="px-4 py-1.5 bg-emerald-500 text-white text-sm rounded-lg font-semibold disabled:bg-slate-300"
                        >
                          Add Key Result
                        </button>
                        <button
                          onClick={() => { setAddingKRToObjective(null); setNewKRTitle(''); }}
                          className="px-4 py-1.5 text-slate-500 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingKRToObjective(objective.id)}
                      className="w-full py-3 border-2 border-dashed border-emerald-200 rounded-xl text-sm text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <PlusIcon /> Add Key Result
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* AI Strategy Chatbot */}
      {/* Floating Chat Button */}
      <button
        onClick={() => setShowChat(!showChat)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all z-50 ${showChat
          ? 'bg-slate-700 hover:bg-slate-600'
          : 'bg-gradient-to-br from-brand-primary to-purple-600 hover:scale-110'
          }`}
      >
        {showChat ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-4 duration-300">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-brand-primary to-purple-600 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold">Strategy Assistant</h3>
                <p className="text-xs text-white/70">Ask me about your OKRs</p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-light flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-primary" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-slate-600 font-medium mb-2">Ask me anything about your strategy!</p>
                <div className="space-y-2 text-xs text-slate-500">
                  <p className="cursor-pointer hover:text-brand-primary" onClick={() => setChatInput("Who has available capacity to take on more work?")}>
                    💡 "Who has available capacity to take on more work?"
                  </p>
                  <p className="cursor-pointer hover:text-brand-primary" onClick={() => setChatInput("Which projects are at risk and why?")}>
                    💡 "Which projects are at risk and why?"
                  </p>
                  <p className="cursor-pointer hover:text-brand-primary" onClick={() => setChatInput("I need a backend engineer. Who should I consider?")}>
                    💡 "I need a backend engineer. Who should I consider?"
                  </p>
                  <p className="cursor-pointer hover:text-brand-primary" onClick={() => setChatInput("Which projects have dependency conflicts?")}>
                    💡 "Which projects have dependency conflicts?"
                  </p>
                </div>
              </div>
            )}

            {chatMessages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${message.role === 'user'
                    ? 'bg-brand-primary text-white rounded-br-md'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm'
                    }`}
                >
                  {message.role === 'assistant'
                    ? renderChatMarkdown(message.content)
                    : <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  }
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-xs text-slate-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-slate-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask about your strategy..."
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                disabled={isChatLoading}
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || isChatLoading}
                className="px-4 py-2.5 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-secondary disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dependency Modal */}
      {showDependencyModal && dependencySource && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => { setShowDependencyModal(false); setDependencySource(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Add Dependency</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Select an element that "{dependencySource.title}" depends on
                  </p>
                </div>
                <button
                  onClick={() => { setShowDependencyModal(false); setDependencySource(null); }}
                  className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {objectives.map((obj, oIndex) => {
                  const isSourceObj = dependencySource.type === 'objective' && dependencySource.id === obj.id;
                  const existingDep = dependencies.find(d =>
                    d.sourceType === dependencySource.type &&
                    d.sourceId === dependencySource.id &&
                    d.targetType === 'objective' &&
                    d.targetId === obj.id
                  );

                  return (
                    <div key={obj.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      {/* Objective */}
                      <button
                        onClick={() => !isSourceObj && !existingDep && addDependency('objective', obj.id)}
                        disabled={isSourceObj || !!existingDep}
                        className={`w-full p-3 flex items-center gap-3 text-left transition-colors ${isSourceObj ? 'bg-slate-100 opacity-50 cursor-not-allowed' :
                          existingDep ? 'bg-emerald-50 cursor-default' :
                            'hover:bg-blue-50 cursor-pointer'
                          }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-brand-primary text-white flex items-center justify-center font-bold text-sm">
                          {obj.id}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">{obj.title}</p>
                          <p className="text-[10px] text-slate-500 uppercase">Objective</p>
                        </div>
                        {existingDep && (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            Linked
                          </span>
                        )}
                        {isSourceObj && (
                          <span className="px-2 py-1 bg-slate-200 text-slate-500 rounded-full text-xs font-medium">
                            Source
                          </span>
                        )}
                      </button>

                      {/* Key Results */}
                      {obj.keyResults.length > 0 && (
                        <div className="border-t border-slate-100 bg-slate-50/50">
                          {obj.keyResults.map((kr, krIndex) => {
                            const isSourceKR = dependencySource.type === 'keyResult' && dependencySource.id === kr.id;
                            const existingKRDep = dependencies.find(d =>
                              d.sourceType === dependencySource.type &&
                              d.sourceId === dependencySource.id &&
                              d.targetType === 'keyResult' &&
                              d.targetId === kr.id
                            );

                            return (
                              <div key={kr.id}>
                                <button
                                  onClick={() => !isSourceKR && !existingKRDep && addDependency('keyResult', kr.id)}
                                  disabled={isSourceKR || !!existingKRDep}
                                  className={`w-full p-2 pl-10 flex items-center gap-3 text-left transition-colors ${isSourceKR ? 'bg-slate-100 opacity-50 cursor-not-allowed' :
                                    existingKRDep ? 'bg-emerald-50 cursor-default' :
                                      'hover:bg-purple-50 cursor-pointer'
                                    }`}
                                >
                                  <div className="w-6 h-6 rounded bg-purple-500 text-white flex items-center justify-center font-bold text-[10px]">
                                    KR
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700 truncate">{kr.title}</p>
                                  </div>
                                  {existingKRDep && (
                                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-medium">
                                      Linked
                                    </span>
                                  )}
                                  {isSourceKR && (
                                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded-full text-[10px] font-medium">
                                      Source
                                    </span>
                                  )}
                                </button>

                                {/* Projects */}
                                {kr.departmentalProjects && kr.departmentalProjects.length > 0 && (
                                  <div className="bg-white/50">
                                    {kr.departmentalProjects.map(proj => {
                                      const isSourceProj = dependencySource.type === 'project' && dependencySource.id === proj.id;
                                      const existingProjDep = dependencies.find(d =>
                                        d.sourceType === dependencySource.type &&
                                        d.sourceId === dependencySource.id &&
                                        d.targetType === 'project' &&
                                        d.targetId === proj.id
                                      );

                                      return (
                                        <button
                                          key={proj.id}
                                          onClick={() => !isSourceProj && !existingProjDep && addDependency('project', proj.id)}
                                          disabled={isSourceProj || !!existingProjDep}
                                          className={`w-full p-2 pl-16 flex items-center gap-2 text-left transition-colors ${isSourceProj ? 'bg-slate-100 opacity-50 cursor-not-allowed' :
                                            existingProjDep ? 'bg-emerald-50 cursor-default' :
                                              'hover:bg-teal-50 cursor-pointer'
                                            }`}
                                        >
                                          <div className="w-5 h-5 rounded bg-teal-500 text-white flex items-center justify-center font-bold text-[8px]">
                                            P
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-600 truncate">{proj.title}</p>
                                            <p className="text-[9px] text-slate-400">{proj.department}</p>
                                          </div>
                                          {existingProjDep && (
                                            <span className="px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-medium">
                                              Linked
                                            </span>
                                          )}
                                          {isSourceProj && (
                                            <span className="px-1 py-0.5 bg-slate-200 text-slate-500 rounded-full text-[9px] font-medium">
                                              Source
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => { setShowDependencyModal(false); setDependencySource(null); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceView;
