
import * as XLSX from 'xlsx';

import {
  LPSData,
  MetricRecord,
  ProjectRecord,
  Task
} from '../types';
import { getInitialSampleData } from '../data/initialData';

const STORAGE_KEY = 'lps_data';
const SESSION_KEY = 'lps_session_user';
const PROJECTS_KEY = 'lps_projects';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ''
).replace(/\/$/, '');

async function readApiResponse(
  response: Response
): Promise<Record<string, any>> {
  const body = await response.text();

  try {
    return JSON.parse(body) as Record<string, any>;
  } catch {
    return {
      error:
        body.trim() ||
        `Backend returned HTTP ${response.status}.`
    };
  }
}

/*
 * ---------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------
 */

function ensureLPSData(data: Partial<LPSData>): LPSData {
  return {
    config: data.config || {},
    trades: data.trades || [],
    areas: data.areas || [],
    phases: data.phases || [],
    milestones: data.milestones || data.phases || [],
    tasks: data.tasks || [],
    constraints: data.constraints || [],
    lookahead: data.lookahead || [],
    commitments: data.commitments || [],
    actuals: data.actuals || [],
    metrics: data.metrics || [],
    closeouts: data.closeouts || [],
    learnProgress: data.learnProgress || []
  };
}

function cacheData(data: LPSData): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
  } catch (error) {
    console.error(
      'Failed to cache LPS data:',
      error
    );
  }
}

/*
 * ---------------------------------------------------------
 * Session
 * ---------------------------------------------------------
 */

