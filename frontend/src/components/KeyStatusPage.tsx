import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_BASE_URL = import.meta.env.DEV
  ? "http://localhost:2024"
  : "http://localhost:8123";

const STATUS_STYLES: Record<
  string,
  { label: string; className: string; description: string }
> = {
  healthy: {
    label: "Healthy",
    className: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40",
    description: "Key is active and responding normally.",
  },
  active: {
    label: "In Use",
    className: "bg-sky-500/20 text-sky-200 ring-sky-400/40",
    description: "Key is currently being used for the next request.",
  },
  idle: {
    label: "Idle",
    className: "bg-slate-500/20 text-slate-200 ring-slate-400/40",
    description: "Key is available but has not been used yet.",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/30 text-red-200 ring-red-400/40",
    description: "Key failed during the last attempt and has been disabled.",
  },
};

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

interface GeminiKeyStatus {
  index: number;
  maskedKey: string;
  status: string;
  disabled: boolean;
  lastError: string | null;
  lastUsedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  successCount: number;
  failureCount: number;
  isLastUsed: boolean;
}

interface KeyStatusResponse {
  keys: GeminiKeyStatus[];
  total: number;
  available: number;
}

export function KeyStatusPage() {
  const [data, setData] = useState<KeyStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchStatuses = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/gemini-keys`);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const payload: KeyStatusResponse = await response.json();
      if (!isMounted.current) return;
      setData(payload);
      setError(null);
    } catch (err) {
      if (!isMounted.current) return;
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      if (!isMounted.current) return;
      if (mode === "initial") {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStatuses("initial");
    const interval = window.setInterval(() => {
      fetchStatuses("refresh");
    }, 15000);

    return () => {
      isMounted.current = false;
      window.clearInterval(interval);
    };
  }, [fetchStatuses]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading Gemini key status…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle className="size-10 text-red-400" />
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Unable to load Gemini keys</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
        <Button onClick={() => fetchStatuses("initial")}>Try again</Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const hasFailedKeys = data.keys.some((key) => key.status === "failed");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Gemini API Keys</h1>
          <p className="text-muted-foreground">
            Monitor the rotation pool, last usage, and any keys that need attention.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-emerald-500/20 text-emerald-200 ring-emerald-400/40">
            Available: {data.available} / {data.total}
          </Badge>
          {hasFailedKeys && (
            <Badge className="bg-red-500/30 text-red-100 ring-red-400/40">
              <AlertTriangle className="size-3" /> Failed keys detected
            </Badge>
          )}
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => fetchStatuses("refresh")}
            disabled={refreshing}
          >
            <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.keys.map((key) => {
          const styles = STATUS_STYLES[key.status] ?? STATUS_STYLES.idle;
          return (
            <Card key={key.index} className="border border-white/10 bg-neutral-900/60">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold">
                    Key {key.index + 1}
                  </CardTitle>
                  <CardDescription className="font-mono text-sm text-neutral-300">
                    {key.maskedKey}
                  </CardDescription>
                </div>
                <CardAction>
                  <Badge className={`${styles.className} ring-1 ring-inset`}>{
                    styles.label
                  }</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{styles.description}</p>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <dt className="text-neutral-400">Last used</dt>
                    <dd>{formatTimestamp(key.lastUsedAt)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-neutral-400">Last success</dt>
                    <dd>{formatTimestamp(key.lastSuccessAt)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-neutral-400">Successes</dt>
                    <dd className="flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-emerald-400" />
                      {key.successCount}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-neutral-400">Failures</dt>
                    <dd className="flex items-center gap-1">
                      <AlertTriangle className="size-3 text-red-400" />
                      {key.failureCount}
                    </dd>
                  </div>
                </dl>
                {key.lastError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    <p className="font-medium">Last error</p>
                    <p className="text-red-100/90">{key.lastError}</p>
                    {key.lastFailureAt && (
                      <p className="mt-2 text-xs uppercase tracking-wide text-red-200/70">
                        Failed at {formatTimestamp(key.lastFailureAt)}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.keys.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/20 p-6 text-center text-muted-foreground">
          No Gemini keys are registered. Add them to <code>GEMINI_API_KEYS</code> in your environment.
        </div>
      )}
    </div>
  );
}
