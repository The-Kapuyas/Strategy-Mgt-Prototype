/**
 * Assessment Service
 *
 * Analyzes strategy plans to identify concerns around feasibility and effectiveness.
 * Currently implements resource over-allocation detection.
 */

import { Objective, Personnel, Dependency, DepartmentalProject } from '../types';
import {
  AssessmentResult,
  AssessmentAlert,
  AssessmentSummary,
  AssessmentCategory,
  SuggestedAction,
  PersonAllocationData,
  MonthlyAllocation,
} from '../types/assessment';
import { parseAllocation } from '../utils/fteCalculations';
import { forEachProject, getAllProjectMembers } from '../utils/strategyHelpers';
import { analyzeObjectiveCoverage, ObjectiveCoverageResult } from './openaiService';

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all months between two dates (inclusive)
 */
function getMonthsBetween(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize to first of month
  start.setDate(1);
  end.setDate(1);

  const current = new Date(start);
  while (current <= end) {
    months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/**
 * Format month string for display
 */
function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
}

/**
 * Build allocation data for all people across all projects
 */
export function buildPersonAllocationData(objectives: Objective[]): Map<string, PersonAllocationData> {
  const personAllocations = new Map<string, Map<string, MonthlyAllocation>>();

  // Walk through all projects and their headcount (including DKR-nested projects and team members)
  forEachProject(objectives, (proj) => {
    if (!proj.startDate || !proj.endDate) return;

    const months = getMonthsBetween(proj.startDate, proj.endDate);
    const members = getAllProjectMembers(proj);

    members.forEach(hc => {
      if (!hc.name) return;

      const allocation = parseAllocation(hc.allocation);

      months.forEach(month => {
        if (!personAllocations.has(hc.name)) {
          personAllocations.set(hc.name, new Map());
        }
        const personMonths = personAllocations.get(hc.name)!;

        if (!personMonths.has(month)) {
          personMonths.set(month, { month, total: 0, projects: [] });
        }
        const monthData = personMonths.get(month)!;
        monthData.total += allocation;
        monthData.projects.push({
          id: proj.id,
          title: proj.title,
          allocation,
        });
      });
    });
  });

  // Convert to PersonAllocationData
  const result = new Map<string, PersonAllocationData>();

  personAllocations.forEach((months, personName) => {
    const monthlyAllocations = Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
    const maxAllocation = Math.max(...monthlyAllocations.map(m => m.total), 0);
    const overallocatedMonths = monthlyAllocations.filter(m => m.total > 1.0);

    result.set(personName, {
      personName,
      monthlyAllocations,
      maxAllocation,
      overallocatedMonths,
    });
  });

  return result;
}

/**
 * Find available people with similar roles for reassignment suggestions
 */
function findAvailablePeopleForReassignment(
  personName: string,
  projectId: string,
  overallocatedMonths: MonthlyAllocation[],
  allPersonData: Map<string, PersonAllocationData>,
  personnel: Personnel[]
): { name: string; availableCapacity: number }[] {
  const monthsToCheck = new Set(overallocatedMonths.map(m => m.month));
  const candidates: { name: string; availableCapacity: number }[] = [];

  // Check each person in personnel list
  personnel.forEach(person => {
    if (person.name === personName) return; // Skip the over-allocated person

    const personData = allPersonData.get(person.name);
    let minAvailableCapacity = 1.0; // Start with full availability

    monthsToCheck.forEach(month => {
      const monthData = personData?.monthlyAllocations.find(m => m.month === month);
      const currentAllocation = monthData?.total || 0;
      const available = 1.0 - currentAllocation;
      minAvailableCapacity = Math.min(minAvailableCapacity, available);
    });

    // Only suggest if they have at least 25% available capacity
    if (minAvailableCapacity >= 0.25) {
      candidates.push({
        name: person.name,
        availableCapacity: minAvailableCapacity,
      });
    }
  });

  // Sort by available capacity (highest first)
  return candidates.sort((a, b) => b.availableCapacity - a.availableCapacity).slice(0, 3);
}

/**
 * Generate rationale for over-allocation alert
 */
function generateOverallocationRationale(
  personName: string,
  overallocatedMonths: MonthlyAllocation[]
): string {
  const lines: string[] = [];

  lines.push(`${personName} is assigned to multiple projects with overlapping timelines:\n`);

  // Group by month and show project contributions
  overallocatedMonths.slice(0, 3).forEach(month => {
    const projectList = month.projects
      .map(p => `${p.title} (${Math.round(p.allocation * 100)}%)`)
      .join(', ');
    lines.push(`• ${formatMonth(month.month)}: ${Math.round(month.total * 100)}% total from ${projectList}`);
  });

  if (overallocatedMonths.length > 3) {
    lines.push(`• ...and ${overallocatedMonths.length - 3} more months with over-allocation`);
  }

  return lines.join('\n');
}

/**
 * Generate suggested actions for over-allocation
 */
function generateOverallocationActions(
  personName: string,
  overallocatedMonths: MonthlyAllocation[],
  allPersonData: Map<string, PersonAllocationData>,
  personnel: Personnel[]
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  // Get the projects involved in over-allocation
  const projectsInvolved = new Map<string, { id: string; title: string; totalContribution: number }>();
  overallocatedMonths.forEach(month => {
    month.projects.forEach(p => {
      if (!projectsInvolved.has(p.id)) {
        projectsInvolved.set(p.id, { id: p.id, title: p.title, totalContribution: 0 });
      }
      projectsInvolved.get(p.id)!.totalContribution += p.allocation;
    });
  });

  // Sort by contribution (suggest removing from project with least contribution first)
  const sortedProjects = Array.from(projectsInvolved.values())
    .sort((a, b) => a.totalContribution - b.totalContribution);

  // Action 1: Remove from the project with least contribution
  if (sortedProjects.length > 1) {
    const leastProject = sortedProjects[0];
    actions.push({
      id: `remove-${personName}-${leastProject.id}`,
      label: `Remove ${personName} from "${leastProject.title}"`,
      description: `This would reduce their workload by removing them from the project where they contribute least.`,
      type: 'remove',
      payload: {
        projectId: leastProject.id,
        projectTitle: leastProject.title,
        personName,
      },
    });
  }

  // Action 2-4: Reassign to available people
  const suggestedPeople: string[] = [personName]; // Start with the over-allocated person

  sortedProjects.slice(0, 2).forEach(project => {
    const candidates = findAvailablePeopleForReassignment(
      personName,
      project.id,
      overallocatedMonths,
      allPersonData,
      personnel
    );

    candidates.slice(0, 1).forEach(candidate => {
      suggestedPeople.push(candidate.name); // Track suggested alternatives
      actions.push({
        id: `reassign-${personName}-${project.id}-${candidate.name}`,
        label: `Reassign to ${candidate.name} on "${project.title}"`,
        description: `${candidate.name} has ${Math.round(candidate.availableCapacity * 100)}% available capacity during the overlap period.`,
        type: 'reassign',
        payload: {
          projectId: project.id,
          projectTitle: project.title,
          fromPersonName: personName,
          toPersonName: candidate.name,
        },
      });
    });
  });

  // Navigation action: View in Capacity
  actions.push({
    id: `view-capacity-${personName}`,
    label: 'View in Capacity',
    description: `See ${personName}'s full workload${suggestedPeople.length > 1 ? ' and suggested alternatives' : ''} in the Capacity view.`,
    type: 'view_capacity',
    payload: {
      filterPersonNames: [...new Set(suggestedPeople)], // Deduplicate
    },
  });

  return actions;
}

/**
 * Detect resource over-allocation across projects
 */
function detectResourceOverallocation(
  objectives: Objective[],
  personnel: Personnel[]
): AssessmentAlert[] {
  const alerts: AssessmentAlert[] = [];
  const allPersonData = buildPersonAllocationData(objectives);

  allPersonData.forEach((data, personName) => {
    if (data.overallocatedMonths.length === 0) return;

    const severity = data.maxAllocation > 1.5 ? 'critical' : 'warning';
    const monthCount = data.overallocatedMonths.length;

    // Get unique projects involved
    const projectsInvolved = new Map<string, string>();
    data.overallocatedMonths.forEach(month => {
      month.projects.forEach(p => projectsInvolved.set(p.id, p.title));
    });

    alerts.push({
      id: `overalloc-${personName.replace(/\s+/g, '-').toLowerCase()}`,
      category: 'resource',
      severity,
      title: `${personName} is over-allocated`,
      description: `Reaches ${Math.round(data.maxAllocation * 100)}% allocation for ${monthCount} month${monthCount > 1 ? 's' : ''}`,
      rationale: generateOverallocationRationale(personName, data.overallocatedMonths),
      affectedElements: [
        { type: 'person', id: personName, name: personName },
        ...Array.from(projectsInvolved.entries()).map(([id, title]) => ({
          type: 'project' as const,
          id,
          name: title,
        })),
      ],
      suggestedActions: generateOverallocationActions(
        personName,
        data.overallocatedMonths,
        allPersonData,
        personnel
      ),
      status: 'active',
    });
  });

  // Sort by severity (critical first) then by max allocation
  return alerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return 0;
  });
}

