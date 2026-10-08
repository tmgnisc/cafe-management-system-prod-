import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Settings } from "@/types";

/** Cafe settings (tax, discount rules, receipt info). Readable by all signed-in users. */
export function useSettings() {
  return useQuery<Settings>({ queryKey: qk.settings, queryFn: api.getSettings, staleTime: 60_000 });
}
