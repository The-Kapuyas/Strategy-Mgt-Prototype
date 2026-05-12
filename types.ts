/**
 * OKR (Objectives and Key Results) Type Definitions
 * 
 * Following OKR best practices:
 * - Objectives: Qualitative, inspiring, time-bound goals
 * - Key Results: Quantitative, measurable outcomes that indicate objective achievement
 */

/**
 * Dependency - A relationship between strategy elements
 */
export interface Dependency {
  id: string;
  /** Type of the source element */
  sourceType: 'objective' | 'keyResult' | 'project';
  /** ID of the source element */
  sourceId: string;
  /** Type of the target element (what this depends on) */
  targetType: 'objective' | 'keyResult' | 'project';
  /** ID of the target element */
  targetId: string;
  /** Type of dependency relationship */
  dependencyType: 'blocks' | 'depends_on' | 'relates_to';
  /** Optional description of the dependency */
  description?: string;
}

/**
 * Invitation - A workspace invitation sent to a specific email address
 */
export interface Invitation {
  /** Random UUID used as lookup key and encoded in the invite URL */
  token: string;
  recipientEmail: string;
  createdAt: string;        // ISO timestamp
  expiresAt: string;        // ISO timestamp (createdAt + 7 days)
  acceptedAt: string | null; // null = pending
  revoked: boolean;
  /** Snapshot of company name at invite creation time */
  companyName: string;
}

/**
 * Personnel - A team member who can be assigned to projects
 */
export interface Personnel {
  id: string;
  name: string;
  role: string;
  department: string;
  skills?: string[];
  availability?: string; // e.g., "Full-time", "Part-time", "50%"
  email?: string;
}

/**
 * ProjectAssignment - A personnel assignment to a project
 */
export interface ProjectAssignment {
  id: string;
  personnelId?: string; // Reference to Personnel if from roster
  name: string;
  role: string;
  allocation?: string; // e.g., "Full-time", "Part-time", "50%"
}

/**
 * Team - A named group of members within a project
 */
export interface Team {
  id: string;
  name: string;
  department?: string;
  description?: string;
  members?: ProjectAssignment[];
}

export interface DepartmentalProject {
  id: string;
  department: string;
  title: string;
  /** Project description for staffing analysis */
  description?: string;
  status: 'To Do' | 'Doing' | 'Done';
  progress: number; // 0 to 100
  /** Project timeframe - start date */
  startDate?: string; // ISO date string (YYYY-MM-DD)
  /** Project timeframe - end date */
  endDate?: string; // ISO date string (YYYY-MM-DD)
  /** Headcount - personnel assigned to the project */
  headcount?: ProjectAssignment[];
  /** Optional teams that organize headcount. If present, members nest under teams instead of directly as headcount */
  teams?: Team[];
  /** Priority for leadership check-in */
  priority?: 'High' | 'Medium' | 'Low';
  /** DRI / project lead name */
  owner?: string;
  /** What does success look like (target outcome) */
  target?: string;
  /** Where are we today (current progress narrative) */
  actual?: string;
  /** Key blockers or risks */
  risks?: string;
  /** Next key deliverable or milestone */
  nextMilestone?: string;
}

/**
 * @deprecated Use startDate/endDate and headcount on DepartmentalProject instead
 */
export interface Resource {
  id: string;
  label: string;
  value: string;
}

/**
 * DepartmentalKeyResult - A department-scoped key result that sits between
 * a company-level Key Result and its Projects (optional layer)
 */
export interface DepartmentalKeyResult {
  id: string;
  title: string;
  description?: string;
  department: string;
  targetMetric?: string;
  progress?: number;
  targetDate?: string;
  status?: string;
  owner?: string;
  metric?: string;
  baseline?: number;
  current?: number;
  target?: number;
  risks?: string;
  nextMilestone?: string;
  departmentalProjects?: DepartmentalProject[];
}

/**
 * Key Result - A measurable outcome that indicates progress toward an Objective
 *
 * Best practices:
 * - Should be specific and measurable (include numbers/metrics)
 * - Should have a clear target and baseline
 * - Typically 3-5 Key Results per Objective
 * - Should be ambitious but achievable (70% completion is considered success)
 */
export interface KeyResult {
  id: string;
  title: string;
  /** Optional description providing context for the key result */
  description?: string;
  /** Optional target metric (e.g., "100 customers", "50% increase") */
  targetMetric?: string;
  /** Optional current progress toward the key result (0-100) */
  progress?: number;
  /** Target date for achieving this key result */
  targetDate?: string; // ISO date string (YYYY-MM-DD)
  /** Departmental projects that contribute to this key result */
  departmentalProjects?: DepartmentalProject[];
  /** Optional departmental KRs between this company KR and its projects */
  departmentalKeyResults?: DepartmentalKeyResult[];
  // Blueprint-sourced metadata
  status?: string;    // e.g. "on_track" | "at_risk" | "in_progress"
  owner?: string;     // e.g. "VP Sales"
  metric?: string;    // e.g. "Deals Closed"
  baseline?: number;  // starting value
  current?: number;   // current value
  target?: number;    // target value
  /** KR-level blockers or risks for leadership check-in */
  risks?: string;
  /** Next key action or deliverable */
  nextMilestone?: string;
}

/**
 * Objective - An inspiring, qualitative goal
 * 
 * Best practices:
 * - Should be qualitative and inspirational
 * - Should be time-bound (typically quarterly or annual)
 * - Should be memorable and motivating
 * - Typically 3-5 Objectives per period
 */
export interface Objective {
  id: string;
  title: string;
  /** Strategic description of this objective */
  description?: string;
  /** Time period for this objective (e.g., "Q1 2026", "2026") */
  timePeriod?: string;
  keyResults: KeyResult[];
  /** DRI / objective owner */
  owner?: string;
  /** Overall health status for leadership check-in */
  status?: string;
  /** Brief health narrative or key update */
  summary?: string;
  /** Objective-level blockers or risks */
  risks?: string;
  /** Next key milestone or deliverable */
  nextMilestone?: string;
}

// Legacy type aliases for backward compatibility during migration
export type Priority = Objective;
export type Initiative = KeyResult;
