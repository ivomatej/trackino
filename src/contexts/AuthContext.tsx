'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  // Načtení profilu uživatele
  async function fetchProfile(userId: string) {
    try {
      const { data } = await supabase
        .from('trackino_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data as Profile);
      }
    } catch (err) {
      console.warn('Chyba při načítání profilu:', err);
    }
  }

  // Vytvoření profilu při registraci
  async function createProfile(userId: string, email: string, displayName: string) {
    const colors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#ec4899', '#14b8a6', '#f97316'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const { error } = await supabase
      .from('trackino_profiles')
      .upsert({
        id: userId,
        display_name: displayName,
        email: email,
        avatar_color: randomColor,
        language: 'cs',
        theme: 'system',
        currency: 'CZK',
      });

    if (!error) {
      await fetchProfile(userId);
    }
  }


  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Nejprve nastavíme listener, pak získáme session
    // Toto pořadí zabrání race condition s lock
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Použijeme setTimeout pro oddělení od auth callbacku
          // Tím zabráníme deadlocku na Navigator Lock
          setTimeout(() => {
            fetchProfile(currentSession.user.id);
          }, 0);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    // Získání počáteční session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        fetchProfile(currentSession.user.id);
      }

      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    } catch (err) {
      return { error: 'Chyba připojení k serveru' };
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });

      if (!error && data.user) {
        await createProfile(data.user.id, email, displayName);
      }

      return { error: error?.message ?? null };
    } catch (err) {
      return { error: 'Chyba při registraci' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignorovat chybu při odhlášení
    }
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    const { error } = await supabase
      .from('trackino_profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