/**
 * Detect projects without assigned resources
 */
function detectUnstaffedProjects(objectives: Objective[]): AssessmentAlert[] {
  const alerts: AssessmentAlert[] = [];

  objectives.forEach((obj, objIdx) => {
    obj.keyResults.forEach((kr, krIdx) => {
      // Check both direct projects and DKR-nested projects
      const allProjects = [
        ...(kr.departmentalProjects || []),
        ...(kr.departmentalKeyResults || []).flatMap(dkr => dkr.departmentalProjects || []),
      ];
      allProjects.forEach(proj => {
        const members = getAllProjectMembers(proj);
        if (members.length === 0) {
          alerts.push({
            id: `unstaffed-${proj.id}`,
            category: 'resource',
            severity: 'warning',
            title: `"${proj.title}" has no assigned resources`,
            description: `This project in O${objIdx + 1}/KR${krIdx + 1} has no team members assigned.`,
            rationale: `Projects without assigned resources cannot make progress. Consider assigning team members or marking this as a future initiative.`,
            affectedElements: [
              { type: 'project', id: proj.id, name: proj.title },
              { type: 'keyResult', id: kr.id, name: kr.title },
            ],
            suggestedActions: [
              {
                id: `add-resource-${proj.id}`,
                label: 'Add team member',
                description: 'Assign someone to lead or work on this project.',
                type: 'add_resource',
                payload: {
                  role: 'Project Lead',
                },
              },
            ],
            status: 'active',
          });
        }
      });
    });
  });

  return alerts;
}

/**
 * Detect KRs without any linked projects
 */
function detectOrphanedKRs(objectives: Objective[]): AssessmentAlert[] {
  const alerts: AssessmentAlert[] = [];

  objectives.forEach((obj, objIdx) => {
    obj.keyResults.forEach((kr, krIdx) => {
      const hasProjects = (kr.departmentalProjects && kr.departmentalProjects.length > 0) ||
        (kr.departmentalKeyResults && kr.departmentalKeyResults.some(dkr => dkr.departmentalProjects && dkr.departmentalProjects.length > 0));
      if (!hasProjects) {
        alerts.push({
          id: `orphaned-kr-${kr.id}`,
          category: 'alignment',
          severity: 'info',
          title: `KR "${kr.title}" has no linked projects`,
          description: `O${objIdx + 1}/KR${krIdx + 1} doesn't have any projects driving it.`,
          rationale: `Key Results need projects (initiatives) to achieve them. Without concrete work planned, this KR may not be met.`,
          affectedElements: [
            { type: 'keyResult', id: kr.id, name: kr.title },
            { type: 'objective', id: obj.id, name: obj.title },
          ],
          suggestedActions: [],
          status: 'active',
        });
      }
    });
  });

  return alerts;
}

