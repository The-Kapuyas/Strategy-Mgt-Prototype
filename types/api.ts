/**
 * API-related types and interfaces
 */

export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: JSONSchema;
  description?: string;
}

export interface AIResponse<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
}

export interface ResourceItem {
  label: string;
  value: string;
}

export interface DepartmentalProjectItem {
  department: string;
  title: string;
}

// API Error types
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

