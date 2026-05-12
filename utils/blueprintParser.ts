/**
 * Blueprint Parser Utility
 * 
 * Transforms imported strategy blueprints into the app's internal data structures.
 */

import { Objective, KeyResult, DepartmentalKeyResult, DepartmentalProject, Team, Personnel, ProjectAssignment, Dependency } from '../types';
import {
  StrategyBlueprint,
  BlueprintObjective,
  BlueprintKeyResult,
  BlueprintProject,
  BlueprintResource,
  BlueprintDependency,
  BlueprintDepartmentalKeyResult,
  BlueprintTeam,
  SimplifiedBlueprint,
  SimplifiedObjective,
  SimplifiedProject,
  SimplifiedTeamMember,
  SimplifiedDepartmentalKR,
  SimplifiedTeam,
} from '../types/strategyBlueprint';
import { CheckInBrief, CheckInItem, CheckInChange, LeaderUpdatesBrief, LeaderUpdate, LeaderItemUpdate, FrictionIndicator, DetailedAnalysis } from '../types/checkin';

/**
 * Get KR IDs from a project (handles both field names)
 */
function getProjectKRIds(project: BlueprintProject): string[] {
  return project.drives_krs || project.linked_key_results || [];
}

/**
 * Convert blueprint dependency type to app dependency type
 */
function mapDependencyType(type: string): 'blocks' | 'depends_on' | 'relates_to' {
  switch (type) {
    case 'blocks': return 'blocks';
    case 'enables': return 'depends_on';
    case 'informs': return 'relates_to';
    default: return 'relates_to';
  }
}

/**
 * Transform blueprint dependencies to app Dependency[]
 */
function transformDependencies(deps: BlueprintDependency[]): Dependency[] {
  return deps.map(dep => ({
    id: dep.id,
    sourceType: 'project' as const,
    sourceId: dep.from_project,
    targetType: 'project' as const,
    targetId: dep.to_project,
    dependencyType: mapDependencyType(dep.type),
    description: dep.description,
  }));
}

/**
 * Convert blueprint status to app status
 */
function mapProjectStatus(status: string): 'To Do' | 'Doing' | 'Done' {
  switch (status) {
    case 'completed':
      return 'Done';
    case 'in_progress':
    case 'at_risk':
    case 'behind':
      return 'Doing';
    default:
      return 'To Do';
  }
}

/**
 * Convert blueprint resource to Personnel
 */
function transformResource(resource: BlueprintResource): Personnel {
  // Convert availability (0-1) to human-readable format
  let availability: string;
  if (resource.availability >= 0.9) {
    availability = 'Full-time';
  } else if (resource.availability >= 0.5) {
    availability = `${Math.round(resource.availability * 100)}% available`;
  } else if (resource.availability >= 0.25) {
    availability = 'Part-time';
  } else {
    availability = 'Limited';
  }

  return {
    id: resource.id,
    name: resource.name,
    role: resource.role,
    department: resource.department,
    skills: resource.skills,
    availability,
  };
}

/**
 * Extract unique personnel from projects when resources array is missing
 */
function extractPersonnelFromProjects(projects: BlueprintProject[]): Personnel[] {
  const personnelMap = new Map<string, Personnel>();

  projects.forEach(project => {
    // Add project lead
    if (project.lead && !personnelMap.has(project.lead)) {
      personnelMap.set(project.lead, {
        id: `person-${project.lead.toLowerCase().replace(/\s+/g, '-')}`,
        name: project.lead,
        role: 'Project Lead',
        department: project.department,
        availability: 'Full-time',
      });
    }

    // Add team members
    if (project.team_members) {
      project.team_members.forEach(member => {
        if (!personnelMap.has(member)) {
          personnelMap.set(member, {
            id: `person-${member.toLowerCase().replace(/\s+/g, '-')}`,
            name: member,
            role: 'Team Member',
            department: project.department,
            availability: 'Full-time',
          });
        }
      });
    }
  });

  return Array.from(personnelMap.values());
}

/**
 * Create headcount assignments from blueprint project
 */
