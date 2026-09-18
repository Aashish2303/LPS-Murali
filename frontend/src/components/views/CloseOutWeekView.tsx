import React, { useMemo, useState } from 'react';
import {
  Award,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Lock,
  Calendar
} from 'lucide-react';
import { LPSData, REASON_CODES } from '../../types';
import { computeMetrics, getCoachingDiagnosis } from '../../services/storage';

interface CloseOutWeekViewProps {
  data: LPSData;
  currentWeek: string;
  onUpdateCommitmentOutcome: (commitmentId: string, outcome: 'done' | 'not_done', reasonCode?: number, actualQty?: number) => void;
  onCloseOutWeek: (
    weekKey: string,
    finalPpc: number,
    closeoutDate: string
  ) => void;
  onNavigateToDashboard: () => void;
}

export const CloseOutWeekView: React.FC<CloseOutWeekViewProps> = ({
  data,
  currentWeek,
  onUpdateCommitmentOutcome,
  onCloseOutWeek,
  onNavigateToDashboard
}) => {
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [closedPpc, setClosedPpc] = useState<number | null>(null);
  const [closeoutDate, setCloseoutDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const weekCommitments = useMemo(() => {
    return data.commitments
      .filter((commitment) => commitment.week_key === currentWeek)
      .map((commitment) => {
        const task = data.tasks.find(
          (item) => item.id === commitment.task_id
        );

        const lookahead = data.lookahead.find(
          (item) =>
            item.task_id === commitment.task_id &&
            item.week_key === commitment.week_key
        ) ||
        data.lookahead.find(
          (item) => item.task_id === commitment.task_id
        );

        const plannedQty = Number(
          commitment.planned_qty ??
            lookahead?.planned_qty ??
            0
        );

        const actualQty = Number(
          commitment.actual_qty ?? 0
        );

        const quantityProgress =
          plannedQty > 0
            ? Math.min(
                100,
                Math.round(
                  (actualQty / plannedQty) * 100
                )
              )
            : 0;

        return {
          commitment,
          task,
          lookahead,
          plannedQty,
          actualQty,
          quantityProgress
        };
      });
  }, [data.commitments, data.tasks, data.lookahead, currentWeek]);

  const totalCommitted = weekCommitments.length;
  const doneCount = weekCommitments.filter((c) => c.commitment.outcome === 'done').length;
  const notDoneCount = weekCommitments.filter((c) => c.commitment.outcome === 'not_done').length;
  const pendingCount = weekCommitments.filter(
    (c) => !c.commitment.outcome || c.commitment.outcome === 'pending'
  ).length;

  // Validation: Every commitment has an outcome AND every Not Done has a valid reason_code
  const allRecorded =
    totalCommitted > 0 &&
    weekCommitments.every((c) => {
      if (c.commitment.outcome === 'done') return true;
      if (c.commitment.outcome === 'not_done') return !!c.commitment.reason_code;
      return false;
    });

  // Live PPC Preview (Binary)
  const livePpc = totalCommitted > 0 ? Math.round((doneCount / totalCommitted) * 100) : 0;

  const handleSelectReason = (commitmentId: string, reasonCode: number) => {
    onUpdateCommitmentOutcome(commitmentId, 'not_done', reasonCode);
  };

  const handleExecuteCloseOut = () => {
    if (!allRecorded) return;

    onCloseOutWeek(
      currentWeek,
      livePpc,
      closeoutDate
    );

    setClosedPpc(livePpc);
    setShowRevealModal(true);
  };

  const getPpcColor = (ppc: number) => {
    if (ppc >= 80) return { text: 'text-[#10b981]', btn: 'bg-[#10b981] hover:bg-emerald-600', border: 'border-[#10b981]' };
    if (ppc >= 60) return { text: 'text-[#f59e0b]', btn: 'bg-[#f59e0b] hover:bg-amber-600', border: 'border-[#f59e0b]' };
    return { text: 'text-[#ef4444]', btn: 'bg-[#ef4444] hover:bg-red-600', border: 'border-[#ef4444]' };
  };

  const ppcColor = getPpcColor(livePpc);

  // Compute full metrics for reveal dialog
  const currentMetrics = computeMetrics(currentWeek, data);
  const coaching = getCoachingDiagnosis(closedPpc !== null ? closedPpc : currentMetrics.ppc, currentMetrics.tmr);

  return (
    <div id="closeout-week-view" className="space-y-8 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* Alert Banner */}
      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[#f8fafc] flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-[#f59e0b] shrink-0" />
        <div className="text-xs">
          <div className="font-bold text-sm text-[#f59e0b]">
            Sacred LPS Rule: Strict Binary Scoring (1 or 0)
          </div>
          <div className="text-[#94a3b8] mt-0.5">
            Every commitment must have a final outcome recorded. 90% or 99% done is scored strictly as <strong>Not Done (0%)</strong>. Every non-completion requires an assigned Reason Code to drive systemic learning.
          </div>
        </div>
      </div>

      {/* Progress & Live PPC Preview Card */}
      <div id="card-closeout-progress" className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#94a3b8] font-semibold">
              Weekly Closeout Ceremony — Week {currentWeek}
            </div>
            <h2 className="text-xl font-extrabold text-[#f8fafc] mt-1">
              Commitment Review & Reason Analysis
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-[#94a3b8]">Live PPC Preview</div>
              <div className={`text-2xl font-extrabold ${ppcColor.text}`}>
                {livePpc}%
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-[#94a3b8] mb-1.5">
            <span>
              {totalCommitted - pendingCount} of {totalCommitted} outcomes recorded
            </span>
            <span>{Math.round(((totalCommitted - pendingCount) / (totalCommitted || 1)) * 100)}% evaluated</span>
          </div>
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                allRecorded ? 'bg-[#10b981]' : 'bg-[#f59e0b]'
              }`}
              style={{ width: `${Math.round(((totalCommitted - pendingCount) / (totalCommitted || 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-[#10b981] border border-emerald-500/30">
            ✅ Done: {doneCount}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-[#ef4444] border border-red-500/30">
            ❌ Not Done: {notDoneCount}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-[#f59e0b] border border-amber-500/30">
            ⏳ Pending: {pendingCount}
          </span>
        </div>
      </div>

      {/* Commitment Review Cards */}
      <div id="closeout-commitments-list" className="space-y-4">
        <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">
          <Award className="w-4 h-4 text-[#f59e0b]" />
          <span>Individual Commitment Evaluations ({weekCommitments.length})</span>
        </h3>

        {weekCommitments.length === 0 ? (
          <div className="p-12 text-center bg-[#1e293b] border border-dashed border-[#334155] rounded-lg text-[#94a3b8]">
            <Clock className="w-8 h-8 mx-auto text-[#64748b] mb-2" />
            <p className="font-semibold text-[#f8fafc]">No Commitments Found For Week {currentWeek}</p>
            <p className="text-xs mt-1">Make commitments first under Weekly Cycle → Make Commitments.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {weekCommitments.map(
              ({
                commitment,
                task,
                plannedQty,
                actualQty,
                quantityProgress
              }) => {
              if (!task) return null;
              const autoDone =
                plannedQty > 0 &&
                actualQty >= plannedQty;

              const autoNotDone =
                plannedQty > 0 &&
                actualQty < plannedQty &&
                actualQty > 0;

              const isDone =
                commitment.outcome === 'done' ||
                autoDone;

              const isNotDone =
                commitment.outcome === 'not_done' ||
                autoNotDone;

              return (
                <div
                  key={commitment.id}
                  id={`closeout-card-${commitment.id}`}
                  className={`p-5 rounded-lg bg-[#1e293b] border transition-all shadow-md space-y-4 ${
                    isDone
                      ? 'border-emerald-500/50 bg-[#1e293b]'
                      : isNotDone
                      ? 'border-red-500/50 bg-[#1e293b]'
                      : 'border-[#334155]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0f172a] text-[#38bdf8] border border-slate-700">
                          {task.trade}
                        </span>
                        <span className="text-xs text-[#94a3b8]">
                          Committed By: <strong className="text-[#f8fafc]">{commitment.committed_by}</strong>
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[#f8fafc]">{task.description}</h4>
                      <div className="text-xs text-[#94a3b8] mt-0.5">Location: {task.location} ({task.uom})</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      <div className="p-3 rounded-lg bg-slate-900 border border-[#334155]">
                        <div className="text-[10px] uppercase text-[#64748b]">
                          Planned Quantity
                        </div>
                        <div className="text-sm font-bold text-[#f8fafc] mt-1">
                          {plannedQty} {task.uom}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-[#334155]">
                        <label className="text-[10px] uppercase text-[#64748b]">
                          Actual Quantity
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={actualQty}
                          onChange={(e) => {
                            const nextActualQty =
                              Number(e.target.value) || 0;

                            if (plannedQty <= 0) {
                              onUpdateCommitmentOutcome(
                                commitment.id,
                                'not_done',
                                commitment.reason_code || 1,
                                nextActualQty
                              );
                              return;
                            }

                            const progress = Math.min(
                              100,
                              Math.round(
                                (nextActualQty / plannedQty) *
                                  100
                              )
                            );

                            const outcome =
                              progress >= 100
                                ? 'done'
                                : 'not_done';

                            onUpdateCommitmentOutcome(
                              commitment.id,
                              outcome,
                              outcome === 'not_done'
                                ? commitment.reason_code || 1
                                : undefined,
                              nextActualQty
                            );

                          }}
                          className="w-full mt-1 px-3 py-2 bg-[#0f172a] border border-[#334155] rounded text-sm text-[#f8fafc]"
                        />
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-[#334155]">
                        <div className="text-[10px] uppercase text-[#64748b]">
                          Quantity Progress
                        </div>
                        <div className="text-lg font-bold text-[#10b981] mt-1">
                          {quantityProgress}%
                        </div>

                        <div className="w-full h-2 bg-[#0f172a] rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full bg-[#10b981] rounded-full transition-all duration-300"
                            style={{
                              width: `${quantityProgress}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Binary Toggle Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        id={`btn-mark-done-${commitment.id}`}
                        type="button"
                        disabled
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          isDone
                            ? 'bg-[#10b981] text-[#0f172a] shadow-lg shadow-emerald-500/20 scale-105'
                            : 'bg-slate-900 text-[#64748b] border border-[#334155] cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {autoDone
                            ? '✅ Done (100%)'
                            : '✅ Done (Manual)'}
                        </span>
                      </button>

                      <button
                        id={`btn-mark-notdone-${commitment.id}`}
                        type="button"
                        disabled
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          isNotDone
                            ? 'bg-[#ef4444] text-[#f8fafc] shadow-lg shadow-red-500/20 scale-105'
                            : 'bg-slate-900 text-[#64748b] border border-[#334155] cursor-not-allowed'
                        }`}
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>
                          {autoNotDone
                            ? '❌ Not Done (0%)'
                            : '❌ Not Done (Manual)'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Reason Code Dropdown if Not Done */}
                  {isNotDone && (
                    <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 animate-fade-in space-y-2">
                      <label className="block text-xs font-bold text-[#ef4444]">
                        Select Primary Reason Code for Non-Completion (Mandatory for Learning):
                      </label>
                      <select
                        id={`select-reason-${commitment.id}`}
                        value={commitment.reason_code || 1}
                        onChange={(e) => handleSelectReason(commitment.id, Number(e.target.value))}
                        className="w-full px-3 py-2 bg-[#0f172a] border border-red-500/40 rounded-lg text-xs text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
                      >
                        {REASON_CODES.map((rc) => (
                          <option key={rc.id} value={rc.id}>
                            {rc.code}: {rc.title} ({rc.description})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
              }
            )}
          </div>
        )}
      </div>

      {/* Close Out Action Button */}
      <div className="p-4 rounded-lg bg-[#1e293b] border border-[#334155]">
        <label className="block text-xs font-semibold text-[#94a3b8] mb-2">
          Close Out Date
        </label>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#f59e0b]" />

          <input
            type="date"
            value={closeoutDate}
            onChange={(e) => setCloseoutDate(e.target.value)}
            className="px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-sm text-[#f8fafc]"
          />
        </div>
      </div>

      <div className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="text-xs text-[#94a3b8]">
          {allRecorded ? (
            <span className="text-[#10b981] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>All commitments evaluated. Ready to seal weekly PPC.</span>
            </span>
          ) : (
            <span className="text-[#f59e0b] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>Evaluate all {pendingCount} pending commitments with reason codes to enable Close Out.</span>
            </span>
          )}
        </div>

        <button
          id="btn-closeout-submit"
          type="button"
          disabled={!allRecorded}
          onClick={handleExecuteCloseOut}
          className={`px-6 py-3 rounded-lg font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer ${
            allRecorded
              ? `${ppcColor.btn} text-[#0f172a] shadow-xl hover:scale-102`
              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>🔒 Close Out Week — PPC: {livePpc}%</span>
        </button>
      </div>

      {/* Full Screen Celebratory Reveal Modal */}
      {showRevealModal && (
        <div
          id="modal-reveal-closeout"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in"
        >
          <div className="w-full max-w-2xl bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl p-8 text-center space-y-6 animate-scale-up">
            <div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-[#f59e0b] border border-amber-500/30 inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Week {currentWeek} Official Close-Out Record</span>
              </span>
              <h2 className="text-2xl font-extrabold text-[#f8fafc] mt-2">Weekly Performance Reveal</h2>
            </div>

            {/* Large Animated Donut Ring */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="text-slate-800"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className={
                      livePpc >= 80 ? 'text-[#10b981]' : livePpc >= 60 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
                    }
                    strokeWidth="8"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * livePpc) / 100}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold text-[#f8fafc]">{livePpc}%</span>
                  <span className="text-[11px] font-bold text-[#94a3b8] tracking-wider uppercase">PPC Score</span>
                </div>
              </div>
            </div>

            {/* 3 Secondary Metric Boxes */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
                <div className="text-[10px] text-[#94a3b8] uppercase font-bold">Tasks Ready (TA)</div>
                <div className="text-lg font-bold text-[#38bdf8] mt-0.5">{currentMetrics.ta}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
                <div className="text-[10px] text-[#94a3b8] uppercase font-bold">Make Ready (TMR)</div>
                <div className="text-lg font-bold text-[#f59e0b] mt-0.5">
                  {currentMetrics.tmr !== null ? `${currentMetrics.tmr}%` : 'n/a'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
                <div className="text-[10px] text-[#94a3b8] uppercase font-bold">Resolution (CRR)</div>
                <div className="text-lg font-bold text-[#10b981] mt-0.5">
                  {currentMetrics.crr !== null ? `${currentMetrics.crr}%` : 'n/a'}
                </div>
              </div>
            </div>

            {/* Coaching Diagnosis Box */}
            <div className={`p-4 rounded-xl text-left bg-[#0f172a] border ${coaching.borderClass}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#f8fafc]">{coaching.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${coaching.badgeClass}`}>
                  {coaching.badge}
                </span>
              </div>
              <p className="text-xs text-[#94a3b8]">{coaching.message}</p>
            </div>

            <button
              id="btn-reveal-done"
              type="button"
              onClick={() => {
                setShowRevealModal(false);
                onNavigateToDashboard();
              }}
              className="w-full py-3 bg-[#f59e0b] hover:bg-amber-600 text-[#0f172a] font-extrabold rounded-lg transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>✅ Done — Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
