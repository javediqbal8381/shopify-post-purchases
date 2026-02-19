/**
 * Switch Store API — POST /api/switch-store
 *
 * Switches the user's active store, reissues the JWT cookie,
 * and redirects back to /dashboard.
 */

import { redirect } from "react-router";
import prisma from "../db.server";
import {
  requireDashboardAuth,
  createToken,
  createSessionCookie,
} from "../dashboard/auth/session.server";

export const action = async ({ request }) => {
  const user = requireDashboardAuth(request);
  const form = await request.formData();
  const shopDomain = form.get("shopDomain")?.trim();

  if (!shopDomain) {
    return Response.json({ error: "shopDomain is required" }, { status: 400 });
  }

  const dbUser = await prisma.dashboardUser.findUnique({
    where: { id: user.userId },
    select: { id: true, email: true, shopDomains: true },
  });

  if (!dbUser || !dbUser.shopDomains.includes(shopDomain)) {
    return Response.json({ error: "Store not found in your account" }, { status: 403 });
  }

  const updated = await prisma.dashboardUser.update({
    where: { id: dbUser.id },
    data: { activeShopDomain: shopDomain },
  });

  const token = createToken(updated);
  return redirect("/dashboard", {
    headers: { "Set-Cookie": createSessionCookie(token) },
  });
};
