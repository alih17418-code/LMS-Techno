import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, getMonthName } from "@/lib/utils";
import { Users, Banknote, CreditCard, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { showFinancials } = useAuth();
  const { data, isLoading, error } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  if (error) {
    return (
      <div className="p-8 text-center bg-destructive/10 rounded-lg border border-destructive/20 text-destructive">
        <AlertCircle className="w-8 h-8 mx-auto mb-3" />
        <h2 className="text-lg font-bold">Failed to load dashboard</h2>
        <p className="text-sm mt-1">{error?.message || "Unknown error"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time status and metrics.</p>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${showFinancials ? "lg:grid-cols-4" : "lg:grid-cols-2"} gap-4`}>
        <MetricCard
          title="Total Students"
          value={data?.totalStudents}
          subtitle={`${data?.activeStudents || 0} active`}
          icon={<Users className="w-4 h-4 text-primary" />}
          loading={isLoading}
        />
        {showFinancials ? (
          <>
            <MetricCard
              title="Total Generated"
              value={data?.totalFeeGenerated ? formatCurrency(data.totalFeeGenerated) : undefined}
              subtitle="All time fee generated"
              icon={<Banknote className="w-4 h-4 text-blue-500" />}
              loading={isLoading}
            />
            <MetricCard
              title="Total Received"
              value={data?.totalReceived ? formatCurrency(data.totalReceived) : undefined}
              subtitle="All time fee collected"
              icon={<ArrowDownRight className="w-4 h-4 text-green-500" />}
              loading={isLoading}
            />
            <MetricCard
              title="Total Pending"
              value={data?.totalPending ? formatCurrency(data.totalPending) : undefined}
              subtitle="Outstanding balance"
              icon={<ArrowUpRight className="w-4 h-4 text-red-500" />}
              loading={isLoading}
            />
          </>
        ) : (
          <MetricCard
            title="Active Courses"
            value={data?.courseBreakdown?.length}
            subtitle="Courses with enrolled students"
            icon={<CreditCard className="w-4 h-4 text-purple-500" />}
            loading={isLoading}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Course Breakdown</CardTitle>
            <CardDescription>Enrollment and collection status across active courses</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                {data?.courseBreakdown?.map((course) => (
                  <div key={course.course} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium">{course.course}</div>
                      {showFinancials && (
                        <div className="text-muted-foreground">
                          {formatCurrency(course.totalReceived)} / {formatCurrency(course.totalFeeGenerated)}
                        </div>
                      )}
                    </div>
                    {showFinancials && (
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex">
                        <div
                          className="bg-green-500 h-full transition-all"
                          style={{ width: `${course.totalFeeGenerated ? (course.totalReceived / course.totalFeeGenerated) * 100 : 0}%` }}
                        />
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{course.totalStudents} students</span>
                      <span>{course.paidCount} paid, {course.unpaidCount} unpaid</span>
                    </div>
                  </div>
                ))}
                {data?.courseBreakdown?.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">No courses found.</div>
                )}
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
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {data?.recentReceipts?.map((receipt) => (
                  <div key={receipt.id} className="flex justify-between items-center text-sm border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-foreground">{receipt.studentName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{receipt.course} • {getMonthName(receipt.month)} {receipt.year}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600 dark:text-green-500">{formatCurrency(receipt.amountReceived)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{new Date(receipt.paymentDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
                {data?.recentReceipts?.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">No recent receipts.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, loading }: { title: string; value?: string | number; subtitle?: string; icon: React.ReactNode; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24 mb-1" />
        ) : (
          <div className="text-2xl font-bold text-foreground">{value ?? 0}</div>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
