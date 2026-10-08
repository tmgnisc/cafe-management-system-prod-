"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, ImageUp, Loader2, Percent, ReceiptText, Save, Settings as SettingsIcon, Tag, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageContainer } from "@/components/layout/app-shell";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { ReceiptPreview } from "@/components/settings/receipt-preview";
import { useSettings } from "@/hooks/use-settings";
import { api, assetUrl, errorMessage } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Settings } from "@/types";

const pct = z.coerce.number<number>().min(0, "Must be 0 or more").max(100, "Must be 100 or less");

const schema = z.object({
  cafe_name: z.string().trim().min(1, "Cafe name is required").max(100),
  address: z.string().trim().max(255),
  phone: z.string().trim().max(50),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  logo: z.string().max(500),
  pan_number: z.string().trim().max(30),
  currency: z.string().trim().min(1, "Required").max(10),
  currency_symbol: z.string().trim().min(1, "Required").max(10),
  tax_label: z.string().trim().min(1, "Required").max(20),
  tax_rate: pct,
  service_charge_rate: pct,
  tax_on_service_charge: z.boolean(),
  staff_discount_enabled: z.boolean(),
  max_staff_discount_percent: pct,
  allow_negative_stock: z.boolean(),
  table_status_after_payment: z.enum(["AVAILABLE", "CLEANING"]),
  receipt_footer: z.string().max(255),
});
type Values = z.infer<typeof schema>;
const FIELDS = Object.keys(schema.shape);

