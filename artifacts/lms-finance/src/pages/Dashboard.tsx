import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, getMonthName } from "@/lib/utils";
import {
  Users, Banknote, CreditCard, AlertCircle, ArrowUpRight, ArrowDownRight,
  School, UserCheck, GraduationCap, TrendingUp, CheckCircle2,
  Wallet, BookCheck, PiggyBank, BarChart3, Filter,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type InstructorEarning = {
  id: number; name: string; paymentModel: string; lectureRate: number;
  totalLectures: number; totalEarned: number; totalPaid: number; pendingEarnings: number;
};

type DashboardData = {
  totalStudents: number;
  activeStudents: number;
  monthlyExpectedFees: number;
  totalCourseFees: number;
  totalCollected: number;
  totalRemainingBalance: number;
  totalTeacherPayments: number;
  instituteProfit: number;
  totalFeeGenerated: number;
  totalReceived: number;
  totalPending: number;
  paidVouchers: number;
  partialVouchers: number;
  unpaidVouchers: number;
  totalClassesConducted: number;
  totalInstructorExpense: number;
  avgCostPerClass: number;
  instructorEarnings: InstructorEarning[];
  recentReceipts: Array<{
    id: number;
    studentName: string;
    studentCode: string;
    course: string;
    month: number;
    year: number;
    amountReceived: number;
    paymentDate: string;
  }>;
  courseBreakdown: Array<{
    course: string;
    courseId: number;
    totalStudents: number;
    activeStudents: number;
    monthlyTotal: number;
    courseTotal: number;
    collected: number;
    remaining: number;
    totalFeeGenerated: number;
    totalReceived: number;
    paidCount: number;
    unpaidCount: number;
  }>;
  batchBreakdown: Array<{
    classId: number;
    className: string;
    courseName: string;
    batch: string | null;
    totalStudents: number;
    monthlyFees: number;
    totalCollected: number;
    teacherPayments: number;
    profit: number;
  }>;
};

type ClassRecord = { id: number; className: string; courseName: string; };

export default function Dashboard() {
  const { isAdmin, isStaff, isInstructor, user } = useAuth();

  if (isInstructor) return <InstructorDashboard user={user!} />;
  if (isStaff) return <StaffDashboard />;
  return <AdminDashboard />;
}

// ── Admin Dashboard ──────────────────────────────────────────────────────

function AdminDashboard() {
  const [selectedClassId, setSelectedClassId] = useState<string>("all");

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch("/reports/dashboard"),
    staleTime: 30_000,
  });

  const { data: instructors = [] } = useQuery<any[]>({
    queryKey: ["instructors"],
    queryFn: () => apiFetch("/instructors"),
  });
  const { data: classes = [] } = useQuery<ClassRecord[]>({
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

  // Derive class-filtered view
  const selectedBatch = selectedClassId !== "all"
    ? data?.batchBreakdown?.find(b => b.classId === Number(selectedClassId))
    : null;

  // Aggregate numbers based on filter
  const stats = selectedBatch
    ? {
        totalStudents: selectedBatch.totalStudents,
        monthlyExpectedFees: selectedBatch.monthlyFees,
        totalCollected: selectedBatch.totalCollected,
        totalTeacherPayments: selectedBatch.teacherPayments,
        profit: selectedBatch.profit,
      }
    : {
        totalStudents: data?.totalStudents ?? 0,
        monthlyExpectedFees: data?.monthlyExpectedFees ?? 0,
        totalCollected: data?.totalCollected ?? 0,
        totalTeacherPayments: data?.totalTeacherPayments ?? 0,
        profit: data?.instituteProfit ?? 0,
      };

  const isFiltered = selectedClassId !== "all";
  const filteredBatches = isFiltered
    ? (data?.batchBreakdown ?? []).filter(b => b.classId === Number(selectedClassId))
    : (data?.batchBreakdown ?? []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isFiltered && selectedBatch
              ? `Showing data for: ${selectedBatch.className} (${selectedBatch.courseName})`
              : "Full system overview and financial analytics."}
          </p>
        </div>
        {/* Class filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes (Overall)</SelectItem>
              {(data?.batchBreakdown ?? []).map(b => (
                <SelectItem key={b.classId} value={String(b.classId)}>
                  {b.className}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 1: Counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title={isFiltered ? "Students (this class)" : "Total Students"}
          value={stats.totalStudents}
          subtitle={isFiltered ? selectedBatch?.className : `${data?.activeStudents ?? 0} active`}
          icon={<Users className="w-4 h-4 text-primary" />}
          loading={isLoading}
        />
        <MetricCard
          title="Total Classes"
          value={isFiltered ? 1 : classes.length}
          subtitle={isFiltered ? selectedBatch?.className : "All classes"}
          icon={<School className="w-4 h-4 text-blue-500" />}
          loading={isLoading}
        />
        <MetricCard
          title="Total Instructors"
          value={instructors.length}
          subtitle={`${instructors.filter((i: any) => i.status === "active").length} active`}
          icon={<UserCheck className="w-4 h-4 text-purple-500" />}
          loading={isLoading}
        />
        <MetricCard
          title="Active Courses"
          value={isFiltered ? 1 : data?.courseBreakdown?.length}
          subtitle={isFiltered ? selectedBatch?.courseName : "With enrolled students"}
          icon={<GraduationCap className="w-4 h-4 text-orange-500" />}
          loading={isLoading}
        />
      </div>

      {/* Row 2: Fee overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Monthly Expected Fees"
          value={formatCurrency(stats.monthlyExpectedFees)}
          subtitle={isFiltered ? "This class monthly fees" : "Sum of all active students' monthly fees"}
          icon={<Banknote className="w-4 h-4 text-blue-500" />}
          loading={isLoading}
          highlight="blue"
        />
        <MetricCard
          title={isFiltered ? "Total Collected (class)" : "Total Course Fees"}
          value={isFiltered ? formatCurrency(stats.totalCollected) : formatCurrency(data?.totalCourseFees ?? 0)}
          subtitle={isFiltered ? "All receipts for this class" : "Full payable across all students"}
          icon={<BookCheck className="w-4 h-4 text-indigo-500" />}
          loading={isLoading}
          highlight="blue"
        />
        <MetricCard
          title="Total Collected"
          value={formatCurrency(stats.totalCollected)}
          subtitle={isFiltered ? "Class receipts + opening" : "Receipts + opening payments"}
          icon={<ArrowDownRight className="w-4 h-4 text-green-500" />}
          loading={isLoading}
          highlight="green"
        />
      </div>

      {/* Row 3: Balance + Teacher + Profit */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title={isFiltered ? "Remaining Balance (class)" : "Remaining Balance"}
          value={isFiltered
            ? formatCurrency(Math.max(0, stats.monthlyExpectedFees - stats.totalCollected))
            : formatCurrency(data?.totalRemainingBalance ?? 0)}
          subtitle={isFiltered ? "Monthly fees − Collected" : "Total Course Fees − Collected"}
          icon={<ArrowUpRight className="w-4 h-4 text-red-500" />}
          loading={isLoading}
          highlight="red"
        />
        <MetricCard
          title="Total Teacher Payments"
          value={formatCurrency(stats.totalTeacherPayments)}
          subtitle={isFiltered ? "Instructor salary for this class" : "All instructor salary paid"}
          icon={<Wallet className="w-4 h-4 text-amber-500" />}
          loading={isLoading}
          highlight="amber"
        />
        <MetricCard
          title="Institute Profit"
          value={formatCurrency(stats.profit)}
          subtitle={isFiltered ? "Collected − Teacher Payments" : "Collected − Teacher Payments"}
          icon={<PiggyBank className="w-4 h-4 text-emerald-500" />}
          loading={isLoading}
          highlight={stats.profit >= 0 ? "green" : "red"}
        />
      </div>

      {/* Batch / class profit table */}
      {filteredBatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              {isFiltered ? "Class Financial Summary" : "Batch-wise Profit Analysis"}
            </CardTitle>
            <CardDescription>
              {isFiltered
                ? `Detailed financial breakdown for ${selectedBatch?.className}`
                : "Monthly student fees vs teacher payments per class — institute profit per batch"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Class / Batch</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Students</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Monthly Fees</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total Collected</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Teacher Payments</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((b) => (
                    <tr key={b.classId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.className}</div>
                        <div className="text-xs text-muted-foreground">{b.courseName}{b.batch ? ` • ${b.batch}` : ""}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{b.totalStudents}</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(b.monthlyFees)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">{formatCurrency(b.totalCollected)}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{formatCurrency(b.teacherPayments)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono font-semibold ${b.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {b.profit >= 0 ? "+" : ""}{formatCurrency(b.profit)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Instructor Earnings Section ── */}
      {!isFiltered && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <UserCheck className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold">Instructor Earnings</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Total Instructor Expense"
              value={formatCurrency(data?.totalInstructorExpense ?? 0)}
              subtitle="Total earnings owed to all instructors"
              icon={<Wallet className="w-4 h-4 text-amber-500" />}
              loading={isLoading}
              highlight="amber"
            />
            <MetricCard
              title="Classes Conducted"
              value={data?.totalClassesConducted ?? 0}
              subtitle="Total lectures across all instructors"
              icon={<BookCheck className="w-4 h-4 text-blue-500" />}
              loading={isLoading}
            />
            <MetricCard
              title="Avg Cost Per Class"
              value={formatCurrency(data?.avgCostPerClass ?? 0)}
              subtitle="Average instructor cost per lecture"
              icon={<TrendingUp className="w-4 h-4 text-purple-500" />}
              loading={isLoading}
            />
            <MetricCard
              title="Total Paid to Instructors"
              value={formatCurrency(data?.totalTeacherPayments ?? 0)}
              subtitle="Sum of all instructor payments made"
              icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
              loading={isLoading}
              highlight="green"
            />
          </div>
          {(data?.instructorEarnings ?? []).filter(i => i.totalLectures > 0 || i.totalEarned > 0).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserCheck className="w-4 h-4 text-primary" />Instructor-wise Earnings</CardTitle>
                <CardDescription>Auto-calculated from attendance lectures and payment model</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Instructor</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Model</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Classes</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total Earned</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Total Paid</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.instructorEarnings ?? []).map(i => (
                        <tr key={i.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{i.name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">{i.paymentModel.replace("_", " ")}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-600">{i.totalLectures}</td>
                          <td className="px-4 py-3 text-right font-mono text-amber-600">{formatCurrency(i.totalEarned)}</td>
                          <td className="px-4 py-3 text-right font-mono text-green-600">{formatCurrency(i.totalPaid)}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">
                            <span className={i.pendingEarnings > 0 ? "text-red-600" : "text-muted-foreground"}>
                              {formatCurrency(i.pendingEarnings)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/20 font-semibold border-t-2">
                        <td className="px-4 py-3" colSpan={2}>Total</td>
                        <td className="px-4 py-3 text-right text-blue-600">{data?.totalClassesConducted ?? 0}</td>
                        <td className="px-4 py-3 text-right font-mono text-amber-600">{formatCurrency(data?.totalInstructorExpense ?? 0)}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-600">{formatCurrency(data?.totalTeacherPayments ?? 0)}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600">
                          {formatCurrency(Math.max(0, (data?.totalInstructorExpense ?? 0) - (data?.totalTeacherPayments ?? 0)))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Course breakdown table — only show when "All" selected */}
      {!isFiltered && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Course-wise Financials</CardTitle>
            <CardDescription>Students, monthly total, course total, collected, and remaining — per course</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? <div className="p-4"><SkeletonList /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Course</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Students</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Monthly Total</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Course Total</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Collected</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.courseBreakdown?.map((c) => (
                      <tr key={c.courseId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <div>{c.course}</div>
                          <div className="text-xs text-muted-foreground">{c.activeStudents} active / {c.totalStudents} total</div>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{c.totalStudents}</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(c.monthlyTotal)}</td>
                        <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400">{formatCurrency(c.courseTotal)}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-400">{formatCurrency(c.collected)}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(c.remaining)}</td>
                      </tr>
                    ))}
                    {!data?.courseBreakdown?.length && (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No course data found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voucher status summary — only show on "All" */}
        {!isFiltered && (
          <Card>
            <CardHeader>
              <CardTitle>Voucher Status</CardTitle>
              <CardDescription>Payment status across all generated vouchers</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <SkeletonList /> : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" /> Paid</div>
                    <span className="font-bold text-green-600">{data?.paidVouchers ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> Partial</div>
                    <span className="font-bold text-amber-600">{data?.partialVouchers ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> Unpaid</div>
                    <span className="font-bold text-red-600">{data?.unpaidVouchers ?? 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent receipts */}
        <Card className={isFiltered ? "lg:col-span-2" : ""}>
          <CardHeader>
            <CardTitle>Recent Receipts</CardTitle>
            <CardDescription>
              {isFiltered ? `Latest payments for ${selectedBatch?.className}` : "Latest recorded payments"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <SkeletonList /> : (
              <div className="space-y-3">
                {data?.recentReceipts?.map((receipt) => (
                  <div key={receipt.id} className="flex justify-between items-center text-sm border-b pb-3 last:border-0 last:pb-0">
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
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch("/reports/dashboard"),
    staleTime: 30_000,
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Monthly Expected Fees" value={data ? formatCurrency(data.monthlyExpectedFees) : undefined} subtitle="Active students' monthly fees" icon={<Banknote className="w-4 h-4 text-blue-500" />} loading={isLoading} highlight="blue" />
        <MetricCard title="Total Collected" value={data ? formatCurrency(data.totalCollected) : undefined} subtitle="All payments received" icon={<ArrowDownRight className="w-4 h-4 text-green-500" />} loading={isLoading} highlight="green" />
        <MetricCard title="Remaining Balance" value={data ? formatCurrency(data.totalRemainingBalance) : undefined} subtitle="Still outstanding" icon={<ArrowUpRight className="w-4 h-4 text-red-500" />} loading={isLoading} highlight="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Course Enrollment</CardTitle>
            <CardDescription>Students per course with monthly totals</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <SkeletonList /> : (
              <div className="space-y-4">
                {data?.courseBreakdown?.map((course) => (
                  <div key={course.courseId} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="font-medium text-sm">{course.course}</div>
                      <div className="text-xs text-muted-foreground">{formatCurrency(course.monthlyTotal)}/mo</div>
                    </div>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="My Classes" value={assignedClasses.length} subtitle="Assigned classes" icon={<School className="w-4 h-4 text-blue-500" />} loading={isLoading} />
        <MetricCard title="My Students" value={myStudents.length} subtitle="In my classes" icon={<Users className="w-4 h-4 text-primary" />} loading={isLoading} />
        <MetricCard title="Lectures This Month" value={presentThisMonth} subtitle="Check-ins this month" icon={<CheckCircle2 className="w-4 h-4 text-green-500" />} loading={isLoading} />
        <MetricCard title="Monthly Salary" value={formatCurrency(monthlySalary)} subtitle="Per month" icon={<Wallet className="w-4 h-4 text-purple-500" />} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      {assignedClasses.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Assigned Classes</CardTitle></CardHeader>
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
  const colors = { blue: "text-blue-600", green: "text-green-600", red: "text-red-600" };
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
  highlight?: "blue" | "green" | "red" | "amber";
}) {
  const bgMap = {
    blue: "bg-blue-50 dark:bg-blue-950/20",
    green: "bg-green-50 dark:bg-green-950/20",
    red: "bg-red-50 dark:bg-red-950/20",
    amber: "bg-amber-50 dark:bg-amber-950/20",
  };
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
