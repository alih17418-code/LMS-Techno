import React, { useState, useEffect } from "react";
import {
  useGetMonthlyReport, getGetMonthlyReportQueryKey,
  useGetClassWiseReport, getGetClassWiseReportQueryKey,
  useGetStudentWiseReport, getGetStudentWiseReportQueryKey,
  useGetReceiptReport, getGetReceiptReportQueryKey,
  useListCourses, getListCoursesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, getMonthName, getStatusColor } from "@/lib/utils";
import { AlertCircle, BarChart3, ChevronDown, ChevronRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthName(i + 1) }));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export default function Reports() {
  const [tab, setTab] = useState("monthly");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All figures calculated directly from vouchers and receipts. Total Fee Generated = Total Received + Total Pending.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full max-w-2xl">
          <TabsTrigger value="monthly" className="flex-1">Monthly</TabsTrigger>
          <TabsTrigger value="classwise" className="flex-1">Class-wise</TabsTrigger>
          <TabsTrigger value="studentwise" className="flex-1">Student-wise</TabsTrigger>
          <TabsTrigger value="receipts" className="flex-1">Receipts</TabsTrigger>
          <TabsTrigger value="instructor-earnings" className="flex-1">Instructor Earnings</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-6"><MonthlyReport /></TabsContent>
        <TabsContent value="classwise" className="mt-6"><ClassWiseReport /></TabsContent>
        <TabsContent value="studentwise" className="mt-6"><StudentWiseReport /></TabsContent>
        <TabsContent value="receipts" className="mt-6"><ReceiptReport /></TabsContent>
        <TabsContent value="instructor-earnings" className="mt-6"><InstructorEarningsReport /></TabsContent>
      </Tabs>
    </div>
  );
}

function useCourses() {
  return useListCourses({ query: { queryKey: getListCoursesQueryKey() } });
}

