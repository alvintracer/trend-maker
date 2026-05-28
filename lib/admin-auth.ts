import { createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "cwk_admin_session";
export const ADMIN_PASSWORD_ENV = "ADMIN_PASSWORD";

function getAdminPassword() {
  return process.env[ADMIN_PASSWORD_ENV]?.trim() ?? "";
}

function hashSessionValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getExpectedSessionToken() {
  const password = getAdminPassword();

  if (!password) {
    return null;
  }

  return hashSessionValue(`communitywikikorea:${password}`);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function isAdminAuthenticated() {
  const expected = getExpectedSessionToken();

  if (!expected) {
    return false;
  }

  const cookieStore = await cookies();
  const actual = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? "";
  return actual.length > 0 && safeEqual(actual, expected);
}

export async function assertAdminAuthenticated() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export function isAdminPasswordConfigured() {
  return getAdminPassword().length > 0;
}

export function validateAdminPassword(candidate: string) {
  const expected = getAdminPassword();
  return expected.length > 0 && safeEqual(candidate, expected);
}

export async function createAdminSession() {
  const expected = getExpectedSessionToken();

  if (!expected) {
    throw new Error("ADMIN_PASSWORD is not configured");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export function isAdminRequestAuthenticated(request: NextRequest | Request) {
  const expected = getExpectedSessionToken();

  if (!expected) {
    return false;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`));
  const actual = decodeURIComponent(match?.[1] ?? "");

  return actual.length > 0 && safeEqual(actual, expected);
}
