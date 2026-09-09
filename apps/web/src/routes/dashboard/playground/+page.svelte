<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Card } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  interface ChatMessage {
    role: "user" | "assistant";
    content: string;
  }

  interface InspectData {
    status: number;
    latencyMs: number;
    headers: Record<string, string>;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
    error: string | null;
  }

  const MODELS = ["mock-gpt-4o"];
  const API_KEY_STORAGE_KEY = "openeer_playground_api_key";

  let apiKey = $state("");
  let model = $state(MODELS[0]);
  let streaming = $state(false);
  let messages = $state<ChatMessage[]>([]);
  let draft = $state("");
  let isSending = $state(false);
  let sendError = $state("");
  let inspect = $state<InspectData | null>(null);

  try {
    apiKey = localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall back to empty
  }

  function persistApiKey() {
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    } catch {
      // ignore — nothing to persist to
    }
  }

  function headersToObject(headers: Headers): Record<string, string> {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }

  function clearConversation() {
    messages = [];
    inspect = null;
    sendError = "";
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || isSending) return;
    if (!apiKey.trim()) {
      sendError = "Enter an API key above to send requests.";
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    messages = nextMessages;
    draft = "";
    isSending = true;
    sendError = "";

    const start = performance.now();

    try {
      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({ model, messages: nextMessages, stream: streaming }),
      });

      const headers = headersToObject(res.headers);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body?.error?.message || `Request failed with status ${res.status}`;
        sendError = message;
        inspect = {
          status: res.status,
          latencyMs: Math.round(performance.now() - start),
          headers,
          usage: null,
          error: message,
        };
        return;
      }

      if (streaming && res.body) {
        messages = [...messages, { role: "assistant", content: "" }];
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";

            for (const event of events) {
              const line = event.trim();
              if (!line.startsWith("data: ")) continue;
              const data = line.slice("data: ".length);
              if (data === "[DONE]") continue;

              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;
                messages[messages.length - 1] = { role: "assistant", content: assistantContent };
                messages = [...messages];
              }
            }
          }

          inspect = {
            status: res.status,
            latencyMs: Math.round(performance.now() - start),
            headers,
            usage: null,
            error: null,
          };
        } catch (streamErr: any) {
          // The server can send a 200 SSE response and only fail partway
          // through (headers are already committed by then), so surface
          // the same status/latency/headers here as the !res.ok branch does.
          const message = streamErr?.message || "Streaming response failed";
          sendError = message;
          inspect = {
            status: res.status,
            latencyMs: Math.round(performance.now() - start),
            headers,
            usage: null,
            error: message,
          };
        }
      } else {
        const body = await res.json();
        messages = [
          ...messages,
          { role: "assistant", content: body.choices[0].message.content },
        ];
        inspect = {
          status: res.status,
          latencyMs: Math.round(performance.now() - start),
          headers,
          usage: {
            promptTokens: body.usage.prompt_tokens,
            completionTokens: body.usage.completion_tokens,
            totalTokens: body.usage.total_tokens,
          },
          error: null,
        };
      }
    } catch (err: any) {
      sendError = err?.message || "Request failed";
    } finally {
      isSending = false;
    }
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    sendMessage();
  }

  function statusClass(status: number) {
    if (status >= 200 && status < 300) return "text-emerald-400";
    if (status === 429) return "text-amber-400";
    return "text-destructive";
  }
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold tracking-tight">Playground</h1>
    <p class="text-sm text-muted-foreground mt-1">
      Send test prompts to the Gateway and inspect the raw response.
    </p>
  </div>

  <Card class="p-4">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
      <div class="sm:col-span-2">
        <Label for="playground-api-key">API Key</Label>
        <Input
          id="playground-api-key"
          type="password"
          placeholder="op_live_..."
          bind:value={apiKey}
          oninput={persistApiKey}
        />
      </div>

      <div>
        <Label for="playground-model">Model</Label>
        <select
          id="playground-model"
          bind:value={model}
          class="flex h-10 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#each MODELS as m (m)}
            <option value={m}>{m}</option>
          {/each}
        </select>
      </div>

      <div class="flex items-center gap-2 pb-2">
        <input
          id="playground-streaming"
          type="checkbox"
          bind:checked={streaming}
          class="h-4 w-4 rounded border-border accent-primary"
        />
        <Label for="playground-streaming" class="mb-0">Stream (SSE)</Label>
      </div>
    </div>
  </Card>

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <Card class="flex min-h-[420px] flex-col p-0 lg:col-span-2">
      <div class="flex items-center justify-between border-b border-border px-5 py-3">
        <span class="text-sm font-medium">Conversation</span>
        <Button variant="secondary" size="sm" onclick={clearConversation}>Clear</Button>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto p-5">
        {#if messages.length === 0}
          <p class="text-sm text-muted-foreground">
            No messages yet. Send a prompt below to try the Gateway.
          </p>
        {/if}
        {#each messages as message, i (i)}
          <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
            <div
              class="max-w-[80%] rounded-xl px-4 py-2 text-sm {message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/60 text-foreground'}"
            >
              <div class="mb-0.5 text-[10px] uppercase tracking-wider opacity-70">
                {message.role}
              </div>
              {message.content || (isSending && message.role === "assistant" ? "…" : "")}
            </div>
          </div>
        {/each}
      </div>

      {#if sendError}
        <div class="mx-5 mb-3 rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-sm text-destructive">
          {sendError}
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="flex gap-2 border-t border-border p-4">
        <Input
          placeholder="Send a test prompt..."
          bind:value={draft}
          disabled={isSending}
        />
        <Button type="submit" disabled={isSending || !draft.trim()}>
          {isSending ? "Sending..." : "Send"}
        </Button>
      </form>
    </Card>

    <Card class="p-5">
      <div class="mb-3 text-sm font-medium">Inspect</div>
      {#if !inspect}
        <p class="text-sm text-muted-foreground">
          Send a request to see its status, latency, tokens, and headers here.
        </p>
      {:else}
        <div class="space-y-4 text-sm">
          <div>
            <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</div>
            <div class="mt-1 font-semibold {statusClass(inspect.status)}">{inspect.status}</div>
          </div>

          <div>
            <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Latency</div>
            <div class="mt-1 font-semibold">{inspect.latencyMs}ms</div>
          </div>

          {#if inspect.usage}
            <div>
              <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tokens</div>
              <div class="mt-1 text-xs text-muted-foreground">
                Prompt: {inspect.usage.promptTokens} · Completion: {inspect.usage.completionTokens} · Total: {inspect.usage.totalTokens}
              </div>
            </div>
          {/if}

          <div>
            <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Headers</div>
            <div class="mt-1 space-y-0.5 font-mono text-xs text-muted-foreground">
              {#each Object.entries(inspect.headers) as [key, value] (key)}
                <div class="truncate">{key}: {value}</div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </Card>
  </div>
</div>
