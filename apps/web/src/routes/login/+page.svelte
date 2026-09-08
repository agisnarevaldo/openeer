<script lang="ts">
  import { goto } from "$app/navigation";
  import { signIn } from "$lib/auth-client";

  let email = $state("");
  let password = $state("");
  let errorMsg = $state("");
  let isLoading = $state(false);

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    errorMsg = "";
    isLoading = true;

    try {
      const res = await signIn.email({
        email,
        password,
      });

      if (res.error) {
        errorMsg = res.error.message || "Failed to sign in. Please check your credentials.";
      } else {
        goto("/dashboard");
      }
    } catch (err: any) {
      errorMsg = err?.message || "An unexpected error occurred.";
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center p-4">
  <div class="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-2xl">
    <div class="mb-6 text-center">
      <div class="inline-flex items-center justify-center gap-2 mb-2">
        <div class="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white">
          O
        </div>
        <span class="text-2xl font-bold tracking-tight">Openeer</span>
      </div>
      <p class="text-sm text-muted-foreground">Sign in to your developer gateway dashboard</p>
    </div>

    {#if errorMsg}
      <div class="mb-4 rounded-lg bg-destructive/15 border border-destructive/30 p-3 text-sm text-destructive">
        {errorMsg}
      </div>
    {/if}

    <form onsubmit={handleLogin} class="space-y-4">
      <div>
        <label for="email" class="block text-sm font-medium mb-1.5">Email address</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          placeholder="you@company.com"
          class="w-full rounded-lg border border-border bg-secondary/50 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium mb-1.5">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          placeholder="••••••••"
          class="w-full rounded-lg border border-border bg-secondary/50 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        class="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-all cursor-pointer"
      >
        {isLoading ? "Signing in..." : "Sign In"}
      </button>
    </form>

    <div class="mt-6 text-center text-sm text-muted-foreground">
      Don't have an account?
      <a href="/register" class="font-medium text-primary hover:underline ml-1">
        Create an account
      </a>
    </div>
  </div>
</div>
