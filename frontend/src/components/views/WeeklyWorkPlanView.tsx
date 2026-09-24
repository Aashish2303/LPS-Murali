import { formatWeek } from '../../utils/weekLabel';
import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  Layers
} from 'lucide-react';

import { LPSData } from '../../types';

interface WeeklyWorkPlanViewProps {
  data: LPSData;
  currentWeek: string;
}

export const WeeklyWorkPlanView: React.FC<
  WeeklyWorkPlanViewProps
> = ({
  data,
  currentWeek
}) => {
  const weekCommitments = data.commitments.filter(
    (commitment) =>
      commitment.week_key === currentWeek
  );

  const totalTasks = weekCommitments.length;

  const totalPlannedQty =
    weekCommitments.reduce(
      (sum, commitment) =>
        sum +
        (Number(commitment.planned_qty) || 0),
      0
    );

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in">

      {/* HEADER */}
      <div>
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-[#10b981]" />

          <div>
            <h1 className="text-2xl font-extrabold text-[#f8fafc]">
              Weekly Work Plan
            </h1>

            <p className="text-sm text-[#94a3b8] mt-1">
              {formatWeek(currentWeek)} • Approved weekly commitments
            </p>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div className="p-5 rounded-xl bg-[#1e293b] border border-[#334155]">
          <div className="text-xs uppercase tracking-wider font-semibold text-[#94a3b8]">
            Committed Tasks
          </div>

          <div className="text-3xl font-extrabold text-[#f8fafc] mt-2">
            {totalTasks}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#1e293b] border border-[#334155]">
          <div className="text-xs uppercase tracking-wider font-semibold text-[#94a3b8]">
            Planned Quantity
          </div>

          <div className="text-3xl font-extrabold text-[#38bdf8] mt-2">
            {totalPlannedQty}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#1e293b] border border-emerald-500/30">
          <div className="text-xs uppercase tracking-wider font-semibold text-[#94a3b8]">
            Planning Status
          </div>

          <div className="text-lg font-extrabold text-[#10b981] mt-2 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Ready for Execution
          </div>
        </div>

      </div>

      {/* EMPTY STATE */}
      {weekCommitments.length === 0 ? (

        <div className="rounded-xl border border-dashed border-[#475569] bg-[#1e293b] p-12 text-center">

          <Layers className="w-10 h-10 text-[#64748b] mx-auto mb-3" />

          <h3 className="text-sm font-bold text-[#f8fafc]">
            No Weekly Commitments Yet
          </h3>

          <p className="text-xs text-[#94a3b8] mt-1">
            Ready tasks will appear here automatically
            after they are committed.
          </p>

        </div>

      ) : (

        /* WWP TABLE */
        <div className="rounded-xl bg-[#1e293b] border border-[#334155] overflow-hidden shadow-md">

          <div className="px-5 py-4 border-b border-[#334155]">

            <h2 className="text-sm font-bold text-[#f8fafc]">
              Weekly Work Plan — {formatWeek(currentWeek)}
            </h2>

            <p className="text-[11px] text-[#94a3b8] mt-1">
              Automatically generated from Weekly Commitments
            </p>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-left">

              <thead className="bg-[#0f172a]">

                <tr className="text-[10px] uppercase tracking-wider text-[#94a3b8]">

                  <th className="px-4 py-3">
                    Task
                  </th>

                  <th className="px-4 py-3">
                    Trade
                  </th>

                  <th className="px-4 py-3">
                    Responsible
                  </th>

                  <th className="px-4 py-3">
                    Location
                  </th>

                  <th className="px-4 py-3">
                    Planned Qty
                  </th>

                  <th className="px-4 py-3">
                    Progress
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                </tr>

              </thead>

              <tbody>

                {weekCommitments.map(
                  (commitment) => {

                    const task =
                      data.tasks.find(
                        (t) =>
                          t.id ===
                          commitment.task_id
                      );

                    if (!task) {
                      return null;
                    }

                    const progress =
                      Number(
                        commitment.progress_percent
                      ) || 0;

                    return (

                      <tr
                        key={commitment.id}
                        className="border-t border-[#334155] hover:bg-slate-800/50 transition"
                      >

                        <td className="px-4 py-4 min-w-[260px]">

                          <div className="text-xs font-bold text-[#f8fafc]">
                            {task.description}
                          </div>

                          <div className="text-[10px] text-[#64748b] mt-1">
                            ID: {task.id}
                          </div>

                        </td>

                        <td className="px-4 py-4">

                          <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-[#38bdf8]">
                            {task.trade}
                          </span>

                        </td>

                        <td className="px-4 py-4">

                          <div className="flex items-center gap-1.5 text-xs text-[#cbd5e1]">
                            <User className="w-3.5 h-3.5" />
                            {task.responsible || '—'}
                          </div>

                        </td>

                        <td className="px-4 py-4">

                          <div className="flex items-center gap-1.5 text-xs text-[#cbd5e1]">
                            <MapPin className="w-3.5 h-3.5" />
                            {task.location || '—'}
                          </div>

                        </td>

                        <td className="px-4 py-4">

                          <span className="text-xs font-bold text-[#f8fafc]">
                            {commitment.planned_qty ?? 0}
                          </span>

                          <span className="text-[10px] text-[#94a3b8] ml-1">
                            {task.uom}
                          </span>

                        </td>

                        <td className="px-4 py-4 min-w-[130px]">

                          <div className="flex items-center gap-2">

                            <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">

                              <div
                                className="h-full bg-[#10b981] rounded-full"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    progress
                                  )}%`
                                }}
                              />

                            </div>

                            <span className="text-[10px] font-bold text-[#10b981]">
                              {progress}%
                            </span>

                          </div>

                        </td>

                        <td className="px-4 py-4">

                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[#10b981] text-[10px] font-bold">

                            <CheckCircle2 className="w-3 h-3" />

                            Committed

                          </span>

                        </td>

                      </tr>

                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        </div>
      )}

      {/* FLOW */}
      <div className="p-4 rounded-lg bg-slate-900/60 border border-[#334155]">

        <div className="flex items-center gap-3">

          <Clock className="w-4 h-4 text-[#38bdf8]" />

          <div>

            <div className="text-xs font-bold text-[#f8fafc]">
              Automated LPS Flow
            </div>

            <div className="text-[11px] text-[#94a3b8] mt-1">
              Phase Schedule → Pull Planning → Lookahead →
              Make-Ready → Weekly Commitment → WWP → Daily Check-In
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
