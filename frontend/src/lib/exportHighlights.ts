import type { HighlightWithArticle } from "./api";

export function highlightsToMarkdown(rows: HighlightWithArticle[]): string {
  if (rows.length === 0) return "# BrowseFellow highlights\n\n_no highlights yet_\n";

  // Group by article (preserve first-seen order).
  const order: number[] = [];
  const byArticle = new Map<number, HighlightWithArticle[]>();
  for (const r of rows) {
    if (!byArticle.has(r.article_id)) {
      order.push(r.article_id);
      byArticle.set(r.article_id, []);
    }
    byArticle.get(r.article_id)!.push(r);
  }

  const lines: string[] = ["# BrowseFellow highlights", ""];
  for (const id of order) {
    const group = byArticle.get(id)!;
    const first = group[0];
    lines.push(`## ${first.article_title}`);
    const meta = [first.article_site, first.article_url].filter(Boolean).join(" · ");
    if (meta) lines.push(`_${meta}_`);
    lines.push("");
    for (const h of group) {
      lines.push(`> ${h.text.replace(/\n+/g, " ")}`);
      if (h.note) lines.push(`> — ${h.note}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function downloadBlob(
  filename: string,
  content: string,
  type = "text/plain",
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
