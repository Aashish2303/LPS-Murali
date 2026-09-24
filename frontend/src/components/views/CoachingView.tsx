import { formatWeek } from '../../utils/weekLabel';
import React from 'react';
import { HelpCircle, TrendingUp, ShieldAlert, Award, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { LPSData, MetricRecord } from '../../types';
import { getCoachingDiagnosis } from '../../services/storage';

interface CoachingViewProps {
  data: LPSData;
  currentWeek: string;
  metrics: MetricRecord;
}

export const CoachingView: React.FC<CoachingViewProps> = ({
  data,
  currentWeek,
  metrics
}) => {
  const coaching = getCoachingDiagnosis(metrics.ppc, metrics.tmr);

  return (
    <div id="coaching-panel-view" className="space-y-8 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* Overview Header */}
      <div className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-md flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#f59e0b]" />
            <h2 className="text-lg font-bold text-[#f8fafc]">Lean Last Planner System Coaching Diagnostic</h2>
          </div>
          <p className="text-xs text-[#94a3b8] mt-1">
            Automated lean advisor cross-referencing Percent Plan Complete (PPC) against Tasks Made Ready (TMR).
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#0f172a] border border-[#334155] text-[#f59e0b]">
          {formatWeek(currentWeek)}
        </span>
      </div>

      {/* Main Diagnostic Card */}
      <div
        id="card-coaching-main"
        className={`p-8 rounded-xl bg-[#1e293b] border-2 ${coaching.borderClass} shadow-xl space-y-6`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#334155]">
          <div>
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${coaching.badgeClass}`}>
              {coaching.badge}
            </span>
            <h3 className="text-2xl font-black text-[#f8fafc] mt-2 tracking-tight">
              {coaching.title}
            </h3>
          </div>

          {/* Current Quick Metrics Pills */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-lg bg-[#0f172a] border border-[#334155] text-center">
              <div className="text-[10px] uppercase font-bold text-[#94a3b8]">PPC</div>
              <div className="text-base font-extrabold text-[#f8fafc]">
                {metrics.ppc !== null ? `${metrics.ppc}%` : 'n/a'}
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-lg bg-[#0f172a] border border-[#334155] text-center">
              <div className="text-[10px] uppercase font-bold text-[#94a3b8]">TMR</div>
              <div className="text-base font-extrabold text-[#38bdf8]">
                {metrics.tmr !== null ? `${metrics.tmr}%` : 'n/a'}
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-lg bg-[#0f172a] border border-[#334155] text-center">
              <div className="text-[10px] uppercase font-bold text-[#94a3b8]">CRR</div>
              <div className="text-base font-extrabold text-[#10b981]">
                {metrics.crr !== null ? `${metrics.crr}%` : 'n/a'}
              </div>
            </div>
          </div>
        </div>

        {/* Detailed diagnosis narrative */}
        <div className="space-y-3">
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#94a3b8]">
            Root Operational Diagnosis:
          </h4>
          <p className="text-sm text-[#f8fafc] leading-relaxed bg-[#0f172a]/60 p-4 rounded-lg border border-[#334155]/60">
            {coaching.message}
          </p>
        </div>

        {/* Action Items List */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#f59e0b]">
            Prescribed Lean Interventions & Action Items:
          </h4>
          <div className="space-y-2.5">
            {coaching.actionItems.map((action, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-[#0f172a] border border-[#334155] flex items-start gap-3 text-xs text-[#f8fafc]"
              >
                <span className="text-[#f59e0b] font-extrabold text-sm mt-0.5">▸</span>
                <span className="leading-relaxed font-medium">{action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* "What This Means" Guide Section */}
      <div id="coaching-matrix-guide" className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#f59e0b]" />
          <span>The Last Planner System 2×2 Diagnostic Matrix</span>
        </h3>
        <p className="text-xs text-[#94a3b8]">
          Understanding how the interaction between Make-Ready (TMR) and Commitment Fulfillment (PPC) informs site health:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-lg bg-[#0f172a] border border-red-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#ef4444]">Low PPC (&lt;70%) + Low TMR (&lt;70%)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-[#ef4444]">Make-Ready Crisis</span>
            </div>
            <p className="text-xs text-[#94a3b8]">
              The make-ready filtration is completely broken. Foremen are being pushed to work on tasks choked with missing drawings and materials, leading to inevitable plan failures.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#0f172a] border border-amber-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#f59e0b]">Low PPC (&lt;70%) + High TMR (≥70%)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-[#f59e0b]">Execution Deficit</span>
            </div>
            <p className="text-xs text-[#94a3b8]">
              Prerequisites and materials are ready, but crews are failing to deliver. Indicates optimistic sizing, inadequate manpower, lack of skills, or poor daily supervision.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#0f172a] border border-orange-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#f97316]">High PPC (≥70%) + Low TMR (&lt;70%)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-[#f97316]">Heroic Firefighting</span>
            </div>
            <p className="text-xs text-[#94a3b8]">
              Current work is being completed heroically, but lookahead tasks are not being prepared. The pipeline will dry up and cause severe stoppage within 2-3 weeks.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#0f172a] border border-emerald-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#10b981]">High PPC (≥70%) + High TMR (≥70%)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-[#10b981]">High Reliability Flow</span>
            </div>
            <p className="text-xs text-[#94a3b8]">
              Lean Construction equilibrium. Constraint removal leads to smooth, predictable field production and protected handoffs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
