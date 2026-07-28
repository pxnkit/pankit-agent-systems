import "./test-setup";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ResearchChat } from "@/components/chat/research-chat";

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
      answer:
        "MemEquiv tests whether memory transformations preserve meaning. [source:memequiv-readme]",
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

  render(<ResearchChat />);
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
    await screen.findByText(/MemEquiv tests whether memory transformations/),
  ).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Source 1: MemEquiv" }),
  ).toHaveTextContent("[1]");
  expect(
    screen
      .getAllByRole("link", { name: /MemEquiv/ })
      .some((link) => link.getAttribute("href") === "/projects/memequiv"),
  ).toBe(true);
});

test("Shift+Enter does not submit and clear conversation removes local history", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<ResearchChat />);
  const composer = screen.getByLabelText(
    "Ask about Pankit’s research portfolio",
  );
  fireEvent.change(composer, { target: { value: "Line one" } });
  fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
  expect(fetchMock).not.toHaveBeenCalled();
});
