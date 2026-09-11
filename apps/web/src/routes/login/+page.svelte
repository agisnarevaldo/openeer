<script lang="ts">
  import { goto } from "$app/navigation";
  import { signIn } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import BrandLockup from "$lib/components/brand-lockup.svelte";

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
  <Card class="w-full max-w-md shadow-2xl">
    <CardHeader class="flex flex-col items-center text-center gap-2">
      <BrandLockup />
      <CardDescription>Sign in to your developer gateway dashboard</CardDescription>
    </CardHeader>

    <CardContent class="space-y-4">
      {#if errorMsg}
        <div class="rounded-lg bg-destructive/15 border border-destructive/30 p-3 text-sm text-destructive">
          {errorMsg}
        </div>
      {/if}

      <form onsubmit={handleLogin} class="space-y-4">
        <div>
          <Label for="email">Email address</Label>
          <Input
            id="email"
            type="email"
            bind:value={email}
            required
            placeholder="you@company.com"
          />
        </div>

        <div>
          <Label for="password">Password</Label>
          <Input
            id="password"
            type="password"
            bind:value={password}
            required
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" disabled={isLoading} class="w-full">
          {isLoading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </CardContent>

    <CardFooter class="justify-center text-sm text-muted-foreground">
      New to Openeer?
      <a href="/register" class="font-medium text-primary hover:underline ml-1">
        Register here
      </a>
    </CardFooter>
  </Card>
</div>
