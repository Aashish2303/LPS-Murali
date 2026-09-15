import React, { useRef, useState } from 'react';
import {
  Plus,
  GitBranch,
  Calendar,
  User,
  AlertCircle,
  CheckCircle,
  Upload,
  FileSpreadsheet,
  Loader2,
  X,
  ArrowRight
} from 'lucide-react';

import { LPSData, Phase, Task } from '../../types';
import {
  formatDate,
  generateId,
  parsePhaseScheduleFile,
  importPhaseSchedule
} from '../../services/storage';

interface PhaseScheduleViewProps {
  data: LPSData;
  onAddPhase: (phase: Phase) => void;
  onUpdatePhaseStatus: (
    phaseId: string,
    status: Phase['status']
  ) => void;
  onImportTasks: (tasks: Task[]) => void;
}

interface PreviewRow {
  slNo: number;
  name: string;
  description: string;
  plannedStart: string;
  plannedFinish: string;
  predecessors: string[];
  precedenceType: 'FS';
  eps?: string;
  epf?: string;
  lps?: string;
  lpf?: string;
  float?: number | null;
}

export const PhaseScheduleView: React.FC<
  PhaseScheduleViewProps
> = ({
  data,
  onAddPhase,
  onUpdatePhaseStatus,
  onImportTasks
}) => {
  // ---------------------------------------------------------
  // MANUAL PHASE FORM
  // ---------------------------------------------------------

  const [phaseName, setPhaseName] = useState('');
  const [milestone, setMilestone] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedFinish, setPlannedFinish] = useState('');
  const [responsible, setResponsible] = useState('');

  // ---------------------------------------------------------
  // PHASE SCHEDULE IMPORT
  // ---------------------------------------------------------

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewRows, setPreviewRows] =
    useState<PreviewRow[]>([]);

  const [isReading, setIsReading] =
    useState(false);

  const [isImporting, setIsImporting] =
    useState(false);

  const [importMessage, setImportMessage] =
    useState('');

  const [errorMessage, setErrorMessage] =
    useState('');

  // ---------------------------------------------------------
  // MANUAL PHASE CREATION
  // ---------------------------------------------------------

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !phaseName.trim() ||
      !milestone.trim() ||
      !plannedStart ||
      !plannedFinish
    ) {
      return;
    }

    const newPhase: Phase = {
      id: generateId('PHA'),
      phase_name: phaseName.trim(),
      milestone: milestone.trim(),
      planned_start: plannedStart,
      planned_finish: plannedFinish,
      responsible:
        responsible.trim() ||
        'Site Superintendent',
      status: 'Planned'
    };

    onAddPhase(newPhase);

    setPhaseName('');
    setMilestone('');
    setPlannedStart('');
    setPlannedFinish('');
    setResponsible('');
  };

  // ---------------------------------------------------------
  // FIND CURRENT PROJECT ID
  // ---------------------------------------------------------

  const getCurrentProjectId = (): string | null => {
    try {
      const raw =
        localStorage.getItem('lps_projects');

      if (!raw) {
        return null;
      }

      const projects = JSON.parse(raw);

      if (!Array.isArray(projects)) {
        return null;
      }

      const projectCode =
        data.config.projectCode ||
        data.config.projectCode;

      const matchingProject =
        projects.find((project: any) => {
          if (
            projectCode &&
            project.projectCode === projectCode
          ) {
            return true;
          }

          if (
            projectCode &&
            project.project_code === projectCode
          ) {
            return true;
          }

          if (
            project.data?.config?.projectCode ===
            projectCode
          ) {
            return true;
          }

          if (
            project.data?.config?.project_code ===
            projectCode
          ) {
            return true;
          }

          return false;
        });

      if (matchingProject?.id) {
        return matchingProject.id;
      }

      // Current Chittor project fallback.
      if (
        projects.length === 1 &&
        projects[0]?.id
      ) {
        return projects[0].id;
      }

      return null;
    } catch (error) {
      console.error(
        'Unable to determine current project ID:',
        error
      );

      return null;
    }
  };

  // ---------------------------------------------------------
  // FILE SELECTION
  // ---------------------------------------------------------

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedFile(file);
    setPreviewRows([]);
    setImportMessage('');
    setErrorMessage('');
    setIsReading(true);

    try {
      const rows =
        await parsePhaseScheduleFile(file);

      setPreviewRows(rows);
    } catch (error: any) {
      console.error(
        'Phase schedule parsing failed:',
        error
      );

      setErrorMessage(
        error?.message ||
          'Unable to read the phase schedule file.'
      );

      setSelectedFile(null);
    } finally {
      setIsReading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ---------------------------------------------------------
  // CLEAR IMPORT
  // ---------------------------------------------------------

  const clearImport = () => {
    setSelectedFile(null);
    setPreviewRows([]);
    setImportMessage('');
    setErrorMessage('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ---------------------------------------------------------
  // IMPORT PHASE SCHEDULE
  // ---------------------------------------------------------

  const handleImport = async () => {
    if (!selectedFile || previewRows.length === 0) {
      return;
    }

    const projectId =
      getCurrentProjectId();

    if (!projectId) {
      setErrorMessage(
        'Could not determine the current project ID. Please open the project again and try.'
      );

      return;
    }

    setIsImporting(true);
    setErrorMessage('');
    setImportMessage('');

    try {
      const result =
        await importPhaseSchedule(
          projectId,
          selectedFile
        );

      setImportMessage(
        `Successfully imported ${result.count} phase schedule task${
          result.count === 1 ? '' : 's'
        }.`
      );

      onImportTasks(result.tasks);

      setSelectedFile(null);
      setPreviewRows([]);
    } catch (error: any) {
      console.error(
        'Phase schedule import failed:',
        error
      );

      setErrorMessage(
        error?.message ||
          'Failed to import the phase schedule.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  // ---------------------------------------------------------
  // FLOAT CALCULATION
  // ---------------------------------------------------------

  const calculatePhaseFloat = (
    finishDateStr: string
  ) => {
    if (!finishDateStr) {
      return 0;
    }

    const finish =
      new Date(finishDateStr).getTime();

    const today =
      new Date().setHours(
        0,
        0,
        0,
        0
      );

    return Math.floor(
      (finish - today) /
        86400000
    );
  };

  const phases = [...data.phases].sort(
    (a, b) =>
      new Date(
        a.planned_start
      ).getTime() -
      new Date(
        b.planned_start
      ).getTime()
  );

  const phaseScheduleTasks = data.tasks.filter(
    (task) => task.trade === 'Phase Schedule'
  );

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <div
      id="phase-schedule-view"
      className="space-y-8 max-w-6xl mx-auto pb-12 animate-fade-in"
    >

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="p-5 rounded-lg bg-[#1e293b] border border-[#334155] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#f8fafc] flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-[#f59e0b]" />

            <span>
              Master Phase Schedule & Milestone Baseline
            </span>
          </h2>

          <p className="text-xs text-[#94a3b8] mt-1">
            Import the master schedule once. The system
            automatically creates the phase tasks used by
            Pull Planning and Lookahead.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-full bg-slate-900 border border-[#334155] text-[#94a3b8]">
            <span className="text-[#f8fafc] font-bold">
              {data.phases.length}
            </span>{' '}
            Phases
          </div>

          <div className="px-3 py-1.5 rounded-full bg-slate-900 border border-[#334155] text-[#94a3b8]">
            <span className="text-[#f8fafc] font-bold">
              {data.tasks.length}
            </span>{' '}
            Tasks
          </div>
        </div>
      </div>


      {/* =====================================================
          XLSX / CSV IMPORT CARD
      ====================================================== */}

      <div
        id="phase-schedule-import"
        className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-lg"
      >

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">

          <div>
            <h3 className="text-base font-bold text-[#f8fafc] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#10b981]" />

              Import Master Phase Schedule
            </h3>

            <p className="text-xs text-[#94a3b8] mt-1 max-w-2xl">
              Upload the Phase Schedule XLSX/CSV template.
              The system supports FS precedence and multiple
              comma-separated predecessors.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-[#10b981] border border-emerald-500/20 font-bold">
              FS ONLY
            </span>

            <span className="px-2.5 py-1 rounded-full bg-slate-900 text-[#94a3b8] border border-[#334155]">
              XLSX / XLS / CSV
            </span>
          </div>

        </div>


        {/* Template explanation */}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">

          <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
            <p className="text-[10px] uppercase tracking-wider text-[#64748b] font-bold">
              Required
            </p>

            <p className="text-xs text-[#f8fafc] mt-1">
              Sl. No. · Name · Description
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
            <p className="text-[10px] uppercase tracking-wider text-[#64748b] font-bold">
              Schedule
            </p>

            <p className="text-xs text-[#f8fafc] mt-1">
              Planned Start · Planned Finish
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#0f172a] border border-[#334155]">
            <p className="text-[10px] uppercase tracking-wider text-[#64748b] font-bold">
              Dependencies
            </p>

            <p className="text-xs text-[#f8fafc] mt-1">
              Predecessor: 1, 2, 5
            </p>
          </div>

        </div>


        {/* File picker */}

        <div className="mt-5">

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {!selectedFile && (
            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={isReading}
              className="w-full border-2 border-dashed border-[#475569] hover:border-[#f59e0b] rounded-lg p-8 transition-all bg-[#0f172a]/50 hover:bg-[#0f172a] flex flex-col items-center justify-center gap-3 cursor-pointer"
            >
              {isReading ? (
                <>
                  <Loader2 className="w-8 h-8 text-[#f59e0b] animate-spin" />

                  <span className="text-sm font-bold text-[#f8fafc]">
                    Reading schedule...
                  </span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-[#f59e0b]" />
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-bold text-[#f8fafc]">
                      Upload Phase Schedule
                    </p>

                    <p className="text-xs text-[#94a3b8] mt-1">
                      Click to choose XLSX, XLS or CSV
                    </p>
                  </div>
                </>
              )}
            </button>
          )}


          {/* Selected file */}

          {selectedFile && (
            <div className="space-y-4">

              <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-[#0f172a] border border-[#334155]">

                <div className="flex items-center gap-3 min-w-0">

                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-[#10b981]" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#f8fafc] truncate">
                      {selectedFile.name}
                    </p>

                    <p className="text-xs text-[#94a3b8]">
                      {(
                        selectedFile.size /
                        1024
                      ).toFixed(1)} KB ·{' '}
                      {previewRows.length} tasks detected
                    </p>
                  </div>

                </div>

                <button
                  type="button"
                  onClick={clearImport}
                  disabled={isImporting}
                  className="p-2 rounded-md hover:bg-slate-800 text-[#94a3b8] hover:text-[#f8fafc]"
                >
                  <X className="w-4 h-4" />
                </button>

              </div>


              {/* Preview */}

              {previewRows.length > 0 && (
                <div className="rounded-lg border border-[#334155] overflow-hidden">

                  <div className="px-4 py-3 bg-[#0f172a] border-b border-[#334155] flex items-center justify-between">

                    <div>
                      <p className="text-sm font-bold text-[#f8fafc]">
                        Import Preview
                      </p>

                      <p className="text-[11px] text-[#64748b] mt-0.5">
                        These tasks will be created automatically.
                      </p>
                    </div>

                    <span className="text-xs font-bold text-[#10b981]">
                      {previewRows.length} rows
                    </span>

                  </div>


                  <div className="overflow-x-auto max-h-[420px]">

                    <table className="w-full text-left">

                      <thead className="sticky top-0 bg-[#172033] z-10">

                        <tr className="text-[10px] uppercase tracking-wider text-[#64748b]">

                          <th className="px-3 py-3">
                            #
                          </th>

                          <th className="px-3 py-3 min-w-[220px]">
                            Task
                          </th>

                          <th className="px-3 py-3 min-w-[220px]">
                            Description
                          </th>

                          <th className="px-3 py-3 whitespace-nowrap">
                            Start
                          </th>

                          <th className="px-3 py-3 whitespace-nowrap">
                            Finish
                          </th>

                          <th className="px-3 py-3 whitespace-nowrap">
                            EPS
                          </th>

                          <th className="px-3 py-3 whitespace-nowrap">
                            EPF
                          </th>

                          <th className="px-3 py-3 whitespace-nowrap">
                            LPS
                          </th>

                          <th className="px-3 py-3 whitespace-nowrap">
                            LPF
                          </th>

                          <th className="px-3 py-3 whitespace-nowrap">
                            Float
                          </th>

                          <th className="px-3 py-3">
                            Predecessor
                          </th>

                          <th className="px-3 py-3">
                            Type
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {previewRows.map(
                          (row) => (
                            <tr
                              key={row.slNo}
                              className="border-t border-[#334155]/60 hover:bg-[#172033]"
                            >

                              <td className="px-3 py-3 text-xs font-bold text-[#f59e0b]">
                                {row.slNo}
                              </td>

                              <td className="px-3 py-3 text-xs font-semibold text-[#f8fafc]">
                                {row.name}
                              </td>

                              <td className="px-3 py-3 text-xs text-[#94a3b8]">
                                {row.description ||
                                  '—'}
                              </td>

                              <td className="px-3 py-3 text-xs text-[#cbd5e1] whitespace-nowrap">
                                {formatDate(
                                  row.plannedStart
                                )}
                              </td>

                              <td className="px-3 py-3 text-xs text-[#cbd5e1] whitespace-nowrap">
                                {formatDate(
                                  row.plannedFinish
                                )}
                              </td>

                              <td className="px-3 py-3 text-xs text-[#cbd5e1] whitespace-nowrap">
                                {row.eps || '—'}
                              </td>

                              <td className="px-3 py-3 text-xs text-[#cbd5e1] whitespace-nowrap">
                                {row.epf || '—'}
                              </td>

                              <td className="px-3 py-3 text-xs text-[#cbd5e1] whitespace-nowrap">
                                {row.lps || '—'}
                              </td>

                              <td className="px-3 py-3 text-xs text-[#cbd5e1] whitespace-nowrap">
                                {row.lpf || '—'}
                              </td>

                              <td className="px-3 py-3 text-xs text-[#cbd5e1] whitespace-nowrap">
                                {row.float !== null && row.float !== undefined
                                  ? row.float
                                  : '—'}
                              </td>

                              <td className="px-3 py-3">

                                {row.predecessors.length >
                                0 ? (
                                  <div className="flex flex-wrap gap-1">

                                    {row.predecessors.map(
                                      (pred) => (
                                        <span
                                          key={pred}
                                          className="px-1.5 py-0.5 rounded bg-slate-800 border border-[#334155] text-[10px] text-[#cbd5e1]"
                                        >
                                          {pred}
                                        </span>
                                      )
                                    )}

                                  </div>
                                ) : (
                                  <span className="text-xs text-[#64748b]">
                                    —
                                  </span>
                                )}

                              </td>

                              <td className="px-3 py-3">

                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-[#f59e0b]">
                                  FS
                                </span>

                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                </div>
              )}


              {/* Import button */}

              {previewRows.length > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">

                  <div className="flex items-center gap-2 text-xs text-[#94a3b8]">

                    <CheckCircle className="w-4 h-4 text-[#10b981]" />

                    <span>
                      Schedule validated. Ready to import.
                    </span>

                  </div>

                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={isImporting}
                    className="px-5 py-2.5 bg-[#f59e0b] hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-[#0f172a] font-extrabold text-sm rounded-lg transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20"
                  >

                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Import {previewRows.length} Tasks
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}

                  </button>

                </div>
              )}

            </div>
          )}

        </div>


        {/* Success */}

        {importMessage && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">

            <CheckCircle className="w-4 h-4 text-[#10b981]" />

            <p className="text-xs font-semibold text-[#10b981]">
              {importMessage}
            </p>

          </div>
        )}


        {/* Error */}

        {errorMessage && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">

            <AlertCircle className="w-5 h-5 text-[#ef4444] shrink-0" />

            <div>

              <p className="text-xs font-bold text-[#ef4444]">
                Import failed
              </p>

              <p className="text-xs text-red-300 mt-1">
                {errorMessage}
              </p>

            </div>

          </div>
        )}

      </div>


      {/* =====================================================
          MANUAL MILESTONE FORM
      ====================================================== */}

      <div
        id="card-add-phase"
        className="p-6 rounded-lg bg-[#1e293b] border border-[#334155] shadow-lg"
      >

        <h3 className="text-sm font-bold text-[#f8fafc] mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#f59e0b]" />
          <span>
            Add New Project Milestone Manually
          </span>
        </h3>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>
              <label
                className="block text-xs font-semibold text-[#94a3b8] mb-1"
                htmlFor="input-phase-name"
              >
                Phase / Section Name *
              </label>

              <input
                id="input-phase-name"
                type="text"
                required
                value={phaseName}
                onChange={(e) =>
                  setPhaseName(
                    e.target.value
                  )
                }
                className="w-full bg-[#0f172a] border border-[#334155] rounded-md px-3 py-2 text-sm text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none"
                placeholder="e.g. Phase 2: Superstructure"
              />
            </div>


            <div>
              <label
                className="block text-xs font-semibold text-[#94a3b8] mb-1"
                htmlFor="input-milestone"
              >
                Milestone *
              </label>

              <input
                id="input-milestone"
                type="text"
                required
                value={milestone}
                onChange={(e) =>
                  setMilestone(
                    e.target.value
                  )
                }
                className="w-full bg-[#0f172a] border border-[#334155] rounded-md px-3 py-2 text-sm text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none"
                placeholder="e.g. Level 5 deck complete"
              />
            </div>


            <div>
              <label
                className="block text-xs font-semibold text-[#94a3b8] mb-1"
                htmlFor="input-start"
              >
                Planned Start *
              </label>

              <input
                id="input-start"
                type="date"
                required
                value={plannedStart}
                onChange={(e) =>
                  setPlannedStart(
                    e.target.value
                  )
                }
                className="w-full bg-[#0f172a] border border-[#334155] rounded-md px-3 py-2 text-sm text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
              />
            </div>


            <div>
              <label
                className="block text-xs font-semibold text-[#94a3b8] mb-1"
                htmlFor="input-finish"
              >
                Planned Finish *
              </label>

              <input
                id="input-finish"
                type="date"
                required
                value={plannedFinish}
                onChange={(e) =>
                  setPlannedFinish(
                    e.target.value
                  )
                }
                className="w-full bg-[#0f172a] border border-[#334155] rounded-md px-3 py-2 text-sm text-[#f8fafc] focus:border-[#f59e0b] focus:outline-none"
              />
            </div>


            <div>
              <label
                className="block text-xs font-semibold text-[#94a3b8] mb-1"
                htmlFor="input-responsible"
              >
                Responsible
              </label>

              <input
                id="input-responsible"
                type="text"
                value={responsible}
                onChange={(e) =>
                  setResponsible(
                    e.target.value
                  )
                }
                className="w-full bg-[#0f172a] border border-[#334155] rounded-md px-3 py-2 text-sm text-[#f8fafc] placeholder-[#64748b] focus:border-[#f59e0b] focus:outline-none"
                placeholder="Site Superintendent"
              />
            </div>

          </div>


          <div className="flex justify-end pt-1">

            <button
              type="submit"
              className="px-4 py-2 bg-[#f59e0b] hover:bg-amber-600 active:scale-[0.98] text-[#0f172a] font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                + Add Milestone
              </span>
            </button>

          </div>

        </form>

      </div>


      {/* =====================================================
          IMPORTED PHASE SCHEDULE ACTIVITIES
      ====================================================== */}

      <div
        id="imported-phase-schedule-activities"
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#38bdf8]" />
            <span>Phase Schedule Activities</span>

            <span className="px-2 py-0.5 rounded-full bg-[#0f172a] border border-[#334155] text-[#38bdf8] text-[10px]">
              {phaseScheduleTasks.length} Activities
            </span>
          </h3>
        </div>

        {phaseScheduleTasks.length === 0 ? (
          <div className="p-8 text-center bg-[#1e293b] border border-dashed border-[#334155] rounded-lg">
            <p className="text-sm font-semibold text-[#f8fafc]">
              No Phase Schedule Activities Imported
            </p>
            <p className="text-xs text-[#94a3b8] mt-1">
              Import the master phase schedule above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#334155] bg-[#1e293b]">
            <table className="w-full text-xs">
              <thead className="bg-[#0f172a]">
                <tr className="text-left text-[#94a3b8]">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">Finish</th>
                  <th className="px-4 py-3">EPS</th>
                  <th className="px-4 py-3">EPF</th>
                  <th className="px-4 py-3">LPS</th>
                  <th className="px-4 py-3">LPF</th>
                  <th className="px-4 py-3">Float</th>
                </tr>
              </thead>

              <tbody>
                {phaseScheduleTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-t border-[#334155] hover:bg-[#334155]/30"
                  >
                    <td className="px-4 py-3 font-mono text-[#64748b]">
                      {task.id}
                    </td>

                    <td className="px-4 py-3 font-semibold text-[#f8fafc] min-w-[220px]">
                      {task.description}
                    </td>

                    <td className="px-4 py-3 text-[#cbd5e1]">
                      {task.planned_start || '—'}
                    </td>

                    <td className="px-4 py-3 text-[#cbd5e1]">
                      {task.must_finish_by || '—'}
                    </td>

                    <td className="px-4 py-3 text-[#cbd5e1]">
                      {task.eps || '—'}
                    </td>

                    <td className="px-4 py-3 text-[#cbd5e1]">
                      {task.epf || '—'}
                    </td>

                    <td className="px-4 py-3 text-[#cbd5e1]">
                      {task.lps || '—'}
                    </td>

                    <td className="px-4 py-3 text-[#cbd5e1]">
                      {task.lpf || '—'}
                    </td>

                    <td className="px-4 py-3 font-bold">
                      {task.float ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* =====================================================
          PHASE TIMELINE
      ====================================================== */}

      <div
        id="phase-timeline-section"
        className="space-y-4"
      >

        <h3 className="text-sm font-bold text-[#f8fafc] flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#f59e0b]" />
          <span>
            Milestone Sequence & Float Timeline
          </span>
        </h3>


        {phases.length === 0 ? (
          <div className="p-12 text-center bg-[#1e293b] border border-dashed border-[#334155] rounded-lg text-[#94a3b8]">

            <GitBranch className="w-10 h-10 mx-auto text-[#64748b] mb-2" />

            <p className="font-semibold text-[#f8fafc]">
              No Milestones Added Yet
            </p>

            <p className="text-xs mt-1">
              Import your master phase schedule above
              to automatically populate the project plan.
            </p>

          </div>
        ) : (

          <div className="relative pl-6 border-l-2 border-[#334155] ml-4 space-y-6">

            {phases.map((phase) => {

              const phaseTasks = data.tasks.filter(
                (task) => task.phase_id === phase.id
              );

              const floatDays =
                calculatePhaseFloat(
                  phase.planned_finish
                );

              const isCritical =
                floatDays <= 0;

              const isWarning =
                floatDays > 0 &&
                floatDays <= 14;

              const floatBadge =
                isCritical ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-500/20 text-[#ef4444] border border-red-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />

                    <span>
                      ⚠️ CRITICAL ({floatDays}d float)
                    </span>
                  </span>
                ) : isWarning ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-[#f59e0b] border border-amber-500/30">
                    {floatDays} days float
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-[#10b981] border border-emerald-500/30">
                    {floatDays} days float
                  </span>
                );

              return (
                <div
                  key={phase.id}
                  className="relative group"
                >

                  {/* Timeline Dot */}

                  <div
                    className={`absolute -left-[31px] top-6 w-4 h-4 rounded-full border-2 border-[#0f172a] shadow-xs ${
                      phase.status ===
                      'Complete'
                        ? 'bg-[#10b981]'
                        : phase.status ===
                          'Active'
                        ? 'bg-[#f59e0b]'
                        : 'bg-[#64748b]'
                    }`}
                  />


                  {/* Phase Card */}

                  <div className="p-5 rounded-lg bg-[#1e293b] border border-[#334155] hover:border-[#64748b] transition-all shadow-md">

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#334155]/60">

                      <div>

                        <div className="flex items-center gap-2.5">

                          <span className="text-xs font-bold text-[#f59e0b] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {phase.id}
                          </span>

                          <h4 className="text-sm font-bold text-[#f8fafc]">
                            {phase.phase_name}
                          </h4>

                        </div>

                      </div>


                      <div className="flex items-center gap-2">

                        {floatBadge}

                        <select
                          id={`select-status-${phase.id}`}
                          value={phase.status}
                          onChange={(e) =>
                            onUpdatePhaseStatus(
                              phase.id,
                              e.target
                                .value as Phase['status']
                            )
                          }
                          className="bg-[#0f172a] border border-[#334155] rounded-md px-2.5 py-1 text-xs text-[#f8fafc] font-medium focus:border-[#f59e0b] focus:outline-none"
                        >
                          <option value="Planned">
                            Planned
                          </option>

                          <option value="Active">
                            Active
                          </option>

                          <option value="Complete">
                            Complete
                          </option>
                        </select>

                      </div>

                    </div>


                    <div className="mt-3.5 space-y-2">

                      <div className="text-xs font-semibold text-[#f8fafc] flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-[#10b981]" />

                        <span>
                          Milestone:
                        </span>

                        <span className="font-normal text-[#cbd5e1]">
                          {phase.milestone}
                        </span>
                      </div>


                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">

                        <div className="flex items-center gap-2">

                          <Calendar className="w-3.5 h-3.5 text-[#64748b]" />

                          <div>
                            <p className="text-[10px] text-[#64748b] uppercase font-bold">
                              Start
                            </p>

                            <p className="text-xs text-[#cbd5e1]">
                              {formatDate(
                                phase.planned_start
                              )}
                            </p>
                          </div>

                        </div>


                        <div className="flex items-center gap-2">

                          <Calendar className="w-3.5 h-3.5 text-[#64748b]" />

                          <div>
                            <p className="text-[10px] text-[#64748b] uppercase font-bold">
                              Finish
                            </p>

                            <p className="text-xs text-[#cbd5e1]">
                              {formatDate(
                                phase.planned_finish
                              )}
                            </p>
                          </div>

                        </div>


                        <div className="flex items-center gap-2">

                          <User className="w-3.5 h-3.5 text-[#64748b]" />

                          <div>
                            <p className="text-[10px] text-[#64748b] uppercase font-bold">
                              Responsible
                            </p>

                            <p className="text-xs text-[#cbd5e1]">
                              {phase.responsible ||
                                '—'}
                            </p>
                          </div>

                        </div>

                      </div>

                    </div>

                    {phaseTasks.length > 0 && (
                      <div className="mt-6 pt-5 border-t border-[#334155]">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-[#f8fafc]">
                            Planned Tasks
                          </h4>

                          <span className="text-xs text-[#94a3b8]">
                            {phaseTasks.length} task{phaseTasks.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {phaseTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-3 rounded-lg bg-slate-900/70 border border-[#334155]"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-[#64748b]">
                                      {task.id}
                                    </span>

                                    <span className="text-xs px-2 py-1 rounded bg-slate-800 text-cyan-400">
                                      {task.trade || 'Unassigned'}
                                    </span>
                                  </div>

                                  <p className="mt-2 text-sm font-semibold text-[#f8fafc]">
                                    {task.description}
                                  </p>

                                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#94a3b8]">
                                    <span>
                                      📍 {task.location || '—'}
                                    </span>

                                    <span>
                                      👤 {task.responsible || '—'}
                                    </span>

                                    <span>
                                      📅 Finish: {formatDate(task.must_finish_by)}
                                    </span>

                                    <span>
                                      ⏱ {task.duration_days || 0}d
                                    </span>
                                  </div>
                                </div>

                                <span
                                  className={
                                    task.pull_planned
                                      ? 'shrink-0 px-2 py-1 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                      : 'shrink-0 px-2 py-1 rounded text-xs bg-slate-800 text-slate-400 border border-slate-700'
                                  }
                                >
                                  {task.pull_planned
                                    ? 'Pull Planned'
                                    : 'Master Schedule'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </div>


      {/* =====================================================
          AUTOMATION FLOW
      ====================================================== */}

      <div className="p-5 rounded-lg bg-[#0f172a] border border-[#334155]">

        <div className="flex items-center gap-2 mb-4">

          <GitBranch className="w-4 h-4 text-[#f59e0b]" />

          <h3 className="text-sm font-bold text-[#f8fafc]">
            LPS Planning Flow
          </h3>

        </div>


        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">

          <div className="flex-1 p-3 rounded-lg bg-[#1e293b] border border-[#334155]">
            <p className="text-[10px] uppercase text-[#64748b] font-bold">
              01
            </p>

            <p className="text-xs font-bold text-[#f8fafc] mt-1">
              Master Phase Schedule
            </p>

            <p className="text-[10px] text-[#94a3b8] mt-1">
              XLSX / CSV
            </p>
          </div>


          <ArrowRight className="hidden md:block w-4 h-4 text-[#64748b]" />


          <div className="flex-1 p-3 rounded-lg bg-[#1e293b] border border-[#334155]">
            <p className="text-[10px] uppercase text-[#64748b] font-bold">
              02
            </p>

            <p className="text-xs font-bold text-[#f8fafc] mt-1">
              Phase Tasks
            </p>

            <p className="text-[10px] text-[#94a3b8] mt-1">
              Automatically created
            </p>
          </div>


          <ArrowRight className="hidden md:block w-4 h-4 text-[#64748b]" />


          <div className="flex-1 p-3 rounded-lg bg-[#1e293b] border border-[#334155]">
            <p className="text-[10px] uppercase text-[#64748b] font-bold">
              03
            </p>

            <p className="text-xs font-bold text-[#f8fafc] mt-1">
              Pull Planning
            </p>

            <p className="text-[10px] text-[#94a3b8] mt-1">
              Pull tasks backwards
            </p>
          </div>


          <ArrowRight className="hidden md:block w-4 h-4 text-[#64748b]" />


          <div className="flex-1 p-3 rounded-lg bg-[#1e293b] border border-[#334155]">
            <p className="text-[10px] uppercase text-[#64748b] font-bold">
              04
            </p>

            <p className="text-xs font-bold text-[#f8fafc] mt-1">
              Lookahead
            </p>

            <p className="text-[10px] text-[#94a3b8] mt-1">
              Make-ready planning
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};