// ============================================
// Insufficient Project Coverage Detection
// ============================================

function detectInsufficientProjectCoverage(objectives: Objective[]): AssessmentAlert[] {
  const alerts: AssessmentAlert[] = [];

  objectives.forEach((obj, objIdx) => {
    obj.keyResults.forEach((kr, krIdx) => {
      const projects = kr.departmentalProjects || [];
      // Skip KRs with 0 projects (caught by detectOrphanedKRs) or 3+ projects
      if (projects.length === 0 || projects.length >= 3) return;

      // Check if KR target suggests high complexity requiring broad coverage
      const metric = kr.targetMetric?.toLowerCase() || '';
      if (!metric.includes('99.')) return; // high-precision targets (e.g. 99.95% uptime)

      const existingProjectNames = projects.map(p => p.title).join(', ');

      alerts.push({
        id: `insufficient-proj-coverage-${kr.id}`,
        category: 'alignment',
        severity: 'info',
        title: `KR "${kr.title}" may have insufficient project coverage`,
        description: `Only ${projects.length} project${projects.length === 1 ? '' : 's'} (${existingProjectNames}) driving O${objIdx + 1}/KR${krIdx + 1}. Consider additional initiatives for monitoring, testing, or operational readiness.`,
        rationale: `Ambitious KRs typically require multiple workstreams. With only ${projects.length} project${projects.length === 1 ? '' : 's'}, there may be gaps in execution coverage.`,
        affectedElements: [
          { type: 'keyResult', id: kr.id, name: kr.title },
          { type: 'objective', id: obj.id, name: obj.title },
        ],
        suggestedActions: [
          {
            id: `add-monitoring-proj-${kr.id}`,
            label: 'Add monitoring & observability project',
            description: 'Create a project for real-time monitoring, alerting, and dashboards to detect issues before they impact uptime.',
            type: 'add_project',
            payload: {
              targetKrId: kr.id,
              newProjectTitle: 'Monitoring & Observability Platform',
              newProjectDescription: 'Real-time monitoring, alerting dashboards, and observability infrastructure to detect and prevent uptime issues.',
              newProjectDepartment: 'Engineering',
              newProjectStartDate: '2026-03-01',
              newProjectEndDate: '2026-09-30',
            },
          },
          {
            id: `add-testing-proj-${kr.id}`,
            label: 'Add load testing & chaos engineering project',
            description: 'Proactively test system resilience with load tests and failure injection to validate uptime targets.',
            type: 'add_project',
            payload: {
              targetKrId: kr.id,
              newProjectTitle: 'Load Testing & Chaos Engineering',
              newProjectDescription: 'Proactive resilience testing with load tests, failure injection, and chaos experiments to validate uptime targets.',
              newProjectDepartment: 'Engineering',
              newProjectStartDate: '2026-04-01',
              newProjectEndDate: '2026-10-31',
            },
          },
        ],
        status: 'active',
      });
    });
  });

  return alerts;
}

// ============================================
// Timeline Conflict Detection
// ============================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Format date for display (e.g., "Mar 2025")
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Detect KRs where target date is before the end of linked projects
 */
function detectTimelineConflicts(objectives: Objective[]): AssessmentAlert[] {
  const alerts: AssessmentAlert[] = [];

  objectives.forEach((obj, objIdx) => {
    obj.keyResults.forEach((kr, krIdx) => {
      if (!kr.targetDate) return; // Skip KRs without target dates

      const krTargetDate = new Date(kr.targetDate);
      const projects = kr.departmentalProjects || [];

      // Find the latest project end date
      let latestProjectEndDate: Date | null = null;
      let latestProject: DepartmentalProject | null = null;

      projects.forEach(proj => {
        if (proj.endDate) {
          const endDate = new Date(proj.endDate);
          if (!latestProjectEndDate || endDate > latestProjectEndDate) {
            latestProjectEndDate = endDate;
            latestProject = proj;
          }
        }
      });

      // Check if KR target date is before latest project end
      if (latestProjectEndDate && latestProject && krTargetDate < latestProjectEndDate) {
        const daysDiff = Math.ceil((latestProjectEndDate.getTime() - krTargetDate.getTime()) / MS_PER_DAY);

        // Generate suggested new KR date (2 weeks after project ends)
        const suggestedKRDate = new Date(latestProjectEndDate);
        suggestedKRDate.setDate(suggestedKRDate.getDate() + 14);

        // Generate suggested earlier project dates
        const actions: SuggestedAction[] = [];

        // Action 1: Push KR target date
        actions.push({
          id: `push-kr-date-${kr.id}`,
          label: `Extend KR target to ${suggestedKRDate.toISOString().split('T')[0]}`,
          description: `Push the KR deadline by ${daysDiff + 14} days to allow "${latestProject.title}" to complete.`,
          type: 'adjust_timeline',
          payload: {
            krId: kr.id,
            krTitle: kr.title,
            currentTargetDate: kr.targetDate,
            suggestedTargetDate: suggestedKRDate.toISOString().split('T')[0],
          },
        });

        // Action 2: Start project sooner (if it has a start date)
        if (latestProject.startDate) {
          const projectStart = new Date(latestProject.startDate);
          const projectDuration = (latestProjectEndDate.getTime() - projectStart.getTime()) / MS_PER_DAY;

          const newStartDate = new Date(projectStart);
          newStartDate.setDate(newStartDate.getDate() - daysDiff - 7);
          const newEndDate = new Date(newStartDate);
          newEndDate.setDate(newEndDate.getDate() + projectDuration);

          actions.push({
            id: `shift-project-${latestProject.id}`,
            label: `Start "${latestProject.title}" earlier`,
            description: `Shift project to ${formatDate(newStartDate.toISOString())} - ${formatDate(newEndDate.toISOString())}`,
            type: 'adjust_timeline',
            payload: {
              projectId: latestProject.id,
              projectTitle: latestProject.title,
              newStartDate: newStartDate.toISOString().split('T')[0],
              newEndDate: newEndDate.toISOString().split('T')[0],
            },
          });
        }

        // Navigation action: View in Timeline
        actions.push({
          id: `view-timeline-${kr.id}`,
          label: 'View in Timeline',
          description: `See the KR deadline and project schedules in the Timeline view.`,
          type: 'view_timeline',
          payload: {
            filterKrId: kr.id,
            filterProjectIds: projects.map(p => p.id),
            highlightDeadline: kr.targetDate,
          },
        });

        alerts.push({
          id: `timeline-${kr.id}`,
          category: 'timeline',
          severity: daysDiff > 30 ? 'critical' : 'warning',
          title: `KR target date conflict: "${kr.title}"`,
          description: `Target date (${formatDate(kr.targetDate)}) is ${daysDiff} days before "${latestProject.title}" ends`,
          rationale: `The Key Result "O${objIdx + 1}/KR${krIdx + 1}: ${kr.title}" has a target date of ${formatDate(kr.targetDate)}, but the project "${latestProject.title}" is scheduled to end on ${formatDate(latestProject.endDate!)}.\n\nThis means the KR target cannot be met because the work to achieve it won't be complete in time.`,
          affectedElements: [
            { type: 'keyResult', id: kr.id, name: kr.title },
            { type: 'project', id: latestProject.id, name: latestProject.title },
          ],
          suggestedActions: actions,
          status: 'active',
        });
      }
    });
  });

  return alerts;
}

