import React, { useState, useRef, useEffect } from 'react';

interface ProfileMenuProps {
  onNavigateToProfile?: () => void;
}

const ProfileMenu: React.FC<ProfileMenuProps> = ({ onNavigateToProfile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-semibold text-sm flex items-center justify-center hover:shadow-md hover:scale-105 transition-all cursor-pointer"
        title="Account menu"
      >
        A
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50" onClick={(e) => e.stopPropagation()}>
          {/* User identity */}
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Admin</p>
            <p className="text-sm text-slate-500 mt-0.5 truncate">admin@company.com</p>
          </div>

          <div className="h-px bg-slate-100 mx-2" />

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={() => { setIsOpen(false); onNavigateToProfile?.(); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Your profile
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Terms & policies
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Help
            </button>
          </div>

          <div className="h-px bg-slate-100 mx-2" />

          <div className="py-1">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