export function getSessionUser(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSessionUser(email: string): void {
  try {
    localStorage.setItem(
      SESSION_KEY,
      email
    );
  } catch (error) {
    console.error(
      'Failed to set session user',
      error
    );
  }
}

export function clearSessionUser(): void {
  try {
    localStorage.removeItem(
      SESSION_KEY
    );
  } catch (error) {
    console.error(
      'Failed to clear session',
      error
    );
  }
}

/*
 * ---------------------------------------------------------
 * LPS DATA
 *
 * The backend / Supabase is the source of truth.
 *
 * getData() is intentionally synchronous because the
 * existing React components use it that way.
 *
 * Initial server synchronization is performed through
 * syncProjectData().
 * ---------------------------------------------------------
 */

export function getData(): LPSData {
  try {
    const raw = localStorage.getItem(
      STORAGE_KEY
    );

    if (raw) {
      return ensureLPSData(
        JSON.parse(raw)
      );
    }
  } catch (error) {
    console.error(
      'Error loading cached LPS data:',
      error
    );
  }

  const initial = ensureLPSData(
    getInitialSampleData()
  );

  cacheData(initial);

  return initial;
}

/*
 * Local cache only.
 *
 * Actual persistence to PostgreSQL happens through
 * saveProjectData().
 */
export function saveData(
  data: LPSData
): void {
  try {
    cacheData(
      ensureLPSData(data)
    );
  } catch (error) {
    console.error(
      'Error saving LPS data:',
      error
    );
  }
}

/*
 * ---------------------------------------------------------
 * PHASE SCHEDULE IMPORT
 * ---------------------------------------------------------
 *
 * Supported template:
 *
 * Sl. No. | Name | Description | Planned Start |
 * Planned Finish | Predecessor
 *
 * Predecessor can contain:
 *   1
 *   1, 3
 *   1, 3, 7
 *
 * Precedence type is currently assumed to be FS.
 * ---------------------------------------------------------
 */

export interface PhaseScheduleImportRow {
  slNo: number;
  name: string;
  description: string;
  plannedStart: string;
  plannedFinish: string;
  predecessors: string[];
  precedenceType: 'FS';

  eps: string;
  epf: string;
  lps: string;
  lpf: string;
  float: number | null;

  quantity: number;
  durationDays: number;
  uom: string;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function excelDateToISO(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      const month = String(parsed.m).padStart(2, '0');
      const day = String(parsed.d).padStart(2, '0');

      return `${parsed.y}-${month}-${day}`;
    }
  }

  const text = String(value).trim();

  if (!text) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const slashMatch = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (slashMatch) {
    const [, day, month, year] = slashMatch;

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const dashMatch = text.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/
  );

  if (dashMatch) {
    const [, day, month, year] = dashMatch;

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return text;
}

/**
 * Read the supplied PhaseSchedule XLSX/XLS/CSV file.
 *
 * This function only parses the file.
 * It does NOT write anything to Supabase.
 */
export async function parsePhaseScheduleFile(
  file: File
): Promise<PhaseScheduleImportRow[]> {
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true
  });

  if (!workbook.SheetNames.length) {
    throw new Error('The spreadsheet contains no worksheets.');
  }

  const sheetName =
    workbook.SheetNames.find(
      (name) =>
        normalizeHeader(name) === 'phaseschedule'
    ) || workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error('Unable to read the PhaseSchedule worksheet.');
  }

  const rows =
    XLSX.utils.sheet_to_json<Record<string, unknown>>(
      worksheet,
      {
        defval: '',
        raw: true
      }
    );

  if (!rows.length) {
    throw new Error(
      'The Phase Schedule spreadsheet contains no task rows.'
    );
  }

  const firstRow = rows[0];
  const headerMap = new Map<string, string>();

  Object.keys(firstRow).forEach((key) => {
    headerMap.set(
      normalizeHeader(key),
      key
    );
  });

  const requiredHeaders = [
    'sl. no.',
    'name',
    'description',
    'planned start',
    'planned finish',
    'predecessor',
    'eps',
    'epf',
    'lps',
    'lpf',
    'float'
  ];

  const missingHeaders =
    requiredHeaders.filter(
      (header) =>
        !headerMap.has(header)
    );

  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required columns: ${missingHeaders.join(', ')}`
    );
  }

  const getValue = (
    row: Record<string, unknown>,
    header: string
  ): unknown => {
    const actualHeader = headerMap.get(header);

    return actualHeader
      ? row[actualHeader]
      : '';
  };

  const parsedRows: PhaseScheduleImportRow[] = [];

  rows.forEach((row, index) => {
    const name = String(
      getValue(row, 'name') ?? ''
    ).trim();

    if (!name) {
      return;
    }

    const rawSlNo =
      getValue(row, 'sl. no.');

    const slNo =
      Number(rawSlNo);

    if (!Number.isFinite(slNo)) {
      throw new Error(
        `Invalid Sl. No. at spreadsheet row ${index + 2}.`
      );
    }

    const description =
      String(
        getValue(row, 'description') ?? ''
      ).trim();

    const plannedStart =
      excelDateToISO(
        getValue(row, 'planned start')
      );

    const plannedFinish =
      excelDateToISO(
        getValue(row, 'planned finish')
      );

    if (!plannedStart) {
      throw new Error(
        `Missing Planned Start for "${name}" at spreadsheet row ${index + 2}.`
      );
    }

    if (!plannedFinish) {
      throw new Error(
        `Missing Planned Finish for "${name}" at spreadsheet row ${index + 2}.`
      );
    }

    const predecessorText =
      String(
        getValue(row, 'predecessor') ?? ''
      ).trim();

    const predecessors =
      predecessorText
        ? predecessorText
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        : [];

    const eps =
      excelDateToISO(
        getValue(row, 'eps')
      );

    const epf =
      excelDateToISO(
        getValue(row, 'epf')
      );

    const lps =
      excelDateToISO(
        getValue(row, 'lps')
      );

    const lpf =
      excelDateToISO(
        getValue(row, 'lpf')
      );

    const rawFloat =
      getValue(row, 'float');

    const float =
      rawFloat === '' ||
      rawFloat === null ||
      rawFloat === undefined
        ? null
        : Number(rawFloat);

    if (
      float !== null &&
      !Number.isFinite(float)
    ) {
      throw new Error(
        `Invalid Float for "${name}" at spreadsheet row ${index + 2}.`
      );
    }

    const quantityValue = Number(
      getValue(row, 'quantity') ?? 0
    );

    if (
      !Number.isFinite(quantityValue) ||
      quantityValue < 0
    ) {
      throw new Error(
        `Task "${name}" has an invalid quantity.`
      );
    }

    const rawDuration = getValue(row, 'duration');
    const calculatedDuration = Math.max(
      1,
      Math.ceil(
        (new Date(plannedFinish).getTime() -
          new Date(plannedStart).getTime()) /
          86400000
      )
    );
    const durationDays =
      rawDuration === '' || rawDuration === null || rawDuration === undefined
        ? calculatedDuration
        : Number(rawDuration);

    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      throw new Error(`Task "${name}" has an invalid duration.`);
    }

    const uom = String(
      getValue(row, 'uom') ||
      getValue(row, 'unit') ||
      getValue(row, 'unit of measurement') ||
      row['uom'] ||
      row['UOM'] ||
      row['Unit'] ||
      row['Unit of Measurement'] ||
      ''
    ).trim();

    parsedRows.push({
      slNo,
      name,
      description,
      plannedStart,
      plannedFinish,
      predecessors,
      precedenceType: 'FS',

      eps,
      epf,
      lps,
      lpf,
      float,

      quantity: quantityValue,
      durationDays,
      uom
    });
  });

  const sequenceNumbers = new Set(
    parsedRows.map(
      (row) => String(row.slNo)
    )
  );

  for (const row of parsedRows) {
    for (const predecessor of row.predecessors) {
      if (!sequenceNumbers.has(predecessor)) {
        throw new Error(
          `Task "${row.name}" references predecessor "${predecessor}", but that task does not exist in the spreadsheet.`
        );
      }

      if (predecessor === String(row.slNo)) {
        throw new Error(
          `Task "${row.name}" cannot be its own predecessor.`
        );
      }
    }
  }

  return parsedRows.sort(
    (a, b) => a.slNo - b.slNo
  );
}

export async function importPhaseSchedule(
  projectId: string,
  file: File
): Promise<{
  success: boolean;
  tasks: Task[];
  count: number;
}> {
  const rows = await parsePhaseScheduleFile(file);

  if (!rows.length) {
    throw new Error(
      'No phase schedule tasks were found in the spreadsheet.'
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/phase-schedule`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rows
      })
    }
  );

  const result = await readApiResponse(response);

  if (!response.ok) {
    throw new Error(
      result?.details
        ? `${result?.message || 'Phase schedule import failed'}: ${result.details}`
        : result?.message ||
          result?.error ||
          'Failed to import phase schedule.'
    );
  }

  return result as {
    success: boolean;
    tasks: Task[];
    count: number;
  };
}