function createProjectHeadcount(
  project: BlueprintProject,
  resources: BlueprintResource[]
): ProjectAssignment[] {
  const headcount: ProjectAssignment[] = [];
  
  // Add project lead
  if (project.lead) {
    const leadResource = resources.find(r => r.name === project.lead);
    headcount.push({
      id: `${project.id}-lead`,
      personnelId: leadResource?.id,
      name: project.lead,
      role: leadResource?.role || 'Project Lead',
      allocation: leadResource ? `${Math.round(leadResource.availability * 100)}%` : 'Full-time',
    });
  }

  // Add team members
  if (project.team_members && project.team_members.length > 0) {
    project.team_members.forEach((member, idx) => {
      const memberResource = resources.find(r => r.name === member);
      headcount.push({
        id: `${project.id}-member-${idx}`,
        personnelId: memberResource?.id,
        name: member,
        role: memberResource?.role || 'Team Member',
        allocation: memberResource ? `${Math.round(memberResource.availability * 100)}%` : 'Full-time',
      });
    });
  }

  return headcount;
}

/**
 * Transform a blueprint project to DepartmentalProject
 */
function transformProject(
  project: BlueprintProject,
  resources: BlueprintResource[]
): DepartmentalProject {
  return {
    id: project.id,
    department: project.department,
    title: project.name,
    description: project.description,
    status: mapProjectStatus(project.status),
    progress: Math.round(project.progress * 100),
    startDate: project.start_date,
    endDate: project.end_date,
    headcount: createProjectHeadcount(project, resources),
    owner: project.lead,
  };
}

/**
 * Transform a blueprint departmental key result to DepartmentalKeyResult
 */
function transformDepartmentalKeyResult(
  dkr: BlueprintDepartmentalKeyResult,
  linkedProjects: DepartmentalProject[]
): DepartmentalKeyResult {
  return {
    id: dkr.id,
    title: dkr.description,
    description: dkr.detail,
    department: dkr.department,
    targetMetric: `${dkr.metric}: ${dkr.current}/${dkr.target}`,
    progress: Math.round(dkr.progress * 100),
    targetDate: dkr.target_date,
    status: dkr.status,
    owner: dkr.owner,
    metric: dkr.metric,
    baseline: dkr.baseline,
    current: dkr.current,
    target: dkr.target,
    departmentalProjects: linkedProjects,
  };
}

/**
 * Transform blueprint teams into Team[] for a project, resolving member IDs
 */
function transformTeams(
  bpTeams: BlueprintTeam[],
  resources: BlueprintResource[]
): Team[] {
  return bpTeams.map(t => ({
    id: t.id,
    name: t.name,
    department: t.department,
    members: t.member_ids.map((memberId, idx) => {
      const resource = resources.find(r => r.id === memberId || r.name === memberId);
      return {
        id: `${t.id}-member-${idx}`,
        personnelId: resource?.id || memberId,
        name: resource?.name || memberId,
        role: resource?.role || 'Team Member',
        allocation: resource ? `${Math.round(resource.availability * 100)}%` : 'Full-time',
      };
    }),
  }));
}

/**
 * Transform blueprint to app's Objective structure
 */
