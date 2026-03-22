import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type User,
} from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://trxpofoucgdytlhovrkq.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!SUPABASE_ANON_KEY) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseClient;
}

export function subscribeToAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return () => {};
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);

  return () => {
    subscription.unsubscribe();
  };
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  // Always force-refresh to guarantee a non-expired token.
  // refreshSession() makes a real network call to Supabase auth — no stale
  // cached token can slip through. Falls back to null if no session exists.
  const { data, error } = await supabase.auth.refreshSession();
  if (!error && data.session?.access_token) {
    return data.session.access_token;
  }

  return null;
}

export async function getSupabaseUser(): Promise<User | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: new Error("Missing Supabase config") };
  }
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email: string, password: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: new Error("Missing Supabase config") };
  }
  return supabase.auth.signUp({ email, password });
}

export async function signOutSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: new Error("Missing Supabase config") };
  }
  return supabase.auth.signOut();
}
