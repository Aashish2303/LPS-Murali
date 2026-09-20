import React, { useState, useEffect, useMemo } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation
} from 'react-router-dom';
import {
  LPSData,
  NavItemKey,
  UserSession,
  Task,
  Constraint,
  LookaheadItem,
  Commitment,
  ActualEntry,
  ProjectConfig,
  TradeItem,
  Phase,
  ProjectRecord
} from './types';
import {
  loadLPSData,
  saveLPSData,
  resetToSampleData,
  computeMetrics,
  generateId,
  getOpenConstraintCount,
  refreshLookaheadReadiness,
  exportDataAsJSON,
  exportDataAsSpreadsheet,
  importDataFromJSON,
  getOpenConstraintsCountTotal,
  getSessionUser,
  loadProjects,
  saveProjects,
  setSessionUser,
  clearSessionUser,
  syncProjectsFromServer,
  syncProjectData
} from './services/storage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginView } from './components/LoginView';
import { Toast } from './components/Toast';

// Views
import { DashboardView } from './components/views/DashboardView';
import { PhaseScheduleView } from './components/views/PhaseScheduleView';
import { LookaheadView } from './components/views/LookaheadView';
import { MakeCommitmentsView } from './components/views/MakeCommitmentsView';
import { DailyCheckInView } from './components/views/DailyCheckInView';
import { CloseOutWeekView } from './components/views/CloseOutWeekView';
import { ThisWeekMetricsView } from './components/views/ThisWeekMetricsView';
import { TrendsView } from './components/views/TrendsView';
import { CoachingView } from './components/views/CoachingView';
import { LearningCentreView } from './components/views/LearningCentreView';
import { FacilitatorGuidesView } from './components/views/FacilitatorGuidesView';
import { ProjectConfigView } from './components/views/ProjectConfigView';
import { TradesAreasView } from './components/views/TradesAreasView';
import { InitializeSystemView } from './components/views/InitializeSystemView';
import { WeeklyWorkPlanView } from './components/views/WeeklyWorkPlanView';
import { ProjectDashboard } from './components/ProjectDashboard';

