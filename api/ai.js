// TRQX Secure AI Route
// Required Vercel Environment Variable:
// ANTHROPIC_API_KEY

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return res.status(500).json({
      error:
        "Missing ANTHROPIC_API_KEY. Add it in Vercel Project Settings → Environment Variables, then redeploy."
    });
  }

  try {
    const body = req.body || {};

    const userMessage =
      body.message ||
      body.prompt ||
      body.text ||
      "";

    const messages = Array.isArray(body.messages)
      ? body.messages
      : userMessage
        ? [{ role: "user", content: userMessage }]
        : [];

    if (!messages.length) {
      return res.status(400).json({
        error: "Missing message. Send either { message: 'text' } or { messages: [...] }."
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
        system:
          body.system ||
          "You are TRQX AI Market Analyst. Provide concise educational stock-market research only. Do not provide personalized financial advice or guaranteed outcomes.",
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

    return res.status(200).json({
      reply: data?.content?.[0]?.text || "",
      raw: data
    });
  } catch (error) {
    console.error("TRQX AI route error:", error);

    return res.status(500).json({
      error: "TRQX AI request failed. Check Vercel function logs."
    });
  }
}
