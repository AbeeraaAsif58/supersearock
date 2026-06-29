import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/auth/types";

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role,status,is_primary_admin,created_at,updated_at")
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (error) {
    console.error("Failed to load profile:", error.message);
    return null;
  }

  return data ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(async (session: Session | null, showLoading: boolean) => {
    if (showLoading) {
      setLoading(true);
    }

    const sessionUser = session?.user ?? null;
    setUser(sessionUser);

    if (!sessionUser) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const currentProfile = await fetchProfile(sessionUser.id);
    setProfile(currentProfile);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await applySession(session, false);
  }, [applySession]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      await applySession(session, true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer async Supabase calls to avoid auth client deadlock.
      setTimeout(() => {
        if (!active) return;
        void applySession(session, false);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({ user, profile, loading, refresh, signOut }),
    [user, profile, loading, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
