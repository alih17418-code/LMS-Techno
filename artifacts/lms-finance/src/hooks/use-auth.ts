import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type AuthUser = {
  id: number;
  username: string;
  role: "admin" | "staff" | "instructor";
  displayName: string;
  instructorId?: number;
};

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      try { return await apiFetch<AuthUser>("/auth/me"); }
      catch { return null; }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const role = user?.role ?? null;
  const isAdmin = role === "admin";
  const isStaff = role === "staff";
  const isInstructor = role === "instructor";

  return {
    user,
    role,
    isAdmin,
    isStaff,
    isInstructor,
    isLoading,
    canDelete: isAdmin,
    canEdit: isAdmin || isStaff,
    canAdd: isAdmin || isStaff,
    showFinancials: isAdmin,
  };
}
