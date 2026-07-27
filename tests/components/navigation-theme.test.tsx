import "./test-setup";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { GlobalNavigation } from "@/components/navigation/global-navigation";

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

test("segmented switch marks Chat active and keeps both real links", () => {
  render(<GlobalNavigation />);
  expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("link", { name: "Portfolio" })).toHaveAttribute(
    "href",
    "/portfolio",
  );
});

test("theme control persists an explicit preference", () => {
  render(<GlobalNavigation />);
  const theme = screen.getByRole("button", { name: "Use dark theme" });
  fireEvent.click(theme);
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("pxnkit-theme")).toBe("dark");
  expect(theme).toHaveAccessibleName("Use light theme");
});
