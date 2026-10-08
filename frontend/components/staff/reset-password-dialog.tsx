"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { api, errorMessage } from "@/lib/api";
import type { User } from "@/types";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters").regex(/[A-Za-z]/, "Must contain a letter").regex(/\d/, "Must contain a number"),
    password_confirmation: z.string().min(1, "Please confirm the password"),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match" });
type Values = z.infer<typeof schema>;

export function ResetPasswordDialog({ staff, onOpenChange }: { staff: User | null; onOpenChange: (o: boolean) => void }) {
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", password_confirmation: "" },
  });
  useEffect(() => {
    if (staff) reset({ password: "", password_confirmation: "" });
  }, [staff, reset]);

  const mutation = useMutation({
    mutationFn: (v: Values) => api.resetStaffPassword(staff!.id, v.password, v.password_confirmation),
    onSuccess: () => {
      toast.success(`Password reset for ${staff?.name}`);
      onOpenChange(false);
    },
    onError: (err) => {
      if (!applyServerErrors(err, setError, ["password", "password_confirmation"])) toast.error(errorMessage(err));
    },
  });

  return (
    <Dialog open={!!staff} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <KeyRound className="size-5 text-primary" /> Reset password
          </DialogTitle>
          <DialogDescription>Set a new password for {staff?.name}. Share it with them securely.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          <FormField label="New password" htmlFor="rp-password" required error={formState.errors.password?.message} hint="8+ characters, letters and numbers">
            <Input id="rp-password" type="password" autoComplete="new-password" {...register("password")} />
          </FormField>
          <FormField label="Confirm new password" htmlFor="rp-confirm" required error={formState.errors.password_confirmation?.message}>
            <Input id="rp-confirm" type="password" autoComplete="new-password" {...register("password_confirmation")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
