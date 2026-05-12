/**
 * Chat Context Builder
 * Builds enriched strategy context for the LLM chat assistant
 */

import { Objective, Personnel, Dependency, DepartmentalProject } from '../types';
import { AssessmentResult } from '../types/assessment';
import { buildPersonAllocationData } from '../services/assessmentService';
import { calculateProjectFTEYears, calculateProjectCost, formatFTEYears, formatResourceCost, parseAllocation } from './fteCalculations';
import { getElementName, getAllProjectsWithContext, getAllProjectMembers } from './strategyHelpers';

function serializeProject(dp: DepartmentalProject) {
  const members = getAllProjectMembers(dp);
  return {
    id: dp.id,
    title: dp.title,
    department: dp.department,
    status: dp.status,
    progress: dp.progress,
    startDate: dp.startDate,
    endDate: dp.endDate,
    fteYears: formatFTEYears(calculateProjectFTEYears(dp)),
    estimatedCost: formatResourceCost(calculateProjectCost(dp)),
    teams: dp.teams?.map(t => ({
      name: t.name,
      department: t.department,
      members: t.members?.map(m => ({ name: m.name, role: m.role, allocation: m.allocation })),
    })),
    teamMembers: members.map(hc => ({
      name: hc.name,
      role: hc.role,
      allocation: hc.allocation,
    })),
  };
}

export function buildChatStrategyContext(
  companyName: string,
  objectives: Objective[],
  personnel: Personnel[],
  dependencies: Dependency[],
  assessmentResult: AssessmentResult | null
): string {
  // Base strategy data (existing structure)
  const baseContext = {
    company: companyName,
    objectives: objectives.map((o, i) => ({
      id: o.id,
      number: i + 1,
      title: o.title,
      timePeriod: o.timePeriod,
      keyResults: o.keyResults.map((kr, j) => ({
        id: kr.id,
        number: j + 1,
        title: kr.title,
        progress: kr.progress,
        targetMetric: kr.targetMetric,
        targetDate: kr.targetDate,
        departmentalKeyResults: kr.departmentalKeyResults?.map(dkr => ({
          id: dkr.id,
          title: dkr.title,
          department: dkr.department,
          progress: dkr.progress,
          projects: dkr.departmentalProjects?.map(dp => serializeProject(dp)),
        })),
        projects: kr.departmentalProjects?.map(dp => serializeProject(dp))
      }))
    })),
    personnel: personnel.map(p => ({
      name: p.name,
      role: p.role,
      department: p.department,
      skills: p.skills,
    })),
  };

  // Person → project assignments + allocation summary
  const allocationData = buildPersonAllocationData(objectives);
  const personnelAnalysis: Record<string, {
    projects: { title: string; allocation: string }[];
    peakAllocation: string;
    availableCapacity: string;
    overAllocated: boolean;
  }> = {};

  allocationData.forEach((data, personName) => {
    const projectMap = new Map<string, number>();
    // Aggregate allocation per project from monthly data
    data.monthlyAllocations.forEach(m => {
      m.projects.forEach(p => {
        projectMap.set(p.title, Math.max(projectMap.get(p.title) || 0, p.allocation));
      });
    });

    personnelAnalysis[personName] = {
      projects: Array.from(projectMap.entries()).map(([title, alloc]) => ({
        title,
        allocation: `${Math.round(alloc * 100)}%`,
      })),
      peakAllocation: `${Math.round(data.maxAllocation * 100)}%`,
      availableCapacity: `${Math.round(Math.max(0, 1 - data.maxAllocation) * 100)}%`,
      overAllocated: data.overallocatedMonths.length > 0,
    };
  });

  // Also include personnel not assigned to any project
  personnel.forEach(p => {
    if (!personnelAnalysis[p.name]) {
      personnelAnalysis[p.name] = {
        projects: [],
        peakAllocation: '0%',
        availableCapacity: '100%',
        overAllocated: false,
      };
    }
  });

  // Dependencies with resolved names
  const dependencyInfo = dependencies.map(d => ({
    sourceType: d.sourceType,
    source: getElementName(objectives, d.sourceType, d.sourceId) || d.sourceId,
    targetType: d.targetType,
    target: getElementName(objectives, d.targetType, d.targetId) || d.targetId,
    type: d.dependencyType,
    description: d.description,
  }));

  // Assessment alerts summary (if available)
  const alertsSummary = assessmentResult?.alerts
    ?.filter(a => a.status === 'active')
    ?.map(a => ({
      title: a.title,
      severity: a.severity,
      category: a.category,
      affected: a.affectedElements.map(e => e.name).join(', '),
    })) ?? [];

  // Available navigation links
  const viewLinks = [
    { view: 'assignments', label: 'Capacity View', format: 'app://view/assignments?person={PersonName}' },
    { view: 'timeline', label: 'Timeline View', format: 'app://view/timeline' },
    { view: 'allocation', label: 'Allocation View', format: 'app://view/allocation' },
    { view: 'assessment', label: 'Assessment View', format: 'app://view/assessment' },
    { view: 'explorer', label: 'Strategy Map', format: 'app://view/explorer' },
    { view: 'tree', label: 'Tree View', format: 'app://view/tree' },
    { view: 'department', label: 'Department View', format: 'app://view/department?dept={DeptName}' },
  ];

  return JSON.stringify({
    ...baseContext,
    personnelAnalysis,
    dependencies: dependencyInfo,
    activeAlerts: alertsSummary,
    navigationLinks: viewLinks,
  }, null, 2);
}
