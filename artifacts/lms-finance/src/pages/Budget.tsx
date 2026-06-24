import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { PlusCircle, Trash2, TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type Entry = {
  id: number; type: string; amount: number; description: string;
  category?: string; entryDate: string; balanceAfter: number;
};
type Summary = { totalIncome: number; totalExpense: number; balance: number; entryCount: number };

const CATEGORIES = {
  income: ["Fee Collection", "Donation", "Grant", "Other Income"],
  expense: ["Salary", "Rent", "Utilities", "Equipment", "Marketing", "Office Supplies", "Maintenance", "Other Expense"],
};

export default function Budget() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [form, setForm] = useState({ type: "income", amount: "", description: "", category: "" });

  const { data: entries = [], isLoading } = useQuery<Entry[]>({
    queryKey: ["budget"],
    queryFn: () => apiFetch("/budget"),
  });
  const { data: summary } = useQuery<Summary>({
    queryKey: ["budget-summary"],
    queryFn: () => apiFetch("/budget/summary"),
  });

  const add = useMutation({
    mutationFn: (body: typeof form) => apiFetch("/budget", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget"] });
      qc.invalidateQueries({ queryKey: ["budget-summary"] });
      setOpen(false);
      setForm({ type: "income", amount: "", description: "", category: "" });
      toast({ title: "Entry added successfully" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/budget/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget"] });
      qc.invalidateQueries({ queryKey: ["budget-summary"] });
      toast({ title: "Entry deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const displayed = filterType === "all" ? entries : entries.filter((e) => e.type === filterType);
  const fmt = (n: number) => `PKR ${n.toLocaleString("en-PK", { minimumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budget Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Track all income and expenses with running balance.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><PlusCircle className="w-4 h-4" /> Add Entry</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add Budget Entry</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={form.type === "income" ? "default" : "outline"}
                  className="w-full gap-2" onClick={() => setForm((f) => ({ ...f, type: "income", category: "" }))}>
                  <ArrowUpCircle className="w-4 h-4" /> Income
                </Button>
                <Button
                  variant={form.type === "expense" ? "destructive" : "outline"}
                  className="w-full gap-2" onClick={() => setForm((f) => ({ ...f, type: "expense", category: "" }))}>
                  <ArrowDownCircle className="w-4 h-4" /> Expense
                </Button>
              </div>
              <div>
                <Label>Amount (PKR)</Label>
                <Input type="number" min="1" placeholder="0" value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Description</Label>
                <Input placeholder="Brief description..." value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {(CATEGORIES[form.type as keyof typeof CATEGORIES] ?? []).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={add.isPending || !form.amount || !form.description}
                onClick={() => add.mutate(form)}>
                {add.isPending ? "Adding…" : "Add Entry"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4">
          <TrendingUp className="w-10 h-10 text-green-600" />
          <div>
            <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Total Income</p>
            <p className="text-2xl font-bold text-green-700">{fmt(summary?.totalIncome ?? 0)}</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-4">
          <TrendingDown className="w-10 h-10 text-red-600" />
          <div>
            <p className="text-xs text-red-600 font-semibold uppercase tracking-wide">Total Expense</p>
            <p className="text-2xl font-bold text-red-700">{fmt(summary?.totalExpense ?? 0)}</p>
          </div>
        </div>
        <div className={`${(summary?.balance ?? 0) >= 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"} border rounded-xl p-5 flex items-center gap-4`}>
          <Wallet className={`w-10 h-10 ${(summary?.balance ?? 0) >= 0 ? "text-blue-600" : "text-orange-600"}`} />
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${(summary?.balance ?? 0) >= 0 ? "text-blue-600" : "text-orange-600"}`}>Balance</p>
            <p className={`text-2xl font-bold ${(summary?.balance ?? 0) >= 0 ? "text-blue-700" : "text-orange-700"}`}>{fmt(summary?.balance ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* Filter + Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Filter:</span>
          {["all", "income", "expense"].map((t) => (
            <Button key={t} size="sm" variant={filterType === t ? "default" : "outline"}
              onClick={() => setFilterType(t)} className="capitalize">{t}</Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">{displayed.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Date", "Type", "Category", "Description", "Amount", "Balance After", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No entries yet. Add your first income or expense.</td></tr>
              ) : displayed.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(e.entryDate).toLocaleDateString("en-PK")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={e.type === "income" ? "default" : "destructive"} className="capitalize gap-1">
                      {e.type === "income" ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                      {e.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.category ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{e.description}</td>
                  <td className={`px-4 py-3 font-semibold ${e.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {e.type === "income" ? "+" : "−"}{fmt(e.amount)}
                  </td>
                  <td className={`px-4 py-3 font-medium ${e.balanceAfter >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                    {fmt(e.balanceAfter)}
                  </td>
                  <td className="px-4 py-3">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete "{e.description}" ({fmt(e.amount)}). Note: running balances of subsequent entries will not auto-recalculate. Consider adding a correcting entry instead.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(e.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
