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
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  return json({ ok: true, backend: "cloudflare-pages-functions", kv: Boolean(env.GL_DATA) });
}
