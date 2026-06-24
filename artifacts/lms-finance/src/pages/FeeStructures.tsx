import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFeeStructures, getListFeeStructuresQueryKey,
  useCreateFeeStructure, useUpdateFeeStructure, useDeleteFeeStructure,
} from "@workspace/api-client-react";
import type { FeeStructure, CreateFeeStructureInput } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, BookOpen, AlertCircle, Info } from "lucide-react";
import { useForm, Controller } from "react-hook-form";

const COURSES = ["DIT", "CIT", "IICT"] as const;

export default function FeeStructures() {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<FeeStructure | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FeeStructure | null>(null);

  const { data: structures, isLoading, error } = useListFeeStructures({
    query: { queryKey: getListFeeStructuresQueryKey() },
  });

  const createMutation = useCreateFeeStructure();
  const updateMutation = useUpdateFeeStructure();
  const deleteMutation = useDeleteFeeStructure();

  function openAdd() { setEditItem(null); setShowDialog(true); }
  function openEdit(f: FeeStructure) { setEditItem(f); setShowDialog(true); }

  function handleDelete() {
    if (!deleteConfirm) return;
    deleteMutation.mutate({ id: deleteConfirm.id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFeeStructuresQueryKey() });
        setDeleteConfirm(null);
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee Structures</h1>
          <p className="text-sm text-muted-foreground mt-1">Define monthly fees per course. This is the single source of truth for all calculations.</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" /> Add Fee Structure
        </Button>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg flex gap-3 text-sm text-blue-800 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>Important:</strong> Fee structures are used automatically when generating vouchers. Changing a fee structure does not retroactively update existing vouchers.
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : error ? (
        <div className="p-6 text-center text-destructive flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" /> Failed to load fee structures.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COURSES.map((course) => {
            const fee = structures?.find((s) => s.course === course);
            return (
              <Card key={course} className={fee ? "" : "border-dashed border-muted-foreground/30"}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{course}</CardTitle>
                        <p className="text-xs text-muted-foreground">Monthly Fee</p>
                      </div>
                    </div>
                    {fee && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(fee)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(fee)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {fee ? (
                    <div>
                      <div className="text-3xl font-bold text-foreground">{formatCurrency(fee.monthlyFee)}</div>
                      <div className="text-xs text-muted-foreground mt-1">per month</div>
                      {fee.description && <p className="text-sm text-muted-foreground mt-2">{fee.description}</p>}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-3">No fee set</p>
                      <Button variant="outline" size="sm" onClick={openAdd} className="gap-2">
                        <Plus className="w-3.5 h-3.5" /> Set Fee
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FeeFormDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        fee={editItem}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: getListFeeStructuresQueryKey() });
          setShowDialog(false);
        }}
        createMutation={createMutation}
        updateMutation={updateMutation}
      />

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Fee Structure</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete the fee structure for <strong>{deleteConfirm?.course}</strong>? This will not affect existing vouchers.
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

function FeeFormDialog({
  open, onClose, fee, onSuccess, createMutation, updateMutation,
}: {
  open: boolean;
  onClose: () => void;
  fee: FeeStructure | null;
  onSuccess: () => void;
  createMutation: ReturnType<typeof useCreateFeeStructure>;
  updateMutation: ReturnType<typeof useUpdateFeeStructure>;
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<CreateFeeStructureInput>({
    defaultValues: fee ? { course: fee.course as any, monthlyFee: fee.monthlyFee, description: fee.description ?? "" } : { course: "DIT" },
  });

  function onSubmit(data: CreateFeeStructureInput) {
    if (fee) {
      updateMutation.mutate({ id: fee.id, data }, { onSuccess });
    } else {
      createMutation.mutate({ data }, { onSuccess });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const apiError = (createMutation.error as any)?.data?.message || (updateMutation.error as any)?.data?.message;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{fee ? "Edit Fee Structure" : "Add Fee Structure"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {apiError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">{apiError}</div>
          )}
          <div className="space-y-1.5">
            <Label>Course *</Label>
            <Controller name="course" control={control} rules={{ required: true }} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!!fee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COURSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Fee (PKR) *</Label>
            <Input
              type="number"
              step="0.01"
              min="1"
              {...register("monthlyFee", { required: "Fee is required", min: { value: 1, message: "Fee must be > 0" }, valueAsNumber: true })}
              placeholder="18000"
            />
            {errors.monthlyFee && <p className="text-xs text-destructive">{errors.monthlyFee.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input {...register("description")} placeholder="Optional notes..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : fee ? "Save Changes" : "Add Fee Structure"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