type ProjectRecordPayload = ProjectRecord & {
  project_code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

const createUserSession = (email: string): UserSession => ({
  id: email,
  name: email.split('@')[0].replace(/[._-]+/g, ' '),
  email,
  role: 'Project Manager'
});

const normalizeProjectRecord = (project: ProjectRecordPayload): ProjectRecord => ({
  ...project,
  projectCode: project.projectCode ?? project.project_code ?? '',
  startDate: project.startDate ?? project.start_date ?? '',
  endDate: project.endDate ?? project.end_date ?? '',
  description: project.description ?? '',
  data: project.data ?? loadLPSData()
});

function AppContent() {
  // 1. User Session state
  const [user, setUser] = useState<UserSession | null>(() => {
    const email = getSessionUser();
    return email ? createUserSession(email) : null;
  });

  // 2. Main LPS Dataset state
  const [data, setData] = useState<LPSData>(() => loadLPSData());
  const [projects, setProjects] = useState<ProjectRecord[]>(() =>
    loadProjects().map(normalizeProjectRecord)
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
  if (!user) return;

  let isActive = true;

  const loadRemoteProjects = async () => {
    const remoteProjects = await syncProjectsFromServer();

    if (!isActive || !remoteProjects) {
      return;
    }

    const normalizedProjects =
      remoteProjects.map(normalizeProjectRecord);

    setProjects(normalizedProjects);

    if (!selectedProjectId) {
      return;
    }

    const fullProject = await syncProjectData(
      selectedProjectId
    );

    if (!isActive || !fullProject) {
      return;
    }

    const normalizedFullProject =
      normalizeProjectRecord(fullProject);

    setData(normalizedFullProject.data);
    saveLPSData(normalizedFullProject.data);

    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === normalizedFullProject.id
          ? normalizedFullProject
          : project
      )
    );
  };

  void loadRemoteProjects();

  return () => {
    isActive = false;
  };
}, [user, selectedProjectId]);

  // 3. Navigation & Mobile Drawer state
  const [activeNav, setActiveNav] = useState<NavItemKey>(() => {
    const pathToNav: Record<string, NavItemKey> = {
      '/dashboard': 'dashboard',
      '/plan/phase': 'plan-phase',
      '/plan/lookahead': 'plan-lookahead',
      '/week/commit': 'week-commit',
      '/week/work-plan': 'weekly-work-plan',
      '/week/daily': 'week-daily',
      '/week/closeout': 'week-closeout',
      '/metrics/this-week': 'metrics-this-week',
      '/metrics/trends': 'metrics-trends',
      '/metrics/coaching': 'metrics-coaching',
      '/learn/centre': 'learn-centre',
      '/learn/guides': 'learn-guides',
      '/setup/config': 'setup-config',
      '/setup/trades': 'setup-trades',
      '/setup/init': 'setup-init'
    };

    return pathToNav[window.location.pathname] ?? 'dashboard';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const navigate = useNavigate();
  const location = useLocation();

  const navToPath: Record<NavItemKey, string> = {
    dashboard: '/dashboard',
    'plan-phase': '/plan/phase',
    'plan-pull': '/plan/pull',
    'plan-lookahead': '/plan/lookahead',
    'week-commit': '/week/commit',
    'weekly-work-plan': '/week/work-plan',
    'week-daily': '/week/daily',
    'week-closeout': '/week/closeout',
    'metrics-this-week': '/metrics/this-week',
    'metrics-trends': '/metrics/trends',
    'metrics-coaching': '/metrics/coaching',
    'learn-centre': '/learn/centre',
    'learn-guides': '/learn/guides',
    'setup-config': '/setup/config',
    'setup-trades': '/setup/trades',
    'setup-init': '/setup/init',
    'weekly-commit': '/week/commit',
    'weekly-checkin': '/week/daily',
    'weekly-closeout': '/week/closeout',
    'metrics-week': '/metrics/this-week',
    'learn-facilitator': '/learn/guides'
  };

  const navigateToNav = (nav: NavItemKey) => {
    setActiveNav(nav);
    navigate(navToPath[nav]);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const pathToNav: Record<string, NavItemKey> = {
      '/dashboard': 'dashboard',
      '/plan/phase': 'plan-phase',
      '/plan/lookahead': 'plan-lookahead',
      '/week/commit': 'week-commit',
      '/week/work-plan': 'weekly-work-plan',
      '/week/daily': 'week-daily',
      '/week/closeout': 'week-closeout',
      '/metrics/this-week': 'metrics-this-week',
      '/metrics/trends': 'metrics-trends',
      '/metrics/coaching': 'metrics-coaching',
      '/learn/centre': 'learn-centre',
      '/learn/guides': 'learn-guides',
      '/setup/config': 'setup-config',
      '/setup/trades': 'setup-trades',
      '/setup/init': 'setup-init'
    };

    const nav = pathToNav[location.pathname];

    if (nav && nav !== activeNav) {
      setActiveNav(nav);
    }
  }, [location.pathname, activeNav]);

  // 4. Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // Sync data to localStorage on changes
  const updateData = async (newData: LPSData) => {
    setData(newData);
    saveLPSData(newData);

    if (!selectedProjectId) {
      return;
    }

    const updatedProjects = projects.map((project) =>
      project.id === selectedProjectId
        ? {
            ...project,
            data: newData
          }
        : project
    );

    setProjects(updatedProjects);

    const saved = await saveProjects(updatedProjects);

    if (!saved) {
      showToast(
        'Failed to save changes to server',
        'error'
      );
      return;
    }

    showToast(
      'Changes saved successfully',
      'success'
    );
  };

  const handleLogin = (email: string) => {
    const newUser = createUserSession(email);
    setSessionUser(email);
    setUser(newUser);
    setSelectedProjectId(null);
    showToast(`Welcome back, ${newUser.name}!`, 'success');
  };

  const handleLogout = () => {
    setUser(null);
    clearSessionUser();
    setSelectedProjectId(null);
    showToast('Logged out of LPS session', 'info');
  };

  const handleBackToProjects = () => {
    setSelectedProjectId(null);
    setActiveNav('dashboard');
    setIsMobileMenuOpen(false);
  };

  const currentWeek = data.config.current_week_key ?? '2026-W35';

  const getISOWeekKey = (date: Date): string => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay() || 7;

    d.setDate(d.getDate() + 4 - day);

    const year = d.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const weekNo = Math.ceil(
      (((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7
    );

    return `${year}-W${String(weekNo).padStart(2, '0')}`;
  };

  const getWeekStart = (weekKey: string): Date | null => {
    const match = weekKey.match(/^(\d{4})-W(\d{2})$/);

    if (!match) return null;

    const year = Number(match[1]);
    const week = Number(match[2]);
    const jan4 = new Date(year, 0, 4);
    const day = jan4.getDay() || 7;
    const monday = new Date(jan4);

    monday.setDate(jan4.getDate() - day + 1 + (week - 1) * 7);
    monday.setHours(0, 0, 0, 0);

    // The first project week begins on the actual project start date, not on
    // the Monday of the ISO label. Subsequent labels remain seven-day cycles.
    const projectStart = data.config.startDate || data.config.start_date;
    if (projectStart) {
      const start = new Date(`${projectStart}T00:00:00`);
      const firstMonday = new Date(start);
      const firstDay = firstMonday.getDay() || 7;
      firstMonday.setDate(firstMonday.getDate() - firstDay + 1);
      const offsetWeeks = Math.round((monday.getTime() - firstMonday.getTime()) / 604800000);
      start.setDate(start.getDate() + offsetWeeks * 7);
      return start;
    }

    return monday;
  };

  const getWeekKeysBetween = (startDate: Date, endDate: Date): string[] => {
    const weeks: string[] = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const startDay = cursor.getDay() || 7;

    cursor.setDate(cursor.getDate() - startDay + 1);

    while (cursor <= endDate) {
      weeks.push(getISOWeekKey(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }

    return weeks;
  };

  // Compute live metrics for the current week
  const metrics = computeMetrics(currentWeek, data);

  // Compute total open constraints
  const openConstraintsCount = useMemo(() => getOpenConstraintsCountTotal(data.constraints), [data.constraints]);

  // Current available weeks list for the header dropdown
  const availableWeeks = useMemo(() => {
    const taskDates = data.tasks
      .filter((task) => task.eps || task.epf || task.must_finish_by)
      .flatMap((task) => [
        task.eps
          ? new Date(task.eps)
          : task.must_finish_by
            ? new Date(task.must_finish_by)
            : null,
        task.epf
          ? new Date(task.epf)
          : task.must_finish_by
            ? new Date(task.must_finish_by)
            : null
      ])
      .filter((date): date is Date => !!date && !isNaN(date.getTime()));

    if (taskDates.length === 0) {
      return [data.config.current_week_key ?? '2026-W35'];
    }

    const earliest = new Date(Math.min(...taskDates.map((date) => date.getTime())));
    const latest = new Date(Math.max(...taskDates.map((date) => date.getTime())));
    const scheduleWeeks = getWeekKeysBetween(earliest, latest);
    const existingWeeks = [
      ...data.metrics.map((metric) => metric.week_key),
      ...data.lookahead.map((item) => item.week_key),
      ...data.commitments.map((commitment) => commitment.week_key)
    ];

    return Array.from(new Set([...scheduleWeeks, ...existingWeeks])).sort();
  }, [
    data.tasks,
    data.metrics,
    data.lookahead,
    data.commitments,
    data.config.current_week_key
  ]);

  // Week change handler
  const handleSelectWeek = (week: string) => {
    const updated = {
      ...data,
      config: {
        ...data.config,
        current_week_key: week
      }
    };
    updateData(updated);
    showToast(`Switched active workspace to ${week}`, 'info');
  };

  // Milestone Actions
  const handleAddPhase = (phase: Phase) => {
    const updated = { ...data, phases: [...data.phases, phase] };
    updateData(updated);
    showToast(`Milestone '${phase.phase_name}' added`, 'success');
  };

  const handleUpdatePhaseStatus = (phaseId: string, status: Phase['status']) => {
    const updated = {
      ...data,
      phases: data.phases.map((phase) => (phase.id === phaseId ? { ...phase, status } : phase))
    };
    updateData(updated);
  };

  const handleImportTasks = (importedTasks: Task[]) => {
    const importedById = new Map(
      importedTasks.map((task) => [task.id, task])
    );

    const updatedTasks = data.tasks.map(
      (existingTask) =>
        importedById.get(existingTask.id) ?? existingTask
    );

    const existingIds = new Set(
      data.tasks.map((task) => task.id)
    );

    const newTasks = importedTasks.filter(
      (task) => !existingIds.has(task.id)
    );

    const finalTasks = [...updatedTasks, ...newTasks];
    const taskDates = finalTasks
      .filter((task) => task.eps || task.epf || task.must_finish_by)
      .flatMap((task) => [
        task.eps
          ? new Date(task.eps)
          : task.must_finish_by
            ? new Date(task.must_finish_by)
            : null,
        task.epf
          ? new Date(task.epf)
          : task.must_finish_by
            ? new Date(task.must_finish_by)
            : null
      ])
      .filter((date): date is Date => !!date && !isNaN(date.getTime()));

    const configuredStart = data.config.startDate || data.config.start_date;
    let firstWeek = configuredStart
      ? getISOWeekKey(new Date(`${configuredStart}T00:00:00`))
      : data.config.current_week_key ?? '2026-W35';

    if (!configuredStart && taskDates.length > 0) {
      const earliest = new Date(Math.min(...taskDates.map((date) => date.getTime())));
      firstWeek = getISOWeekKey(earliest);
    }

    const updatedData = {
      ...data,
      tasks: finalTasks,
      config: {
        ...data.config,
        current_week_key: firstWeek
      }
    };

    updateData(updatedData);

    showToast(
      `Schedule imported. The active cycle starts at ${firstWeek}.`,
      'success'
    );
  };

  // Task Actions
  const handleAddTask = (t: Task) => {
    const updated = { ...data, tasks: [...data.tasks, t] };
    updateData(updated);
    showToast(`Task '${t.description}' created`, 'success');
  };
  const handleDeleteTask = (id: string) => {
    const updated = {
      ...data,
      tasks: data.tasks.filter((t) => t.id !== id),
      lookahead: data.lookahead.filter((l) => l.task_id !== id),
      commitments: data.commitments.filter((c) => c.task_id !== id),
      constraints: data.constraints.filter((cn) => cn.task_id !== id)
    };
    updateData(updated);
    showToast('Task removed from all boards', 'info');
  };

  const handleTogglePullPlanTask = (taskId: string) => {
    const task = data.tasks.find((t) => t.id === taskId);

    if (!task) return;

    const newPullPlanned = !(task.pull_planned ?? false);

    const updatedTasks = data.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            pull_planned: newPullPlanned,
            lookahead_planned: newPullPlanned,
          }
        : t
    );

    let updatedLookahead = [...data.lookahead];

    if (newPullPlanned) {
      // Pull Planning is ONLY for the currently selected week.
      const existingItem = updatedLookahead.find(
        (item) =>
          item.task_id === taskId &&
          item.week_key === data.config.current_week_key
      );

      if (!existingItem) {
        const totalQuantity = Number(task.total_quantity) || 0;
        const durationDays = Number(task.duration_days) || 1;

        const dailyQuantity =
          Number(task.daily_planned_quantity) ||
          totalQuantity / durationDays;

        const weekKey = data.config.current_week_key;

        const plannedQty =
          Math.round(
            dailyQuantity * Math.min(durationDays, 7) * 100
          ) / 100;

        const openConstraints = getOpenConstraintCount(
          taskId,
          data.constraints
        );

        const newLookaheadItem: LookaheadItem = {
          id: generateId('LKH'),
          task_id: taskId,
          phase_id: task.phase_id ?? null,
          constraint_ids: [],
          week_key: weekKey,
          planned_qty: plannedQty,
          carry_forward_qty: 0,
          remaining_qty: plannedQty,
          ready: openConstraints === 0,
          notes: ''
        };

        updatedLookahead.push(newLookaheadItem);
      }
    } else {
      updatedLookahead = updatedLookahead.filter(
        (item) =>
          !(
            item.task_id === taskId &&
            item.week_key === data.config.current_week_key
          )
      );
    }

    updatedLookahead = refreshLookaheadReadiness(
      updatedLookahead,
      data.constraints
    );

    updateData({
      ...data,
      tasks: updatedTasks,
      lookahead: updatedLookahead
    });
  };

  const handleTogglePullPlanTasks = (taskIds: string[]) => {
    if (taskIds.length === 0) return;

    const selectedIds = new Set(taskIds);
    const weekKey = data.config.current_week_key ?? '2026-W35';
    const selectedTasks = data.tasks.filter((task) => selectedIds.has(task.id));
    const updatedTasks = data.tasks.map((task) =>
      selectedIds.has(task.id)
        ? { ...task, pull_planned: true, lookahead_planned: true }
        : task
    );
    const updatedLookahead = [...data.lookahead];

    selectedTasks.forEach((task) => {
      if (updatedLookahead.some((item) => item.task_id === task.id && item.week_key === weekKey)) {
        return;
      }

      const totalQuantity = Number(task.total_quantity) || 0;
      const durationDays = Math.max(1, Number(task.duration_days) || 1);
      const dailyQuantity = Number(task.daily_planned_quantity) || totalQuantity / durationDays;
      const plannedQty = Math.round(dailyQuantity * 7 * 100) / 100;

      updatedLookahead.push({
        id: generateId('LKH'),
        task_id: task.id,
        phase_id: task.phase_id ?? null,
        constraint_ids: [],
        week_key: weekKey,
        planned_qty: plannedQty,
        carry_forward_qty: 0,
        remaining_qty: plannedQty,
        ready: getOpenConstraintCount(task.id, data.constraints) === 0,
        notes: ''
      });
    });

    updateData({
      ...data,
      tasks: updatedTasks,
      lookahead: refreshLookaheadReadiness(updatedLookahead, data.constraints)
    });
    showToast(`${selectedTasks.length} task(s) added to Pull Planning for ${weekKey}.`, 'success');
  };

  // Constraint Actions
  const handleAddConstraint = (c: Constraint) => {
    const updated = { ...data, constraints: [...data.constraints, c] };
    // Also re-evaluate lookahead readiness
    const refreshedLookahead = refreshLookaheadReadiness(updated.lookahead, updated.constraints);
    updateData({ ...updated, lookahead: refreshedLookahead });
    showToast(`Constraint [${c.type}] logged for task`, 'warning');
  };

  const handleUpdateConstraint = (updatedConstraint: Constraint) => {
    const updatedConstraints = data.constraints.map((constraint) =>
      constraint.id === updatedConstraint.id ? updatedConstraint : constraint
    );
    updateData({
      ...data,
      constraints: updatedConstraints,
      lookahead: refreshLookaheadReadiness(data.lookahead, updatedConstraints)
    });
    showToast('Constraint updated for its assigned task.', 'success');
  };

  const handleResolveConstraint = (constraintId: string, resolutionReason: string) => {
    if (!resolutionReason.trim()) {
      showToast('Enter how this constraint was resolved before saving.', 'warning');
      return;
    }
    const resolutionDate = new Date().toISOString().split('T')[0];

    const updatedConstraints = data.constraints.map((constraint) =>
      constraint.id === constraintId
        ? {
            ...constraint,
            status: 'Resolved' as const,
            resolved_date: resolutionDate,
            resolution_reason: resolutionReason.trim()
          }
        : constraint
    );

    const refreshedLookahead = refreshLookaheadReadiness(
      data.lookahead,
      updatedConstraints
    );

    updateData({
      ...data,
      constraints: updatedConstraints,
      lookahead: refreshedLookahead
    });

    showToast(
      `Constraint resolved on ${resolutionDate}. Work can start from the next working day.`,
      'success'
    );
  };

  // Lookahead Actions
  const handleAddToLookahead = (item: LookaheadItem) => {
    // Avoid duplicate task in the same week
    const existing = data.lookahead.find(
      (l) => l.task_id === item.task_id && l.week_key === item.week_key
    );
    let updatedItems = data.lookahead;
    if (existing) {
      updatedItems = data.lookahead.map((l) => (l.id === existing.id ? item : l));
    } else {
      updatedItems = [...data.lookahead, item];
    }
    const refreshed = refreshLookaheadReadiness(updatedItems, data.constraints);
    updateData({ ...data, lookahead: refreshed });
    showToast('Task placed into Lookahead Horizon', 'success');
  };

  const handleRefreshReadiness = () => {
    const refreshed = refreshLookaheadReadiness(data.lookahead, data.constraints);
    updateData({ ...data, lookahead: refreshed });
    showToast('Readiness statuses recalculated against open constraints', 'info');
  };

  // Commitment Actions
  const handleAddCommitment = (com: Commitment) => {
    const task = data.tasks.find((t) => t.id === com.task_id);

    if (!task) {
      showToast('Task not found. Commitment cannot be created.', 'error');
      return;
    }

    const openConstraints = data.constraints.filter(
      (constraint) =>
        constraint.task_id === com.task_id &&
        constraint.status !== 'Resolved'
    );

    if (openConstraints.length > 0) {
      showToast(
        `Cannot commit this task. ${openConstraints.length} constraint${
          openConstraints.length > 1 ? 's are' : ' is'
        } still open.`,
        'warning'
      );
      return;
    }

    const existingCommitment = data.commitments.find(
      (commitment) =>
        commitment.task_id === com.task_id &&
        commitment.week_key === com.week_key
    );

    if (existingCommitment) {
      showToast(
        'This task is already committed for the selected week.',
        'warning'
      );
      return;
    }

    const updated = {
      ...data,
      commitments: [
        ...data.commitments,
        {
          ...com,
          outcome: com.outcome ?? 'pending',
          actual_qty: com.actual_qty ?? 0,
          progress_percent: com.progress_percent ?? 0
        }
      ]
    };

    updateData(updated);

    showToast(
      'Commitment accepted — task is Ready and locked to the Weekly Work Plan.',
      'success'
    );
  };

  const handleUpdateCommitmentOutcome = (
    commitmentId: string,
    outcome: 'done' | 'not_done',
    reasonCode?: number,
    actualQty?: number
  ) => {
    const updatedCommitments = data.commitments.map((c) => {
      if (c.id !== commitmentId) return c;

      const plannedQty = Number(c.planned_qty ?? 0);
      const actual = Number(actualQty ?? c.actual_qty ?? 0);

      // Automatically calculate quantity progress
      const progress =
        plannedQty > 0
          ? Math.min(
              100,
              Math.round((actual / plannedQty) * 100)
            )
          : 0;

      // Quantity determines the final outcome
      const autoOutcome: 'done' | 'not_done' =
        plannedQty > 0 && actual >= plannedQty
          ? 'done'
          : 'not_done';

      return {
        ...c,
        outcome: autoOutcome,
        reason_code:
          autoOutcome === 'not_done'
            ? (reasonCode ?? c.reason_code ?? 1)
            : undefined,
        actual_qty: actual,
        progress_percent: progress
      };
    });

    updateData({
      ...data,
      commitments: updatedCommitments
    });
  };

  const handleSaveDailyActual = (actual: ActualEntry) => {
    const existingIndex = data.actuals.findIndex(
      (a) =>
        a.commitment_id === actual.commitment_id &&
        a.day_date === actual.day_date
    );

    const updatedActuals = [...data.actuals];

    if (existingIndex >= 0) {
      updatedActuals[existingIndex] = actual;
    } else {
      updatedActuals.push(actual);
    }

    const commitmentForActual = data.commitments.find((commitment) => commitment.id === actual.commitment_id);
    const plannedForActual = Number(commitmentForActual?.planned_qty ?? 0);
    const otherDaysTotal = updatedActuals
      .filter((entry) => entry.commitment_id === actual.commitment_id && entry.day_date !== actual.day_date)
      .reduce((sum, entry) => sum + (Number(entry.achieved_qty) || 0), 0);
    const remainingForToday = Math.max(0, plannedForActual - otherDaysTotal);
    if (plannedForActual > 0 && Number(actual.achieved_qty) > remainingForToday + 0.000001) {
      showToast(`Daily quantity cannot exceed the remaining weekly commitment (${remainingForToday.toFixed(2)}).`, 'warning');
      return;
    }

    const updatedCommitments = data.commitments.map(
      (commitment) => {
        if (commitment.id !== actual.commitment_id) {
          return commitment;
        }

        const commitmentLookahead = data.lookahead.find(
          (lookahead) =>
            lookahead.task_id === commitment.task_id &&
            lookahead.week_key === commitment.week_key
        );

        const plannedQty =
          Number(commitmentLookahead?.planned_qty) || 0;

        const commitmentActuals = updatedActuals.filter(
          (entry) => entry.commitment_id === commitment.id
        );

        const cumulativeAchieved = commitmentActuals.reduce(
          (sum, entry) =>
            sum + (Number(entry.achieved_qty) || 0),
          0
        );

        const progressPercent =
          plannedQty > 0
            ? Math.min(
                100,
                Math.round(
                  (cumulativeAchieved / plannedQty) *
                    100
                )
              )
            : 0;

        return {
          ...commitment,
          actual_qty: cumulativeAchieved,
          progress_percent: progressPercent
        };
      }
    );

    updateData({
      ...data,
      actuals: updatedActuals,
      commitments: updatedCommitments
    });

    showToast(
      'Daily production actual recorded and progress updated',
      'success'
    );
  };

  const handleCloseOutWeek = (
    weekKey: string,
    finalPpc: number,
    closeoutDate: string
  ) => {
    const selectedStart = getWeekStart(weekKey);
    const projectStart = data.config.startDate || data.config.start_date;
    const previousStart = selectedStart ? new Date(selectedStart) : null;
    if (previousStart) previousStart.setDate(previousStart.getDate() - 7);
    const previousWeekKey = previousStart ? getISOWeekKey(previousStart) : '';
    const isFirstProjectWeek = !projectStart || getISOWeekKey(new Date(`${projectStart}T00:00:00`)) === weekKey;
    if (!isFirstProjectWeek && !data.metrics.some((metric) => metric.week_key === previousWeekKey && metric.status === 'Closed')) {
      showToast(`Close out ${previousWeekKey} before moving to ${weekKey}.`, 'warning');
      return;
    }
    const getNextWeekKey = (selectedWeekKey: string): string => {
      const match = selectedWeekKey.match(/^\d{4}-W(\d{2})$/);

      if (!match) {
        return selectedWeekKey;
      }

      const year = Number(match[1]);
      const week = Number(match[2]);

      if (week >= 52) {
        return `${year + 1}-W01`;
      }

      return `${year}-W${String(week + 1).padStart(2, '0')}`;
    };

    const nextWeekKey = getNextWeekKey(weekKey);
    let updatedLookahead = [...data.lookahead];

    const weekStartDate = getWeekStart(weekKey);
    const weekEndDate = (() => {
      const end = new Date(weekStartDate ?? new Date());
      end.setDate(end.getDate() + 7);
      return end;
    })();

    const weekCommitments = data.commitments.filter(
      (commitment) => commitment.week_key === weekKey
    );

    for (const commitment of weekCommitments) {
      const task = data.tasks.find(
        (item) => item.id === commitment.task_id
      );

      if (!task) continue;

      const plannedQty = Number(commitment.planned_qty) || 0;

      // Daily Check-In is the source of truth for actual quantity.
      const actualQty = data.actuals
        .filter(
          (actual) =>
            actual.commitment_id === commitment.id &&
            actual.day_date >= (weekStartDate?.toISOString().split('T')[0] ?? '') &&
            actual.day_date < weekEndDate.toISOString().split('T')[0]
        )
        .reduce(
          (sum, actual) =>
            sum + (Number(actual.achieved_qty) || 0),
          0
        );

      const remainingQty = Math.max(
        0,
        plannedQty - actualQty
      );

      if (remainingQty <= 0) {
        continue;
      }

      const existingNextWeek = updatedLookahead.find(
        (item) =>
          item.task_id === commitment.task_id &&
          item.week_key === nextWeekKey
      );

      if (existingNextWeek) {
        updatedLookahead = updatedLookahead.map((item) =>
          item.id === existingNextWeek.id
            ? {
                ...item,
                planned_qty:
                  (Number(item.planned_qty) || 0) +
                  remainingQty,
                carry_forward_qty:
                  (Number(item.carry_forward_qty) || 0) +
                  remainingQty,
                remaining_qty:
                  (Number(item.remaining_qty) || 0) +
                  remainingQty,
                notes: item.notes
                  ? `${item.notes} Carry-forward from ${weekKey}.`
                  : `Carry-forward from ${weekKey}.`
              }
            : item
        );
      } else {
        const openConstraints = getOpenConstraintCount(
          commitment.task_id,
          data.constraints
        );

        const newLookaheadItem: LookaheadItem = {
          id: generateId('LKH'),
          task_id: commitment.task_id,
          phase_id: task.phase_id ?? null,
          constraint_ids: [],
          week_key: nextWeekKey,
          planned_qty: remainingQty,
          carry_forward_qty: remainingQty,
          remaining_qty: remainingQty,
          ready: openConstraints === 0,
          notes: `Carry-forward from ${weekKey}.`
        };

        updatedLookahead.push(newLookaheadItem);
      }
    }

    updatedLookahead = refreshLookaheadReadiness(
      updatedLookahead,
      data.constraints
    );

    const newMetric = {
      ...computeMetrics(weekKey, data),
      id: generateId('MET'),
      week_key: weekKey,
      ppc: finalPpc,
      closeout_date: closeoutDate,
      status: 'Closed' as const
    };

    const updatedMetrics = [
      ...data.metrics.filter((metric) => metric.week_key !== weekKey),
      newMetric
    ];

    updateData({
      ...data,
      lookahead: updatedLookahead,
      metrics: updatedMetrics,
      config: {
        ...data.config,
        current_week_key: nextWeekKey
      }
    });

    showToast(
      `Week ${weekKey} closed. Unfinished quantities carried forward to ${nextWeekKey}.`,
      'success'
    );
  };

  // Learning Progress
  const handleSaveLearnProgress = (topicId: number, score: number, passed: boolean) => {
    const existingIdx = data.learnProgress.findIndex((p) => p.topic_id === topicId);
    let updated = [...data.learnProgress];
    if (existingIdx >= 0) {
      updated[existingIdx] = { topic_id: topicId, score, passed };
    } else {
      updated.push({ topic_id: topicId, score, passed });
    }
    updateData({ ...data, learnProgress: updated });
    if (passed) {
      showToast('Quiz passed! Master progress saved.', 'success');
    }
  };

  // Config & Preset handlers
  const handleUpdateConfig = (newConfig: ProjectConfig) => {
    updateData({ ...data, config: newConfig });
    showToast('Project configuration saved', 'success');
  };

  const handleUpdateTrades = (newTrades: TradeItem[]) => {
    updateData({ ...data, trades: newTrades });
    showToast('Trade directory updated', 'success');
  };

  const handleUpdateAreas = (newAreas: string[]) => {
    updateData({ ...data, areas: newAreas });
    showToast('Project work zones updated', 'success');
  };

  const handleExportJSON = () => {
    exportDataAsJSON(data);
    showToast('Downloaded lps_data_backup.json', 'info');
  };

  const handleExportSpreadsheet = () => {
    exportDataAsSpreadsheet(data);
    showToast('Downloaded LPS spreadsheet export', 'info');
  };

  const handleSelectProject = (project: ProjectRecord) => {
    const selectedProject = normalizeProjectRecord(project);

    setSelectedProjectId(selectedProject.id);
    setData(selectedProject.data);
    saveLPSData(selectedProject.data);
    setActiveNav('dashboard');
  };
  const createProjectData = (details: {
    name: string;
    client: string;
    location: string;
    projectCode: string;
    startDate: string;
    endDate: string;
  }): LPSData => ({
    ...loadLPSData(),
    config: {
      projectName: details.name,
      project_name: details.name,
      client: details.client,
      projectCode: details.projectCode,
      startDate: details.startDate,
      start_date: details.startDate,
      endDate: details.endDate,
      end_date: details.endDate,
      current_week_key: getISOWeekKey(new Date(`${details.startDate}T00:00:00`)),
      lookahead_weeks: 4,
      lookahead_configured: false,
      projectManager: '',
      leanChampion: ''
    },
    trades: [],
    areas: [],
    phases: [],
    milestones: [],
    tasks: [],
    constraints: [],
    lookahead: [],
    commitments: [],
    actuals: [],
    metrics: [],
    closeouts: [],
    learnProgress: []
  });

  const handleCreateProject = async (project: ProjectRecord) => {
    const normalizedProject = normalizeProjectRecord(project);
    const updatedProjects = [...projects, normalizedProject];

    const saved = await saveProjects(updatedProjects);

    if (!saved) {
      showToast(
        'Failed to create project on server',
        'error'
      );
      return;
    }

    setProjects(updatedProjects);
    handleSelectProject(normalizedProject);

    showToast(
      `Project '${normalizedProject.name}' created`,
      'success'
    );
  };

  const handleImportJSON = (imported: LPSData) => {
    updateData(imported);
    showToast('LPS workspace restored from file', 'success');
  };

  const handleResetSampleData = () => {
    const seed = resetToSampleData();
    setData(seed);
    showToast('Reset to Commercial High-Rise benchmark dataset', 'info');
  };

  const handleLoadBlankProject = () => {
    const blank: LPSData = {
      config: {
        projectName: 'New Lean Construction Project',
        project_name: 'New Lean Construction Project',
        current_week_key: getISOWeekKey(new Date()),
        lookahead_weeks: 4,
        lookahead_configured: false,
        startDate: new Date().toISOString().split('T')[0],
        start_date: new Date().toISOString().split('T')[0],
        end_date: ''
      },
      phases: [],
      milestones: [],
      tasks: [],
      constraints: [],
      lookahead: [],
      commitments: [],
      actuals: [],
      metrics: [],
      closeouts: [],
      learnProgress: [],
      trades: [
        { id: 't1', code: 'STRUC', name: 'Structural', lead: 'Foreman Dave', color: '#f59e0b' },
        { id: 't2', code: 'MEP', name: 'Mechanical & Plumbing', lead: 'Foreman Sarah', color: '#38bdf8' },
        { id: 't3', code: 'ELEC', name: 'Electrical', lead: 'Foreman Mike', color: '#eab308' },
        { id: 't4', code: 'FINISH', name: 'Fit-Out & Finishes', lead: 'Foreman Alex', color: '#10b981' }
      ],
      areas: ['Substructure', 'Podium Level', 'Tower Floor 01', 'Roof Level']
    };
    updateData(blank);
    showToast('Initialized clean blank project template', 'info');
  };

  // If user is not logged in, show the Login / Persona Screen
  if (!user) {
    return <LoginView onLogin={handleLogin} />;
  }

  if (!selectedProjectId) {
    return (
      <ProjectDashboard
        projects={projects}
        onSelect={handleSelectProject}
        onCreate={handleCreateProject}
        createProjectData={(details) => createProjectData(details)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div id="lps-app-root" className="flex h-screen w-full font-sans bg-slate-900 text-slate-100 overflow-hidden relative">
      {/* Toast Notification Container */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          id="mobile-sidebar-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 md:hidden transition-opacity cursor-pointer"
          aria-label="Close navigation sidebar"
        />
      )}

      {/* Left Sidebar (w-64 on mobile, w-56 on desktop) */}
      <Sidebar
        activeNav={activeNav}
        onNavigate={navigateToNav}
        openConstraintsCount={openConstraintsCount}
        user={user}
        onLogout={handleLogout}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header
          currentNav={activeNav}
          currentWeek={currentWeek}
          config={data.config}
          availableWeeks={availableWeeks}
          onSelectWeek={handleSelectWeek}
          user={user}
          onNavigate={navigateToNav}
          onLogout={handleLogout}
          onBackToProjects={handleBackToProjects}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        />

        {/* Dynamic View Scrollable Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto w-full">
          {activeNav === 'dashboard' && (
            <DashboardView
              data={data}
              currentWeek={currentWeek}
              metrics={metrics}
              onNavigate={navigateToNav}
              onResolveConstraint={(id) => {
                const reason = window.prompt('How was this constraint resolved?');
                if (reason?.trim()) handleResolveConstraint(id, reason);
              }}
              onQuickLogConstraint={() => navigateToNav('plan-lookahead')}
            />
          )}

          {activeNav === 'plan-phase' && (
            <PhaseScheduleView
              data={data}
              onAddPhase={handleAddPhase}
              onUpdatePhaseStatus={handleUpdatePhaseStatus}
              onImportTasks={handleImportTasks}
            />
          )}

          {activeNav === 'plan-lookahead' && (
            <LookaheadView
              data={data}
              currentWeek={currentWeek}
              onAddToLookahead={handleAddToLookahead}
              onRefreshReadiness={handleRefreshReadiness}
              onAddConstraint={handleAddConstraint}
              onUpdateConstraint={handleUpdateConstraint}
              onResolveConstraint={(id) => {
                const reason = window.prompt('How was this constraint resolved?');
                if (reason?.trim()) handleResolveConstraint(id, reason);
              }}
              onSetLookaheadWeeks={(weeks) => updateData({ ...data, config: { ...data.config, lookahead_weeks: weeks, lookahead_configured: true } })}
              onNavigateToCommit={() => navigateToNav('week-commit')}
            />
          )}

          {activeNav === 'week-commit' && (
            <MakeCommitmentsView
              data={data}
              currentWeek={currentWeek}
              onAddCommitment={handleAddCommitment}
              onNavigateToCloseout={() => navigateToNav('week-closeout')}
            />
          )}

          {activeNav === 'weekly-work-plan' && (
            <WeeklyWorkPlanView
              data={data}
              currentWeek={currentWeek}
            />
          )}

          {activeNav === 'week-daily' && (
            <DailyCheckInView
              data={data}
              currentWeek={currentWeek}
              onSaveDailyActual={handleSaveDailyActual}
              onResolveConstraint={handleResolveConstraint}
            />
          )}

          {activeNav === 'week-closeout' && (
            <CloseOutWeekView
              data={data}
              currentWeek={currentWeek}
              onUpdateCommitmentOutcome={handleUpdateCommitmentOutcome}
              onCloseOutWeek={handleCloseOutWeek}
              onNavigateToDashboard={() => navigateToNav('dashboard')}
            />
          )}

          {activeNav === 'metrics-this-week' && (
            <ThisWeekMetricsView
              data={data}
              currentWeek={currentWeek}
              metrics={metrics}
              onNavigate={navigateToNav}
            />
          )}

          {activeNav === 'metrics-trends' && (
            <TrendsView data={data} />
          )}

          {activeNav === 'metrics-coaching' && (
            <CoachingView
              data={data}
              currentWeek={currentWeek}
              metrics={metrics}
            />
          )}

          {activeNav === 'learn-centre' && (
            <LearningCentreView
              data={data}
              onSaveProgress={handleSaveLearnProgress}
            />
          )}

          {activeNav === 'learn-guides' && (
            <FacilitatorGuidesView />
          )}

          {activeNav === 'setup-config' && (
            <ProjectConfigView
              data={data}
              onUpdateConfig={handleUpdateConfig}
              onExportJSON={handleExportJSON}
              onExportSpreadsheet={handleExportSpreadsheet}
              onImportJSON={handleImportJSON}
              onResetData={handleResetSampleData}
            />
          )}

          {activeNav === 'setup-trades' && (
            <TradesAreasView
              data={data}
              onUpdateTrades={handleUpdateTrades}
              onUpdateAreas={handleUpdateAreas}
            />
          )}

          {activeNav === 'setup-init' && (
            <InitializeSystemView
              onLoadSampleData={handleResetSampleData}
              onLoadBlankProject={handleLoadBlankProject}
              onNavigateToDashboard={() => navigateToNav('dashboard')}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
