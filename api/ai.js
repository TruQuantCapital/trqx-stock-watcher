// TRQX Secure AI Chat Route
// Required Vercel Environment Variable: ANTHROPIC_API_KEY
// Endpoint: /api/ai

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: "Missing ANTHROPIC_API_KEY environment variable"
    });
  }

  try {
    const { system, messages, max_tokens = 1000 } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages array" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens,
        system: system || "You are TRQX AI Market Analyst. Provide concise educational market research only. Do not give personalized financial advice.",
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Anthropic API request failed",
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("TRQX AI chat route error:", error);
    return res.status(500).json({
      error: "TRQX AI request failed"
    });
  }
}
