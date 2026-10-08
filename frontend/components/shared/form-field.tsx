import type { ReactNode } from "react";
import type { FieldErrors, FieldValues, Path, UseFormSetError } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Label + control + error/hint. Use with react-hook-form `register` or controlled inputs. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Push server-side 422 field errors into a react-hook-form instance. Returns true if any were applied. */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, known: string[]): boolean {
  if (!(err instanceof ApiError) || err.status !== 422) return false;
  let applied = false;
  for (const [field, messages] of Object.entries(err.errors)) {
    if (known.includes(field)) {
      setError(field as Path<T>, { type: "server", message: messages[0] });
      applied = true;
    }
  }
  return applied;
}

export function fieldError<T extends FieldValues>(errors: FieldErrors<T>, name: keyof T): string | undefined {
  const e = errors[name];
  return e && typeof e.message === "string" ? e.message : undefined;
}
