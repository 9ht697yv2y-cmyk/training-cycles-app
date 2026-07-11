import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import session from "express-session";
import memorystore from "memorystore";
import { storage, hashPassword, verifyPassword, toPublicUser } from "./storage";
import {
  registerSchema,
  loginSchema,
  createClientSchema,
  createCycleSchema,
  exerciseInputSchema,
  exerciseLogInputSchema,
  type PublicUser,
} from "@shared/schema";

const MemoryStore = memorystore(session);

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

interface AuthedRequest extends Request {
  user?: PublicUser;
}

const WEEKS_PER_CYCLE = 5;
const WORKOUTS_PER_WEEK = 4;

/* ----------------------------- middleware ----------------------------- */
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Пользователь не найден" });
  }
  (req as AuthedRequest).user = toPublicUser(user);
  next();
}

async function requireCoach(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Пользователь не найден" });
  }
  if (user.role !== "coach") {
    return res.status(403).json({ message: "Доступ только для тренера" });
  }
  (req as AuthedRequest).user = toPublicUser(user);
  next();
}

async function getCurrentUser(req: Request) {
  if (!req.session.userId) return undefined;
  const user = await storage.getUser(req.session.userId);
  return user ? toPublicUser(user) : undefined;
}

/* ------------------------------- routes ------------------------------- */
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const isProd = process.env.NODE_ENV === "production";
  const sessionMiddleware = session({
    name: isProd ? "__Host-sid" : "tc.sid",
    secret: process.env.SESSION_SECRET || "training-cycles-dev-secret-change-me",
    store: new MemoryStore({ checkPeriod: 86400000 }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  });
  app.use(sessionMiddleware);

  /* --------------------------- Авторизация --------------------------- */

  app.get("/api/auth/me", async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Не авторизован" });
    res.json(user);
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const parsed = registerSchema.parse(req.body);
      const existing = await storage.getUserByEmail(parsed.email);
      if (existing) {
        return res.status(409).json({ message: "Email уже занят" });
      }
      const coachExists = (await storage.countCoaches()) > 0;
      if (coachExists) {
        if (!req.session.userId) {
          return res
            .status(403)
            .json({ message: "Регистрация доступна только тренеру" });
        }
        const currentUser = await storage.getUser(req.session.userId);
        if (!currentUser || currentUser.role !== "coach") {
          return res
            .status(403)
            .json({ message: "Регистрация доступна только тренеру" });
        }
      }
      const role = coachExists ? "client" : "coach";
      const user = await storage.createUser({
        email: parsed.email,
        name: parsed.name,
        passwordHash: hashPassword(parsed.password),
        role,
      });
      req.session.userId = user.id;
      res.json(toPublicUser(user));
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(parsed.email);
      if (!user || !verifyPassword(parsed.password, user.passwordHash)) {
        return res.status(401).json({ message: "Неверный email или пароль" });
      }
      req.session.userId = user.id;
      res.json(toPublicUser(user));
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  /* --------------------------- Клиенты --------------------------- */

  app.get("/api/clients", requireCoach, async (_req, res) => {
    const clients = await storage.getUsersByRole("client");
    res.json(clients.map(toPublicUser));
  });

  app.post("/api/clients", requireCoach, async (req, res, next) => {
    try {
      const parsed = createClientSchema.parse(req.body);
      const existing = await storage.getUserByEmail(parsed.email);
      if (existing) {
        return res.status(409).json({ message: "Email уже занят" });
      }
      const user = await storage.createUser({
        email: parsed.email,
        name: parsed.name,
        passwordHash: hashPassword(parsed.password),
        role: "client",
      });
      res.json(toPublicUser(user));
    } catch (e) {
      next(e);
    }
  });

  /* --------------------------- Циклы --------------------------- */

  app.get("/api/cycles", requireAuth, async (req, res) => {
    const user = (req as AuthedRequest).user!;
    if (user.role === "coach") {
      res.json(await storage.getCyclesForCoach(user.id));
    } else {
      res.json(await storage.getCyclesForClient(user.id));
    }
  });

  app.post("/api/cycles", requireCoach, async (req, res, next) => {
    try {
      const parsed = createCycleSchema.parse(req.body);
      const coachId = (req as AuthedRequest).user!.id;
      const cycle = await storage.createCycle({
        title: parsed.title,
        coachId,
        clientId: parsed.clientId,
        startDate: parsed.startDate ?? null,
        notes: parsed.notes ?? null,
      });
      for (let w = 1; w <= WEEKS_PER_CYCLE; w++) {
        const week = await storage.createWeek({
          cycleId: cycle.id,
          weekNumber: w,
        });
        for (let t = 1; t <= WORKOUTS_PER_WEEK; t++) {
          await storage.createWorkout({ weekId: week.id, workoutNumber: t });
        }
      }
      res.json(cycle);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/cycles/:id", requireCoach, async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const cycle = await storage.getCycle(id);
      if (!cycle) return res.status(404).json({ message: "Цикл не найден" });
      const updated = await storage.updateCycle(id, {
        title: req.body.title,
        startDate: req.body.startDate ?? null,
        notes: req.body.notes ?? null,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/cycles/:id", requireCoach, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await storage.deleteCycle(id);
    res.json({ ok: true });
  });

  app.get("/api/cycles/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const cycle = await storage.getCycle(id);
    if (!cycle) return res.status(404).json({ message: "Цикл не найден" });
    const user = (req as AuthedRequest).user!;
    if (user.role === "coach" && cycle.coachId !== user.id) {
      return res.status(403).json({ message: "Нет доступа" });
    }
    if (user.role === "client" && cycle.clientId !== user.id) {
      return res.status(403).json({ message: "Нет доступа" });
    }

    const isClient = user.role === "client";
    const weeks = await storage.getWeeksForCycle(cycle.id);
    const weeksOut = [];
    for (const w of weeks) {
      const ws = await storage.getWorkoutsForWeek(w.id);
      const workoutsOut = [];
      for (const wo of ws) {
        const exs = await storage.getExercisesForWorkout(wo.id);
        let exercisesOut: any[];
        if (isClient) {
          exercisesOut = [];
          for (const ex of exs) {
            const elog = await storage.getExerciseLog(ex.id, user.id);
            exercisesOut.push({
              ...ex,
              actualSets: elog?.actualSets ?? null,
              actualReps: elog?.actualReps ?? null,
              actualWeight: elog?.actualWeight ?? null,
              exerciseNote: elog?.note ?? null,
              exerciseCompleted: elog?.completed ?? false,
            });
          }
        } else {
          exercisesOut = exs;
        }
        let workoutExtra: Record<string, unknown> = {};
        if (isClient) {
          const wlog = await storage.getWorkoutLog(wo.id, user.id);
          workoutExtra = {
            completed: wlog?.completed ?? false,
            workoutNote: wlog?.note ?? null,
          };
        }
        workoutsOut.push({ ...wo, ...workoutExtra, exercises: exercisesOut });
      }
      weeksOut.push({ ...w, workouts: workoutsOut });
    }

    res.json({ ...cycle, weeks: weeksOut });
  });

  /* --------------------------- Тренировки --------------------------- */

  app.patch("/api/workouts/:id", requireCoach, async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const wo = await storage.getWorkout(id);
      if (!wo) return res.status(404).json({ message: "Тренировка не найдена" });
      const updated = await storage.updateWorkout(id, {
        title: req.body.title ?? null,
        notes: req.body.notes ?? null,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  /* --------------------------- Упражнения --------------------------- */

  app.post("/api/workouts/:id/exercises", requireCoach, async (req, res, next) => {
    try {
      const workoutId = parseInt(String(req.params.id), 10);
      const wo = await storage.getWorkout(workoutId);
      if (!wo) return res.status(404).json({ message: "Тренировка не найдена" });
      const parsed = exerciseInputSchema.parse(req.body);
      const existing = await storage.getExercisesForWorkout(workoutId);
      const order = existing.length + 1;
      const ex = await storage.createExercise({
        workoutId,
        order,
        name: parsed.name,
        sets: parsed.sets ?? null,
        reps: parsed.reps ?? null,
        weight: parsed.weight ?? null,
        restSec: parsed.restSec ?? null,
        notes: parsed.notes ?? null,
      });
      res.json(ex);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/exercises/:id", requireCoach, async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const ex = await storage.getExercise(id);
      if (!ex) return res.status(404).json({ message: "Упражнение не найдено" });
      const parsed = exerciseInputSchema.partial().parse(req.body);
      const updated = await storage.updateExercise(id, {
        name: parsed.name,
        sets: parsed.sets ?? null,
        reps: parsed.reps ?? null,
        weight: parsed.weight ?? null,
        restSec: parsed.restSec ?? null,
        notes: parsed.notes ?? null,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/exercises/:id", requireCoach, async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await storage.deleteExercise(id);
    res.json({ ok: true });
  });

  /* ---- Копирование упражнений (тренер) ---- */
// POST /api/cycles/:id/copy-week — копирует упражнения из недели fromWeek
// во все следующие недели цикла (по соответствующим тренировкам по номеру)
// и для каждой следующей недели увеличивает reps на +1, +2, +3 и т.д.
app.post("/api/cycles/:id/copy-week", requireCoach, async (req, res, next) => {
  try {
    const cycleId = parseInt(String(req.params.id), 10);
    const fromWeek = parseInt(String(req.body.fromWeek), 10);
    const user = (req as AuthedRequest).user!;

    const cycle = await storage.getCycle(cycleId);
    if (!cycle) {
      return res.status(404).json({ message: "Цикл не найден" });
    }

    if (cycle.coachId !== user.id) {
      return res.status(403).json({ message: "Нет доступа" });
    }

    const weeks = await storage.getWeeksForCycle(cycleId);
    const source = weeks.find((w) => w.weekNumber === fromWeek);

    if (!source) {
      return res.status(404).json({ message: "Неделя-источник не найдена" });
    }

    const sourceWorkouts = await storage.getWorkoutsForWeek(source.id);

    const targetWeeks = weeks
      .filter((w) => w.weekNumber > fromWeek)
      .sort((a, b) => a.weekNumber - b.weekNumber);

    let copied = 0;

    for (const tw of targetWeeks) {
      const twWorkouts = await storage.getWorkoutsForWeek(tw.id);
      const repsIncrement = tw.weekNumber - fromWeek;

      for (const sw of sourceWorkouts) {
        const twMatch = twWorkouts.find(
          (x) => x.workoutNumber === sw.workoutNumber
        );

        if (twMatch) {
          const added = await storage.copyExercises(
            sw.id,
            twMatch.id,
            repsIncrement
          );
          copied += added.length;
        }
      }
    }

    res.json({ ok: true, copied });
  } catch (e) {
    next(e);
  }
});

  /* --------------------------- Логи клиента --------------------------- */

  app.get("/api/workouts/:id/log", requireAuth, async (req, res) => {
    const workoutId = parseInt(String(req.params.id), 10);
    const user = (req as AuthedRequest).user!;
    if (user.role !== "client") {
      return res.status(403).json({ message: "Только для клиента" });
    }
    const wo = await storage.getWorkout(workoutId);
    if (!wo) return res.status(404).json({ message: "Тренировка не найдена" });
    const workoutLog = await storage.getWorkoutLog(workoutId, user.id);
    const exercises = await storage.getExercisesForWorkout(workoutId);
    const exerciseLogs = [];
    for (const ex of exercises) {
      const log = await storage.getExerciseLog(ex.id, user.id);
      exerciseLogs.push({
        exerciseId: ex.id,
        actualSets: log?.actualSets ?? null,
        actualReps: log?.actualReps ?? null,
        actualWeight: log?.actualWeight ?? null,
        note: log?.note ?? null,
      });
    }
    res.json({ workoutLog: workoutLog ?? null, exerciseLogs });
  });

  app.put("/api/workouts/:id/log", requireAuth, async (req, res) => {
    const workoutId = parseInt(String(req.params.id), 10);
    const user = (req as AuthedRequest).user!;
    if (user.role !== "client") {
      return res.status(403).json({ message: "Только для клиента" });
    }
    const completed = !!req.body.completed;
    const note = req.body.note ?? null;
    const workoutLog = await storage.upsertWorkoutLog(workoutId, user.id, {
      completed,
      note,
    });
    res.json(workoutLog);
  });

  app.put("/api/exercises/:id/log", requireAuth, async (req, res, next) => {
    try {
      const exerciseId = parseInt(String(req.params.id), 10);
      const user = (req as AuthedRequest).user!;
      if (user.role !== "client") {
        return res.status(403).json({ message: "Только для клиента" });
      }
      const parsed = exerciseLogInputSchema.parse(req.body);
      // сохраняем текущие значения лога, чтобы не затереть поля при частичном апдейте
      const existing = await storage.getExerciseLog(exerciseId, user.id);
      const log = await storage.upsertExerciseLog(exerciseId, user.id, {
        completed: parsed.completed ?? existing?.completed ?? false,
        actualSets: parsed.actualSets ?? existing?.actualSets ?? null,
        actualReps: parsed.actualReps ?? existing?.actualReps ?? null,
        actualWeight: parsed.actualWeight ?? existing?.actualWeight ?? null,
        note: parsed.note ?? existing?.note ?? null,
      });
      res.json(log);
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/me/progress", requireAuth, async (req, res) => {
    const user = (req as AuthedRequest).user!;
    const logs = await storage.getWorkoutLogsForUser(user.id);
    const completed = logs.filter((l) => l.completed).length;
    res.json({ totalLogged: logs.length, completed });
  });

  return httpServer;
}
