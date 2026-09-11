<script lang="ts">
  import { onMount } from "svelte";
  import { useSession } from "$lib/auth-client";
  import MetricCard from "$lib/components/metric-card.svelte";

  const session = useSession();

  interface MetricsSummary {
    windowHours: number;
    totalRequests: number;
    totalTokens: number;
    avgLatencyMs: number;
  }

  let metrics = $state<MetricsSummary | null>(null);
  let metricsLoading = $state(true);
  let metricsError = $state("");

  async function loadMetrics() {
    metricsLoading = true;
    metricsError = "";
    try {
      const res = await fetch("/api/metrics/summary");
      if (!res.ok) throw new Error("Failed to load metrics");
      metrics = await res.json();
    } catch (err: any) {
      metricsError = err?.message || "Failed to load metrics";
    } finally {
      metricsLoading = false;
    }
  }

  onMount(loadMetrics);

  function formatNumber(value: number) {
    return value.toLocaleString();
  }
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
    <p class="text-sm text-muted-foreground mt-1">
      Welcome back, {$session.data?.user?.name || "Developer"}. Here is an overview of your Openeer AI Gateway.
    </p>
  </div>

  <div>
    <div class="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
      Last 24 hours
    </div>
    {#if metricsError}
      <div class="rounded-xl border border-destructive/30 bg-destructive/15 p-4 text-sm text-destructive">
        {metricsError}
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Total Requests" description="Requests to the Gateway">
          <span class="text-2xl font-bold">
            {metricsLoading ? "—" : formatNumber(metrics?.totalRequests ?? 0)}
          </span>
        </MetricCard>

        <MetricCard label="Total Tokens" description="Prompt + completion tokens">
          <span class="text-2xl font-bold">
            {metricsLoading ? "—" : formatNumber(metrics?.totalTokens ?? 0)}
          </span>
        </MetricCard>

        <MetricCard label="Avg Latency" description="Across all requests">
          <span class="text-2xl font-bold">
            {metricsLoading ? "—" : `${formatNumber(metrics?.avgLatencyMs ?? 0)}ms`}
          </span>
        </MetricCard>
      </div>
    {/if}
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <MetricCard label="Gateway Status" description="Port 3050 (API) / Port 8088 (Gateway)">
      <span class="text-2xl font-bold text-emerald-400 flex items-center gap-2">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping"></span>
        Operational
      </span>
    </MetricCard>

    <MetricCard label="Authenticated User" description="Authenticated via Better Auth">
      <span class="text-lg font-semibold truncate block">{$session.data?.user?.email}</span>
    </MetricCard>

    <MetricCard label="Active AI Providers" description="Mock Provider (mock-gpt-4o)">
      <span class="text-2xl font-bold">1 Provider</span>
    </MetricCard>
  </div>
</div>
