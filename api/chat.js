// TRQX Secure AI Route
// Required Vercel Environment Variable:
// ANTHROPIC_API_KEY
//
// Supported endpoints:
// /api/ai
// /api/chat

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: "Missing ANTHROPIC_API_KEY. Add it in Vercel Project Settings → Environment Variables, then redeploy without build cache."
    });
  }

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const system =
      body.system ||
      "You are TRQX AI Market Analyst. Provide concise educational stock-market research only. Do not provide personalized financial advice or guaranteed outcomes.";

    if (!messages.length) {
      return res.status(400).json({
        error: "Missing messages array."
      });
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
        max_tokens: Number(body.max_tokens) || 1000,
        system,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          "Anthropic API request failed.",
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("TRQX AI route error:", error);
    return res.status(500).json({
      error: "TRQX AI request failed. Check Vercel function logs."
    });
  }
}
