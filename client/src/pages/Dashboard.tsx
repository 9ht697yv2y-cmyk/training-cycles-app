import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Users,
  CalendarDays,
  ChevronRight,
  UserPlus,
  Loader2,
  Dumbbell,
} from "lucide-react";

interface CycleListItem {
  id: number;
  title: string;
  coachId: number;
  clientId: number;
  startDate: string | null;
  notes: string | null;
  createdAt: string;
  clientName?: string;
  coachName?: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const isCoach = user?.role === "coach";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);

  const cyclesQuery = useQuery<CycleListItem[]>({ queryKey: ["/api/cycles"] });
  const clientsQuery = useQuery({
    queryKey: ["/api/clients"],
    enabled: isCoach,
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Ошибка");
      return res.json();
    },
  });

  const cycles = cyclesQuery.data ?? [];

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">
            {isCoach ? "Тренировочные циклы" : "Мои тренировки"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isCoach
              ? "Управляйте циклами клиентов: 5 недель × 4 тренировки"
              : "Ваши циклы и прогресс"}
          </p>
        </div>
        {isCoach && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setClientsOpen(true)}
              data-testid="button-clients"
            >
              <Users className="mr-2 h-4 w-4" /> Клиенты
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              data-testid="button-new-cycle"
            >
              <Plus className="mr-2 h-4 w-4" /> Новый цикл
            </Button>
          </div>
        )}
      </div>

      {cyclesQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : cycles.length === 0 ? (
        <EmptyState isCoach={isCoach} onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cycles.map((c) => (
            <Link key={c.id} href={`/cycle/${c.id}`}>
              <Card
                className="group h-full cursor-pointer border-border bg-card p-5 transition hover:border-primary/50 hover-elevate"
                data-testid={`card-cycle-${c.id}`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-bold leading-tight">
                    {c.title}
                  </h3>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {isCoach ? (
                    <Badge variant="secondary" className="font-normal">
                      {c.clientName}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal">
                      Тренер: {c.coachName}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {c.startDate
                      ? new Date(c.startDate).toLocaleDateString("ru-RU")
                      : "Дата не задана"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Dumbbell className="h-3.5 w-3.5" />5 нед. × 4 тр.
                  </span>
                </div>
                {c.notes && (
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                    {c.notes}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateCycleDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          clients={clientsQuery.data ?? []}
          onCreated={() => {
            setCreateOpen(false);
            qc.invalidateQueries({ queryKey: ["/api/cycles"] });
          }}
        />
      )}

      {clientsOpen && (
        <ClientsDialog
          open={clientsOpen}
          onOpenChange={setClientsOpen}
          clients={clientsQuery.data ?? []}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["/api/clients"] });
          }}
          onError={(msg) =>
            toast({ title: "Ошибка", description: msg, variant: "destructive" })
          }
        />
      )}
    </Shell>
  );
}

function EmptyState({
  isCoach,
  onCreate,
}: {
  isCoach: boolean;
  onCreate: () => void;
}) {
  return (
    <Card className="flex flex-col items-center justify-center border-dashed border-border bg-card p-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Dumbbell className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-display text-lg font-bold">Пока нет циклов</h3>
      <p className="mb-5 mt-1 max-w-sm text-sm text-muted-foreground">
        {isCoach
          ? "Создайте первый тренировочный цикл. Автоматически появится структура: 5 недель по 4 тренировки."
          : "Тренер ещё не назначил вам цикл. Загляните позже."}
      </p>
      {isCoach && (
        <Button onClick={onCreate} data-testid="button-empty-create">
          <Plus className="mr-2 h-4 w-4" /> Создать цикл
        </Button>
      )}
    </Card>
  );
}

/* ------------------------- Диалог создания цикла ------------------------- */
function CreateCycleDialog({
  open,
  onOpenChange,
  clients,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: any[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const noClients = clients.length === 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast({
        title: "Выберите клиента",
        description: "Сначала добавьте клиента",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/cycles", {
        title,
        clientId: parseInt(clientId, 10),
        startDate: startDate || null,
        notes: notes || null,
      });
      onCreated();
      setTitle("");
      setClientId("");
      setStartDate("");
      setNotes("");
    } catch (err: any) {
      toast({
        title: "Ошибка",
        description: err?.message?.split(":").slice(1).join(":").trim(),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый тренировочный цикл</DialogTitle>
          <DialogDescription>
            Создаст 5 недель по 4 тренировки в каждой.
          </DialogDescription>
        </DialogHeader>
        {noClients ? (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Сначала добавьте клиента в разделе «Клиенты».
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cycle-title">Название цикла</Label>
              <Input
                id="cycle-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Напр. Силовой блок — присед"
                data-testid="input-cycle-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Клиент</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Выберите клиента" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} — {c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle-start">Дата начала (необязательно)</Label>
              <Input
                id="cycle-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-cycle-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle-notes">Заметки (необязательно)</Label>
              <Input
                id="cycle-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Цель цикла, особенности"
                data-testid="input-cycle-notes"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={submitting} data-testid="button-create-cycle">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- Диалог управления клиентами ------------------------- */
function ClientsDialog({
  open,
  onOpenChange,
  clients,
  onChanged,
  onError,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: any[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/clients", { name, email, password });
      onChanged();
      setName("");
      setEmail("");
      setPassword("");
    } catch (err: any) {
      onError(err?.message?.split(":").slice(1).join(":").trim() || "Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Клиенты</DialogTitle>
          <DialogDescription>
            Создайте аккаунт клиента. Он сможет входить и видеть свои циклы.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-48 space-y-2 overflow-y-auto">
          {clients.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Клиентов пока нет
            </p>
          ) : (
            clients.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={submit} className="space-y-3 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-name">Имя клиента</Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                data-testid="input-client-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-client-email"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-pass">Пароль</Label>
            <Input
              id="c-pass"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Сообщите пароль клиенту"
              data-testid="input-client-password"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Готово
            </Button>
            <Button type="submit" disabled={submitting} data-testid="button-add-client">
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Добавить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
