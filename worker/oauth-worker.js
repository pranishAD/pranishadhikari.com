/**
 * Cloudflare Worker — GitHub OAuth provider for Sveltia CMS.
 *
 * Purpose
 * -------
 * Sveltia CMS (served statically from public/admin/) runs entirely in the
 * browser and cannot hold a GitHub OAuth App's client secret — GitHub's
 * "Authorization code" OAuth flow requires a confidential server-side step
 * to exchange a one-time `code` for an access token. This Worker is that
 * one server-side step, and nothing else. It holds no database and no
 * persistent state; it is a stateless relay between the browser popup
 * Sveltia opens and GitHub's OAuth endpoints.
 *
 * This implements the same popup + window.postMessage protocol Decap/
 * Netlify CMS and Sveltia CMS expect from a custom `backend.base_url`
 * OAuth client (Sveltia CMS docs: "Third-party OAuth client" / self-hosted
 * authenticator pattern), so no change to Sveltia CMS itself is needed —
 * only `base_url` in public/admin/config.yml needs to point at this
 * Worker's deployed URL.
 *
 * Routes
 * ------
 *   GET /auth      — begins the flow: redirects the popup to GitHub's
 *                    OAuth authorize screen.
 *   GET /callback  — GitHub redirects back here with ?code=&state=.
 *                    Exchanges the code for a token, checks that the
 *                    authenticated GitHub user is the one allowed account,
 *                    and posts the result back to the opener window.
 *
 * Secrets / config (see wrangler.toml — NEVER hardcode any of these here)
 * ------------------------------------------------------------------------
 *   env.GITHUB_CLIENT_ID       — GitHub OAuth App client ID (not secret,
 *                                 but still only ever read from env).
 *   env.GITHUB_CLIENT_SECRET   — GitHub OAuth App client secret.
 *                                 MUST be set via `wrangler secret put`,
 *                                 never written into this file or
 *                                 wrangler.toml.
 *   env.GITHUB_HOSTNAME        — optional, defaults to "github.com"
 *                                 (only relevant for GitHub Enterprise).
 *   env.ALLOWED_GITHUB_USERNAME— the ONE GitHub login allowed to receive a
 *                                 token from this Worker (Pranish's
 *                                 account). Case-insensitive exact match.
 *   env.ALLOWED_DOMAINS        — comma-separated list of hostnames allowed
 *                                 to initiate /auth (checked against the
 *                                 Referer header), e.g.
 *                                 "pranishadhikari.com,PRANISH.github.io".
 *                                 Prevents this Worker being used as an
 *                                 open OAuth proxy by an unrelated site.
 *
 * No secret, token, or credential literal value is written anywhere in
 * this file. Every sensitive value is read from `env` at request time.
 */

const STATE_COOKIE_NAME = "sveltia_oauth_state";

/**
 * Minimal HTML page that performs the Decap/Sveltia-compatible
 * window.postMessage handshake with the window that opened this popup.
 *
 * Protocol (unchanged from the long-standing Netlify/Decap CMS OAuth
 * provider convention that Sveltia CMS also implements):
 *   1. On load, the popup posts "authorizing:github" to the opener using
 *      "*" as the target origin (it doesn't know the opener's origin yet).
 *   2. The opener (Sveltia CMS) replies with any message; the popup reads
 *      the *origin* of that reply to learn exactly who it's talking to.
 *   3. The popup then posts the real result to that confirmed origin only
 *      — never to "*" — so a token can't be leaked to an unrelated page.
 */
