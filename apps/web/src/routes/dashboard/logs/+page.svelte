<script lang="ts">
  import { onMount } from "svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";

  interface RequestLogEntry {
    id: string;
    apiKeyId: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    statusCode: number;
    errorMessage: string | null;
    ipAddress: string | null;
    createdAt: string;
  }

  const PAGE_SIZE = 20;

  let logs = $state<RequestLogEntry[]>([]);
  let total = $state(0);
  let page = $state(1);
  let isLoading = $state(true);
  let loadError = $state("");

  let statusFilter = $state("");
  let modelFilter = $state("");
  let fromFilter = $state("");
  let toFilter = $state("");

  const totalPages = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));

  function buildQuery() {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (statusFilter) params.set("statusCode", statusFilter);
    if (modelFilter) params.set("model", modelFilter);
    if (fromFilter) params.set("from", new Date(fromFilter).toISOString());
    if (toFilter) params.set("to", new Date(toFilter).toISOString());
    return params.toString();
  }

  async function loadLogs() {
    isLoading = true;
    loadError = "";
    try {
      const res = await fetch(`/api/logs?${buildQuery()}`);
      if (!res.ok) throw new Error("Failed to load request logs");
      const body = await res.json();
      logs = body.logs;
      total = body.total;
    } catch (err: any) {
      loadError = err?.message || "Failed to load request logs";
    } finally {
      isLoading = false;
    }
  }

  onMount(loadLogs);

  function applyFilters() {
    page = 1;
    loadLogs();
  }

  function clearFilters() {
    statusFilter = "";
    modelFilter = "";
    fromFilter = "";
    toFilter = "";
    applyFilters();
  }

  function goToPage(next: number) {
    if (next < 1 || next > totalPages) return;
    page = next;
    loadLogs();
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString();
  }

  function statusBadgeClass(status: number) {
    if (status >= 200 && status < 300) return "bg-emerald-400/15 text-emerald-400";
    if (status === 429) return "bg-amber-400/15 text-amber-400";
    if (status >= 400 && status < 500) return "bg-orange-400/15 text-orange-400";
    return "bg-destructive/15 text-destructive";
  }

  function latencyClass(ms: number) {
    if (ms < 200) return "text-emerald-400";
    if (ms < 1000) return "text-amber-400";
    return "text-destructive";
  }
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold tracking-tight">Request Logs</h1>
    <p class="text-sm text-muted-foreground mt-1">
      Inspect, search, and filter every request processed by the Gateway.
    </p>
  </div>

  <Card class="p-4">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <div>
        <Label for="filter-status">Status code</Label>
        <Input id="filter-status" placeholder="e.g. 200" bind:value={statusFilter} />
      </div>
      <div>
        <Label for="filter-model">Model</Label>
        <Input id="filter-model" placeholder="e.g. mock-gpt-4o" bind:value={modelFilter} />
      </div>
      <div>
        <Label for="filter-from">From</Label>
        <Input id="filter-from" type="datetime-local" bind:value={fromFilter} />
      </div>
      <div>
        <Label for="filter-to">To</Label>
        <Input id="filter-to" type="datetime-local" bind:value={toFilter} />
      </div>
    </div>
    <div class="mt-3 flex justify-end gap-2">
      <Button variant="secondary" onclick={clearFilters}>Clear</Button>
      <Button onclick={applyFilters}>Apply filters</Button>
    </div>
  </Card>

  <Card class="overflow-hidden p-0">
    {#if isLoading}
      <div class="p-8 text-center text-sm text-muted-foreground">Loading request logs...</div>
    {:else if loadError}
      <div class="p-8 text-center text-sm text-destructive">{loadError}</div>
    {:else if logs.length === 0}
      <div class="p-8 text-center text-sm text-muted-foreground">
        No request logs yet. Send a request to the Gateway to see it here.
      </div>
    {:else}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Tokens</TableHead>
            <TableHead>Latency</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each logs as log (log.id)}
            <TableRow>
              <TableCell>
                <Badge class={statusBadgeClass(log.statusCode)}>{log.statusCode}</Badge>
              </TableCell>
              <TableCell class="font-mono text-xs">{log.model}</TableCell>
              <TableCell class="text-muted-foreground">{log.totalTokens}</TableCell>
              <TableCell class={`font-medium ${latencyClass(log.latencyMs)}`}>{log.latencyMs}ms</TableCell>
              <TableCell class="text-muted-foreground whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
              <TableCell class="max-w-[220px] truncate text-xs text-destructive/80">
                {log.errorMessage || "—"}
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>

      <div class="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
        <span class="text-muted-foreground">Page {page} of {totalPages} ({total} total)</span>
        <div class="flex gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onclick={() => goToPage(page - 1)}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onclick={() => goToPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    {/if}
  </Card>
</div>
