/**
 * FTE-Years Calculation Utilities
 *
 * FTE-years (Full-Time Equivalent Years) measures resource allocation cost.
 * Formula: allocation_percentage × duration_in_years
 *
 * Examples:
 * - 1 full-time person for 6 months = 1.0 × 0.5 = 0.5 FTE-years
 * - 1 half-time person for 1 year = 0.5 × 1.0 = 0.5 FTE-years
 * - 2 full-time people for 3 months = 2 × (1.0 × 0.25) = 0.5 FTE-years
 */

import { DepartmentalProject, DepartmentalKeyResult, KeyResult, Objective } from '../types';
import { ANNUAL_COST_PER_FTE } from './constants';
import { getAllProjectMembers, getKRAllProjects } from './strategyHelpers';

/**
 * Parse allocation string to decimal value
 * @param allocation - Allocation string (e.g., "Full-time", "Part-time", "50%", "0.5")
 * @returns Decimal allocation value (0.0 - 1.0)
 */
export const parseAllocation = (allocation?: string): number => {
  if (!allocation) return 1.0; // Default to full-time

  const lower = allocation.toLowerCase().trim();

  // Handle common text values
  if (lower === 'full-time' || lower === 'full time' || lower === '100%') return 1.0;
  if (lower === 'part-time' || lower === 'part time') return 0.5;
  if (lower === 'half-time' || lower === 'half time') return 0.5;
  if (lower === 'quarter-time' || lower === 'quarter time') return 0.25;

  // Try to parse percentage (e.g., "50%", "75%", "33.5%")
  const percentMatch = allocation.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) return parseFloat(percentMatch[1]) / 100;

  // Try to parse decimal (e.g., "0.5", "0.75")
  const decimalMatch = allocation.match(/^(\d*\.?\d+)$/);
  if (decimalMatch) {
    const val = parseFloat(decimalMatch[1]);
    // If value is > 1, assume it's a percentage
    return val > 1 ? val / 100 : val;
  }

  return 1.0; // Default fallback
};

/**
 * Calculate duration in years between two dates
 * @param startDate - Start date string (ISO format)
 * @param endDate - End date string (ISO format)
 * @returns Duration in years (decimal)
 */
export const calculateDurationYears = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationDays = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return durationDays / 365;
};

/**
 * Calculate FTE-years for a single project
 * @param project - The project to calculate FTE-years for
 * @returns Total FTE-years for the project
 */
export const calculateProjectFTEYears = (project: DepartmentalProject): number => {
  if (!project.startDate || !project.endDate) return 0;

  const members = getAllProjectMembers(project);
  if (members.length === 0) return 0;

  const durationYears = calculateDurationYears(project.startDate, project.endDate);

  return members.reduce((total, member) => {
    const allocation = parseAllocation(member.allocation);
    return total + (allocation * durationYears);
  }, 0);
};

/**
 * Calculate FTE-years for a Key Result (sum of all its projects)
 * @param kr - The Key Result to calculate FTE-years for
 * @returns Total FTE-years for the Key Result
 */
/**
 * Calculate FTE-years for a Departmental Key Result (sum of all its projects)
 */
export const calculateDKRFTEYears = (dkr: DepartmentalKeyResult): number => {
  if (!dkr.departmentalProjects) return 0;
  return dkr.departmentalProjects.reduce((total, proj) => total + calculateProjectFTEYears(proj), 0);
};

export const calculateKRFTEYears = (kr: KeyResult): number => {
  return getKRAllProjects(kr).reduce((total, proj) => total + calculateProjectFTEYears(proj), 0);
};

/**
 * Calculate FTE-years for an Objective (sum of all unique projects across its KRs)
 * Projects are deduplicated by ID since a project may appear under multiple KRs
 * @param obj - The Objective to calculate FTE-years for
 * @returns Total FTE-years for the Objective
 */
export const calculateObjectiveFTEYears = (obj: Objective): number => {
  // Deduplicate projects by ID (includes DKR-nested projects)
  const uniqueProjects = new Map<string, DepartmentalProject>();
  obj.keyResults.forEach(kr => {
    getKRAllProjects(kr).forEach(p => uniqueProjects.set(p.id, p));
  });

  return Array.from(uniqueProjects.values()).reduce(
    (total, proj) => total + calculateProjectFTEYears(proj),
    0
  );
};

/**
 * Calculate total FTE-years across all objectives
 * @param objectives - Array of objectives
 * @returns Total FTE-years across all objectives
 */
export const calculateTotalFTEYears = (objectives: Objective[]): number => {
  // Deduplicate all projects across all objectives (includes DKR-nested projects)
  const uniqueProjects = new Map<string, DepartmentalProject>();
  objectives.forEach(obj => {
    obj.keyResults.forEach(kr => {
      getKRAllProjects(kr).forEach(p => uniqueProjects.set(p.id, p));
    });
  });

  return Array.from(uniqueProjects.values()).reduce(
    (total, proj) => total + calculateProjectFTEYears(proj),
    0
  );
};

/**
 * Format FTE-years for display
 * @param fteYears - FTE-years value
 * @param options - Formatting options
 * @returns Formatted string (e.g., "0.25", "1.50", "<0.01")
 */
export const formatFTEYears = (
  fteYears: number,
  options: { decimals?: number; showUnit?: boolean } = {}
): string => {
  const { decimals = 2, showUnit = false } = options;

  if (fteYears === 0) return showUnit ? '0 FTE-yr' : '0';
  if (fteYears < 0.01) return showUnit ? '<0.01 FTE-yr' : '<0.01';

  const formatted = fteYears.toFixed(decimals);
  return showUnit ? `${formatted} FTE-yr` : formatted;
};

// ─── Resource Cost Calculations ──────────────────────────────────────────────

/**
 * Calculate resource cost from FTE-years
 * @param fteYears - FTE-years value
 * @returns Cost in dollars
 */
export const calculateResourceCost = (fteYears: number): number => {
  return fteYears * ANNUAL_COST_PER_FTE;
};

/**
 * Calculate resource cost for a project
 * @param project - The project to calculate cost for
 * @returns Cost in dollars
 */
export const calculateProjectCost = (project: DepartmentalProject): number => {
  return calculateResourceCost(calculateProjectFTEYears(project));
};

/**
 * Calculate resource cost for a Key Result
 * @param kr - The Key Result to calculate cost for
 * @returns Cost in dollars
 */
export const calculateKRCost = (kr: KeyResult): number => {
  return calculateResourceCost(calculateKRFTEYears(kr));
};

/**
 * Calculate resource cost for an Objective
 * @param obj - The Objective to calculate cost for
 * @returns Cost in dollars
 */
export const calculateObjectiveCost = (obj: Objective): number => {
  return calculateResourceCost(calculateObjectiveFTEYears(obj));
};

/**
 * Format resource cost for display
 * @param cost - Cost value in dollars
 * @returns Formatted string (e.g., "$50K", "$1.2M")
 */
export const formatResourceCost = (cost: number): string => {
  if (cost === 0) return '$0';
  if (cost < 1000) return `$${Math.round(cost)}`;
  if (cost < 1000000) return `$${(cost / 1000).toFixed(0)}K`;
  return `$${(cost / 1000000).toFixed(1)}M`;
};
