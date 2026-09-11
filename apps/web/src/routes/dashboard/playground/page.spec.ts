import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PlaygroundPage from "./+page.svelte";

function jsonResponse(body: unknown, ok = true, headers: Record<string, string> = {}) {
  return {
    ok,
    status: ok ? 200 : 500,
    headers: new Headers(headers),
    json: async () => body,
  } as Response;
}

describe("Playground page", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("shows the current model and opens the dropdown to choose one", async () => {
    const user = userEvent.setup();
    render(PlaygroundPage);

    const trigger = screen.getByRole("button", { name: /model/i });
    expect(trigger).toHaveTextContent("mock-gpt-4o");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    // bits-ui's Select content uses a CSS `@starting-style` enter transition
    // that jsdom's limited CSS engine never resolves, so the portaled
    // listbox/option elements never pass testing-library's visibility check
    // even though they're in the DOM — hence asserting on the trigger's own
    // state here rather than driving a click on the (untestable) option.
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.body.innerHTML).toContain('data-value="mock-gpt-4o"');
  });

  it("toggles the streaming switch and includes it in the request", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: "no key" } }, false));

    const user = userEvent.setup();
    render(PlaygroundPage);

    const streamSwitch = screen.getByRole("switch", { name: /stream/i });
    expect(streamSwitch).toHaveAttribute("aria-checked", "false");

    await user.click(streamSwitch);
    expect(streamSwitch).toHaveAttribute("aria-checked", "true");

    await user.type(screen.getByLabelText(/api key/i), "op_live_test");
    await user.type(screen.getByPlaceholderText(/send a test prompt/i), "hello");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, options] = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse(options.body as string);
    expect(sentBody.stream).toBe(true);
  });

  it("sends a message and shows the assistant reply and inspect data", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          choices: [{ message: { content: "Hello there!" } }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        },
        true,
        { "x-request-id": "req-123" }
      )
    );

    const user = userEvent.setup();
    render(PlaygroundPage);

    await user.type(screen.getByLabelText(/api key/i), "op_live_test");
    await user.type(screen.getByPlaceholderText(/send a test prompt/i), "hello");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("Hello there!")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer op_live_test" }),
      })
    );

    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText(/prompt: 5.*completion: 3.*total: 8/i)).toBeInTheDocument();
    expect(screen.getByText(/x-request-id: req-123/i)).toBeInTheDocument();
  });
});