// ============================================
// Dependency Timeline Conflict Detection
// ============================================

/**
 * Find a project by ID across all objectives/KRs
 */
function findProjectAcrossObjectives(objectives: Objective[], projectId: string): { project: DepartmentalProject; kr: { id: string; title: string }; obj: { id: string; title: string } } | null {
  for (const obj of objectives) {
    for (const kr of obj.keyResults) {
      const project = kr.departmentalProjects?.find(p => p.id === projectId);
      if (project) return { project, kr: { id: kr.id, title: kr.title }, obj: { id: obj.id, title: obj.title } };
    }
  }
  return null;
}

/**
 * Detect dependency timeline conflicts where a blocking project ends after
 * the project it blocks is supposed to complete.
 */
function detectDependencyTimelineConflicts(objectives: Objective[], dependencies: Dependency[]): AssessmentAlert[] {
  const alerts: AssessmentAlert[] = [];

  for (const dep of dependencies) {
    if (dep.dependencyType !== 'blocks') continue;
    if (dep.sourceType !== 'project' || dep.targetType !== 'project') continue;

    const blockerInfo = findProjectAcrossObjectives(objectives, dep.sourceId);
    const blockedInfo = findProjectAcrossObjectives(objectives, dep.targetId);

    if (!blockerInfo || !blockedInfo) continue;

    const blocker = blockerInfo.project;
    const blocked = blockedInfo.project;

    if (!blocker.endDate || !blocked.endDate) continue;

    const blockerEnd = new Date(blocker.endDate);
    const blockedEnd = new Date(blocked.endDate);
    const blockedStart = blocked.startDate ? new Date(blocked.startDate) : null;

    // Critical: blocker finishes after the blocked project's deadline
    // Warning: blocker finishes after the blocked project started (significant overlap)
    let severity: 'critical' | 'warning' | null = null;
    let daysDiff = 0;

    if (blockerEnd > blockedEnd) {
      severity = 'critical';
      daysDiff = Math.ceil((blockerEnd.getTime() - blockedEnd.getTime()) / MS_PER_DAY);
    } else if (blockedStart && blockerEnd > blockedStart) {
      // Overlap but blocker finishes before blocked ends — only warn if significant
      const overlapDays = Math.ceil((blockerEnd.getTime() - blockedStart.getTime()) / MS_PER_DAY);
      const blockedDuration = blocked.endDate && blocked.startDate
        ? Math.ceil((blockedEnd.getTime() - blockedStart.getTime()) / MS_PER_DAY)
        : 0;
      // Warn if overlap is more than 50% of blocked project duration
      if (blockedDuration > 0 && overlapDays / blockedDuration > 0.5) {
        severity = 'warning';
        daysDiff = overlapDays;
      }
    }

    if (!severity) continue;

    const actions: SuggestedAction[] = [];

    // Action 1: Shift blocker earlier
    if (blocker.startDate && severity === 'critical') {
      const blockerStart = new Date(blocker.startDate);
      const duration = blockerEnd.getTime() - blockerStart.getTime();
      const newEnd = new Date(blockedEnd.getTime() - 14 * MS_PER_DAY); // finish 2 weeks before blocked ends
      const newStart = new Date(newEnd.getTime() - duration);

      actions.push({
        id: `shift-blocker-${dep.id}`,
        label: `Move "${blocker.title}" earlier`,
        description: `Shift to ${formatDate(newStart.toISOString())} – ${formatDate(newEnd.toISOString())} so it completes before "${blocked.title}" deadline.`,
        type: 'adjust_timeline',
        payload: {
          projectId: blocker.id,
          projectTitle: blocker.title,
          newStartDate: newStart.toISOString().split('T')[0],
          newEndDate: newEnd.toISOString().split('T')[0],
        },
      });
    }

    // Action 2: Extend blocked project deadline
    if (severity === 'critical') {
      const suggestedEnd = new Date(blockerEnd.getTime() + 14 * MS_PER_DAY);
      actions.push({
        id: `extend-blocked-${dep.id}`,
        label: `Extend "${blocked.title}" deadline`,
        description: `Push end date to ${formatDate(suggestedEnd.toISOString())} to account for blocker completion.`,
        type: 'adjust_timeline',
        payload: {
          projectId: blocked.id,
          projectTitle: blocked.title,
          newEndDate: suggestedEnd.toISOString().split('T')[0],
        },
      });
    }

    // Action 3: View in Timeline
    actions.push({
      id: `view-timeline-dep-${dep.id}`,
      label: 'View in Timeline',
      description: `See both projects and their dependency in the Timeline view.`,
      type: 'view_timeline',
      payload: {
        filterProjectIds: [blocker.id, blocked.id],
      },
    });

    alerts.push({
      id: `dep-timeline-${dep.id}`,
      category: 'timeline',
      severity,
      title: `Dependency timeline conflict: "${blocker.title}" blocks "${blocked.title}"`,
      description: severity === 'critical'
        ? `"${blocker.title}" (ends ${formatDate(blocker.endDate)}) finishes ${daysDiff} days after "${blocked.title}" (ends ${formatDate(blocked.endDate)}).`
        : `"${blocker.title}" overlaps ${daysDiff} days with "${blocked.title}", creating a scheduling risk.`,
      rationale: `The project "${blocker.title}" is marked as blocking "${blocked.title}", but the blocker is scheduled to finish ${severity === 'critical' ? 'after' : 'during'} the blocked project's timeline.\n\n${severity === 'critical' ? `"${blocked.title}" cannot complete on time because it depends on deliverables from "${blocker.title}" which won't be ready until ${formatDate(blocker.endDate)}.` : `Significant timeline overlap means "${blocked.title}" may face delays waiting for "${blocker.title}" deliverables.`}`,
      affectedElements: [
        { type: 'project', id: blocker.id, name: blocker.title },
        { type: 'project', id: blocked.id, name: blocked.title },
      ],
      suggestedActions: actions,
      status: 'active',
    });
  }

  return alerts;
}

