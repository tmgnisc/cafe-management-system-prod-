"use client";

import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pill } from "@/components/shared/status-badges";
import { formatDateTime, humanize } from "@/lib/utils";
import type { AuditLog } from "@/types";

function display(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

function ValueCell({ value, tone }: { value: unknown; tone?: "old" | "new" }) {
  const text = display(value);
  const multiline = typeof value === "object" && value !== null;
  const cls = tone === "old" ? "text-destructive/80 line-through decoration-destructive/30" : tone === "new" ? "text-[oklch(0.42_0.1_150)]" : "";
  return multiline ? (
    <pre className="max-h-48 overflow-auto rounded-md bg-muted/60 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">{text}</pre>
  ) : (
    <span className={`font-mono text-xs break-all ${text === "—" ? "text-muted-foreground" : cls}`}>{text}</span>
  );
}

export function AuditDetailDialog({ log, onOpenChange }: { log: AuditLog | null; onOpenChange: (o: boolean) => void }) {
  const oldV = log?.old_values ?? {};
  const newV = log?.new_values ?? {};
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
  const hasOld = Object.keys(oldV).length > 0;
  const hasNew = Object.keys(newV).length > 0;

  return (
    <Dialog open={!!log} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {log && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 font-display text-xl">
                {humanize(log.action)}
                {log.entity_type && (
                  <Pill tone="gray">
                    {humanize(log.entity_type)}
                    {log.entity_id ? ` #${log.entity_id}` : ""}
                  </Pill>
                )}
              </DialogTitle>
              <DialogDescription>{log.description}</DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">User</dt>
                <dd className="font-medium">{log.user_name ?? "System"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Role</dt>
                <dd>{log.user_role ? humanize(log.user_role) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">When</dt>
                <dd>{formatDateTime(log.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">IP address</dt>
                <dd className="font-mono text-xs">{log.ip_address ?? "—"}</dd>
              </div>
            </dl>

            {keys.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No field changes recorded for this event.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Field</th>
                      {hasOld && <th className="px-3 py-2 font-medium">Before</th>}
                      {hasOld && hasNew && <th className="w-6" />}
                      {hasNew && <th className="px-3 py-2 font-medium">{hasOld ? "After" : "Value"}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {keys.map((k) => {
                      const changed = hasOld && hasNew && JSON.stringify(oldV[k]) !== JSON.stringify(newV[k]);
                      return (
                        <tr key={k} className="align-top">
                          <td className="px-3 py-2 text-xs font-medium whitespace-nowrap">{humanize(k)}</td>
                          {hasOld && (
                            <td className="px-3 py-2">
                              <ValueCell value={oldV[k]} tone={changed ? "old" : undefined} />
                            </td>
                          )}
                          {hasOld && hasNew && <td className="py-2 text-muted-foreground">{changed && <ArrowRight className="size-3.5" />}</td>}
                          {hasNew && (
                            <td className="px-3 py-2">
                              <ValueCell value={newV[k]} tone={changed ? "new" : undefined} />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {log.user_agent && <p className="truncate text-xs text-muted-foreground" title={log.user_agent}>{log.user_agent}</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
