require("dotenv").config({ quiet: true });

const DEFAULT_API_BASE_URL = "https://insighta-labs-intelligence-production.up.railway.app";
const API_BASE_URL = process.env.INSIGHTA_API_BASE_URL || DEFAULT_API_BASE_URL;
const AUTH_START_URL = process.env.INSIGHTA_AUTH_START_URL || `${API_BASE_URL}/auth/github`;
const AUTH_EXCHANGE_URL =
  process.env.INSIGHTA_AUTH_EXCHANGE_URL || `${API_BASE_URL}/auth/github/callback`;
const LOGOUT_URL = process.env.INSIGHTA_LOGOUT_URL || `${API_BASE_URL}/auth/logout`;
const REFRESH_URL = process.env.INSIGHTA_REFRESH_URL || `${API_BASE_URL}/auth/refresh`;
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
