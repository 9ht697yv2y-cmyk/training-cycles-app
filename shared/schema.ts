import { z } from "zod";

/* Типы данных приложения (в Supabase хранятся в snake_case, маппинг в storage.ts) */

export type User = {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  role: "coach" | "client";
  createdAt: string;
};

export type PublicUser = Omit<User, "passwordHash">;

export type Cycle = {
  id: number;
  title: string;
  coachId: number;
  clientId: number;
  startDate: string | null;
  notes: string | null;
  createdAt: string;
};

export type Week = {
  id: number;
  cycleId: number;
  weekNumber: number;
  notes: string | null;
};

export type Workout = {
  id: number;
  weekId: number;
  workoutNumber: number;
  title: string | null;
  notes: string | null;
};

export type Exercise = {
  id: number;
  workoutId: number;
  order: number;
  name: string;
  sets: string | null;
  reps: string | null;
  weight: string | null;
  restSec: number | null;
  notes: string | null;
  // только для клиента (в клиентском ответе):
  actualSets?: string | null;
  actualReps?: string | null;
  actualWeight?: string | null;
  exerciseNote?: string | null;
  exerciseCompleted?: boolean;
};

export type WorkoutLog = {
  id: number;
  workoutId: number;
  userId: number;
  completed: boolean;
  note: string | null;
  updatedAt: string;
};

export type ExerciseLog = {
  id: number;
  exerciseId: number;
  userId: number;
  completed: boolean;
  actualSets: string | null;
  actualReps: string | null;
  actualWeight: string | null;
  note: string | null;
  updatedAt: string;
};

/* ------------------------------- Zod-схемы валидации ------------------------------- */

export const registerSchema = z.object({
  email: z.string().email("Некорректный email"),
  name: z.string().min(1, "Введите имя"),
  password: z.string().min(6, "Пароль минимум 6 символов"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createClientSchema = z.object({
  email: z.string().email("Некорректный email"),
  name: z.string().min(1, "Введите имя клиента"),
  password: z.string().min(6, "Пароль минимум 6 символов"),
});

export const createCycleSchema = z.object({
  title: z.string().min(1, "Введите название цикла"),
  clientId: z.number().int().positive(),
  startDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const exerciseInputSchema = z.object({
  name: z.string().min(1, "Введите название упражнения"),
  sets: z.string().nullable().optional(),
  reps: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  restSec: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const exerciseLogInputSchema = z.object({
  completed: z.boolean().nullable().optional(),
  actualSets: z.string().nullable().optional(),
  actualReps: z.string().nullable().optional(),
  actualWeight: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});
