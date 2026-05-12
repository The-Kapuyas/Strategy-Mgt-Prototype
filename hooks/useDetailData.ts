import { useMemo } from 'react';
import { Objective, KeyResult, DepartmentalKeyResult, DepartmentalProject, ProjectAssignment, Team, Dependency, Personnel } from '../types';
import { findKeyResult, findDepartmentalKeyResult, findProject, findTeam, findPersonInfo, getDependenciesForElement } from '../utils/strategyHelpers';
import { ResourceStatus } from '../utils/constants';

export type StrategyElementType = 'objective' | 'keyResult' | 'departmentalKeyResult' | 'project' | 'team' | 'person';

export interface SelectedItem {
  id: string;
  type: StrategyElementType;
  label: string;
}

// Union type for detail panel data
export type DetailData =
  | { type: 'objective'; obj: Objective; totalProjects: number; issues: DepartmentalProject[]; deps: Dependency[] }
  | { type: 'keyResult'; kr: KeyResult; objIndex: number; krIndex: number; parentObj: Objective | undefined; projects: DepartmentalProject[]; issues: DepartmentalProject[]; deps: Dependency[] }
  | { type: 'departmentalKeyResult'; dkr: DepartmentalKeyResult; parentKR: KeyResult; parentObj: Objective; projects: DepartmentalProject[]; issues: DepartmentalProject[]; deps: Dependency[] }
  | { type: 'project'; proj: DepartmentalProject; parentKR: KeyResult | null; parentObj: Objective | null; objIndex: number; krIndex: number; status: { status: ResourceStatus; message: string }; deps: Dependency[] }
  | { type: 'team'; team: Team; parentProject: DepartmentalProject; parentKR: KeyResult; parentObj: Objective; members: ProjectAssignment[] }
  | { type: 'person'; person: ProjectAssignment; personnelRecord?: Personnel; projectCount: number; assignedProjects: { proj: DepartmentalProject; objTitle: string }[] };

export function useDetailData(
  selectedItem: SelectedItem | null,
  filteredObjectives: Objective[],
  allObjectives: Objective[],
  dependencies: Dependency[],
  getProjectResourceStatus: (p: DepartmentalProject) => { status: ResourceStatus; message: string },
  personnel?: Personnel[]
): DetailData | null {
  return useMemo(() => {
    if (!selectedItem) return null;
    const { id, type } = selectedItem;

    const getDeps = (t: 'objective' | 'keyResult' | 'project', elemId: string) =>
      getDependenciesForElement(dependencies, t, elemId);

    // Helper to collect all projects from a KR (including through DKRs)
    const getKRProjects = (kr: KeyResult): DepartmentalProject[] => {
      const projects = [...(kr.departmentalProjects || [])];
      for (const dkr of kr.departmentalKeyResults || []) {
        projects.push(...(dkr.departmentalProjects || []));
      }
      return projects;
    };

    // Helper to get all members from a project (including through teams)
    const getProjectMembers = (proj: DepartmentalProject): ProjectAssignment[] => {
      if (proj.teams?.length) {
        return proj.teams.flatMap(t => t.members || []);
      }
      return proj.headcount || [];
    };

    if (type === 'objective') {
      const obj = filteredObjectives.find(o => o.id === id);
      if (!obj) return null;
      const totalProjects = obj.keyResults.reduce((s, kr) => s + getKRProjects(kr).length, 0);
      const issues = obj.keyResults.flatMap(kr => getKRProjects(kr).filter(p => getProjectResourceStatus(p).status !== 'ok'));
      return { type: 'objective' as const, obj, totalProjects, issues, deps: getDeps('objective', id) };
    }

    if (type === 'keyResult') {
      const info = findKeyResult(allObjectives, id);
      if (!info) return null;
      const parentObj = filteredObjectives.find(o => o.id === allObjectives[info.objIndex].id);
      const projects = getKRProjects(info.kr);
      const issues = projects.filter(p => getProjectResourceStatus(p).status !== 'ok');
      return { type: 'keyResult' as const, kr: info.kr, objIndex: info.objIndex, krIndex: info.krIndex, parentObj, projects, issues, deps: getDeps('keyResult', id) };
    }

    if (type === 'departmentalKeyResult') {
      const info = findDepartmentalKeyResult(allObjectives, id);
      if (!info) return null;
      const projects = info.dkr.departmentalProjects || [];
      const issues = projects.filter(p => getProjectResourceStatus(p).status !== 'ok');
      return { type: 'departmentalKeyResult' as const, dkr: info.dkr, parentKR: info.parentKR, parentObj: info.parentObj, projects, issues, deps: getDeps('keyResult', id) };
    }

    if (type === 'project') {
      const proj = findProject(allObjectives, id);
      if (!proj) return null;
      let parentKR: KeyResult | null = null;
      let parentObj: Objective | null = null;
      let krIndex = 0;
      let objIndex = 0;
      for (let oi = 0; oi < filteredObjectives.length; oi++) {
        for (let ki = 0; ki < filteredObjectives[oi].keyResults.length; ki++) {
          const kr = filteredObjectives[oi].keyResults[ki];
          const allProjects = getKRProjects(kr);
          if (allProjects.some(p => p.id === id)) {
            parentKR = kr;
            parentObj = filteredObjectives[oi];
            krIndex = ki;
            objIndex = allObjectives.findIndex(o => o.id === filteredObjectives[oi].id);
          }
        }
      }
      const status = getProjectResourceStatus(proj);
      return { type: 'project' as const, proj, parentKR, parentObj, objIndex, krIndex, status, deps: getDeps('project', id) };
    }

    if (type === 'team') {
      const info = findTeam(allObjectives, id);
      if (!info) return null;
      return { type: 'team' as const, team: info.team, parentProject: info.parentProject, parentKR: info.parentKR, parentObj: info.parentObj, members: info.team.members || [] };
    }

    if (type === 'person') {
      const pInfo = findPersonInfo(allObjectives, id);
      if (!pInfo) return null;
      const assignedProjects: { proj: DepartmentalProject; objTitle: string }[] = [];
      for (const obj of filteredObjectives) {
        for (const kr of obj.keyResults) {
          for (const p of getKRProjects(kr)) {
            const members = getProjectMembers(p);
            if (members.some(h => h.id === id)) assignedProjects.push({ proj: p, objTitle: obj.title });
          }
        }
      }
      const personnelRecord = personnel?.find(p =>
        p.id === pInfo.person.personnelId || p.name === pInfo.person.name
      );
      return { type: 'person' as const, person: pInfo.person, personnelRecord, projectCount: pInfo.projectCount, assignedProjects };
    }

    return null;
  }, [selectedItem, filteredObjectives, allObjectives, dependencies, getProjectResourceStatus, personnel]);
}
