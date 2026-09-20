import 'dotenv/config';

import express, {
  Request,
  Response,
  NextFunction
} from 'express';
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const app = express();

const port = Number(process.env.PORT) || 4000;
const frontendDistPath =
  process.env.FRONTEND_DIST_DIR ||
  path.resolve(process.cwd(), 'frontend/dist');
const frontendIndexPath =
  path.join(frontendDistPath, 'index.html');
const hasFrontendBuild =
  fs.existsSync(frontendIndexPath);

const supabaseUrl = process.env.SUPABASE_URL;

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    'SUPABASE_URL is missing from backend/.env'
  );
}

if (!supabaseSecretKey) {
  throw new Error(
    'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing from backend/.env'
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);

/*
 * ---------------------------------------------------------
 * Middleware
 * ---------------------------------------------------------
 */

app.use(express.json({ limit: '10mb' }));

// CORS
app.use(
  (
    _request: Request,
    response: Response,
    next: NextFunction
  ) => {
    response.setHeader(
      'Access-Control-Allow-Origin',
      process.env.CORS_ORIGIN || '*'
    );

    response.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );

    response.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );

    if (_request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }

    next();
  }
);

/*
 * ---------------------------------------------------------
 * Health / Root
 * ---------------------------------------------------------
 */

app.get(
  '/',
  (_request: Request, response: Response) => {
    if (
      process.env.NODE_ENV === 'production' &&
      hasFrontendBuild
    ) {
      response.sendFile(
        frontendIndexPath
      );
      return;
    }

    response.json({
      status: 'ok',
      service: 'LPS Tool Backend',
      message: 'Backend is running'
    });
  }
);

app.get(
  '/api/health',
  (_request: Request, response: Response) => {
    response.json({
      status: 'ok'
    });
  }
);

/*
 * ---------------------------------------------------------
 * Projects API
 * ---------------------------------------------------------
 */

// GET all projects
app.get(
  '/api/projects',
  async (
    _request: Request,
    response: Response
  ) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', {
          ascending: true
        });

      if (error) {
        console.error(
          'Unable to load projects from Supabase:',
          error
        );

        response.status(500).json({
          error: 'Unable to load projects'
        });

        return;
      }

      response.json(data ?? []);
    } catch (error) {
      console.error(
        'Unexpected error loading projects:',
        error
      );

      response.status(500).json({
        error: 'Unable to load projects'
      });
    }
  }
);


// PUT / replace all projects
app.put(
  '/api/projects',
  async (
    request: Request,
    response: Response
  ) => {
    try {
      if (!Array.isArray(request.body)) {
        response.status(400).json({
          error: 'Projects payload must be an array'
        });

        return;
      }

      const projects = request.body;

      if (projects.length === 0) {
        response.json({
          status: 'ok',
          count: 0
        });

        return;
      }

      /*
       * Insert the complete project list.
       */

      const rows = projects.map(
        (project: any) => ({
          id: project.id,
          name: project.name ?? '',
          client: project.client ?? '',
          location: project.location ?? '',
          project_code:
            project.projectCode ?? '',
          start_date:
            project.startDate || null,
          end_date:
            project.endDate || null,
          description:
            project.description ?? '',
          data: project.data ?? {}
        })
      );

      const { error: insertError } =
        await supabase
          .from('projects')
          .upsert(rows, { onConflict: 'id' });

      if (insertError) {
        console.error(
          'Unable to insert projects into Supabase:',
          insertError
        );

        response.status(500).json({
          error: 'Unable to save projects'
        });

        return;
      }

      response.json({
        status: 'ok',
        count: projects.length
      });
    } catch (error) {
      console.error(
        'Unexpected error saving projects:',
        error
      );

      response.status(500).json({
        error: 'Unable to save projects'
      });
    }
  }
);


/*
 * ---------------------------------------------------------
 * TEMPORARY: Migrate project JSONB data
 * into relational Supabase tables
 * ---------------------------------------------------------
 */