/*
 * ---------------------------------------------------------
 * PROJECT DATA API
 * ---------------------------------------------------------
 */

/**
 * Load one project's complete normalized workspace.
 *
 * Backend assembles:
 * projects
 * phases
 * trades
 * areas
 * tasks
 * constraints
 * lookahead
 * commitments
 * actuals
 * metrics
 * closeouts
 * learn_progress
 */
export async function syncProjectData(
  projectId: string
): Promise<ProjectRecord | null> {
  if (!API_BASE_URL) {
    console.error(
      'VITE_API_BASE_URL is missing'
    );
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/project-data/${encodeURIComponent(projectId)}`,
      {
        method: 'GET',
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      const text = await response.text();

      console.error(
        'Failed to load project data:',
        response.status,
        text
      );

      return null;
    }

    const project =
      (await response.json()) as ProjectRecord;

    if (
      !project ||
      !project.data
    ) {
      console.error(
        'Backend returned invalid project data'
      );

      return null;
    }

    const normalizedProject: ProjectRecord = {
      ...project,

      data: ensureLPSData(
        project.data
      )
    };

    /*
     * Cache the complete workspace so existing
     * synchronous components continue working.
     */
    cacheData(
      normalizedProject.data
    );

    localStorage.setItem(
      PROJECTS_KEY,
      JSON.stringify([
        normalizedProject
      ])
    );

    return normalizedProject;

  } catch (error) {
    console.error(
      'Error syncing project data:',
      error
    );

    return null;
  }
}

/**
 * Save the complete project workspace.
 *
 * This sends the existing frontend LPSData structure
 * to the backend. The backend writes the individual
 * relational tables.
 */
export async function saveProjectData(
  project: ProjectRecord
): Promise<boolean> {
  if (!API_BASE_URL) {
    console.error(
      'VITE_API_BASE_URL is missing'
    );

    return false;
  }

  try {
    const normalizedProject: ProjectRecord = {
      ...project,
      data: ensureLPSData(
        project.data
      )
    };

    const response = await fetch(
      `${API_BASE_URL}/api/project-data/${encodeURIComponent(project.id)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          normalizedProject
        )
      }
    );

    if (!response.ok) {
      const text = await response.text();

      console.error(
        'Failed to save project data:',
        response.status,
        text
      );

      return false;
    }

    /*
     * Only cache after successful PostgreSQL save.
     */
    cacheData(
      normalizedProject.data
    );

    return true;

  } catch (error) {
    console.error(
      'Error saving project data:',
      error
    );

    return false;
  }
}

