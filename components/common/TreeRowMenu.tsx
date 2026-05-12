import React, { useState, useRef, useEffect } from 'react';

export interface MenuAction {
  label: string;
  icon: 'edit' | 'add' | 'delete';
  onClick: () => void;
  destructive?: boolean;
}

interface TreeRowMenuProps {
  actions: MenuAction[];
}

interface DeleteConfirmPopoverProps {
  itemLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ActionMenuDropdownProps {
  actions: MenuAction[];
  onClose: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

const AddIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const iconMap = { edit: EditIcon, add: AddIcon, delete: DeleteIcon };

export const ActionMenuDropdown: React.FC<ActionMenuDropdownProps> = ({ actions, onClose, style, className }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} style={style} className={`w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 ${className || ''}`} onClick={(e) => e.stopPropagation()}>
      {actions.map((action, i) => {
        const Icon = iconMap[action.icon];
        return (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); action.onClick(); onClose(); }}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${action.destructive ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            <Icon />
            {action.label}
          </button>
        );
      })}
    </div>
  );
};

export const TreeRowMenu: React.FC<TreeRowMenuProps> = ({ actions }) => {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuPos) {
      setMenuPos(null);
    } else {
      const rect = buttonRef.current!.getBoundingClientRect();
      setMenuPos({ x: rect.right - 192, y: rect.bottom + 4 });
    }
  };

  useEffect(() => {
    if (!menuPos) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuPos(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuPos(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuPos]);

  return (
    <div className="relative flex-shrink-0" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all"
        title="Actions"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      </button>

      {menuPos && (
        <ActionMenuDropdown
          actions={actions}
          onClose={() => setMenuPos(null)}
          style={{ position: 'fixed', top: menuPos.y, left: menuPos.x }}
        />
      )}
    </div>
  );
};

export const DeleteConfirmPopover: React.FC<DeleteConfirmPopoverProps> = ({ itemLabel, onConfirm, onCancel }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (ref.current?.parentElement) {
      const rect = ref.current.parentElement.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - 224 });
    }
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onCancel]);

  return (
    <div ref={ref} style={pos ? { position: 'fixed', top: pos.top, left: pos.left } : undefined} className={`${pos ? '' : 'absolute right-0 top-full mt-1 '}w-56 bg-white rounded-lg shadow-lg border border-red-200 p-3 z-50`} onClick={(e) => e.stopPropagation()}>
      <p className="text-sm text-slate-700 mb-3">Delete {itemLabel}?</p>
      <div className="flex gap-2 justify-end">
        <button onClick={(e) => { e.stopPropagation(); onCancel(); }} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded">
          Cancel
        </button>
        <button onClick={(e) => { e.stopPropagation(); onConfirm(); }} className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded">
          Delete
        </button>
      </div>
    </div>
  );
};
