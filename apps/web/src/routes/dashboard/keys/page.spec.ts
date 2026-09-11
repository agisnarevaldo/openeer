import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("svelte-sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

import KeysPage from "./+page.svelte";

const sampleKey = {
  id: "key-1",
  name: "Production server",
  keyPrefix: "op_live_",
  lastFour: "ab12",
  rateLimitRpm: 60,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastUsedAt: null,
};

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe("API Keys page", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let confirmMock: ReturnType<typeof vi.fn>;
  let clipboardWriteTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    fetchMock = vi.fn();
    confirmMock = vi.fn(() => true);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", confirmMock);
    if (navigator.clipboard) {
      clipboardWriteTextMock = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockResolvedValue(undefined) as unknown as ReturnType<typeof vi.fn>;
    } else {
      clipboardWriteTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: clipboardWriteTextMock },
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates a key and reveals the secret exactly once", async () => {
    // Types a full key name across three chained fetch mocks; occasionally
    // exceeds the 5s default under load, so this one test gets more room.
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ keys: [] }))
      .mockResolvedValueOnce(jsonResponse({ key: "op_live_secret123" }))
      .mockResolvedValueOnce(jsonResponse({ keys: [sampleKey] }));

    const user = userEvent.setup();
    render(KeysPage);

    await screen.findByText(/no api keys yet/i);

    await user.click(screen.getByRole("button", { name: /create api key/i }));
    await user.type(screen.getByLabelText("Name"), "Production server");
    await user.click(screen.getByRole("button", { name: /create key/i }));

    expect(await screen.findByText("op_live_secret123")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/keys",
      expect.objectContaining({ method: "POST" })
    );
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("API key created"));
  }, 10000);

  it("copies the revealed key to the clipboard and shows a toast", async () => {
    // Same create flow as above plus a copy interaction; same headroom.
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ keys: [] }))
      .mockResolvedValueOnce(jsonResponse({ key: "op_live_secret123" }))
      .mockResolvedValueOnce(jsonResponse({ keys: [sampleKey] }));

    const user = userEvent.setup();
    render(KeysPage);

    await screen.findByText(/no api keys yet/i);
    await user.click(screen.getByRole("button", { name: /create api key/i }));
    await user.type(screen.getByLabelText("Name"), "Production server");
    await user.click(screen.getByRole("button", { name: /create key/i }));
    await screen.findByText("op_live_secret123");

    await user.click(screen.getByRole("button", { name: /^copy$/i }));

    await waitFor(() =>
      expect(clipboardWriteTextMock).toHaveBeenCalledWith("op_live_secret123")
    );
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Copied to clipboard"));
    expect(await screen.findByRole("button", { name: /copied!/i })).toBeInTheDocument();
  }, 10000);

  it("revokes a key after confirmation and shows a toast", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ keys: [sampleKey] }))
      .mockResolvedValueOnce(jsonResponse({}));

    const user = userEvent.setup();
    render(KeysPage);

    await screen.findByText("Production server");

    await user.click(screen.getByRole("button", { name: /revoke/i }));

    expect(confirmMock).toHaveBeenCalledWith('Revoke "Production server"? This cannot be undone.');
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/keys/key-1", { method: "DELETE" })
    );
    await waitFor(() => expect(screen.queryByText("Production server")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith('"Production server" revoked')
    );
  });

  it("shows an error toast and keeps the key listed when revoke fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ keys: [sampleKey] }))
      .mockResolvedValueOnce(jsonResponse({ error: "Not found" }, false));

    const user = userEvent.setup();
    render(KeysPage);

    await screen.findByText("Production server");
    await user.click(screen.getByRole("button", { name: /revoke/i }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('Failed to revoke "Production server"')
    );
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(screen.getByText("Production server")).toBeInTheDocument();
  });

  it("does not revoke when the confirmation is dismissed", async () => {
    confirmMock.mockReturnValue(false);
    fetchMock.mockResolvedValueOnce(jsonResponse({ keys: [sampleKey] }));

    const user = userEvent.setup();
    render(KeysPage);

    await screen.findByText("Production server");
    await user.click(screen.getByRole("button", { name: /revoke/i }));

    expect(confirmMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Production server")).toBeInTheDocument();
  });
});