/*
 * ---------------------------------------------------------
 * PROJECT LIST
 * ---------------------------------------------------------
 */

export function loadProjects(): ProjectRecord[] {
  try {
    const raw =
      localStorage.getItem(
        PROJECTS_KEY
      );

    if (raw) {
      return JSON.parse(
        raw
      ) as ProjectRecord[];
    }
  } catch (error) {
    console.error(
      'Error loading cached projects:',
      error
    );
  }

  return [];
}

export async function saveProjects(
  projects: ProjectRecord[]
): Promise<boolean> {
  if (!API_BASE_URL) {
    console.error(
      'VITE_API_BASE_URL is missing'
    );

    return false;
  }

  try {
    /*
     * Keep project-list endpoint working.
     */
    const response = await fetch(
      `${API_BASE_URL}/api/projects`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          projects
        )
      }
    );

    if (!response.ok) {
      console.error(
        'Failed to save projects:',
        response.status,
        await response.text()
      );

      return false;
    }

    /*
     * Cache project list.
     */
    localStorage.setItem(
      PROJECTS_KEY,
      JSON.stringify(projects)
    );

    /*
     * Also synchronize the currently supplied
     * project into the normalized relational tables.
     *
     * This means existing components can continue
     * calling saveProjects() without being rewritten.
     */
    for (const project of projects) {
      const saved =
        await saveProjectData(
          project
        );

      if (!saved) {
        console.error(
          `Failed to synchronize project ${project.id}`
        );

        return false;
      }
    }

    return true;

  } catch (error) {
    console.error(
      'Error saving projects:',
      error
    );

    return false;
  }
}

export async function syncProjectsFromServer(): Promise<
  ProjectRecord[] | null
