/**
 * Signup Page — /signup
 *
 * Allows new merchants to create a dashboard account.
 * Redirects to /dashboard if already logged in.
 */

import { Form, Link, useActionData, useNavigation, redirect } from "react-router";
import prisma from "../db.server";
import { authStyles as s } from "../dashboard/components/AuthLayout";
import {
  hashPassword,
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

// ─── Action: handle registration form ────────────────────────
export const action = async ({ request }) => {
  const form = await request.formData();
  const name = form.get("name")?.trim();
  const email = form.get("email")?.trim()?.toLowerCase();
  const shopDomain = form.get("shopDomain")?.trim()?.toLowerCase();
  const password = form.get("password");

  // Validate all fields
  if (!name || !email || !shopDomain || !password) {
    return Response.json({ error: "All fields are required." }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  // Check if email already exists
  const existing = await prisma.dashboardUser.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "An account with this email already exists." }, { status: 400 });
  }

  // Create account
  const passwordHash = await hashPassword(password);
  const user = await prisma.dashboardUser.create({
    data: { name, email, shopDomains: [shopDomain], activeShopDomain: shopDomain, passwordHash },
  });

  // Log them in immediately
  const token = createToken(user);
  return redirect("/dashboard", {
    headers: { "Set-Cookie": createSessionCookie(token) },
  });
};

// ─── UI ──────────────────────────────────────────────────────
export default function SignupPage() {
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

        <h2 style={s.title}>Create your account</h2>

        {actionData?.error && <div style={s.errorBox}>{actionData.error}</div>}

        <Form method="post">
          <div style={s.field}>
            <label style={s.label} htmlFor="name">Full Name</label>
            <input style={s.input} id="name" name="name" type="text" placeholder="John Doe" required disabled={isSubmitting} />
          </div>

          <div style={s.field}>
            <label style={s.label} htmlFor="email">Email</label>
            <input style={s.input} id="email" name="email" type="email" placeholder="you@example.com" required disabled={isSubmitting} />
          </div>

          <div style={s.field}>
            <label style={s.label} htmlFor="shopDomain">Shop Domain</label>
            <input style={s.input} id="shopDomain" name="shopDomain" type="text" placeholder="my-store.myshopify.com" required disabled={isSubmitting} />
          </div>

          <div style={s.field}>
            <label style={s.label} htmlFor="password">Password</label>
            <input style={s.input} id="password" name="password" type="password" placeholder="Min 6 characters" required disabled={isSubmitting} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{ ...s.button, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            onMouseOver={(e) => !isSubmitting && (e.target.style.background = "#0f1f4f")}
            onMouseOut={(e) => !isSubmitting && (e.target.style.background = "#142b6f")}
          >
            {isSubmitting && <span style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
          {isSubmitting && <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>}
        </Form>

        <div style={s.footer}>
          Already have an account?{" "}
          <Link to="/signin" style={s.link}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
