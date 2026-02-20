/**
 * Signin Page — /signin
 *
 * Authenticates existing merchants into the dashboard.
 * Redirects to /dashboard if already logged in.
 */

import { Form, Link, useActionData, useNavigation, redirect } from "react-router";
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
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting" || navigation.state === "loading";

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
            <input style={s.input} id="email" name="email" type="email" placeholder="you@example.com" required disabled={isSubmitting} />
          </div>

          <div style={s.field}>
            <label style={s.label} htmlFor="password">Password</label>
            <input style={s.input} id="password" name="password" type="password" placeholder="Your password" required disabled={isSubmitting} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{ ...s.button, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            onMouseOver={(e) => !isSubmitting && (e.target.style.background = "#0f1f4f")}
            onMouseOut={(e) => !isSubmitting && (e.target.style.background = "#142b6f")}
          >
            {isSubmitting && <span style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
          {isSubmitting && <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>}
        </Form>

        <div style={s.footer}>
          Don&apos;t have an account?{" "}
          <Link to="/signup" style={s.link}>Create one</Link>
        </div>
      </div>
    </div>
  );
}
