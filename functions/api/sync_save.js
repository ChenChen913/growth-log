const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, authorization",
  "Access-Control-Max-Age": "86400",
};

const enc = new TextEncoder();

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(String(value)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authorized(env, code) {
  if (!env.GL_DATA || !code) return false;
  const expected = await env.GL_DATA.get("passcode_hash");
  if (!expected) return false;
  const got = await sha256Hex(code);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function readCode(request, url) {
  if (request.method === "GET") return url.searchParams.get("p_code") || "";
  try {
    const body = await request.json();
    return typeof body.p_code === "string" ? body.p_code : "";
  } catch (e) {
    return "";
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ message: "METHOD_NOT_ALLOWED" }, 405);
  let body;
  try { body = await request.json(); } catch (e) { return json({ message: "BAD_REQUEST" }, 400); }
  const code = typeof body.p_code === "string" ? body.p_code : "";
  if (!(await authorized(env, code))) return json({ message: "ACCESS_DENIED", code: "ACCESS_DENIED" }, 400);
  const payload = body.p_payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json({ message: "BAD_PAYLOAD" }, 400);
  const serialized = JSON.stringify(payload);
  if (serialized.length > 5_000_000) return json({ message: "PAYLOAD_TOO_LARGE" }, 413);
  await env.GL_DATA.put("payload", serialized);
  return json({ updated_at: new Date().toISOString() });
}
