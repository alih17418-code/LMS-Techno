import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { Search, BookOpen, FileText, Receipt, Award, AlertCircle } from "lucide-react";

type Student = {
  id: number; name: string; studentCode: string; fatherName?: string;
  phone?: string; course: string; enrollmentDate: string;
  effectiveFee: string; durationMonths: number; discount: string; status: string;
};
type Voucher = {
  id: number; voucherNumber: string; month: number; year: number;
  amount: string; pendingAmount: string; dueDate: string; status: string;
};
type ReceiptRow = {
  id: number; receiptNumber: string; amountPaid: string; paymentDate: string; remarks?: string;
};
type Certificate = {
  id: number; certificateNumber: string; issuedDate: string; isValid: boolean;
};

function usePortalSearch(code: string) {
  const { data: students = [], isFetching } = useQuery<Student[]>({
    queryKey: ["portal-student", code],
    queryFn: () => apiFetch(`/students?search=${encodeURIComponent(code)}`),
    enabled: code.length >= 4,
  });
  return { student: students[0] ?? null, isFetching };
}

export default function StudentPortal() {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { student, isFetching } = usePortalSearch(submitted);

  const { data: vouchers = [] } = useQuery<Voucher[]>({
    queryKey: ["portal-vouchers", student?.id],
    queryFn: () => apiFetch(`/vouchers?studentId=${student!.id}`),
    enabled: !!student,
  });
  const { data: receipts = [] } = useQuery<ReceiptRow[]>({
    queryKey: ["portal-receipts", student?.id],
    queryFn: () => apiFetch(`/receipts?studentId=${student!.id}`),
    enabled: !!student,
  });
  const { data: certificates = [] } = useQuery<Certificate[]>({
    queryKey: ["portal-certs", student?.id],
    queryFn: () => apiFetch(`/certificates?studentId=${student!.id}`),
    enabled: !!student,
  });

  const totalPending = vouchers.reduce((s, v) => s + parseFloat(v.pendingAmount), 0);
  const fmt = (n: number | string) => `PKR ${Number(n).toLocaleString("en-PK")}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shadow-sm py-4 px-6 flex items-center gap-4">
        <img src="/tips-logo.png" alt="TIPS" className="h-10 w-auto object-contain" />
        <div>
          <h1 className="font-bold text-lg text-blue-900">Student Portal</h1>
          <p className="text-xs text-gray-500">Technospyre Institute of Professional Studies</p>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
        {/* Search Box */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">Check Your Account</h2>
          <p className="text-sm text-muted-foreground mb-4">Enter your student code to view fees, vouchers, and certificates.</p>
          <div className="flex gap-3">
            <Input
              placeholder="Enter student code (e.g. 100001)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSubmitted(input.trim())}
              className="max-w-sm"
            />
            <Button onClick={() => setSubmitted(input.trim())} disabled={input.length < 4} className="gap-2">
              <Search className="w-4 h-4" /> Search
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isFetching && <div className="text-center text-muted-foreground py-8">Searching…</div>}

        {/* Not found */}
        {!isFetching && submitted && !student && (
          <div className="bg-white rounded-2xl shadow-md p-6 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-red-400 mb-3" />
            <p className="font-medium text-red-600">No student found with code "{submitted}"</p>
            <p className="text-sm text-muted-foreground mt-1">Please check your code and try again.</p>
          </div>
        )}

        {/* Student Found */}
        {student && (
          <div className="space-y-5">
            {/* Profile Card */}
            <div className="bg-white rounded-2xl shadow-md p-6">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-bold text-blue-900">{student.name}</h2>
                  <p className="text-muted-foreground text-sm">Code: <span className="font-mono font-medium">{student.studentCode}</span></p>
                  {student.fatherName && <p className="text-muted-foreground text-sm">Father: {student.fatherName}</p>}
                  {student.phone && <p className="text-muted-foreground text-sm">Phone: {student.phone}</p>}
                </div>
                <div className="text-right">
                  <Badge variant={student.status === "active" ? "default" : "secondary"} className="capitalize mb-2">{student.status}</Badge>
                  <p className="text-xs text-muted-foreground">Enrolled: {new Date(student.enrollmentDate).toLocaleDateString("en-PK")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Course</p>
                  <p className="font-medium text-sm">{student.course}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Duration</p>
                  <p className="font-medium text-sm">{student.durationMonths} months</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Monthly Fee</p>
                  <p className="font-medium text-sm">{fmt(student.effectiveFee)}</p>
                </div>
                <div>
                  <p className={`text-xs font-semibold uppercase ${totalPending > 0 ? "text-red-600" : "text-green-600"}`}>Pending Balance</p>
                  <p className={`font-bold text-sm ${totalPending > 0 ? "text-red-600" : "text-green-600"}`}>{fmt(totalPending)}</p>
                </div>
              </div>
            </div>

            {/* Vouchers */}
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><FileText className="w-4 h-4" /> Fee Vouchers</h3>
              {vouchers.length === 0 ? (
                <p className="text-muted-foreground text-sm">No vouchers generated.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground uppercase">
                        <th className="text-left py-2">Voucher #</th>
                        <th className="text-left py-2">Month</th>
                        <th className="text-left py-2">Amount</th>
                        <th className="text-left py-2">Pending</th>
                        <th className="text-left py-2">Due Date</th>
                        <th className="text-left py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.map((v) => (
                        <tr key={v.id} className="border-t">
                          <td className="py-2 font-mono text-xs">{v.voucherNumber}</td>
                          <td className="py-2">{new Date(2000, v.month - 1).toLocaleString("en-PK", { month: "long" })} {v.year}</td>
                          <td className="py-2">{fmt(v.amount)}</td>
                          <td className={`py-2 font-medium ${parseFloat(v.pendingAmount) > 0 ? "text-red-600" : "text-green-600"}`}>
                            {fmt(v.pendingAmount)}
                          </td>
                          <td className="py-2 text-muted-foreground">{new Date(v.dueDate).toLocaleDateString("en-PK")}</td>
                          <td className="py-2">
                            <Badge variant={v.status === "paid" ? "default" : v.status === "partial" ? "secondary" : "outline"} className="capitalize text-xs">{v.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Receipts */}
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Receipt className="w-4 h-4" /> Payment Receipts</h3>
              {receipts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No payments recorded.</p>
              ) : (
                <div className="space-y-2">
                  {receipts.map((r) => (
                    <div key={r.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{fmt(r.amountPaid)} received</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.paymentDate).toLocaleDateString("en-PK")} · {r.receiptNumber}</p>
                      </div>
                      {r.remarks && <p className="text-xs text-muted-foreground">{r.remarks}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certificates */}
            {certificates.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Award className="w-4 h-4" /> Certificates</h3>
                {certificates.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-mono text-sm font-medium">{c.certificateNumber}</p>
                      <p className="text-xs text-muted-foreground">Issued: {new Date(c.issuedDate).toLocaleDateString("en-PK")}</p>
                    </div>
                    <Badge variant={c.isValid ? "default" : "secondary"}>{c.isValid ? "Valid" : "Revoked"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="text-center text-xs text-muted-foreground py-4 border-t bg-white">
        © {new Date().getFullYear()} Technospyre Institute of Professional Studies. All rights reserved.
      </footer>
    </div>
  );
}
