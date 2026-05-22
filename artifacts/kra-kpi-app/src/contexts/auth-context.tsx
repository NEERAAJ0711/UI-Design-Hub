import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useLogin, useLogout, useGetCurrentUser } from "@workspace/api-client-react";
import type { CurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  // On mount, try to restore session from /api/auth/me
  const { data: me, isLoading: meLoading, isError: meError } = useGetCurrentUser({
    query: { retry: false, staleTime: Infinity, queryKey: ["auth", "me"] },
  });

  useEffect(() => {
    if (!meLoading) {
      setUser(meError ? null : (me ?? null));
      setIsLoading(false);
    }
  }, [me, meLoading, meError]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await loginMutation.mutateAsync({ data: { email, password } });
      setUser(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      // Extract cleaner message from API error
      const match = msg.match(/: (.+)$/);
      setError(match ? match[1] : msg);
      throw err;
    }
  }, [loginMutation]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    setUser(null);
    queryClient.clear();
  }, [logoutMutation, queryClient]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