> {
  if (!API_BASE_URL) {
    console.error(
      'VITE_API_BASE_URL is missing'
    );

    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/projects`,
      {
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      console.error(
        'Failed to load projects from backend:',
        response.status
      );

      return null;
    }

    const projects =
      (await response.json()) as ProjectRecord[];

    if (!Array.isArray(projects)) {
      console.error(
        'Backend returned invalid projects data'
      );

      return null;
    }

    localStorage.setItem(
      PROJECTS_KEY,
      JSON.stringify(projects)
    );

    /*
     * If there is a project, load its normalized
     * relational workspace too.
     *
     * This makes Supabase the source of truth for
     * the actual LPS workspace.
     */
    if (projects.length > 0) {
      const activeProject =
        projects[0];

      const fullProject =
        await syncProjectData(
          activeProject.id
        );

      if (fullProject) {
        const updatedProjects =
          projects.map(
            (project) =>
              project.id ===
              fullProject.id
                ? fullProject
                : project
          );

        localStorage.setItem(
          PROJECTS_KEY,
          JSON.stringify(
            updatedProjects
          )
        );

        return updatedProjects;
      }
    }

    return projects;

  } catch (error) {
    console.error(
      'Error syncing projects from backend:',
      error
    );

    return null;
  }
}

/*
 * ---------------------------------------------------------
 * IDs
 * ---------------------------------------------------------
 */

export function generateId(
  prefix: string
): string {
  const rand =
    Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();

  const num =
    Math.floor(
      100 +
      Math.random() * 900
    );

  return `${prefix}-${num}${rand.substring(
    0,
    1
  )}`;
}

/*
 * ---------------------------------------------------------
 * WEEK HELPERS
 * ---------------------------------------------------------
 */

export function currentWeekKey(): string {
  return getWeekKeyForDate(new Date());
}

export function getWeekKeyForDate(date: Date | string): string {
  const source = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;

  const d = new Date(
    Date.UTC(
      source.getFullYear(),
      source.getMonth(),
      source.getDate()
    )
  );

  const dayNum =
    d.getUTCDay() || 7;

  d.setUTCDate(
    d.getUTCDate() +
    4 -
    dayNum
  );

  const yearStart =
    new Date(
      Date.UTC(
        d.getUTCFullYear(),
        0,
        1
      )
    );

  const weekNo =
    Math.ceil(
      (
        (
          d.getTime() -
          yearStart.getTime()
        ) /
          86400000 +
        1
      ) / 7
    );

  return `${d.getUTCFullYear()}-W${String(
    weekNo
  ).padStart(2, '0')}`;
}

export function getWeekKeysBetween(
  startDate: string,
  endDate: string
): string[] {
  const start = getWeekStart(getWeekKeyForDate(startDate));
  const end = getWeekStart(getWeekKeyForDate(endDate));
  const weeks: string[] = [];

  if (!start || !end) return weeks;

  for (const cursor = new Date(`${start}T00:00:00`); cursor <= new Date(`${end}T00:00:00`); cursor.setDate(cursor.getDate() + 7)) {
    weeks.push(getWeekKeyForDate(cursor));
  }

  return weeks;
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getWeekStart(weekKey: string): string {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);

  if (!match) return '';

  const year = Number(match[1]);
  const week = Number(match[2]);

  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay() || 7;

  const monday = new Date(jan4);
  monday.setDate(
    jan4.getDate() - day + 1 + (week - 1) * 7
  );

  return toLocalDateString(monday);
}

export function getWeekEnd(weekKey: string): string {
  const start = getWeekStart(weekKey);

  if (!start) return '';

  const end = new Date(`${start}T00:00:00`);
  end.setDate(end.getDate() + 7);

  return toLocalDateString(end);
}

/*
 * ---------------------------------------------------------
 * TASK / FLOAT
 * ---------------------------------------------------------
 */

export function computeFloat(
  task: Task,
  todayDate: Date = new Date()
): number {
  if (!task.must_finish_by) {
    return 0;
  }

  const finishTime =
    new Date(
      task.must_finish_by
    ).getTime();

  const todayTime =
    new Date(
      todayDate
        .toISOString()
        .split('T')[0]
    ).getTime();

  const daysRemaining =
    Math.floor(
      (
        finishTime -
        todayTime
      ) / 86400000
    );

  return (
    daysRemaining -
    (task.duration_days || 1)
  );
}

/*
 * ---------------------------------------------------------
 * DATE
 * ---------------------------------------------------------
 */

export function formatDate(
  dateStr?: string
): string {
  if (!dateStr) {
    return '—';
  }

  try {
    const d =
      new Date(dateStr);

    if (
      isNaN(
        d.getTime()
      )
    ) {
      return dateStr;
    }

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];

    const day =
      String(
        d.getDate()
      ).padStart(2, '0');

    const month =
      months[d.getMonth()];

    const year =
      d.getFullYear();

    return `${day}-${month}-${year}`;

  } catch {
    return dateStr;
  }
}

/*
 * ---------------------------------------------------------
 * METRICS
 * ---------------------------------------------------------
 */

export function computeMetrics(
  weekKey: string,
  data: LPSData = getData()
): MetricRecord {
  const comms =
    data.commitments.filter(
      (c) =>
        c.week_key ===
        weekKey
    );

  const lookahead =
    data.lookahead.filter(
      (l) =>
        l.week_key ===
        weekKey
    );

  const allConstraints =
    data.constraints;

  /*
   * PPC
   */
  const totalCommitted =
    comms.length;

  const totalDone =
    comms.filter((commitment) => {
      const plannedQty = Number(commitment.planned_qty) || 0;

      const actualQty = data.actuals
        .filter(
          (actual) =>
            actual.commitment_id === commitment.id &&
            actual.day_date >= getWeekStart(weekKey) &&
            actual.day_date < getWeekEnd(weekKey)
        )
        .reduce(
          (sum, actual) =>
            sum + (Number(actual.achieved_qty) || 0),
          0
        );

      return actualQty >= plannedQty;
    });

  const ppc =
    totalCommitted > 0
      ? Math.round(
          (
            totalDone.length /
            totalCommitted
          ) * 100
        )
      : 0;

  const plannedQty = comms.reduce(
    (sum, commitment) =>
      sum + (Number(commitment.planned_qty) || 0),
    0
  );

  const actualQty = comms.reduce(
    (sum, commitment) =>
      sum +
      data.actuals
        .filter(
          (actual) =>
            actual.commitment_id === commitment.id &&
            actual.day_date >= getWeekStart(weekKey) &&
            actual.day_date < getWeekEnd(weekKey)
        )
        .reduce(
          (total, actual) =>
            total + (Number(actual.achieved_qty) || 0),
          0
        ),
    0
  );

  /*
   * TA
   */
  const ta =
    lookahead.filter(
      (l) =>
        l.ready === true
    ).length;

  /*
   * TMR
   */
  const tmr =
    lookahead.length > 0
      ? Math.round(
          (
            ta /
            lookahead.length
          ) * 100
        )
      : null;

  /*
   * CRR
   */
  const weekStart =
    getWeekStart(
      weekKey
    );

  const weekEnd =
    getWeekEnd(
      weekKey
    );

  const raised =
    allConstraints.filter(
      (c) => {
        if (!c.raised_date) {
          return false;
        }

        return (
          c.raised_date >= weekStart &&
          c.raised_date < weekEnd
        );
      }
    );

  const resolved =
    raised.filter(
      (c) =>
        c.status ===
        'Resolved'
    );

  const crr =
    raised.length > 0
      ? Math.round(
          (
            resolved.length /
            raised.length
          ) * 100
        )
      : null;

  const existingRecord =
    data.metrics.find(
      (m) =>
        m.week_key ===
        weekKey
    );

  return {
    week_key: weekKey,
    ppc,
    ta,
    tmr,
    crr,
    total_committed:
      totalCommitted,
    total_done:
      totalDone.length,
    planned_qty: plannedQty,
    actual_qty: actualQty,
    status:
      existingRecord?.status ||
      'Open'
  };
}

/*
 * ---------------------------------------------------------
 * CONSTRAINTS / READINESS
 * ---------------------------------------------------------
 */

export function constraintAppliesToWeek(
  constraint: LPSData['constraints'][number],
  weekKey?: string
): boolean {
  return !weekKey || !constraint.week_key || constraint.week_key === weekKey;
}

export function getOpenConstraintCount(
  taskId: string,
  constraints: LPSData['constraints'],
  weekKey?: string
): number {
  return constraints.filter(
    (c) =>
      c.task_id ===
        taskId &&
      c.status !==
        'Resolved' &&
      constraintAppliesToWeek(c, weekKey)
  ).length;
}

export function refreshLookaheadReadiness(
  lookahead: LPSData['lookahead'],
  constraints: LPSData['constraints']
): LPSData['lookahead'] {
  return lookahead.map(
    (item) => {
      const openCount =
        getOpenConstraintCount(
          item.task_id,
          constraints,
          item.week_key
        );

      return {
        ...item,
        ready:
          openCount === 0
      };
    }
  );
}

export function refreshReadiness(
  data: LPSData
): LPSData {
  const updatedLookahead =
    refreshLookaheadReadiness(
      data.lookahead,
      data.constraints
    );

  const updatedData = {
    ...data,
    lookahead:
      updatedLookahead
  };

  /*
   * Cache immediately so the UI remains
   * synchronous.
   *
   * The next saveProjectData/saveProjects call
   * persists this change to Supabase.
   */
  saveData(
    updatedData
  );

  return updatedData;
}

/*
 * ---------------------------------------------------------
 * COACHING
 * ---------------------------------------------------------
 */

export function getCoachingDiagnosis(
  ppc: number | null,
  tmr: number | null
) {
  if (
    ppc === null &&
    tmr === null
  ) {
    return {
      status: 'neutral',
      title:
        'Awaiting Weekly Cycle Data',
      badge:
        'No Data Yet',
      borderClass:
        'border-[#334155]',
      badgeClass:
        'bg-slate-700 text-slate-300',
      message:
        'No weekly cycle data recorded yet. Make trade commitments and close out a weekly plan to trigger automated Lean diagnostics.',
      actionItems: [
        'Organize a Weekly Work Plan (WWP) session with all trade foremen.',
        'Screen upcoming 3-week tasks in Lookahead and log critical constraints.',
        'Record daily check-ins to monitor variance early.'
      ]
    };
  }

  const p =
    ppc ?? 0;

  const t =
    tmr ?? 0;

  if (
    p < 70 &&
    t < 70
  ) {
    return {
      status: 'danger',
      title:
        'Make-Ready Process Is Failing',
      badge:
        'Critical Bottleneck',
      borderClass:
        'border-[#ef4444]',
      badgeClass:
        'bg-red-500/20 text-red-400 border border-red-500/30',
      message:
        'Both commitment reliability (PPC) and make-ready preparation (TMR) are below acceptable thresholds. Foremen are committing to unready work riddled with open drawings, material, or prerequisite roadblocks.',
      actionItems: [
        'Enforce the Make-Ready Gate: Strictly forbid committing any task with open constraints.',
        'Conduct a dedicated Constraint Clearance War Room with Project Engineers and Procurement.',
        'Review the 15 Reason Codes from recent closeouts to eliminate repeating supplier failures.'
      ]
    };
  }

  if (
    p < 70 &&
    t >= 70
  ) {
    return {
      status: 'warning',
      title:
        'Planning Quality & Execution Needs Attention',
      badge:
        'Execution Variance',
      borderClass:
        'border-[#f59e0b]',
      badgeClass:
        'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      message:
        'Tasks are entering the week fully prepared (high TMR), but commitments are still being broken. This indicates overly optimistic task sizing, labor shortages, craft skill deficits, or poor supervisor presence on site.',
      actionItems: [
        'Calibrate task durations: Break 5-day tasks into 2-day or 3-day explicit measurable chunks.',
        'Review manpower gang sizing and daily craft attendance records with trade foremen.',
        'Conduct 10-minute daily check-in standups to prevent small delays from compounding.'
      ]
    };
  }

  if (
    p >= 70 &&
    t < 70
  ) {
    return {
      status: 'warning',
      title:
        'Warning: Unsustainable Execution (Firefighting)',
      badge:
        'Heroic Bias',
      borderClass:
        'border-[#f97316]',
      badgeClass:
        'bg-orange-500/20 text-orange-400 border border-orange-500/30',
      message:
        'Current commitments are being delivered heroically, but the lookahead pipeline is dry and choked with constraints (low TMR). The site is running on borrowed momentum and will hit a severe stoppage in 2 to 3 weeks if make-ready is neglected.',
      actionItems: [
        'Shift management focus immediately from today’s fires to the 3-6 week lookahead horizon.',
        'Assign concrete target clearance dates to all drawings, permits, and long-lead material RFIs.',
        'Schedule a mid-week Lookahead Make-Ready session with all subcontractor leads.'
      ]
    };
  }

  return {
    status: 'success',
    title:
      'System Is Working Well — High Reliability Flow',
    badge:
      'High Reliability',
    borderClass:
      'border-[#10b981]',
    badgeClass:
      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    message:
      'Healthy synergy between Lookahead filtration and Weekly commitment fulfillment. Trades are receiving clear handoffs and delivering promises predictably.',
    actionItems: [
      'Celebrate weekly reliability achievements in the Big Room to reinforce lean culture.',
      'Maintain standard operating discipline; do not relax constraint tracking.',
      'Look for opportunities to pull forward non-critical float activities.'
    ]
  };
}

/*
 * ---------------------------------------------------------
 * EXPORT JSON
 * ---------------------------------------------------------
 */

export function exportDataAsJSON(
  customData?: LPSData
): void {
  const data =
    customData ||
    getData();

  const jsonStr =
    JSON.stringify(
      data,
      null,
      2
    );

  const blob =
    new Blob(
      [jsonStr],
      {
        type:
          'application/json'
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const a =
    document.createElement(
      'a'
    );

  a.href = url;

  a.download =
    `lps_data_backup_${new Date()
      .toISOString()
      .split('T')[0]}.json`;

  document.body.appendChild(
    a
  );

  a.click();

  document.body.removeChild(
    a
  );

  URL.revokeObjectURL(
    url
  );
}

/*
 * ---------------------------------------------------------
 * CSV EXPORT
 * ---------------------------------------------------------
 */

function csvCell(
  value: unknown
): string {
  const text =
    typeof value ===
    'string'
      ? value
      : JSON.stringify(
          value ?? ''
        );

  return `"${String(
    text
  ).replace(
    /"/g,
    '""'
  )}"`;
}