app.post(
  '/api/migrate-projects',
  async (
    _request: Request,
    response: Response
  ) => {
    try {

      /*
       * Get projects from the existing
       * projects table.
       *
       * The detailed project data is currently
       * stored inside the JSONB `data` column.
       */

      const {
        data: projects,
        error: projectError
      } = await supabase
        .from('projects')
        .select('*');

      if (projectError) {
        throw projectError;
      }

      if (
        !projects ||
        projects.length === 0
      ) {
        response.json({
          status: 'ok',
          message:
            'No projects found to migrate'
        });

        return;
      }

      let migratedProjects = 0;

      for (const project of projects) {

        const projectId = project.id;

        const data = project.data || {};


        /*
         * -------------------------------------------------
         * PHASES
         * -------------------------------------------------
         */

        if (
          Array.isArray(data.phases) &&
          data.phases.length > 0
        ) {
          const rows =
            data.phases.map(
              (phase: any) => ({
                id: phase.id,
                project_id: projectId,
                phase_name:
                  phase.phase_name,
                status:
                  phase.status,
                milestone:
                  phase.milestone,
                responsible:
                  phase.responsible,
                planned_start:
                  phase.planned_start ||
                  null,
                planned_finish:
                  phase.planned_finish ||
                  null
              })
            );

          const { error } =
            await supabase
              .from('phases')
              .upsert(rows);

          if (error) {
            throw error;
          }
        }


        /*
         * -------------------------------------------------
         * TRADES
         * -------------------------------------------------
         */

        if (
          Array.isArray(data.trades) &&
          data.trades.length > 0
        ) {
          const rows =
            data.trades.map(
              (trade: any) => ({
                id: trade.id,
                project_id: projectId,
                abbr: trade.abbr,
                name: trade.name
              })
            );

          const { error } =
            await supabase
              .from('trades')
              .upsert(rows);

          if (error) {
            throw error;
          }
        }


        /*
         * -------------------------------------------------
         * AREAS
         * -------------------------------------------------
         */

        if (
          Array.isArray(data.areas) &&
          data.areas.length > 0
        ) {
          const rows =
            data.areas.map(
              (area: any) => ({
                id: area.id,
                project_id: projectId,
                name: area.name,
                zone: area.zone
              })
            );

          const { error } =
            await supabase
              .from('areas')
              .upsert(rows);

          if (error) {
            throw error;
          }
        }


        /*
         * -------------------------------------------------
         * TASKS
         * -------------------------------------------------
         */

        if (
          Array.isArray(data.tasks) &&
          data.tasks.length > 0
        ) {
          const rows =
            data.tasks.map(
              (task: any) => ({
                id: task.id,
                project_id: projectId,
                uom: task.uom,
                trade: task.trade,
                status: task.status,
                location: task.location,
                phase_id:
                  task.phase_id ||
                  null,
                description:
                  task.description,
                responsible:
                  task.responsible,
                duration_days:
                  task.duration_days,
                must_finish_by:
                  task.must_finish_by ||
                  null,

                // IMPORTANT:
                // Persist Pull Planning selection
                // in Supabase.
                pull_planned:
                  task.pull_planned === true
              })
            );

          const { error } =
            await supabase
              .from('tasks')
              .upsert(rows);

          if (error) {
            throw error;
          }
        }


        /*
         * -------------------------------------------------
         * CONSTRAINTS
         * -------------------------------------------------
         */

        if (
          Array.isArray(data.constraints) &&
          data.constraints.length > 0
        ) {
          const rows =
            data.constraints.map(
              (item: any) => ({
                id: item.id,
                project_id: projectId,
                task_id:
                  item.task_id ||
                  null,
                type: item.type,
                status: item.status,
                raised_by:
                  item.raised_by,
                description:
                  item.description,
                raised_date:
                  item.raised_date ||
                  null,
                responsible:
                  item.responsible,
                target_date:
                  item.target_date ||
                  null,
                resolved_date:
                  item.resolved_date ||
                  null
              })
            );

          const { error } =
            await supabase
              .from('constraints')
              .upsert(rows);

          if (error) {
            throw error;
          }
        }


        /*
         * -------------------------------------------------
         * LOOKAHEAD
         * -------------------------------------------------
         */

        if (
          Array.isArray(data.lookahead) &&
          data.lookahead.length > 0
        ) {
          const rows =
            data.lookahead.map(
              (item: any) => ({
                id: item.id,
                project_id: projectId,
                task_id:
                  item.task_id ||
                  null,
                week_key:
                  item.week_key,
                planned_qty:
                  item.planned_qty,
                ready:
                  item.ready,
                notes:
                  item.notes
              })
            );

          const { error } =
            await supabase
              .from('lookahead')
              .upsert(rows);

          if (error) {
            throw error;
          }
        }


        /*
         * -------------------------------------------------
         * COMMITMENTS
         * -------------------------------------------------
         */

        if (
          Array.isArray(data.commitments) &&
          data.commitments.length > 0
        ) {
          const rows =
            data.commitments.map(
              (item: any) => ({
                id: item.id,
                project_id: projectId,
                task_id:
                  item.task_id ||
                  null,
                week_key:
                  item.week_key,
                outcome:
                  item.outcome,
                closed_at:
                  item.closed_at ||
                  null,
                committed_by:
                  item.committed_by,
                progress_percent:
                  item.progress_percent,
                reason_code:
                  item.reason_code ??
                  null,
                reason_notes:
                  item.reason_notes ??
                  null,
                handoffs:
                  item.handoffs ??
                  []
              })
            );

          const { error } =
            await supabase
              .from('commitments')
              .upsert(rows);

          if (error) {
            throw error;
          }
        }


        /*
         * -------------------------------------------------
         * ACTUALS
         * -------------------------------------------------
         */

        if (
          Array.isArray(data.actuals) &&
          data.actuals.length > 0
        ) {
          const rows =
            data.actuals.map(
              (item: any) => ({
                id: item.id,
                project_id: projectId,
                commitment_id:
                  item.commitment_id ||
                  null,
                day_date:
                  item.day_date ||
                  null,
                planned_qty:
                  item.planned_qty,
                achieved_qty:
                  item.achieved_qty,
                note:
                  item.note
              })
            );

          const { error } =
            await supabase
              .from('actuals')
              .upsert(rows);

          if (error) {
            throw error;
          }
        }


        /*
         * -------------------------------------------------
         * METRICS
         * -------------------------------------------------
         */

        if (
          Array.isArray(data.metrics) &&
          data.metrics.length > 0
        ) {
          const rows =
            data.metrics.map(
              (item: any) => ({
                project_id: projectId,
                week_key:
                  item.week_key,
                ppc:
                  item.ppc,
                ta:
                  item.ta,
                crr:
                  item.crr,
                tmr:
                  item.tmr,
                total_done:
                  item.total_done,
                total_committed:
                  item.total_committed,
                status:
                  item.status
              })
            );

          const { error } =
            await supabase
              .from('metrics')
              .upsert(
                rows,
                {
                  onConflict:
                    'project_id,week_key'
                }
              );

          if (error) {
            throw error;
          }
        }


        /*
         * -------------------------------------------------
         * CLOSEOUTS
         * -------------------------------------------------
         */

        if (
          Array.isArray(data.closeouts) &&
          data.closeouts.length > 0
        ) {
          const rows =
            data.closeouts.map(
              (item: any) => ({
                project_id: projectId,
                week_key:
                  item.week_key,
                ppc:
                  item.ppc,
                notes:
                  item.notes,
                closed_at:
                  item.closed_at ||
                  null,
                closed_by:
                  item.closed_by
              })
            );

          const { error } =
            await supabase
              .from('closeouts')
              .upsert(
                rows,
                {
                  onConflict:
                    'project_id,week_key'
                }
              );

          if (error) {
            throw error;
          }
        }


        /*
         * -------------------------------------------------
         * LEARN PROGRESS
         * -------------------------------------------------
         */

        if (
          Array.isArray(data.learnProgress) &&
          data.learnProgress.length > 0
        ) {
          const rows =
            data.learnProgress.map(
              (item: any) => ({
                project_id: projectId,
                topic_id:
                  item.topic_id,
                score:
                  item.score,
                passed:
                  item.passed,
                completed_at:
                  item.completed_at ||
                  null
              })
            );

          const { error } =
            await supabase
              .from('learn_progress')
              .upsert(rows);

          if (error) {
            throw error;
          }
        }


        /*
         * Project successfully processed
         */

        migratedProjects++;
      }


      /*
       * -------------------------------------------------
       * SUCCESS
       * -------------------------------------------------
       */

      response.json({
        status: 'success',
        message:
          'Projects migrated successfully',
        migratedProjects
      });

    } catch (error) {

      /*
       * IMPORTANT:
       * Print the complete Supabase error.
       * This helps us identify exactly which
       * table/column/constraint failed.
       */

      console.error(
        '========== MIGRATION ERROR =========='
      );

      console.error(error);

      if (
        error &&
        typeof error === 'object'
      ) {
        console.error(
          JSON.stringify(
            error,
            null,
            2
          )
        );
      }

      console.error(
        '===================================='
      );


      response.status(500).json({
        status: 'error',
        message: 'Migration failed',
        details:
          error &&
          typeof error === 'object'
            ? error
            : String(error)
      });
    }
  }
);

