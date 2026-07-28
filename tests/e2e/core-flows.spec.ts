import { expect, test } from "@playwright/test";

async function submitQuestion(
  page: import("@playwright/test").Page,
  question: string,
) {
  const composer = page.getByLabel("Ask about Pankit’s research portfolio");
  await composer.fill(question);
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible({
    timeout: 15_000,
  });
}

test("chat is the default mode and composer is usable", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Chat", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Portfolio", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Follow the evidence." }),
  ).toBeVisible();
  await expect(page.getByLabel("Suggested questions")).toBeVisible();
  await expect(
    page.getByLabel("Ask about Pankit’s research portfolio"),
  ).toBeEditable();
});

test("real route switch preserves browser history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Portfolio", exact: true }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(
    page.getByRole("heading", { name: "Search. Remember. Verify. Act." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Portfolio", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Follow the evidence." }),
  ).toBeVisible();
});

test("suggested question receives a grounded mock response", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const composer = page.getByLabel("Ask about Pankit’s research portfolio");
  const send = page.getByRole("button", { name: "Send question" });
  await page
    .getByRole("button", { name: "Explain MemEquiv in simple terms." })
    .click();
  await expect(composer).toHaveValue("Explain MemEquiv in simple terms.");
  await expect(send).toBeEnabled();
  await send.click();
  await expect(
    page.getByText("Explain MemEquiv in simple terms."),
  ).toBeVisible();
  await expect(page.getByText("Portfolio guide")).toBeVisible();
  await expect(page.getByLabel("Sources")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("link", { name: /MemEquiv/i }).first(),
  ).toHaveAttribute("href", "/projects/memequiv");
});

test("identity question returns the verified profile source", async ({
  page,
}) => {
  await page.goto("/");
  await submitQuestion(page, "Who is Pankit?");
  await expect(
    page.getByText(
      /Pankit Brahmkhatri is a Master's CS student at TU Dresden/i,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Source 1: Profile — Identity/i }),
  ).toHaveAttribute("href", "/portfolio");
  await expect(
    page.locator("a.source-card", { hasText: "Profile — Identity" }),
  ).toHaveAttribute("href", "/portfolio");
});

test("research-connection question returns the complete project map", async ({
  page,
}) => {
  await page.goto("/");
  await submitQuestion(page, "What connects Pankit's agent-memory projects?");
  await expect(
    page.getByText(/memory is treated as a decision system/i),
  ).toBeVisible();
  await expect(page.getByText(/RKA-Lab covers recognition/i)).toBeVisible();
  await expect(page.getByText(/MemEquiv covers correction/i)).toBeVisible();
  await expect(page.getByLabel("Sources").getByRole("link")).toHaveCount(2);
});

test("project comparison represents both requested systems", async ({
  page,
}) => {
  await page.goto("/");
  await submitQuestion(page, "Compare RKA-Lab and MemIntervene");
  await expect(page.getByText(/RKA-Lab/i).last()).toBeVisible();
  await expect(page.getByText(/MemIntervene/i).last()).toBeVisible();
  await expect(
    page.getByRole("link", { name: /RKA-Lab/i }).last(),
  ).toHaveAttribute("href", "/projects/rka-lab");
  await expect(
    page.getByRole("link", { name: /MemIntervene/i }).last(),
  ).toHaveAttribute("href", "/projects/memintervene");
});

test("pending ChaffMem answer preserves the evidence boundary", async ({
  page,
}) => {
  await page.goto("/");
  await submitQuestion(page, "What is known about ChaffMem?");
  await expect(
    page.getByText(
      /no architecture, results, implementation, or repository is inferred/i,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/verified public details are pending/i),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /ChaffMem/i }).first(),
  ).toHaveAttribute("href", "/projects/chaffmem");
});

