"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Coffee, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { FullScreenLoader, homePathFor, useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const { login, user, status } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  const next = params.get("next");
  const destination = (role: "SUPERADMIN" | "STAFF") =>
    next && next.startsWith("/") && !next.startsWith("//") && (role === "SUPERADMIN" || !next.startsWith("/admin")) ? next : homePathFor(role);

  useEffect(() => {
    if (status === "authenticated" && user) router.replace(destination(user.role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user]);

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      const u = await login(values.email, values.password);
      router.replace(destination(u.role));
    } catch (err) {
      setFormError(errorMessage(err, "Unable to sign in"));
    }
  };

  if (status === "loading" || status === "authenticated") return <FullScreenLoader />;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, oklch(0.45 0.08 55 / .55), transparent 40%), radial-gradient(circle at 85% 80%, oklch(0.6 0.12 65 / .35), transparent 45%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Coffee className="size-6" />
          </div>
          <span className="font-display text-xl font-semibold">Isha&apos;s Cozy Cafe</span>
        </div>
        <div className="relative max-w-md">
          <p className="font-display text-4xl leading-tight font-medium">
            Every cup, every table,
            <br />
            <span className="text-sidebar-primary italic">perfectly in order.</span>
          </p>
          <p className="mt-4 text-sidebar-foreground/70">Take orders, settle bills and keep the pantry stocked — all from one warm little counter.</p>
        </div>
        <p className="relative text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} Isha&apos;s Cozy Cafe · Jhamsikhel, Lalitpur</p>
      </div>

      {/* Form */}
      <div className="bg-cafe-texture flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Coffee className="size-5" />
            </div>
            <span className="font-display text-xl font-semibold">Isha&apos;s Cozy Cafe</span>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Sign in to start your shift.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            <FormField label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" autoFocus className="h-11 bg-card" placeholder="you@ishascozycafe.com" aria-invalid={!!errors.email} {...register("email")} />
            </FormField>
            <FormField label="Password" htmlFor="password" error={errors.password?.message}>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-11 bg-card pr-10"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </FormField>

            {formError && <div className="rounded-lg border border-destructive/20 bg-danger-soft px-3 py-2.5 text-sm text-destructive" role="alert">{formError}</div>}

            <Button type="submit" className="h-11 w-full text-[0.95rem]" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <LoginForm />
    </Suspense>
  );
}
