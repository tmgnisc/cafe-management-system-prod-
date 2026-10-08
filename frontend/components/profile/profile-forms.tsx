"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2, Save, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function Card({ icon: Icon, title, description, children }: { icon: typeof UserRound; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="size-[18px]" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  phone: z.string().trim().max(30),
});
type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileDetailsForm() {
  const { user, setUser } = useAuth();
  const { register, handleSubmit, reset, setError, formState } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? "", phone: user?.phone ?? "" },
  });

  useEffect(() => {
    if (user) reset({ name: user.name, phone: user.phone ?? "" });
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: (v: ProfileValues) => api.updateProfile({ name: v.name, phone: v.phone || null }),
    onSuccess: (u) => {
      setUser(u);
      toast.success("Profile updated");
    },
    onError: (err) => {
      if (!applyServerErrors(err, setError, ["name", "phone"])) toast.error(errorMessage(err));
    },
  });

  return (
    <Card icon={UserRound} title="Personal details" description="Your name appears on orders and receipts.">
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        <FormField label="Full name" htmlFor="p-name" required error={formState.errors.name?.message}>
          <Input id="p-name" {...register("name")} />
        </FormField>
        <FormField label="Email" htmlFor="p-email" hint="Contact a super admin to change your login email.">
          <Input id="p-email" value={user?.email ?? ""} disabled readOnly />
        </FormField>
        <FormField label="Phone" htmlFor="p-phone" error={formState.errors.phone?.message}>
          <Input id="p-phone" {...register("phone")} />
        </FormField>
        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending || !formState.isDirty}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Save details
          </Button>
        </div>
      </form>
    </Card>
  );
}

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    password: z.string().min(8, "At least 8 characters").regex(/[A-Za-z]/, "Must contain a letter").regex(/\d/, "Must contain a number"),
    password_confirmation: z.string().min(1, "Please confirm the new password"),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match" });
type PasswordValues = z.infer<typeof passwordSchema>;

export function ChangePasswordForm() {
  const { register, handleSubmit, reset, setError, formState } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", password: "", password_confirmation: "" },
  });
  const { errors } = formState;

  const mutation = useMutation({
    mutationFn: (v: PasswordValues) => api.changePassword(v),
    onSuccess: () => {
      reset();
      toast.success("Password changed");
    },
    onError: (err) => {
      if (!applyServerErrors(err, setError, ["current_password", "password", "password_confirmation"])) toast.error(errorMessage(err));
    },
  });

  return (
    <Card icon={KeyRound} title="Change password" description="Use at least 8 characters with letters and numbers.">
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        <FormField label="Current password" htmlFor="cp-current" required error={errors.current_password?.message}>
          <Input id="cp-current" type="password" autoComplete="current-password" {...register("current_password")} />
        </FormField>
        <FormField label="New password" htmlFor="cp-new" required error={errors.password?.message}>
          <Input id="cp-new" type="password" autoComplete="new-password" {...register("password")} />
        </FormField>
        <FormField label="Confirm new password" htmlFor="cp-confirm" required error={errors.password_confirmation?.message}>
          <Input id="cp-confirm" type="password" autoComplete="new-password" {...register("password_confirmation")} />
        </FormField>
        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}
