/**
 * Dashboard Authentication Utilities
 *
 * Handles JWT token creation/verification, password hashing,
 * and cookie-based session management for the standalone dashboard.
 *
 * This module is framework-agnostic at its core — if you extract
 * the dashboard to a separate app, these utils work as-is.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || "change-me-in-production";
const COOKIE_NAME = "dashboard_session";
const TOKEN_EXPIRY = "30d";
const SALT_ROUNDS = 10;

// ─── Password Utilities ──────────────────────────────────────

export function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ─── JWT Utilities ───────────────────────────────────────────

export function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, shopDomain: user.activeShopDomain },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ─── Cookie Utilities ────────────────────────────────────────

/** Parse a specific cookie value from the Cookie header string */
function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Build a Set-Cookie header string */
function buildCookieHeader(name, value, maxAge) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  const appUrl = process.env.SHOPIFY_APP_URL || "";
  if (appUrl.startsWith("https://")) parts.push("Secure");
  return parts.join("; ");
}

/** Create a Set-Cookie header that logs the user in */
export function createSessionCookie(token) {
  const thirtyDays = 60 * 60 * 24 * 30;
  return buildCookieHeader(COOKIE_NAME, token, thirtyDays);
}

/** Create a Set-Cookie header that logs the user out */
export function destroySessionCookie() {
  return buildCookieHeader(COOKIE_NAME, "", 0);
}

// ─── Auth Middleware ─────────────────────────────────────────

/**
 * Extract the current user from the request cookie.
 * Returns the JWT payload { userId, email, shopDomain } or null.
 */
export function getDashboardUser(request) {
  const cookieHeader = request.headers.get("Cookie");
  const token = parseCookie(cookieHeader, COOKIE_NAME);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Protect a route — redirects to /signin if not authenticated.
 * Use this in any dashboard loader/action that requires login.
 */
export function requireDashboardAuth(request) {
  const user = getDashboardUser(request);
  if (!user) {
    throw new Response(null, {
      status: 302,
      headers: { Location: "/signin" },
    });
  }
  return user;
}
