import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListReceipts, getListReceiptsQueryKey,
  useCreateReceipt,
  useListVouchers, getListVouchersQueryKey,
} from "@workspace/api-client-react";
import type { Receipt } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, getMonthName } from "@/lib/utils";
import { Plus, Receipt as ReceiptIcon, AlertCircle, Printer, Search, X, ArrowRight, CheckCircle2 } from "lucide-react";
import { printReceipt } from "@/lib/printReceipt";
import { useAuth } from "@/hooks/use-auth";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthName(i + 1) }));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "online"] as const;

export default function Receipts() {
  const qc = useQueryClient();
  const { showFinancials } = useAuth();
  const [filters, setFilters] = useState<{ month?: number; year?: number }>({});
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const createMutation = useCreateReceipt();

  const params: Record<string, any> = {};
  if (filters.month) params.month = filters.month;
  if (filters.year) params.year = filters.year;

  const { data: receipts, isLoading, error } = useListReceipts(params, {
    query: { queryKey: getListReceiptsQueryKey(params) },
  });

  const searchTerm = search.trim().toLowerCase();
  const filtered = searchTerm
    ? receipts?.filter(r =>
        r.studentName?.toLowerCase().includes(searchTerm) ||
        r.studentCode?.toLowerCase().includes(searchTerm) ||
        r.receiptNumber?.toLowerCase().includes(searchTerm)
      )
    : receipts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receipts</h1>
          <p className="text-sm text-muted-foreground mt-1">Payment history. Each payment creates a separate receipt with a unique number.</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Record Payment
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Student Name, Student Code, or Receipt No…"
              className="pl-9 pr-9"
            />
            {search && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
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
            {(filters.month || filters.year) && (
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setFilters({})}>
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
            <span className="ml-auto text-sm text-muted-foreground">
              {filtered?.length ?? 0} receipt{filtered?.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-6 text-center text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" /> Failed to load receipts.
            </div>
          )}
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Receipt No</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                    {showFinancials && <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>}
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Remarks</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Print</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered?.length === 0 && (
                    <tr><td colSpan={showFinancials ? 9 : 8} className="text-center py-12 text-muted-foreground">
                      <ReceiptIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      {searchTerm ? `No receipts matching "${search}"` : "No receipts found."}
                    </td></tr>
                  )}
                  {filtered?.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-primary font-bold">{r.receiptNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.studentName}</div>
                        <div className="text-xs font-mono text-muted-foreground">{r.studentCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          {r.course}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{getMonthName(r.month)} {r.year}</td>
                      {showFinancials && (
                        <td className="px-4 py-3 text-right font-mono font-semibold text-green-600 dark:text-green-500">{formatCurrency(r.amountReceived)}</td>
                      )}
                      <td className="px-4 py-3 capitalize text-muted-foreground">{r.paymentMethod.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(r.paymentDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{r.remarks ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Print receipt" onClick={() => printReceipt(r)}>
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RecordPaymentDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onSuccess={(receipt) => {
          qc.invalidateQueries({ queryKey: getListReceiptsQueryKey() });
          qc.invalidateQueries({ queryKey: getListVouchersQueryKey() });
          setShowDialog(false);
          if (receipt) printReceipt(receipt);
        }}
        mutation={createMutation}
      />
    </div>
  );
}

type Step = "search" | "confirm";

function RecordPaymentDialog({
  open, onClose, onSuccess, mutation,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (receipt?: Receipt) => void;
  mutation: ReturnType<typeof useCreateReceipt>;
}) {
  const [step, setStep] = useState<Step>("search");
  const [searchInput, setSearchInput] = useState("");
  const [selectedVoucherId, setSelectedVoucherId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [amountError, setAmountError] = useState("");

  const { data: unpaidVouchers } = useListVouchers({ status: "unpaid" }, {
    query: { queryKey: getListVouchersQueryKey({ status: "unpaid" }) },
  });
  const { data: partialVouchers } = useListVouchers({ status: "partial" }, {
    query: { queryKey: getListVouchersQueryKey({ status: "partial" }) },
  });

  const allPending = [...(unpaidVouchers ?? []), ...(partialVouchers ?? [])];
  const selectedVoucher = allPending.find(v => v.id === selectedVoucherId) ?? null;

  const searchTerm = searchInput.trim().toLowerCase();
  const matchedVouchers = searchTerm
    ? allPending.filter(v =>
        String(v.id).includes(searchTerm) ||
        (v.studentCode ?? "").toLowerCase().includes(searchTerm) ||
        (v.studentName ?? "").toLowerCase().includes(searchTerm)
      )
    : [];

  function selectVoucher(id: number) {
    const v = allPending.find(x => x.id === id);
    setSelectedVoucherId(id);
    setAmount(String(v?.pendingAmount ?? ""));
    setStep("confirm");
    setAmountError("");
  }

  function handleClose() {
    setStep("search");
    setSearchInput("");
    setSelectedVoucherId(null);
    setAmount("");
    setPaymentMethod("cash");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setRemarks("");
    setAmountError("");
    onClose();
  }

  function handleBack() {
    setStep("search");
    setSelectedVoucherId(null);
    setAmountError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVoucher) return;
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) { setAmountError("Enter a valid amount"); return; }
    if (amountNum > selectedVoucher.pendingAmount) {
      setAmountError(`Cannot exceed pending balance (${formatCurrency(selectedVoucher.pendingAmount)})`);
      return;
    }
    setAmountError("");
    mutation.mutate(
      { data: { voucherId: selectedVoucher.id, amountReceived: amountNum, paymentMethod, paymentDate, remarks: remarks || undefined } },
      { onSuccess: (receipt) => onSuccess(receipt) }
    );
  }

  const apiError = (mutation.error as any)?.data?.message;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            {step === "search"
              ? "Search by Voucher ID, Student Code, or Name to find the pending voucher."
              : "Review and confirm the payment below."}
          </DialogDescription>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="e.g. 13  or  100001  or  Ali Khan…"
                className="pl-9"
              />
            </div>

            {searchTerm.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Type a Voucher ID, Student Code, or Name to search
              </div>
            )}

            {searchTerm.length > 0 && matchedVouchers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <ReceiptIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No pending vouchers found for "{searchInput}"
              </div>
            )}

            {matchedVouchers.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {matchedVouchers.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectVoucher(v.id)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/60 hover:bg-muted/30 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                          #{v.id}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{v.studentName}</div>
                          <div className="text-xs text-muted-foreground truncate">{v.studentCode} · {v.course} · {v.monthName} {v.year}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(v.pendingAmount)}</div>
                        <div className="text-xs text-muted-foreground">pending</div>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Select to pay <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {apiError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {apiError}
              </div>
            )}

            {selectedVoucher && (
              <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selectedVoucher.studentName}</span>
                  <span className="font-mono text-xs text-primary font-bold">Voucher #{selectedVoucher.id}</span>
                </div>
                <div className="text-xs text-muted-foreground">{selectedVoucher.studentCode} · {selectedVoucher.course} · {selectedVoucher.monthName} {selectedVoucher.year}</div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="p-2 bg-background rounded border border-border">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Fee</div>
                    <div className="font-mono font-semibold text-xs mt-0.5">{formatCurrency(selectedVoucher.totalFee)}</div>
                  </div>
                  <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-900">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Received</div>
                    <div className="font-mono font-semibold text-xs mt-0.5 text-green-600 dark:text-green-400">{formatCurrency(selectedVoucher.totalReceived)}</div>
                  </div>
                  <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-900">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</div>
                    <div className="font-mono font-semibold text-xs mt-0.5 text-red-600 dark:text-red-400">{formatCurrency(selectedVoucher.pendingAmount)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Amount (PKR) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => { setAmount(e.target.value); setAmountError(""); }}
                placeholder="Enter amount..."
                autoFocus
              />
              {amountError && <p className="text-xs text-destructive">{amountError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m} value={m}>
                        {m.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Date *</Label>
                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional notes..." />
            </div>

            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <Printer className="w-3.5 h-3.5 shrink-0" />
              Receipt slip will open for printing automatically after recording.
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleBack} className="mr-auto">← Back</Button>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="gap-2">
                {mutation.isPending ? (
                  <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Recording...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Record & Print</>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
