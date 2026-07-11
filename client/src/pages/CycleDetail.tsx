import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Circle,
  GripVertical,
  Dumbbell,
  CopyPlus,
} from "lucide-react";

interface Exercise {
  id: number;
  workoutId: number;
  order: number;
  name: string;
  sets: string | null;
  reps: string | null;
  weight: string | null;
  restSec: number | null;
  notes: string | null;
  // только для клиента:
  actualSets?: string | null;
  actualReps?: string | null;
  actualWeight?: string | null;
  exerciseNote?: string | null;
  exerciseCompleted?: boolean;
}
interface Workout {
  id: number;
  weekId: number;
  workoutNumber: number;
  title: string | null;
  notes: string | null;
  exercises: Exercise[];
  // только для клиента:
  completed?: boolean;
  workoutNote?: string | null;
}
interface Week {
  id: number;
  cycleId: number;
  weekNumber: number;
  notes: string | null;
  workouts: Workout[];
}
interface CycleDetail {
  id: number;
  title: string;
  coachId: number;
  clientId: number;
  startDate: string | null;
  notes: string | null;
  createdAt: string;
  weeks: Week[];
}

export function CycleDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const { user } = useAuth();
  const isCoach = user?.role === "coach";

  const query = useQuery<CycleDetail>({
    queryKey: ["/api/cycles", id],
    enabled: !!id,
  });

  if (query.isLoading) {
    return (
      <Shell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  if (!query.data) {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Цикл не найден или нет доступа.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/">На главную</Link>
          </Button>
        </Card>
      </Shell>
    );
  }

  const cycle = query.data;

  return (
    <Shell>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Все циклы
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-xl font-bold">{cycle.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {cycle.startDate && (
            <span>
              Старт:{" "}
              {new Date(cycle.startDate).toLocaleDateString("ru-RU")}
            </span>
          )}
          <Badge variant="secondary">5 недель × 4 тренировки</Badge>
          {isCoach ? (
            <Badge variant="outline">Режим тренера</Badge>
          ) : (
            <Badge variant="outline">Режим клиента</Badge>
          )}
        </div>
        {cycle.notes && (
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            {cycle.notes}
          </p>
        )}
      </div>

      <Tabs defaultValue={String(cycle.weeks[0]?.id ?? "")} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          {cycle.weeks.map((w, i) => (
            <TabsTrigger
              key={w.id}
              value={String(w.id)}
              data-testid={`tab-week-${i + 1}`}
            >
              Неделя {i + 1}
            </TabsTrigger>
          ))}
        </TabsList>

        {cycle.weeks.map((w, i) => (
          <TabsContent key={w.id} value={String(w.id)} className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">
                Неделя {i + 1}
              </h2>
              {isCoach && (
                <CopyWeekButton cycleId={id} weekNumber={i + 1} />
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {w.workouts.map((wo) => (
                <WorkoutCard
                  key={wo.id}
                  workout={wo}
                  cycleId={id}
                  isCoach={isCoach}
                  workoutNumber={wo.workoutNumber}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Shell>
  );
}

/* ----------------------------- Кнопка копирования недели ----------------------------- */
function CopyWeekButton({
  cycleId,
  weekNumber,
}: {
  cycleId: number;
  weekNumber: number;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const copy = useMutation({
    mutationFn: () =>
      apiRequest(
        "POST",
        `/api/cycles/${cycleId}/copy-week`,
        { fromWeek: weekNumber }
      ),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({
        title: "Скопировано",
        description: `Добавлено упражнений: ${data.copied}`,
      });
      setConfirm(false);
      qc.invalidateQueries({ queryKey: ["/api/cycles", cycleId] });
    },
    onError: () =>
      toast({
        title: "Ошибка копирования",
        variant: "destructive",
      }),
  });

  const onClick = () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setBusy(true);
    copy.mutate();
  };

  return (
    <Button
      variant={confirm ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={busy}
      data-testid={`button-copy-week-${weekNumber}`}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CopyPlus className="mr-2 h-4 w-4" />
      )}
      {confirm
        ? "Копировать на остальные недели?"
        : "Скопировать на остальные недели"}
    </Button>
  );
}

/* ----------------------------- Карточка тренировки ----------------------------- */
function WorkoutCard({
  workout,
  cycleId,
  isCoach,
  workoutNumber,
}: {
  workout: Workout;
  cycleId: number;
  isCoach: boolean;
  workoutNumber: number;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState(workout.title ?? "");
  const [notes, setNotes] = useState(workout.notes ?? "");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setTitle(workout.title ?? "");
    setNotes(workout.notes ?? "");
  }, [workout.title, workout.notes]);

  const updateWorkout = useMutation({
    mutationFn: async (data: { title?: string | null; notes?: string | null }) =>
      apiRequest("PATCH", `/api/workouts/${workout.id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cycles", cycleId] }),
  });

  const titleDisplay =
    workout.title?.trim() || `Тренировка ${workoutNumber}`;

  return (
    <Card className="flex flex-col border-border bg-card p-0">
      {/* Заголовок */}
      <div className="flex items-start gap-2 border-b border-border p-4">
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold">
          {workoutNumber}
        </div>
        <div className="min-w-0 flex-1">
          {isCoach ? (
            <input
              className="w-full bg-transparent font-display text-base font-bold outline-none focus:border-b focus:border-primary"
              value={title}
              placeholder={`Тренировка ${workoutNumber}`}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() =>
                title !== (workout.title ?? "") &&
                updateWorkout.mutate({ title: title || null })
              }
              data-testid={`input-workout-title-${workout.id}`}
            />
          ) : (
            <h3 className="font-display text-base font-bold">{titleDisplay}</h3>
          )}
        </div>
        {!isCoach && (
          <ClientCompleteToggle workout={workout} cycleId={cycleId} />
        )}
      </div>

      {/* Заметка тренера к тренировке */}
      <div className="border-b border-border p-4">
        {isCoach ? (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Заметка к тренировке
            </Label>
            <Textarea
              className="min-h-[60px] resize-y text-sm"
              value={notes}
              placeholder="Фокус тренировки, разминка, RPE…"
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() =>
                notes !== (workout.notes ?? "") &&
                updateWorkout.mutate({ notes: notes || null })
              }
            />
          </div>
        ) : (
          workout.notes && (
            <p className="text-sm text-muted-foreground">{workout.notes}</p>
          )
        )}
      </div>

      {/* Упражнения */}
      <div className="flex-1 p-4">
        {workout.exercises.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Упражнений пока нет
          </p>
        ) : (
          <div className="space-y-2">
            {workout.exercises.map((ex) => (
              <ExerciseRow
                key={ex.id}
                exercise={ex}
                cycleId={cycleId}
                isCoach={isCoach}
              />
            ))}
          </div>
        )}
      </div>

      {/* Добавить упражнение (тренер) */}
      {isCoach && (
        <div className="border-t border-border p-3">
          {adding ? (
            <AddExerciseForm
              workoutId={workout.id}
              cycleId={cycleId}
              onDone={() => setAdding(false)}
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setAdding(true)}
              data-testid={`button-add-exercise-${workout.id}`}
            >
              <Plus className="mr-1 h-4 w-4" /> Добавить упражнение
            </Button>
          )}
        </div>
      )}

      {/* Заметка клиента (клиент) */}
      {!isCoach && (
        <ClientWorkoutNote workout={workout} cycleId={cycleId} />
      )}

      {updateWorkout.isError && (
        <p className="px-4 pb-3 text-xs text-destructive">Ошибка сохранения</p>
      )}
    </Card>
  );
}

/* ----------------------------- Строка упражнения ----------------------------- */
function ExerciseRow({
  exercise,
  cycleId,
  isCoach,
}: {
  exercise: Exercise;
  cycleId: number;
  isCoach: boolean;
}) {
  const qc = useQueryClient();

  if (isCoach) {
    return <CoachExerciseRow exercise={exercise} cycleId={cycleId} />;
  }
  return <ClientExerciseRow exercise={exercise} cycleId={cycleId} />;
}

function CoachExerciseRow({
  exercise,
  cycleId,
}: {
  exercise: Exercise;
  cycleId: number;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState({
    name: exercise.name,
    sets: exercise.sets ?? "",
    reps: exercise.reps ?? "",
    weight: exercise.weight ?? "",
    restSec: exercise.restSec ?? "",
    notes: exercise.notes ?? "",
  });

  useEffect(() => {
    setF({
      name: exercise.name,
      sets: exercise.sets ?? "",
      reps: exercise.reps ?? "",
      weight: exercise.weight ?? "",
      restSec: exercise.restSec ?? "",
      notes: exercise.notes ?? "",
    });
  }, [exercise]);

  const update = useMutation({
    mutationFn: async (data: Partial<typeof f>) => {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.sets !== undefined) payload.sets = data.sets || null;
      if (data.reps !== undefined) payload.reps = data.reps || null;
      if (data.weight !== undefined) payload.weight = data.weight || null;
      if (data.restSec !== undefined)
        payload.restSec = data.restSec ? parseInt(String(data.restSec), 10) : null;
      if (data.notes !== undefined) payload.notes = data.notes || null;
      return apiRequest("PATCH", `/api/exercises/${exercise.id}`, payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cycles", cycleId] }),
    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/exercises/${exercise.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cycles", cycleId] }),
  });

  const field = (
    key: keyof typeof f,
    label: string,
    placeholder?: string,
    full?: boolean
  ) => (
    <div className={full ? "col-span-2 sm:col-span-1" : ""}>
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Input
        className="h-8 text-sm"
        value={f[key]}
        placeholder={placeholder}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        onBlur={() => update.mutate({ [key]: f[key] })}
        data-testid={`input-ex-${key}-${exercise.id}`}
      />
    </div>
  );

  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        <Input
          className="h-8 flex-1 border-transparent bg-transparent px-1 font-medium"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          onBlur={() => update.mutate({ name: f.name })}
          data-testid={`input-ex-name-${exercise.id}`}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => del.mutate()}
          data-testid={`button-delete-exercise-${exercise.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {field("sets", "Подходы", "4")}
        {field("reps", "Повторения", "8-12")}
        {field("weight", "Вес", "100")}
        {field("restSec", "Отдых, сек", "120")}
      </div>
      <div className="mt-2">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Заметка
        </Label>
        <Input
          className="h-8 text-sm"
          value={f.notes}
          placeholder="Техника, темп…"
          onChange={(e) => setF({ ...f, notes: e.target.value })}
          onBlur={() => update.mutate({ notes: f.notes })}
        />
      </div>
    </div>
  );
}

function ClientExerciseRow({
  exercise,
  cycleId,
}: {
  exercise: Exercise;
  cycleId: number;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  // Фактические поля предзаполнены планом тренера, если клиент ещё не вводил своё
  const [actual, setActual] = useState({
    sets: exercise.actualSets ?? exercise.sets ?? "",
    reps: exercise.actualReps ?? exercise.reps ?? "",
    weight: exercise.actualWeight ?? exercise.weight ?? "",
    note: exercise.exerciseNote ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [done, setDone] = useState(!!exercise.exerciseCompleted);

  useEffect(() => {
    setActual({
      sets: exercise.actualSets ?? exercise.sets ?? "",
      reps: exercise.actualReps ?? exercise.reps ?? "",
      weight: exercise.actualWeight ?? exercise.weight ?? "",
      note: exercise.exerciseNote ?? "",
    });
    setDone(!!exercise.exerciseCompleted);
  }, [exercise]);

  const save = useMutation({
    mutationFn: (extra: { completed?: boolean } = {}) =>
      apiRequest("PUT", `/api/exercises/${exercise.id}/log`, {
        completed: extra.completed ?? done,
        actualSets: actual.sets || null,
        actualReps: actual.reps || null,
        actualWeight: actual.weight || null,
        note: actual.note || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cycles", cycleId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  const toggleDone = () => {
    const next = !done;
    setDone(next);
    save.mutate({ completed: next });
  };

  return (
    <div
      className={`rounded-md border bg-background/50 p-3 transition ${
        done ? "border-primary/40 bg-primary/5" : "border-border"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleDone}
          className="flex shrink-0 items-center"
          aria-label="Отметить выполнение"
          data-testid={`button-exercise-done-${exercise.id}`}
        >
          {done ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        <Dumbbell className="h-4 w-4 text-primary" />
        <span
          className={`font-medium ${done ? "line-through text-muted-foreground" : ""}`}
        >
          {exercise.name}
        </span>
      </div>
      {/* План тренера (для справки) */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {exercise.sets && <span>План подходов: {exercise.sets}</span>}
        {exercise.reps && <span>План повторений: {exercise.reps}</span>}
        {exercise.weight && <span>План вес: {exercise.weight}</span>}
        {exercise.restSec && <span>Отдых: {exercise.restSec} сек</span>}
      </div>
      {exercise.notes && (
        <p className="mb-3 text-xs italic text-muted-foreground">
          {exercise.notes}
        </p>
      )}
      {/* Фактический результат (предзаполнен планом тренера) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Факт. подходы
          </Label>
          <Input
            className="h-8 text-sm"
            value={actual.sets}
            placeholder={exercise.sets || "—"}
            onChange={(e) => setActual({ ...actual, sets: e.target.value })}
            onBlur={() => save.mutate()}
            data-testid={`input-ex-actual-sets-${exercise.id}`}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Факт. повторения
          </Label>
          <Input
            className="h-8 text-sm"
            value={actual.reps}
            placeholder={exercise.reps || "—"}
            onChange={(e) => setActual({ ...actual, reps: e.target.value })}
            onBlur={() => save.mutate()}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Факт. вес
          </Label>
          <Input
            className="h-8 text-sm"
            value={actual.weight}
            placeholder={exercise.weight || "—"}
            onChange={(e) => setActual({ ...actual, weight: e.target.value })}
            onBlur={() => save.mutate()}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Заметка
          </Label>
          <Input
            className="h-8 text-sm"
            value={actual.note}
            placeholder="—"
            onChange={(e) => setActual({ ...actual, note: e.target.value })}
            onBlur={() => save.mutate()}
          />
        </div>
      </div>
      <div className="mt-1 h-4">
        {saved && (
          <span className="text-[11px] text-primary">Сохранено</span>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Форма добавления упражнения ----------------------------- */
function AddExerciseForm({
  workoutId,
  cycleId,
  onDone,
}: {
  workoutId: number;
  cycleId: number;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "",
    sets: "",
    reps: "",
    weight: "",
    restSec: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/workouts/${workoutId}/exercises`, {
        name: f.name,
        sets: f.sets || null,
        reps: f.reps || null,
        weight: f.weight || null,
        restSec: f.restSec ? parseInt(f.restSec, 10) : null,
        notes: f.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cycles", cycleId] });
      onDone();
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setSubmitting(true);
    create.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border border-border bg-background/50 p-3">
      <Input
        className="h-8 text-sm"
        placeholder="Название упражнения"
        value={f.name}
        autoFocus
        onChange={(e) => setF({ ...f, name: e.target.value })}
        data-testid={`input-newex-name-${workoutId}`}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input className="h-8 text-sm" placeholder="Подходы" value={f.sets} onChange={(e) => setF({ ...f, sets: e.target.value })} />
        <Input className="h-8 text-sm" placeholder="Повторения" value={f.reps} onChange={(e) => setF({ ...f, reps: e.target.value })} />
        <Input className="h-8 text-sm" placeholder="Вес" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
        <Input className="h-8 text-sm" placeholder="Отдых, сек" value={f.restSec} onChange={(e) => setF({ ...f, restSec: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Отмена
        </Button>
        <Button type="submit" size="sm" disabled={submitting || !f.name.trim()} data-testid={`button-save-newex-${workoutId}`}>
          Добавить
        </Button>
      </div>
    </form>
  );
}

/* ----------------------------- Отметка выполнения (клиент) ----------------------------- */
function ClientCompleteToggle({
  workout,
  cycleId,
}: {
  workout: Workout;
  cycleId: number;
}) {
  const qc = useQueryClient();
  const [done, setDone] = useState(!!workout.completed);

  useEffect(() => {
    setDone(!!workout.completed);
  }, [workout.completed]);

  const toggle = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/workouts/${workout.id}/log`, {
        completed: !done,
        note: workout.workoutNote ?? null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cycles", cycleId] }),
  });

  return (
    <button
      type="button"
      className="flex items-center gap-1 text-xs"
      onClick={() => toggle.mutate()}
      data-testid={`button-complete-${workout.id}`}
    >
      {done ? (
        <CheckCircle2 className="h-5 w-5 text-primary" />
      ) : (
        <Circle className="h-5 w-5 text-muted-foreground" />
      )}
      <span className="hidden sm:inline">{done ? "Готово" : "Отметить"}</span>
    </button>
  );
}

/* ----------------------------- Заметка клиента к тренировке ----------------------------- */
function ClientWorkoutNote({
  workout,
  cycleId,
}: {
  workout: Workout;
  cycleId: number;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState(workout.workoutNote ?? "");

  useEffect(() => {
    setNote(workout.workoutNote ?? "");
  }, [workout.workoutNote]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/workouts/${workout.id}/log`, {
        completed: !!workout.completed,
        note: note || null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cycles", cycleId] }),
  });

  return (
    <div className="border-t border-border p-4">
      <Label className="text-xs text-muted-foreground">
        Ваш комментарий к тренировке
      </Label>
      <Textarea
        className="mt-1 min-h-[50px] resize-y text-sm"
        value={note}
        placeholder="Самочувствие, сложности…"
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => save.mutate()}
        data-testid={`textarea-client-note-${workout.id}`}
      />
    </div>
  );
}