// ============================================
// Staffing Gap Detection (Rules-Based)
// ============================================

/**
 * Skill-to-role mapping for description analysis
 */
const SKILL_ROLE_MAPPING: Record<string, { keywords: string[]; roles: string[] }> = {
  frontend: {
    keywords: ['dashboard', 'ui', 'interface', 'frontend', 'react', 'web app', 'portal', 'user experience', 'ux', 'component', 'widget'],
    roles: ['Frontend Engineer', 'UI Developer', 'React Developer', 'FE Engineer'],
  },
  backend: {
    keywords: ['api', 'backend', 'server', 'database', 'microservice', 'integration', 'data pipeline', 'endpoint', 'service'],
    roles: ['Backend Engineer', 'API Developer', 'Platform Engineer', 'BE Engineer'],
  },
  qa: {
    keywords: ['testing', 'quality', 'qa', 'test automation', 'regression', 'validation'],
    roles: ['QA Engineer', 'Test Engineer', 'SDET', 'Quality Engineer'],
  },
  devops: {
    keywords: ['deployment', 'infrastructure', 'ci/cd', 'kubernetes', 'cloud', 'aws', 'monitoring', 'devops'],
    roles: ['DevOps Engineer', 'SRE', 'Platform Engineer', 'Infrastructure Engineer'],
  },
  pmm: {
    keywords: ['launch', 'go-to-market', 'gtm', 'marketing', 'announcement', 'release', 'campaign', 'messaging'],
    roles: ['Product Marketing Manager', 'PMM', 'Marketing Lead', 'GTM Lead'],
  },
  design: {
    keywords: ['design', 'mockup', 'wireframe', 'figma', 'prototype', 'visual', 'branding'],
    roles: ['Product Designer', 'UX Designer', 'UI Designer', 'Designer'],
  },
  data: {
    keywords: ['analytics', 'data science', 'ml', 'machine learning', 'metrics', 'reporting', 'insights', 'data analysis'],
    roles: ['Data Analyst', 'Data Scientist', 'Analytics Engineer', 'Data Engineer'],
  },
  mobile: {
    keywords: ['mobile', 'ios', 'android', 'app', 'native'],
    roles: ['Mobile Engineer', 'iOS Developer', 'Android Developer'],
  },
};

/**
 * Analyze project description/title to determine required skills
 */
function analyzeProjectRequirements(project: DepartmentalProject): {
  detectedSkills: string[];
  suggestedRoles: string[];
  isLaunchProject: boolean;
} {
  const text = ((project.description || '') + ' ' + project.title).toLowerCase();
  const detectedSkills: Set<string> = new Set();
  const suggestedRoles: Set<string> = new Set();

  Object.entries(SKILL_ROLE_MAPPING).forEach(([skill, config]) => {
    const matchesKeyword = config.keywords.some(kw => text.includes(kw));
    if (matchesKeyword) {
      detectedSkills.add(skill);
      config.roles.forEach(role => suggestedRoles.add(role));
    }
  });

  const isLaunchProject = SKILL_ROLE_MAPPING.pmm.keywords.some(kw => text.includes(kw));

  return {
    detectedSkills: Array.from(detectedSkills),
    suggestedRoles: Array.from(suggestedRoles),
    isLaunchProject,
  };
}

/**
 * Check if current headcount has required skills
 */
function checkHeadcountSkillCoverage(
  headcount: { name: string; role: string; personnelId?: string }[],
  personnel: Personnel[],
  requiredSkills: string[]
): { covered: string[]; missing: string[] } {
  const coveredSkills: Set<string> = new Set();

  headcount.forEach(hc => {
    const person = personnel.find(p => p.id === hc.personnelId || p.name === hc.name);
    const personSkillsLower = (person?.skills || []).map(s => s.toLowerCase());
    const roleLower = hc.role.toLowerCase();

    requiredSkills.forEach(reqSkill => {
      // Check person's skills array
      const skillMatches = personSkillsLower.some(s => s.includes(reqSkill));
      // Check if their role matches required roles
      const roleMatches = SKILL_ROLE_MAPPING[reqSkill]?.roles.some(
        r => roleLower.includes(r.toLowerCase())
      );
      if (skillMatches || roleMatches) {
        coveredSkills.add(reqSkill);
      }
    });
  });

  return {
    covered: Array.from(coveredSkills),
    missing: requiredSkills.filter(s => !coveredSkills.has(s)),
  };
}

