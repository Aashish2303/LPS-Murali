export interface ProjectConfig {
  projectName?: string;
  project_name?: string;
  projectCode?: string;
  client?: string;
  contractor?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  current_week_key?: string;
  lookahead_weeks?: number;
  projectManager?: string;
  leanChampion?: string;
}

export interface Trade {
  id?: string;
  code?: string;
  name: string;
  abbr?: string;
  lead?: string;
  color?: string;
}

export type TradeItem = Trade;

export interface Area {
  id?: string;
  name: string;
  zone?: string;
}

export interface Phase {
  id: string;
  phase_name: string;
  milestone: string;
  name?: string;
  target_date?: string;
  buffer_days?: number;
  planned_start: string;
  planned_finish: string;
  responsible: string;
  status: 'Planned' | 'Active' | 'Complete';
}

export type Milestone = Phase;

export interface Task {
  id: string;
  phase_id: string;
  description: string;
  trade: string;
  responsible: string;
  location: string;
  duration_days: number;
  must_finish_by: string;
  planned_start?: string;
  planned_finish?: string;
  uom: string;
  status: 'Planned' | 'In Progress' | 'Complete';

  total_quantity?: number;
  daily_planned_quantity?: number;

  eps?: string;
  epf?: string;
  lps?: string;
  lpf?: string;
  float?: number | null;

  // Imported phase-schedule tasks are false by default.
  // They become true only when the user explicitly
  // selects them for Pull Planning.
  pull_planned?: boolean;
  lookahead_planned?: boolean;
}

export type ConstraintType =
  | 'Workforce'
  | 'Materials'
  | 'Drawings'
  | 'Equipment'
  | 'Approvals'
  | 'Prerequisite'
  | 'Space'
  | 'Safety'
  | 'Client'
  | 'Other';

export interface Constraint {
  id: string;
  task_id: string;
  type: ConstraintType;
  description: string;
  raised_by: string;
  responsible: string;
  raised_date: string;
  target_date: string;
  status: 'Open' | 'Resolved';
  resolved_date?: string | null;
}

export interface LookaheadItem {
  id: string;
  task_id: string;
  phase_id?: string | null;
  constraint_ids?: string[];
  week_key: string;

  planned_qty: number;
  carry_forward_qty?: number;
  remaining_qty?: number;

  ready: boolean;
  notes?: string;
}

export interface Commitment {
  id: string;
  task_id: string;
  week_key: string;
  committed_by: string;
  outcome?: 'done' | 'not_done' | 'pending' | null;
  lookahead_id?: string | null;
  planned_qty?: number;
  actual_qty?: number;
  reason_code?: number | null;
  reason_notes?: string;
  notes?: string;
  closed_at?: string;
  progress_percent?: number;
}

export interface ActualEntry {
  id: string;
  commitment_id: string;
  day_date: string;
  planned_qty: number;
  achieved_qty: number;
  note?: string;
  reason_code?: number | null;
}

export interface MetricRecord {
  id?: string;
  week_key: string;
  ppc: number | null;
  ta: number;
  tmr: number | null;
  crr: number | null;
  total_committed: number;
  total_done: number;
  status?: 'Open' | 'Closed';
  closeout_date?: string;
}

export interface CloseoutRecord {
  week_key: string;
  closed_by: string;
  closed_at: string;
  ppc: number;
  notes?: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LearnTopic {
  id: number;
  title: string;
  summary: string;
  content: string[];
  keyTakeaways: string[];
  quiz: QuizQuestion[];
}

export interface LearnProgress {
  topic_id: number;
  score: number;
  passed: boolean;
  completed_at?: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string;
  company?: string;
  avatarUrl?: string;
}

export interface LPSData {
  config: ProjectConfig;
  trades: Trade[];
  areas: (Area | string)[];
  phases: Phase[];
  milestones?: Phase[];
  tasks: Task[];
  constraints: Constraint[];
  lookahead: LookaheadItem[];
  commitments: Commitment[];
  actuals: ActualEntry[];
  metrics: MetricRecord[];
  closeouts: CloseoutRecord[];
  learnProgress: LearnProgress[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  client: string;
  location: string;
  projectCode: string;
  startDate: string;
  endDate: string;
  description: string;
  data: LPSData;
}

export interface ReasonCode {
  id: number;
  code: string;
  title: string;
  category: string;
  description: string;
}

export const REASON_CODES: ReasonCode[] = [
  { id: 1, code: 'RC-01', title: 'Workforce — Insufficient manpower', category: 'Labor', description: 'Crews were short-staffed or absent.' },
  { id: 2, code: 'RC-02', title: 'Diversion — Crew diverted to another task', category: 'Labor', description: 'Labor was pulled away to address urgent tasks elsewhere.' },
  { id: 3, code: 'RC-03', title: 'Skills — Required skills missing', category: 'Labor', description: 'Certified or specialized tradesmen were unavailable.' },
  { id: 4, code: 'RC-04', title: 'Supervision — Supervisor absent', category: 'Management', description: 'Foreman or supervisor was not present to direct works.' },
  { id: 5, code: 'RC-05', title: 'Quality — Rework required', category: 'Quality', description: 'Previous work failed inspection or required remedial action.' },
  { id: 6, code: 'RC-06', title: 'Weather — Adverse weather', category: 'Environment', description: 'Rain, wind, extreme heat, or conditions halted outdoor works.' },
  { id: 7, code: 'RC-07', title: 'Materials — Material not on site or wrong spec', category: 'Supply', description: 'Materials arrived late, damaged, or incorrect.' },
  { id: 8, code: 'RC-08', title: 'Drawings — Drawing or RFI not issued', category: 'Information', description: 'Approved construction drawings or RFI responses were missing.' },
  { id: 9, code: 'RC-09', title: 'Equipment — Plant unavailable', category: 'Equipment', description: 'Cranes, pumps, or essential tools broke down or were not booked.' },
  { id: 10, code: 'RC-10', title: 'Planning — Task not properly planned', category: 'Planning', description: 'Work sequence, access, or staging was flawed in advance.' },
  { id: 11, code: 'RC-11', title: 'Site Issues — Access or logistics', category: 'Logistics', description: 'Access route blocked, scaffolding incomplete, or area cluttered.' },
  { id: 12, code: 'RC-12', title: 'Safety — Safety hold or incident', category: 'Safety', description: 'Safety permit issue, missing guardrails, or safety stop.' },
  { id: 13, code: 'RC-13', title: 'Client — Client approval delay', category: 'Client', description: 'Owner/consultant hold point, sign-off, or scope clarification delay.' },
  { id: 14, code: 'RC-14', title: 'Payment — Sub-contractor payment dispute', category: 'Commercial', description: 'Subcontractor work stoppage due to commercial disputes.' },
  { id: 15, code: 'RC-15', title: 'Prev. Delay — Dependent task not complete', category: 'Sequence', description: 'Preceding trade did not finish handover in time.' },
];

export type NavItemKey =
  | 'dashboard'
  | 'plan-phase'
  | 'plan-pull'
  | 'plan-lookahead'
  | 'week-commit'
  | 'weekly-work-plan'
  | 'week-daily'
  | 'week-closeout'
  | 'metrics-this-week'
  | 'metrics-trends'
  | 'metrics-coaching'
  | 'learn-centre'
  | 'learn-guides'
  | 'setup-config'
  | 'setup-trades'
  | 'setup-init'
  | 'weekly-commit'
  | 'weekly-checkin'
  | 'weekly-closeout'
  | 'metrics-week'
  | 'learn-facilitator';
