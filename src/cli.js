const { Command } = require("commander");
const fs = require("node:fs");
const path = require("node:path");
const {
  AUTH_START_URL,
  AUTH_EXCHANGE_URL,
  LOGOUT_URL,
  CALLBACK_PORT,
  CALLBACK_PATH,
} = require("./config");
const {
  generatePkce,
  startCallbackServer,
  openBrowser,
  exchangeCodeForTokens,
  logoutWithRefreshToken,
} = require("./auth");
const {
  CREDENTIALS_PATH,
  saveCredentials,
  readCredentials,
  deleteCredentials,
} = require("./credentials");
const { requestJson, requestBuffer } = require("./api");
const { withSpinner } = require("./spinner");

async function handleLogin() {
  const { state, codeVerifier, codeChallenge } = generatePkce();
  const redirectUri = `http://127.0.0.1:${CALLBACK_PORT}${CALLBACK_PATH}`;

  const authUrl = new URL(AUTH_START_URL);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("redirect_uri", redirectUri);

  console.log("Starting login flow...");
  console.log(`Waiting for callback on ${redirectUri}`);

  const callbackPromise = startCallbackServer({
    port: CALLBACK_PORT,
    pathName: CALLBACK_PATH,
  });

  await openBrowser(authUrl.toString());
  const callback = await callbackPromise;

  if (!callback.code) {
    throw new Error("Authorization code not found in callback.");
  }
  if (callback.state !== state) {
    throw new Error("State mismatch. Please retry login.");
  }

  const payload = await exchangeCodeForTokens({
    exchangeUrl: AUTH_EXCHANGE_URL,
    code: callback.code,
    codeVerifier,
    redirectUri,
  });

  const credentials = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    user: payload.user || {},
    updated_at: new Date().toISOString(),
  };

  saveCredentials(credentials);

  const username = credentials.user.username || "unknown";
  console.log(`Logged in as @${username}`);
  console.log(`Credentials saved to ${CREDENTIALS_PATH}`);
}

async function handleLogout() {
  const credentials = readCredentials();
  if (!credentials) {
    console.log("You are already logged out.");
    return;
  }

  if (credentials.refresh_token) {
    try {
      await logoutWithRefreshToken({
        logoutUrl: LOGOUT_URL,
        refreshToken: credentials.refresh_token,
      });
    } catch (error) {
      console.warn(`Backend logout warning: ${error.message}`);
    }
  }

  deleteCredentials();
  console.log("Logged out successfully.");
}

function handleWhoAmI() {
  const credentials = readCredentials();
  if (!credentials) {
    console.log("Not logged in. Run insighta login");
    return;
  }

  const user = credentials.user || {};
  console.log(`Username: ${user.username || "unknown"}`);
  console.log(`Email: ${user.email || "unknown"}`);
  console.log(`Role: ${user.role || "unknown"}`);
}

function addProfileListOptions(command) {
  return command
    .option("--gender <value>", "Filter by gender")
    .option("--country <value>", "Filter by country code")
    .option("--age-group <value>", "Filter by age group")
    .option("--min-age <number>", "Filter by minimum age")
    .option("--max-age <number>", "Filter by maximum age")
    .option("--sort-by <value>", "Sort field")
    .option("--order <value>", "Sort order (asc/desc)")
    .option("--page <number>", "Page number")
    .option("--limit <number>", "Page size");
}

function mapListQuery(options) {
  return {
    gender: options.gender,
    country: options.country,
    age_group: options.ageGroup,
    min_age: options.minAge,
    max_age: options.maxAge,
    sort_by: options.sortBy,
    order: options.order,
    page: options.page,
    limit: options.limit,
  };
}

function printProfilesTable(items) {
  const table = items.map((item) => ({
    id: item.id || item._id || "-",
    name: item.name || "-",
    gender: item.gender || "-",
    age: item.age ?? "-",
    country: item.country_id || item.country_code || "-",
  }));
  console.table(table);
}

