<script lang="ts">
  import { useSession } from "$lib/auth-client";

  const session = useSession();
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
    <p class="text-sm text-muted-foreground mt-1">
      Welcome back, {$session.data?.user?.name || "Developer"}. Here is an overview of your Openeer AI Gateway.
    </p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="rounded-xl border border-border bg-card p-5">
      <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gateway Status</div>
      <div class="mt-2 text-2xl font-bold text-emerald-400 flex items-center gap-2">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping"></span>
        Operational
      </div>
      <div class="mt-1 text-xs text-muted-foreground">Port 3050 (API) / Port 8088 (Gateway)</div>
    </div>

    <div class="rounded-xl border border-border bg-card p-5">
      <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Tenant</div>
      <div class="mt-2 text-lg font-semibold truncate">{$session.data?.user?.email}</div>
      <div class="mt-1 text-xs text-muted-foreground">Authenticated via Better Auth</div>
    </div>

    <div class="rounded-xl border border-border bg-card p-5">
      <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active AI Providers</div>
      <div class="mt-2 text-2xl font-bold">1 Provider</div>
      <div class="mt-1 text-xs text-muted-foreground">Mock Provider (mock-gpt-4o)</div>
    </div>
  </div>
</div>