function transformObjective(
  bpObjective: BlueprintObjective,
  bpKeyResults: BlueprintKeyResult[],
  bpProjects: BlueprintProject[],
  bpResources: BlueprintResource[],
  bpDKRs: BlueprintDepartmentalKeyResult[],
  bpTeams: BlueprintTeam[]
): Objective {
  // Get key results for this objective
  const objectiveKRs = bpKeyResults.filter(kr => kr.objective_id === bpObjective.id);

  // Transform each key result
  const keyResults: KeyResult[] = objectiveKRs.map(kr => {
    // Get projects linked to this key result (handles both drives_krs and linked_key_results)
    const linkedProjects = bpProjects.filter(p => getProjectKRIds(p).includes(kr.id));

    // Transform projects, attaching teams if present
    const transformedProjects = linkedProjects.map(p => {
      const project = transformProject(p, bpResources);
      // Check for teams: inline on blueprint project or from flat top-level array
      const projectTeams = p.teams || bpTeams.filter(t => t.project_id === p.id);
      if (projectTeams.length > 0) {
        project.teams = transformTeams(projectTeams, bpResources);
      }
      return project;
    });

    // Check for departmental KRs: inline on blueprint KR or from flat top-level array
    const krDKRs = kr.departmental_key_results || bpDKRs.filter(d => d.company_kr_id === kr.id);

    if (krDKRs.length > 0) {
      // Projects claimed by DKRs go under those DKRs; unclaimed stay on direct
      const claimedProjectIds = new Set<string>();
      const departmentalKeyResults: DepartmentalKeyResult[] = krDKRs.map(dkr => {
        const dkrProjectIds = dkr.linked_projects || [];
        dkrProjectIds.forEach(pid => claimedProjectIds.add(pid));
        const dkrProjects = transformedProjects.filter(p => dkrProjectIds.includes(p.id));
        return transformDepartmentalKeyResult(dkr, dkrProjects);
      });

      const unclaimedProjects = transformedProjects.filter(p => !claimedProjectIds.has(p.id));

      return {
        id: kr.id,
        title: kr.description,
        description: kr.detail,
        targetMetric: `${kr.metric}: ${kr.current}/${kr.target}`,
        progress: Math.round(kr.progress * 100),
        targetDate: kr.target_date,
        status: kr.status,
        owner: kr.owner,
        metric: kr.metric,
        baseline: kr.baseline,
        current: kr.current,
        target: kr.target,
        departmentalProjects: unclaimedProjects.length > 0 ? unclaimedProjects : undefined,
        departmentalKeyResults,
      };
    }

    return {
      id: kr.id,
      title: kr.description,
      description: kr.detail,
      targetMetric: `${kr.metric}: ${kr.current}/${kr.target}`,
      progress: Math.round(kr.progress * 100),
      targetDate: kr.target_date,
      status: kr.status,
      owner: kr.owner,
      metric: kr.metric,
      baseline: kr.baseline,
      current: kr.current,
      target: kr.target,
      departmentalProjects: transformedProjects,
    };
  });

  return {
    id: bpObjective.id,
    title: bpObjective.objective,
    description: bpObjective.description,
    timePeriod: bpObjective.time_horizon,
    keyResults,
    owner: bpObjective.owner,
  };
}

export interface ParsedBlueprint {
  companyName: string;
  objectives: Objective[];
  personnel: Personnel[];
  dependencies: Dependency[];
  metadata: StrategyBlueprint['metadata'] | SimplifiedBlueprint['company'];
  checkInBrief?: CheckInBrief;
  leaderUpdates?: LeaderUpdatesBrief;
}

/**
 * Parse check-in brief data from blueprint JSON
 */
function parseCheckIn(data: Record<string, unknown>): CheckInBrief | undefined {
  const ci = data.check_in as Record<string, unknown> | undefined;
  if (!ci || !ci.items || !Array.isArray(ci.items)) return undefined;

  const items: CheckInItem[] = (ci.items as Record<string, unknown>[]).map(item => ({
    id: item.id as string,
    type: item.type as CheckInItem['type'],
    severity: item.severity as CheckInItem['severity'],
    title: item.title as string,
    proposedBy: item.proposed_by as string,
    summary: item.summary as string,
    rationale: item.rationale as string,
    changes: ((item.changes as Record<string, unknown>[]) || []).map(c => ({
      targetType: c.target_type as CheckInChange['targetType'],
      targetId: c.target_id as string,
      targetLabel: c.target_label as string,
      field: c.field as string,
      from: c.from as string,
      to: c.to as string,
    })),
    impact: item.impact as string,
    status: item.status as CheckInItem['status'],
  }));

  return {
    date: ci.date as string,
    period: ci.period as string,
    lastCheckIn: ci.last_check_in as string,
    items,
  };
}

/**
 * Parse leader updates data from blueprint JSON
 */
