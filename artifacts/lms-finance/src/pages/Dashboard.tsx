import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, getMonthName } from "@/lib/utils";
import {
  Users, Banknote, CreditCard, AlertCircle, ArrowUpRight, ArrowDownRight,
  School, UserCheck, GraduationCap, TrendingUp, Clock, CheckCircle2,
  Wallet, BookCheck,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { isAdmin, isStaff, isInstructor, user } = useAuth();

  if (isInstructor) return <InstructorDashboard user={user!} />;
  if (isStaff) return <StaffDashboard />;
  return <AdminDashboard />;
}

// ── Admin Dashboard ──────────────────────────────────────────────────────

function AdminDashboard() {
  const { data, isLoading, error } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  const { data: instructors = [] } = useQuery<any[]>({
    queryKey: ["instructors"],
    queryFn: () => apiFetch("/instructors"),
  });
  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ["classes"],
    queryFn: () => apiFetch("/classes"),
  });

  if (error) {
    return (
      <div className="p-8 text-center bg-destructive/10 rounded-lg border border-destructive/20 text-destructive">
        <AlertCircle className="w-8 h-8 mx-auto mb-3" />
        <h2 className="text-lg font-bold">Failed to load dashboard</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Full system overview and analytics.</p>
      </div>

      {/* Top row: counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Students" value={data?.totalStudents} subtitle={`${data?.activeStudents ?? 0} active`} icon={<Users className="w-4 h-4 text-primary" />} loading={isLoading} />
        <MetricCard title="Total Classes" value={classes.length} subtitle="All classes" icon={<School className="w-4 h-4 text-blue-500" />} loading={isLoading} />
        <MetricCard title="Total Instructors" value={instructors.length} subtitle={`${instructors.filter((i:any)=>i.status==="active").length} active`} icon={<UserCheck className="w-4 h-4 text-purple-500" />} loading={isLoading} />
        <MetricCard title="Active Courses" value={data?.courseBreakdown?.length} subtitle="With enrolled students" icon={<GraduationCap className="w-4 h-4 text-orange-500" />} loading={isLoading} />
      </div>

      {/* Financial row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Total Generated" value={data?.totalFeeGenerated ? formatCurrency(data.totalFeeGenerated) : undefined} subtitle="All time fee generated" icon={<Banknote className="w-4 h-4 text-blue-500" />} loading={isLoading} highlight="blue" />
        <MetricCard title="Total Received" value={data?.totalReceived ? formatCurrency(data.totalReceived) : undefined} subtitle="All time collected" icon={<ArrowDownRight className="w-4 h-4 text-green-500" />} loading={isLoading} highlight="green" />
        <MetricCard title="Total Pending" value={data?.totalPending ? formatCurrency(data.totalPending) : undefined} subtitle="Outstanding balance" icon={<ArrowUpRight className="w-4 h-4 text-red-500" />} loading={isLoading} highlight="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Course Breakdown</CardTitle>
            <CardDescription>Enrollment and collection status across active courses</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <SkeletonList /> : (
              <div className="space-y-6">
                {data?.courseBreakdown?.map((course) => (
                  <div key={course.course} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium">{course.course}</div>
                      <div className="text-muted-foreground">{formatCurrency(course.totalReceived)} / {formatCurrency(course.totalFeeGenerated)}</div>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full transition-all" style={{ width: `${course.totalFeeGenerated ? (course.totalReceived / course.totalFeeGenerated) * 100 : 0}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{course.totalStudents} students</span>
                      <span>{course.paidCount} paid, {course.unpaidCount} unpaid</span>
                    </div>
                  </div>
                ))}
                {!data?.courseBreakdown?.length && <Empty text="No courses found." />}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Receipts</CardTitle>
            <CardDescription>Latest recorded payments</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <SkeletonList /> : (
              <div className="space-y-4">
                {data?.recentReceipts?.map((receipt) => (
                  <div key={receipt.id} className="flex justify-between items-center text-sm border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium">{receipt.studentName}</div>
                      <div className="text-xs text-muted-foreground">{receipt.course} • {getMonthName(receipt.month)} {receipt.year}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{formatCurrency(receipt.amountReceived)}</div>
                      <div className="text-xs text-muted-foreground">{new Date(receipt.paymentDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
                {!data?.recentReceipts?.length && <Empty text="No recent receipts." />}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Staff Dashboard ───────────────────────────────────────────────────────

function StaffDashboard() {
  const { data, isLoading, error } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });
  const { data: instructors = [] } = useQuery<any[]>({
    queryKey: ["instructors"],
    queryFn: () => apiFetch("/instructors"),
  });
  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ["classes"],
    queryFn: () => apiFetch("/classes"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Daily operations overview.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Students" value={data?.totalStudents} subtitle={`${data?.activeStudents ?? 0} active`} icon={<Users className="w-4 h-4 text-primary" />} loading={isLoading} />
        <MetricCard title="Total Classes" value={classes.length} subtitle="Active classes" icon={<School className="w-4 h-4 text-blue-500" />} loading={isLoading} />
        <MetricCard title="Total Instructors" value={instructors.length} subtitle="Teaching staff" icon={<UserCheck className="w-4 h-4 text-purple-500" />} loading={isLoading} />
        <MetricCard title="Active Courses" value={data?.courseBreakdown?.length} subtitle="Ongoing" icon={<GraduationCap className="w-4 h-4 text-orange-500" />} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Course Enrollment</CardTitle>
            <CardDescription>Students per course</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <SkeletonList /> : (
              <div className="space-y-4">
                {data?.courseBreakdown?.map((course) => (
                  <div key={course.course} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="font-medium text-sm">{course.course}</div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{course.totalStudents} students</span>
                      <Badge variant={course.unpaidCount > 0 ? "destructive" : "default"} className="text-xs">
                        {course.unpaidCount} unpaid
                      </Badge>
                    </div>
                  </div>
                ))}
                {!data?.courseBreakdown?.length && <Empty text="No courses found." />}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Receipts</CardTitle>
            <CardDescription>Latest recorded payments</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <SkeletonList /> : (
              <div className="space-y-4">
                {data?.recentReceipts?.slice(0, 6).map((receipt) => (
                  <div key={receipt.id} className="flex justify-between items-center text-sm border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium">{receipt.studentName}</div>
                      <div className="text-xs text-muted-foreground">{getMonthName(receipt.month)} {receipt.year}</div>
                    </div>
                    <div className="font-bold text-green-600">{formatCurrency(receipt.amountReceived)}</div>
                  </div>
                ))}
                {!data?.recentReceipts?.length && <Empty text="No recent receipts." />}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Instructor Dashboard ──────────────────────────────────────────────────

function InstructorDashboard({ user }: { user: { id: number; instructorId?: number; displayName: string } }) {
  const instructorId = user.instructorId;

  const { data: instructorDetail, isLoading } = useQuery<any>({
    queryKey: ["instructor-detail", instructorId],
    queryFn: () => instructorId ? apiFetch(`/instructors/${instructorId}`) : null,
    enabled: !!instructorId,
  });

  const { data: myStudents = [] } = useQuery<any[]>({
    queryKey: ["students"],
    queryFn: () => apiFetch("/students"),
  });

  const { data: myAttendance = [] } = useQuery<any[]>({
    queryKey: ["attendance"],
    queryFn: () => apiFetch("/attendance"),
  });

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const presentThisMonth = myAttendance.filter((a: any) => {
    const d = new Date(a.attendanceDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && a.status === "present";
  }).length;

  const assignedClasses = instructorDetail?.assignedClasses ?? [];
  const classFinancials = instructorDetail?.classFinancials ?? { totalGenerated: 0, totalReceived: 0, totalPending: 0 };
  const totalEarned = instructorDetail?.totalEarned ?? 0;
  const totalPaid = instructorDetail?.totalPaid ?? 0;
  const pendingEarnings = instructorDetail?.pendingEarnings ?? 0;
  const monthlySalary = instructorDetail?.monthlySalary ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {user.displayName}</h1>
        <p className="text-sm text-muted-foreground mt-1">Your instructor portal overview.</p>
      </div>

      {/* My classes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="My Classes" value={assignedClasses.length} subtitle="Assigned classes" icon={<School className="w-4 h-4 text-blue-500" />} loading={isLoading} />
        <MetricCard title="My Students" value={myStudents.length} subtitle="In my classes" icon={<Users className="w-4 h-4 text-primary" />} loading={isLoading} />
        <MetricCard title="Lectures This Month" value={presentThisMonth} subtitle="Check-ins this month" icon={<CheckCircle2 className="w-4 h-4 text-green-500" />} loading={isLoading} />
        <MetricCard title="Monthly Salary" value={formatCurrency(monthlySalary)} subtitle="Per month" icon={<Wallet className="w-4 h-4 text-purple-500" />} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              My Classes Financial Summary
            </CardTitle>
            <CardDescription>Revenue from your assigned classes</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <SkeletonList /> : (
              <div className="space-y-4">
                <FinancialRow label="Generated Revenue" value={classFinancials.totalGenerated} color="blue" />
                <FinancialRow label="Received Revenue" value={classFinancials.totalReceived} color="green" />
                <FinancialRow label="Pending Revenue" value={classFinancials.totalPending} color="red" />
                {assignedClasses.length === 0 && <Empty text="No classes assigned yet." />}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Earnings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-purple-500" />
              My Earnings
            </CardTitle>
            <CardDescription>Salary and payment summary</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <SkeletonList /> : (
              <div className="space-y-4">
                <FinancialRow label="Total Earnings" value={totalEarned} color="blue" />
                <FinancialRow label="Salary Paid" value={totalPaid} color="green" />
                <FinancialRow label="Pending Salary" value={pendingEarnings} color="red" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My assigned classes list */}
      {assignedClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {assignedClasses.map((cls: any) => (
                <div key={cls.classId} className="p-3 rounded-lg border bg-muted/30">
                  <div className="font-medium text-sm">{cls.className}</div>
                  <div className="text-xs text-muted-foreground mt-1">{cls.courseName} • {cls.year}</div>
                  {cls.section && <div className="text-xs text-muted-foreground">Section: {cls.section}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────

function FinancialRow({ label, value, color }: { label: string; value: number; color: "blue" | "green" | "red" }) {
  const colors = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
  };
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-bold text-sm ${colors[color]}`}>{formatCurrency(value)}</span>
    </div>
  );
}

function MetricCard({
  title, value, subtitle, icon, loading, highlight,
}: {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  loading: boolean;
  highlight?: "blue" | "green" | "red";
}) {
  const bgMap = { blue: "bg-blue-50 dark:bg-blue-950/20", green: "bg-green-50 dark:bg-green-950/20", red: "bg-red-50 dark:bg-red-950/20" };
  return (
    <Card className={highlight ? bgMap[highlight] : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24 mb-1" /> : (
          <div className="text-2xl font-bold text-foreground">{value ?? 0}</div>
        )}
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-6 text-muted-foreground text-sm">{text}</div>;
}