interface PersonnelSuggestion {
  person: Personnel;
  availableCapacity: number;
  matchingSkills: string[];
}

/**
 * Find available personnel with skills matching the requirements
 */
function findAvailablePersonnelWithSkills(
  requiredSkills: string[],
  project: DepartmentalProject,
  allPersonData: Map<string, PersonAllocationData>,
  personnel: Personnel[]
): PersonnelSuggestion[] {
  const suggestions: PersonnelSuggestion[] = [];

  if (!project.startDate || !project.endDate) return suggestions;

  const projectMonths = getMonthsBetween(project.startDate, project.endDate);

  personnel.forEach(person => {
    // Check if person has any matching skills
    const matchingSkills = requiredSkills.filter(reqSkill => {
      const personSkillsLower = (person.skills || []).map(s => s.toLowerCase());
      const roleLower = person.role.toLowerCase();

      return personSkillsLower.some(s => s.includes(reqSkill)) ||
        SKILL_ROLE_MAPPING[reqSkill]?.roles.some(r =>
          roleLower.includes(r.toLowerCase()) || personSkillsLower.some(s => s.includes(r.toLowerCase()))
        );
    });

    if (matchingSkills.length === 0) return;

    // Check availability during project months
    const personData = allPersonData.get(person.name);
    let minAvailableCapacity = 1.0;

    projectMonths.forEach(month => {
      const monthData = personData?.monthlyAllocations.find(m => m.month === month);
      const currentAllocation = monthData?.total || 0;
      const available = 1.0 - currentAllocation;
      minAvailableCapacity = Math.min(minAvailableCapacity, available);
    });

    // Only suggest if they have at least 25% capacity
    if (minAvailableCapacity >= 0.25) {
      suggestions.push({
        person,
        availableCapacity: minAvailableCapacity,
        matchingSkills,
      });
    }
  });

  // Sort by available capacity (highest first)
  return suggestions.sort((a, b) => b.availableCapacity - a.availableCapacity).slice(0, 3);
}

/**
 * Calculate project duration in months
 */
function calculateDurationMonths(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(1, months);
}

/**
 * Generate staffing actions with specific person suggestions
 */
function generateStaffingActions(
  project: DepartmentalProject,
  missingSkills: string[],
  suggestions: PersonnelSuggestion[]
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  // Add actions for each suggestion
  suggestions.forEach(suggestion => {
    const duration = project.startDate && project.endDate
      ? `${calculateDurationMonths(project.startDate, project.endDate)} months`
      : 'project duration';

    actions.push({
      id: `add-${suggestion.person.id}-to-${project.id}`,
      label: `Add ${suggestion.person.name} to "${project.title}"`,
      description: `${suggestion.person.role} with ${Math.round(suggestion.availableCapacity * 100)}% capacity for ${duration}`,
      type: 'add_resource',
      payload: {
        projectId: project.id,
        projectTitle: project.title,
        role: suggestion.person.role,
        skills: suggestion.matchingSkills,
        suggestedPersonName: suggestion.person.name,
        suggestedPersonId: suggestion.person.id,
        suggestedAllocation: suggestion.availableCapacity >= 0.75 ? 'Full-time' : `${Math.round(suggestion.availableCapacity * 100)}%`,
        availableCapacity: suggestion.availableCapacity,
      },
    });
  });

  // Add generic "find" action if no suggestions
  if (suggestions.length === 0) {
    missingSkills.forEach(skill => {
      const roles = SKILL_ROLE_MAPPING[skill]?.roles || [skill];
      actions.push({
        id: `find-${skill}-for-${project.id}`,
        label: `Find ${roles[0]} for "${project.title}"`,
        description: `No available team members with ${skill} expertise found`,
        type: 'add_resource',
        payload: {
          projectId: project.id,
          projectTitle: project.title,
          role: roles[0],
          skills: [skill],
        },
      });
    });
  }

  return actions;
}

/**
 * Detect staffing gaps based on project description analysis
 */