function parseLeaderUpdates(data: Record<string, unknown>): LeaderUpdatesBrief | undefined {
  const lu = data.leader_updates as Record<string, unknown> | undefined;
  if (!lu || !lu.leaders || !Array.isArray(lu.leaders)) return undefined;

  const leaders: LeaderUpdate[] = (lu.leaders as Record<string, unknown>[]).map(leader => {
    const items: LeaderItemUpdate[] = ((leader.items as Record<string, unknown>[]) || []).map(item => ({
      itemId: item.item_id as string,
      itemType: item.item_type as LeaderItemUpdate['itemType'],
      itemLabel: item.item_label as string,
      aiSuggestedStatus: item.ai_suggested_status as LeaderItemUpdate['aiSuggestedStatus'],
      aiRationale: item.ai_rationale as string,
      leaderStatus: item.leader_status as LeaderItemUpdate['leaderStatus'],
      leaderNarrative: item.leader_narrative as string | undefined,
      confirmed: item.confirmed as boolean,
      proposedChanges: item.proposed_changes
        ? (item.proposed_changes as Record<string, unknown>[]).map(c => ({
            targetType: c.target_type as CheckInChange['targetType'],
            targetId: c.target_id as string,
            targetLabel: c.target_label as string,
            field: c.field as string,
            from: c.from as string,
            to: c.to as string,
          }))
        : undefined,
      metricUpdate: item.metric_update
        ? {
            field: (item.metric_update as Record<string, unknown>).field as string,
            from: (item.metric_update as Record<string, unknown>).from as string | number,
            to: (item.metric_update as Record<string, unknown>).to as string | number,
          }
        : undefined,
      verboseAssessment: item.verbose_assessment as string | undefined,
      detailedAnalysis: item.detailed_analysis ? (() => {
        const da = item.detailed_analysis as any;
        return {
          outcome: { status: da.outcome?.status || 'on_target', bullets: da.outcome?.bullets || [] },
          time: { status: da.time?.status || 'on_time', bullets: da.time?.bullets || [] },
          executionHealth: { status: da.executionHealth?.status || 'stable', bullets: da.executionHealth?.bullets || [] },
        } as DetailedAnalysis;
      })() : undefined,
      sourceDocumentIds: (item.source_document_ids as string[]) || undefined,
    }));

    const frictions: FrictionIndicator[] = ((leader.frictions as Record<string, unknown>[]) || []).map(f => ({
      id: f.id as string,
      type: f.type as FrictionIndicator['type'],
      severity: f.severity as FrictionIndicator['severity'],
      description: f.description as string,
      relatedItemIds: (f.related_item_ids as string[]) || [],
      relatedLeaders: (f.related_leaders as FrictionIndicator['relatedLeaders']) || [],
      autoTagged: f.auto_tagged as boolean,
    }));

    return {
      leader: leader.leader as LeaderUpdate['leader'],
      department: leader.department as string,
      submittedAt: leader.submitted_at as string,
      isLate: leader.is_late as boolean,
      items,
      frictions,
    };
  });

  return {
    date: lu.date as string,
    deadline: lu.deadline as string,
    leaders,
  };
}

// ============================================
// Simplified Blueprint Transformation Functions
// ============================================

/**
 * Transform simplified team member to Personnel
 */
function transformSimplifiedTeamMember(member: SimplifiedTeamMember): Personnel {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    department: member.department,
    availability: 'Full-time',
  };
}

/**
 * Create headcount assignments from simplified project
 */
function createSimplifiedProjectHeadcount(
  project: SimplifiedProject,
  team: SimplifiedTeamMember[]
): ProjectAssignment[] {
  return project.assigned_to.map((memberId, idx) => {
    const member = team.find(t => t.id === memberId);
    return {
      id: `${project.id}-member-${idx}`,
      personnelId: memberId,
      name: member?.name || memberId,
      role: member?.role || 'Team Member',
      allocation: 'Full-time',
    };
  });
}

/**
 * Transform simplified teams into Team[]
 */
