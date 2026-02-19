/**
 * Root Route — /
 *
 * Redirects visitors based on auth state:
 *  - Logged in  → /dashboard
 *  - Logged out → /signin
 *
 * Also still handles the Shopify ?shop= query param for
 * the embedded admin flow (existing behavior).
 */

import { redirect } from "react-router";
import { getDashboardUser } from "../../dashboard/auth/session.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  // Shopify embedded app flow — keep existing behavior
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  // Dashboard auth check
  const user = getDashboardUser(request);
  throw redirect(user ? "/dashboard" : "/signin");
};
