/**
 * Shared layout for auth pages (signin / signup).
 * Renders a centered card with the app branding.
 */

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f5f5",
    padding: "24px",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    background: "#ffffff",
    borderRadius: "12px",
    padding: "40px 32px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  brand: {
    textAlign: "center",
    marginBottom: "32px",
  },
  logo: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#142b6f",
    letterSpacing: "-0.02em",
    marginBottom: "6px",
  },
  tagline: {
    fontSize: "14px",
    color: "#888",
    margin: 0,
  },
  title: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#111",
    marginBottom: "24px",
  },
  errorBox: {
    background: "#fef2f2",
    color: "#b91c1c",
    padding: "10px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    marginBottom: "16px",
    border: "1px solid #fecaca",
  },
  field: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "500",
    color: "#333",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  button: {
    width: "100%",
    padding: "12px",
    background: "#142b6f",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "15px",
    fontWeight: "500",
    cursor: "pointer",
    marginTop: "8px",
    transition: "background 0.2s",
  },
  footer: {
    textAlign: "center",
    marginTop: "20px",
    fontSize: "13px",
    color: "#666",
  },
  link: {
    color: "#142b6f",
    fontWeight: "500",
    textDecoration: "none",
  },
};

export { styles as authStyles };
