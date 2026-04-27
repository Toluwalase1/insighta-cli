const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CREDENTIALS_DIR = path.join(os.homedir(), ".insighta");
const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, "credentials.json");

function saveCredentials(credentials) {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), "utf8");
}

function readCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }

  const raw = fs.readFileSync(CREDENTIALS_PATH, "utf8");
  return JSON.parse(raw);
}

function deleteCredentials() {
  if (fs.existsSync(CREDENTIALS_PATH)) {
    fs.unlinkSync(CREDENTIALS_PATH);
  }
}

module.exports = {
  CREDENTIALS_PATH,
  saveCredentials,
  readCredentials,
  deleteCredentials,
};
