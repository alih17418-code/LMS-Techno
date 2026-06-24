import { useParams, Link } from "wouter";
import { useGetStudentLedger, getGetStudentLedgerQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, getStatusColor } from "@/lib/utils";
import { ArrowLeft, AlertCircle, User, Printer } from "lucide-react";
import { printLedger } from "@/lib/printLedger";

export default function StudentLedger() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);

  const { data: ledger, isLoading, error } = useGetStudentLedger(studentId, {
    query: { enabled: !!studentId, queryKey: getGetStudentLedgerQueryKey(studentId) },
  });

  function handlePrint() {
    if (!ledger) return;
    printLedger({
      student: {
        name: ledger.student.name,
        studentCode: ledger.student.studentCode,
        course: ledger.student.course,
        fatherName: ledger.student.fatherName ?? undefined,
        phone: ledger.student.phone ?? undefined,
        enrollmentDate: ledger.student.enrollmentDate ?? undefined,
        endDate: ledger.student.endDate ?? undefined,
        status: ledger.student.status,
      },
      entries: ledger.entries.map((e) => ({
        monthName: e.monthName,
        year: e.year,
        fee: e.fee,
        received: e.received,
        pending: e.pending,
        status: e.status,
      })),
      totalFee: ledger.totalFee,
      totalReceived: ledger.totalReceived,
      totalPending: ledger.totalPending,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/students">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Students
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Student Ledger</h1>
            <p className="text-sm text-muted-foreground mt-1">Complete month-by-month financial history.</p>
          </div>
        </div>
        {ledger && (
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Print Statement
          </Button>
        )}
      </div>

      {error && (
        <div className="p-6 text-center text-destructive flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" /> Failed to load ledger.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : ledger && (
        <>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{ledger.student.name}</h2>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                    <span>Code: <strong className="text-foreground font-mono">{ledger.student.studentCode}</strong></span>
                    <span>Course: <strong className="text-foreground">{ledger.student.course}</strong></span>
                    {ledger.student.fatherName && <span>Father: <strong className="text-foreground">{ledger.student.fatherName}</strong></span>}
                    {ledger.student.phone && <span>Phone: <strong className="text-foreground">{ledger.student.phone}</strong></span>}
                    {ledger.student.enrollmentDate && <span>Enrolled: <strong className="text-foreground">{ledger.student.enrollmentDate}</strong></span>}
                    {ledger.student.endDate && <span>Ends: <strong className="text-foreground">{ledger.student.endDate}</strong></span>}
                  </div>
                </div>
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", getStatusColor(ledger.student.status))}>
                  {ledger.student.status}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold">{formatCurrency(ledger.totalFee)}</div>
                <div className="text-sm text-muted-foreground mt-1">Total Fee Generated</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-500">{formatCurrency(ledger.totalReceived)}</div>
                <div className="text-sm text-muted-foreground mt-1">Total Received</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(ledger.totalPending)}</div>
                <div className="text-sm text-muted-foreground mt-1">Total Pending</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Breakdown</CardTitle>
              <CardDescription>
                Voucher status by month. Formula: Pending = Total Fee − Total Received
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {ledger.entries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No vouchers generated for this student yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Month</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Year</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Fee</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Received</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pending</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.entries.map((e) => (
                        <tr key={`${e.year}-${e.month}`} className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{e.monthName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{e.year}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(e.fee)}</td>
                          <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-500">{formatCurrency(e.received)}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(e.pending)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", getStatusColor(e.status))}>
                              {e.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/20 font-semibold">
                        <td className="px-4 py-3" colSpan={2}>Total</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(ledger.totalFee)}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-500">{formatCurrency(ledger.totalReceived)}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(ledger.totalPending)}</td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
