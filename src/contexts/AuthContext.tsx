import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export type AppRole = "super_admin" | "company_admin" | "agent" | "operations" | "finance";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  preferredLanguage: string;
}

export interface CompanyMembership {
  companyId: string;
  companyName: string;
  companySlug: string;
  role: AppRole;
  isActive: boolean;
}

export interface AppUser {
  id: string;
  email: string;
  profile: UserProfile;
  platformRoles: AppRole[];
  memberships: CompanyMembership[];
  activeMembership: CompanyMembership | null;
  isSuperAdmin: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  supabaseUser: SupabaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string, fullName: string) => Promise<{ error?: string; userId?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  setActiveCompany: (companyId: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserData(supabaseUser: SupabaseUser): Promise<AppUser | null> {
  try {
    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", supabaseUser.id)
      .single();

    // Fetch platform roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", supabaseUser.id);

    // Fetch company memberships with company info
    const { data: memberships } = await supabase
      .from("company_memberships")
      .select(`
        role,
        is_active,
        company_id,
        companies (
          id,
          name,
          slug
        )
      `)
      .eq("user_id", supabaseUser.id)
      .eq("is_active", true);

    const platformRoles = (roles || []).map((r) => r.role as AppRole);
    const isSuperAdmin = platformRoles.includes("super_admin");

    const mappedMemberships: CompanyMembership[] = (memberships || []).map((m: any) => ({
      companyId: m.companies.id,
      companyName: m.companies.name,
      companySlug: m.companies.slug,
      role: m.role as AppRole,
      isActive: m.is_active,
    }));

    // Get stored active company or use first membership
    const storedCompanyId = localStorage.getItem("safar-active-company");
    const activeMembership = mappedMemberships.find((m) => m.companyId === storedCompanyId) || mappedMemberships[0] || null;

    return {
      id: supabaseUser.id,
      email: supabaseUser.email || "",
      profile: {
        id: supabaseUser.id,
        email: supabaseUser.email || "",
        fullName: profile?.full_name || "",
        avatarUrl: profile?.avatar_url || undefined,
        phone: profile?.phone || undefined,
        preferredLanguage: profile?.preferred_language || "en",
      },
      platformRoles,
      memberships: mappedMemberships,
      activeMembership,
      isSuperAdmin,
    };
  } catch (err) {
    console.error("Error fetching user data:", err);
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    if (!supabaseUser) return;
    const appUser = await fetchUserData(supabaseUser);
    setUser(appUser);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        // Use setTimeout to avoid Supabase deadlock during auth callbacks
        setTimeout(async () => {
          const appUser = await fetchUserData(session.user);
          setUser(appUser);
          setIsLoading(false);
        }, 0);
      } else {
        setSupabaseUser(null);
        setUser(null);
        setIsLoading(false);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        fetchUserData(session.user).then((appUser) => {
          setUser(appUser);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const register = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    return { userId: data.user?.id };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("safar-active-company");
    setUser(null);
    setSupabaseUser(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return {};
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return {};
  };

  const setActiveCompany = (companyId: string) => {
    localStorage.setItem("safar-active-company", companyId);
    if (user) {
      const activeMembership = user.memberships.find((m) => m.companyId === companyId) || null;
      setUser({ ...user, activeMembership });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        resetPassword,
        updatePassword,
        setActiveCompany,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
