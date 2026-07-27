import "./test-setup";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ChatShell } from "@/components/chat/chat-shell";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

test("suggestion fills the composer and Enter submits", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    Response.json({
      answer: "MemEquiv tests whether memory transformations preserve meaning.",
      sources: [
        {
          id: "memequiv-readme",
          title: "MemEquiv",
          internalUrl: "/projects/memequiv",
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  render(<ChatShell />);
  fireEvent.click(
    screen.getByRole("button", { name: "Explain MemEquiv in simple terms." }),
  );
  const composer = screen.getByLabelText(
    "Ask about Pankit’s research portfolio",
  );
  expect(composer).toHaveValue("Explain MemEquiv in simple terms.");
  fireEvent.keyDown(composer, { key: "Enter" });

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(
    await screen.findByText(
      "MemEquiv tests whether memory transformations preserve meaning.",
    ),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: /MemEquiv/ })).toHaveAttribute(
    "href",
    "/projects/memequiv",
  );
});

test("Shift+Enter does not submit and clear conversation removes local history", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<ChatShell />);
  const composer = screen.getByLabelText(
    "Ask about Pankit’s research portfolio",
  );
  fireEvent.change(composer, { target: { value: "Line one" } });
  fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
  expect(fetchMock).not.toHaveBeenCalled();
});
