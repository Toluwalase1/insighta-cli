const { API_BASE_URL, REFRESH_URL } = require("./config");
const { readCredentials, saveCredentials } = require("./credentials");

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payloadText = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(payloadText);
  } catch (error) {
    return null;
  }
}

function isTokenExpired(token) {
  if (!token) {
    return true;
  }

  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowInSeconds + 15;
}

async function refreshTokens(refreshToken) {
  const response = await fetch(REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: refreshToken,
      refreshToken,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Unable to refresh token. Please run insighta login.");
  }

  return payload;
}

async function ensureValidCredentials() {
  const credentials = readCredentials();
  if (!credentials) {
    throw new Error("Not logged in. Run insighta login");
  }

  if (!isTokenExpired(credentials.access_token)) {
    return credentials;
  }

  if (!credentials.refresh_token) {
    throw new Error("Session expired. Run insighta login");
  }

  const refreshed = await refreshTokens(credentials.refresh_token);
  const updatedCredentials = {
    ...credentials,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || credentials.refresh_token,
    user: refreshed.user || credentials.user || {},
    updated_at: new Date().toISOString(),
  };

  saveCredentials(updatedCredentials);
  return updatedCredentials;
}

function buildUrl(pathname, query = {}) {
  const url = new URL(pathname, API_BASE_URL);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url;
}

async function requestJson(pathname, options = {}) {
  const credentials = await ensureValidCredentials();
  const url = buildUrl(pathname, options.query);
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials.access_token}`,
      "X-API-Version": "1",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "API request failed.");
  }

  return payload;
}

async function requestBuffer(pathname, options = {}) {
  const credentials = await ensureValidCredentials();
  const url = buildUrl(pathname, options.query);
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${credentials.access_token}`,
      "X-API-Version": "1",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = "API request failed.";
    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (error) {
      
    }
    throw new Error(message);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

module.exports = {
  requestJson,
  requestBuffer,
};
