"use client";

import { Suspense, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Receipt } from "@/components/billing/receipt";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import { qk } from "@/lib/query-keys";

function ReceiptView() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const search = useSearchParams();
  const router = useRouter();
  const printed = useRef(false);
  const query = useQuery({ queryKey: qk.receipt(orderId), queryFn: () => api.getReceipt(orderId) });

  useEffect(() => {
    if (query.data && search.get("print") === "1" && !printed.current) {
      printed.current = true;
      setTimeout(() => window.print(), 300);
    }
  }, [query.data, search]);

  return (
    <div className="min-h-screen bg-muted/60 py-6">
      <div className="no-print mx-auto mb-4 flex max-w-sm items-center justify-between px-4">
        <Button variant="ghost" size="sm" onClick={() => (window.history.length > 1 ? router.back() : router.push("/pos"))}>
          <ArrowLeft /> Back
        </Button>
        <Button size="sm" onClick={() => window.print()} disabled={!query.data}>
          <Printer /> Print receipt
        </Button>
      </div>
      <div className="mx-auto max-w-sm px-4">
        {query.isLoading ? (
          <LoadingState rows={10} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <div className="print-area overflow-hidden rounded-md shadow-[0_10px_40px_-15px_oklch(0.3_0.03_50/.4)]">
            <Receipt data={query.data!} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={null}>
      <RequireAuth>
        <ReceiptView />
      </RequireAuth>
    </Suspense>
  );
}
