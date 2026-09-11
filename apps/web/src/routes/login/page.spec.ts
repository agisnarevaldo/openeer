import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInEmailMock, gotoMock } = vi.hoisted(() => ({
  signInEmailMock: vi.fn(),
  gotoMock: vi.fn(),
}));

vi.mock("$lib/auth-client", () => ({
  signIn: { email: signInEmailMock },
}));

vi.mock("$app/navigation", () => ({
  goto: gotoMock,
}));

import LoginPage from "./+page.svelte";

describe("Login page", () => {
  beforeEach(() => {
    signInEmailMock.mockReset();
    gotoMock.mockReset();
  });

  it("does not submit when required fields are left empty", async () => {
    const user = userEvent.setup();
    render(LoginPage);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(signInEmailMock).not.toHaveBeenCalled();
  });

  it("signs in with the entered credentials and redirects to /dashboard", async () => {
    signInEmailMock.mockResolvedValue({ data: { user: {} }, error: null });
    const user = userEvent.setup();
    render(LoginPage);

    await user.type(screen.getByLabelText(/email address/i), "dev@openeer.local");
    await user.type(screen.getByLabelText(/password/i), "openeer123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(signInEmailMock).toHaveBeenCalledWith({
        email: "dev@openeer.local",
        password: "openeer123",
      })
    );
    await waitFor(() => expect(gotoMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows the API error message and does not redirect on failure", async () => {
    signInEmailMock.mockResolvedValue({
      data: null,
      error: { message: "Invalid email or password" },
    });
    const user = userEvent.setup();
    render(LoginPage);

    await user.type(screen.getByLabelText(/email address/i), "dev@openeer.local");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(gotoMock).not.toHaveBeenCalled();
  });
});
