/**
 * Strategy Helpers
 * Utility functions for working with objectives, KRs, projects, and dependencies
 */

import { Objective, KeyResult, DepartmentalKeyResult, DepartmentalProject, ProjectAssignment, Team, Dependency } from '../types';
import { MS_PER_DAY, MS_PER_MONTH, ResourceStatus } from './constants';

// ─── Date Calculation Utilities ───────────────────────────────────────────────

/**
 * Calculate the difference between two dates in days
 */
export const getDateDiffInDays = (start: Date, end: Date): number => {
  return (end.getTime() - start.getTime()) / MS_PER_DAY;
};

/**
 * Calculate the difference between two dates in months (approximate, 30-day months)
 */
export const getDateDiffInMonths = (start: Date, end: Date): number => {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_MONTH));
};

/**
 * Calculate project duration in months from date strings
 */
export const getProjectDurationMonths = (startDate?: string, endDate?: string): number => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return getDateDiffInMonths(start, end);
};

// ─── Hierarchy Traversal Helpers ──────────────────────────────────────────────

/**
 * Get all projects from a KR, including those nested under departmental KRs
 */
export const getKRAllProjects = (kr: KeyResult): DepartmentalProject[] => {
  const projects = [...(kr.departmentalProjects || [])];
  for (const dkr of kr.departmentalKeyResults || []) {
    projects.push(...(dkr.departmentalProjects || []));
  }
  return projects;
};

/**
 * Get all members from a project, including those nested under teams
 */
export const getAllProjectMembers = (project: DepartmentalProject): ProjectAssignment[] => {
  if (project.teams?.length) {
    const teamMembers = project.teams.flatMap(t => t.members || []);
    const teamMemberIds = new Set(teamMembers.map(m => m.id));
    const unaffiliated = (project.headcount || []).filter(hc => !teamMemberIds.has(hc.id));
    return [...teamMembers, ...unaffiliated];
  }
  return project.headcount || [];
};

/**
 * Traverse all projects in the hierarchy with full parent context.
 * Handles optional DKR layer transparently.
 */
export const forEachProject = (
  objectives: Objective[],
  callback: (project: DepartmentalProject, context: { objective: Objective; keyResult: KeyResult; departmentalKeyResult?: DepartmentalKeyResult }) => void
): void => {
  for (const obj of objectives) {
    for (const kr of obj.keyResults) {
      for (const proj of kr.departmentalProjects || []) {
        callback(proj, { objective: obj, keyResult: kr });
      }
      for (const dkr of kr.departmentalKeyResults || []) {
        for (const proj of dkr.departmentalProjects || []) {
          callback(proj, { objective: obj, keyResult: kr, departmentalKeyResult: dkr });
        }
      }
    }
  }
};

// ─── Project Context Types ────────────────────────────────────────────────────

export interface ProjectWithContext {
  project: DepartmentalProject;
  objective: Objective;
  keyResult: KeyResult;
  departmentalKeyResult?: DepartmentalKeyResult;
}

// ─── Data Traversal Utilities ─────────────────────────────────────────────────

/**
 * Get all projects with their parent context (objective and KR)
 * Optionally filter to only projects with dates
 */
export const getAllProjectsWithContext = (
  objectives: Objective[],
  options: { requireDates?: boolean } = {}
): ProjectWithContext[] => {
  const { requireDates = false } = options;
  const projects: ProjectWithContext[] = [];

  forEachProject(objectives, (proj, ctx) => {
    if (!requireDates || (proj.startDate && proj.endDate)) {
      projects.push({ project: proj, ...ctx });
    }
  });

  return projects;
};

/**
 * Get all unique projects across all objectives (deduplicated by ID)
 */
export const getUniqueProjects = (objectives: Objective[]): DepartmentalProject[] => {
  const uniqueProjects = new Map<string, DepartmentalProject>();
  forEachProject(objectives, (proj) => uniqueProjects.set(proj.id, proj));
  return Array.from(uniqueProjects.values());
};

/**
 * Get all unique departments from objectives
 */
export const getAllDepartments = (objectives: Objective[]): string[] => {
  const depts = new Set<string>();
  forEachProject(objectives, (proj) => {
    if (proj.department) depts.add(proj.department);
  });
  return Array.from(depts).sort();
};

// ─── Element Lookup Utilities ─────────────────────────────────────────────────

export type ElementType = 'objective' | 'keyResult' | 'departmentalKeyResult' | 'project' | 'team';

/**
 * Find an element's title by type and ID
 */
export const getElementName = (
  objectives: Objective[],
  type: ElementType,
  id: string
): string => {
  for (const obj of objectives) {
    if (type === 'objective' && obj.id === id) return obj.title;
    for (const kr of obj.keyResults) {
      if (type === 'keyResult' && kr.id === id) return kr.title;
      if (type === 'departmentalKeyResult') {
        const dkr = (kr.departmentalKeyResults || []).find(d => d.id === id);
        if (dkr) return dkr.title;
      }
      for (const proj of getKRAllProjects(kr)) {
        if (type === 'project' && proj.id === id) return proj.title;
        if (type === 'team') {
          const team = (proj.teams || []).find(t => t.id === id);
          if (team) return team.name;
        }
      }
    }
  }
  return 'Unknown';
};

/**
 * Find an objective by ID
 */
export const findObjective = (objectives: Objective[], id: string): Objective | undefined => {
  return objectives.find(o => o.id === id);
};

/**
 * Find a key result by ID, returns the KR and its parent objective index
 */
