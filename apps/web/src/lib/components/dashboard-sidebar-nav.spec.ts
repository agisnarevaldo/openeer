import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/dashboard/keys") },
}));

import DashboardSidebarNav from "./dashboard-sidebar-nav.svelte";

describe("DashboardSidebarNav", () => {
  it("marks the nav link for the current route as the active page", () => {
    render(DashboardSidebarNav);

    const activeLink = screen.getByRole("link", { current: "page" });
    expect(activeLink).toHaveTextContent("API Keys");
  });

  it("does not mark other nav links as the active page", () => {
    render(DashboardSidebarNav);

    expect(screen.getByRole("link", { name: /overview/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /request logs/i })).not.toHaveAttribute(
      "aria-current"
    );
    expect(screen.getByRole("link", { name: /playground/i })).not.toHaveAttribute("aria-current");
  });
});
