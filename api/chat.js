// TRQX Vercel serverless API route — Anthropic Claude proxy
// Required Vercel Environment Variable: ANTHROPIC_API_KEY
// Endpoint: POST /api/chat
// Body: { messages: [...], system: "..." }
//
// This proxy exists because browsers cannot call api.anthropic.com
// directly due to CORS restrictions. All Claude API calls from the
// TRQX AI Market Analyst chat panel route through here.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: "Missing ANTHROPIC_API_KEY environment variable. Add it in Vercel → Settings → Environment Variables."
    });
  }

  const { messages, system, max_tokens } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing or invalid messages array" });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: max_tokens || 1000,
        system: system || "",
        messages
      })
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.json().catch(() => ({}));
      console.error("Anthropic API error:", anthropicRes.status, errBody);
      return res.status(anthropicRes.status).json({
        error: errBody.error?.message || `Anthropic API returned ${anthropicRes.status}`
      });
    }

    const data = await anthropicRes.json();

    // Don't cache AI responses
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(data);

  } catch (err) {
    console.error("Chat proxy error:", err);
    return res.status(500).json({ error: "Chat proxy request failed: " + err.message });
  }
}
