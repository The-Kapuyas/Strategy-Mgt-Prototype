import { Objective, Priority, DepartmentalProject, ProjectAssignment } from '../types';
import { getAllProjectMembers } from './strategyHelpers';

/**
 * Utility functions for working with OKRs (Objectives and Key Results) and projects
 */

/**
 * Update a specific project within the objectives structure
 */
export const updateProjectInObjectives = (
  objectives: Objective[],
  projectId: string,
  updater: (project: DepartmentalProject) => DepartmentalProject
): Objective[] => {
  return objectives.map(objective => ({
    ...objective,
    keyResults: objective.keyResults.map(keyResult => ({
      ...keyResult,
      departmentalProjects: keyResult.departmentalProjects?.map(project =>
        project.id === projectId ? updater(project) : project
      ),
      departmentalKeyResults: keyResult.departmentalKeyResults?.map(dkr => ({
        ...dkr,
        departmentalProjects: dkr.departmentalProjects?.map(project =>
          project.id === projectId ? updater(project) : project
        ),
      })),
    })),
  }));
};

// Legacy alias for backward compatibility
export const updateProjectInPriorities = updateProjectInObjectives;

/**
 * Update a project's status and progress
 */
export const updateProjectStatus = (
  objectives: Priority[],
  projectId: string,
  newStatus: 'To Do' | 'Doing' | 'Done',
  newProgress: number
): Priority[] => {
  return updateProjectInObjectives(objectives, projectId, project => ({
    ...project,
    status: newStatus,
    progress: newProgress,
  }));
};

/**
 * Update a project's headcount (team assignments)
 */
export const updateProjectHeadcount = (
  objectives: Priority[],
  projectId: string,
  headcount: ProjectAssignment[]
): Priority[] => {
  return updateProjectInObjectives(objectives, projectId, project => ({
    ...project,
    headcount,
  }));
};

/**
 * Update a project's timeframe
 */
export const updateProjectTimeframe = (
  objectives: Priority[],
  projectId: string,
  startDate: string,
  endDate: string
): Priority[] => {
  return updateProjectInObjectives(objectives, projectId, project => ({
    ...project,
    startDate,
    endDate,
  }));
};

/**
 * Get all projects from objectives structure (flattened)
 */
export const getAllProjects = (objectives: Objective[]): DepartmentalProject[] => {
  return objectives.flatMap(objective =>
    objective.keyResults.flatMap(keyResult => {
      const direct = keyResult.departmentalProjects || [];
      const fromDKRs = (keyResult.departmentalKeyResults || []).flatMap(dkr => dkr.departmentalProjects || []);
      return [...direct, ...fromDKRs];
    })
  );
};

/**
 * Calculate average progress across all projects
 */
export const calculateAverageProgress = (projects: DepartmentalProject[]): number => {
  if (projects.length === 0) return 0;
  const totalProgress = projects.reduce((sum, project) => sum + project.progress, 0);
  return Math.round(totalProgress / projects.length);
};

/**
 * Calculate talent alignment score based on headcount and timeframe
 */
export const calculateTalentAlignment = (projects: DepartmentalProject[]): number => {
  if (projects.length === 0) return 100;

  let totalScore = 0;
  
  projects.forEach(project => {
    // Get headcount including team members
    const headcountCount = getAllProjectMembers(project).length;
    
    // Calculate duration in months from startDate and endDate
    let months = 6; // default
    if (project.startDate && project.endDate) {
      const start = new Date(project.startDate);
      const end = new Date(project.endDate);
      months = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    }

    // Baseline: 3 team members per 6-month project is "balanced"
    const headcount = headcountCount || 2;
    const ratio = (headcount / 3) * (months / 6);
    totalScore += Math.min(1.2, ratio) * 100;
  });

  return Math.min(100, Math.round(totalScore / projects.length));
};