export function exportDataAsSpreadsheet(
  data: LPSData
): void {
  const sections = [
    [
      'Project Configuration',
      [data.config]
    ],
    [
      'Phases',
      data.phases
    ],
    [
      'Trades',
      data.trades
    ],
    [
      'Areas',
      data.areas
    ],
    [
      'Tasks',
      data.tasks
    ],
    [
      'Constraints',
      data.constraints
    ],
    [
      'Lookahead',
      data.lookahead
    ],
    [
      'Commitments',
      data.commitments
    ],
    [
      'Actuals',
      data.actuals
    ],
    [
      'Metrics',
      data.metrics
    ],
    [
      'Closeouts',
      data.closeouts
    ]
  ] as [
    string,
    unknown[]
  ][];

  const rows: string[] = [];

  sections.forEach(
    ([name, records]) => {
      rows.push(
        csvCell(name)
      );

      const keys =
        Array.from(
          new Set(
            records.flatMap(
              (record) =>
                Object.keys(
                  record as object
                )
            )
          )
        );

      if (keys.length) {
        rows.push(
          keys
            .map(csvCell)
            .join(',')
        );

        records.forEach(
          (record) =>
            rows.push(
              keys
                .map(
                  (key) =>
                    csvCell(
                      (
                        record as Record<
                          string,
                          unknown
                        >
                      )[key]
                    )
                )
                .join(',')
            )
        );
      }

      rows.push('');
    }
  );

  const blob =
    new Blob(
      [rows.join('\r\n')],
      {
        type:
          'text/csv;charset=utf-8'
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      'a'
    );

  link.href = url;

  link.download =
    `lps_spreadsheet_${new Date()
      .toISOString()
      .split('T')[0]}.csv`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url
  );
}

