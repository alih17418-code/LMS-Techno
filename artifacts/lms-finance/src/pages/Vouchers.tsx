import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListVouchers, getListVouchersQueryKey,
  useGenerateVouchers, useDeleteVoucher,
  useGetVoucher, getGetVoucherQueryKey,
  useListCourses, getListCoursesQueryKey,
} from "@workspace/api-client-react";
import type { Voucher, GenerateVouchersInput } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, getMonthName, getStatusColor } from "@/lib/utils";
import { Plus, Trash2, FileText, AlertCircle, CheckCircle2, XCircle, SkipForward, Eye, Printer, Search, X } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { printVoucher } from "@/lib/printVoucher";
import { useAuth } from "@/hooks/use-auth";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthName(i + 1) }));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export default function Vouchers() {
  const qc = useQueryClient();
  const { canDelete } = useAuth();
  const [filters, setFilters] = useState<{ courseId?: number; month?: number; year?: number; status?: string }>({});
  const [showGenerate, setShowGenerate] = useState(false);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Voucher | null>(null);
  const [generateResult, setGenerateResult] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: courses } = useListCourses({ query: { queryKey: getListCoursesQueryKey() } });

  const params: Record<string, any> = {};
  if (filters.courseId) params.courseId = filters.courseId;
  if (filters.month) params.month = filters.month;
  if (filters.year) params.year = filters.year;
  if (filters.status) params.status = filters.status;

  const { data: vouchers, isLoading, error } = useListVouchers(params, {
    query: { queryKey: getListVouchersQueryKey(params) },
  });

  const generateMutation = useGenerateVouchers();
  const deleteMutation = useDeleteVoucher();

  // Client-side search by Voucher ID, Student Code, or Name
  const searchTerm = search.trim().toLowerCase();
  const filtered = searchTerm
    ? vouchers?.filter(v => {
        const idMatch = String(v.id).includes(searchTerm);
        const codeMatch = (v.studentCode ?? "").toLowerCase().includes(searchTerm);
        const nameMatch = (v.studentName ?? "").toLowerCase().includes(searchTerm);
        return idMatch || codeMatch || nameMatch;
      })
    : vouchers;

  function handleDelete() {
    if (!deleteConfirm) return;
    deleteMutation.mutate({ id: deleteConfirm.id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVouchersQueryKey() });
        setDeleteConfirm(null);
      },
      onError: (e: any) => {
        alert(e?.data?.message ?? "Failed to delete voucher");
        setDeleteConfirm(null);
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vouchers</h1>
          <p className="text-sm text-muted-foreground mt-1">Monthly fee vouchers. Discounts applied per student. Duplicates auto-skipped.</p>
        </div>
        <Button onClick={() => setShowGenerate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Generate Vouchers
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Voucher ID (#13), Student Code (100001), or Student Name…"
              className="pl-9 pr-9"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Select value={String(filters.courseId ?? "all")} onValueChange={(v) => setFilters(f => ({ ...f, courseId: v === "all" ? undefined : Number(v) }))}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Courses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(filters.month ?? "all")} onValueChange={(v) => setFilters(f => ({ ...f, month: v === "all" ? undefined : Number(v) }))}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Months" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(filters.year ?? "all")} onValueChange={(v) => setFilters(f => ({ ...f, year: v === "all" ? undefined : Number(v) }))}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.status ?? "all"} onValueChange={(v) => setFilters(f => ({ ...f, status: v === "all" ? undefined : v }))}>
              <SelectTrigger className="w-32"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            {(filters.courseId || filters.month || filters.year || filters.status) && (
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setFilters({})}>
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
            <span className="ml-auto text-sm text-muted-foreground">
              {filtered?.length ?? 0} voucher{filtered?.length !== 1 ? "s" : ""}
              {searchTerm ? ` matching "${search}"` : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-6 text-center text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" /> Failed to load vouchers.
            </div>
          )}
          {isLoading ? (
            <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-16">#ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Fee</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Received</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pending</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered?.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      {searchTerm ? `No vouchers matching "${search}"` : "No vouchers found."}
                    </td></tr>
                  )}
                  {filtered?.map((v) => (
                    <tr key={v.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          #{v.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{v.studentName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{v.studentCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          {v.course}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{v.monthName} {v.year}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(v.totalFee)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600 dark:text-green-500">{formatCurrency(v.totalReceived)}</td>
                      <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(v.pendingAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", getStatusColor(v.status))}>
                          {v.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="sm" className="h-7 w-7 p-0"
                            title="Print voucher slip"
                            onClick={() => printVoucher(v)}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View detail" onClick={() => setShowDetail(v.id)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              title="Delete voucher"
                              onClick={() => setDeleteConfirm(v)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <GenerateDialog
        open={showGenerate}
        onClose={() => { setShowGenerate(false); setGenerateResult(null); }}
        onSuccess={(result) => {
          setGenerateResult(result);
          qc.invalidateQueries({ queryKey: getListVouchersQueryKey() });
        }}
        mutation={generateMutation}
        result={generateResult}
        courses={courses ?? []}
      />

      {showDetail && (
        <VoucherDetailDialog id={showDetail} onClose={() => setShowDetail(null)} />
      )}

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Voucher</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete voucher <strong>#{deleteConfirm?.id}</strong> for <strong>{deleteConfirm?.studentName}</strong> ({deleteConfirm?.monthName} {deleteConfirm?.year})?
            Only possible if no payments have been recorded.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GenerateDialog({ open, onClose, onSuccess, mutation, result, courses }: {
  open: boolean; onClose: () => void;
  onSuccess: (r: any) => void;
  mutation: ReturnType<typeof useGenerateVouchers>;
  result: any;
  courses: import("@workspace/api-client-react").Course[];
}) {
  const { handleSubmit, control } = useForm<GenerateVouchersInput>({
    defaultValues: { courseId: courses[0]?.id, month: new Date().getMonth() + 1, year: new Date().getFullYear() },
  });

  function onSubmit(data: GenerateVouchersInput) {
    mutation.mutate({ data: { ...data, courseId: Number(data.courseId), month: Number(data.month), year: Number(data.year) } }, { onSuccess });
  }

  const apiError = (mutation.error as any)?.data?.message;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Monthly Vouchers</DialogTitle>
          <p className="text-sm text-muted-foreground">Generates vouchers for all active students in the selected course. Per-student discounts applied automatically.</p>
        </DialogHeader>
        {result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">{result.generated}</div>
                <div className="text-xs text-green-600 dark:text-green-500 mt-1">Generated</div>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{result.skipped}</div>
                <div className="text-xs text-amber-600 dark:text-amber-500 mt-1">Skipped</div>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">{result.errors}</div>
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">Errors</div>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {result.details?.map((d: any) => (
                <div key={d.studentId} className="flex items-center gap-2 text-sm px-2 py-1 rounded">
                  {d.status === "generated" && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                  {d.status === "skipped" && <SkipForward className="w-4 h-4 text-amber-500 shrink-0" />}
                  {d.status === "error" && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                  <span className="font-mono text-xs text-muted-foreground">{d.studentCode}</span>
                  <span className="font-medium">{d.studentName}</span>
                  {d.reason && <span className="text-muted-foreground text-xs ml-auto">— {d.reason}</span>}
                </div>
              ))}
            </div>
            <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {apiError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">{apiError}</div>
            )}
            <div className="space-y-1.5">
              <Label>Course *</Label>
              <Controller name="courseId" control={control} render={({ field }) => (
                <Select value={String(field.value ?? "")} onValueChange={(v) => field.onChange(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                  <SelectContent>
                    {courses.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Month *</Label>
                <Controller name="month" control={control} render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Year *</Label>
                <Controller name="year" control={control} render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Generating..." : "Generate Vouchers"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VoucherDetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: voucher, isLoading } = useGetVoucher(id, {
    query: { queryKey: getGetVoucherQueryKey(id) },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Voucher Detail
            {voucher && <span className="ml-2 text-sm font-normal text-muted-foreground font-mono">#{voucher.id}</span>}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? <Skeleton className="h-40 w-full" /> : voucher && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Student:</span> <strong>{voucher.studentName}</strong></div>
              <div><span className="text-muted-foreground">Code:</span> <strong className="font-mono">{voucher.studentCode}</strong></div>
              <div><span className="text-muted-foreground">Course:</span> <strong>{voucher.course}</strong></div>
              <div><span className="text-muted-foreground">Period:</span> <strong>{voucher.monthName} {voucher.year}</strong></div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-lg font-bold">{formatCurrency(voucher.totalFee)}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Fee</div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(voucher.totalReceived)}</div>
                <div className="text-xs text-muted-foreground mt-1">Received</div>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="text-lg font-bold text-red-700 dark:text-red-400">{formatCurrency(voucher.pendingAmount)}</div>
                <div className="text-xs text-muted-foreground mt-1">Pending</div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-sm mb-2">Receipts ({voucher.receipts?.length ?? 0})</h3>
              {voucher.receipts?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Receipt No</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Method</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voucher.receipts?.map((r) => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="py-2 font-mono text-xs">{r.receiptNumber}</td>
                        <td className="py-2">{new Date(r.paymentDate).toLocaleDateString()}</td>
                        <td className="py-2 capitalize">{r.paymentMethod.replace("_", " ")}</td>
                        <td className="py-2 text-right font-mono text-green-600 dark:text-green-500">{formatCurrency(r.amountReceived)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          {voucher && (
            <Button variant="outline" className="gap-2" onClick={() => printVoucher(voucher)}>
              <Printer className="w-4 h-4" /> Print Slip
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