function transformSimplifiedTeams(
  simplifiedTeams: SimplifiedTeam[],
  allTeamMembers: SimplifiedTeamMember[]
): Team[] {
  return simplifiedTeams.map(t => ({
    id: t.id,
    name: t.name,
    department: t.department,
    members: t.member_ids.map((memberId, idx) => {
      const member = allTeamMembers.find(m => m.id === memberId);
      return {
        id: `${t.id}-member-${idx}`,
        personnelId: memberId,
        name: member?.name || memberId,
        role: member?.role || 'Team Member',
        allocation: 'Full-time',
      };
    }),
  }));
}

/**
 * Transform simplified project to DepartmentalProject
 */
function transformSimplifiedProject(
  project: SimplifiedProject,
  team: SimplifiedTeamMember[],
  department: string
): DepartmentalProject {
  const result: DepartmentalProject = {
    id: project.id,
    department: department,
    title: project.name,
    description: project.description,
    status: mapProjectStatus(project.status),
    progress: Math.round(project.progress * 100),
    startDate: project.start_date,
    endDate: project.end_date,
    headcount: createSimplifiedProjectHeadcount(project, team),
  };
  // Attach teams if present (nested format)
  if (project.teams?.length) {
    result.teams = transformSimplifiedTeams(project.teams, team);
  }
  return result;
}

/**
 * Transform simplified objective to app's Objective structure
 */
function transformSimplifiedObjective(
  bpObjective: SimplifiedObjective,
  team: SimplifiedTeamMember[]
): Objective {
  // Find owner to determine department
  const owner = team.find(t => t.id === bpObjective.owner);
  const department = owner?.department || 'General';

  // Distribute projects across KRs round-robin (no explicit KR linkage in simplified format)
  const krCount = bpObjective.key_results.length;
  const projectsByKR = new Map<number, SimplifiedProject[]>();
  bpObjective.projects.forEach((p, i) => {
    const krIdx = krCount > 0 ? i % krCount : 0;
    if (!projectsByKR.has(krIdx)) projectsByKR.set(krIdx, []);
    projectsByKR.get(krIdx)!.push(p);
  });

  // Transform each key result
  const keyResults: KeyResult[] = bpObjective.key_results.map((kr, krIdx) => {
    const linkedProjects = projectsByKR.get(krIdx) || [];
    const transformedProjects = linkedProjects.map(p => transformSimplifiedProject(p, team, department));

    const result: KeyResult = {
      id: kr.id,
      title: kr.description,
      targetMetric: `${kr.metric}: ${kr.current}/${kr.target} ${kr.unit || ''}`.trim(),
      progress: kr.target > 0 ? Math.round(((kr.current - kr.baseline) / (kr.target - kr.baseline)) * 100) : 0,
      metric: kr.metric,
      baseline: kr.baseline,
      current: kr.current,
      target: kr.target,
      departmentalProjects: transformedProjects,
    };

    // Handle nested departmental KRs if present
    if (kr.departmental_key_results?.length) {
      result.departmentalKeyResults = kr.departmental_key_results.map(dkr => {
        const dkrProjects = dkr.projects.map(p => transformSimplifiedProject(p, team, dkr.department));
        return {
          id: dkr.id,
          title: dkr.description,
          department: dkr.department,
          targetMetric: `${dkr.metric}: ${dkr.current}/${dkr.target} ${dkr.unit || ''}`.trim(),
          progress: dkr.target > 0 ? Math.round(((dkr.current - dkr.baseline) / (dkr.target - dkr.baseline)) * 100) : 0,
          metric: dkr.metric,
          baseline: dkr.baseline,
          current: dkr.current,
          target: dkr.target,
          departmentalProjects: dkrProjects,
        };
      });
    }

    return result;
  });

  return {
    id: bpObjective.id,
    title: bpObjective.objective,
    timePeriod: bpObjective.theme || 'FY2025',
    keyResults,
  };
}

/**
 * Parse a simplified strategy blueprint JSON into app structures
 */