export const findKeyResult = (
  objectives: Objective[],
  id: string
): { kr: KeyResult; objIndex: number; krIndex: number } | null => {
  for (let oi = 0; oi < objectives.length; oi++) {
    const ki = objectives[oi].keyResults.findIndex(k => k.id === id);
    if (ki >= 0) {
      return { kr: objectives[oi].keyResults[ki], objIndex: oi, krIndex: ki };
    }
  }
  return null;
};

/**
 * Find a departmental key result by ID
 */
export const findDepartmentalKeyResult = (
  objectives: Objective[],
  id: string
): { dkr: DepartmentalKeyResult; parentKR: KeyResult; parentObj: Objective } | null => {
  for (const obj of objectives) {
    for (const kr of obj.keyResults) {
      const dkr = (kr.departmentalKeyResults || []).find(d => d.id === id);
      if (dkr) return { dkr, parentKR: kr, parentObj: obj };
    }
  }
  return null;
};

/**
 * Find a project by ID (searches both direct projects and those under DKRs)
 */
export const findProject = (objectives: Objective[], id: string): DepartmentalProject | null => {
  for (const obj of objectives) {
    for (const kr of obj.keyResults) {
      const p = kr.departmentalProjects?.find(p => p.id === id);
      if (p) return p;
      for (const dkr of kr.departmentalKeyResults || []) {
        const dp = dkr.departmentalProjects?.find(p => p.id === id);
        if (dp) return dp;
      }
    }
  }
  return null;
};

/**
 * Find a team by ID across all projects
 */
export const findTeam = (
  objectives: Objective[],
  id: string
): { team: Team; parentProject: DepartmentalProject; parentKR: KeyResult; parentObj: Objective } | null => {
  for (const obj of objectives) {
    for (const kr of obj.keyResults) {
      for (const proj of getKRAllProjects(kr)) {
        const team = (proj.teams || []).find(t => t.id === id);
        if (team) return { team, parentProject: proj, parentKR: kr, parentObj: obj };
      }
    }
  }
  return null;
};

/**
 * Find a person (ProjectAssignment) by ID across all projects
 * Searches both direct headcount and team members
 */
export const findPersonInfo = (
  objectives: Objective[],
  id: string
): { person: ProjectAssignment; projectCount: number } | null => {
  let projectCount = 0;
  let person: ProjectAssignment | null = null;
  forEachProject(objectives, (proj) => {
    const members = getAllProjectMembers(proj);
    const hc = members.find(h => h.id === id);
    if (hc) { person = hc; projectCount++; }
  });
  return person ? { person, projectCount } : null;
};

// ─── Dependency Utilities ─────────────────────────────────────────────────────

/**
 * Get all dependencies for a given element (as source or target)
 */
export const getDependenciesForElement = (
  dependencies: Dependency[],
  type: ElementType,
  id: string
): Dependency[] => {
  return dependencies.filter(d =>
    (d.sourceType === type && d.sourceId === id) ||
    (d.targetType === type && d.targetId === id)
  );
};

// ─── Status Counting Utilities ────────────────────────────────────────────────

export interface StatusCounts {
  critical: number;
  warning: number; // under + over
  ok: number;
  total: number;
}

/**
 * Count projects by their resource status
 */
export const countProjectsByStatus = (
  projects: DepartmentalProject[],
  getProjectResourceStatus: (project: DepartmentalProject) => { status: ResourceStatus; message: string }
): StatusCounts => {
  const counts: StatusCounts = { critical: 0, warning: 0, ok: 0, total: projects.length };

  projects.forEach(p => {
    const status = getProjectResourceStatus(p).status;
    if (status === 'critical') counts.critical++;
    else if (status === 'under' || status === 'over') counts.warning++;
    else counts.ok++;
  });

  return counts;
};

/**
 * Get alert count (critical + warning) from status counts
 */
export const getAlertCount = (counts: StatusCounts): number => {
  return counts.critical + counts.warning;
};

/**
 * Check if there are any alerts (critical or warning status)
 */
export const hasAlerts = (counts: StatusCounts): boolean => {
  return counts.critical > 0 || counts.warning > 0;
};

/**
 * Check if any project has critical status
 */
export const hasCritical = (counts: StatusCounts): boolean => {
  return counts.critical > 0;
};

/**
 * Assess resource status for a project based on headcount vs duration
 */
export const getProjectResourceStatus = (project: DepartmentalProject): { status: ResourceStatus; message: string } => {
  const headcountCount = project.teams?.length
    ? project.teams.reduce((sum, t) => sum + (t.members?.length || 0), 0)
    : (project.headcount?.length || 0);
  const hasTimeframe = project.startDate && project.endDate;

  let durationMonths = 3;
  if (hasTimeframe) {
    const start = new Date(project.startDate!);
    const end = new Date(project.endDate!);
    durationMonths = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  }

  if (headcountCount === 0) {
    return { status: 'critical', message: 'No team assigned' };
  }
  if (durationMonths > 3 && headcountCount < 2) {
    return { status: 'under', message: `Only ${headcountCount} member for ${durationMonths}+ month project` };
  }
  if (durationMonths > 6 && headcountCount < 3) {
    return { status: 'under', message: `Only ${headcountCount} members for ${durationMonths}+ month project` };
  }
  if (durationMonths <= 2 && headcountCount > 5) {
    return { status: 'over', message: `${headcountCount} members for short ${durationMonths} month project` };
  }
  if (durationMonths <= 1 && headcountCount > 3) {
    return { status: 'over', message: `${headcountCount} members for ${durationMonths} month sprint` };
  }
  if (!hasTimeframe && headcountCount > 0) {
    return { status: 'under', message: 'No timeframe defined' };
  }
  return { status: 'ok', message: '' };
};
