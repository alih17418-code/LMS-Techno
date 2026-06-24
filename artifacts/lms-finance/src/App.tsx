import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout/Layout";
import { apiFetch } from "@/lib/api";

// Pages
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import StudentLedger from "@/pages/StudentLedger";
import StudentIdCard from "@/pages/StudentIdCard";
import Courses from "@/pages/Courses";
import Vouchers from "@/pages/Vouchers";
import Receipts from "@/pages/Receipts";
import Reports from "@/pages/Reports";
import Instructors from "@/pages/Instructors";
import InstructorDetail from "@/pages/InstructorDetail";
import Budget from "@/pages/Budget";
import Certificates from "@/pages/Certificates";
import Classes from "@/pages/Classes";
import Attendance from "@/pages/Attendance";
import StudentAttendance from "@/pages/StudentAttendance";
import StudentPortal from "@/pages/StudentPortal";
import Login from "@/pages/Login";
import Roles from "@/pages/Roles";

type AuthUser = { id: number; username: string; role: string; displayName: string; instructorId?: number };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      try { return await apiFetch<AuthUser>("/auth/me"); }
      catch { return null; }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const redirect = location !== "/" ? `?redirect=${encodeURIComponent(location)}` : "";
    return <Redirect to={`/login${redirect}`} />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/portal" component={StudentPortal} />
      <Route path="/login" component={Login} />
      <Route>
        <RequireAuth>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/students" component={Students} />
              <Route path="/students/:id/ledger" component={StudentLedger} />
              <Route path="/students/:id/idcard" component={StudentIdCard} />
              <Route path="/courses" component={Courses} />
              <Route path="/fee-structures"><Redirect to="/courses" /></Route>
              <Route path="/instructors" component={Instructors} />
              <Route path="/instructors/:id" component={InstructorDetail} />
              <Route path="/vouchers" component={Vouchers} />
              <Route path="/receipts" component={Receipts} />
              <Route path="/reports" component={Reports} />
              <Route path="/budget" component={Budget} />
              <Route path="/certificates" component={Certificates} />
              <Route path="/classes" component={Classes} />
              <Route path="/attendance" component={Attendance} />
              <Route path="/student-attendance" component={StudentAttendance} />
              <Route path="/roles" component={Roles} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </RequireAuth>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