function detectStaffingGaps(
  objectives: Objective[],
  personnel: Personnel[],
  allPersonData: Map<string, PersonAllocationData>
): AssessmentAlert[] {
  const alerts: AssessmentAlert[] = [];
  // Track which projects we've already processed to avoid duplicates
  // (same project can be linked to multiple KRs)
  const processedProjects = new Set<string>();

  objectives.forEach((obj, objIdx) => {
    obj.keyResults.forEach((kr, krIdx) => {
      (kr.departmentalProjects || []).forEach(proj => {
        // Skip if we've already processed this project
        if (processedProjects.has(proj.id)) return;
        processedProjects.add(proj.id);

        const requirements = analyzeProjectRequirements(proj);

        if (requirements.detectedSkills.length === 0) return;

        const headcount = proj.headcount || [];
        const coverage = checkHeadcountSkillCoverage(headcount, personnel, requirements.detectedSkills);

        if (coverage.missing.length > 0) {
          // Find available personnel with matching skills
          const suggestions = findAvailablePersonnelWithSkills(
            coverage.missing,
            proj,
            allPersonData,
            personnel
          );

          const severity = coverage.missing.length > 1 || requirements.isLaunchProject ? 'critical' : 'warning';

          // Build rationale
          const rationaleLines: string[] = [];
          rationaleLines.push(`Project analysis for "${proj.title}":`);
          if (proj.description) {
            rationaleLines.push(`\nDescription: "${proj.description}"`);
          }
          rationaleLines.push(`\nDetected skill requirements: ${requirements.suggestedRoles.slice(0, 3).join(', ')}`);
          if (coverage.covered.length > 0) {
            rationaleLines.push(`\nCurrently covered: ${coverage.covered.join(', ')}`);
          }
          rationaleLines.push(`\nMissing expertise: ${coverage.missing.join(', ')}`);

          if (suggestions.length > 0) {
            rationaleLines.push(`\nAvailable team members with matching skills:`);
            suggestions.forEach(s => {
              rationaleLines.push(`• ${s.person.name} (${s.person.role}) - ${Math.round(s.availableCapacity * 100)}% available`);
            });
          }

          alerts.push({
            id: `staffing-${proj.id}`,
            category: 'resource',
            severity,
            title: `"${proj.title}" may need ${coverage.missing.join(', ')} expertise`,
            description: `Based on project scope, ${coverage.missing.length} skill area${coverage.missing.length > 1 ? 's' : ''} may be understaffed`,
            rationale: rationaleLines.join('\n'),
            affectedElements: [
              { type: 'project', id: proj.id, name: proj.title },
              { type: 'keyResult', id: kr.id, name: kr.title },
            ],
            suggestedActions: generateStaffingActions(proj, coverage.missing, suggestions),
            status: 'active',
          });
        }

        // Check for QA coverage on long/complex projects
        if (proj.endDate && proj.startDate) {
          const durationMonths = calculateDurationMonths(proj.startDate, proj.endDate);
          if (durationMonths >= 3 && !coverage.covered.includes('qa')) {
            const qaSuggestions = findAvailablePersonnelWithSkills(['qa'], proj, allPersonData, personnel);

            alerts.push({
              id: `qa-coverage-${proj.id}`,
              category: 'coverage',
              severity: 'warning',
              title: `"${proj.title}" lacks QA coverage`,
              description: `${durationMonths} month project without dedicated QA`,
              rationale: `Projects of this duration typically benefit from dedicated QA resources to ensure quality and prevent late-stage bugs.`,
              affectedElements: [
                { type: 'project', id: proj.id, name: proj.title },
              ],
              suggestedActions: generateStaffingActions(proj, ['qa'], qaSuggestions),
              status: 'active',
            });
          }
        }

        // Check for PMM on launch projects
        if (requirements.isLaunchProject && !coverage.covered.includes('pmm')) {
          const pmmSuggestions = findAvailablePersonnelWithSkills(['pmm'], proj, allPersonData, personnel);

          alerts.push({
            id: `pmm-coverage-${proj.id}`,
            category: 'coverage',
            severity: 'warning',
            title: `"${proj.title}" is a launch project without PMM`,
            description: `Go-to-market activities detected but no PMM assigned`,
            rationale: `This project appears to involve a launch or go-to-market activity. Product Marketing support is typically needed for successful launches.`,
            affectedElements: [
              { type: 'project', id: proj.id, name: proj.title },
            ],
            suggestedActions: generateStaffingActions(proj, ['pmm'], pmmSuggestions),
            status: 'active',
          });
        }
      });
    });
  });

  return alerts;
}

// ============================================
// Objective Coverage Analysis (LLM-powered)
// ============================================

/**
 * Convert LLM coverage analysis results to assessment alerts
 */
function convertCoverageToAlerts(
  coverageResults: ObjectiveCoverageResult[],
  objectives: Objective[]
): AssessmentAlert[] {
  return coverageResults.map((result, idx) => {
    // Find the objective index for display
    const objIndex = objectives.findIndex(o => o.id === result.objectiveId);
    const objLabel = objIndex >= 0 ? `O${objIndex + 1}` : 'Objective';

    // Generate suggested actions for each KR suggestion
    const suggestedActions: SuggestedAction[] = result.suggestedKRs.map((krSuggestion, i) => ({
      id: `add-kr-${result.objectiveId}-${i}`,
      label: `Add KR: ${krSuggestion.title.substring(0, 50)}${krSuggestion.title.length > 50 ? '...' : ''}`,
      description: krSuggestion.rationale,
      type: 'add_kr',
      payload: {
        objectiveId: result.objectiveId,
        suggestedKRTitle: krSuggestion.title,
        suggestedKRMetric: krSuggestion.metric,
        suggestedKRTarget: krSuggestion.target,
      },
    }));

    return {
      id: `coverage-${result.objectiveId}`,
      category: 'alignment' as AssessmentCategory,
      severity: result.coverageScore === 'insufficient' ? 'warning' : 'info',
      title: `${objLabel} may have insufficient KR coverage`,
      description: `${result.currentCoverage}. Missing: ${result.missingDimensions.join(', ')}`,
      rationale: result.rationale,
      affectedElements: [
        { type: 'objective' as const, id: result.objectiveId, name: result.objectiveTitle },
      ],
      suggestedActions,
      status: 'active' as const,
    };
  });
}

/**
 * Compute summary statistics from alerts
 */
function computeSummary(alerts: AssessmentAlert[]): AssessmentSummary {
  const summary: AssessmentSummary = {
    total: alerts.length,
    active: 0,
    dismissed: 0,
    resolved: 0,
    critical: 0,
    warning: 0,
    info: 0,
    byCategory: {
      resource: 0,
      timeline: 0,
      alignment: 0,
      coverage: 0,
      risk: 0,
    },
  };

  alerts.forEach(alert => {
    // Count by status
    summary[alert.status]++;

    // Count by severity
    summary[alert.severity]++;

    // Count by category
    summary.byCategory[alert.category]++;
  });

  return summary;
}

/**
 * Run a full assessment of the strategy plan
 */
