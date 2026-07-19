import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, BookOpen, Receipt, FileText, CreditCard,
  GraduationCap, UserCheck, Wallet, Award, School, ClipboardCheck,
  ShieldCheck, Globe, LogOut, LogIn, BookCheck, ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type AuthUser = { id: number; username: string; role: string; displayName: string; instructorId?: number };

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
  staffVisible?: boolean; // visible to admin + staff
  instructorOnly?: boolean;
};

const ADMIN_STAFF_SECTIONS: NavSection[] = [
  {
    label: "Main",
    staffVisible: true,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/students", label: "Students", icon: Users },
      { href: "/courses", label: "Courses", icon: GraduationCap },
      { href: "/classes", label: "Classes", icon: School },
    ],
  },
  {
    label: "Finance",
    adminOnly: true,
    items: [
      { href: "/vouchers", label: "Vouchers", icon: FileText },
      { href: "/receipts", label: "Receipts", icon: Receipt },
      { href: "/reports", label: "Reports", icon: CreditCard },
      { href: "/budget", label: "Budget", icon: Wallet },
    ],
  },
  {
    label: "Staff — Fees",
    staffVisible: true,
    items: [
      { href: "/vouchers", label: "Vouchers", icon: FileText },
      { href: "/receipts", label: "Receipts", icon: Receipt },
    ],
  },
  {
    label: "Instructors",
    staffVisible: true,
    items: [
      { href: "/instructors", label: "Instructors", icon: UserCheck },
      { href: "/attendance", label: "Instructor Attendance", icon: ClipboardCheck },
    ],
  },
  {
    label: "Students",
    staffVisible: true,
    items: [
      { href: "/student-attendance", label: "Student Attendance", icon: BookCheck },
      { href: "/certificates", label: "Certificates", icon: Award },
      { href: "/portal", label: "Student Portal", icon: Globe },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { href: "/roles", label: "Roles & Users", icon: ShieldCheck },
    ],
  },
];

const INSTRUCTOR_SECTIONS: NavSection[] = [
  {
    label: "My Portal",
    instructorOnly: true,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/attendance", label: "My Check-in", icon: ClipboardCheck },
      { href: "/student-attendance", label: "Student Attendance", icon: BookCheck },
    ],
  },
  {
    label: "My Classes",
    instructorOnly: true,
    items: [
      { href: "/students", label: "My Students", icon: Users },
      { href: "/classes", label: "My Classes", icon: School },
    ],
  },
];

export function Sidebar({ role }: { role?: string }) {
  const [location] = useLocation();
  const isAdmin = role === "admin";
  const isStaff = role === "staff";
  const isInstructor = role === "instructor";

  let sections: NavSection[];

  if (isInstructor) {
    sections = INSTRUCTOR_SECTIONS;
  } else {
    sections = ADMIN_STAFF_SECTIONS.filter(section => {
      if (section.instructorOnly) return false;
      if (section.adminOnly && !isAdmin) return false;
      // "Staff — Fees" section: show only to staff, hide from admin (admin sees full Finance)
      if (section.label === "Staff — Fees") return isStaff;
      if (section.staffVisible) return isAdmin || isStaff;
      return true;
    });
  }

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border min-h-[100dvh] flex flex-col hidden md:flex shrink-0">
      <div className="p-4 border-b border-sidebar-border flex flex-col items-center gap-1 bg-white/95">
        <img src="/tips-logo.png" alt="TIPS" className="h-16 w-auto object-contain" />
        <p className="text-[10px] text-slate-500 font-mono tracking-widest">FINANCE SYSTEM</p>
      </div>
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/40 px-2 mb-1">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link key={item.href + section.label} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/40 font-mono text-center">
        v3.0.0
      </div>
    </aside>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: user } = useQuery<AuthUser | null>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      try { return await apiFetch<AuthUser>("/auth/me"); }
      catch { return null; }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const logout = useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(["auth-me"], null);
      toast({ title: "Logged out" });
      setLocation("/login");
    },
  });

  const initials = user?.displayName
    ? user.displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "TS";

  const ROLE_COLORS: Record<string, string> = {
    admin: "bg-red-100 text-red-700",
    staff: "bg-blue-100 text-blue-700",
    instructor: "bg-green-100 text-green-700",
  };

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <Sidebar role={user?.role} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center px-6 shrink-0 justify-between">
          <div className="font-semibold text-sm text-muted-foreground md:hidden">TIPS Finance</div>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className={`text-xs px-1.5 py-0.5 rounded capitalize ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700"}`}>{user.role}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {initials}
                </div>
                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => logout.mutate()}>
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </Button>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">TS</div>
                <Link href="/login">
                  <Button size="sm" variant="outline" className="gap-1.5"><LogIn className="w-3.5 h-3.5" />Login</Button>
                </Link>
              </>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