app.post(
  '/api/projects/:projectId/phase-schedule',
  async (request: Request, response: Response) => {
    try {
      const { projectId } = request.params;
      const { rows } = request.body;

      if (!projectId) {
        return response.status(400).json({
          status: 'error',
          message: 'Project ID is required'
        });
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        return response.status(400).json({
          status: 'error',
          message: 'Phase schedule rows are required'
        });
      }

      /*
       * --------------------------------------------------
       * 1. Validate project
       * --------------------------------------------------
       */

      const { data: project, error: projectError } =
        await supabase
          .from('projects')
          .select('id')
          .eq('id', projectId)
          .single();

      if (projectError || !project) {
        return response.status(404).json({
          status: 'error',
          message: 'Project not found',
          details: projectError
        });
      }

      /*
       * --------------------------------------------------
       * 2. Build task IDs
       * --------------------------------------------------
       *
       * Spreadsheet Sl. No. becomes:
       *
       * PS-001
       * PS-002
       * PS-003
       *
       */

      const sequenceToTaskId = new Map<
        string,
        string
      >();

      rows.forEach((row: any) => {
        const slNo = Number(row.slNo);

        const taskId =
          `PS-${String(slNo).padStart(3, '0')}`;

        sequenceToTaskId.set(
          String(slNo),
          taskId
        );
      });

      /*
       * --------------------------------------------------
       * 3. Convert spreadsheet rows -> DB tasks
       * --------------------------------------------------
       */

      const tasks = rows.map((row: any) => {
        const slNo = Number(row.slNo);

        const taskId =
          sequenceToTaskId.get(String(slNo));

        if (!taskId) {
          throw new Error(
            `Unable to generate task ID for row ${slNo}`
          );
        }

        const predecessors =
          Array.isArray(row.predecessors)
            ? row.predecessors
                .map((value: any) =>
                  sequenceToTaskId.get(
                    String(value).trim()
                  )
                )
                .filter(Boolean)
            : [];

        const startDate =
          new Date(row.plannedStart);

        const finishDate =
          new Date(row.plannedFinish);

        const durationDays = Number(row.durationDays) || Math.max(
          1,
          Math.ceil(
            (finishDate.getTime() - startDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );

        return {
          id: taskId,
          project_id: projectId,
          uom: row.uom || '—',
          trade: 'Phase Schedule',
          status: 'Planned',
          pull_planned: false,
          lookahead_planned: false,

          total_quantity: row.quantity,

          daily_planned_quantity:
            durationDays > 0
              ? row.quantity / durationDays
              : row.quantity,

          location: '',
          phase_id: null,

          description:
            row.description?.trim() ||
            row.name?.trim() ||
            `Phase Schedule Task ${slNo}`,

          responsible: '',
          duration_days: durationDays,

          must_finish_by:
            row.plannedFinish,

          // NEW MASTER SCHEDULE DATES
          eps: row.eps || null,
          epf: row.epf || null,
          lps: row.lps || null,
          lpf: row.lpf || null,

          // NEW FLOAT
          float:
            row.float !== undefined &&
            row.float !== ''
              ? Number(row.float)
              : null,

          precedence_type: 'FS',
          predecessors
        };
      });

      /*
       * --------------------------------------------------
       * 4. Remove previously imported Phase Schedule tasks
       * --------------------------------------------------
       *
       * This makes re-importing the same schedule safe.
       *
       */

      const { error: deleteError } =
        await supabase
          .from('tasks')
          .delete()
          .eq('project_id', projectId)
          .like('id', 'PS-%');

      if (deleteError) {
        throw deleteError;
      }

      /*
       * --------------------------------------------------
       * 5. Insert imported tasks
       * --------------------------------------------------
       */

      const { data: insertedTasks, error: insertError } =
        await supabase
          .from('tasks')
          .upsert(tasks, {
            onConflict: 'id'
          })
          .select('*');

      if (insertError) {
        throw insertError;
      }

      /*
       * --------------------------------------------------
       * 6. Return imported tasks
       * --------------------------------------------------
       */

      return response.json({
        success: true,
        count: insertedTasks?.length ?? 0,
        tasks: insertedTasks ?? []
      });
    } catch (error: any) {
      console.error(
        'PHASE SCHEDULE IMPORT ERROR:',
        error
      );

      return response.status(500).json({
        status: 'error',
        message: 'Phase schedule import failed',
        details: error?.message || error
      });
    }
  }
);

/*
 * ---------------------------------------------------------
 * PROJECT WORKSPACE API
 *
 * Reads/writes the normalized Supabase tables and converts
 * them to/from the LPSData structure expected by the frontend.
 * ---------------------------------------------------------
 */

app.get(
  '/api/project-data/:projectId',
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const projectId = request.params.projectId;

      /*
       * Load project
       */
      const {
        data: project,
        error: projectError
      } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        console.error('Project load error:', projectError);

        response.status(500).json({
          error: 'Unable to load project',
          details: projectError
        });

        return;
      }

      /*
       * Load all relational tables in parallel.
       */
      const [
        phasesResult,
        tradesResult,
        areasResult,
        tasksResult,
        constraintsResult,
        lookaheadResult,
        commitmentsResult,
        actualsResult,
        metricsResult,
        closeoutsResult,
        learnProgressResult
      ] = await Promise.all([
        supabase
          .from('phases')
          .select('*')
          .eq('project_id', projectId),

        supabase
          .from('trades')
          .select('*')
          .eq('project_id', projectId),

        supabase
          .from('areas')
          .select('*')
          .eq('project_id', projectId),

        supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId),

        supabase
          .from('constraints')
          .select('*')
          .eq('project_id', projectId),

        supabase
          .from('lookahead')
          .select('*')
          .eq('project_id', projectId),

        supabase
          .from('commitments')
          .select('*')
          .eq('project_id', projectId),

        supabase
          .from('actuals')
          .select('*')
          .eq('project_id', projectId),

        supabase
          .from('metrics')
          .select('*')
          .eq('project_id', projectId),

        supabase
          .from('closeouts')
          .select('*')
          .eq('project_id', projectId),

        supabase
          .from('learn_progress')
          .select('*')
          .eq('project_id', projectId)
      ]);

      const results = [
        phasesResult,
        tradesResult,
        areasResult,
        tasksResult,
        constraintsResult,
        lookaheadResult,
        commitmentsResult,
        actualsResult,
        metricsResult,
        closeoutsResult,
        learnProgressResult
      ];

      const failed = results.find(
        (result) => result.error
      );

      if (failed?.error) {
        console.error(
          'Relational project data load error:',
          failed.error
        );

        response.status(500).json({
          error: 'Unable to load project data',
          details: failed.error
        });

        return;
      }

      /*
       * Convert database rows back into the exact
       * structure expected by the existing frontend.
       */

      /*
       * Relational rows are authoritative, but fields that have no
       * column yet (e.g. carry_forward_qty) are restored from the
       * JSONB copy saved with the project. Null columns never
       * override JSONB values.
       */
      const jsonb: any = project.data ?? {};

      const keyOf = (item: any) =>
        item?.id ?? item?.week_key ?? item?.topic_id;

      const mergeRows = (
        rows: any[] | null,
        saved: any
      ) => {
        const savedByKey = new Map<any, any>(
          (Array.isArray(saved) ? saved : [])
            .filter(
              (item: any) =>
                item && typeof item === 'object'
            )
            .map((item: any) => [keyOf(item), item])
        );

        return (rows ?? []).map((row: any) => {
          const extra = savedByKey.get(keyOf(row));

          if (!extra) {
            return row;
          }

          const definedRow = Object.fromEntries(
            Object.entries(row).filter(
              ([, value]) => value !== null
            )
          );

          return { ...extra, ...definedRow };
        });
      };

      const lpsData = {
        ...jsonb,

        phases: mergeRows(
          phasesResult.data,
          jsonb.phases
        ),

        trades: mergeRows(
          tradesResult.data,
          jsonb.trades
        ),

        areas: areasResult.data ?? [],

        tasks: mergeRows(
          tasksResult.data,
          jsonb.tasks
        ),

        constraints: mergeRows(
          constraintsResult.data,
          jsonb.constraints
        ),

        lookahead: mergeRows(
          lookaheadResult.data,
          jsonb.lookahead
        ),

        commitments: mergeRows(
          commitmentsResult.data,
          jsonb.commitments
        ),

        actuals: mergeRows(
          actualsResult.data,
          jsonb.actuals
        ),

        metrics: mergeRows(
          metricsResult.data,
          jsonb.metrics
        ),

        closeouts: mergeRows(
          closeoutsResult.data,
          jsonb.closeouts
        ),

        learnProgress: mergeRows(
          learnProgressResult.data,
          jsonb.learnProgress
        )
      };

      /*
       * Commitments saved before planned_qty/actual_qty were persisted
       * come back as 0. Rebuild them from the Lookahead item and the
       * recorded daily actuals.
       */
      lpsData.commitments = lpsData.commitments.map(
        (commitment: any) => {
          const lookaheadItem =
            lpsData.lookahead.find(
              (item: any) =>
                item.id === commitment.lookahead_id
            ) ??
            lpsData.lookahead.find(
              (item: any) =>
                item.task_id === commitment.task_id &&
                item.week_key === commitment.week_key
            );

          const recordedQty = lpsData.actuals
            .filter(
              (actual: any) =>
                actual.commitment_id === commitment.id
            )
            .reduce(
              (sum: number, actual: any) =>
                sum + (Number(actual.achieved_qty) || 0),
              0
            );

          return {
            ...commitment,
            planned_qty:
              Number(commitment.planned_qty) ||
              Number(lookaheadItem?.planned_qty) ||
              0,
            actual_qty:
              Number(commitment.actual_qty) ||
              recordedQty
          };
        }
      );

      response.json({
        id: project.id,
        name: project.name,
        client: project.client,
        location: project.location,
        projectCode:
          project.project_code ?? '',
        startDate:
          project.start_date ?? '',
        endDate:
          project.end_date ?? '',
        description:
          project.description ?? '',
        data: lpsData
      });

    } catch (error) {
      console.error(
        'Unexpected project data load error:',
        error
      );

      response.status(500).json({
        error: 'Unable to load project data'
      });
    }
  }
);


