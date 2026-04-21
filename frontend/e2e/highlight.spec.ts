/**
 * Smoke test: open the fixture article, make a highlight, verify it
 * appears in the highlights index and persists across a reload.
 *
 * This test spans frontend (React routing, text selection, Reader
 * view) and backend (POST /api/articles/:id/highlights, GET
 * /api/highlights). If either side silently breaks, this fails.
 */
import { test, expect } from "@playwright/test";

test("save → open → highlight → verify in index", async ({ page }) => {
  // 1. Library loads and shows the seeded fixture.
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Fixture Article for E2E/i }),
  ).toBeVisible();

  // 2. Open the article — route into the Reader.
  await page.getByRole("heading", { name: /Fixture Article for E2E/i }).click();
  await expect(page).toHaveURL(/\/read\//);

  // Wait for the article body to render before we try to select text.
  const prose = page.locator(".reader-prose");
  await expect(prose).toBeVisible();

  // 3. Select a specific phrase via the browser's selection API. A
  // real drag-select is flaky across platforms; using the Selection
  // API directly is the same thing the app sees.
  const target = "quick brown fox";
  await page.evaluate((needle) => {
    const root = document.querySelector<HTMLElement>(".reader-prose");
    if (!root) throw new Error("reader-prose not found");
    // Find the text node that contains our needle.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null = null;
    while ((node = walker.nextNode())) {
      const idx = (node.nodeValue ?? "").indexOf(needle);
      if (idx >= 0) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + needle.length);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        // The mouseup handler in HighlightLayer gates on this event.
        document.dispatchEvent(new Event("mouseup", { bubbles: true }));
        return;
      }
    }
    throw new Error(`needle ${needle!} not found in prose`);
  }, target);

  // 4. The inline Highlight button should appear; click it.
  const highlightBtn = page.getByRole("button", { name: /^Highlight$/ });
  await expect(highlightBtn).toBeVisible();
  await highlightBtn.click();

  // 5. The highlighted span now exists in the DOM.
  await expect(page.locator("mark").filter({ hasText: target })).toBeVisible();

  // 6. Navigate to the highlights index via the library header link.
  await page.goto("/highlights");
  await expect(page.getByText(target, { exact: false })).toBeVisible();

  // 7. Reload the index to confirm the highlight persisted through the
  // backend rather than living in React state.
  await page.reload();
  await expect(page.getByText(target, { exact: false })).toBeVisible();
});