function MonthlyReport() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [courseId, setCourseId] = useState<string>("all");
  const { data: courses } = useCourses();

  const params: any = { month, year };
  if (courseId !== "all") params.courseId = Number(courseId);

  const { data, isLoading, error } = useGetMonthlyReport(params, {
    query: { queryKey: getGetMonthlyReportQueryKey(params) },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Month</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Course</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Courses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : error ? (
        <div className="p-6 text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Failed to load report.</div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Total Students" value={data.totalStudents} />
            <SummaryCard label="Fee Generated" value={formatCurrency(data.totalFeeGenerated)} />
            <SummaryCard label="Received" value={formatCurrency(data.totalReceived)} color="green" />
            <SummaryCard label="Pending" value={formatCurrency(data.totalPending)} color="red" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
              <div className="text-xl font-bold text-green-700 dark:text-green-400">{data.paidCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Paid</div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-center">
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400">{data.partialCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Partial</div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
              <div className="text-xl font-bold text-red-700 dark:text-red-400">{data.unpaidCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Unpaid</div>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voucher Details — {data.monthName} {data.year}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Fee</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Received</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pending</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vouchers?.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No vouchers for this period.</td></tr>
                    )}
                    {data.vouchers?.map((v) => (
                      <tr key={v.id} className="border-b border-border hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{v.studentName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.studentCode}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">{v.course}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(v.totalFee)}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-500">{formatCurrency(v.totalReceived)}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(v.pendingAmount)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", getStatusColor(v.status))}>{v.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ClassWiseReport() {
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [year, setYear] = useState<number | undefined>(undefined);

  const params: any = {};
  if (month) params.month = month;
  if (year) params.year = year;

  const { data, isLoading, error } = useGetClassWiseReport(params, {
    query: { queryKey: getGetClassWiseReportQueryKey(params) },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Month (optional)</Label>
          <Select value={String(month ?? "all")} onValueChange={(v) => setMonth(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Months" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Year (optional)</Label>
          <Select value={String(year ?? "all")} onValueChange={(v) => setYear(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-28"><SelectValue placeholder="All Years" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : error ? (
        <div className="p-6 text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Failed to load report.</div>
      ) : (
        <div className="space-y-4">
          {data?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No data found for selected period.
            </div>
          )}
          {data?.map((course) => (
            <Card key={course.course + course.courseId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{course.course}</CardTitle>
                  <span className="text-sm text-muted-foreground">{course.totalStudents} students</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <SummaryCard label="Fee Generated" value={formatCurrency(course.totalFeeGenerated)} />
                  <SummaryCard label="Received" value={formatCurrency(course.totalReceived)} color="green" />
                  <SummaryCard label="Pending" value={formatCurrency(course.totalPending)} color="red" />
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm font-semibold">
                      <span className="text-green-600 dark:text-green-500">{course.paidCount}</span>
                      {" / "}
                      <span className="text-amber-500">{course.partialCount}</span>
                      {" / "}
                      <span className="text-red-500">{course.unpaidCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Paid / Partial / Unpaid</div>
                  </div>
                </div>
                {course.totalFeeGenerated > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Collection rate</span>
                      <span>{Math.round((course.totalReceived / course.totalFeeGenerated) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="bg-green-500 h-full transition-all"
                        style={{ width: `${(course.totalReceived / course.totalFeeGenerated) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentWiseReport() {
  const [courseId, setCourseId] = useState<string>("all");
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<string>("all");
  const { data: courses } = useCourses();

  const params: any = {};
  if (courseId !== "all") params.courseId = Number(courseId);
  if (month) params.month = month;
  if (year) params.year = year;
  if (status !== "all") params.status = status;

  const { data, isLoading, error } = useGetStudentWiseReport(params, {
    query: { queryKey: getGetStudentWiseReportQueryKey(params) },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Course</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Courses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Month</Label>
          <Select value={String(month ?? "all")} onValueChange={(v) => setMonth(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Months" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Select value={String(year ?? "all")} onValueChange={(v) => setYear(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-28"><SelectValue placeholder="All Years" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          : error ? <div className="p-6 text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Failed to load report.</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Fee</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Received</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pending</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                      <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No data found.
                    </td></tr>
                  )}
                  {data?.map((row) => (
                    <tr key={row.studentId} className="border-b border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs text-primary font-bold">{row.studentCode}</td>
                      <td className="px-4 py-3 font-medium">{row.studentName}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">{row.course}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.totalFee)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-500">{formatCurrency(row.totalReceived)}</td>
                      <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(row.totalPending)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", getStatusColor(row.status))}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReceiptReport() {
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [courseId, setCourseId] = useState<string>("all");
  const { data: courses } = useCourses();

  const params: any = {};
  if (month) params.month = month;
  if (year) params.year = year;
  if (courseId !== "all") params.courseId = Number(courseId);

  const { data, isLoading, error } = useGetReceiptReport(params, {
    query: { queryKey: getGetReceiptReportQueryKey(params) },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Month</Label>
          <Select value={String(month ?? "all")} onValueChange={(v) => setMonth(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Months" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Select value={String(year ?? "all")} onValueChange={(v) => setYear(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-28"><SelectValue placeholder="All Years" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Course</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Courses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          : error ? <div className="p-6 text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Failed to load report.</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Receipt No</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">No receipts found.</td></tr>
                  )}
                  {data?.map((row, i) => (
                    <tr key={row.receiptNumber + i} className="border-b border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs text-primary">{row.receiptNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.studentName}</div>
                        <div className="text-xs font-mono text-muted-foreground">{row.studentCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">{row.course}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.monthName} {row.year}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-green-600 dark:text-green-500">{formatCurrency(row.amountReceived)}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{row.paymentMethod.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(row.paymentDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type EarningsMonthRow = {
  month: number; year: number; monthName: string;
  lecturesDelivered: number; earned: number; paid: number; balance: number;
};
type EarningsInstructor = {
  instructorId: number; instructorCode: string; instructorName: string;
  courseName: string | null; paymentModel: string;
  lectureRate: number; commissionPercent: number; monthlySalary: number; status: string;
  months: EarningsMonthRow[];
  totalLectures: number; totalEarned: number; totalPaid: number; totalBalance: number;
};
type EarningsReport = {
  summary: { totalInstructors: number; totalEarned: number; totalPaid: number; totalBalance: number };
  instructors: EarningsInstructor[];
};

const MODEL_LABEL: Record<string, string> = {
  salary: "Monthly Salary", per_lecture: "Per Lecture", commission: "Commission",
};
const MODEL_COLOR: Record<string, string> = {
  salary: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-800",
  per_lecture: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-800",
  commission: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800",
};

function InstructorEarningsReport() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [courseId, setCourseId] = useState<string>("all");
  const [paymentModel, setPaymentModel] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [data, setData] = useState<EarningsReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const { data: courses } = useCourses();

  useEffect(() => {
    setIsLoading(true);
    setError(false);
    const params = new URLSearchParams({ year: String(year) });
    if (month) params.set("month", String(month));
    if (courseId !== "all") params.set("courseId", courseId);
    if (paymentModel !== "all") params.set("paymentModel", paymentModel);
    fetch(`${BASE}api/reports/instructor-earnings?${params}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setData(d); setIsLoading(false); })
      .catch(() => { setError(true); setIsLoading(false); });
  }, [year, month, courseId, paymentModel]);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Year <span className="text-destructive">*</span></Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Month (optional)</Label>
          <Select value={String(month ?? "all")} onValueChange={(v) => setMonth(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Months" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Course</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Courses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Payment Model</Label>
          <Select value={paymentModel} onValueChange={setPaymentModel}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              <SelectItem value="salary">Monthly Salary</SelectItem>
              <SelectItem value="per_lecture">Per Lecture</SelectItem>
              <SelectItem value="commission">Commission</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : error ? (
        <div className="p-6 text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Failed to load report.</div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Instructors" value={data.summary.totalInstructors} />
            <SummaryCard label="Total Earned" value={formatCurrency(data.summary.totalEarned)} color="green" />
            <SummaryCard label="Total Paid" value={formatCurrency(data.summary.totalPaid)} color="green" />
            <SummaryCard label="Outstanding Balance" value={formatCurrency(data.summary.totalBalance)} color={data.summary.totalBalance > 0 ? "red" : undefined} />
          </div>

          {data.instructors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No instructor data found for the selected filters.
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="w-8 px-3 py-3"></th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Instructor</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Model</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground">Lectures</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Earned</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Paid</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.instructors.map((inst) => (
                        <React.Fragment key={inst.instructorId}>
                          <tr
                            className="border-b border-border hover:bg-muted/20 cursor-pointer"
                            onClick={() => toggleExpand(inst.instructorId)}
                          >
                            <td className="px-3 py-3 text-muted-foreground">
                              {expanded.has(inst.instructorId)
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{inst.instructorCode}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{inst.instructorName}</div>
                              <div className={cn("text-xs mt-0.5", inst.status === "active" ? "text-green-600" : "text-muted-foreground")}>{inst.status}</div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{inst.courseName ?? "—"}</td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", MODEL_COLOR[inst.paymentModel] ?? MODEL_COLOR.salary)}>
                                {MODEL_LABEL[inst.paymentModel] ?? inst.paymentModel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold">
                              {inst.paymentModel === "per_lecture" ? inst.totalLectures : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(inst.totalEarned)}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-green-600 dark:text-green-500">{formatCurrency(inst.totalPaid)}</td>
                            <td className={cn("px-4 py-3 text-right font-mono font-semibold", inst.totalBalance > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                              {formatCurrency(inst.totalBalance)}
                            </td>
                          </tr>
                          {expanded.has(inst.instructorId) && inst.months.map((m) => (
                            <tr key={`${inst.instructorId}-${m.month}`} className="bg-muted/10 border-b border-border/50">
                              <td className="px-3 py-2"></td>
                              <td className="px-4 py-2 text-muted-foreground text-xs" colSpan={3}>
                                <span className="pl-4 font-medium text-foreground">{m.monthName} {m.year}</span>
                              </td>
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2 text-center text-xs font-mono">
                                {inst.paymentModel === "per_lecture" ? m.lecturesDelivered : "—"}
                              </td>
                              <td className="px-4 py-2 text-right text-xs font-mono text-blue-600 dark:text-blue-400">{formatCurrency(m.earned)}</td>
                              <td className="px-4 py-2 text-right text-xs font-mono text-green-600 dark:text-green-500">{formatCurrency(m.paid)}</td>
                              <td className={cn("px-4 py-2 text-right text-xs font-mono", m.balance > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                                {formatCurrency(m.balance)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                      <tr className="bg-muted/30 font-semibold border-t-2 border-border">
                        <td colSpan={6} className="px-4 py-3">Totals</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(data.summary.totalEarned)}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-500">{formatCurrency(data.summary.totalPaid)}</td>
                        <td className={cn("px-4 py-3 text-right font-mono", data.summary.totalBalance > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                          {formatCurrency(data.summary.totalBalance)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: "green" | "red" }) {
  return (
    <div className="p-4 bg-muted/30 rounded-lg border border-border">
      <div className={cn(
        "text-lg font-bold",
        color === "green" && "text-green-600 dark:text-green-500",
        color === "red" && "text-red-600 dark:text-red-400",
      )}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
