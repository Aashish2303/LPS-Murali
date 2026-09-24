import { formatWeek } from '../../utils/weekLabel';
import React from 'react';
import { Sparkles, Award, Layers, Clock, ShieldAlert, TrendingUp, ChevronRight } from 'lucide-react';
import { LPSData, MetricRecord, NavItemKey } from '../../types';
import { getCoachingDiagnosis, getWeekStart, getWeekEnd } from '../../services/storage';

interface ThisWeekMetricsViewProps {
  data: LPSData;
  currentWeek: string;
  metrics: MetricRecord;
  onNavigate: (nav: NavItemKey) => void;
}

export const ThisWeekMetricsView: React.FC<ThisWeekMetricsViewProps> = ({
  data,
  currentWeek,
  metrics,
  onNavigate
}) => {
  const coaching = getCoachingDiagnosis(metrics.ppc, metrics.tmr);

  // Constraints raised this week
  const weekStart = getWeekStart(currentWeek);
  const weekEnd = getWeekEnd(currentWeek);
  const constraintsRaisedThisWeek = data.constraints.filter((c) => {
    if (!c.raised_date) return false;
    return c.raised_date >= weekStart && c.raised_date < weekEnd;
  }).length;

  const renderDonut = (value: number | null, label: string, color: 'emerald' | 'amber' | 'red' | 'sky') => {
    const strokeColor = {
      emerald: '#10b981',
      amber: '#f59e0b',
      red: '#ef4444',
      sky: '#38bdf8'
    }[color];

    const circumference = 2 * Math.PI * 32; // r=32 -> 201
    const offset = value !== null ? circumference - (circumference * value) / 100 : circumference;

    return (
      <div className="flex flex-col items-center p-5 rounded-lg bg-[#1e293b] border border-[#334155] shadow-md">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="32"
              className="text-slate-800"
              strokeWidth="7"
              stroke="currentColor"
              fill="transparent"
            />
            {value !== null && (
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke={strokeColor}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 1.2s ease-in-out' }}
              />
            )}
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-xl font-extrabold text-[#f8fafc]">
              {value !== null ? `${value}%` : 'n/a'}
            </span>
          </div>
        </div>
        <div className="text-xs font-bold text-[#f8fafc] mt-3 uppercase tracking-wider text-center">{label}</div>
        <div className="text-[10px] text-[#94a3b8] mt-0.5 text-center">
          {value !== null ? `${value}% achieved` : 'No data yet'}
        </div>
      </div>
    );
  };

  const getRingColor = (val: number | null): 'emerald' | 'amber' | 'red' => {
    if (val === null || val >= 80) return 'emerald';
    if (val >= 60) return 'amber';
    return 'red';
  };

  return (
    <div id="this-week-metrics-view" className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#f59e0b]" />
            <h2 className="text-lg font-bold text-[#f8fafc]">This Week's Last Planner Performance KPI Rings</h2>
          </div>
          <p className="text-xs text-[#94a3b8] mt-1">
            Live evaluation of {formatWeek(currentWeek)} commitment reliability, make-ready flow, and constraint velocity.
          </p>
        </div>
      </div>

      {/* Four Rings / Metric Cards in a Row */}
      <div id="metrics-ring-row" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PPC Ring */}
        {renderDonut(metrics.ppc, 'Percent Plan Complete (PPC)', getRingColor(metrics.ppc))}

        {/* TA Card (No ring, pure count) */}
        <div className="flex flex-col items-center justify-center p-5 rounded-lg bg-[#1e293b] border border-[#334155] shadow-md text-center">
          <div className="w-24 h-24 rounded-full bg-slate-900 border-4 border-[#38bdf8] flex flex-col items-center justify-center shadow-inner">
            <span className="text-3xl font-extrabold text-[#38bdf8]">{metrics.ta}</span>
            <span className="text-[9px] uppercase tracking-wider font-bold text-[#94a3b8]">Tasks</span>
          </div>
          <div className="text-xs font-bold text-[#f8fafc] mt-3 uppercase tracking-wider">
            Tasks Made Available (TA)
          </div>
          <div className="text-[10px] text-[#94a3b8] mt-0.5">Constraint-free ready pool</div>
        </div>

        {/* TMR Ring */}
        {renderDonut(metrics.tmr, 'Tasks Made Ready (TMR)', getRingColor(metrics.tmr))}

        {/* CRR Ring */}
        {renderDonut(metrics.crr, 'Constraint Resolution (CRR)', getRingColor(metrics.crr))}
      </div>

      {/* Numbers Summary Card */}
      <div id="card-numbers-summary" className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-md">
        <h3 className="text-xs uppercase tracking-wider font-bold text-[#94a3b8] mb-4">
          Weekly Operational Volume Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#334155]">
            <div className="text-xs text-[#94a3b8] font-semibold">Commitments Made</div>
            <div className="text-2xl font-extrabold text-[#f8fafc] mt-1">{metrics.total_committed}</div>
            <div className="text-[10px] text-[#64748b] mt-0.5">Promises locked by trade foremen</div>
          </div>

          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#334155]">
            <div className="text-xs text-[#94a3b8] font-semibold">Commitments Completed (100%)</div>
            <div className="text-2xl font-extrabold text-[#10b981] mt-1">{metrics.total_done}</div>
            <div className="text-[10px] text-[#64748b] mt-0.5">Fulfilled 100% binary handoffs</div>
          </div>

          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#334155]">
            <div className="text-xs text-[#94a3b8] font-semibold">Constraints Raised This Week</div>
            <div className="text-2xl font-extrabold text-[#f59e0b] mt-1">{constraintsRaisedThisWeek}</div>
            <div className="text-[10px] text-[#64748b] mt-0.5">Roadblocks identified in lookahead</div>
          </div>
        </div>
      </div>

      {/* Coaching Card Below */}
      <div className={`p-6 rounded-lg bg-[#1e293b] border ${coaching.borderClass} shadow-lg`}>
        <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#f59e0b]" />
            <h3 className="text-sm font-bold text-[#f8fafc]">{coaching.title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${coaching.badgeClass}`}>
              {coaching.badge}
            </span>
          </div>
          <button
            onClick={() => onNavigate('metrics-coaching')}
            className="text-xs font-semibold text-[#f59e0b] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Deep Dive</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="mt-3 text-xs text-[#f8fafc]/90 leading-relaxed">{coaching.message}</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {coaching.actionItems.map((item, idx) => (
            <div key={idx} className="p-2.5 rounded bg-[#0f172a] border border-[#334155] text-xs text-[#94a3b8]">
              <span className="text-[#f59e0b] font-bold mr-1.5">▸</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
