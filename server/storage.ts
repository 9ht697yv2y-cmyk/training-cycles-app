import { supabase } from "./supabase";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  User,
  Cycle,
  Week,
  Workout,
  Exercise,
  WorkoutLog,
  ExerciseLog,
} from "@shared/schema";

/* --------------------------- Хэширование паролей --------------------------- */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  if (hashBuf.length !== testBuf.length) return false;
  return timingSafeEqual(hashBuf, testBuf);
}

export function toPublicUser(u: User) {
  const { passwordHash, ...rest } = u;
  return rest;
}

/* ------------------------------- Хранилище ---------------------------------
 *  Асинхронный слой над Supabase (PostgREST). Все методы возвращают Promise.
 *  Колонки в snake_case; маппим в camelCase на уровне приложения.
 * ------------------------------------------------------------------------- */

const T = {
  users: "users",
  cycles: "cycles",
  weeks: "weeks",
  workouts: "workouts",
  exercises: "exercises",
  workoutLogs: "workout_logs",
  exerciseLogs: "exercise_logs",
};

// Маппинг camelCase <-> snake_case для users
const userSelect =
  "id, email, password_hash, name, role, created_at";

function mapUser(r: any): User {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    name: r.name,
    role: r.role,
    createdAt: r.created_at,
  };
}

