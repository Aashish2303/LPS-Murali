import React from 'react';
import { Milestone, Calendar, Layers, Flag, Clock } from 'lucide-react';
import { LPSData } from '../../types';
import { formatDate } from '../../services/storage';

interface MasterPlanViewProps {
  data: LPSData;
}

/**
 * Read-only Master Plan view.
 *
 * Class feedback (item 2): LPS has Master Plan -> Phase Plan -> Lookahead ->
 * Weekly Plan, but the tool only surfaced Phase Plan + Lookahead + Weekly.
 *
 * No separate "master plan" data was being captured anywhere — but the data
 * it would need already exists in the model and just wasn't rolled up into
 * its own view:
 *   - data.phases: the project's milestone baseline (phase_name, milestone,
 *     planned_start/finish, status) — added manually in Phase Schedule.
 *   - data.tasks (trade === 'Phase Schedule'): the full imported CPM
 *     schedule, including computed eps/epf/lps/lpf/float.
 *
 * This view surfaces both as a single, read-only master-plan rollup. It
 * adds no new fields and no editing — it is purely a different lens on
 * data already collected elsewhere (Phase Schedule import + manual
 * milestones), per the "implement a minimal read-only view if the data
 * already exists" guidance.
 */
export const MasterPlanView: React.FC<MasterPlanViewProps> = ({ data }) => {
  const projectStart = data.config.startDate || data.config.start_date;
  const projectEnd = data.config.endDate || data.config.end_date;

  const milestones = [...data.phases].sort((a, b) =>
    (a.planned_start || a.target_date || '').localeCompare(
      b.planned_start || b.target_date || ''
    )
  );

  const scheduleTasks = data.tasks
    .filter((task) => task.trade === 'Phase Schedule')
    .sort((a, b) => {
      const aDate = a.eps || a.planned_start || a.must_finish_by || '';
      const bDate = b.eps || b.planned_start || b.must_finish_by || '';
      if (aDate && bDate && aDate !== bDate) {
        return aDate < bDate ? -1 : 1;
      }
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });

  const completedMilestones = milestones.filter((m) => m.status === 'Complete').length;

  return (
    <div id="master-plan-view" className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      <div className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <Milestone className="w-5 h-5 text-[#f59e0b]" />
            <h2 className="text-lg font-bold text-[#f8fafc]">Master Plan (Read-Only)</h2>
          </div>
          <p className="text-xs text-[#94a3b8] mt-1">
            Project-level milestone baseline and the full imported schedule —
            the top of the LPS cascade above Phase Plan, Lookahead and Weekly Plan.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-[#0f172a] border border-[#334155] text-[#38bdf8] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {projectStart ? formatDate(projectStart) : '—'} → {projectEnd ? formatDate(projectEnd) : '—'}
          </span>
        </div>
      </div>

      {/* Milestone baseline */}
      <div className="rounded-xl bg-[#1e293b] border border-[#334155] overflow-hidden shadow-md">
        <div className="px-5 py-4 border-b border-[#334155] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">
              <Flag className="w-4 h-4 text-[#f59e0b]" />
              Milestone Baseline
            </h3>
            <p className="text-[11px] text-[#94a3b8] mt-1">
              Project milestones (set under Phase Schedule → Add Milestone)
            </p>
          </div>
          <span className="text-xs text-[#94a3b8]">
            {completedMilestones} / {milestones.length} complete
          </span>
        </div>

        {milestones.length === 0 ? (
          <div className="p-10 text-center text-[#94a3b8]">
            <p className="text-xs font-semibold text-[#f8fafc]">No milestones recorded yet</p>
            <p className="text-[11px] mt-1">Add project milestones from the Phase Schedule view.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0f172a]">
                <tr className="text-[10px] uppercase tracking-wider text-[#94a3b8]">
                  <th className="px-4 py-3">Milestone</th>
                  <th className="px-4 py-3">Planned Start</th>
                  <th className="px-4 py-3">Planned Finish</th>
                  <th className="px-4 py-3">Responsible</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id} className="border-t border-[#334155]">
                    <td className="px-4 py-3 font-bold text-[#f8fafc]">{m.phase_name}</td>
                    <td className="px-4 py-3 text-[#cbd5e1]">{formatDate(m.planned_start)}</td>
                    <td className="px-4 py-3 text-[#cbd5e1]">{formatDate(m.planned_finish)}</td>
                    <td className="px-4 py-3 text-[#cbd5e1]">{m.responsible || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          m.status === 'Complete'
                            ? 'bg-emerald-500/20 text-[#10b981] border-emerald-500/30'
                            : m.status === 'Active'
                            ? 'bg-amber-500/20 text-[#f59e0b] border-amber-500/30'
                            : 'bg-slate-800 text-[#94a3b8] border-slate-700'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full imported CPM schedule */}
      <div className="rounded-xl bg-[#1e293b] border border-[#334155] overflow-hidden shadow-md">
        <div className="px-5 py-4 border-b border-[#334155]">
          <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#38bdf8]" />
            Master Schedule — All Imported Activities ({scheduleTasks.length})
          </h3>
          <p className="text-[11px] text-[#94a3b8] mt-1">
            The full CPM network imported via Phase Schedule, in sequence order.
          </p>
        </div>

        {scheduleTasks.length === 0 ? (
          <div className="p-10 text-center text-[#94a3b8]">
            <Clock className="w-7 h-7 mx-auto mb-2 text-[#64748b]" />
            <p className="text-xs font-semibold text-[#f8fafc]">No Phase Schedule imported yet</p>
            <p className="text-[11px] mt-1">Import a schedule from the Phase Schedule view to populate the master plan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0f172a]">
                <tr className="text-[10px] uppercase tracking-wider text-[#94a3b8]">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Early Start</th>
                  <th className="px-4 py-3">Early Finish</th>
                  <th className="px-4 py-3">Late Finish</th>
                  <th className="px-4 py-3">Float</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduleTasks.map((task) => (
                  <tr key={task.id} className="border-t border-[#334155]">
                    <td className="px-4 py-3 font-mono text-[#64748b]">{task.id}</td>
                    <td className="px-4 py-3 font-semibold text-[#f8fafc]">{task.description}</td>
                    <td className="px-4 py-3 text-[#cbd5e1]">{task.eps ? formatDate(task.eps) : '—'}</td>
                    <td className="px-4 py-3 text-[#cbd5e1]">{task.epf ? formatDate(task.epf) : '—'}</td>
                    <td className="px-4 py-3 text-[#cbd5e1]">{task.lpf ? formatDate(task.lpf) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={task.float !== null && task.float !== undefined && task.float <= 0 ? 'text-[#ef4444] font-bold' : 'text-[#94a3b8]'}>
                        {task.float ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8]">{task.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-4 rounded-lg bg-slate-900/60 border border-[#334155]">
        <div className="flex items-start gap-3">
          <Clock className="w-4 h-4 text-[#38bdf8] mt-0.5 shrink-0" />
          <div>
            <div className="text-xs font-bold text-[#f8fafc]">LPS Flow</div>
            <div className="text-[11px] text-[#94a3b8] mt-1">
              Master Plan → Phase Schedule → Pull Planning → Lookahead → Weekly Plan → Daily Check-in → Closeout
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
