import React, { useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  TrendingUp,
  GraduationCap,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  X,
  GitBranch,
  Layers,
  Clock,
  CheckCircle2,
  CalendarCheck,
  Award,
  Sparkles,
  BookOpen,
  FolderCog,
  HardHat,
  SlidersHorizontal,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { NavItemKey, UserSession } from '../types';

interface SidebarProps {
  activeNav: NavItemKey;
  onNavigate: (key: NavItemKey) => void;
  openConstraintsCount?: number;
  user?: UserSession | null;
  onLogout?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

interface NavGroup {
  id: string;
  label: string;
  icon: string | React.ReactNode;
  children?: { key: NavItemKey; label: string; icon: string | React.ReactNode; badge?: number }[];
  directKey?: NavItemKey;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onNavigate,
  openConstraintsCount = 0,
  user,
  onLogout,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    plan: true,
    weekly: true,
    metrics: true,
    learn: true,
    setup: true
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleNavClick = (key: NavItemKey) => {
    onNavigate(key);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navStructure: NavGroup[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      directKey: 'dashboard'
    },
    {
      id: 'plan',
      label: 'Planning',
      icon: '📅',
      children: [
        { key: 'plan-phase', label: 'Phase Schedule', icon: '📅' },
        {
          key: 'plan-lookahead',
          label: 'Lookahead',
          icon: '🔭',
          badge: openConstraintsCount > 0 ? openConstraintsCount : undefined
        }
      ]
    },
    {
      id: 'weekly',
      label: 'Weekly Cycle',
      icon: '🤝',
      children: [
        { key: 'week-commit', label: 'Make Commitments', icon: '🤝' },
        { key: 'week-daily', label: 'Daily Check-in', icon: '✅' },
        { key: 'week-closeout', label: 'Close Out Week', icon: '🏆' }
      ]
    },
    {
      id: 'metrics',
      label: 'Metrics & Analysis',
      icon: '📈',
      children: [
        { key: 'metrics-this-week', label: 'This Week', icon: '✨' },
        { key: 'metrics-trends', label: 'Trends & PPC', icon: '📊' },
        { key: 'metrics-coaching', label: 'Coaching Insight', icon: '💡' }
      ]
    },
    {
      id: 'learn',
      label: 'Lean Academy',
      icon: '🎓',
      children: [
        { key: 'learn-centre', label: 'Learning Centre', icon: '📖' },
        { key: 'learn-guides', label: 'Facilitator Guides', icon: '👷' }
      ]
    },
    {
      id: 'setup',
      label: 'Project Setup',
      icon: '⚙️',
      children: [
        { key: 'setup-config', label: 'Configuration', icon: '📁' },
        { key: 'setup-trades', label: 'Trades & Areas', icon: '🛠️' },
        { key: 'setup-init', label: 'Initialise Data', icon: '🔄' }
      ]
    }
  ];

  // User initials & display name
  const userName = user?.name || 'R. Krishnan';
  const userRole = user?.role || 'Project Manager';
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'RK';

  return (
    <aside
      id="app-sidebar"
      className={`fixed inset-y-0 left-0 z-50 w-64 md:w-56 flex-shrink-0 flex flex-col border-r border-slate-700 bg-slate-900 h-full select-none transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
        isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}
    >
      {/* Brand Header & Mobile Close Button */}
      <div className="p-4 sm:p-5 md:p-6 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="text-2xl select-none">🏗️</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-amber-500">LPS Tool</h1>
            <span className="text-[9px] text-slate-400 tracking-wider font-semibold uppercase block md:hidden">
              Lean Big Room
            </span>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          id="btn-close-sidebar-mobile"
          onClick={onCloseMobile}
          aria-label="Close navigation sidebar"
          className="md:hidden p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        {navStructure.map((group) => {
          if (group.directKey) {
            const isActive = activeNav === group.directKey;
            return (
              <button
                key={group.id}
                id={`nav-item-${group.directKey}`}
                onClick={() => handleNavClick(group.directKey!)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-lg text-sm transition-colors cursor-pointer min-h-[44px] md:min-h-[36px] ${
                  isActive
                    ? 'bg-slate-800 text-amber-500 font-semibold border-l-4 border-amber-500 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="w-5 text-center text-base">{group.icon}</span>
                <span className="truncate">{group.label}</span>
              </button>
            );
          }

          const isOpen = !!openGroups[group.id];
          const hasActiveChild = group.children?.some((c) => c.key === activeNav);

          return (
            <div key={group.id} className="space-y-0.5">
              {/* Group Section Header */}
              <div
                onClick={() => toggleGroup(group.id)}
                className="pt-3 md:pt-4 pb-1 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between cursor-pointer hover:text-slate-400 transition-colors select-none min-h-[36px]"
              >
                <span>{group.label}</span>
                <span className="text-slate-600 text-xs">
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </span>
              </div>

              {isOpen && group.children && (
                <div className="space-y-1">
                  {group.children.map((child) => {
                    const isActive = activeNav === child.key;
                    return (
                      <button
                        key={child.key}
                        id={`nav-item-${child.key}`}
                        onClick={() => handleNavClick(child.key)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 md:py-2 rounded-lg text-sm transition-colors cursor-pointer min-h-[44px] md:min-h-[36px] ${
                          isActive
                            ? 'bg-slate-800 text-amber-500 font-semibold border-l-4 border-amber-500 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <span className="w-5 text-center text-base shrink-0">{child.icon}</span>
                          <span className="truncate">{child.label}</span>
                        </div>
                        {child.badge !== undefined && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold font-mono rounded-full bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                            {child.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Session Footer */}
      <div className="p-4 border-t border-slate-700 bg-slate-900">
        <div className="flex items-center gap-3 mb-2 px-2">
          <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-bold text-xs shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-200 truncate">{userName}</p>
            <p className="text-[10px] text-slate-400 truncate">{userRole}</p>
          </div>
        </div>
        {onLogout && (
          <button
            id="btn-logout"
            onClick={onLogout}
            className="w-full text-left px-2 py-2 text-xs text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors flex items-center gap-2 cursor-pointer min-h-[38px]"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
};
