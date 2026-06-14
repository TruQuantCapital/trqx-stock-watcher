// TRQX Secure AI Chat Route
// Required Vercel Environment Variable: ANTHROPIC_API_KEY
// Optional Vercel Environment Variable: ANTHROPIC_MODEL
//
// Recommended ANTHROPIC_MODEL:
// claude-sonnet-4-6
//
// Endpoint:
// /api/chat

function fallbackMessage(reason = "AI provider unavailable") {
  return {
    id: "trqx-local-fallback",
    type: "message",
    role: "assistant",
    model: "trqx-local-fallback",
    content: [
      {
        type: "text",
        text:
          "TRQX AI is currently running in fallback mode because the live AI provider is unavailable. " +
          `Reason: ${reason}. ` +
          "Your market terminal data, scanners, stock lookup, portfolio builder, and dashboard tools are still active. " +
          "For full AI chat, confirm ANTHROPIC_API_KEY is set in Vercel Production environment variables and redeploy."
      }
    ]
  };
}

async function callAnthropic({ key, model, system, messages, max_tokens }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens,
      system:
        system ||
        "You are TRQX AI Market Analyst. Provide concise educational market research only. Do not give personalized financial advice.",
      messages
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Anthropic API request failed with status ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.ANTHROPIC_API_KEY;

  const { system, messages, max_tokens = 1000 } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing messages array" });
  }

  if (!key) {
    // Do not crash the public site. Return a visible fallback response instead.
    return res.status(200).json(fallbackMessage("missing ANTHROPIC_API_KEY"));
  }

  const requestedModel = process.env.ANTHROPIC_MODEL;

  const candidateModels = [
    requestedModel,
    "claude-sonnet-4-6",
    "claude-sonnet-4-5",
    "claude-3-5-sonnet-latest",
    "claude-3-5-sonnet-20241022"
  ].filter(Boolean);

  const tried = [];
  let lastError = null;

  for (const model of candidateModels) {
    if (tried.includes(model)) continue;
    tried.push(model);

    try {
      const data = await callAnthropic({
        key,
        model,
        system,
        messages,
        max_tokens
      });

      return res.status(200).json({
        ...data,
        model_used: model
      });
    } catch (error) {
      lastError = error;

      const msg = String(error.message || "").toLowerCase();

      // Only try another model when the issue is model-specific.
      const modelProblem =
        msg.includes("model") ||
        msg.includes("not found") ||
        msg.includes("does not exist") ||
        msg.includes("invalid model") ||
        msg.includes("permission") ||
        msg.includes("access");

      if (!modelProblem) {
        break;
      }
    }
  }

  console.error("TRQX AI provider failed:", {
    tried,
    error: lastError?.message,
    details: lastError?.details
  });

  // Keep the user interface alive instead of showing a broken connection error.
  return res.status(200).json(
    fallbackMessage(
      `AI provider failed after trying ${tried.join(", ")}. Last error: ${lastError?.message || "unknown"}`
    )
  );
}