export async function runAssessment(
  objectives: Objective[],
  personnel: Personnel[],
  dependencies: Dependency[]
): Promise<AssessmentResult> {
  const alerts: AssessmentAlert[] = [];

  // Build allocation data (needed by multiple detectors)
  const allPersonData = buildPersonAllocationData(objectives);

  // Run all rules-based assessment checks
  alerts.push(...detectResourceOverallocation(objectives, personnel));
  alerts.push(...detectUnstaffedProjects(objectives));
  alerts.push(...detectOrphanedKRs(objectives));
  alerts.push(...detectInsufficientProjectCoverage(objectives));
  alerts.push(...detectTimelineConflicts(objectives));
  alerts.push(...detectStaffingGaps(objectives, personnel, allPersonData));
  alerts.push(...detectDependencyTimelineConflicts(objectives, dependencies));

  // Run LLM-powered objective coverage analysis
  try {
    const coverageResults = await analyzeObjectiveCoverage(
      objectives.map(obj => ({
        id: obj.id,
        title: obj.title,
        keyResults: obj.keyResults.map(kr => ({
          title: kr.title,
          targetMetric: kr.targetMetric,
        })),
      }))
    );
    alerts.push(...convertCoverageToAlerts(coverageResults, objectives));
  } catch (error) {
    // Coverage analysis is optional - don't fail the whole assessment
    console.warn('Coverage analysis failed:', error);
  }

  return {
    id: generateId(),
    runAt: new Date().toISOString(),
    alerts,
    summary: computeSummary(alerts),
  };
}

/**
 * Apply a suggested action to resolve an alert
 * Returns the updated objectives (caller should update state)
 */
export function applyAction(
  action: SuggestedAction,
  objectives: Objective[]
): Objective[] {
  const updatedObjectives = JSON.parse(JSON.stringify(objectives)) as Objective[];

  if (action.type === 'remove' && action.payload.projectId && action.payload.personName) {
    // Remove person from project
    updatedObjectives.forEach(obj => {
      obj.keyResults.forEach(kr => {
        (kr.departmentalProjects || []).forEach(proj => {
          if (proj.id === action.payload.projectId) {
            proj.headcount = (proj.headcount || []).filter(
              hc => hc.name !== action.payload.personName
            );
          }
        });
      });
    });
  }

  if (action.type === 'reassign' && action.payload.projectId && action.payload.fromPersonName && action.payload.toPersonName) {
    // Replace person in project
    updatedObjectives.forEach(obj => {
      obj.keyResults.forEach(kr => {
        (kr.departmentalProjects || []).forEach(proj => {
          if (proj.id === action.payload.projectId) {
            proj.headcount = (proj.headcount || []).map(hc => {
              if (hc.name === action.payload.fromPersonName) {
                return {
                  ...hc,
                  id: `${proj.id}-${action.payload.toPersonName!.toLowerCase().replace(/\s+/g, '-')}`,
                  name: action.payload.toPersonName!,
                  personnelId: undefined, // Will be re-matched
                };
              }
              return hc;
            });
          }
        });
      });
    });
  }

  if (action.type === 'adjust_timeline') {
    // Handle KR target date adjustment
    if (action.payload.krId && action.payload.suggestedTargetDate) {
      updatedObjectives.forEach(obj => {
        obj.keyResults.forEach(kr => {
          if (kr.id === action.payload.krId) {
            kr.targetDate = action.payload.suggestedTargetDate;
          }
        });
      });
    }

    // Handle project timeline adjustment
    if (action.payload.projectId && (action.payload.newStartDate || action.payload.newEndDate)) {
      updatedObjectives.forEach(obj => {
        obj.keyResults.forEach(kr => {
          (kr.departmentalProjects || []).forEach(proj => {
            if (proj.id === action.payload.projectId) {
              if (action.payload.newStartDate) proj.startDate = action.payload.newStartDate;
              if (action.payload.newEndDate) proj.endDate = action.payload.newEndDate;
            }
          });
        });
      });
    }
  }

  if (action.type === 'add_resource') {
    // Add person to project headcount
    if (action.payload.projectId && action.payload.suggestedPersonName) {
      updatedObjectives.forEach(obj => {
        obj.keyResults.forEach(kr => {
          (kr.departmentalProjects || []).forEach(proj => {
            if (proj.id === action.payload.projectId) {
              if (!proj.headcount) proj.headcount = [];

              // Check if person already assigned
              const alreadyAssigned = proj.headcount.some(
                h => h.name === action.payload.suggestedPersonName
              );

              if (!alreadyAssigned) {
                proj.headcount.push({
                  id: `${proj.id}-${action.payload.suggestedPersonName!.toLowerCase().replace(/\s+/g, '-')}`,
                  personnelId: action.payload.suggestedPersonId,
                  name: action.payload.suggestedPersonName!,
                  role: action.payload.role || 'Team Member',
                  allocation: action.payload.suggestedAllocation || 'Full-time',
                });
              }
            }
          });
        });
      });
    }
  }

  if (action.type === 'add_kr') {
    // Add a new key result to an objective
    if (action.payload.objectiveId && action.payload.suggestedKRTitle) {
      updatedObjectives.forEach(obj => {
        if (obj.id === action.payload.objectiveId) {
          const newKRId = `kr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Build target metric from metric and target if provided
          let targetMetric = action.payload.suggestedKRTitle;
          if (action.payload.suggestedKRMetric && action.payload.suggestedKRTarget) {
            targetMetric = `${action.payload.suggestedKRMetric}: 0/${action.payload.suggestedKRTarget}`;
          }

          obj.keyResults.push({
            id: newKRId,
            title: action.payload.suggestedKRTitle!,
            targetMetric,
            progress: 0,
            departmentalProjects: [],
          });
        }
      });
    }
  }

  if (action.type === 'add_project') {
    if (action.payload.targetKrId && action.payload.newProjectTitle) {
      updatedObjectives.forEach(obj => {
        obj.keyResults.forEach(kr => {
          if (kr.id === action.payload.targetKrId) {
            if (!kr.departmentalProjects) kr.departmentalProjects = [];
            const newProjectId = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            kr.departmentalProjects.push({
              id: newProjectId,
              department: action.payload.newProjectDepartment || 'Engineering',
              title: action.payload.newProjectTitle!,
              description: action.payload.newProjectDescription,
              status: 'To Do',
              progress: 0,
              startDate: action.payload.newProjectStartDate,
              endDate: action.payload.newProjectEndDate,
              headcount: [],
            });
          }
        });
      });
    }
  }

  return updatedObjectives;
}
