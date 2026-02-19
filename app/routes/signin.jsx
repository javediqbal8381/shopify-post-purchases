/**
 * Signin Page — /signin
 *
 * Authenticates existing merchants into the dashboard.
 * Redirects to /dashboard if already logged in.
 */

import { Form, Link, useActionData, redirect } from "react-router";
import prisma from "../db.server";
import { authStyles as s } from "../dashboard/components/AuthLayout";
import {
  verifyPassword,
  getDashboardUser,
  createToken,
  createSessionCookie,
} from "../dashboard/auth/session.server";

// ─── Loader: redirect to dashboard if already logged in ─────
export const loader = async ({ request }) => {
  const user = getDashboardUser(request);
  if (user) throw redirect("/dashboard");
  return null;
};

// ─── Action: handle login form ───────────────────────────────
export const action = async ({ request }) => {
  const form = await request.formData();
  const email = form.get("email")?.trim()?.toLowerCase();
  const password = form.get("password");

  if (!email || !password) {
    return Response.json({ error: "Email and password are required." }, { status: 400 });
  }

  // Find user by email
  const user = await prisma.dashboardUser.findUnique({ where: { email } });
  if (!user) {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Verify password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Create session and redirect
  const token = createToken(user);
  return redirect("/dashboard", {
    headers: { "Set-Cookie": createSessionCookie(token) },
  });
};

// ─── UI ──────────────────────────────────────────────────────
export default function SigninPage() {
  const actionData = useActionData();

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.brand}>
          <div style={s.logo}>Checkout+</div>
          <p style={s.tagline}>Cashback & Order Protection</p>
        </div>

        <h2 style={s.title}>Sign in to your dashboard</h2>

        {actionData?.error && <div style={s.errorBox}>{actionData.error}</div>}

        <Form method="post">
          <div style={s.field}>
            <label style={s.label} htmlFor="email">Email</label>
            <input style={s.input} id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>

          <div style={s.field}>
            <label style={s.label} htmlFor="password">Password</label>
            <input style={s.input} id="password" name="password" type="password" placeholder="Your password" required />
          </div>

          <button
            type="submit"
            style={s.button}
            onMouseOver={(e) => (e.target.style.background = "#0f1f4f")}
            onMouseOut={(e) => (e.target.style.background = "#142b6f")}
          >
            Sign In
          </button>
        </Form>

        <div style={s.footer}>
          Don&apos;t have an account?{" "}
          <Link to="/signup" style={s.link}>Create one</Link>
        </div>
      </div>
    </div>
  );
}
