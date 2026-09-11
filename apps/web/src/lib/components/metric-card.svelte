<script lang="ts">
  import { Card, CardContent } from "$lib/components/ui/card";
  import type { Snippet } from "svelte";

  let {
    label,
    description,
    children,
  }: { label: string; description: string; children: Snippet } = $props();
</script>

<Card class="min-w-0">
  <CardContent>
    <div class="truncate text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
    <div class="mt-2 min-w-0">{@render children()}</div>
    <div class="mt-1 text-xs text-muted-foreground">{description}</div>
  </CardContent>
</Card>
