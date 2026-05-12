/**
 * useToggleSet Hook
 * A reusable hook for managing a Set of IDs with toggle functionality
 */

import { useState, useCallback } from 'react';

interface UseToggleSetReturn {
  /** The current set of IDs */
  items: Set<string>;
  /** Toggle an ID in/out of the set */
  toggle: (id: string) => void;
  /** Check if an ID is in the set */
  has: (id: string) => boolean;
  /** Add an ID to the set */
  add: (id: string) => void;
  /** Remove an ID from the set */
  remove: (id: string) => void;
  /** Clear all IDs from the set */
  clear: () => void;
  /** Add multiple IDs to the set */
  addAll: (ids: string[]) => void;
}

/**
 * Hook for managing a toggleable set of string IDs
 * Useful for tracking expanded/collapsed state of multiple items
 *
 * @param initialIds - Optional array of initial IDs to include in the set
 * @returns Object with the set and manipulation functions
 *
 * @example
 * const { items: expandedItems, toggle, has } = useToggleSet();
 *
 * // Toggle an item
 * toggle('item-1');
 *
 * // Check if expanded
 * const isExpanded = has('item-1');
 */
export const useToggleSet = (initialIds: string[] = []): UseToggleSetReturn => {
  const [items, setItems] = useState<Set<string>>(() => new Set(initialIds));

  const toggle = useCallback((id: string) => {
    setItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const has = useCallback((id: string) => items.has(id), [items]);

  const add = useCallback((id: string) => {
    setItems(prev => {
      if (prev.has(id)) return prev;
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems(prev => {
      if (!prev.has(id)) return prev;
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  const clear = useCallback(() => {
    setItems(new Set());
  }, []);

  const addAll = useCallback((ids: string[]) => {
    setItems(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => newSet.add(id));
      return newSet;
    });
  }, []);

  return { items, toggle, has, add, remove, clear, addAll };
};

export default useToggleSet;
