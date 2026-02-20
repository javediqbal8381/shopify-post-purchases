/**
 * Dashboard Layout — /dashboard/*
 *
 * Wraps all dashboard pages with a sidebar navigation, topbar,
 * and auth protection. Every child route is only accessible
 * to logged-in users.
 */

import { useState, useRef, useEffect } from "react";
import { Outlet, Form, Link, useLoaderData, useLocation, useFetcher } from "react-router";
import prisma from "../db.server";
import { requireDashboardAuth } from "../dashboard/auth/session.server";

// ─── Loader: protect all dashboard routes ────────────────────
export const loader = async ({ request }) => {
  const jwtUser = requireDashboardAuth(request);
  const dbUser = await prisma.dashboardUser.findUnique({
    where: { id: jwtUser.userId },
    select: { shopDomains: true, activeShopDomain: true },
  });
  return Response.json({
    user: { ...jwtUser, shopDomains: dbUser?.shopDomains ?? [], activeShopDomain: dbUser?.activeShopDomain ?? jwtUser.shopDomain },
  });
};

// ─── Styles ──────────────────────────────────────────────────
const styles = {
  layout: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  sidebar: {
    width: "240px",
    background: "#111827",
    color: "#fff",
    padding: "16px 0",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    height: "100vh",
    boxSizing: "border-box",
  },
  brand: {
    padding: "0 20px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    marginBottom: "16px",
  },
  brandName: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "-0.02em",
  },
  brandTag: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.4)",
    marginTop: "2px",
  },
  nav: {
    flex: 1,
    padding: "0 12px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    overflowY: "auto",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "6px",
    fontSize: "14px",
    color: "rgba(255,255,255,0.7)",
    textDecoration: "none",
    transition: "all 0.15s",
  },
  navLinkActive: {
    background: "rgba(255,255,255,0.1)",
    color: "#fff",
  },
  sidebarFooter: {
    padding: "12px 12px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "6px",
    fontSize: "14px",
    color: "rgba(255,255,255,0.5)",
    background: "none",
    border: "none",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    transition: "color 0.15s",
  },
  main: {
    flex: 1,
    background: "#f9fafb",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  topbar: {
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    padding: "16px 32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: "14px",
    color: "#6b7280",
  },
  greetingName: {
    fontWeight: "600",
    color: "#111827",
  },
  shopBadge: {
    fontSize: "12px",
    color: "#6b7280",
    background: "#f3f4f6",
    padding: "4px 10px",
    borderRadius: "4px",
  },
  content: {
    flex: 1,
    padding: "32px",
  },
  storeSwitcher: {
    position: "relative",
    margin: "0 12px 12px",
  },
  storeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "8px 12px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "13px",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  storeLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "160px",
  },
  chevron: {
    fontSize: "10px",
    opacity: 0.6,
    transition: "transform 0.2s",
  },
  storeDropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "#1f2937",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "4px",
    zIndex: 50,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  },
  storeOption: {
    display: "block",
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    fontSize: "13px",
    color: "rgba(255,255,255,0.7)",
    background: "none",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.1s",
  },
  storeOptionActive: {
    background: "rgba(255,255,255,0.1)",
    color: "#fff",
  },
};

// ─── Helpers ──────────────────────────────────────────────────

function shortStoreName(domain) {
  return domain
    .replace(/^https?:\/\//, "")
    .replace(/\.myshopify\.com\/?$/, "")
    .replace(/\/$/, "");
}

// ─── Store Switcher ──────────────────────────────────────────

function StoreSwitcher({ shopDomains, activeShopDomain }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const fetcher = useFetcher();

  const isSwitching = fetcher.state !== "idle";
  const pendingDomain = fetcher.formData?.get("shopDomain");
  const displayDomain = isSwitching && pendingDomain ? pendingDomain : activeShopDomain;

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (shopDomains.length <= 1) {
    return (
      <div style={styles.storeSwitcher}>
        <div style={{ ...styles.storeButton, cursor: "default" }}>
          <span style={styles.storeLabel}>{shortStoreName(activeShopDomain)}</span>
        </div>
      </div>
    );
  }

  const handleSwitch = (domain) => {
    if (domain === activeShopDomain) { setOpen(false); return; }
    setOpen(false);
    fetcher.submit({ shopDomain: domain }, { method: "post", action: "/api/switch-store" });
  };

  return (
    <div style={styles.storeSwitcher} ref={ref}>
      <button
        type="button"
        style={{ ...styles.storeButton, opacity: isSwitching ? 0.7 : 1 }}
        onClick={() => !isSwitching && setOpen((o) => !o)}
        onMouseOver={(e) => !isSwitching && (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
        onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      >
        <span style={{ ...styles.storeLabel, display: "flex", alignItems: "center", gap: "8px" }}>
          {isSwitching && <Spinner />}
          {shortStoreName(displayDomain)}
        </span>
        {!isSwitching && (
          <span style={{ ...styles.chevron, transform: open ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
        )}
      </button>

      {open && !isSwitching && (
        <div style={styles.storeDropdown}>
          {shopDomains.map((domain) => (
            <button
              key={domain}
              type="button"
              onClick={() => handleSwitch(domain)}
              style={{
                ...styles.storeOption,
                ...(domain === activeShopDomain ? styles.storeOptionActive : {}),
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
              onMouseOut={(e) =>
                (e.currentTarget.style.background =
                  domain === activeShopDomain ? "rgba(255,255,255,0.1)" : "none")
              }
            >
              {shortStoreName(domain)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: "12px",
        height: "12px",
        border: "2px solid rgba(255,255,255,0.2)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Component ───────────────────────────────────────────────
// Nav items config — add new pages here
const NAV_ITEMS = [
  { to: "/dashboard", label: "Overview", icon: "📊", exact: true },
  { to: "/dashboard/orders", label: "Orders", icon: "📦" },
  { to: "/dashboard/settings", label: "Settings", icon: "⚙️" },
  // { to: "/dashboard/cashbacks", label: "Cashbacks", icon: "💰" },
  // { to: "/dashboard/analytics", label: "Analytics", icon: "📈" },
];

export default function DashboardLayout() {
  const { user } = useLoaderData();
  const { pathname } = useLocation();

  return (
    <div style={styles.layout}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandName}>Checkout+</div>
          <div style={styles.brandTag}>Merchant Dashboard</div>
        </div>

        <StoreSwitcher
          shopDomains={user.shopDomains}
          activeShopDomain={user.activeShopDomain}
        />

        <nav style={styles.nav}>
          {NAV_ITEMS.map(({ to, label, icon, exact }) => {
            const isActive = exact ? pathname === to : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                style={{ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) }}
              >
                <span>{icon}</span> {label}
              </Link>
            );
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <Form method="post" action="/api/auth/logout">
            <button
              type="submit"
              style={styles.logoutBtn}
              onMouseOver={(e) => (e.target.style.color = "#fff")}
              onMouseOut={(e) => (e.target.style.color = "rgba(255,255,255,0.5)")}
            >
              <span>🚪</span> Sign Out
            </button>
          </Form>
        </div>
      </aside>

      {/* Main content area */}
      <div style={styles.main}>
        <header style={styles.topbar}>
          <div style={styles.greeting}>
            Welcome back, <span style={styles.greetingName}>{user.email}</span>
          </div>
          <div style={styles.shopBadge}>{shortStoreName(user.activeShopDomain)}</div>
        </header>

        <main style={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
