<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Dialog from "$lib/components/ui/dialog";

  interface ApiKeySummary {
    id: string;
    name: string;
    keyPrefix: string;
    lastFour: string;
    rateLimitRpm: number;
    isActive: boolean;
    createdAt: string;
    lastUsedAt: string | null;
  }

  let keys = $state<ApiKeySummary[]>([]);
  let isLoading = $state(true);
  let loadError = $state("");

  let isCreateOpen = $state(false);
  let newKeyName = $state("");
  let newKeyRateLimit = $state("60");
  let isCreating = $state(false);
  let createError = $state("");
  let revealedKey = $state("");
  let copied = $state(false);

  async function loadKeys() {
    isLoading = true;
    loadError = "";
    try {
      const res = await fetch("/api/keys");
      if (!res.ok) throw new Error("Failed to load API keys");
      const body = await res.json();
      keys = body.keys;
    } catch (err: any) {
      loadError = err?.message || "Failed to load API keys";
    } finally {
      isLoading = false;
    }
  }

  onMount(loadKeys);

  function openCreateDialog() {
    newKeyName = "";
    newKeyRateLimit = "60";
    createError = "";
    revealedKey = "";
    copied = false;
    isCreateOpen = true;
  }

  function closeCreateDialog() {
    isCreateOpen = false;
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    createError = "";
    isCreating = true;

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          rateLimitRpm: Number(newKeyRateLimit),
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Failed to create API key");
      }

      revealedKey = body.key;
      await loadKeys();
    } catch (err: any) {
      createError = err?.message || "Failed to create API key";
    } finally {
      isCreating = false;
    }
  }

  async function copyKey() {
    await navigator.clipboard.writeText(revealedKey);
    copied = true;
  }

  async function revokeKey(key: ApiKeySummary) {
    if (!confirm(`Revoke "${key.name}"? This cannot be undone.`)) return;

    const res = await fetch(`/api/keys/${key.id}`, { method: "DELETE" });
    if (res.ok) {
      keys = keys.filter((k) => k.id !== key.id);
    }
  }

  function formatDate(value: string | null) {
    if (!value) return "Never";
    return new Date(value).toLocaleString();
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">API Keys</h1>
      <p class="text-sm text-muted-foreground mt-1">
        Manage the API Keys used to authenticate requests to the Openeer Gateway.
      </p>
    </div>
    <Button onclick={openCreateDialog}>Create API Key</Button>
  </div>

  <Card class="overflow-hidden p-0">
    {#if isLoading}
      <div class="p-8 text-center text-sm text-muted-foreground">Loading API keys...</div>
    {:else if loadError}
      <div class="p-8 text-center text-sm text-destructive">{loadError}</div>
    {:else if keys.length === 0}
      <div class="p-8 text-center text-sm text-muted-foreground">
        No API keys yet. Create one to start making requests.
      </div>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th class="px-5 py-3 font-medium">Name</th>
            <th class="px-5 py-3 font-medium">Key</th>
            <th class="px-5 py-3 font-medium">Rate limit</th>
            <th class="px-5 py-3 font-medium">Created</th>
            <th class="px-5 py-3 font-medium">Last used</th>
            <th class="px-5 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {#each keys as key (key.id)}
            <tr class="border-b border-border/60 last:border-0">
              <td class="px-5 py-3 font-medium">{key.name}</td>
              <td class="px-5 py-3 font-mono text-xs text-muted-foreground">
                {key.keyPrefix}...{key.lastFour}
              </td>
              <td class="px-5 py-3 text-muted-foreground">{key.rateLimitRpm} rpm</td>
              <td class="px-5 py-3 text-muted-foreground">{formatDate(key.createdAt)}</td>
              <td class="px-5 py-3 text-muted-foreground">{formatDate(key.lastUsedAt)}</td>
              <td class="px-5 py-3 text-right">
                <button
                  onclick={() => revokeKey(key)}
                  class="cursor-pointer text-xs font-medium text-destructive/80 transition-colors hover:text-destructive"
                >
                  Revoke
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </Card>
</div>

<Dialog.Root bind:open={isCreateOpen}>
  <Dialog.Content>
    {#if revealedKey}
      <Dialog.Title>API Key created</Dialog.Title>
      <Dialog.Description>
        Copy this key now — you won't be able to see it again.
      </Dialog.Description>

      <div class="mt-4 flex items-center gap-2">
        <code class="flex-1 truncate rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs">
          {revealedKey}
        </code>
        <Button size="sm" onclick={copyKey}>{copied ? "Copied!" : "Copy"}</Button>
      </div>

      <div class="mt-6 flex justify-end">
        <Button variant="secondary" onclick={closeCreateDialog}>Done</Button>
      </div>
    {:else}
      <Dialog.Title>Create API Key</Dialog.Title>
      <Dialog.Description>
        Generate a new secret key to authenticate requests to the Gateway.
      </Dialog.Description>

      <form onsubmit={handleCreate} class="mt-4 space-y-4">
        {#if createError}
          <div class="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-sm text-destructive">
            {createError}
          </div>
        {/if}

        <div>
          <Label for="key-name">Name</Label>
          <Input
            id="key-name"
            bind:value={newKeyName}
            required
            placeholder="e.g. Production server"
          />
        </div>

        <div>
          <Label for="key-rate-limit">Rate limit (requests per minute)</Label>
          <Input
            id="key-rate-limit"
            type="number"
            min="1"
            bind:value={newKeyRateLimit}
            required
          />
        </div>

        <div class="flex justify-end gap-2">
          <Button type="button" variant="secondary" onclick={closeCreateDialog}>Cancel</Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Key"}
          </Button>
        </div>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>