function mapCycle(r: any): Cycle {
  return {
    id: r.id,
    title: r.title,
    coachId: r.coach_id,
    clientId: r.client_id,
    startDate: r.start_date,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

function mapWeek(r: any): Week {
  return {
    id: r.id,
    cycleId: r.cycle_id,
    weekNumber: r.week_number,
    notes: r.notes,
  };
}

function mapWorkout(r: any): Workout {
  return {
    id: r.id,
    weekId: r.week_id,
    workoutNumber: r.workout_number,
    title: r.title,
    notes: r.notes,
  };
}

function mapExercise(r: any): Exercise {
  return {
    id: r.id,
    workoutId: r.workout_id,
    order: r.order,
    name: r.name,
    sets: r.sets,
    reps: r.reps,
    weight: r.weight,
    restSec: r.rest_sec,
    notes: r.notes,
  };
}

export class DatabaseStorage {
  /* ---- Пользователи ---- */
  async getUser(id: number): Promise<User | undefined> {
    const { data } = await supabase
      .from(T.users)
      .select(userSelect)
      .eq("id", id)
      .maybeSingle();
    return data ? mapUser(data) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { data } = await supabase
      .from(T.users)
      .select(userSelect)
      .eq("email", email)
      .maybeSingle();
    return data ? mapUser(data) : undefined;
  }

  async getUsersByRole(role: "coach" | "client"): Promise<User[]> {
    const { data } = await supabase
      .from(T.users)
      .select(userSelect)
      .eq("role", role)
      .order("id");
    return (data ?? []).map(mapUser);
  }

  async countCoaches(): Promise<number> {
    const { count } = await supabase
      .from(T.users)
      .select("id", { count: "exact", head: true })
      .eq("role", "coach");
    return count ?? 0;
  }

  async createUser(data: {
    email: string;
    name: string;
    passwordHash: string;
    role: "coach" | "client";
  }): Promise<User> {
    const { data: row } = await supabase
      .from(T.users)
      .insert({
        email: data.email,
        name: data.name,
        password_hash: data.passwordHash,
        role: data.role,
      })
      .select(userSelect)
      .single();
    return mapUser(row);
  }

  /* ---- Циклы ---- */
  async createCycle(data: {
    title: string;
    coachId: number;
    clientId: number;
    startDate?: string | null;
    notes?: string | null;
  }): Promise<Cycle> {
    const { data: row } = await supabase
      .from(T.cycles)
      .insert({
        title: data.title,
        coach_id: data.coachId,
        client_id: data.clientId,
        start_date: data.startDate ?? null,
        notes: data.notes ?? null,
      })
      .select("*")
      .single();
    return mapCycle(row);
  }

  async getCycle(id: number): Promise<Cycle | undefined> {
    const { data } = await supabase
      .from(T.cycles)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? mapCycle(data) : undefined;
  }

  async getCyclesForCoach(
    coachId: number
  ): Promise<(Cycle & { clientName: string })[]> {
    const { data } = await supabase
      .from(T.cycles)
      .select("*, client:users!cycles_client_id_fkey(name)")
      .eq("coach_id", coachId)
      .order("id", { ascending: false });
    return (data ?? []).map((r: any) => ({
      ...mapCycle(r),
      clientName: r.client?.name ?? "",
    }));
  }

  async getCyclesForClient(
    clientId: number
  ): Promise<(Cycle & { coachName: string })[]> {
    const { data } = await supabase
      .from(T.cycles)
      .select("*, coach:users!cycles_coach_id_fkey(name)")
      .eq("client_id", clientId)
      .order("id", { ascending: false });
    return (data ?? []).map((r: any) => ({
      ...mapCycle(r),
      coachName: r.coach?.name ?? "",
    }));
  }

  async updateCycle(
    id: number,
    data: { title?: string; startDate?: string | null; notes?: string | null }
  ): Promise<Cycle | undefined> {
    const update: Record<string, unknown> = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.startDate !== undefined) update.start_date = data.startDate;
    if (data.notes !== undefined) update.notes = data.notes;
    if (Object.keys(update).length === 0) return this.getCycle(id);
    const { data: row } = await supabase
      .from(T.cycles)
      .update(update)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    return row ? mapCycle(row) : undefined;
  }

  async deleteCycle(id: number): Promise<void> {
    await supabase.from(T.cycles).delete().eq("id", id);
  }

  /* ---- Недели ---- */
  async createWeek(data: {
    cycleId: number;
    weekNumber: number;
  }): Promise<Week> {
    const { data: row } = await supabase
      .from(T.weeks)
      .insert({ cycle_id: data.cycleId, week_number: data.weekNumber })
      .select("*")
      .single();
    return mapWeek(row);
  }

  async getWeeksForCycle(cycleId: number): Promise<Week[]> {
    const { data } = await supabase
      .from(T.weeks)
      .select("*")
      .eq("cycle_id", cycleId)
      .order("week_number");
    return (data ?? []).map(mapWeek);
  }

  async getWeek(id: number): Promise<Week | undefined> {
    const { data } = await supabase
      .from(T.weeks)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? mapWeek(data) : undefined;
  }

  async updateWeekNotes(id: number, notes: string | null): Promise<void> {
    await supabase.from(T.weeks).update({ notes }).eq("id", id);
  }

  /* ---- Тренировки ---- */
  async createWorkout(data: {
    weekId: number;
    workoutNumber: number;
    title?: string | null;
  }): Promise<Workout> {
    const { data: row } = await supabase
      .from(T.workouts)
      .insert({
        week_id: data.weekId,
        workout_number: data.workoutNumber,
        title: data.title ?? null,
      })
      .select("*")
      .single();
    return mapWorkout(row);
  }

  async getWorkoutsForWeek(weekId: number): Promise<Workout[]> {
    const { data } = await supabase
      .from(T.workouts)
      .select("*")
      .eq("week_id", weekId)
      .order("workout_number");
    return (data ?? []).map(mapWorkout);
  }

  async getWorkout(id: number): Promise<Workout | undefined> {
    const { data } = await supabase
      .from(T.workouts)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? mapWorkout(data) : undefined;
  }

  async updateWorkout(
    id: number,
    data: { title?: string | null; notes?: string | null }
  ): Promise<Workout | undefined> {
    const update: Record<string, unknown> = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.notes !== undefined) update.notes = data.notes;
    if (Object.keys(update).length === 0) return this.getWorkout(id);
    const { data: row } = await supabase
      .from(T.workouts)
      .update(update)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    return row ? mapWorkout(row) : undefined;
  }

  /* ---- Упражнения ---- */
  async createExercise(data: {
    workoutId: number;
    order: number;
    name: string;
    sets?: string | null;
    reps?: string | null;
    weight?: string | null;
    restSec?: number | null;
    notes?: string | null;
  }): Promise<Exercise> {
    const { data: row } = await supabase
      .from(T.exercises)
      .insert({
        workout_id: data.workoutId,
        order: data.order,
        name: data.name,
        sets: data.sets ?? null,
        reps: data.reps ?? null,
        weight: data.weight ?? null,
        rest_sec: data.restSec ?? null,
        notes: data.notes ?? null,
      })
      .select("*")
      .single();
    return mapExercise(row);
  }

  async getExercisesForWorkout(workoutId: number): Promise<Exercise[]> {
    const { data } = await supabase
      .from(T.exercises)
      .select("*")
      .eq("workout_id", workoutId)
      .order("order");
    return (data ?? []).map(mapExercise);
  }

  async getExercise(id: number): Promise<Exercise | undefined> {
    const { data } = await supabase
      .from(T.exercises)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? mapExercise(data) : undefined;
  }

  async updateExercise(
    id: number,
    data: {
      name?: string;
      sets?: string | null;
      reps?: string | null;
      weight?: string | null;
      restSec?: number | null;
      notes?: string | null;
    }
  ): Promise<Exercise | undefined> {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.sets !== undefined) update.sets = data.sets;
    if (data.reps !== undefined) update.reps = data.reps;
    if (data.weight !== undefined) update.weight = data.weight;
    if (data.restSec !== undefined) update.rest_sec = data.restSec;
    if (data.notes !== undefined) update.notes = data.notes;
    if (Object.keys(update).length === 0) return this.getExercise(id);
    const { data: row } = await supabase
      .from(T.exercises)
      .update(update)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    return row ? mapExercise(row) : undefined;
  }

  async deleteExercise(id: number): Promise<void> {
    await supabase.from(T.exercises).delete().eq("id", id);
  }

  /* ---- Логи тренировок (клиент) ---- */
  async getWorkoutLog(
    workoutId: number,
    userId: number
  ): Promise<WorkoutLog | undefined> {
    const { data } = await supabase
      .from(T.workoutLogs)
      .select("*")
      .eq("workout_id", workoutId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return undefined;
    return {
      id: data.id,
      workoutId: data.workout_id,
      userId: data.user_id,
      completed: data.completed,
      note: data.note,
      updatedAt: data.updated_at,
    };
  }

  async upsertWorkoutLog(
    workoutId: number,
    userId: number,
    data: { completed: boolean; note?: string | null }
  ): Promise<WorkoutLog> {
    const payload = {
      workout_id: workoutId,
      user_id: userId,
      completed: data.completed,
      note: data.note ?? null,
      updated_at: new Date().toISOString(),
    };
    // upsert по уникальному индексу (workout_id, user_id)
    const { data: row } = await supabase
      .from(T.workoutLogs)
      .upsert(payload, { onConflict: "workout_id,user_id" })
      .select("*")
      .single();
    return {
      id: row.id,
      workoutId: row.workout_id,
      userId: row.user_id,
      completed: row.completed,
      note: row.note,
      updatedAt: row.updated_at,
    };
  }

  async getWorkoutLogsForUser(userId: number): Promise<WorkoutLog[]> {
    const { data } = await supabase
      .from(T.workoutLogs)
      .select("*")
      .eq("user_id", userId);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      workoutId: r.workout_id,
      userId: r.user_id,
      completed: r.completed,
      note: r.note,
      updatedAt: r.updated_at,
    }));
  }

  /* ---- Логи упражнений (клиент) ---- */
  async getExerciseLog(
    exerciseId: number,
    userId: number
  ): Promise<ExerciseLog | undefined> {
    const { data } = await supabase
      .from(T.exerciseLogs)
      .select("*")
      .eq("exercise_id", exerciseId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return undefined;
    return {
      id: data.id,
      exerciseId: data.exercise_id,
      userId: data.user_id,
      completed: data.completed,
      actualSets: data.actual_sets,
      actualReps: data.actual_reps,
      actualWeight: data.actual_weight,
      note: data.note,
      updatedAt: data.updated_at,
    };
  }

  async upsertExerciseLog(
    exerciseId: number,
    userId: number,
    data: {
      completed?: boolean;
      actualSets?: string | null;
      actualReps?: string | null;
      actualWeight?: string | null;
      note?: string | null;
    }
  ): Promise<ExerciseLog> {
    const payload = {
      exercise_id: exerciseId,
      user_id: userId,
      completed: data.completed ?? false,
      actual_sets: data.actualSets ?? null,
      actual_reps: data.actualReps ?? null,
      actual_weight: data.actualWeight ?? null,
      note: data.note ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data: row } = await supabase
      .from(T.exerciseLogs)
      .upsert(payload, { onConflict: "exercise_id,user_id" })
      .select("*")
      .single();
    return {
      id: row.id,
      exerciseId: row.exercise_id,
      userId: row.user_id,
      completed: row.completed,
      actualSets: row.actual_sets,
      actualReps: row.actual_reps,
      actualWeight: row.actual_weight,
      note: row.note,
      updatedAt: row.updated_at,
    };
  }

  /* ---- Копирование упражнений из одной тренировки в другую ---- */
  async copyExercises(
    fromWorkoutId: number,
    toWorkoutId: number
  ): Promise<Exercise[]> {
    const source = await this.getExercisesForWorkout(fromWorkoutId);
    if (source.length === 0) return [];
    const target = await this.getExercisesForWorkout(toWorkoutId);
    const baseOrder = target.length;
    const rows = source.map((ex, i) => ({
      workout_id: toWorkoutId,
      order: baseOrder + i + 1,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      rest_sec: ex.restSec,
      notes: ex.notes,
    }));
    const { data } = await supabase
      .from(T.exercises)
      .insert(rows)
      .select("*")
      .order("order");
    return (data ?? []).map(mapExercise);
  }
}

export const storage = new DatabaseStorage();
