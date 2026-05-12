/**
 * Leadership Check-in Brief Types
 *
 * Types for the check-in brief system that synthesizes leadership updates
 * into a prioritized, actionable meeting agenda with interactive proposal cards.
 */

export type CheckInItemType = 'decision' | 'escalation' | 'acceleration' | 'fyi';

export type CheckInSeverity = 'critical' | 'warning' | 'info' | 'good';

export type CheckInItemStatus = 'pending' | 'approved' | 'rejected' | 'deferred';

export interface CheckInChange {
  targetType: 'project' | 'keyResult' | 'objective' | 'personnel' | 'budget';
  targetId: string;
  targetLabel: string;
  field: string;
  from: string;
  to: string;
  rationale?: string;
}

export interface CheckInItem {
  id: string;
  type: CheckInItemType;
  severity: CheckInSeverity;
  title: string;
  proposedBy: string;
  summary: string;
  rationale: string;
  changes: CheckInChange[];
  impact: string;
  status: CheckInItemStatus;
  resolvedAt?: string;
}

export interface CheckInBrief {
  date: string;
  period: string;
  lastCheckIn: string;
  items: CheckInItem[];
}

// ============================================
// Leader Update Types (Pre-Check-in Submissions)
// ============================================

export type LeaderRole = 'VP Engineering' | 'VP Sales' | 'VP Product' | 'VP People' | 'VP Customer Success';

export type UpdateStatus = 'on_track' | 'at_risk' | 'blocked' | 'ahead' | 'done';

// Structured Detailed Analysis dimensions
export type OutcomeStatus = 'on_target' | 'partial' | 'missed';
export type TimeStatus = 'on_time' | 'delayed' | 'overdue';
export type ExecutionHealthStatus = 'stable' | 'watch' | 'at_risk';

export interface DetailedAnalysis {
  outcome: { status: OutcomeStatus; bullets: string[] };
  time: { status: TimeStatus; bullets: string[] };
  executionHealth: { status: ExecutionHealthStatus; bullets: string[] };
}

export type FrictionType =
  | 'override'
  | 'missed_risk'
  | 'competing_proposal'
  | 'cross_team_impact'
  | 'data_discrepancy'
  | 'late_submission';

export interface LeaderItemUpdate {
  itemId: string;
  itemType: 'project' | 'keyResult';
  itemLabel: string;
  aiSuggestedStatus: UpdateStatus;
  aiRationale: string;
  leaderStatus: UpdateStatus;
  leaderNarrative?: string;
  confirmed: boolean;
  proposedChanges?: CheckInChange[];
  metricUpdate?: { field: string; from: string | number; to: string | number };
  verboseAssessment?: string;
  detailedAnalysis?: DetailedAnalysis;
  sourceDocumentIds?: string[];
}

export interface FrictionIndicator {
  id: string;
  type: FrictionType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  relatedItemIds: string[];
  relatedLeaders?: LeaderRole[];
  autoTagged: boolean;
}

export interface LeaderUpdate {
  leader: LeaderRole;
  department: string;
  submittedAt: string;
  isLate: boolean;
  items: LeaderItemUpdate[];
  frictions: FrictionIndicator[];
}

export interface LeaderUpdatesBrief {
  date: string;
  deadline: string;
  leaders: LeaderUpdate[];
}

// ============================================
// Proposed Actions (High-level AI recommendations)
// ============================================

export interface ProposedAction {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  affectedEntityIds: string[];
  affectedEntityLabels: string[];
  severity: 'critical' | 'warning' | 'info';
  status: 'open' | 'refined' | 'dismissed';
  refinedChanges: CheckInChange[];
}

// ============================================
// Interactive Leader Draft Types
// ============================================

export interface LeaderDraftUpdate {
  itemId: string;
  itemType: 'project' | 'keyResult';
  itemLabel: string;
  aiSuggestedStatus: UpdateStatus;
  aiRationale: string;
  aiFlags?: string[];
  leaderStatus: UpdateStatus;
  leaderNarrative: string;
  confirmed: boolean;
  proposedActions: ProposedAction[];
  proposedChanges: CheckInChange[];
  metricUpdate?: { field: string; from: string | number; to: string | number };
  verboseAssessment?: string;
  detailedAnalysis?: DetailedAnalysis;
  sourceDocumentIds?: string[];
  generatedAt?: string;
}

export interface CustomProposal {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  changes: CheckInChange[];
  severity: 'critical' | 'warning' | 'info';
}

export interface LeaderDraftSubmission {
  leader: LeaderRole;
  department: string;
  items: LeaderDraftUpdate[];
  customProposals: CustomProposal[];
  submittedAt?: string;
}

// ============================================
// Source Document Types (Evidence for AI Assessments)
// ============================================

export type SourceDocumentType = 'notion_doc' | 'email' | 'linear_update' | 'slack_message' | 'meeting_notes';

export interface SourceDocument {
  id: string;
  type: SourceDocumentType;
  title: string;
  author: string;
  authorRole?: string;
  date: string;
  url: string;
  summary: string;
  content: string;
  relatedItemIds: string[];
}
