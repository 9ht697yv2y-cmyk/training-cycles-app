# ЦИКЛ — тренировочные циклы

Express + React + Supabase (Postgres). Тренер прописывает циклы (5 недель × 4 тренировки), клиент логирует результаты. Данные хранятся в Supabase — постоянное хранилище, не зависит от хостинга.

## Переменные окружения

Создай `.env` по образцу `.env.example`:

```
SUPABASE_URL=https://твой-проект.supabase.co
SUPABASE_ANON_KEY=твой-anon-ключ
SESSION_SECRET=длинная случайная строка
NODE_ENV=production
```

## Быстрый деплой на Render

1. Залей проект в GitHub-репозиторий (приватный — ок). Убедись, что `.env` не попадает в репо (он в `.gitignore`).
2. На [render.com](https://render.com): **New → Web Service → из GitHub-репо**.
3. Настройки:
   - Runtime: **Node**
   - Build Command: `npm ci && npm run build`
   - Start Command: `NODE_ENV=production node dist/index.cjs`
4. Environment variables (Environment → Add):
   - `SUPABASE_URL` = из Settings → API в Supabase
   - `SUPABASE_ANON_KEY` = из Settings → API (anon, JWT-формат)
   - `SESSION_SECRET` = любая длинная случайная строка
   - `NODE_ENV` = `production`
5. Deploy. Render выдаст URL вида `training-cycles.onrender.com`.
6. **Settings → Custom Domains** → добавь свой домен. Render покажет CNAME — пропиши его в DNS регистратора.
7. Готово — сайт откроется по твоему домену с HTTPS.

## Локальный запуск

```bash
npm install
npm run dev   # http://localhost:5000
```

## Сборка

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

## Структура БД

Таблицы в Supabase (snake_case): `users`, `cycles`, `weeks`, `workouts`, `exercises`, `workout_logs`, `exercise_logs`. Включён Row Level Security. Ключ используется только на сервере, в браузер не попадает.