/*
 * ---------------------------------------------------------
 * SAVE PROJECT WORKSPACE
 * ---------------------------------------------------------
 */

app.put(
  '/api/project-data/:projectId',
  async (
    request: Request,
    response: Response
  ) => {
    try {
      const projectId = request.params.projectId;

      const project = request.body;

      if (!project || !project.data) {
        response.status(400).json({
          error: 'Invalid project payload'
        });

        return;
      }

      const data = project.data;


      /*
       * -------------------------------------------------
       * PROJECT
       * -------------------------------------------------
       */

      const {
        error: projectError
      } = await supabase
        .from('projects')
        .update({
          name: project.name ?? '',
          client: project.client ?? '',
          location: project.location ?? '',
          project_code:
            project.projectCode ?? '',
          start_date:
            project.startDate || null,
          end_date:
            project.endDate || null,
          description:
            project.description ?? '',

          /*
           * Keep config and any future frontend-only
           * fields in JSONB.
           */
          data: {
            ...(project.data ?? {}),
            config: project.data.config ?? {}
          }
        })
        .eq('id', projectId);

      if (projectError) {
        throw projectError;
      }


      /*
       * Helper:
       * Delete existing rows for this project and
       * insert the current frontend state.
       *
       * This keeps the implementation simple and guarantees
       * that removed frontend items disappear from Supabase.
       */

      const replaceTable = async (
        table: string,
        rows: any[]
      ) => {
        const {
          error: deleteError
        } = await supabase
          .from(table)
          .delete()
          .eq('project_id', projectId);

        if (deleteError) {
          throw deleteError;
        }

        if (!rows.length) {
          return;
        }

        const {
          error: insertError
        } = await supabase
          .from(table)
          .insert(
            rows.map((row) => ({
              ...row,
              project_id: projectId
            }))
          );

        if (insertError) {
          throw insertError;
        }
      };


      /*
       * -------------------------------------------------
       * PHASES
       * -------------------------------------------------
       */

      await replaceTable(
        'phases',
        (data.phases ?? []).map(
          (phase: any) => ({
            id: phase.id,
            phase_name:
              phase.phase_name,
            status:
              phase.status,
            milestone:
              phase.milestone,
            responsible:
              phase.responsible,
            planned_start:
              phase.planned_start || null,
            planned_finish:
              phase.planned_finish || null
          })
        )
      );


      /*
       * -------------------------------------------------
       * TRADES
       * -------------------------------------------------
       */

      await replaceTable(
        'trades',
        (data.trades ?? []).map(
          (trade: any) => ({
            id: trade.id,
            abbr:
              trade.abbr ??
              trade.code ??
              '',
            name:
              trade.name ?? ''
          })
        )
      );


      /*
       * -------------------------------------------------
       * AREAS
       * -------------------------------------------------
       */

      await replaceTable(
        'areas',
        (data.areas ?? []).map(
          (area: any) => ({
            id: typeof area === 'string'
              ? area
              : area.id,
            name: typeof area === 'string'
              ? area
              : area.name,
            zone: typeof area === 'string'
              ? null
              : area.zone ?? null
          })
        )
      );


      /*
       * -------------------------------------------------
       * TASKS
       * -------------------------------------------------
       */

      await replaceTable(
        'tasks',
        (data.tasks ?? []).map(
          (task: any) => ({
            id: task.id,
            uom: task.uom,
            trade: task.trade,
            status: task.status,
            location: task.location,
            phase_id:
              task.phase_id || null,
            description:
              task.description,
            responsible:
              task.responsible,
            duration_days:
              task.duration_days,
            must_finish_by:
              task.must_finish_by || null,
            pull_planned:
              task.pull_planned === true,
            lookahead_planned:
              task.lookahead_planned === true,
            total_quantity:
              task.total_quantity ?? null,
            daily_planned_quantity:
              task.daily_planned_quantity ?? null,
            eps: task.eps || null,
            epf: task.epf || null,
            lps: task.lps || null,
            lpf: task.lpf || null,
            float: task.float ?? null,
            precedence_type:
              task.precedence_type ?? null,
            predecessors:
              task.predecessors ?? []
          })
        )
      );


      /*
       * -------------------------------------------------
       * CONSTRAINTS
       * -------------------------------------------------
       */

      await replaceTable(
        'constraints',
        (data.constraints ?? []).map(
          (item: any) => ({
            id: item.id,
            task_id:
              item.task_id || null,
            type: item.type,
            status: item.status,
            raised_by:
              item.raised_by,
            description:
              item.description,
            raised_date:
              item.raised_date || null,
            responsible:
              item.responsible,
            target_date:
              item.target_date || null,
            resolved_date:
              item.resolved_date || null
          })
        )
      );


      /*
       * -------------------------------------------------
       * LOOKAHEAD
       * -------------------------------------------------
       */

      await replaceTable(
        'lookahead',
        (data.lookahead ?? []).map(
          (item: any) => ({
            id: item.id,
            task_id:
              item.task_id || null,
            week_key:
              item.week_key,
            planned_qty:
              item.planned_qty,
            ready:
              item.ready,
            notes:
              item.notes ?? null
          })
        )
      );


      /*
       * -------------------------------------------------
       * COMMITMENTS
       * -------------------------------------------------
       */

      await replaceTable(
        'commitments',
        (data.commitments ?? []).map(
          (item: any) => ({
            id: item.id,
            task_id:
              item.task_id || null,
            week_key:
              item.week_key,
            outcome:
              item.outcome ?? null,
            closed_at:
              item.closed_at || null,
            committed_by:
              item.committed_by,
            progress_percent:
              item.progress_percent ?? null,
            planned_qty:
              Number(item.planned_qty) || 0,
            actual_qty:
              Number(item.actual_qty) || 0,
            reason_code:
              item.reason_code ?? null,
            reason_notes:
              item.reason_notes ?? null
          })
        )
      );


      /*
       * -------------------------------------------------
       * ACTUALS
       * -------------------------------------------------
       */

      await replaceTable(
        'actuals',
        (data.actuals ?? []).map(
          (item: any) => ({
            id: item.id,
            commitment_id:
              item.commitment_id ||
              null,
            day_date:
              item.day_date || null,
            planned_qty:
              item.planned_qty,
            achieved_qty:
              item.achieved_qty,
            note:
              item.note ?? null
          })
        )
      );


      /*
       * -------------------------------------------------
       * METRICS
       * -------------------------------------------------
       */

      await replaceTable(
        'metrics',
        (data.metrics ?? []).map(
          (item: any) => ({
            week_key:
              item.week_key,
            ppc:
              item.ppc,
            ta:
              item.ta,
            crr:
              item.crr,
            tmr:
              item.tmr,
            total_done:
              item.total_done,
            total_committed:
              item.total_committed,
            status:
              item.status ?? null
          })
        )
      );


      /*
       * -------------------------------------------------
       * CLOSEOUTS
       * -------------------------------------------------
       */

      await replaceTable(
        'closeouts',
        (data.closeouts ?? []).map(
          (item: any) => ({
            week_key:
              item.week_key,
            ppc:
              item.ppc,
            notes:
              item.notes ?? null,
            closed_at:
              item.closed_at || null,
            closed_by:
              item.closed_by
          })
        )
      );


      /*
       * -------------------------------------------------
       * LEARN PROGRESS
       * -------------------------------------------------
       */

      await replaceTable(
        'learn_progress',
        (data.learnProgress ?? []).map(
          (item: any) => ({
            topic_id:
              item.topic_id,
            score:
              item.score,
            passed:
              item.passed,
            completed_at:
              item.completed_at || null
          })
        )
      );


      response.json({
        status: 'ok',
        projectId
      });

    } catch (error) {
      console.error(
        '========== PROJECT SAVE ERROR =========='
      );

      console.error(error);

      if (
        error &&
        typeof error === 'object'
      ) {
        console.error(
          JSON.stringify(
            error,
            null,
            2
          )
        );
      }

      console.error(
        '========================================'
      );

      response.status(500).json({
        error: 'Unable to save project data',
        details:
          error &&
          typeof error === 'object'
            ? error
            : String(error)
      });
    }
  }
);

/*
 * ---------------------------------------------------------
 * Error handler
 * ---------------------------------------------------------
 */

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction
  ) => {

    console.error(
      'Unhandled server error:',
      error
    );

    response.status(500).json({
      error: 'Internal server error'
    });
  }
);

/*
 * ---------------------------------------------------------
 * Frontend static files
 * ---------------------------------------------------------
 *
 * The production container serves the Vite build from the same
 * origin as the API. This keeps VITE_API_BASE_URL empty in the
 * production frontend and avoids cross-origin deployment issues.
 */

if (
  process.env.NODE_ENV === 'production' &&
  hasFrontendBuild
) {
  app.use(express.static(frontendDistPath));

  app.get(
    /^(?!\/api(?:\/|$)).*/,
    (_request: Request, response: Response) => {
      response.sendFile(
        frontendIndexPath
      );
    }
  );
}


/*
 * ---------------------------------------------------------
 * Start server
 * ---------------------------------------------------------
 */

app.listen(
  port,
  () => {

    console.log(
      `LPS Tool Backend listening on http://localhost:${port}`
    );

    console.log(
      `Supabase project: ${supabaseUrl}`
    );
  }
);
