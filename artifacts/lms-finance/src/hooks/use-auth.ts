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
    // Delete: admin only
    canDelete: isAdmin,
    // Edit: admin and staff
    canEdit: isAdmin || isStaff,
    // Add: admin and staff
    canAdd: isAdmin || isStaff,
    // Financial data visibility: admin only
    showFinancials: isAdmin,
    // Staff can see operational data but not financial reports
    showReports: isAdmin,
    // Instructor can see their own class-based financial data
    showInstructorFinancials: isInstructor,
    // Can manage users
    canManageUsers: isAdmin,
    // Can manage fee/voucher/receipts (not instructor)
    canManageFees: isAdmin || isStaff,
  };
}
