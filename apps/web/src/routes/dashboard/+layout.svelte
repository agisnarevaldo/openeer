<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { authClient, signOut } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import DashboardSidebarNav from "$lib/components/dashboard-sidebar-nav.svelte";
  import LogOutIcon from "@lucide/svelte/icons/log-out";

  let { children } = $props();
  let session = $state<any>(null);
  let isChecking = $state(true);

  onMount(async () => {
    try {
      const res = await authClient.getSession();
      if (!res.data?.session) {
        goto("/login");
      } else {
        session = res.data;
      }
    } catch {
      goto("/login");
    } finally {
      isChecking = false;
    }
  });

  async function handleSignOut() {
    await signOut();
    goto("/login");
  }
</script>

{#if isChecking}
  <div class="flex h-screen w-full items-center justify-center">
    <p class="text-sm text-muted-foreground animate-pulse">Authenticating...</p>
  </div>
{:else if session}
  <div class="flex min-h-screen bg-background text-foreground">
    <!-- Sidebar -->
    <aside class="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col p-4 justify-between">
      <div class="space-y-6">
        <div class="flex items-center gap-2.5 px-2">
          <img src="/brand/Openeer-Mark-White.svg" alt="" class="h-8 w-8" />
          <div>
            <div class="font-bold tracking-tight leading-none">Openeer</div>
            <div class="text-[11px] text-muted-foreground mt-0.5 font-mono">AI Gateway</div>
          </div>
        </div>

        <DashboardSidebarNav />
      </div>

      <div class="border-t border-sidebar-border pt-4 px-2">
        <div class="mb-3">
          <p class="text-sm font-medium truncate">{session.user.name}</p>
          <p class="text-xs text-muted-foreground truncate">{session.user.email}</p>
        </div>
        <Button variant="ghost" size="sm" class="w-full justify-start px-0 text-destructive hover:text-destructive" onclick={handleSignOut}>
          <LogOutIcon class="size-4" />
          Sign out
        </Button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 p-8 overflow-y-auto">
      {@render children()}
    </main>
  </div>
{/if}
