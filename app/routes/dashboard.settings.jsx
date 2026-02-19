/**
 * Settings Page — /dashboard/settings
 *
 * Lets the merchant update their profile info (name, email, shop domain)
 * and change their password.
 */

import { Form, useLoaderData, useActionData } from "react-router";
import prisma from "../db.server";
import {
  requireDashboardAuth,
  hashPassword,
  verifyPassword,
  createToken,
  createSessionCookie,
} from "../dashboard/auth/session.server";

// ─── Loader: fetch current user profile ──────────────────────
export const loader = async ({ request }) => {
  const sessionUser = requireDashboardAuth(request);
  const user = await prisma.dashboardUser.findUnique({
    where: { id: sessionUser.userId },
    select: { id: true, name: true, email: true, shopDomains: true, activeShopDomain: true },
  });
  return Response.json({ user });
};

// ─── Action: handle profile & password updates ───────────────
export const action = async ({ request }) => {
  const sessionUser = requireDashboardAuth(request);
  const form = await request.formData();
  const intent = form.get("intent");

  // ── Update profile ──
  if (intent === "profile") {
    const name = form.get("name")?.trim();
    const email = form.get("email")?.trim()?.toLowerCase();

    if (!name || !email) {
      return Response.json({ profile: { error: "Name and email are required." } }, { status: 400 });
    }

    const existing = await prisma.dashboardUser.findUnique({ where: { email } });
    if (existing && existing.id !== sessionUser.userId) {
      return Response.json({ profile: { error: "This email is already in use." } }, { status: 400 });
    }

    const updated = await prisma.dashboardUser.update({
      where: { id: sessionUser.userId },
      data: { name, email },
    });

    const token = createToken(updated);
    return Response.json(
      { profile: { success: "Profile updated successfully." } },
      { headers: { "Set-Cookie": createSessionCookie(token) } }
    );
  }

  // ── Change password ──
  if (intent === "password") {
    const currentPassword = form.get("currentPassword");
    const newPassword = form.get("newPassword");

    if (!currentPassword || !newPassword) {
      return Response.json({ password: { error: "Both fields are required." } }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return Response.json({ password: { error: "New password must be at least 6 characters." } }, { status: 400 });
    }

    const user = await prisma.dashboardUser.findUnique({ where: { id: sessionUser.userId } });
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return Response.json({ password: { error: "Current password is incorrect." } }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.dashboardUser.update({
      where: { id: sessionUser.userId },
      data: { passwordHash },
    });

    return Response.json({ password: { success: "Password changed successfully." } });
  }

  return Response.json({ error: "Invalid action." }, { status: 400 });
};

// ─── Styles ──────────────────────────────────────────────────
const styles = {
  pageTitle: {
    fontSize: "24px",
    fontWeight: "600",
    color: "#111827",
    marginBottom: "24px",
    letterSpacing: "-0.02em",
  },
  section: {
    background: "#fff",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    padding: "24px",
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#111827",
    marginBottom: "4px",
  },
  sectionDesc: {
    fontSize: "13px",
    color: "#6b7280",
    marginBottom: "20px",
  },
  fieldRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "16px",
  },
  fieldFull: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "500",
    color: "#374151",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    fontSize: "14px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  button: {
    padding: "9px 20px",
    background: "#142b6f",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  toast: {
    padding: "10px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    marginBottom: "16px",
  },
  success: {
    background: "#ecfdf5",
    color: "#065f46",
    border: "1px solid #a7f3d0",
  },
  error: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
  },
};

// ─── Component ───────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useLoaderData();
  const actionData = useActionData();

  return (
    <div>
      <h1 style={styles.pageTitle}>Settings</h1>

      {/* ── Profile Section ── */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Profile</h2>
        <p style={styles.sectionDesc}>Update your account details and store information.</p>

        {actionData?.profile?.success && (
          <div style={{ ...styles.toast, ...styles.success }}>{actionData.profile.success}</div>
        )}
        {actionData?.profile?.error && (
          <div style={{ ...styles.toast, ...styles.error }}>{actionData.profile.error}</div>
        )}

        <Form method="post">
          <input type="hidden" name="intent" value="profile" />

          <div style={styles.fieldRow}>
            <div>
              <label style={styles.label} htmlFor="name">Full Name</label>
              <input style={styles.input} id="name" name="name" type="text" defaultValue={user.name} required />
            </div>
            <div>
              <label style={styles.label} htmlFor="email">Email</label>
              <input style={styles.input} id="email" name="email" type="email" defaultValue={user.email} required />
            </div>
          </div>

          <div style={styles.fieldFull}>
            <label style={styles.label}>Connected Stores</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {user.shopDomains.map((domain) => (
                <span
                  key={domain}
                  style={{
                    display: "inline-block",
                    padding: "6px 12px",
                    fontSize: "13px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    background: domain === user.activeShopDomain ? "#eef2ff" : "#f9fafb",
                    color: domain === user.activeShopDomain ? "#3730a3" : "#374151",
                    fontWeight: domain === user.activeShopDomain ? "500" : "400",
                  }}
                >
                  {domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  {domain === user.activeShopDomain && " ✓"}
                </span>
              ))}
            </div>
            <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "6px" }}>
              Use the sidebar switcher to change your active store.
            </p>
          </div>

          <button
            type="submit"
            style={styles.button}
            onMouseOver={(e) => (e.target.style.background = "#0f1f4f")}
            onMouseOut={(e) => (e.target.style.background = "#142b6f")}
          >
            Save Changes
          </button>
        </Form>
      </div>

      {/* ── Password Section ── */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Change Password</h2>
        <p style={styles.sectionDesc}>Update your password. Must be at least 6 characters.</p>

        {actionData?.password?.success && (
          <div style={{ ...styles.toast, ...styles.success }}>{actionData.password.success}</div>
        )}
        {actionData?.password?.error && (
          <div style={{ ...styles.toast, ...styles.error }}>{actionData.password.error}</div>
        )}

        <Form method="post">
          <input type="hidden" name="intent" value="password" />

          <div style={styles.fieldRow}>
            <div>
              <label style={styles.label} htmlFor="currentPassword">Current Password</label>
              <input style={styles.input} id="currentPassword" name="currentPassword" type="password" required />
            </div>
            <div>
              <label style={styles.label} htmlFor="newPassword">New Password</label>
              <input style={styles.input} id="newPassword" name="newPassword" type="password" placeholder="Min 6 characters" required />
            </div>
          </div>

          <button
            type="submit"
            style={styles.button}
            onMouseOver={(e) => (e.target.style.background = "#0f1f4f")}
            onMouseOut={(e) => (e.target.style.background = "#142b6f")}
          >
            Update Password
          </button>
        </Form>
      </div>
    </div>
  );
}
