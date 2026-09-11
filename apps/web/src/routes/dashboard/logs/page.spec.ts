import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LogsPage from "./+page.svelte";

const sampleLog = {
  id: "log-1",
  apiKeyId: "key-1",
  model: "mock-gpt-4o",
  promptTokens: 5,
  completionTokens: 3,
  totalTokens: 8,
  latencyMs: 42,
  statusCode: 200,
  errorMessage: null,
  ipAddress: "127.0.0.1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function makeLogs(count: number, page: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...sampleLog,
    id: `log-p${page}-${i}`,
  }));
}

describe("Request Logs page", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and renders logs with a color-coded status badge", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ logs: [sampleLog], total: 1 }));

    render(LogsPage);

    expect(await screen.findByText("mock-gpt-4o")).toBeInTheDocument();
    const badge = screen.getByText("200");
    expect(badge.className).toContain("emerald");

    expect(fetchMock).toHaveBeenCalledWith("/api/logs?page=1&pageSize=20");
  });

  it("applies status and model filters, resetting to page 1", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ logs: [sampleLog], total: 1 }))
      .mockResolvedValueOnce(jsonResponse({ logs: [sampleLog], total: 1 }));

    const user = userEvent.setup();
    render(LogsPage);
    await screen.findByText("mock-gpt-4o");

    await user.type(screen.getByLabelText(/status code/i), "200");
    await user.type(screen.getByLabelText(/^model$/i), "mock-gpt-4o");
    await user.click(screen.getByRole("button", { name: /apply filters/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/logs?page=1&pageSize=20&statusCode=200&model=mock-gpt-4o"
      )
    );
  });

  it("clears filters and reloads with no filter params", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ logs: [sampleLog], total: 1 }))
      .mockResolvedValueOnce(jsonResponse({ logs: [sampleLog], total: 1 }))
      .mockResolvedValueOnce(jsonResponse({ logs: [sampleLog], total: 1 }));

    const user = userEvent.setup();
    render(LogsPage);
    await screen.findByText("mock-gpt-4o");

    await user.type(screen.getByLabelText(/status code/i), "200");
    await user.click(screen.getByRole("button", { name: /apply filters/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/logs?page=1&pageSize=20&statusCode=200")
    );

    await user.click(screen.getByRole("button", { name: /^clear$/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/logs?page=1&pageSize=20")
    );
    expect(screen.getByLabelText(/status code/i)).toHaveValue("");
  });

  it("paginates to the next and previous page", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ logs: makeLogs(20, 1), total: 25 }))
      .mockResolvedValueOnce(jsonResponse({ logs: makeLogs(5, 2), total: 25 }))
      .mockResolvedValueOnce(jsonResponse({ logs: makeLogs(20, 1), total: 25 }));

    const user = userEvent.setup();
    render(LogsPage);
    await screen.findByText(/page 1 of 2/i);

    const previousButton = screen.getByRole("button", { name: /previous/i });
    const nextButton = screen.getByRole("button", { name: /^next$/i });
    expect(previousButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    await user.click(nextButton);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/logs?page=2&pageSize=20")
    );
    await screen.findByText(/page 2 of 2/i);
    expect(screen.getByRole("button", { name: /^next$/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /previous/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/logs?page=1&pageSize=20")
    );
    await screen.findByText(/page 1 of 2/i);
  });
});
