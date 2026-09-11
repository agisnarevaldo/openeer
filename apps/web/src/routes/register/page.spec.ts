import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signUpEmailMock, gotoMock } = vi.hoisted(() => ({
  signUpEmailMock: vi.fn(),
  gotoMock: vi.fn(),
}));

vi.mock("$lib/auth-client", () => ({
  signUp: { email: signUpEmailMock },
}));

vi.mock("$app/navigation", () => ({
  goto: gotoMock,
}));

import RegisterPage from "./+page.svelte";

describe("Register page", () => {
  beforeEach(() => {
    signUpEmailMock.mockReset();
    gotoMock.mockReset();
  });

  it("does not submit when required fields are left empty", async () => {
    const user = userEvent.setup();
    render(RegisterPage);

    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(signUpEmailMock).not.toHaveBeenCalled();
  });

  it("registers with the entered details and redirects to /dashboard", async () => {
    signUpEmailMock.mockResolvedValue({ data: { user: {} }, error: null });
    const user = userEvent.setup();
    render(RegisterPage);

    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/email address/i), "jane@openeer.local");
    await user.type(screen.getByLabelText(/password/i), "supersecret1");
    await user.click(screen.getByRole("button", { name: /register/i }));

    await waitFor(() =>
      expect(signUpEmailMock).toHaveBeenCalledWith({
        name: "Jane Doe",
        email: "jane@openeer.local",
        password: "supersecret1",
      })
    );
    await waitFor(() => expect(gotoMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows the API error message and does not redirect on failure", async () => {
    signUpEmailMock.mockResolvedValue({
      data: null,
      error: { message: "Email already registered" },
    });
    const user = userEvent.setup();
    render(RegisterPage);

    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/email address/i), "jane@openeer.local");
    await user.type(screen.getByLabelText(/password/i), "supersecret1");
    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
    expect(gotoMock).not.toHaveBeenCalled();
  });
});
