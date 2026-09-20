import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Calendar,
  Layers,
  ArrowRight,
  User,
  MapPin,
  Clock
} from 'lucide-react';

import {
  LPSData,
  LookaheadItem,
  Constraint
} from '../../types';

import {
  computeFloat,
  formatDate,
  getOpenConstraintCount,
  getWeekKeyForDate,
  generateId
} from '../../services/storage';

const getWeekStart = (weekKey: string) => {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);

  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay() || 7;

  const monday = new Date(jan4);
  monday.setDate(
    jan4.getDate() - day + 1 + (week - 1) * 7
  );

  monday.setHours(0, 0, 0, 0);

  return monday;
};

const getWeekEnd = (weekKey: string) => {
  const start = getWeekStart(weekKey);

  if (!start) return null;

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return end;
};

interface LookaheadViewProps {
  data: LPSData;
  currentWeek: string;
  onAddToLookahead: (item: LookaheadItem) => void;
  onRefreshReadiness: () => void;
  onAddConstraint: (constraint: Constraint) => void;
  onResolveConstraint: (constraintId: string) => void;
  onNavigateToCommit: () => void;
}

export const LookaheadView: React.FC<LookaheadViewProps> = ({
  data,
  currentWeek,
  onAddToLookahead,
  onRefreshReadiness,
  onAddConstraint,
  onResolveConstraint,
  onNavigateToCommit
}) => {
  /*
   * ---------------------------------------------------------
   * STATE
   * ---------------------------------------------------------
   */

  const [lookaheadWeeks, setLookaheadWeeks] =
    useState<3 | 4 | 5>(4);

  const getWeekOffset = (weekKey: string) => {
    const match = weekKey.match(
      /^(\d{4})-W(\d{2})$/
    );

    if (!match) return null;

    return {
      year: Number(match[1]),
      week: Number(match[2])
    };
  };

  const current = getWeekOffset(currentWeek);

  const getWeekDifference = (baseWeek: string, weekKey: string) => {
    const baseDate = getWeekStart(baseWeek);
    const targetDate = getWeekStart(weekKey);
    if (!baseDate || !targetDate) return null;
    return Math.round((targetDate.getTime() - baseDate.getTime()) / 604800000);
  };

  const availableWeeks = Array.from(new Set([
    ...data.lookahead.map((item) => item.week_key),
    ...Array.from({ length: 5 }, (_, offset) => {
      const date = getWeekStart(currentWeek);
      if (!date) return '';
      date.setDate(date.getDate() + offset * 7);
      return getWeekKeyForDate(date);
    })
  ])).filter(Boolean);

  const visibleWeeks = availableWeeks.filter((week) => {
    const offset = getWeekDifference(currentWeek, week);
    return offset !== null && offset >= 0 && offset < lookaheadWeeks;
  });

  const phaseScheduleTasks = data.tasks.filter(
    (task) => task.trade === 'Phase Schedule'
  );

  const generatedLookaheadItems: LookaheadItem[] = [];

  phaseScheduleTasks.forEach((task) => {
    const taskStart = task.eps
      ? new Date(task.eps)
      : null;

    const taskFinish = task.epf
      ? new Date(task.epf)
      : task.must_finish_by
        ? new Date(task.must_finish_by)
        : null;

    if (!taskStart || !taskFinish) return;

    const totalQuantity =
      Number(task.total_quantity) || 0;

    const durationDays =
      Number(task.duration_days) || 1;

    const dailyQuantity =
      Number(task.daily_planned_quantity) ||
      totalQuantity / durationDays;

    visibleWeeks.forEach((weekKey) => {

      const weekStart = getWeekStart(weekKey);
      const weekEnd = getWeekEnd(weekKey);

      if (!weekStart || !weekEnd) return;

      const overlapsWeek =
        taskStart <= weekEnd &&
        taskFinish >= weekStart;

      if (!overlapsWeek) return;

      const effectiveStart =
        taskStart > weekStart
          ? taskStart
          : weekStart;

      const effectiveFinish =
        taskFinish < weekEnd
          ? taskFinish
          : weekEnd;

      const daysInWeek =
        Math.max(
          1,
          Math.floor(
            (
              effectiveFinish.getTime() -
              effectiveStart.getTime()
            ) /
              86400000
          ) + 1
        );

      const plannedQty =
        Math.round(
          dailyQuantity * daysInWeek * 100
        ) / 100;

      const existingItem =
        data.lookahead.find(
          (item) =>
            item.task_id === task.id &&
            item.week_key === weekKey
        );

      generatedLookaheadItems.push({
        id:
          existingItem?.id ??
          `LKH-${task.id}-${weekKey}`,

        task_id: task.id,

        phase_id:
          task.phase_id ?? null,

        constraint_ids:
          existingItem?.constraint_ids ?? [],

        week_key: weekKey,

        planned_qty:
          existingItem?.planned_qty ??
          plannedQty,

        carry_forward_qty:
          existingItem?.carry_forward_qty ?? 0,

        remaining_qty:
          existingItem?.remaining_qty ??
          plannedQty,

        ready:
          getOpenConstraintCount(
            task.id,
            data.constraints
          ) === 0,

        notes:
          existingItem?.notes ?? ''
      });
    });
  });

  const lookaheadItems = generatedLookaheadItems.filter((item) =>
    visibleWeeks.includes(item.week_key)
  );

  useEffect(() => {
    const missingItems = lookaheadItems.filter(
      (item) =>
        !data.lookahead.some(
          (existing) =>
            existing.task_id === item.task_id &&
            existing.week_key === item.week_key
        )
    );

    missingItems.forEach((item) => onAddToLookahead(item));
  }, [data.lookahead, lookaheadItems, onAddToLookahead]);

  const handleAddLookaheadConstraint = (taskId: string) => {
    const description = window.prompt('Constraint description');
    if (!description?.trim()) return;

    onAddConstraint({
      id: generateId('CON'),
      task_id: taskId,
      type: 'Materials',
      description: description.trim(),
      raised_by: 'Lookahead Planner',
      responsible: 'Site Team',
      raised_date: new Date().toISOString().split('T')[0],
      target_date: new Date().toISOString().split('T')[0],
      status: 'Open'
    });
  };

  const totalTasks = lookaheadItems.length;

  const readyTasks = lookaheadItems.filter((item) => {
    const openCount = getOpenConstraintCount(
      item.task_id,
      data.constraints
    );

    return openCount === 0;
  });

  const blockedTasks = lookaheadItems.filter((item) => {
    const openCount = getOpenConstraintCount(
      item.task_id,
      data.constraints
    );

    return openCount > 0;
  });

  const tmr =
    totalTasks > 0
      ? Math.round(
          (readyTasks.length / totalTasks) * 100
        )
      : null;

  const isTmrLow =
    tmr !== null && tmr < 70;

  /*
   * ---------------------------------------------------------
   * TMR BADGE
   * ---------------------------------------------------------
   */

  const getTmrBadgeColor = (
    val: number | null
  ) => {
    if (val === null) {
      return 'text-[#94a3b8] bg-slate-800';
    }

    if (val >= 80) {
      return 'text-[#10b981] bg-emerald-500/10 border-emerald-500/30';
    }

    if (val >= 70) {
      return 'text-[#f59e0b] bg-amber-500/10 border-amber-500/30';
    }

    return 'text-[#ef4444] bg-red-500/10 border-red-500/30';
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div
      id="lookahead-view"
      className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in"
    >

      {/* =====================================================
          TOP STATS
          ===================================================== */}

      <div
        id="lookahead-stats-grid"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >

        {/* Active Week */}
        <div className="p-4 rounded-lg bg-[#1e293b] border border-[#334155] shadow-sm">
          <div className="text-xs text-[#94a3b8] uppercase tracking-wider font-semibold">
            Active Lookahead Window
          </div>

          <div className="text-2xl font-extrabold text-[#f59e0b] mt-1.5 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#f59e0b]" />
            <span>Week {currentWeek}</span>
          </div>

          <div className="text-xs text-[#94a3b8] mt-1">
            3-5 Week Make-Ready Horizon
          </div>
        </div>

        {/* Pipeline */}
        <div className="p-4 rounded-lg bg-[#1e293b] border border-[#334155] shadow-sm">
          <div className="text-xs text-[#94a3b8] uppercase tracking-wider font-semibold">
            Lookahead Pipeline Size
          </div>

          <div className="text-2xl font-extrabold text-[#f8fafc] mt-1.5 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#38bdf8]" />
            <span>{totalTasks} Tasks</span>
          </div>

          <div className="text-xs text-[#94a3b8] mt-1">
            <span className="text-[#10b981] font-semibold">
              {readyTasks.length} ready
            </span>

            {' • '}

            <span className="text-[#ef4444] font-semibold">
              {blockedTasks.length} blocked
            </span>
          </div>
        </div>

        {/* TMR */}
        <div className="p-4 rounded-lg bg-[#1e293b] border border-[#334155] shadow-sm">
          <div className="text-xs text-[#94a3b8] uppercase tracking-wider font-semibold">
            Tasks Made Ready (TMR)
          </div>

          <div className="text-2xl font-extrabold mt-1.5 flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-md border text-xl ${getTmrBadgeColor(
                tmr
              )}`}
            >
              {tmr !== null
                ? `${tmr}%`
                : 'n/a'}
            </span>
          </div>

          <div className="text-xs text-[#94a3b8] mt-1">
            Target: ≥ 70% make-ready throughput
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-[#334155] bg-[#1e293b] p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94a3b8]">
            Lookahead Horizon
          </span>

          <div className="text-xs font-bold text-[#f8fafc]">
            {currentWeek}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[3, 4, 5].map((weeks) => (
            <button
              key={weeks}
              type="button"
              onClick={() =>
                setLookaheadWeeks(
                  weeks as 3 | 4 | 5
                )
              }
              className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                lookaheadWeeks === weeks
                  ? 'bg-[#38bdf8] text-[#0f172a] border-[#38bdf8]'
                  : 'bg-[#0f172a] text-[#94a3b8] border-[#334155] hover:bg-[#1e293b]'
              }`}
            >
              {weeks} Weeks
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================
          TMR WARNING
          ===================================================== */}

      {isTmrLow && (
        <div
          id="alert-low-tmr"
          className="p-4 rounded-lg bg-red-500/15 border-2 border-red-500/50 text-[#f8fafc] flex items-center gap-3 animate-pulse"
        >
          <AlertTriangle className="w-6 h-6 text-[#ef4444] shrink-0" />

          <div className="flex-1 text-xs">
            <div className="font-bold text-sm text-[#ef4444]">
              TMR below 70% ({tmr}%)
              — Constraints are not being cleared fast enough!
            </div>

            <div className="text-slate-300 mt-0.5">
              Work cannot flow reliably into the Weekly Work Plan.
              Escalate blocked drawings, material arrivals, and approvals immediately.
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Automatically populated from Phase Schedule
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Phase Schedule activities overlapping the selected horizon
              are automatically added to the Lookahead.
            </p>
          </div>

          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {lookaheadItems.length} task
            {lookaheadItems.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* =====================================================
          KANBAN BOARD
          ===================================================== */}

      <div
        id="lookahead-kanban-board"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >

        {/* ===================================================
            LEFT: NEEDS CLEARING
            =================================================== */}

        <div
          id="kanban-column-blocked"
          className="bg-[#1e293b] border border-red-500/30 rounded-lg p-5 flex flex-col shadow-md"
        >

          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#334155]">

            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#ef4444]" />

              <h3 className="text-sm font-bold text-[#f8fafc]">
                ⛔ Needs Clearing (Open Constraints)
              </h3>
            </div>

            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-red-500/20 text-[#ef4444] border border-red-500/30">
              {blockedTasks.length}
            </span>

          </div>

          {blockedTasks.length === 0 ? (

            <div className="py-12 text-center text-[#94a3b8] border border-dashed border-[#334155] rounded-lg">

              <CheckCircle2 className="w-8 h-8 text-[#10b981] mx-auto mb-2 opacity-80" />

              <p className="text-xs font-semibold text-[#f8fafc]">
                Zero Blocked Tasks!
              </p>

              <p className="text-[11px] text-[#94a3b8] mt-0.5">
                All lookahead items are fully make-ready.
              </p>

            </div>

          ) : (

            <div className="space-y-3 flex-1 overflow-y-auto">

              {blockedTasks.map((item) => {

                const task = data.tasks.find(
                  (t) => t.id === item.task_id
                );

                if (!task) return null;

                const taskConstraints =
                  data.constraints.filter(
                    (c) =>
                      c.task_id === task.id &&
                      c.status !== 'Resolved'
                  );

                const floatVal =
                  computeFloat(task);

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg bg-[#0f172a] border border-[#334155] hover:border-red-500/50 transition-all duration-200 shadow-sm space-y-3"
                  >

                    <div className="flex items-start justify-between gap-2">

                      <div>

                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-[#38bdf8] border border-slate-700">
                          {task.trade}
                        </span>

                        <h4 className="text-xs font-bold text-[#f8fafc] mt-1.5 leading-snug">
                          {task.description}
                        </h4>

                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-[#ef4444] border border-red-500/30 shrink-0">
                        ⛔ {taskConstraints.length} open
                      </span>

                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#94a3b8]">

                      <span>
                        Week: {item.week_key}
                        {' • '}
                        Qty: {item.planned_qty} {task.uom}
                      </span>

                      <span className="font-mono text-[10px]">
                        Float: {floatVal}d
                      </span>

                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#94a3b8]">
                      <div>Quantity: <strong className="text-[#f8fafc]">{item.planned_qty}</strong></div>
                      <div>UOM: <strong className="text-[#f8fafc]">{task.uom || '—'}</strong></div>
                      <div>Target Finish: <strong className="text-[#f8fafc]">{formatDate(task.epf || task.must_finish_by || task.lpf)}</strong></div>
                      <div>Status: <strong className="text-[#ef4444]">Not Ready</strong></div>
                    </div>

                    {item.notes && (
                      <div className="text-[11px] text-[#64748b] bg-slate-900/80 p-2 rounded border border-slate-800">
                        {item.notes}
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-[#334155]/60">

                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#ef4444]">
                        Blocking Constraints:
                      </div>

                      {taskConstraints.map((c) => (
                        <div
                          key={c.id}
                          className="p-2 rounded bg-slate-900 border border-[#334155] text-xs flex items-center justify-between gap-2"
                        >

                          <div>

                            <div className="font-semibold text-[11px] text-[#f8fafc]">
                              [{c.type}] {c.description}
                            </div>

                            <div className="text-[10px] text-[#94a3b8]">
                              Owner: {c.responsible}
                              {' • '}
                              Target: {formatDate(c.target_date)}
                            </div>

                          </div>

                          <button
                            id={`btn-resolve-lkh-${c.id}`}
                            onClick={() =>
                              onResolveConstraint(c.id)
                            }
                            className="px-2 py-1 rounded bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] border border-[#10b981]/40 font-bold text-[10px] transition-all shrink-0 cursor-pointer"
                          >
                            Resolve
                          </button>

                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleAddLookaheadConstraint(task.id)}
                        className="text-left text-[11px] font-bold text-[#f59e0b] hover:text-[#f8fafc]"
                      >
                        + Add Constraint
                      </button>

                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </div>

        {/* ===================================================
            RIGHT: READY TO COMMIT
            =================================================== */}

        <div
          id="kanban-column-ready"
          className="bg-[#1e293b] border border-emerald-500/30 rounded-lg p-5 flex flex-col shadow-md"
        >

          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#334155]">

            <div className="flex items-center gap-2">

              <CheckCircle2 className="w-4 h-4 text-[#10b981]" />

              <h3 className="text-sm font-bold text-[#f8fafc]">
                ✅ Ready to Commit (Zero Roadblocks)
              </h3>

            </div>

            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-[#10b981] border border-emerald-500/30">
              {readyTasks.length}
            </span>

          </div>

          {readyTasks.length === 0 ? (

            <div className="py-12 text-center text-[#94a3b8] border border-dashed border-[#334155] rounded-lg">

              <AlertTriangle className="w-8 h-8 text-[#f59e0b] mx-auto mb-2 opacity-80" />

              <p className="text-xs font-semibold text-[#f8fafc]">
                No Ready Tasks Available
              </p>

              <p className="text-[11px] text-[#94a3b8] mt-0.5">
                Resolve constraints in the left column to unblock tasks.
              </p>

            </div>

          ) : (

            <div className="space-y-3 flex-1 overflow-y-auto">

              {readyTasks.map((item) => {

                const task = data.tasks.find(
                  (t) => t.id === item.task_id
                );

                if (!task) return null;

                const floatVal =
                  computeFloat(task);

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg bg-[#0f172a] border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-200 shadow-sm space-y-2.5"
                  >

                    <div className="flex items-start justify-between gap-2">

                      <div>

                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-[#38bdf8] border border-slate-700">
                          {task.trade}
                        </span>

                        <h4 className="text-xs font-bold text-[#f8fafc] mt-1.5 leading-snug">
                          {task.description}
                        </h4>

                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-[#10b981] border border-emerald-500/30 shrink-0">
                        ✅ 100% Ready
                      </span>

                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#94a3b8]">

                      <span>
                        Week: {item.week_key}
                        {' • '}
                        Qty: {item.planned_qty} {task.uom}
                      </span>

                      <span className="font-mono text-[10px] text-emerald-400">
                        Float: {floatVal}d
                      </span>

                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#94a3b8]">
                      <div>Quantity: <strong className="text-[#f8fafc]">{item.planned_qty}</strong></div>
                      <div>UOM: <strong className="text-[#f8fafc]">{task.uom || '—'}</strong></div>
                      <div>Target Finish: <strong className="text-[#f8fafc]">{formatDate(task.epf || task.must_finish_by || task.lpf)}</strong></div>
                      <div>Status: <strong className="text-[#10b981]">Ready</strong></div>
                    </div>

                    <div className="border-t border-[#334155]/60 pt-2 text-[11px] text-[#94a3b8]">
                      <div className="font-bold uppercase tracking-wider text-[#10b981]">Constraints</div>
                      <div className="mt-1">Material · Drawing · Manpower · Access</div>
                      <button
                        type="button"
                        onClick={() => handleAddLookaheadConstraint(task.id)}
                        className="mt-2 text-left font-bold text-[#f59e0b] hover:text-[#f8fafc]"
                      >
                        + Add Constraint
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#94a3b8] pt-1">

                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {task.responsible}
                      </span>

                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {task.location}
                      </span>

                    </div>

                    {item.notes && (
                      <div className="text-[11px] text-[#64748b] bg-slate-900/80 p-2 rounded border border-slate-800">
                        {item.notes}
                      </div>
                    )}

                  </div>
                );
              })}

            </div>
          )}

          {/* Proceed */}
          <div className="mt-4 pt-3 border-t border-[#334155] text-center">

            <button
              id="btn-goto-weekly-commit"
              onClick={onNavigateToCommit}
              className="w-full py-2.5 bg-[#10b981] hover:bg-emerald-600 active:scale-[0.98] text-[#0f172a] font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              <span>
                Proceed to Weekly Commitments
              </span>

              <ArrowRight className="w-4 h-4" />
            </button>

          </div>

        </div>
      </div>

      {/* =====================================================
          FLOW INFORMATION
          ===================================================== */}

      <div
        id="lookahead-flow-info"
        className="p-4 rounded-lg bg-slate-900/60 border border-[#334155]"
      >

        <div className="flex items-start gap-3">

          <Clock className="w-4 h-4 text-[#38bdf8] mt-0.5 shrink-0" />

          <div>

            <div className="text-xs font-bold text-[#f8fafc]">
              LPS Flow
            </div>

            <div className="text-[11px] text-[#94a3b8] mt-1">
              Phase Schedule → Lookahead → Weekly Plan / Commitment → Daily Check-in → Closeout
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};