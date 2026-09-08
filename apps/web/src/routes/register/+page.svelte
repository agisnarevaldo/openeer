<script lang="ts">
  import { goto } from "$app/navigation";
  import { signUp } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import { Card } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  let name = $state("");
  let email = $state("");
  let password = $state("");
  let errorMsg = $state("");
  let isLoading = $state(false);

  async function handleRegister(e: SubmitEvent) {
    e.preventDefault();
    errorMsg = "";
    isLoading = true;

    try {
      const res = await signUp.email({
        name,
        email,
        password,
      });

      if (res.error) {
        errorMsg = res.error.message || "Failed to register user. Please try again.";
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
  <Card class="w-full max-w-md p-8 shadow-2xl">
    <div class="mb-6 text-center">
      <div class="inline-flex items-center justify-center gap-2 mb-2">
        <div class="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white">
          O
        </div>
        <span class="text-2xl font-bold tracking-tight">Openeer</span>
      </div>
      <p class="text-sm text-muted-foreground">Register as a developer on Openeer</p>
    </div>

    {#if errorMsg}
      <div class="mb-4 rounded-lg bg-destructive/15 border border-destructive/30 p-3 text-sm text-destructive">
        {errorMsg}
      </div>
    {/if}

    <form onsubmit={handleRegister} class="space-y-4">
      <div>
        <Label for="name">Full name</Label>
        <Input
          id="name"
          type="text"
          bind:value={name}
          required
          placeholder="Jane Doe"
        />
      </div>

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
          minlength={8}
          placeholder="At least 8 characters"
        />
      </div>

      <Button type="submit" disabled={isLoading} class="w-full">
        {isLoading ? "Registering..." : "Register"}
      </Button>
    </form>

    <div class="mt-6 text-center text-sm text-muted-foreground">
      Already registered?
      <a href="/login" class="font-medium text-primary hover:underline ml-1">
        Sign in
      </a>
    </div>
  </Card>
</div>
