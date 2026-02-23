"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { toast } from "react-hot-toast";

const SIGNED_OUT_KEY = "makmur_signed_out";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAnonymous: boolean;
  isAdmin: boolean;
  showLoginModal: boolean;
  setShowLoginModal: (v: boolean) => void;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, name: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAnonymous: true,
  isAdmin: false,
  showLoginModal: false,
  setShowLoginModal: () => { },
  signInWithEmail: async () => null,
  signUp: async () => null,
  signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Use email presence to definitively detect anonymous vs registered users
  const isAnonymous = user ? (!user.email) : true;

  /* ──────────────────────────────────────────
     Check if a user has the 'admin' role.
     Fast: single DB query, no unnecessary retries.
     LockManager errors are caught silently.
  ────────────────────────────────────────── */
  const checkAdminRole = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, is_banned")
        .eq("user_id", userId)
        .single();

      if (error) {
        // LockManager / lock errors: don't block the user, just log softly
        if (error.message?.includes("LockManager") || error.message?.includes("lock")) {
          console.warn("AuthContext: lock busy, skipping admin check.");
        }
        setIsAdmin(false);
        return false;
      }

      // Auto-logout if user is banned
      if (data?.is_banned === true) {
        await supabase.auth.signOut();
        setUser(null);
        setIsAdmin(false);
        toast.error("Your account has been banned. Please contact the mosque administration.", { duration: 5000 });
        return false;
      }

      const admin = data?.role === "admin";
      setIsAdmin(admin);
      return admin;
    } catch (err: any) {
      if (!err?.message?.includes("LockManager")) {
        console.warn("AuthContext - checkAdminRole:", err?.message);
      }
      setIsAdmin(false);
      return false;
    }
  }, []);

  /* ──────────────────────────────────────────
     Bootstrap: runs once on mount.
     1. Restore existing non-anonymous session if present
     2. Otherwise, stay unauthenticated (guest)
     NOTE: We no longer create anonymous sessions because
     the SSR cookie-based auth causes them to persist and
     conflict with real signInWithPassword calls.
  ────────────────────────────────────────── */
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const bootstrap = async () => {
      try {
        const userSignedOut = localStorage.getItem(SIGNED_OUT_KEY) === "true";

        if (!userSignedOut) {
          const { data: { session } } = await supabase.auth.getSession();

          if (mounted && session?.user && session.user.email) {
            // Real authenticated user — restore session
            setUser(session.user);
            checkAdminRole(session.user.id);
            return;
          }

          // If there's an anonymous session lingering, sign out of it
          // so it doesn't interfere with future sign-ins
          if (session?.user?.is_anonymous) {
            await supabase.auth.signOut();
          }
        }

        // No valid session — user is a guest (null user, isAnonymous = true)
        localStorage.removeItem(SIGNED_OUT_KEY);
      } catch (err) {
        console.error("AuthContext bootstrap error:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    bootstrap();

    /* ──────────────────────────────────────────
       Poll ban status every 30s for logged-in users.
       Ensures banned users are kicked out promptly
       without waiting for a page refresh.
    ────────────────────────────────────────── */
    const banPollInterval = setInterval(async () => {
      if (!mounted) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          checkAdminRole(session.user.id);
        }
      } catch {
        // Ignore poll errors silently
      }
    }, 30_000);

    /* ──────────────────────────────────────────
       Listen for auth state changes.
       Fires when: sign in, sign out, token refresh.
    ────────────────────────────────────────── */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_OUT") {
          setUser(null);
          setIsAdmin(false);
          return;
        }

        const newUser = session?.user ?? null;
        setUser(newUser);

        if (newUser && newUser.email) {
          checkAdminRole(newUser.id);
        } else {
          setIsAdmin(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearInterval(banPollInterval);
      subscription.unsubscribe();
    };
  }, [checkAdminRole]);

  /* ── Sign In ── */
  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const supabase = createClient();
      localStorage.removeItem(SIGNED_OUT_KEY);

      // Sign out any existing anonymous session first to clear the cookie
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user?.is_anonymous || (currentSession?.user && !currentSession.user.email)) {
          await supabase.auth.signOut();
          // Small delay to let the cookie clear
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (e) {
        // Ignore errors during cleanup
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) return error.message;

      if (data.user) {
        // Check ban status BEFORE setting user state so we can block the login
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role, is_banned")
          .eq("user_id", data.user.id)
          .single();

        if (roleData?.is_banned === true) {
          await supabase.auth.signOut();
          return "Your account has been banned. Please contact the mosque administration.";
        }

        setUser(data.user);
        const admin = roleData?.role === "admin";
        setIsAdmin(admin);
      }

      setShowLoginModal(false);
      return null;
    },
    [] // no external deps needed — all refs are stable supabase client calls
  );

  /* ── Sign Up ── */
  const signUp = useCallback(
    async (email: string, password: string, name: string): Promise<string | null> => {
      const supabase = createClient();
      localStorage.removeItem(SIGNED_OUT_KEY);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) return error.message;
      setShowLoginModal(false);
      return null;
    },
    []
  );

  /* ── Sign Out ── */
  const signOut = useCallback(async () => {
    const supabase = createClient();
    localStorage.setItem(SIGNED_OUT_KEY, "true");
    setIsAdmin(false);
    setUser(null);
    await supabase.auth.signOut();
    window.location.href = "/";
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAnonymous, isAdmin, showLoginModal, setShowLoginModal, signInWithEmail, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
