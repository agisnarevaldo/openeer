<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth-client";

  onMount(async () => {
    const session = await authClient.getSession();
    if (session.data) {
      goto("/dashboard");
    } else {
      goto("/login");
    }
  });
</script>

<div class="flex h-screen w-full items-center justify-center">
  <p class="text-sm text-muted-foreground animate-pulse">Loading Openeer...</p>
</div>
