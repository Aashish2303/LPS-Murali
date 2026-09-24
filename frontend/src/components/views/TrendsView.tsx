import { formatWeek } from '../../utils/weekLabel';
import React from 'react';
import { TrendingUp, Lock, Unlock, Award } from 'lucide-react';
import { LPSData, MetricRecord } from '../../types';

interface TrendsViewProps {
  data: LPSData;
  liveMetrics?: MetricRecord;
}

export const TrendsView: React.FC<TrendsViewProps> = ({ data, liveMetrics }) => {
  // Closed weeks are stored; the in-progress week is live, so append it if not yet stored
  const stored = [...data.metrics];
  if (liveMetrics && !stored.some((m) => m.week_key === liveMetrics.week_key) && liveMetrics.total_committed > 0) {
    stored.push({ ...liveMetrics, status: 'Open' } as MetricRecord);
  }
  const records = stored.sort((a, b) => a.week_key.localeCompare(b.week_key)).slice(-8);

  const getCellColor = (val: number | null) => {
    if (val === null) return 'text-[#94a3b8] bg-slate-900/40';
    if (val >= 80) return 'text-[#10b981] bg-emerald-500/10 font-bold';
    if (val >= 60) return 'text-[#f59e0b] bg-amber-500/10 font-bold';
    return 'text-[#ef4444] bg-red-500/10 font-bold';
  };

  // Sparkline points calculation
  const validPpcPoints = records
    .map((r, i) => ({ x: i, y: r.ppc ?? 0, week: r.week_key }))
    .filter((p) => p.y > 0);

  const svgWidth = 600;
  const svgHeight = 120;
  const padding = 30;

  const pointsString = records
    .map((r, idx) => {
      const x = padding + (idx * (svgWidth - 2 * padding)) / Math.max(1, records.length - 1);
      const val = r.ppc ?? 50;
      const y = svgHeight - padding - (val / 100) * (svgHeight - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div id="trends-view" className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Overview Header */}
      <div className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-md flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#f59e0b]" />
            <h2 className="text-lg font-bold text-[#f8fafc]">Multi-Week Reliability Trends & History</h2>
          </div>
          <p className="text-xs text-[#94a3b8] mt-1">
            Track commitment predictability (PPC) and make-ready filtering (TMR/CRR) across recent project cycles.
          </p>
        </div>
      </div>

      {/* SVG Sparkline Card */}
      <div id="card-ppc-sparkline" className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider font-bold text-[#94a3b8] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#f59e0b]" />
            <span>PPC Trend Line (Target: ≥80%)</span>
          </h3>
          <span className="text-xs text-[#10b981] font-semibold">80% Reliability Benchmark</span>
        </div>

        <div className="w-full bg-[#0f172a] rounded-lg p-4 border border-[#334155] overflow-x-auto flex justify-center">
          <svg
            className="w-full max-w-2xl h-36"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 80% Benchmark Line */}
            <line
              x1={padding}
              y1={svgHeight - padding - 0.8 * (svgHeight - 2 * padding)}
              x2={svgWidth - padding}
              y2={svgHeight - padding - 0.8 * (svgHeight - 2 * padding)}
              stroke="#10b981"
              strokeDasharray="4 4"
              strokeWidth="1"
              opacity="0.6"
            />
            <text
              x={svgWidth - padding + 5}
              y={svgHeight - padding - 0.8 * (svgHeight - 2 * padding) + 3}
              fill="#10b981"
              fontSize="9"
              fontFamily="Inter"
            >
              80%
            </text>

            {/* Sparkline Path */}
            <polyline
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsString}
            />

            {/* Data Dots & Labels */}
            {records.map((r, idx) => {
              const x = padding + (idx * (svgWidth - 2 * padding)) / Math.max(1, records.length - 1);
              const val = r.ppc ?? 0;
              const y = svgHeight - padding - (val / 100) * (svgHeight - 2 * padding);

              return (
                <g key={r.week_key}>
                  <circle cx={x} cy={y} r="5" fill="#f59e0b" stroke="#0f172a" strokeWidth="2" />
                  <text
                    x={x}
                    y={y - 9}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="Inter"
                  >
                    {val}%
                  </text>
                  <text
                    x={x}
                    y={svgHeight - 8}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="Inter"
                  >
                    {formatWeek(r.week_key)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 8-Week Historical Performance Table */}
      <div id="table-trends-container" className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-lg">
        <h3 className="text-sm font-bold text-[#f8fafc] mb-4 flex items-center gap-2">
          <span>Weekly Performance Record Log</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#334155] text-[#94a3b8] font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Week</th>
                <th className="py-3 px-3 text-center">PPC %</th>
                <th className="py-3 px-3 text-center">TA (Ready)</th>
                <th className="py-3 px-3 text-center">TMR %</th>
                <th className="py-3 px-3 text-center">CRR %</th>
                <th className="py-3 px-3 text-center">Committed</th>
                <th className="py-3 px-3 text-center">Done</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60">
              {records.map((r) => {
                const isClosed = r.status === 'Closed';

                return (
                  <tr key={r.week_key} className="hover:bg-[#0f172a]/50 transition-colors">
                    <td className="py-3 px-3 font-bold text-[#f8fafc] flex items-center gap-2">
                      <span className="text-[#f59e0b] font-mono">{formatWeek(r.week_key)}</span>
                    </td>

                    <td className={`py-3 px-3 text-center rounded ${getCellColor(r.ppc)}`}>
                      {r.ppc !== null ? `${r.ppc}%` : 'n/a'}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-[#38bdf8]">
                      {r.ta}
                    </td>

                    <td className={`py-3 px-3 text-center rounded ${getCellColor(r.tmr)}`}>
                      {r.tmr !== null ? `${r.tmr}%` : 'n/a'}
                    </td>

                    <td className={`py-3 px-3 text-center rounded ${getCellColor(r.crr)}`}>
                      {r.crr !== null ? `${r.crr}%` : 'n/a'}
                    </td>

                    <td className="py-3 px-3 text-center text-[#f8fafc] font-semibold">
                      {r.total_committed}
                    </td>

                    <td className="py-3 px-3 text-center text-[#10b981] font-semibold">
                      {r.total_done}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {isClosed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          <Lock className="w-3 h-3 text-[#10b981]" />
                          <span>Closed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-[#f59e0b] border border-amber-500/30">
                          <Unlock className="w-3 h-3 text-[#f59e0b]" />
                          <span>Active / Open</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
