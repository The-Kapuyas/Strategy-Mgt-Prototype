/**
 * Shared Constants
 * Centralized definitions for colors, mappings, and configuration values
 */

// ─── Time Constants ───────────────────────────────────────────────────────────

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = MS_PER_SECOND * 60;
export const MS_PER_HOUR = MS_PER_MINUTE * 60;
export const MS_PER_DAY = MS_PER_HOUR * 24;
export const MS_PER_WEEK = MS_PER_DAY * 7;
export const MS_PER_MONTH = MS_PER_DAY * 30; // Approximate
export const MS_PER_YEAR = MS_PER_DAY * 365;

// ─── Resource Cost Constants ─────────────────────────────────────────────────

export const ANNUAL_COST_PER_FTE = 200000; // $200,000 per FTE per year

// ─── Resource Status Types ────────────────────────────────────────────────────

export type ResourceStatus = 'ok' | 'under' | 'over' | 'critical';

export const STATUS_STYLES: Record<ResourceStatus, {
  bg: string;
  bgLight: string;
  border: string;
  text: string;
  textDark: string;
  icon: string;
}> = {
  critical: {
    bg: 'bg-red-500',
    bgLight: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-700',
    textDark: 'text-red-800',
    icon: 'text-red-500',
  },
  under: {
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    textDark: 'text-amber-800',
    icon: 'text-amber-500',
  },
  over: {
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    textDark: 'text-blue-800',
    icon: 'text-blue-500',
  },
  ok: {
    bg: 'bg-emerald-500',
    bgLight: 'bg-slate-50',
    border: 'border-slate-300',
    text: 'text-slate-700',
    textDark: 'text-slate-800',
    icon: 'text-slate-500',
  },
};

export const STATUS_MESSAGES: Record<ResourceStatus, string> = {
  critical: 'No team assigned',
  under: 'Under-resourced',
  over: 'Over-resourced',
  ok: '',
};

// ─── Alert Badge Styles ───────────────────────────────────────────────────────

export const ALERT_BADGE_STYLES = {
  critical: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: 'text-amber-500',
  },
  info: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    icon: 'text-blue-500',
  },
};

// ─── Department Colors ────────────────────────────────────────────────────────

export interface DepartmentStyle {
  bg: string;
  text: string;
  border: string;
}

export const DEPARTMENT_COLORS: Record<string, DepartmentStyle> = {
  'Engineering': { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-200' },
  'Product': { bg: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-200' },
  'Design': { bg: 'bg-pink-500', text: 'text-pink-700', border: 'border-pink-200' },
  'Marketing': { bg: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-200' },
  'Sales': { bg: 'bg-green-500', text: 'text-green-700', border: 'border-green-200' },
  'Operations': { bg: 'bg-teal-500', text: 'text-teal-700', border: 'border-teal-200' },
  'Finance': { bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-200' },
  'HR': { bg: 'bg-red-500', text: 'text-red-700', border: 'border-red-200' },
  'People': { bg: 'bg-rose-500', text: 'text-rose-700', border: 'border-rose-200' },
  'Legal': { bg: 'bg-gray-500', text: 'text-gray-700', border: 'border-gray-200' },
  'Customer Success': { bg: 'bg-cyan-500', text: 'text-cyan-700', border: 'border-cyan-200' },
};

const DEFAULT_DEPARTMENT_STYLE: DepartmentStyle = {
  bg: 'bg-slate-500',
  text: 'text-slate-700',
  border: 'border-slate-200',
};

export const getDepartmentStyle = (department: string): DepartmentStyle => {
  return DEPARTMENT_COLORS[department] || DEFAULT_DEPARTMENT_STYLE;
};

export const getDepartmentBgColor = (department: string): string => {
  return DEPARTMENT_COLORS[department]?.bg || 'bg-slate-500';
};

// ─── Project Status Colors ────────────────────────────────────────────────────

export const PROJECT_STATUS_STYLES: Record<string, string> = {
  'To Do': 'bg-slate-100 text-slate-600',
  'Doing': 'bg-blue-100 text-blue-700',
  'Done': 'bg-emerald-100 text-emerald-700',
};

// ─── Color Palettes ───────────────────────────────────────────────────────────

export const OBJECTIVE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
];

export const GRADIENT_COLORS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-emerald-600',
  'from-indigo-500 to-indigo-600',
  'from-teal-500 to-teal-600',
  'from-purple-500 to-purple-600',
  'from-pink-500 to-pink-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
];

export const AVATAR_GRADIENT_COLORS = [
  'from-blue-400 to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-purple-400 to-purple-600',
  'from-pink-400 to-pink-600',
  'from-amber-400 to-amber-600',
  'from-teal-400 to-teal-600',
  'from-indigo-400 to-indigo-600',
  'from-rose-400 to-rose-600',
];

// ─── Timeline Colors (for Objective grouping) ─────────────────────────────────

export const TIMELINE_OBJECTIVE_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-green-500',
  'bg-rose-500',
];

export const TIMELINE_OBJECTIVE_HEX = [
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#14b8a6', // teal-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#22c55e', // green-500
  '#f43f5e', // rose-500
];

// ─── Avatar Helpers ──────────────────────────────────────────────────────────

export const getAvatarColor = (_name: string): string =>
  'from-purple-400 to-purple-600';

export const getInitials = (name: string): string =>
  name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
