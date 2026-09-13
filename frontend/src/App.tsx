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
import { PullPlanningView } from './components/views/PullPlanningView';
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
      '/plan/pull': 'plan-pull',
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
      '/plan/pull': 'plan-pull',
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

  useEffect(() => {
    if (!selectedProjectId) return;

    const missingLookaheadTasks = data.tasks.filter(
      (task) =>
        task.pull_planned === true &&
        !data.lookahead.some(
          (item) => item.task_id === task.id
        )
    );

    if (missingLookaheadTasks.length === 0) {
      return;
    }

    const newLookaheadItems: LookaheadItem[] =
      missingLookaheadTasks.map((task) => {
        const openConstraints =
          getOpenConstraintCount(
            task.id,
            data.constraints
          );

        return {
          id: generateId('LKH'),
          task_id: task.id,
          phase_id: task.phase_id ?? null,
          constraint_ids: data.constraints
            .filter((c) => c.task_id === task.id)
            .map((c) => c.id),
          week_key: currentWeek,
          planned_qty: 1,
          ready: openConstraints === 0,
          notes: 'Automatically added from Pull Planning'
        };
      });

    const updatedTasks = data.tasks.map((task) =>
      missingLookaheadTasks.some(
        (missing) => missing.id === task.id
      )
        ? {
            ...task,
            lookahead_planned: true
          }
        : task
    );

    void updateData({
      ...data,
      tasks: updatedTasks,
      lookahead: refreshLookaheadReadiness(
        [
          ...data.lookahead,
          ...newLookaheadItems
        ],
        data.constraints
      )
    });
  }, [selectedProjectId, data.tasks, data.lookahead]);

  // Compute live metrics for the current week
  const metrics = useMemo(() => computeMetrics(currentWeek, data), [currentWeek, data]);

  // Compute total open constraints
  const openConstraintsCount = useMemo(() => getOpenConstraintsCountTotal(data.constraints), [data.constraints]);

  // Current available weeks list for the header dropdown
  const availableWeeks = useMemo(() => {
    const set = new Set<string>();
    data.metrics.forEach((m) => set.add(m.week_key));
    data.lookahead.forEach((l) => set.add(l.week_key));
    data.commitments.forEach((c) => set.add(c.week_key));
    set.add(data.config.current_week_key);
    return Array.from(set).sort();
  }, [data]);

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
    const task = data.tasks.find(
      (t) => t.id === taskId
    );

    if (!task) return;

    const newPullPlanned =
      !(task.pull_planned ?? false);

    /*
     * ---------------------------------------------------------
     * UPDATE TASK PULL-PLANNED STATUS
     * ---------------------------------------------------------
     */

    const updatedTasks = data.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
              pull_planned: newPullPlanned,
              lookahead_planned: newPullPlanned
          }
        : t
    );

    /*
     * ---------------------------------------------------------
     * AUTOMATIC PULL PLAN → LOOKAHEAD FLOW
     * ---------------------------------------------------------
     *
     * When a task is selected for Pull Planning:
     *
     * 1. Automatically create its Lookahead record.
     * 2. Use the task's scheduled finish date to determine
     *    the initial Lookahead week.
     * 3. Automatically calculate readiness from constraints.
     *
     * When a task is removed from Pull Planning:
     *
     * 4. Remove its Lookahead record as well.
     *
     * No second manual data entry is required.
     * ---------------------------------------------------------
     */

    let updatedLookahead = [...data.lookahead];

    if (newPullPlanned) {
      /*
       * Prevent duplicate Lookahead entries.
       */
      const alreadyInLookahead =
        updatedLookahead.some(
          (item) =>
            item.task_id === taskId
        );

      if (!alreadyInLookahead) {
        /*
         * Determine the Lookahead week.
         *
         * Prefer the task's must_finish_by date.
         * Fall back to the current project week.
         */
        const taskDate =
          task.must_finish_by
            ? new Date(task.must_finish_by)
            : null;

        let weekKey = currentWeek;

        if (
          taskDate &&
          !isNaN(taskDate.getTime())
        ) {
          const year =
            taskDate.getFullYear();

          const startOfYear =
            new Date(year, 0, 1);

          const dayOfYear =
            Math.floor(
              (taskDate.getTime() -
                startOfYear.getTime()) /
                86400000
            ) + 1;

          const weekNumber =
            Math.ceil(
              (dayOfYear +
                startOfYear.getDay()) /
                7
            );

          weekKey =
            `${year}-W${String(
              weekNumber
            ).padStart(2, '0')}`;
        }

        /*
         * Readiness is determined automatically
         * from the current constraint state.
         */
        const openConstraints =
          getOpenConstraintCount(
            taskId,
            data.constraints
          );

        const newLookaheadItem: LookaheadItem = {
          id: generateId('LKH'),
          task_id: taskId,
          phase_id: task.phase_id ?? null,
          constraint_ids: data.constraints
            .filter((c) => c.task_id === task.id)
            .map((c) => c.id),
          week_key: weekKey,
          planned_qty: 1,
          ready: openConstraints === 0,
          notes: ''
        };

        updatedLookahead.push(
          newLookaheadItem
        );
      }
    } else {
      /*
       * Removing a task from Pull Planning
       * also removes it from Lookahead.
       */
      updatedLookahead =
        updatedLookahead.filter(
          (item) =>
            item.task_id !== taskId
        );
    }

    /*
     * Recalculate readiness after the change.
     */
    updatedLookahead =
      refreshLookaheadReadiness(
        updatedLookahead,
        data.constraints
      );

    /*
     * Save the complete updated workspace.
     */
    updateData({
      ...data,
      tasks: updatedTasks,
      lookahead: updatedLookahead
    });
  };

  // Constraint Actions
  const handleAddConstraint = (c: Constraint) => {
    const updated = { ...data, constraints: [...data.constraints, c] };
    // Also re-evaluate lookahead readiness
    const refreshedLookahead = refreshLookaheadReadiness(updated.lookahead, updated.constraints);
    updateData({ ...updated, lookahead: refreshedLookahead });
    showToast(`Constraint [${c.type}] logged for task`, 'warning');
  };

  const handleResolveConstraint = (constraintId: string) => {
    const updatedConstraints = data.constraints.map((c) =>
      c.id === constraintId ? { ...c, status: 'Resolved' as const } : c
    );
    const refreshedLookahead = refreshLookaheadReadiness(data.lookahead, updatedConstraints);
    updateData({
      ...data,
      constraints: updatedConstraints,
      lookahead: refreshedLookahead
    });
    showToast('Constraint resolved! Task readiness updated.', 'success');
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
    const lookahead = data.lookahead.find(
      (item) =>
        item.task_id === com.task_id &&
        item.week_key === com.week_key
    );

    const commitmentWithLookahead: Commitment = {
      ...com,
      lookahead_id:
        com.lookahead_id ??
        lookahead?.id ??
        null
    };

    const updated = {
      ...data,
      commitments: [
        ...data.commitments,
        commitmentWithLookahead
      ]
    };

    updateData(updated);

    showToast(
      'Commitment promised and linked to Lookahead activity',
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
          (entry) =>
            entry.commitment_id === commitment.id
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
    // Record or update the weekly metrics history
    const existingIdx = data.metrics.findIndex(
      (m) => m.week_key === weekKey
    );

    const newRecord = {
      ...metrics,
      week_key: weekKey,
      ppc: finalPpc,
      closed_at: closeoutDate,
      status: 'Closed' as const
    };

    const updatedMetrics = [...data.metrics];

    if (existingIdx >= 0) {
      updatedMetrics[existingIdx] = newRecord;
    } else {
      updatedMetrics.push(newRecord);
    }

    updateData({
      ...data,
      metrics: updatedMetrics
    });

    showToast(
      `Week ${weekKey} successfully sealed with PPC ${finalPpc}%!`,
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
      current_week_key: '2026-W35',
      lookahead_weeks: 4,
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
        current_week_key: '2026-W35',
        lookahead_weeks: 4,
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
              onResolveConstraint={handleResolveConstraint}
              onQuickLogConstraint={() => navigateToNav('plan-pull')}
            />
          )}

          {activeNav === 'plan-phase' && (
            <PhaseScheduleView
              data={data}
              onAddPhase={handleAddPhase}
              onUpdatePhaseStatus={handleUpdatePhaseStatus}
            />
          )}

          {activeNav === 'plan-pull' && (
            <PullPlanningView
              data={data}
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
              onAddConstraint={handleAddConstraint}
              onTogglePullPlanTask={handleTogglePullPlanTask}
            />
          )}

          {activeNav === 'plan-lookahead' && (
            <LookaheadView
              data={data}
              currentWeek={currentWeek}
              onAddToLookahead={handleAddToLookahead}
              onRefreshReadiness={handleRefreshReadiness}
              onResolveConstraint={handleResolveConstraint}
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
