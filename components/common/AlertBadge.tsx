/**
 * AlertBadge Component
 * Displays a badge with an alert icon and count for critical/warning states
 */

import React from 'react';
import { ALERT_BADGE_STYLES } from '../../utils/constants';

interface AlertBadgeProps {
  /** Number of alerts to display */
  count: number;
  /** Alert severity level */
  severity: 'critical' | 'warning' | 'info';
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Alert badge showing count with warning icon
 * Styled red for critical, amber for warnings, blue for info
 */
export const AlertBadge: React.FC<AlertBadgeProps> = ({
  count,
  severity,
  className = '',
}) => {
  if (count === 0) return null;

  const style = ALERT_BADGE_STYLES[severity];

  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0 ${style.bg} ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-3 w-3 ${style.icon}`}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <span className={`text-[10px] font-bold ${style.text}`}>{count}</span>
    </div>
  );
};

export default AlertBadge;
