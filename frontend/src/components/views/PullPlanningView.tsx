import React, { useMemo, useState } from 'react';
import {
  Layers,
  Plus,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  User,
  MapPin,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  ArrowRight,
  Search,
  CheckSquare,
  Square,
  Filter
} from 'lucide-react';

import {
  Constraint,
  ConstraintType,
  LPSData,
  Task
} from '../../types';

import {
  computeFloat,
  formatDate,
  generateId,
  getOpenConstraintCount
} from '../../services/storage';

import { Modal } from '../Modal';

interface PullPlanningViewProps {
  data: LPSData;
  currentWeek: string;
  onAddTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddConstraint: (constraint: Constraint) => void;
  onTogglePullPlanTask: (taskId: string) => void;
}

const getWeekRange = (weekKey: string) => {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);

  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay() || 7;

  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - day + 1 + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: monday,
    end: sunday
  };
};

export const PullPlanningView: React.FC<PullPlanningViewProps> = ({
  data,
  currentWeek,
  onAddTask,
  onDeleteTask,
  onAddConstraint,
  onTogglePullPlanTask
}) => {
  /*
   * ---------------------------------------------------------
   * TASK GROUPS
   * ---------------------------------------------------------
   */

  const currentWeekRange = getWeekRange(currentWeek);

  const availableTasks = data.tasks.filter((task) => {
    if (task.pull_planned) return false;

    if (!currentWeekRange) return false;

    const taskStart = task.eps
      ? new Date(task.eps)
      : null;

    const taskFinish = task.epf
      ? new Date(task.epf)
      : task.must_finish_by
        ? new Date(task.must_finish_by)
        : null;

    if (!taskStart && !taskFinish) return false;

    const startsBeforeWeekEnds =
      !taskStart || taskStart <= currentWeekRange.end;

    const finishesAfterWeekStarts =
      !taskFinish || taskFinish >= currentWeekRange.start;

    return startsBeforeWeekEnds && finishesAfterWeekStarts;
  });

  const pullPlannedTasks = data.tasks.filter(
    (task) => task.pull_planned === true
  );

  /*
   * ---------------------------------------------------------
   * AVAILABLE TASK PICKER STATE
   * ---------------------------------------------------------
   */

  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    new Set()
  );

  const [taskSearch, setTaskSearch] = useState('');
  const [taskPhaseFilter, setTaskPhaseFilter] = useState('all');
  const [taskTradeFilter, setTaskTradeFilter] = useState('all');

  /*
   * ---------------------------------------------------------
   * NEW TASK FORM STATE
   * ---------------------------------------------------------
   */

  const [phaseId, setPhaseId] = useState(
    data.phases[0]?.id || ''
  );

  const [trade, setTrade] = useState(
    data.trades[0]?.name || 'Civil & Earthworks'
  );

  const [description, setDescription] = useState('');
  const [responsible, setResponsible] = useState('');

  const [location, setLocation] = useState(
    typeof data.areas[0] === 'string'
      ? data.areas[0]
      : data.areas[0]?.name || 'Zone A - Level 1'
  );

  const [durationDays, setDurationDays] = useState(3);
  const [mustFinishBy, setMustFinishBy] = useState('');
  const [uom, setUom] = useState('nos');

  /*
   * ---------------------------------------------------------
   * CONSTRAINT MODAL STATE
   * ---------------------------------------------------------
   */

  const [isConstraintModalOpen, setIsConstraintModalOpen] =
    useState(false);

  const [selectedTaskForConstraint, setSelectedTaskForConstraint] =
    useState<Task | null>(null);

  const [cType, setCType] =
    useState<ConstraintType>('Materials');

  const [cDesc, setCDesc] = useState('');
  const [cRaisedBy, setCRaisedBy] = useState('');
  const [cResponsible, setCResponsible] = useState('');
  const [cTargetDate, setCTargetDate] = useState('');

  /*
   * ---------------------------------------------------------
   * FILTER AVAILABLE TASKS
   * ---------------------------------------------------------
   */

  const filteredAvailableTasks = useMemo(() => {
    const search = taskSearch.trim().toLowerCase();

    return availableTasks.filter((task) => {
      const matchesSearch =
        !search ||
        task.description.toLowerCase().includes(search) ||
        task.id.toLowerCase().includes(search) ||
        task.trade.toLowerCase().includes(search) ||
        task.responsible.toLowerCase().includes(search) ||
        task.location.toLowerCase().includes(search);

      const matchesPhase =
        taskPhaseFilter === 'all' ||
        task.phase_id === taskPhaseFilter;

      const matchesTrade =
        taskTradeFilter === 'all' ||
        task.trade === taskTradeFilter;

      return matchesSearch && matchesPhase && matchesTrade;
    });
  }, [
    availableTasks,
    taskSearch,
    taskPhaseFilter,
    taskTradeFilter
  ]);

  /*
   * ---------------------------------------------------------
   * SELECTION HELPERS
   * ---------------------------------------------------------
   */

  const toggleSelectedTask = (taskId: string) => {
    setSelectedTaskIds((previous) => {
      const next = new Set(previous);

      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }

      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedTaskIds((previous) => {
      const next = new Set(previous);

      filteredAvailableTasks.forEach((task) => {
        next.add(task.id);
      });

      return next;
    });
  };

  const clearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const allFilteredSelected =
    filteredAvailableTasks.length > 0 &&
    filteredAvailableTasks.every((task) =>
      selectedTaskIds.has(task.id)
    );

  /*
   * ---------------------------------------------------------
   * ADD SELECTED TASKS TO PULL PLAN
   * ---------------------------------------------------------
   */

  const addSelectedTasksToPullPlan = () => {
    if (selectedTaskIds.size === 0) return;

    const ids = Array.from(selectedTaskIds);

    /*
     * Toggle each selected imported task.
     * The App-level handler persists pull_planned=true.
     */
    ids.forEach((taskId) => {
      onTogglePullPlanTask(taskId);
    });

    setSelectedTaskIds(new Set());
  };

  /*
   * ---------------------------------------------------------
   * CREATE MANUAL TASK
   * ---------------------------------------------------------
   */

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !description.trim() ||
      !mustFinishBy ||
      !phaseId
    ) {
      return;
    }

    const newTask: Task = {
      id: generateId('TSK'),
      phase_id: phaseId,
      trade: trade.trim(),
      description: description.trim(),
      responsible:
        responsible.trim() || 'Trade Foreman',
      location:
        location.trim() || 'Main Deck',
      duration_days:
        Number(durationDays) || 3,
      must_finish_by: mustFinishBy,
      uom: uom.trim() || 'unit',
      status: 'Planned',
      pull_planned: true
    };

    onAddTask(newTask);

    setDescription('');
    setResponsible('');
    setMustFinishBy('');
  };

  /*
   * ---------------------------------------------------------
   * CONSTRAINT MODAL
   * ---------------------------------------------------------
   */

  const handleOpenConstraintModal = (task: Task) => {
    setSelectedTaskForConstraint(task);

    setCType('Materials');
    setCDesc('');
    setCRaisedBy('');
    setCResponsible('');
    setCTargetDate(
      task.must_finish_by || ''
    );

    setIsConstraintModalOpen(true);
  };

  const handleSaveConstraint = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !selectedTaskForConstraint ||
      !cDesc.trim() ||
      !cResponsible.trim() ||
      !cTargetDate
    ) {
      return;
    }

    const newConstraint: Constraint = {
      id: generateId('CON'),
      task_id: selectedTaskForConstraint.id,
      type: cType,
      description: cDesc.trim(),
      raised_by:
        cRaisedBy.trim() || 'Site Team',
      responsible: cResponsible.trim(),
      raised_date:
        new Date()
          .toISOString()
          .split('T')[0],
      target_date: cTargetDate,
      status: 'Open'
    };

    onAddConstraint(newConstraint);

    setIsConstraintModalOpen(false);
    setSelectedTaskForConstraint(null);
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div
      id="pull-planning-view"
      className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in"
    >

      {/* =====================================================
          OVERVIEW
      ===================================================== */}

      <div className="p-5 rounded-lg bg-[#1e293b] border border-[#334155] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

        <div>
          <h2 className="text-lg font-bold text-[#f8fafc] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#f59e0b]" />

            <span>
              Pull Planning & Handoff Task Board
            </span>
          </h2>

          <p className="text-xs text-[#94a3b8] mt-1">
            Select phase-schedule tasks to pull into the
            weekly planning board. Keep tasks short
            (&lt;5 days) with clear trade handoffs.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="px-3 py-1.5 rounded-full bg-[#0f172a] border border-[#334155] text-[#38bdf8]">
            Planning Week: <strong>{currentWeek}</strong>
          </span>

          <span className="px-3 py-1.5 rounded-full bg-slate-900 border border-[#334155] text-[#94a3b8]">
            <strong className="text-[#f8fafc]">
              {pullPlannedTasks.length}
            </strong>{' '}
            Pull Tasks
          </span>
        </div>

      </div>


      {/* =====================================================
          AVAILABLE IMPORTED TASKS
      ===================================================== */}

      {availableTasks.length > 0 && (
        <div
          id="available-pull-tasks-section"
          className="rounded-lg bg-[#1e293b] border border-[#334155] shadow-lg overflow-hidden"
        >

          {/* HEADER */}

          <div className="p-5 border-b border-[#334155]">

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">

              <div>
                <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#38bdf8]" />

                  <span>
                    Phase Schedule Tasks
                  </span>

                  <span className="px-2 py-0.5 rounded-full bg-[#0f172a] border border-[#334155] text-[#38bdf8] text-[10px]">
                    {availableTasks.length} available
                  </span>
                </h3>

                <p className="text-xs text-[#94a3b8] mt-1">
                  Select one or more imported tasks and
                  add them to Pull Planning.
                </p>
              </div>

              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={
                    allFilteredSelected
                      ? clearSelection
                      : selectAllFiltered
                  }
                  className="px-3 py-2 text-xs font-semibold rounded-md border border-[#334155] bg-[#0f172a] text-[#cbd5e1] hover:bg-[#334155] transition-colors flex items-center gap-1.5"
                >
                  {allFilteredSelected ? (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      Clear
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      Select All
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selectedTaskIds.size === 0}
                  className="px-3 py-2 text-xs font-semibold rounded-md border border-[#334155] bg-[#0f172a] text-[#94a3b8] hover:text-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Clear Selection
                </button>

              </div>

            </div>


            {/* SEARCH + FILTERS */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">

              <div className="relative md:col-span-1">

                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />

                <input
                  type="text"
                  value={taskSearch}
                  onChange={(e) =>
                    setTaskSearch(e.target.value)
                  }
                  placeholder="Search task, ID, trade..."
                  className="w-full pl-9 pr-3 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none"
                />

              </div>


              <select
                value={taskPhaseFilter}
                onChange={(e) =>
                  setTaskPhaseFilter(e.target.value)
                }
                className="w-full px-3 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
              >

                <option value="all">
                  All Phases
                </option>

                {data.phases.map((phase) => (
                  <option
                    key={phase.id}
                    value={phase.id}
                  >
                    {phase.phase_name}
                  </option>
                ))}

              </select>


              <select
                value={taskTradeFilter}
                onChange={(e) =>
                  setTaskTradeFilter(e.target.value)
                }
                className="w-full px-3 py-2.5 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
              >

                <option value="all">
                  All Trades
                </option>

                {data.trades.map((t) => (
                  <option
                    key={t.id}
                    value={t.name}
                  >
                    {t.name}
                  </option>
                ))}

              </select>

            </div>

          </div>


          {/* SELECTION SUMMARY */}

          <div className="px-5 py-3 bg-[#0f172a] border-b border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-2">

            <div className="flex items-center gap-2 text-xs">

              <span className="text-[#94a3b8]">
                Showing
              </span>

              <strong className="text-[#f8fafc]">
                {filteredAvailableTasks.length}
              </strong>

              <span className="text-[#94a3b8]">
                tasks
              </span>

              {selectedTaskIds.size > 0 && (
                <>
                  <span className="text-[#475569]">
                    •
                  </span>

                  <strong className="text-[#38bdf8]">
                    {selectedTaskIds.size}
                  </strong>

                  <span className="text-[#94a3b8]">
                    selected
                  </span>
                </>
              )}

            </div>


            <button
              type="button"
              onClick={addSelectedTasksToPullPlan}
              disabled={selectedTaskIds.size === 0}
              className="px-4 py-2 bg-[#f59e0b] hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-[#0f172a] font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />

              Add Selected to Pull Plan

              {selectedTaskIds.size > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-[#0f172a]/20">
                  {selectedTaskIds.size}
                </span>
              )}

            </button>

          </div>


          {/* COMPACT TASK LIST */}

          <div className="p-3">

            {filteredAvailableTasks.length === 0 ? (

              <div className="p-10 text-center text-[#94a3b8]">
                <Search className="w-8 h-8 mx-auto mb-2 text-[#64748b]" />

                <p className="text-sm font-semibold text-[#f8fafc]">
                  No matching tasks
                </p>

                <p className="text-xs mt-1">
                  Try changing the search or filters.
                </p>
              </div>

            ) : (

              <div className="max-h-[430px] overflow-y-auto pr-1 space-y-1.5">

                {filteredAvailableTasks.map((task) => {

                  const selected =
                    selectedTaskIds.has(task.id);

                  const phase =
                    data.phases.find(
                      (p) => p.id === task.phase_id
                    );

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() =>
                        toggleSelectedTask(task.id)
                      }
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selected
                          ? 'bg-[#f59e0b]/10 border-[#f59e0b]'
                          : 'bg-[#111827] border-[#334155] hover:border-[#64748b] hover:bg-[#172033]'
                      }`}
                    >

                      <div className="flex items-center gap-3">

                        {/* CHECKBOX */}

                        <div className="shrink-0">

                          {selected ? (
                            <CheckSquare className="w-5 h-5 text-[#f59e0b]" />
                          ) : (
                            <Square className="w-5 h-5 text-[#64748b]" />
                          )}

                        </div>


                        {/* TASK INFO */}

                        <div className="min-w-0 flex-1">

                          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">

                            <span className="text-sm font-semibold text-[#f8fafc] truncate">
                              {task.description}
                            </span>

                            <span className="shrink-0 text-[10px] font-mono text-[#38bdf8]">
                              {task.id}
                            </span>

                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-[#94a3b8]">

                            <span>
                              {phase?.phase_name || 'Phase Schedule'}
                            </span>

                            <span>
                              •
                            </span>

                            <span>
                              {task.trade}
                            </span>

                            <span>
                              •
                            </span>

                            <span>
                              Must finish: {formatDate(task.must_finish_by)}
                            </span>

                          </div>

                        </div>


                        {/* DURATION */}

                        <div className="hidden sm:flex shrink-0 items-center gap-1 text-[10px] text-[#64748b]">

                          <Clock className="w-3.5 h-3.5" />

                          {task.duration_days}d

                        </div>

                      </div>

                    </button>
                  );
                })}

              </div>

            )}

          </div>

        </div>
      )}


      {/* =====================================================
          MANUAL TASK CREATION
      ===================================================== */}

      <div
        id="card-add-task"
        className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-lg"
      >

        <h3 className="text-sm font-bold text-[#f8fafc] mb-4 flex items-center gap-2">

          <Plus className="w-4 h-4 text-[#f59e0b]" />

          <span>
            Add Pull Planning Task (Handoff Note)
          </span>

        </h3>


        {data.phases.length === 0 ? (

          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            ⚠️ Please add at least one Milestone Phase under
            Plan → Phase Schedule first.
          </div>

        ) : (

          <form
            onSubmit={handleCreateTask}
            className="space-y-4"
          >

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* PHASE */}

              <div>

                <label
                  className="block text-xs font-semibold text-[#94a3b8] mb-1"
                  htmlFor="select-task-phase"
                >
                  Phase / Milestone *
                </label>

                <select
                  id="select-task-phase"
                  required
                  value={phaseId}
                  onChange={(e) =>
                    setPhaseId(e.target.value)
                  }
                  className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
                >

                  {data.phases.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                    >
                      {p.phase_name} ({p.id})
                    </option>
                  ))}

                </select>

              </div>


              {/* TRADE */}

              <div>

                <label
                  className="block text-xs font-semibold text-[#94a3b8] mb-1"
                  htmlFor="input-task-trade"
                >
                  Trade *
                </label>

                <select
                  id="input-task-trade"
                  value={trade}
                  onChange={(e) =>
                    setTrade(e.target.value)
                  }
                  className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
                >

                  {data.trades.map((t) => (
                    <option
                      key={t.id}
                      value={t.name}
                    >
                      {t.name} ({t.abbr})
                    </option>
                  ))}

                </select>

              </div>


              {/* RESPONSIBLE */}

              <div>

                <label
                  className="block text-xs font-semibold text-[#94a3b8] mb-1"
                  htmlFor="input-task-responsible"
                >
                  Responsible Person / Foreman
                </label>

                <input
                  id="input-task-responsible"
                  type="text"
                  value={responsible}
                  onChange={(e) =>
                    setResponsible(e.target.value)
                  }
                  placeholder="e.g. Gopal Krishna"
                  className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none"
                />

              </div>


              {/* LOCATION */}

              <div>

                <label
                  className="block text-xs font-semibold text-[#94a3b8] mb-1"
                  htmlFor="input-task-location"
                >
                  Location / Zone
                </label>

                <input
                  id="input-task-location"
                  type="text"
                  value={location}
                  onChange={(e) =>
                    setLocation(e.target.value)
                  }
                  placeholder="e.g. Tower L1 to L4 Core"
                  className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none"
                />

              </div>

            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* DESCRIPTION */}

              <div className="sm:col-span-2">

                <label
                  className="block text-xs font-semibold text-[#94a3b8] mb-1"
                  htmlFor="input-task-description"
                >
                  Task Description (Granular, &lt;5 days) *
                </label>

                <input
                  id="input-task-description"
                  type="text"
                  required
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="e.g. Level 1 column rebar tying and starter ties"
                  className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none"
                />

              </div>


              {/* DURATION */}

              <div>

                <label
                  className="block text-xs font-semibold text-[#94a3b8] mb-1"
                  htmlFor="input-task-duration"
                >
                  Duration (Days) *
                </label>

                <input
                  id="input-task-duration"
                  type="number"
                  min="1"
                  value={durationDays}
                  onChange={(e) =>
                    setDurationDays(
                      Number(e.target.value)
                    )
                  }
                  className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
                />

              </div>


              {/* MUST FINISH */}

              <div>

                <label
                  className="block text-xs font-semibold text-[#94a3b8] mb-1"
                  htmlFor="input-task-finish"
                >
                  Must Finish By *
                </label>

                <input
                  id="input-task-finish"
                  type="date"
                  required
                  value={mustFinishBy}
                  onChange={(e) =>
                    setMustFinishBy(e.target.value)
                  }
                  className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
                />

              </div>


              {/* UOM */}

              <div>

                <label
                  className="block text-xs font-semibold text-[#94a3b8] mb-1"
                  htmlFor="input-task-uom"
                >
                  UOM (Unit)
                </label>

                <input
                  id="input-task-uom"
                  type="text"
                  value={uom}
                  onChange={(e) =>
                    setUom(e.target.value)
                  }
                  placeholder="m², nos, m³"
                  className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none"
                />

              </div>

            </div>


            <div className="flex justify-end pt-2">

              <button
                id="btn-add-task-submit"
                type="submit"
                className="px-5 py-2.5 bg-[#f59e0b] hover:bg-amber-600 active:scale-[0.98] text-[#0f172a] font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
              >

                <Plus className="w-4 h-4" />

                <span>
                  + Add Task to Pull Plan
                </span>

              </button>

            </div>

          </form>
        )}

      </div>


      {/* =====================================================
          PULL PLANNED TASK CARDS
      ===================================================== */}

      <div
        id="pull-tasks-section"
        className="space-y-4"
      >

        <div className="flex items-center justify-between">

          <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">

            <FileSpreadsheet className="w-4 h-4 text-[#f59e0b]" />

            <span>
              Pull Plan Tasks ({pullPlannedTasks.length})
            </span>

          </h3>

          <span className="text-xs text-[#94a3b8]">
            Float = (Must Finish By - Today) - Duration Days
          </span>

        </div>


        {pullPlannedTasks.length === 0 ? (

          <div className="p-12 text-center bg-[#1e293b] border border-dashed border-[#334155] rounded-lg text-[#94a3b8]">

            <Layers className="w-10 h-10 mx-auto text-[#64748b] mb-2" />

            <p className="font-semibold text-[#f8fafc]">
              No Pull Plan Tasks Yet
            </p>

            <p className="text-xs mt-1">
              Select tasks above or use the handoff form
              to add tasks.
            </p>

          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {pullPlannedTasks.map((task) => {

              const floatVal = computeFloat(task);

              const openConstraints =
                getOpenConstraintCount(
                  task.id,
                  data.constraints
                );

              const isReady =
                openConstraints === 0;

              const floatPercent =
                Math.min(
                  100,
                  Math.max(
                    5,
                    (floatVal / 20) * 100
                  )
                );

              const floatColor =
                floatVal <= 0
                  ? {
                      bar: 'bg-red-500',
                      text: 'text-red-400',
                      pill: 'bg-red-500/20 border-red-500/30'
                    }
                  : floatVal <= 7
                  ? {
                      bar: 'bg-amber-500',
                      text: 'text-amber-400',
                      pill: 'bg-amber-500/20 border-amber-500/30'
                    }
                  : {
                      bar: 'bg-emerald-500',
                      text: 'text-emerald-400',
                      pill: 'bg-emerald-500/20 border-emerald-500/30'
                    };

              return (
                <div
                  key={task.id}
                  id={`card-task-${task.id}`}
                  className="p-5 rounded-lg bg-[#1e293b] border border-[#334155] hover:border-[#64748b] transition-all duration-200 shadow-md flex flex-col justify-between"
                >

                  <div>

                    {/* TRADE + READY */}

                    <div className="flex items-center justify-between gap-2 mb-3">

                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#0f172a] border border-[#334155] text-[#38bdf8]">
                        {task.trade}
                      </span>

                      {isReady ? (

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-[#10b981] border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Ready</span>
                        </span>

                      ) : (

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>
                            {openConstraints} Constraint
                            {openConstraints > 1 ? 's' : ''}
                          </span>
                        </span>

                      )}

                    </div>


                    {/* DESCRIPTION */}

                    <h4 className="text-sm font-bold text-[#f8fafc] leading-relaxed">
                      {task.description}
                    </h4>


                    {/* RESPONSIBLE */}

                    <div className="mt-4 space-y-2 text-xs">

                      <div className="flex items-center gap-2 text-[#cbd5e1]">

                        <User className="w-3.5 h-3.5 text-[#64748b]" />

                        <span>
                          {task.responsible}
                        </span>

                      </div>


                      <div className="flex items-center gap-2 text-[#94a3b8]">

                        <MapPin className="w-3.5 h-3.5 text-[#64748b]" />

                        <span>
                          {task.location}
                        </span>

                      </div>


                      <div className="flex items-center gap-2 text-[#94a3b8]">

                        <Calendar className="w-3.5 h-3.5 text-[#64748b]" />

                        <span>
                          Must Finish:{' '}
                          {formatDate(task.must_finish_by)}
                          {' '}
                          ({task.duration_days}d)
                        </span>

                      </div>

                    </div>


                    {/* FLOAT */}

                    <div className="mt-5">

                      <div className="flex items-center justify-between mb-2">

                        <span className="text-[10px] text-[#64748b]">
                          Buffer Float
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${floatColor.pill} ${floatColor.text}`}
                        >
                          {floatVal <= 0
                            ? `⚠️ ${floatVal}d (Zero/Neg)`
                            : `${floatVal} days float`}
                        </span>

                      </div>

                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">

                        <div
                          className={`h-full rounded-full ${floatColor.bar} transition-all duration-300`}
                          style={{
                            width: `${floatPercent}%`
                          }}
                        />

                      </div>

                    </div>


                    {/* ACTIONS */}

                    <div className="flex items-center justify-between pt-4 mt-3 border-t border-[#334155]">

                      <span className="text-[10px] text-[#64748b] font-mono">
                        {task.id}
                      </span>

                      <div className="flex items-center gap-2">

                        <button
                          id={`btn-remove-pull-task-${task.id}`}
                          type="button"
                          onClick={() =>
                            onTogglePullPlanTask(task.id)
                          }
                          className="px-2.5 py-1 text-xs text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#334155] border border-[#334155] rounded-md transition-all flex items-center gap-1 cursor-pointer"
                        >

                          <ArrowRight className="w-3 h-3 rotate-180 text-[#38bdf8]" />

                          <span>
                            Remove
                          </span>

                        </button>


                        <button
                          id={`btn-add-constraint-${task.id}`}
                          type="button"
                          onClick={() =>
                            handleOpenConstraintModal(task)
                          }
                          className="px-2.5 py-1 text-xs text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#334155] border border-[#334155] rounded-md transition-all flex items-center gap-1 cursor-pointer"
                        >

                          <ShieldAlert className="w-3 h-3 text-[#f59e0b]" />

                          <span>
                            Constraint
                          </span>

                        </button>


                        <button
                          id={`btn-delete-task-${task.id}`}
                          type="button"
                          onClick={() =>
                            onDeleteTask(task.id)
                          }
                          aria-label={`Delete ${task.description}`}
                          className="p-1.5 text-[#94a3b8] hover:text-red-400 hover:bg-red-500/10 border border-[#334155] rounded-md transition-all cursor-pointer"
                        >

                          <Trash2 className="w-3.5 h-3.5" />

                        </button>

                      </div>

                    </div>

                  </div>

                </div>
              );
            })}

          </div>

        )}

      </div>


      {/* =====================================================
          CONSTRAINT MODAL
      ===================================================== */}

      <Modal
        isOpen={isConstraintModalOpen}
        onClose={() =>
          setIsConstraintModalOpen(false)
        }
        title="Log Task Constraint / Roadblock"
        subtitle={
          selectedTaskForConstraint
            ? `For Task: ${selectedTaskForConstraint.description}`
            : ''
        }
      >

        <form
          onSubmit={handleSaveConstraint}
          className="space-y-4"
        >

          <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155] text-xs space-y-1">

            <div className="text-[#94a3b8]">
              Associated Task:
            </div>

            <div className="font-bold text-[#f8fafc]">
              {selectedTaskForConstraint?.description}
            </div>

            <div className="text-[#38bdf8]">
              {selectedTaskForConstraint?.trade}
              {' • '}
              Must finish:{' '}
              {formatDate(
                selectedTaskForConstraint?.must_finish_by || ''
              )}
            </div>

          </div>


          <div>

            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">
              Constraint Type *
            </label>

            <select
              required
              value={cType}
              onChange={(e) =>
                setCType(
                  e.target.value as ConstraintType
                )
              }
              className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
            >

              <option value="Workforce">
                Workforce
              </option>

              <option value="Materials">
                Materials
              </option>

              <option value="Drawings">
                Drawings
              </option>

              <option value="Equipment">
                Equipment
              </option>

              <option value="Approvals">
                Approvals
              </option>

              <option value="Prerequisite">
                Prerequisite
              </option>

              <option value="Space">
                Space
              </option>

              <option value="Safety">
                Safety
              </option>

              <option value="Client">
                Client
              </option>

              <option value="Other">
                Other
              </option>

            </select>

          </div>


          <div>

            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">
              Constraint Description *
            </label>

            <textarea
              required
              value={cDesc}
              onChange={(e) =>
                setCDesc(e.target.value)
              }
              placeholder="Describe the roadblock..."
              rows={3}
              className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none resize-none"
            />

          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>

              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">
                Raised By
              </label>

              <input
                type="text"
                value={cRaisedBy}
                onChange={(e) =>
                  setCRaisedBy(e.target.value)
                }
                placeholder="Site Team"
                className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none"
              />

            </div>


            <div>

              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">
                Responsible *
              </label>

              <input
                required
                type="text"
                value={cResponsible}
                onChange={(e) =>
                  setCResponsible(e.target.value)
                }
                placeholder="Person responsible"
                className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none"
              />

            </div>

          </div>


          <div>

            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">
              Target Resolution Date *
            </label>

            <input
              required
              type="date"
              value={cTargetDate}
              onChange={(e) =>
                setCTargetDate(e.target.value)
              }
              className="w-full px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
            />

          </div>


          <div className="flex justify-end gap-2 pt-2">

            <button
              type="button"
              onClick={() =>
                setIsConstraintModalOpen(false)
              }
              className="px-4 py-2 text-xs font-semibold text-[#94a3b8] border border-[#334155] rounded-lg hover:bg-[#334155]"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-[#0f172a] bg-[#f59e0b] hover:bg-amber-600 rounded-lg"
            >
              Save Constraint
            </button>

          </div>

        </form>

      </Modal>

    </div>
  );
};