function Section({ icon: Icon, title, description, children }: { icon: typeof Building2; title: string; description: string; children: ReactNode }) {
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

function SwitchRow({ label, description, checked, onChange, id }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3">
      <label htmlFor={id} className="cursor-pointer">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const query = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, control, reset, setValue, setError, formState } = form;
  const { errors, isDirty } = formState;
  const values = useWatch({ control }) as Values;

  useEffect(() => {
    if (query.data) reset(query.data as Values);
  }, [query.data, reset]);

  const save = useMutation({
    mutationFn: (v: Values) => api.updateSettings(v as Partial<Settings>),
    onSuccess: (s) => {
      qc.setQueryData(qk.settings, s);
      reset(s as Values);
      toast.success("Settings saved");
    },
    onError: (err) => {
      if (!applyServerErrors(err, setError, FIELDS)) toast.error(errorMessage(err));
      else toast.error("Please fix the highlighted fields");
    },
  });

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("The image may not be larger than 2 MB");
      return;
    }
    setUploading(true);
    try {
      const res = await api.uploadImage(file);
      setValue("logo", res.path, { shouldDirty: true });
      toast.success("Logo uploaded — remember to save");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (query.isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Settings" icon={SettingsIcon} />
        <LoadingState rows={8} />
      </PageContainer>
    );
  }
  if (query.isError || !query.data) {
    return (
      <PageContainer>
        <PageHeader title="Settings" icon={SettingsIcon} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </PageContainer>
    );
  }

  const logoUrl = assetUrl(values?.logo);

  return (
    <PageContainer>
      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-6">
        <PageHeader
          title="Settings"
          icon={SettingsIcon}
          description="Cafe profile, billing rules and receipt details."
          actions={
            <>
              {isDirty && (
                <Button type="button" variant="outline" onClick={() => query.data && reset(query.data as Values)}>
                  Discard
                </Button>
              )}
              <Button type="submit" disabled={save.isPending || !isDirty}>
                {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                Save settings
              </Button>
            </>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Section icon={Building2} title="Cafe profile" description="Shown on receipts and across the app.">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Cafe name" htmlFor="cafe_name" required error={errors.cafe_name?.message} className="sm:col-span-2">
                  <Input id="cafe_name" {...register("cafe_name")} />
                </FormField>
                <FormField label="Address" htmlFor="address" error={errors.address?.message} className="sm:col-span-2">
                  <Input id="address" {...register("address")} />
                </FormField>
                <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
                  <Input id="phone" {...register("phone")} />
                </FormField>
                <FormField label="Email" htmlFor="email" error={errors.email?.message}>
                  <Input id="email" type="email" {...register("email")} />
                </FormField>
                <FormField label="PAN / VAT number" htmlFor="pan_number" error={errors.pan_number?.message}>
                  <Input id="pan_number" {...register("pan_number")} />
                </FormField>
                <FormField label="Logo" error={errors.logo?.message} hint="JPG, PNG or WEBP up to 2 MB">
                  <div className="flex items-center gap-3">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="Cafe logo" className="size-full object-cover" />
                      ) : (
                        <ImageUp className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                      {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />}
                      {logoUrl ? "Replace" : "Upload"}
                    </Button>
                    {logoUrl && (
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove logo" onClick={() => setValue("logo", "", { shouldDirty: true })}>
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </FormField>
              </div>
            </Section>

            <Section icon={Percent} title="Billing" description="Applied by the server to every open bill.">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Currency" htmlFor="currency" required error={errors.currency?.message}>
                  <Input id="currency" {...register("currency")} />
                </FormField>
                <FormField label="Currency symbol" htmlFor="currency_symbol" required error={errors.currency_symbol?.message}>
                  <Input id="currency_symbol" {...register("currency_symbol")} />
                </FormField>
                <FormField label="Tax label" htmlFor="tax_label" required error={errors.tax_label?.message}>
                  <Input id="tax_label" {...register("tax_label")} />
                </FormField>
                <FormField label="Tax rate (%)" htmlFor="tax_rate" required error={errors.tax_rate?.message}>
                  <Input id="tax_rate" type="number" step="0.01" min={0} max={100} {...register("tax_rate")} />
                </FormField>
                <FormField label="Service charge (%)" htmlFor="service_charge_rate" required error={errors.service_charge_rate?.message}>
                  <Input id="service_charge_rate" type="number" step="0.01" min={0} max={100} {...register("service_charge_rate")} />
                </FormField>
              </div>
              <div className="mt-4">
                <Controller
                  control={control}
                  name="tax_on_service_charge"
                  render={({ field }) => (
                    <SwitchRow
                      id="tax_on_service_charge"
                      label="Charge tax on service charge"
                      description="Tax base = (subtotal − discount) + service charge, as per Nepal VAT practice."
                      checked={!!field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </Section>

            <Section icon={Tag} title="Discounts" description="Limits for staff. Super admins can apply any discount.">
              <div className="grid gap-4 sm:grid-cols-[1fr_200px] sm:items-start">
                <Controller
                  control={control}
                  name="staff_discount_enabled"
                  render={({ field }) => (
                    <SwitchRow
                      id="staff_discount_enabled"
                      label="Allow staff to apply discounts"
                      description="When off, only super admins can discount a bill."
                      checked={!!field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FormField label="Max staff discount (%)" htmlFor="max_staff_discount_percent" required error={errors.max_staff_discount_percent?.message}>
                  <Input
                    id="max_staff_discount_percent"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    disabled={!values?.staff_discount_enabled}
                    {...register("max_staff_discount_percent")}
                  />
                </FormField>
              </div>
            </Section>

            <Section icon={Wrench} title="Operations" description="How stock and tables behave during service.">
              <div className="grid gap-4 sm:grid-cols-[1fr_240px] sm:items-start">
                <Controller
                  control={control}
                  name="allow_negative_stock"
                  render={({ field }) => (
                    <SwitchRow
                      id="allow_negative_stock"
                      label="Allow negative stock"
                      description="When off, payment is blocked if recipe ingredients would go below zero."
                      checked={!!field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FormField label="Table status after payment">
                  <Controller
                    control={control}
                    name="table_status_after_payment"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AVAILABLE">Available</SelectItem>
                          <SelectItem value="CLEANING">Needs cleaning</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>
            </Section>

            <Section icon={ReceiptText} title="Receipt" description="The closing message printed at the bottom of every receipt.">
              <FormField label="Receipt footer" htmlFor="receipt_footer" error={errors.receipt_footer?.message}>
                <Textarea id="receipt_footer" rows={3} {...register("receipt_footer")} />
              </FormField>
            </Section>
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-2xl border border-border bg-secondary/40 p-5">
              <div className="mb-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">Live receipt preview</div>
              {values && <ReceiptPreview values={values} />}
              <p className="mt-4 text-center text-xs text-muted-foreground">Sample bill with a Rs. 60 discount.</p>
            </div>
          </aside>
        </div>
      </form>
    </PageContainer>
  );
}
