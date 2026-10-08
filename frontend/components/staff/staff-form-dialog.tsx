"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { api, errorMessage } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { User } from "@/types";

const passwordRule = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Za-z]/, "Must contain a letter")
  .regex(/\d/, "Must contain a number");

const baseSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(["SUPERADMIN", "STAFF"]),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  password: z.string().optional(),
  password_confirmation: z.string().optional(),
});

const createSchema = baseSchema
  .extend({ password: passwordRule, password_confirmation: z.string().min(1, "Please confirm the password") })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match" });

type Values = z.infer<typeof baseSchema>;

const FIELDS = ["name", "email", "phone", "role", "status", "password", "password_confirmation"];

export function StaffFormDialog({
  open,
  onOpenChange,
  staff,
  isSelf,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  staff: User | null;
  isSelf?: boolean;
}) {
  const editing = !!staff;
  const qc = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(editing ? baseSchema : (createSchema as unknown as typeof baseSchema)),
    defaultValues: { name: "", email: "", phone: "", role: "STAFF", status: "ACTIVE", password: "", password_confirmation: "" },
  });
  const { register, handleSubmit, control, reset, setError, formState } = form;
  const { errors } = formState;

  useEffect(() => {
    if (open) {
      reset({
        name: staff?.name ?? "",
        email: staff?.email ?? "",
        phone: staff?.phone ?? "",
        role: staff?.role ?? "STAFF",
        status: staff?.status ?? "ACTIVE",
        password: "",
        password_confirmation: "",
      });
    }
  }, [open, staff, reset]);

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body = { name: v.name, email: v.email, phone: v.phone || null, role: v.role, status: v.status };
      return editing
        ? api.updateStaff(staff!.id, body)
        : api.createStaff({ ...body, password: v.password, password_confirmation: v.password_confirmation });
    },
    onSuccess: (u) => {
      toast.success(editing ? `${u.name} updated` : `${u.name} added to the team`);
      qc.invalidateQueries({ queryKey: qk.staffAll });
      onOpenChange(false);
    },
    onError: (err) => {
      if (!applyServerErrors(err, setError, FIELDS)) toast.error(errorMessage(err));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{editing ? "Edit staff member" : "Add staff member"}</DialogTitle>
          <DialogDescription>{editing ? "Update account details and access." : "Create a login for a new team member."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Full name" htmlFor="name" required error={errors.name?.message} className="sm:col-span-2">
            <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
          </FormField>
          <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="off" {...register("email")} aria-invalid={!!errors.email} />
          </FormField>
          <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" {...register("phone")} placeholder="98XXXXXXXX" />
          </FormField>
          <FormField label="Role" required error={errors.role?.message}>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSelf}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Status" required error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSelf}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          {!editing && (
            <>
              <FormField label="Password" htmlFor="password" required error={errors.password?.message} hint="8+ characters, letters and numbers">
                <Input id="password" type="password" autoComplete="new-password" {...register("password")} aria-invalid={!!errors.password} />
              </FormField>
              <FormField label="Confirm password" htmlFor="password_confirmation" required error={errors.password_confirmation?.message}>
                <Input id="password_confirmation" type="password" autoComplete="new-password" {...register("password_confirmation")} aria-invalid={!!errors.password_confirmation} />
              </FormField>
            </>
          )}
          {isSelf && <p className="text-xs text-muted-foreground sm:col-span-2">You can&apos;t change your own role or status.</p>}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
