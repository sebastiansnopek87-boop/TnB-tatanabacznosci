import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Single source of truth for "who is signed in" on the client. One Supabase
// subscription feeds every component; INITIAL_SESSION restores the session
// after a refresh, SIGNED_OUT covers logout and expired sessions.
export type AuthState = { status: "loading" | "signed-in" | "signed-out"; user: User | null };

const LOADING: AuthState = { status: "loading", user: null };
let state: AuthState = LOADING;
let started = false;
const listeners = new Set<() => void>();

function set(user: User | null) {
  const next: AuthState = user ? { status: "signed-in", user } : { status: "signed-out", user: null };
  if (next.status === state.status && next.user?.id === state.user?.id && next.user?.updated_at === state.user?.updated_at) return;
  state = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.onAuthStateChange((_event, session) => set(session?.user ?? null));
}

function subscribe(l: () => void) {
  start();
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}
