import React from 'react';
import ProfileMenu from './ProfileMenu';
import { APP_CONFIG } from '../../constants';

export type TopLevelPage = 'blueprint' | 'checkin-prep' | 'settings';

interface TopNavProps {
  activePage: TopLevelPage;
  onNavigate: (page: TopLevelPage) => void;
}

const AppLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="#4f46e5" strokeWidth="2" />
    <path d="M12 8V12L15 15" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const NAV_ITEMS: { key: TopLevelPage; label: string }[] = [
  { key: 'blueprint', label: 'Strategy Blueprint' },
  { key: 'checkin-prep', label: 'Check-in Prep' },
];

const TopNav: React.FC<TopNavProps> = ({ activePage, onNavigate }) => {
  return (
    <nav className="w-full bg-white border-b border-slate-200 px-6 flex items-center justify-between h-14 sticky top-0 z-50">
      {/* Left: Logo */}
      <div className="flex items-center gap-2">
        <AppLogo />
        <span className="text-lg font-bold text-slate-900">{APP_CONFIG.APP_TITLE}</span>
      </div>

      {/* Right: Nav Items + Settings gear + Profile */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer
                ${activePage === key
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-slate-200" />
        <button
          onClick={() => onNavigate('settings')}
          className={`
            h-9 w-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer
            ${activePage === 'settings'
              ? 'bg-slate-100 text-slate-700'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }
          `}
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>
        <ProfileMenu onNavigateToProfile={() => onNavigate('settings')} />
      </div>
    </nav>
  );
};

export default TopNav;
