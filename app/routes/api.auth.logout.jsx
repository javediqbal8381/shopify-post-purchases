/**
 * Logout API — POST /api/auth/logout
 *
 * Clears the dashboard session cookie and redirects to /signin.
 */

import { redirect } from "react-router";
import { destroySessionCookie } from "../dashboard/auth/session.server";

export const action = async () => {
  return redirect("/signin", {
    headers: { "Set-Cookie": destroySessionCookie() },
  });
};
