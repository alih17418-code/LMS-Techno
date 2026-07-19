import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, Search, X, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SysLog = {
  id: number; action: string; entityType: string | null; entityId: number | null;
  description: string; performedBy: number | null; performedByName: string | null;
  role: string | null; ipAddress: string | null; createdAt: string;
};

const ACTION_COLORS: Record<string, string> = {
  login: "bg-blue-50 text-blue-700 border-blue-200",
  logout: "bg-slate-50 text-slate-600 border-slate-200",
  create: "bg-green-50 text-green-700 border-green-200",
  delete: "bg-red-50 text-red-700 border-red-200",
  update: "bg-amber-50 text-amber-700 border-amber-200",
  payment: "bg-purple-50 text-purple-700 border-purple-200",
  checkin: "bg-cyan-50 text-cyan-700 border-cyan-200",
  checkout: "bg-orange-50 text-orange-700 border-orange-200",
};

function getActionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k));
  return key ? ACTION_COLORS[key] : "bg-gray-50 text-gray-600 border-gray-200";
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  staff: "bg-blue-100 text-blue-700",
  instructor: "bg-green-100 text-green-700",
};

export default function SystemLogs() {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [filters, setFilters] = useState({ search: "", from: "", to: "", entityType: "all" });

  const { data: logs = [], isLoading, isFetching, refetch } = useQuery<SysLog[]>({
    queryKey: ["system-logs", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.entityType && filters.entityType !== "all") params.set("entityType", filters.entityType);
      return apiFetch(`/system-logs?${params.toString()}`);
    },
  });

  function applyFilters() {
    setFilters({ search, from: fromDate, to: toDate, entityType: entityTypeFilter });
  }

  function clearFilters() {
    setSearch("");
    setFromDate("");
    setToDate("");
    setEntityTypeFilter("all");
    setFilters({ search: "", from: "", to: "", entityType: "all" });
  }

  const hasFilters = filters.search || filters.from || filters.to || filters.entityType !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-500" /> System Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Audit trail of all actions performed in the system. Admin access only.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Search description / user</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">From Date</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">To Date</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Entity Type</label>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="auth">Auth</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="instructor">Instructor</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="attendance">Attendance</SelectItem>
                  <SelectItem value="voucher">Voucher</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="class">Class</SelectItem>
                  <SelectItem value="course">Course</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={applyFilters} className="gap-1.5">
              <Search className="w-3.5 h-3.5" /> Filter
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Activity Log</CardTitle>
            <span className="text-sm text-muted-foreground">{logs.length} {logs.length === 500 ? "(max)" : ""} records</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertCircle className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">No log entries found.</p>
              {hasFilters && <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date & Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Performed By</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{log.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <div className="font-medium">{new Date(log.createdAt).toLocaleDateString("en-PK")}</div>
                        <div className="text-muted-foreground font-mono">{new Date(log.createdAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", getActionColor(log.action))}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {log.entityType ? (
                          <span>
                            {log.entityType}
                            {log.entityId ? <span className="font-mono ml-1 text-foreground/60">#{log.entityId}</span> : ""}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-xs">{log.description}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {log.performedByName ? (
                          <div>
                            <p className="font-medium">{log.performedByName}</p>
                            {log.role && (
                              <span className={cn("text-xs px-1 py-0.5 rounded capitalize font-medium", ROLE_COLORS[log.role] ?? "bg-gray-100 text-gray-600")}>
                                {log.role}
                              </span>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground">System</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{log.ipAddress ?? "—"}</td>
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