test("quota fallback remains useful and exposes verified sources", async ({
  page,
}) => {
  const events = [
    {
      type: "metadata",
      requestId: "quota-test",
      aiMode: "cloudflare",
      responseMode: "retrieval-only",
      intent: "unknown",
      sourceCount: 1,
    },
    {
      type: "fallback",
      reason: "provider-quota-or-capacity",
      message:
        "Generated answers are temporarily unavailable. Here are the most relevant verified portfolio sources.",
    },
    {
      type: "source-list",
      sources: [
        {
          id: "curated:profile",
          title: "Profile — Research focus",
          excerpt: "Verified portfolio profile.",
          type: "profile",
          internalUrl: "/portfolio",
        },
      ],
    },
    {
      type: "text-delta",
      text: "The verified profile and project catalogue remain available.",
    },
    { type: "completion", requestId: "quota-test", status: "complete" },
  ];
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body: events
        .map(
          (event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
        )
        .join(""),
    });
  });
  await page.goto("/");
  await submitQuestion(page, "How do the systems handle uncertainty?");
  await expect(
    page.getByText(
      "Generated answers are temporarily unavailable. Here are the most relevant verified portfolio sources.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Profile — Research focus/i }),
  ).toHaveAttribute("href", "/portfolio");
});

test("cancelling a stream restores the composer", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (!String(input).includes("/api/chat")) {
        return originalFetch(input, init);
      }
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `event: metadata\ndata: ${JSON.stringify({
                type: "metadata",
                requestId: "cancel-test",
                aiMode: "mock",
                responseMode: "mock",
                sourceCount: 0,
              })}\n\n`,
            ),
          );
          init?.signal?.addEventListener("abort", () => {
            controller.error(new DOMException("Aborted", "AbortError"));
          });
        },
      });
      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        }),
      );
    };
  });
  await page.goto("/");
  const composer = page.getByLabel("Ask about Pankit’s research portfolio");
  await composer.fill("Keep generating until I stop.");
  await page.getByRole("button", { name: "Send question" }).click();
  const stop = page.getByRole("button", { name: "Stop generation" });
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(
    page.getByLabel("Conversation").getByText("Generation stopped."),
  ).toBeVisible();
  await expect(composer).toBeEditable();
});

test("verified MemEquiv and pending shortlist pages stay honest", async ({
  page,
}) => {
  await page.goto("/projects/memequiv");
  await expect(page.getByRole("heading", { name: "MemEquiv" })).toBeVisible();
  const repo = page.getByRole("link", { name: "View GitHub ↗" });
  await expect(repo).toHaveAttribute(
    "href",
    "https://github.com/pxnkit/memequiv",
  );
  await expect(
    page.getByRole("link", { name: "Ask about this project" }),
  ).toBeVisible();

  await page.goto("/projects/chaffmem");
  await expect(page.getByRole("heading", { name: "ChaffMem" })).toBeVisible();
  await expect(page.getByText("Rank 1 · Project 24")).toBeVisible();
  await expect(page.getByText("Verified details pending")).toBeVisible();
  await expect(
    page.locator("main").getByRole("link", { name: /repository on GitHub/i }),
  ).toHaveCount(0);
});

test("catalogue search and filters work locally", async ({ page }) => {
  await page.goto("/projects");
  const search = page.getByRole("searchbox", { name: "Search projects" });
  await search.fill("memory correction");
  await expect(page.locator(".catalogue-summary")).toContainText("project");
  await search.fill("no-project-has-this-phrase");
  await expect(
    page.getByRole("heading", { name: "Try a broader research term." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Verification", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Verification", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("writing empty state and custom 404 are polished", async ({ page }) => {
  await page.goto("/writing");
  await expect(
    page.getByRole("heading", { name: "Research notes are being prepared." }),
  ).toBeVisible();
  await expect(page.getByText("No published articles yet")).toBeVisible();

  await page.goto("/this-route-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "This source is not in the index." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ask the portfolio guide" }),
  ).toBeVisible();
});

test("mobile layout has no body-level horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/portfolio");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(
    page.getByRole("link", { name: "Chat", exact: true }),
  ).toBeVisible();
});

test("skip link and composer support keyboard-only use", async ({ page }) => {
  await page.goto("/");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  // Programmatic focus avoids engine/OS differences in whether Tab traverses
  // links unless Full Keyboard Access is enabled.
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");

  const composer = page.getByLabel("Ask about Pankit’s research portfolio");
  await composer.fill("What is MemEquiv?");
  await composer.press("Shift+Enter");
  await composer.type(" Include limitations.");
  await composer.press("Enter");
  await expect(page.getByText(/What is MemEquiv/)).toBeVisible();
});

test("public routes do not emit browser console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const route of [
    "/",
    "/portfolio",
    "/projects",
    "/writing",
    "/privacy",
  ]) {
    await page.goto(route, { waitUntil: "networkidle" });
  }
  expect(errors).toEqual([]);
});
