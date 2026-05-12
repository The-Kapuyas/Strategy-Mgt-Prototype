/**
 * AI Plan Assessment Types
 *
 * Types for the assessment system that analyzes strategy plans
 * to identify concerns around feasibility and effectiveness.
 */

export type AssessmentSeverity = 'info' | 'warning' | 'critical';

export type AssessmentCategory =
  | 'resource'      // Resource over-allocation, skill gaps
  | 'timeline'      // Timeline conflicts, unrealistic durations
  | 'alignment'     // KRs without projects, orphaned projects
  | 'coverage'      // Objectives without KRs, missing metrics
  | 'risk';         // High-risk dependencies, blockers

export type AlertStatus = 'active' | 'dismissed' | 'resolved';

export type SuggestedActionType =
  | 'reassign'          // Reassign person to different project
  | 'remove'            // Remove person from project
  | 'adjust_allocation' // Change allocation percentage
  | 'adjust_timeline'   // Shift project dates
  | 'add_resource'      // Suggest hiring/adding resource
  | 'split_project'     // Break project into phases
  | 'add_project'       // Add a new project under a KR
  | 'add_kr'            // Add a key result to an objective
  | 'view_capacity'     // Navigate to Capacity view with filters
  | 'view_timeline';    // Navigate to Timeline view with filters

export interface AffectedElement {
  type: 'objective' | 'keyResult' | 'departmentalKeyResult' | 'project' | 'team' | 'person';
  id: string;
  name: string;
}

export interface SuggestedAction {
  id: string;
  label: string;
  description: string;
  type: SuggestedActionType;

  // Action-specific payload
  payload: {
    // For reassign
    projectId?: string;
    projectTitle?: string;
    fromPersonName?: string;
    toPersonName?: string;

    // For remove
    personName?: string;

    // For adjust_allocation
    newAllocation?: string;

    // For adjust_timeline (project)
    newStartDate?: string;
    newEndDate?: string;

    // For adjust_timeline (KR target date)
    krId?: string;
    krTitle?: string;
    currentTargetDate?: string;
    suggestedTargetDate?: string;

    // For add_resource
    role?: string;
    skills?: string[];
    suggestedPersonName?: string;
    suggestedPersonId?: string;
    suggestedAllocation?: string;
    availableCapacity?: number; // 0-1 decimal

    // For split_project
    phases?: { name: string; duration: string }[];

    // For add_project
    targetKrId?: string;
    newProjectTitle?: string;
    newProjectDescription?: string;
    newProjectDepartment?: string;
    newProjectStartDate?: string;
    newProjectEndDate?: string;

    // For add_kr
    objectiveId?: string;
    suggestedKRTitle?: string;
    suggestedKRMetric?: string;
    suggestedKRTarget?: string;

    // For view_capacity (navigation)
    filterPersonNames?: string[];  // People to show in Capacity view

    // For view_timeline (navigation)
    filterKrId?: string;           // KR to highlight in Timeline
    filterProjectIds?: string[];   // Projects to show in Timeline
    highlightDeadline?: string;    // KR target date to show as deadline marker
  };
}

export interface AssessmentAlert {
  id: string;
  category: AssessmentCategory;
  severity: AssessmentSeverity;
  title: string;
  description: string;
  rationale: string;

  // Affected elements (for navigation and context)
  affectedElements: AffectedElement[];

  // Suggested actions to resolve the alert
  suggestedActions: SuggestedAction[];

  // Alert state
  status: AlertStatus;
  dismissedAt?: string;
  dismissedReason?: string;
  resolvedAt?: string;
  resolvedAction?: string;
}

export interface AssessmentSummary {
  total: number;
  active: number;
  dismissed: number;
  resolved: number;
  critical: number;
  warning: number;
  info: number;
  byCategory: Record<AssessmentCategory, number>;
}

export interface AssessmentResult {
  id: string;
  runAt: string;
  alerts: AssessmentAlert[];
  summary: AssessmentSummary;
}

// Cascaded alert summary for hierarchy rollup
export interface ChildIssueSummary {
  type: 'keyResult' | 'departmentalKeyResult' | 'project' | 'team';
  id: string;
  name: string;
  alertCount: number;
  maxSeverity: AssessmentSeverity;
}

export interface CascadedAlertSummary {
  directCount: number;
  directAlerts: AssessmentAlert[];
  totalCount: number;
  totalMaxSeverity: AssessmentSeverity;
  childIssues: ChildIssueSummary[];
}

// Helper type for over-allocation data
export interface MonthlyAllocation {
  month: string; // YYYY-MM format
  total: number; // 0.0 to X.X (can exceed 1.0)
  projects: { id: string; title: string; allocation: number }[];
}

export interface PersonAllocationData {
  personName: string;
  monthlyAllocations: MonthlyAllocation[];
  maxAllocation: number;
  overallocatedMonths: MonthlyAllocation[];
}
