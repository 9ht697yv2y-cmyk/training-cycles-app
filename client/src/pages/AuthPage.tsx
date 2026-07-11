import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Dumbbell, Loader2 } from "lucide-react";

export function AuthPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, name, password);
      }
    } catch (err: any) {
      const msg = err?.message?.split(":").slice(1).join(":").trim() || "Ошибка";
      toast({ title: "Не получилось", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Брендовая панель */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-card p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Dumbbell className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">
            ЦИКЛ<span className="text-primary">.</span>
          </span>
        </div>
        <div className="relative space-y-4">
          <h1 className="font-display text-3xl font-bold leading-tight">
            Тренировочные циклы
            <br />
            под полным контролем
          </h1>
          <p className="max-w-md text-muted-foreground">
            Планируйте циклы по 5 недель и 4 тренировки в каждой. Прописывайте
            упражнения, подходы, повторения и вес. Клиент отмечает выполнение и
            логирует результаты.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {["5 недель × 4 тренировки", "Упражнения и подходы", "Лог результатов"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground"
                >
                  {t}
                </span>
              )
            )}
          </div>
        </div>
        <div className="relative text-xs text-muted-foreground">
          Первый зарегистрированный аккаунт становится тренером.
        </div>
      </div>

      {/* Форма */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-border bg-card p-8 shadow-sm">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Dumbbell className="h-5 w-5" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight">
                ЦИКЛ<span className="text-primary">.</span>
              </span>
            </div>
          </div>

          <div className="mb-6 flex rounded-md border border-border p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
              data-testid="tab-login"
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition ${
                mode === "register"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
              data-testid="tab-register"
            >
              Регистрация
            </button>
          </div>

          <h2 className="font-display text-xl font-bold">
            {mode === "login" ? "С возвращением" : "Создать аккаунт"}
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {mode === "login"
              ? "Войдите, чтобы продолжить"
              : "Первый аккаунт — тренер, далее клиенты"}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="input-name"
                  placeholder="Иван Петров"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                data-testid="input-password"
                placeholder="Минимум 6 символов"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              data-testid="button-submit-auth"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Войти" : "Зарегистрироваться"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