/*
 * ---------------------------------------------------------
 * IMPORT / RESET
 * ---------------------------------------------------------
 */

export function importDataFromJSON(
  jsonString: string
): LPSData | null {
  try {
    const parsed =
      JSON.parse(
        jsonString
      ) as LPSData;

    const normalized =
      ensureLPSData(
        parsed
      );

    saveData(
      normalized
    );

    return normalized;

  } catch (error) {
    console.error(
      'Failed to import JSON data',
      error
    );

    return null;
  }
}

export function resetToSampleData(): LPSData {
  const sample =
    ensureLPSData(
      getInitialSampleData()
    );

  saveData(
    sample
  );

  return sample;
}

/*
 * ---------------------------------------------------------
 * TOTAL OPEN CONSTRAINTS
 * ---------------------------------------------------------
 */

export function getOpenConstraintsCountTotal(
  constraints: {
    status: string;
  }[]
): number {
  return constraints.filter(
    (c) =>
      c.status !==
      'Resolved'
  ).length;
}

/*
 * ---------------------------------------------------------
 * BACKWARD-COMPATIBLE EXPORTS
 * ---------------------------------------------------------
 *
 * Existing components can continue using:
 *
 *   loadLPSData()
 *   saveLPSData()
 *
 * without changes.
 * ---------------------------------------------------------
 */

export const loadLPSData =
  getData;

export const saveLPSData =
  saveData;