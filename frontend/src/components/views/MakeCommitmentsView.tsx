import React, { useState } from 'react';
import {
  CheckSquare,
  ShieldCheck,
  CheckCircle2,
  User,
  Plus,
  ArrowRight,
  Clock
} from 'lucide-react';
import { Commitment, LPSData, Task } from '../../types';
import { generateId, getOpenConstraintCount } from '../../services/storage';

interface MakeCommitmentsViewProps {
  data: LPSData;
  currentWeek: string;
  onAddCommitment: (commitment: Commitment) => void;
  onNavigateToCloseout: () => void;
}

export const MakeCommitmentsView: React.FC<MakeCommitmentsViewProps> = ({
  data,
  currentWeek,
  onAddCommitment,
  onNavigateToCloseout
}) => {
  const [committingTaskId, setCommittingTaskId] = useState<string | null>(null);
  const [committedByName, setCommittedByName] = useState('');

  /*
   * ============================================================
   * AUTOMATIC QUANTITY / PROGRESS HELPERS
   * ============================================================
   */

  /**
   * Get actual achieved quantity for a commitment.
   *
   * The existing actuals structure contains:
   * - commitment_id
   * - day_date
   * - planned_qty
   * - achieved_qty
   *
   * We aggregate all achieved quantities belonging to the
   * commitment.
   */
  const getAchievedQuantity = (commitmentId: string): number => {
    const actuals = (data as any).actuals ?? [];

    return actuals
      .filter((actual: any) => actual.commitment_id === commitmentId)
      .reduce(
        (total: number, actual: any) =>
          total + Number(actual.achieved_qty ?? 0),
        0
      );
  };

  /**
   * Get planned quantity.
   *
   * Priority:
   * 1. Lookahead planned quantity
   * 2. Actual planned quantity
   * 3. Task quantity if available
   * 4. 0
   */
  const getPlannedQuantity = (
    commitment: Commitment,
    task: Task
  ): number => {
    const lookahead = data.lookahead.find(
      (l) => l.task_id === commitment.task_id
    );

    if (lookahead && Number(lookahead.planned_qty) > 0) {
      return Number(lookahead.planned_qty);
    }

    const actuals = (data as any).actuals ?? [];

    const commitmentActuals = actuals.filter(
      (actual: any) =>
        actual.commitment_id === commitment.id
    );

    const actualPlannedQty = commitmentActuals.reduce(
      (total: number, actual: any) =>
        total + Number(actual.planned_qty ?? 0),
      0
    );

    if (actualPlannedQty > 0) {
      return actualPlannedQty;
    }

    const taskAny = task as any;

    if (Number(taskAny.quantity) > 0) {
      return Number(taskAny.quantity);
    }

    if (Number(taskAny.planned_qty) > 0) {
      return Number(taskAny.planned_qty);
    }

    return 0;
  };

  /**
   * Automatically calculate progress percentage.
   *
   * achieved / planned * 100
   */
  const getProgressPercent = (
    commitment: Commitment,
    task: Task
  ): number => {
    if (commitment.outcome === 'done') {
      return 100;
    }

    const planned = getPlannedQuantity(commitment, task);
    const achieved = getAchievedQuantity(commitment.id);

    if (planned <= 0) {
      return Number(commitment.progress_percent ?? 0);
    }

    const percentage = (achieved / planned) * 100;

    return Math.min(
      100,
      Math.max(0, Math.round(percentage))
    );
  };

  /*
   * ============================================================
   * CURRENT WEEK COMMITMENTS
   * ============================================================
   */

  const committedTaskIds = new Set(
    data.commitments
      .filter((c) => c.week_key === currentWeek)
      .map((c) => c.task_id)
  );

  /*
   * Only ready Lookahead tasks can be committed.
   *
   * IMPORTANT:
   * The week is automatically tied to currentWeek.
   */
  const readyLookaheadTasks = data.lookahead
    .filter((l) => {
      const openCount = getOpenConstraintCount(
        l.task_id,
        data.constraints
      );

      return (
        openCount === 0 &&
        !committedTaskIds.has(l.task_id)
      );
    })
    .map((l) => {
      const task = data.tasks.find(
        (t) => t.id === l.task_id
      );

      return {
        lookahead: l,
        task
      };
    })
    .filter(
      (
        item
      ): item is {
        lookahead: typeof item.lookahead;
        task: Task;
      } => !!item.task
    );

  /*
   * ============================================================
   * THIS WEEK'S COMMITMENTS
   * ============================================================
   */

  const thisWeekCommitments = data.commitments
    .filter((c) => c.week_key === currentWeek)
    .map((c) => {
      const task = data.tasks.find(
        (t) => t.id === c.task_id
      );

      return {
        commitment: c,
        task
      };
    });

  const countDone = thisWeekCommitments.filter(
    (c) => c.commitment.outcome === 'done'
  ).length;

  const countNotDone = thisWeekCommitments.filter(
    (c) => c.commitment.outcome === 'not_done'
  ).length;

  const countPending = thisWeekCommitments.filter(
    (c) =>
      !c.commitment.outcome ||
      c.commitment.outcome === 'pending'
  ).length;

  /*
   * ============================================================
   * COMMIT TASK
   * ============================================================
   */

  const handleStartCommit = (task: Task) => {
    setCommittingTaskId(task.id);
    setCommittedByName(
      task.responsible || 'Trade Foreman'
    );
  };

  const handleConfirmCommit = (taskId: string) => {
    if (!committedByName.trim()) return;

    const selectedLookahead = readyLookaheadTasks.find(
      ({ task }) => task.id === taskId
    )?.lookahead;

    const newCommitment: Commitment = {
      id: generateId('COM'),
      task_id: taskId,

      // AUTOMATICALLY USE ACTIVE WEEK
      week_key: currentWeek,

      committed_by: committedByName.trim(),
      outcome: 'pending',
      lookahead_id: selectedLookahead?.id ?? null,

      // Progress is calculated from actual quantities.
      progress_percent: 0,
      planned_qty: Number(
        selectedLookahead?.planned_qty ?? 0
      ),
      actual_qty: 0
    };

    onAddCommitment(newCommitment);

    setCommittingTaskId(null);
    setCommittedByName('');
  };

  return (
    <div
      id="make-commitments-view"
      className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in"
    >
      {/* ======================================================
          LPS RULE ALERT
      ====================================================== */}

      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[#f8fafc] flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-[#f59e0b] shrink-0" />

        <div className="text-xs">
          <div className="font-bold text-sm text-[#f59e0b]">
            LPS Enforced Rule: Make-Ready Commitment Gate
          </div>

          <div className="text-[#94a3b8] mt-0.5">
            Only tasks with 100% Ready status (zero open
            constraints) can be committed to the Weekly Work
            Plan. Unready tasks are strictly filtered out to
            protect site workflow.
          </div>
        </div>
      </div>

      {/* ======================================================
          WEEK SUMMARY
      ====================================================== */}

      <div className="p-5 rounded-lg bg-[#1e293b] border border-[#334155] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#f8fafc] flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#10b981]" />

            <span>
              Weekly Work Plan — Week {currentWeek}
            </span>
          </h2>

          <p className="text-xs text-[#94a3b8] mt-0.5">
            The commitment week is automatically linked to
            the currently selected planning week.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[#10b981] font-bold">
            ✅ Done: {countDone}
          </span>

          <span className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-[#ef4444] font-bold">
            ❌ Not Done: {countNotDone}
          </span>

          <span className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[#f59e0b] font-bold">
            ⏳ Pending: {countPending}
          </span>
        </div>
      </div>

      {/* ======================================================
          READY TASKS
      ====================================================== */}

      <div
        id="ready-tasks-to-commit-section"
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10b981]" />

            <span>
              Available Ready Tasks Eligible for Commitment (
              {readyLookaheadTasks.length}
              )
            </span>
          </h3>

          <span className="text-xs text-[#94a3b8]">
            Filtered from Lookahead — Week {currentWeek}
          </span>
        </div>

        {readyLookaheadTasks.length === 0 ? (
          <div className="p-8 text-center bg-[#1e293b] border border-dashed border-[#334155] rounded-lg text-[#94a3b8]">
            <p className="text-xs font-semibold text-[#f8fafc]">
              No additional ready tasks to commit.
            </p>

            <p className="text-[11px] text-[#94a3b8] mt-1">
              Either all ready tasks have already been
              committed, or pending constraints in Lookahead
              need to be resolved.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyLookaheadTasks.map(
              ({ task, lookahead }) => {
                const isCommittingThis =
                  committingTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className="p-5 rounded-lg bg-[#1e293b] border border-emerald-500/30 hover:border-emerald-500/60 transition-all shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0f172a] text-[#38bdf8] border border-slate-700">
                          {task.trade}
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-[#10b981] border border-emerald-500/30">
                          Ready
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[#f8fafc] mb-2 leading-snug">
                        {task.description}
                      </h4>

                      <div className="text-[11px] text-[#94a3b8] space-y-1 mb-3">
                        <div>
                          Lead:{' '}
                          <strong className="text-[#f8fafc]">
                            {task.responsible}
                          </strong>
                        </div>

                        <div>
                          Zone: {task.location}
                        </div>

                        <div>
                          Target Qty:{' '}
                          <strong className="text-[#f8fafc]">
                            {lookahead.planned_qty}
                          </strong>{' '}
                          {task.uom}
                        </div>

                        <div className="text-[#38bdf8]">
                          Commitment Week:{' '}
                          <strong>
                            {currentWeek}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* ==================================================
                        COMMIT ACTION
                    ================================================== */}

                    <div className="pt-3 border-t border-[#334155]">
                      {isCommittingThis ? (
                        <div className="space-y-2 bg-[#0f172a] p-3 rounded-lg border border-amber-500/30">
                          <label className="block text-[11px] font-semibold text-[#f59e0b]">
                            Committer Name (Last Planner):
                          </label>

                          <input
                            type="text"
                            autoFocus
                            value={committedByName}
                            onChange={(e) =>
                              setCommittedByName(
                                e.target.value
                              )
                            }
                            placeholder="e.g. Gopal Krishna (Rebar Lead)"
                            className="w-full px-2.5 py-1.5 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
                          />

                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setCommittingTaskId(null)
                              }
                              className="px-2.5 py-1 text-xs text-[#94a3b8] hover:text-[#f8fafc] cursor-pointer"
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleConfirmCommit(
                                  task.id
                                )
                              }
                              className="px-3 py-1 bg-[#10b981] hover:bg-emerald-600 text-[#0f172a] font-bold text-xs rounded transition-colors cursor-pointer"
                            >
                              Lock Promise
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          id={`btn-commit-task-${task.id}`}
                          onClick={() =>
                            handleStartCommit(task)
                          }
                          className="w-full py-2 bg-[#10b981]/20 hover:bg-[#10b981] hover:text-[#0f172a] text-[#10b981] border border-[#10b981]/40 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />

                          <span>
                            + Commit This Task
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* ======================================================
          THIS WEEK'S COMMITMENTS
      ====================================================== */}

      <div
        id="committed-tasks-section"
        className="space-y-4 pt-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[#f59e0b]" />

            <span>
              Active Commitments for Week {currentWeek} (
              {thisWeekCommitments.length}
              )
            </span>
          </h3>

          <button
            onClick={onNavigateToCloseout}
            className="text-xs text-[#f59e0b] hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            <span>Closeout Ceremony</span>

            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {thisWeekCommitments.length === 0 ? (
          <div className="p-12 text-center bg-[#1e293b] border border-dashed border-[#334155] rounded-lg text-[#94a3b8]">
            <Clock className="w-10 h-10 mx-auto text-[#64748b] mb-2" />

            <p className="font-semibold text-[#f8fafc]">
              No Commitments Locked for This Week
            </p>

            <p className="text-xs mt-1">
              Select from the ready tasks above to make
              reliable work promises.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {thisWeekCommitments.map(
              ({ commitment, task }) => {
                if (!task) return null;

                /*
                 * =====================================================
                 * AUTOMATIC QUANTITY + PROGRESS
                 * =====================================================
                 */

                const lookaheadItem = data.lookahead.find(
                  (l) => l.task_id === commitment.task_id
                );

                const plannedQty =
                  Number(
                    commitment.planned_qty ??
                      lookaheadItem?.planned_qty ??
                      0
                  );

                const achievedQty = data.actuals
                  .filter(
                    (a) => a.commitment_id === commitment.id
                  )
                  .reduce(
                    (sum, a) =>
                      sum + Number(a.achieved_qty ?? 0),
                    0
                  );

                const progress =
                  plannedQty > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (achievedQty / plannedQty) *
                            100
                        )
                      )
                    : 0;

                const outcomeBadge = {
                  done: (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-[#10b981] border border-emerald-500/30">
                      ✅ Done
                    </span>
                  ),

                  not_done: (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-[#ef4444] border border-red-500/30">
                      ❌ Not Done
                    </span>
                  ),

                  pending: (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-[#f59e0b] border border-amber-500/30">
                      ⏳ Pending
                    </span>
                  )
                }[
                  commitment.outcome || 'pending'
                ];

                return (
                  <div
                    key={commitment.id}
                    className="p-4 rounded-lg bg-[#1e293b] border border-[#334155] shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0f172a] text-[#38bdf8] border border-slate-700">
                          {task.trade}
                        </span>

                        <h4 className="text-xs font-bold text-[#f8fafc]">
                          {task.description}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#94a3b8]">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-[#64748b]" />

                          <span>
                            Committed By:{' '}
                            <strong className="text-[#f8fafc]">
                              {commitment.committed_by}
                            </strong>
                          </span>
                        </div>

                        <div>
                          Location: {task.location}
                        </div>

                        <div>
                          Duration:{' '}
                          {task.duration_days} days
                        </div>
                      </div>

                      {/* Quantity information */}
                      <div className="flex flex-wrap gap-3 mt-3 text-[11px]">
                        <div className="px-3 py-1.5 rounded bg-[#0f172a] border border-[#334155]">
                          <span className="text-[#94a3b8]">
                            Planned Qty:{' '}
                          </span>

                          <strong className="text-[#f8fafc]">
                            {plannedQty} {task.uom}
                          </strong>
                        </div>

                        <div className="px-3 py-1.5 rounded bg-[#0f172a] border border-[#334155]">
                          <span className="text-[#94a3b8]">
                            Achieved Qty:{' '}
                          </span>

                          <strong className="text-[#10b981]">
                            {achievedQty} {task.uom}
                          </strong>
                        </div>

                        <div className="px-3 py-1.5 rounded bg-[#0f172a] border border-[#334155]">
                          <span className="text-[#94a3b8]">
                            Progress:{' '}
                          </span>

                          <strong className="text-[#f59e0b]">
                            {progress}%
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* ==================================================
                        AUTOMATIC PROGRESS
                    ================================================== */}

                    <div className="sm:w-64 flex flex-col items-end gap-2">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] text-[#94a3b8]">
                          Progress:{' '}
                          <strong className="text-[#f8fafc]">
                            {progress}%
                          </strong>
                        </span>

                        {outcomeBadge}
                      </div>

                      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            commitment.outcome ===
                            'done'
                              ? 'bg-[#10b981]'
                              : commitment.outcome ===
                                'not_done'
                              ? 'bg-[#ef4444]'
                              : 'bg-[#f59e0b]'
                          }`}
                          style={{
                            width: `${progress}%`
                          }}
                        />
                      </div>

                      <span className="text-[10px] text-[#64748b]">
                        {achievedQty} / {plannedQty}{' '}
                        {task.uom}
                      </span>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
};