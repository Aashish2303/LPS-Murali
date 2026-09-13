import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ShieldAlert, CheckCircle2, Save, Calendar, Clock } from 'lucide-react';
import { ActualEntry, LPSData, REASON_CODES } from '../../types';
import { formatDate, generateId } from '../../services/storage';

interface DailyCheckInViewProps {
  data: LPSData;
  currentWeek: string;
  onSaveDailyActual: (actual: ActualEntry) => void;
  onResolveConstraint: (constraintId: string) => void;
}

export const DailyCheckInView: React.FC<DailyCheckInViewProps> = ({
  data,
  currentWeek,
  onSaveDailyActual,
  onResolveConstraint
}) => {
  const getLocalISODate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const todayIso = getLocalISODate();

  const pendingCommitments = useMemo(() => {
    return data.commitments
      .filter(
        (c) =>
          c.week_key === currentWeek &&
          c.outcome !== 'done'
      )
      .map((commitment) => {
        const task = data.tasks.find(
          (t) => t.id === commitment.task_id
        );

        const existingActual = data.actuals.find(
          (a) =>
            a.commitment_id === commitment.id &&
            a.day_date === todayIso
        );

        const matchingLookaheadItems = data.lookahead.filter(
          (l) => l.task_id === commitment.task_id
        );

        const lookaheadItem =
          matchingLookaheadItems.find(
            (l) => l.week_key === commitment.week_key
          ) ||
          matchingLookaheadItems[
            matchingLookaheadItems.length - 1
          ];

        return {
          commitment,
          task,
          existingActual,
          lookaheadItem
        };
      })
      .filter(
        (
          item
        ): item is {
          commitment: typeof item.commitment;
          task: NonNullable<typeof item.task>;
          existingActual: ActualEntry | undefined;
          lookaheadItem: typeof item.lookaheadItem;
        } => !!item.task
      );
  }, [
    data.commitments,
    data.tasks,
    data.actuals,
    data.lookahead,
    currentWeek,
    todayIso
  ]);

  type RowState = {
    planned: number;
    achieved: number;
    note: string;
    reasonCode: number | null;
    saved: boolean;
  };

  const [rowStates, setRowStates] = useState<
    Record<string, RowState>
  >({});

  useEffect(() => {
    setRowStates((previous) => {
      const next: Record<string, RowState> = {};

      pendingCommitments.forEach(
        ({ commitment, existingActual, lookaheadItem }) => {
          const previousRow = previous[commitment.id];

          if (existingActual) {
            next[commitment.id] = {
              planned: Number(existingActual.planned_qty) || 0,
              achieved: Number(existingActual.achieved_qty) || 0,
              note: existingActual.note || '',
              reasonCode: existingActual.reason_code ?? null,
              saved: true
            };
            return;
          }

          if (previousRow && !previousRow.saved) {
            next[commitment.id] = previousRow;
            return;
          }

          next[commitment.id] = {
            planned:
              lookaheadItem?.planned_qty != null
                ? Number(lookaheadItem.planned_qty)
                : 0,
            achieved: 0,
            note: '',
            reasonCode: null,
            saved: false
          };
        }
      );

      return next;
    });
  }, [pendingCommitments]);

  const handleRowChange = (
    commitmentId: string,
    field: 'planned' | 'achieved' | 'note' | 'reasonCode',
    value: number | string | null
  ) => {
    setRowStates((prev) => ({
      ...prev,
      [commitmentId]: {
        ...(prev[commitmentId] || {
          planned: 0,
          achieved: 0,
          note: '',
          reasonCode: null,
          saved: false
        }),
        [field]: value,
        saved: false
      }
    }));
  };

  const handleSaveRow = (commitmentId: string) => {
    const row = rowStates[commitmentId];
    if (!row) return;

    const planned = Number(row.planned) || 0;
    const achieved = Number(row.achieved) || 0;

    if (achieved < planned && !row.reasonCode) {
      return;
    }

    const existingActual = data.actuals.find(
      (a) =>
        a.commitment_id === commitmentId &&
        a.day_date === todayIso
    );

    const actual: ActualEntry = {
      id: existingActual?.id || generateId('ACT'),
      commitment_id: commitmentId,
      day_date: todayIso,
      planned_qty: Math.max(0, planned),
      achieved_qty: Math.max(0, achieved),
      note: row.note?.trim() || '',
      reason_code: achieved < planned ? row.reasonCode : null
    };

    onSaveDailyActual(actual);

    setRowStates((prev) => ({
      ...prev,
      [commitmentId]: {
        ...prev[commitmentId],
        saved: true
      }
    }));
  };

  // Open constraints
  const openConstraints = data.constraints
    .filter((c) => c.status !== 'Resolved')
    .map((c) => {
      const task = data.tasks.find((t) => t.id === c.task_id);
      return { ...c, taskName: task?.description || c.task_id };
    });

  return (
    <div id="daily-checkin-view" className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Top Banner with Today's Date */}
      <div className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-[#f59e0b]" />
            <h2 className="text-lg font-bold text-[#f8fafc]">Daily Stand-Up Coordination Huddle</h2>
          </div>
          <p className="text-xs text-[#94a3b8] mt-1">
            10-15 minute stand-up to review daily output, identify variances within 24 hours, and clear immediate constraints.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-lg bg-[#0f172a] border border-[#334155] text-right">
            <div className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-wider">Site Date</div>
            <div className="text-sm font-extrabold text-[#f59e0b] flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(todayIso)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Commitments List */}
      <div id="daily-commitments-section" className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#f59e0b]" />
            <span>Active Commitments Tracking ({pendingCommitments.length})</span>
          </h3>
          <span className="text-xs text-[#94a3b8]">Live quantity variance scoring</span>
        </div>

        {pendingCommitments.length === 0 ? (
          <div className="py-10 text-center text-[#94a3b8] border border-dashed border-[#334155] rounded-lg">
            <CheckCircle2 className="w-8 h-8 text-[#10b981] mx-auto mb-2" />
            <p className="text-xs font-semibold text-[#f8fafc]">All Commitments Complete or None Pending!</p>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">Check Make Commitments or perform Weekly Closeout.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingCommitments.map(
              ({ commitment, task, lookaheadItem }) => {
              if (!task) return null;

              const row = rowStates[commitment.id] || {
                planned:
                  lookaheadItem?.planned_qty != null
                    ? Number(lookaheadItem.planned_qty)
                    : 0,
                achieved: 0,
                note: '',
                saved: false
              };
              const planned = Number(row.planned) || 0;
              const achieved = Number(row.achieved) || 0;

              // Color code achieved input: green when >= planned, amber when partial > 0, red when 0
              let achievedStyle = 'border-slate-700 bg-[#0f172a] text-[#f8fafc]';
              if (achieved > 0 && achieved >= planned) {
                achievedStyle = 'border-[#10b981] bg-emerald-500/10 text-[#10b981] font-bold';
              } else if (achieved > 0 && achieved < planned) {
                achievedStyle = 'border-[#f59e0b] bg-amber-500/10 text-[#f59e0b] font-bold';
              } else if (achieved === 0) {
                achievedStyle = 'border-[#ef4444] bg-red-500/10 text-[#ef4444] font-bold';
              }

              return (
                <div
                  key={commitment.id}
                  className="p-4 rounded-lg bg-[#0f172a] border border-[#334155] hover:border-[#64748b] transition-all grid grid-cols-1 lg:grid-cols-12 gap-3 items-center"
                >
                  {/* Task & Trade info */}
                  <div className="lg:col-span-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-[#38bdf8] border border-slate-700">
                        {task.trade}
                      </span>
                      <span className="text-[11px] text-[#94a3b8] truncate">
                        By: <strong className="text-[#f8fafc]">{commitment.committed_by}</strong>
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#f8fafc] line-clamp-1">{task.description}</div>
                    <div className="text-[10px] text-[#94a3b8] mt-0.5">Location: {task.location} ({task.uom})</div>
                  </div>

                  {/* Planned quantity from Lookahead */}
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-semibold text-[#94a3b8] mb-1">Planned Today</label>
                    <input
                      type="number"
                      value={planned}
                      readOnly
                      className="w-full px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-sm text-[#38bdf8] font-bold cursor-not-allowed"
                    />
                  </div>

                  {/* Achieved Input with Dynamic Colors */}
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-semibold text-[#94a3b8] mb-1">Achieved Today</label>
                    <input
                      type="number"
                      min="0"
                      value={row.achieved}
                      onChange={(e) => handleRowChange(commitment.id, 'achieved', Number(e.target.value))}
                      className={`w-full px-2.5 py-1.5 border rounded text-xs focus:outline-none transition-all ${achievedStyle}`}
                    />
                  </div>

                  {/* Note Input */}
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-semibold text-[#94a3b8] mb-1">Daily Log Note</label>
                    <input
                      type="text"
                      placeholder="e.g. 18 units cured"
                      value={row.note}
                      onChange={(e) => handleRowChange(commitment.id, 'note', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#1e293b] border border-[#334155] rounded text-xs text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none"
                    />

                    {Number(row.achieved || 0) < Number(row.planned || 0) && (
                      <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        <label className="block text-xs font-bold text-red-400 mb-2">
                          Delay Reason Code *
                        </label>

                        <select
                          value={row.reasonCode ?? ''}
                          onChange={(e) =>
                            handleRowChange(
                              commitment.id,
                              'reasonCode',
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          className="w-full px-3 py-2 bg-[#0f172a] border border-red-500/40 rounded-lg text-xs text-[#f8fafc] focus:outline-none"
                        >
                          <option value="">
                            Select delay reason...
                          </option>

                          {REASON_CODES.map((rc) => (
                            <option key={rc.id} value={rc.id}>
                              {rc.code}: {rc.title}
                            </option>
                          ))}
                        </select>

                        {!row.reasonCode && (
                          <p className="text-[10px] text-red-400 mt-1">
                            Required when actual is less than planned.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Save Button */}
                  <div className="lg:col-span-1 flex justify-end">
                    <button
                      id={`btn-save-actual-${commitment.id}`}
                      type="button"
                      onClick={() => handleSaveRow(commitment.id)}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        row.saved
                          ? 'bg-emerald-500/20 text-[#10b981] border border-emerald-500/30'
                          : 'bg-[#f59e0b] hover:bg-amber-600 text-[#0f172a]'
                      }`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{row.saved ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              );
              }
            )}
          </div>
        )}
      </div>

      {/* Open Constraints Quick Resolution Section */}
      <div id="daily-constraints-section" className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#ef4444]" />
            <span>Open Roadblocks Requiring Today's Action ({openConstraints.length})</span>
          </h3>
          <span className="text-xs text-[#94a3b8]">Resolve during standup to unblock crews</span>
        </div>

        {openConstraints.length === 0 ? (
          <div className="py-8 text-center text-[#94a3b8] border border-dashed border-[#334155] rounded-lg">
            <p className="text-xs font-semibold text-[#f8fafc]">Zero Open Roadblocks</p>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">All constraints resolved for current active work.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {openConstraints.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-lg bg-[#0f172a] border border-[#334155] flex items-center justify-between gap-3 hover:border-red-500/40 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-[#ef4444] border border-red-500/30">
                      {c.type}
                    </span>
                    <span className="text-xs font-bold text-[#f8fafc]">{c.description}</span>
                  </div>
                  <div className="text-[10px] text-[#94a3b8] mt-1">
                    For: {c.taskName} • Owner: <strong className="text-[#f8fafc]">{c.responsible}</strong> • Target: {formatDate(c.target_date)}
                  </div>
                </div>

                <button
                  id={`btn-daily-resolve-${c.id}`}
                  onClick={() => onResolveConstraint(c.id)}
                  className="px-3 py-1 rounded bg-[#10b981]/20 hover:bg-[#10b981] hover:text-[#0f172a] text-[#10b981] border border-[#10b981]/40 font-bold text-xs transition-all shrink-0 cursor-pointer"
                >
                  ✅ Mark Resolved
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
