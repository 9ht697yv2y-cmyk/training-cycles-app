import { createClient } from "@supabase/supabase-js";
import ws from "ws";

// Клиент Supabase — используется только на сервере (ключ не попадает в браузер).
// Вся авторизация (роли coach/client) выполняется в Express-роутах.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] SUPABASE_URL / SUPABASE_ANON_KEY не заданы. Укажите их в переменных окружения."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: { persistSession: false, autoRefreshToken: false },
    // Node 20 не имеет нативного WebSocket — передаём реализацию из пакета ws
    realtime: { transport: ws },
  }
);
