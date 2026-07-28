export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const body = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Pankit Brahmkhatri — Research Notes</title>
    <link>${siteUrl}/writing</link>
    <description>Research notes on agent memory, retrieval, verification, and reliable AI systems.</description>
    <language>en</language>
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
