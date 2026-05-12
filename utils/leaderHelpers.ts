/**
 * Leader Portfolio Helpers
 *
 * Extracts the projects and KRs owned by each leader role
 * based on department matching and KR owner fields.
 */

import { Objective, KeyResult, DepartmentalProject, Personnel } from '../types';
import { LeaderRole } from '../types/checkin';

export interface PortfolioProject {
  id: string;
  title: string;
  objectiveId: string;
  objectiveTitle: string;
  keyResultId: string;
  keyResultTitle: string;
  project: DepartmentalProject;
}

export interface PortfolioKeyResult {
  id: string;
  title: string;
  objectiveId: string;
  objectiveTitle: string;
  keyResult: KeyResult;
}

export interface LeaderPortfolio {
  leader: LeaderRole;
  department: string;
  projects: PortfolioProject[];
  keyResults: PortfolioKeyResult[];
}

const LEADER_DEPARTMENTS: Record<LeaderRole, string[]> = {
  'VP Engineering': ['Engineering', 'Infrastructure', 'Platform'],
  'VP Sales': ['Sales', 'Revenue'],
  'VP Product': ['Product', 'Design'],
  'VP People': ['People', 'HR', 'Human Resources'],
  'VP Customer Success': ['Customer Success', 'CS', 'Support'],
};

const LEADER_KR_OWNERS: Record<LeaderRole, string[]> = {
  'VP Engineering': ['VP Engineering', 'CTO', 'Head of Engineering'],
  'VP Sales': ['VP Sales', 'Head of Sales', 'Sales Director'],
  'VP Product': ['VP Product', 'Head of Product', 'CPO'],
  'VP People': ['VP People', 'Head of People', 'HR Director', 'CHRO'],
  'VP Customer Success': ['VP Customer Success', 'Head of CS', 'CS Director'],
};

export function getLeaderPortfolio(
  leader: LeaderRole,
  objectives: Objective[],
): LeaderPortfolio {
  const departments = LEADER_DEPARTMENTS[leader];
  const krOwners = LEADER_KR_OWNERS[leader];
  const dept = departments[0];

  const projects: PortfolioProject[] = [];
  const keyResults: PortfolioKeyResult[] = [];
  const seenKRs = new Set<string>();

  for (const obj of objectives) {
    for (const kr of obj.keyResults) {
      // Check if this KR is owned by this leader
      const krOwned = kr.owner && krOwners.some(o => kr.owner!.toLowerCase().includes(o.toLowerCase()));

      if (krOwned && !seenKRs.has(kr.id)) {
        seenKRs.add(kr.id);
        keyResults.push({
          id: kr.id,
          title: kr.title,
          objectiveId: obj.id,
          objectiveTitle: obj.title,
          keyResult: kr,
        });
      }

      // Get projects in this leader's department
      for (const dp of kr.departmentalProjects || []) {
        if (departments.some(d => dp.department.toLowerCase().includes(d.toLowerCase()))) {
          projects.push({
            id: dp.id,
            title: dp.title,
            objectiveId: obj.id,
            objectiveTitle: obj.title,
            keyResultId: kr.id,
            keyResultTitle: kr.title,
            project: dp,
          });
        }
      }
    }
  }

  return { leader, department: dept, projects, keyResults };
}

/**
 * Build a text summary of a leader's portfolio for AI prompt context
 */
export function buildLeaderContext(portfolio: LeaderPortfolio, personnel: Personnel[]): string {
  const lines: string[] = [];
  lines.push(`Portfolio for ${portfolio.leader} (${portfolio.department} department):`);
  lines.push('');

  if (portfolio.keyResults.length > 0) {
    lines.push('Key Results owned:');
    for (const kr of portfolio.keyResults) {
      const k = kr.keyResult;
      lines.push(`  - ${kr.id}: ${kr.title}`);
      if (k.metric && k.current !== undefined && k.target !== undefined) {
        lines.push(`    Metric: ${k.metric}, Current: ${k.current}, Target: ${k.target}, Progress: ${k.progress ?? 0}%`);
      }
      if (k.status) lines.push(`    Status: ${k.status}`);
      if (k.targetDate) lines.push(`    Target Date: ${k.targetDate}`);
    }
    lines.push('');
  }

  if (portfolio.projects.length > 0) {
    lines.push('Projects:');
    for (const p of portfolio.projects) {
      const dp = p.project;
      lines.push(`  - ${p.id}: ${p.title} (drives ${p.keyResultId})`);
      lines.push(`    Status: ${dp.status}, Progress: ${dp.progress}%`);
      if (dp.startDate) lines.push(`    Timeline: ${dp.startDate} to ${dp.endDate || 'TBD'}`);
      if (dp.headcount && dp.headcount.length > 0) {
        const team = dp.headcount.map(h => `${h.name} (${h.role}, ${h.allocation || 'Full-time'})`).join(', ');
        lines.push(`    Team: ${team}`);
      }
      if (dp.description) lines.push(`    Description: ${dp.description}`);
    }
    lines.push('');
  }

  // Personnel utilization for people in this leader's projects
  const relevantPersonIds = new Set<string>();
  for (const p of portfolio.projects) {
    for (const hc of p.project.headcount || []) {
      if (hc.personnelId) relevantPersonIds.add(hc.personnelId);
      if (hc.name) relevantPersonIds.add(hc.name);
    }
  }

  const relevantPersonnel = personnel.filter(p => relevantPersonIds.has(p.id) || relevantPersonIds.has(p.name));
  if (relevantPersonnel.length > 0) {
    lines.push('Team members:');
    for (const p of relevantPersonnel) {
      lines.push(`  - ${p.name}: ${p.role} (${p.department}), Availability: ${p.availability || 'Full-time'}`);
    }
  }

  return lines.join('\n');
}
