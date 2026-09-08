<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { authClient, signOut } from "$lib/auth-client";

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
    <aside class="w-64 border-r border-border bg-card/40 flex flex-col p-4 justify-between">
      <div class="space-y-6">
        <div class="flex items-center gap-2.5 px-2">
          <div class="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white shadow-sm">
            O
          </div>
          <div>
            <div class="font-bold tracking-tight leading-none">Openeer</div>
            <div class="text-[11px] text-muted-foreground mt-0.5 font-mono">AI Gateway</div>
          </div>
        </div>

        <nav class="space-y-1">
          <a
            href="/dashboard"
            class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary/60 transition-colors"
          >
            <span>📊</span> Overview
          </a>
          <a
            href="/dashboard/keys"
            class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary/60 transition-colors"
          >
            <span>🔑</span> API Keys
          </a>
          <a
            href="/dashboard/logs"
            class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary/60 transition-colors"
          >
            <span>📜</span> Request Logs
          </a>
          <a
            href="/dashboard/playground"
            class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary/60 transition-colors"
          >
            <span>💬</span> Playground
          </a>
        </nav>
      </div>

      <div class="border-t border-border/80 pt-4 px-2">
        <div class="mb-3">
          <p class="text-sm font-medium truncate">{session.user.name}</p>
          <p class="text-xs text-muted-foreground truncate">{session.user.email}</p>
        </div>
        <button
          onclick={handleSignOut}
          class="w-full text-left text-xs font-medium text-destructive/80 hover:text-destructive transition-colors py-1 cursor-pointer"
        >
          Sign out →
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 p-8 overflow-y-auto">
      {@render children()}
    </main>
  </div>
{/if}
