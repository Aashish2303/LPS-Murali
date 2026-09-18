import React from 'react';
import { Settings, ChevronDown, Menu, ArrowLeft } from 'lucide-react';
import { NavItemKey, ProjectConfig, UserSession } from '../types';

interface HeaderProps {
  currentNav: NavItemKey;
  currentWeek: string;
  config: ProjectConfig;
  availableWeeks?: string[];
  onSelectWeek?: (week: string) => void;
  user?: UserSession | null;
  onNavigate?: (key: NavItemKey) => void;
  onLogout?: () => void;
  onBackToProjects?: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentNav,
  currentWeek,
  config,
  availableWeeks = [],
  onSelectWeek,
  onNavigate,
  onToggleMobileMenu,
  onBackToProjects
}) => {
  const getNavMeta = (nav: NavItemKey): { title: string; subtitle: string } => {
    switch (nav) {
      case 'dashboard':
        return {
          title: 'Project Dashboard',
          subtitle: `${config.projectName || config.project_name || 'Chittor Site'} — Block B`
        };
      case 'plan-phase':
        return {
          title: 'Phase Schedule',
          subtitle: 'Milestone pull timeline, responsible leads, and float analysis'
        };
      case 'plan-pull':
        return {
          title: 'Pull Planning Board',
          subtitle: 'Sticky cards, constraint logging, and handoff sequencing'
        };
      case 'plan-lookahead':
        return {
          title: 'Lookahead Planning',
          subtitle: '3–6 Wk make-ready filtration Kanban & constraint clearing'
        };
      case 'week-commit':
      case 'weekly-commit':
        return {
          title: 'Weekly Commitments',
          subtitle: 'Lock in promises for 100% constraint-free tasks'
        };
      case 'week-daily':
      case 'weekly-checkin':
        return {
          title: 'Daily Stand-up Check-in',
          subtitle: 'Track daily planned vs achieved quantities & variances'
        };
      case 'week-closeout':
      case 'weekly-closeout':
        return {
          title: 'Weekly Closeout Ceremony',
          subtitle: 'Binary PPC calculation & mandatory 15 reason code logging'
        };
      case 'metrics-this-week':
      case 'metrics-week':
        return {
          title: 'This Week Metrics',
          subtitle: 'PPC, TA, TMR, and CRR operational performance gauges'
        };
      case 'metrics-trends':
        return {
          title: 'PPC Trends & History',
          subtitle: 'Multi-week commitment reliability tracking and root-cause Pareto'
        };
      case 'metrics-coaching':
        return {
          title: 'Lean Coaching Insight',
          subtitle: 'Systemic diagnostic recommendations & intervention playbooks'
        };
      case 'learn-centre':
        return {
          title: 'Lean Academy',
          subtitle: '10 interactive Last Planner curriculum modules & quizzes'
        };
      case 'learn-guides':
      case 'learn-facilitator':
        return {
          title: 'Facilitator Guides',
          subtitle: 'Agendas, timing, and facilitation scripts for 4 LPS ceremonies'
        };
      case 'setup-config':
        return {
          title: 'Project Configuration',
          subtitle: 'Project metadata, leads, and Lean Champions'
        };
      case 'setup-trades':
        return {
          title: 'Trades & Work Areas',
          subtitle: 'Subcontractor trade directory and site zone allocations'
        };
      case 'setup-init':
        return {
          title: 'System Initialisation',
          subtitle: 'Seed benchmark datasets, export/import JSON backups'
        };
      default:
        return {
          title: 'LPS Planning Tool',
          subtitle: config.projectName || config.project_name || 'Lean Construction'
        };
    }
  };

  const meta = getNavMeta(currentNav);
  const projectName = config.projectName || config.project_name || 'Chittor Site — Block B';

  const formatWeekLabel = (weekKey: string, index: number) => {
    const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return weekKey;

    return `Week ${index + 1}`;
  };

  const uniqueWeeks = React.useMemo(() => {
    const list = availableWeeks.filter((w): w is string => typeof w === 'string' && w.trim().length > 0);
    return Array.from(new Set(list));
  }, [availableWeeks]);

  return (
    <header
      id="app-header"
      className="min-h-16 border-b border-slate-700 bg-slate-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6 md:px-8 shrink-0 select-none z-20"
    >
      {/* Left: Hamburger button (Mobile) + Section Title & Subtitle */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {onToggleMobileMenu && (
          <button
            id="btn-hamburger-menu"
            onClick={onToggleMobileMenu}
            aria-label="Open menu"
            className="md:hidden p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 shadow-sm active:scale-95"
          >
            <Menu className="w-5 h-5 text-amber-500" />
          </button>
        )}

        <div className="min-w-0 max-w-[calc(100vw-120px)] sm:max-w-none">
          <h2 className="text-base sm:text-lg font-semibold text-slate-100 truncate">{meta.title}</h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold truncate max-w-[200px] sm:max-w-[320px] md:max-w-[450px]">
            {meta.subtitle.length > 40 ? projectName : meta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Week Selector, Divider, Settings */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
        {onBackToProjects && (
          <button
            id="btn-back-to-projects"
            onClick={onBackToProjects}
            title="Back to Projects"
            aria-label="Back to Projects"
            className="flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-xs font-semibold text-slate-300 hover:border-amber-500 hover:text-amber-500 transition-colors cursor-pointer sm:px-2.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Projects</span>
          </button>
        )}

        {/* Week Selector Dropdown Pill */}
        {onSelectWeek && uniqueWeeks.length > 0 ? (
          <div className="relative flex items-center">
            <select
              id="header-week-select"
              value={currentWeek}
              onChange={(e) => onSelectWeek(e.target.value)}
              className="appearance-none bg-slate-800 border border-slate-700 rounded-full px-2.5 py-1.5 pr-7 text-xs font-mono text-slate-300 font-semibold cursor-pointer hover:border-slate-600 focus:outline-none focus:border-amber-500 transition-colors shadow-sm min-h-[36px] sm:px-4 sm:pr-8"
            >
              {uniqueWeeks.map((wk, idx) => (
                <option key={`week-opt-${wk}-${idx}`} value={wk} className="bg-slate-900 text-slate-200">
                  {formatWeekLabel(wk, idx)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 sm:right-3 pointer-events-none" />
          </div>
        ) : (
          <div
            id="header-week-badge"
            className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-mono text-slate-300 shadow-sm"
          >
            Week {uniqueWeeks.indexOf(currentWeek) + 1}
          </div>
        )}

        <div className="h-6 sm:h-8 w-[1px] bg-slate-700 mx-0.5 sm:mx-1 hidden sm:block"></div>

        {/* Quick Settings Shortcut */}
        <button
          id="btn-header-settings"
          onClick={() => onNavigate && onNavigate('setup-config')}
          title="Project Settings"
          aria-label="Project Settings"
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

