/**
 * Strategy Blueprint Type Definitions
 * 
 * Comprehensive types for importing strategy blueprints that include
 * objectives, key results, projects, resources, and dependencies.
 */

export interface BlueprintMetadata {
  company_name: string;
  company_stage: string;
  funding_raised?: string;
  runway_months?: number;
  headcount: number;
  target_headcount?: number;
  planning_period: string;
  current_date?: string;
  last_updated: string;
  currency?: string;
}

export interface BlueprintStrategicPriority {
  rank: number;
  title: string;
  description: string;
}

export interface BlueprintObjective {
  id: string;
  theme: string;
  objective: string;
  description?: string;
  owner: string;
  time_horizon: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'not_started' | 'planning' | 'in_progress' | 'at_risk' | 'behind' | 'completed' | 'on_track';
  progress: number;
  key_results: string[];
}

export interface BlueprintKeyResult {
  id: string;
  objective_id: string;
  description: string;
  /** Optional descriptive context for the key result */
  detail?: string;
  metric: string;
  metric_type: 'count' | 'percentage' | 'currency' | 'days' | 'score' | 'ratio' | 'boolean';
  baseline: number;
  target: number;
  current: number;
  progress: number;
  owner: string;
  status: string;
  /** Target date for the key result (ISO date string) */
  target_date?: string;
  /** Nested departmental KRs (alternative to flat top-level array) */
  departmental_key_results?: BlueprintDepartmentalKeyResult[];
}

export interface BlueprintProject {
  id: string;
  name: string;
  /** KR IDs this project drives. Accepts both field names from different blueprint versions. */
  linked_key_results?: string[];
  drives_krs?: string[];
  department: string;
  lead: string;
  team_members: string[];
  start_date: string;
  end_date: string;
  status: 'not_started' | 'planning' | 'in_progress' | 'at_risk' | 'behind' | 'completed';
  progress: number;
  budget?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  /** Nested teams (alternative to flat top-level array) */
  teams?: BlueprintTeam[];
}

export interface BlueprintResource {
  id: string;
  name: string;
  role: string;
  department: string;
  skills: string[];
  availability: number;
  utilization: number;
  assigned_projects: string[];
  cost_center: string;
  reports_to: string | null;
}

export interface BlueprintDepartmentalKeyResult {
  id: string;
  company_kr_id: string;
  department: string;
  description: string;
  detail?: string;
  metric: string;
  metric_type?: string;
  baseline: number;
  target: number;
  current: number;
  progress: number;
  owner?: string;
  status?: string;
  target_date?: string;
  linked_projects?: string[];
}

export interface BlueprintTeam {
  id: string;
  name: string;
  project_id: string;
  department?: string;
  member_ids: string[];
}

export interface BlueprintDependency {
  id: string;
  from_project: string;
  to_project: string;
  type: 'blocks' | 'enables' | 'informs';
  description: string;
  status: string;
  risk_level: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface StrategyBlueprint {
  metadata: BlueprintMetadata;
  strategic_priorities?: BlueprintStrategicPriority[];
  objectives: BlueprintObjective[];
  key_results: BlueprintKeyResult[];
  projects: BlueprintProject[];
  resources?: BlueprintResource[];
  departmental_key_results?: BlueprintDepartmentalKeyResult[];
  teams?: BlueprintTeam[];
  dependencies?: BlueprintDependency[];
  enums?: {
    status: string[];
    priority: string[];
    metric_type: string[];
    dependency_type: string[];
    risk_level: string[];
  };
}

// ============================================
// Simplified Blueprint Format Types
// ============================================

export interface SimplifiedCompany {
  name: string;
  description?: string;
  industry?: string;
  stage?: string;
  funding_raised?: string;
  headcount?: number;
  runway_months?: number;
  planning_period?: string;
}

export interface SimplifiedTeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
}

export interface SimplifiedDepartmentalKR {
  id: string;
  description: string;
  department: string;
  metric: string;
  baseline: number;
  target: number;
  current: number;
  unit?: string;
  projects: SimplifiedProject[];
}

export interface SimplifiedTeam {
  id: string;
  name: string;
  department?: string;
  member_ids: string[];
}

export interface SimplifiedKeyResult {
  id: string;
  description: string;
  metric: string;
  baseline: number;
  target: number;
  current: number;
  unit?: string;
  departmental_key_results?: SimplifiedDepartmentalKR[];
}

export interface SimplifiedProject {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  progress: number;
  assigned_to: string[]; // Array of team member IDs
  teams?: SimplifiedTeam[];
}

export interface SimplifiedObjective {
  id: string;
  objective: string;
  owner: string; // Team member ID
  theme?: string;
  key_results: SimplifiedKeyResult[];
  projects: SimplifiedProject[];
}

export interface SimplifiedDependency {
  from_project: string;
  to_project: string;
  type: 'blocks' | 'enables' | 'informs';
  description?: string;
}

export interface SimplifiedBlueprint {
  company: SimplifiedCompany;
  team: SimplifiedTeamMember[];
  objectives: SimplifiedObjective[];
  dependencies?: SimplifiedDependency[];
}