function renderCallbackPage({ status, provider, payload }) {
  const resultMessage =
    status === "success"
      ? `authorization:${provider}:success:${JSON.stringify(payload)}`
      : `authorization:${provider}:error:${JSON.stringify(payload)}`;

  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Authenticating…</title></head>
  <body>
    <p>Finishing sign-in, you can close this window if it doesn't close automatically…</p>
    <script>
      (function () {
        function receiveMessage(e) {
          window.opener.postMessage(
            ${JSON.stringify(resultMessage)},
            e.origin
          );
          window.removeEventListener("message", receiveMessage, false);
        }
        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage("authorizing:${provider}", "*");
      })();
    </script>
  </body>
</html>`;
}

function htmlResponse(body, init = {}) {
  return new Response(body, {
    ...init,
    headers: { "content-type": "text/html; charset=utf-8", ...(init.headers || {}) },
  });
}

/** Random, URL-safe state token for basic CSRF protection on the flow. */
function generateState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function parseAllowedDomains(env) {
  return (env.ALLOWED_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function hostnameAllowed(hostname, allowedDomains) {
  if (allowedDomains.length === 0) return false; // fail closed if unconfigured
  const host = hostname.toLowerCase();
  return allowedDomains.some((pattern) => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".example.com"
      return host.endsWith(suffix);
    }
    return host === pattern;
  });
}

async function handleAuth(request, env) {
  const allowedDomains = parseAllowedDomains(env);
  const referer = request.headers.get("Referer") || request.headers.get("Origin") || "";

  let refererHostname = "";
  try {
    refererHostname = referer ? new URL(referer).hostname : "";
  } catch {
    refererHostname = "";
  }

  // Sveltia CMS opens this endpoint in a popup that may not send a Referer, but it
  // always passes the site's hostname as `site_id`. Accept either, checked against
  // the same allowlist. This is an abuse guard only: the real access control is the
  // ALLOWED_GITHUB_USERNAME check in /callback and the repo permissions on GitHub.
  let siteIdHostname = "";
  try {
    const siteId = new URL(request.url).searchParams.get("site_id") || "";
    siteIdHostname = siteId ? new URL(`https://${siteId}`).hostname : "";
  } catch {
    siteIdHostname = "";
  }

  if (
    !hostnameAllowed(refererHostname, allowedDomains) &&
    !hostnameAllowed(siteIdHostname, allowedDomains)
  ) {
    return new Response(
      "Forbidden: this OAuth endpoint is not configured to accept requests from this site.",
      { status: 403 },
    );
  }

  if (!env.GITHUB_CLIENT_ID) {
    return new Response("Server misconfigured: GITHUB_CLIENT_ID is not set.", { status: 500 });
  }

  const url = new URL(request.url);
  const githubHostname = env.GITHUB_HOSTNAME || "github.com";
  const redirectUri = `${url.origin}/callback`;
  const state = generateState();

  const authorizeUrl = new URL(`https://${githubHostname}/login/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "repo");
  authorizeUrl.searchParams.set("state", state);

  const response = Response.redirect(authorizeUrl.toString(), 302);
  const headers = new Headers(response.headers);
  // HttpOnly + Secure + SameSite=Lax cookie, scoped to this Worker only,
  // used purely to detect CSRF on the /callback step. No user data in it.
  headers.append(
    "Set-Cookie",
    `${STATE_COOKIE_NAME}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=600`,
  );
  return new Response(response.body, { status: response.status, headers });
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieState = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE_NAME}=`))
    ?.split("=")[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return htmlResponse(
      renderCallbackPage({
        status: "error",
        provider: "github",
        payload: { message: "Invalid or missing OAuth state. Please try signing in again." },
      }),
      { status: 400 },
    );
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return htmlResponse(
      renderCallbackPage({
        status: "error",
        provider: "github",
        payload: { message: "Server misconfigured: OAuth client credentials are not set." },
      }),
      { status: 500 },
    );
  }

  const githubHostname = env.GITHUB_HOSTNAME || "github.com";
  const redirectUri = `${url.origin}/callback`;

  // --- Exchange the one-time code for an access token. --------------
  const tokenResponse = await fetch(`https://${githubHostname}/login/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return htmlResponse(
      renderCallbackPage({
        status: "error",
        provider: "github",
        payload: { message: "GitHub rejected the OAuth code exchange." },
      }),
      { status: 502 },
    );
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return htmlResponse(
      renderCallbackPage({
        status: "error",
        provider: "github",
        payload: { message: tokenData.error_description || "No access token returned by GitHub." },
      }),
      { status: 400 },
    );
  }

  // --- Restrict to Pranish's GitHub account only. --------------------
  // This is defense-in-depth on top of GitHub's own repo permission
  // check (a non-collaborator's token would get 403s from the GitHub API
  // when Sveltia tries to commit anyway) — here we refuse to hand back a
  // token at all unless the authenticated user matches the configured
  // allowed login, so an unauthorized GitHub account never even reaches
  // the CMS UI's "signed in" state.
  const apiBase = githubHostname === "github.com" ? "https://api.github.com" : `https://${githubHostname}/api/v3`;

  const userResponse = await fetch(`${apiBase}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "pranishadhikari-com-cms-oauth-worker",
      Accept: "application/vnd.github+json",
    },
  });

  if (!userResponse.ok) {
    return htmlResponse(
      renderCallbackPage({
        status: "error",
        provider: "github",
        payload: { message: "Could not verify the authenticated GitHub account." },
      }),
      { status: 502 },
    );
  }

  const user = await userResponse.json();
  const allowedUsername = (env.ALLOWED_GITHUB_USERNAME || "").trim().toLowerCase();

  if (!allowedUsername) {
    return htmlResponse(
      renderCallbackPage({
        status: "error",
        provider: "github",
        payload: { message: "Server misconfigured: ALLOWED_GITHUB_USERNAME is not set." },
      }),
      { status: 500 },
    );
  }

  if (String(user.login || "").toLowerCase() !== allowedUsername) {
    return htmlResponse(
      renderCallbackPage({
        status: "error",
        provider: "github",
        payload: {
          message: "This GitHub account is not authorized to edit this site.",
        },
      }),
      { status: 403 },
    );
  }

  // --- Success: hand the token back to the Sveltia CMS popup opener. -
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  // Clear the one-time state cookie now that it's been used.
  headers.append(
    "Set-Cookie",
    `${STATE_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=0`,
  );

  return new Response(
    renderCallbackPage({
      status: "success",
      provider: "github",
      payload: { token: accessToken, provider: "github" },
    }),
    { status: 200, headers },
  );
}

export default {
  /** @param {Request} request @param {Record<string, string>} env */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/auth") {
      return handleAuth(request, env);
    }

    if (url.pathname === "/callback") {
      return handleCallback(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