async function handleProfilesList(options) {
  const payload = await withSpinner("Fetching profiles", () =>
    requestJson("/api/profiles", { query: mapListQuery(options) }),
  );

  const data = payload.data || [];
  if (data.length === 0) {
    console.log("No profiles found.");
    return;
  }

  printProfilesTable(data);
  if (payload.page && payload.total_pages) {
    console.log(`Page ${payload.page} of ${payload.total_pages} (total ${payload.total || data.length})`);
  }
}

async function handleProfilesGet(id) {
  let payload;
  try {
    payload = await withSpinner("Fetching profile", () => requestJson(`/api/profiles/${id}`));
  } catch (error) {
    if (/not found|failed/i.test(error.message)) {
      payload = await withSpinner("Fetching profile", () =>
        requestJson("/api/profiles", {
          query: { id, limit: 1 },
        }),
      );
      const fallbackData = payload.data || [];
      if (fallbackData.length === 0) {
        throw new Error("Profile not found.");
      }
      console.log(JSON.stringify(fallbackData[0], null, 2));
      return;
    }
    throw error;
  }

  const profile = payload.data || payload;
  console.log(JSON.stringify(profile, null, 2));
}

async function handleProfilesSearch(query, options) {
  const payload = await withSpinner("Searching profiles", () =>
    requestJson("/api/profiles/search", {
      query: {
        query,
        page: options.page,
        limit: options.limit,
      },
    }),
  );

  const data = payload.data || [];
  if (data.length === 0) {
    console.log("No search results.");
    return;
  }

  printProfilesTable(data);
}

async function handleProfilesCreate(options) {
  const payload = await withSpinner("Creating profile", () =>
    requestJson("/api/profiles", {
      method: "POST",
      body: { name: options.name },
    }),
  );

  const profile = payload.data || payload;
  console.log("Profile created:");
  console.log(JSON.stringify(profile, null, 2));
}

async function handleProfilesExport(options) {
  const query = {
    format: options.format || "csv",
    gender: options.gender,
    country: options.country,
    age_group: options.ageGroup,
    min_age: options.minAge,
    max_age: options.maxAge,
    sort_by: options.sortBy,
    order: options.order,
  };

  const result = await withSpinner("Exporting profiles", () =>
    requestBuffer("/api/profiles/export", { query }),
  );

  const extension = options.format || "csv";
  const fileName = `profiles_${Date.now()}.${extension}`;
  const filePath = path.join(process.cwd(), fileName);
  fs.writeFileSync(filePath, result.buffer);

  console.log(`Export saved: ${filePath}`);
}

function runCli() {
  const program = new Command();

  program
    .name("insighta")
    .description("Insighta Labs+ command line tool")
    .version("1.0.0");

  program
    .command("login")
    .description("Authenticate with your Insighta account")
    .action(wrapAction(handleLogin));

  program
    .command("logout")
    .description("Sign out of your Insighta account")
    .action(wrapAction(handleLogout));

  program
    .command("whoami")
    .description("Show the currently signed-in user")
    .action(wrapAction(handleWhoAmI));

  const profiles = program.command("profiles").description("Profiles operations");

  addProfileListOptions(profiles.command("list").description("List profiles")).action(
    wrapAction(handleProfilesList),
  );

  profiles.command("get <id>").description("Get one profile by id").action(wrapAction(handleProfilesGet));

  profiles
    .command("search <query>")
    .description("Search profiles with natural language")
    .option("--page <number>", "Page number")
    .option("--limit <number>", "Page size")
    .action(wrapAction(handleProfilesSearch));

  profiles
    .command("create")
    .description("Create a profile (admin only)")
    .requiredOption("--name <value>", "Name to create profile for")
    .action(wrapAction(handleProfilesCreate));

  addProfileListOptions(
    profiles
      .command("export")
      .description("Export profiles")
      .option("--format <value>", "Export format", "csv"),
  ).action(wrapAction(handleProfilesExport));

  program.parse(process.argv);
}

function wrapAction(action) {
  return async (...args) => {
    try {
      await action(...args);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  };
}

module.exports = { runCli };
