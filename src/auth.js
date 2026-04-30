const crypto = require("node:crypto");
const http = require("node:http");
const { exec } = require("node:child_process");

function toBase64Url(input) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createRandomString(byteSize = 32) {
  return toBase64Url(crypto.randomBytes(byteSize));
}

function generatePkce() {
  const state = createRandomString(32);
  const codeVerifier = createRandomString(64);
  const challengeBuffer = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = toBase64Url(challengeBuffer);

  return { state, codeVerifier, codeChallenge };
}

function startCallbackServer({ port, pathName }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);

      if (reqUrl.pathname !== pathName) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      const code = reqUrl.searchParams.get("code");
      const state = reqUrl.searchParams.get("state");
      const accessToken = reqUrl.searchParams.get("access_token");
      const refreshToken = reqUrl.searchParams.get("refresh_token");
      const csrfToken = reqUrl.searchParams.get("csrf_token");

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      res.end("<h2>Login complete. You can now return to the terminal.</h2>");

      server.close(() => resolve({ code, state, accessToken, refreshToken, csrfToken }));
    });

    server.on("error", (error) => {
      reject(error);
    });

    server.listen(port, "127.0.0.1");
  });
}

function openBrowser(url) {
  let command;

  if (process.platform === "win32") {
    command = `start "" "${url}"`;
  } else if (process.platform === "darwin") {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  return new Promise((resolve, reject) => {
    exec(command, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function exchangeCodeForTokens({ exchangeUrl, code, codeVerifier, redirectUri }) {
  const postResponse = await fetch(exchangeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });

  const unwrapAuthPayload = (payload) => {
    if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object") {
      return payload.data;
    }

    return payload;
  };

  if (postResponse.ok) {
    const payload = await postResponse.json().catch(() => ({}));
    return unwrapAuthPayload(payload);
  }

  // Some backends expose callback exchange as GET /auth/github/callback.
  if (postResponse.status === 404 || postResponse.status === 405) {
    const fallbackUrl = new URL(exchangeUrl);
    fallbackUrl.searchParams.set("code", code);
    fallbackUrl.searchParams.set("code_verifier", codeVerifier);
    fallbackUrl.searchParams.set("redirect_uri", redirectUri);

    const getResponse = await fetch(fallbackUrl, { method: "GET" });
    const getPayload = await getResponse.json().catch(() => ({}));
    if (!getResponse.ok) {
      const message = getPayload.message || "Login failed during token exchange.";
      throw new Error(message);
    }
    return unwrapAuthPayload(getPayload);
  }

  const postPayload = await postResponse.json().catch(() => ({}));
  const message = postPayload.message || "Login failed during token exchange.";
  throw new Error(message);
}

async function logoutWithRefreshToken({ logoutUrl, refreshToken }) {
  const response = await fetch(logoutUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: refreshToken,
      refreshToken,
    }),
  });

  if (!response.ok) {
    let message = "Logout request failed on backend.";
    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (error) {
      // Keep default message when backend doesn't return JSON.
    }
    throw new Error(message);
  }
}

module.exports = {
  generatePkce,
  startCallbackServer,
  openBrowser,
  exchangeCodeForTokens,
  logoutWithRefreshToken,
};
