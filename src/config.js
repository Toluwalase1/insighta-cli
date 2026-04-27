require("dotenv").config({ quiet: true });

const API_BASE_URL = process.env.INSIGHTA_API_BASE_URL || "http://localhost:3000";
const AUTH_START_URL = process.env.INSIGHTA_AUTH_START_URL || "http://localhost:3000/auth/github";
const AUTH_EXCHANGE_URL =
  process.env.INSIGHTA_AUTH_EXCHANGE_URL || "http://localhost:3000/auth/github/callback";
const LOGOUT_URL = process.env.INSIGHTA_LOGOUT_URL || "http://localhost:3000/auth/logout";
const REFRESH_URL = process.env.INSIGHTA_REFRESH_URL || "http://localhost:3000/auth/refresh";
const CALLBACK_PORT = Number(process.env.INSIGHTA_CALLBACK_PORT || "8787");
const CALLBACK_PATH = "/callback";

module.exports = {
  API_BASE_URL,
  AUTH_START_URL,
  AUTH_EXCHANGE_URL,
  LOGOUT_URL,
  REFRESH_URL,
  CALLBACK_PORT,
  CALLBACK_PATH,
};
