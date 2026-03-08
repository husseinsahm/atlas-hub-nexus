import React, { createContext, useContext, useState } from "react";

export type UserRole = "super_admin" | "company_admin" | "staff" | "client";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;
  companyName?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user for development - will be replaced with Supabase auth
const MOCK_USERS: Record<string, User> = {
  "admin@safar.com": {
    id: "1",
    email: "admin@safar.com",
    name: "Omar Al-Rashid",
    role: "super_admin",
  },
  "company@safar.com": {
    id: "2",
    email: "company@safar.com",
    name: "Sarah Mitchell",
    role: "company_admin",
    companyId: "c1",
    companyName: "Luxury Voyages",
  },
  "staff@safar.com": {
    id: "3",
    email: "staff@safar.com",
    name: "Ahmed Hassan",
    role: "staff",
    companyId: "c1",
    companyName: "Luxury Voyages",
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, _password: string) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const mockUser = MOCK_USERS[email];
    if (mockUser) {
      setUser(mockUser);
    } else {
      // Default to company admin for any email
      setUser({
        id: "99",
        email,
        name: "Demo User",
        role: "company_admin",
        companyId: "c1",
        companyName: "Demo Travel Co",
      });
    }
    setIsLoading(false);
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
