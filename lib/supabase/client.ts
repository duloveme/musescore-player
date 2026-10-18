import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

export function createClient() {
  const env = supabaseEnv();
  if (!env) {
    throw new Error("Supabase 환경변수가 없습니다.");
  }
  return createBrowserClient(env.url, env.key);
}
