"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

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
  setShowLoginModal: () => {},
  signInWithEmail: async () => null,
  signUp: async () => null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const isAnonymous = user?.is_anonymous ?? true;

  const checkAdminRole = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();
        
      if (error) {
        console.error("AuthContext - checkAdminRole error:", error.message);
      }
      
      const admin = data?.role === "admin";
      setIsAdmin(admin);
      return admin;
    } catch (err) {
      console.error("AuthContext - checkAdminRole exception:", err);
      setIsAdmin(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const bootstrap = async () => {
      const userSignedOut = localStorage.getItem(SIGNED_OUT_KEY) === "true";
      if (!userSignedOut) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !session.user.is_anonymous) {
          setUser(session.user);
          await checkAdminRole(session.user.id);
          setIsLoading(false);
          return;
        }
      }
      localStorage.removeItem(SIGNED_OUT_KEY);
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) console.error("Silent Guest sign-in failed:", error.message);
      else setUser(data.user);
      setIsLoading(false);
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") return;
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser && !newUser.is_anonymous) {
        await checkAdminRole(newUser.id);
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkAdminRole]);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<string | null> => {
    const supabase = createClient();
    localStorage.removeItem(SIGNED_OUT_KEY);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    
    // Close modal. onAuthStateChange will automatically fire and update `user` and `isAdmin` states.
    setShowLoginModal(false);
    return null;
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string): Promise<string | null> => {
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
  }, []);

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