export function parseSimplifiedBlueprint(blueprint: SimplifiedBlueprint): ParsedBlueprint {
  // Transform team members to personnel
  const personnel = blueprint.team.map(transformSimplifiedTeamMember);

  // Transform objectives with their embedded key results and projects
  const objectives = blueprint.objectives.map(obj =>
    transformSimplifiedObjective(obj, blueprint.team)
  );

  // Transform dependencies if present
  const dependencies: Dependency[] = (blueprint.dependencies || []).map((dep, i) => ({
    id: `dep-${i}`,
    sourceType: 'project' as const,
    sourceId: dep.from_project,
    targetType: 'project' as const,
    targetId: dep.to_project,
    dependencyType: mapDependencyType(dep.type),
    description: dep.description,
  }));

  return {
    companyName: blueprint.company.name,
    objectives,
    personnel,
    dependencies,
    metadata: blueprint.company,
  };
}

/**
 * Parse a strategy blueprint JSON into app structures
 */
export function parseStrategyBlueprint(blueprint: StrategyBlueprint): ParsedBlueprint {
  // Transform resources to personnel, or extract from projects if resources is missing
  const hasResources = blueprint.resources && blueprint.resources.length > 0;
  const personnel = hasResources
    ? blueprint.resources.map(transformResource)
    : extractPersonnelFromProjects(blueprint.projects || []);

  // Use empty array for resources if missing (for headcount assignment)
  const resourcesForHeadcount = blueprint.resources || [];

  // Transform objectives with their key results, projects, DKRs, and teams
  const objectives = blueprint.objectives.map(obj =>
    transformObjective(
      obj,
      blueprint.key_results,
      blueprint.projects,
      resourcesForHeadcount,
      blueprint.departmental_key_results || [],
      blueprint.teams || []
    )
  );

  // Transform dependencies
  const dependencies = blueprint.dependencies
    ? transformDependencies(blueprint.dependencies)
    : [];

  // Parse check-in brief if present
  const checkInBrief = parseCheckIn(blueprint as unknown as Record<string, unknown>);

  // Parse leader updates if present
  const leaderUpdates = parseLeaderUpdates(blueprint as unknown as Record<string, unknown>);

  return {
    companyName: blueprint.metadata.company_name,
    objectives,
    personnel,
    dependencies,
    metadata: blueprint.metadata,
    checkInBrief,
    leaderUpdates,
  };
}

/**
 * Detect which blueprint format the data is in
 */
export function detectBlueprintFormat(data: unknown): 'standard' | 'simplified' | 'invalid' {
  if (!data || typeof data !== 'object') return 'invalid';

  const bp = data as Record<string, unknown>;

  // Check for simplified format (has 'company' and 'team')
  if (bp.company && typeof bp.company === 'object' && bp.team && Array.isArray(bp.team)) {
    const company = bp.company as Record<string, unknown>;
    if (company.name && typeof company.name === 'string') {
      return 'simplified';
    }
  }

  // Check for standard format (has 'metadata' and 'key_results')
  if (bp.metadata && typeof bp.metadata === 'object' && bp.key_results && Array.isArray(bp.key_results)) {
    const metadata = bp.metadata as Record<string, unknown>;
    if (metadata.company_name && typeof metadata.company_name === 'string') {
      return 'standard';
    }
  }

  return 'invalid';
}

/**
 * Validate that a JSON object is a valid strategy blueprint (either format)
 */
export function validateBlueprint(data: unknown): data is StrategyBlueprint | SimplifiedBlueprint {
  return detectBlueprintFormat(data) !== 'invalid';
}

/**
 * Validate that a JSON object is a valid standard strategy blueprint
 */
export function validateStandardBlueprint(data: unknown): data is StrategyBlueprint {
  return detectBlueprintFormat(data) === 'standard';
}

/**
 * Validate that a JSON object is a valid simplified strategy blueprint
 */
export function validateSimplifiedBlueprint(data: unknown): data is SimplifiedBlueprint {
  return detectBlueprintFormat(data) === 'simplified';
}

/**
 * Universal parse function that handles both blueprint formats
 */
export function parseBlueprint(data: unknown): ParsedBlueprint {
  const format = detectBlueprintFormat(data);

  if (format === 'simplified') {
    return parseSimplifiedBlueprint(data as SimplifiedBlueprint);
  } else if (format === 'standard') {
    return parseStrategyBlueprint(data as StrategyBlueprint);
  }

  throw new Error('Invalid blueprint format');
}
