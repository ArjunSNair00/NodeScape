const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 20
const requestBuckets = new Map<string, { count: number; resetAt: number }>()

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? ""
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=")
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

function isAuthenticatedUser(req: Request): boolean {
  const token = getBearerToken(req)
  if (!token) return false

  const payload = decodeJwtPayload(token)
  if (!payload) return false

  const role = payload.role
  const sub = payload.sub
  return role === "authenticated" && typeof sub === "string" && sub.length > 0
}

function getClientIdentifier(req: Request): string {
  const xForwardedFor = req.headers.get("x-forwarded-for")
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0].trim()
    if (firstIp) return firstIp
  }
  return req.headers.get("cf-connecting-ip") ?? "unknown"
}

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const bucket = requestBuckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    requestBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return false
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true
  }

  bucket.count += 1
  requestBuckets.set(key, bucket)
  return false
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    })
  }

  if (!isAuthenticatedUser(req)) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    })
  }

  const clientId = getClientIdentifier(req)
  if (isRateLimited(clientId)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    })
  }

  try {
    const requestBody = await req.json()
    const groqApiKey = Deno.env.get("GROQ_API_KEY")

    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: "Missing GROQ_API_KEY" }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      })
    }

    const payload = requestBody?.messages
      ? {
          model: requestBody.model ?? "llama-3.3-70b-versatile",
          messages: requestBody.messages,
          response_format: requestBody.response_format,
          stream: requestBody.stream,
          temperature: requestBody.temperature,
          top_p: requestBody.top_p,
          max_tokens: requestBody.max_tokens,
          presence_penalty: requestBody.presence_penalty,
          frequency_penalty: requestBody.frequency_penalty,
          stop: requestBody.stop,
        }
      : {
          model: requestBody?.model ?? "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: requestBody?.prompt ?? "" }],
          stream: requestBody?.stream,
          response_format: requestBody?.response_format,
        }

    if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      })
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return new Response(errorText, {
        status: res.status,
        headers: {
          ...corsHeaders,
          "Content-Type": res.headers.get("content-type") ?? "application/json",
        },
      })
    }

    if (payload.stream) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          "Content-Type": res.headers.get("content-type") ?? "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      })
    }

    const dataText = await res.text()

    return new Response(dataText, {
      status: res.status,
      headers: {
        ...corsHeaders,
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    })
  }
})