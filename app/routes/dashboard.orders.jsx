/**
 * Orders Page — /dashboard/orders
 *
 * Fetches and displays all orders from the merchant's Shopify store.
 * Includes search, date range filter, status dropdowns, and CSV export.
 */

import { useState, useCallback } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import prisma from "../db.server";
import { requireDashboardAuth } from "../dashboard/auth/session.server";

// ─── Loader: fetch orders from Shopify Admin API ─────────────
export const loader = async ({ request }) => {
  const user = requireDashboardAuth(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("dir") || "next";
  const search = url.searchParams.get("q") || "";
  const dateFrom = url.searchParams.get("from") || "";
  const dateTo = url.searchParams.get("to") || "";
  const insuredFilter = url.searchParams.get("insured") || "all";
  const statusFilter = url.searchParams.get("status") || "all";

  const shopDomain = user.shopDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const session = await prisma.session.findFirst({
    where: { shop: shopDomain, isOnline: false },
    orderBy: { createdAt: "desc" },
  });

  if (!session?.accessToken) {
    return Response.json({
      orders: [], pageInfo: {}, error: "Store not connected. Please install the app on your Shopify store first.",
      filters: { search, dateFrom, dateTo, insuredFilter, statusFilter },
    });
  }

  // Build Shopify query string for server-side filtering
  const queryParts = [];
  if (search) queryParts.push(search);
  if (dateFrom) queryParts.push(`created_at:>='${dateFrom}'`);
  if (dateTo) queryParts.push(`created_at:<='${dateTo}T23:59:59'`);
  if (statusFilter === "paid") queryParts.push("financial_status:paid");
  if (statusFilter === "refunded") queryParts.push("financial_status:refunded");
  if (statusFilter === "pending") queryParts.push("financial_status:pending");
  const shopifyQuery = queryParts.length ? `, query: "${queryParts.join(" ")}"` : "";

  const paginationArgs = cursor
    ? direction === "prev"
      ? `last: 20, before: "${cursor}"`
      : `first: 20, after: "${cursor}"`
    : `first: 20`;

  const query = `{
    orders(${paginationArgs}, sortKey: CREATED_AT, reverse: true${shopifyQuery}) {
      edges {
        cursor
        node {
          id name createdAt
          displayFinancialStatus displayFulfillmentStatus
          totalPriceSet { shopMoney { amount currencyCode } }
          customer { firstName lastName email }
          lineItems(first: 50) {
            nodes {
              title quantity
              originalTotalSet { shopMoney { amount } }
              product { handle }
            }
          }
          customAttributes { key value }
        }
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    }
  }`;

  let data;
  try {
    const res = await fetch(`https://${shopDomain}/admin/api/2025-10/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": session.accessToken },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      return Response.json({ orders: [], pageInfo: {}, error: `Shopify API error (${res.status}).`, filters: { search, dateFrom, dateTo, insuredFilter, statusFilter } });
    }
    data = await res.json();
  } catch (err) {
    return Response.json({ orders: [], pageInfo: {}, error: `Failed to connect: ${err.message}`, filters: { search, dateFrom, dateTo, insuredFilter, statusFilter } });
  }

  if (data.errors) {
    return Response.json({ orders: [], pageInfo: {}, error: `Shopify: ${data.errors[0]?.message}`, filters: { search, dateFrom, dateTo, insuredFilter, statusFilter } });
  }

  const edges = data.data?.orders?.edges || [];
  const pageInfo = data.data?.orders?.pageInfo || {};

  let orders = edges.map(({ node, cursor: c }) => {
    const protectionItem = node.lineItems.nodes.find((item) => {
      const handle = item.product?.handle || "";
      const title = (item.title || "").toLowerCase();
      return handle.includes("order-protection") || title.includes("checkout+") || title.includes("protection");
    });
    const protectionAttr = node.customAttributes?.find((a) => a.key === "_protection_enabled");
    const isInsured = !!protectionItem || protectionAttr?.value === "true";

    return {
      cursor: c, id: node.id, name: node.name, createdAt: node.createdAt,
      financialStatus: node.displayFinancialStatus,
      fulfillmentStatus: node.displayFulfillmentStatus,
      total: node.totalPriceSet.shopMoney.amount,
      currency: node.totalPriceSet.shopMoney.currencyCode,
      customer: node.customer ? `${node.customer.firstName || ""} ${node.customer.lastName || ""}`.trim() : "Guest",
      isInsured,
      insuredAmount: protectionItem?.originalTotalSet?.shopMoney?.amount || null,
    };
  });

  // Client-side insured filter (Shopify can't filter by line item)
  if (insuredFilter === "insured") orders = orders.filter((o) => o.isInsured);
  if (insuredFilter === "not_insured") orders = orders.filter((o) => !o.isInsured);

  return Response.json({
    orders, pageInfo,
    filters: { search, dateFrom, dateTo, insuredFilter, statusFilter },
  });
};

// ─── Helpers ─────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function formatMoney(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(parseFloat(amount));
}
function getStatusBadge(status) {
  const n = (status || "").toLowerCase().replace(/_/g, " ");
  if (n.includes("paid") && !n.includes("un")) return { bg: "#ecfdf5", color: "#065f46", label: "Paid" };
  if (n.includes("refund")) return { bg: "#fef2f2", color: "#b91c1c", label: "Refunded" };
  if (n.includes("partial")) return { bg: "#fffbeb", color: "#92400e", label: "Partial" };
  return { bg: "#fffbeb", color: "#92400e", label: n || "Pending" };
}

// ─── Styles ──────────────────────────────────────────────────
const s = {
  pageHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px",
  },
  pageTitle: {
    fontSize: "24px", fontWeight: "600", color: "#111827", letterSpacing: "-0.02em",
  },
  csvBtn: {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "8px 16px", fontSize: "13px", fontWeight: "500",
    background: "#fff", border: "1px solid #d1d5db", borderRadius: "8px",
    color: "#374151", cursor: "pointer", transition: "background 0.15s",
  },
  // Filter toolbar
  toolbar: {
    display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap",
  },
  searchBox: {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "0 12px", background: "#fff", border: "1px solid #e5e7eb",
    borderRadius: "8px", flex: "1", minWidth: "180px", maxWidth: "300px",
  },
  searchIcon: { color: "#9ca3af", fontSize: "14px", flexShrink: 0 },
  searchInput: {
    border: "none", outline: "none", padding: "9px 0", fontSize: "13px",
    width: "100%", background: "transparent", color: "#374151",
  },
  dateInput: {
    padding: "8px 12px", fontSize: "13px", border: "1px solid #e5e7eb",
    borderRadius: "8px", color: "#374151", background: "#fff", outline: "none",
  },
  dateSep: { color: "#d1d5db", fontSize: "13px" },
  // Dropdown filters row
  filtersRow: {
    display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap",
  },
  dropdown: {
    padding: "6px 12px", fontSize: "12px", fontWeight: "500",
    border: "1px solid #e5e7eb", borderRadius: "6px", background: "#fff",
    color: "#374151", cursor: "pointer", outline: "none",
    appearance: "none", paddingRight: "28px",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
  },
  // Table
  card: {
    background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "14px" },
  th: {
    textAlign: "left", padding: "14px 20px", fontSize: "12px", fontWeight: "500",
    color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em",
    borderBottom: "1px solid #e5e7eb", background: "#fafafa",
  },
  td: {
    padding: "16px 20px", borderBottom: "1px solid #f3f4f6", color: "#374151", verticalAlign: "middle",
  },
  orderName: { fontWeight: "600", color: "#0e7490", fontSize: "14px" },
  badge: {
    display: "inline-block", padding: "3px 10px", borderRadius: "4px",
    fontSize: "11px", fontWeight: "600", marginRight: "6px",
  },
  amount: { fontWeight: "500", color: "#111827", whiteSpace: "nowrap" },
  date: { fontSize: "13px", color: "#6b7280", whiteSpace: "nowrap" },
  pagination: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 20px", borderTop: "1px solid #e5e7eb",
  },
  pageBtn: {
    padding: "7px 16px", fontSize: "13px", fontWeight: "500",
    background: "#fff", border: "1px solid #d1d5db", borderRadius: "6px",
    color: "#374151", cursor: "pointer",
  },
  pageBtnDisabled: { opacity: 0.4, cursor: "default" },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "#9ca3af", fontSize: "14px" },
  errorBox: {
    background: "#fef2f2", color: "#b91c1c", padding: "14px 20px",
    borderRadius: "8px", fontSize: "14px", marginBottom: "16px", border: "1px solid #fecaca",
  },
};

// ─── Component ───────────────────────────────────────────────
export default function OrdersPage() {
  const { orders, pageInfo, error, filters } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local filter state — syncs to URL on submit
  const [search, setSearch] = useState(filters?.search || "");
  const [dateFrom, setDateFrom] = useState(filters?.dateFrom || "");
  const [dateTo, setDateTo] = useState(filters?.dateTo || "");
  const [insured, setInsured] = useState(filters?.insuredFilter || "all");
  const [status, setStatus] = useState(filters?.statusFilter || "all");

  // Build params object from current filters
  const buildParams = useCallback((overrides = {}) => {
    const p = { q: search, from: dateFrom, to: dateTo, insured, status, ...overrides };
    return Object.fromEntries(Object.entries(p).filter(([, v]) => v && v !== "all"));
  }, [search, dateFrom, dateTo, insured, status]);

  const applyFilters = () => setSearchParams(buildParams());

  const goNext = () => {
    if (pageInfo.hasNextPage) setSearchParams({ ...buildParams(), cursor: pageInfo.endCursor, dir: "next" });
  };
  const goPrev = () => {
    if (pageInfo.hasPreviousPage) setSearchParams({ ...buildParams(), cursor: pageInfo.startCursor, dir: "prev" });
  };

  // CSV download
  const handleCSV = () => {
    const header = "Order,Status,Insured,Total,Amount Insured,Customer,Date\n";
    const rows = orders.map((o) => {
      const sb = getStatusBadge(o.financialStatus);
      return `"${o.name}","${sb.label}","${o.isInsured ? "Yes" : "No"}","${formatMoney(o.total, o.currency)}","${o.insuredAmount ? formatMoney(o.insuredAmount, o.currency) : ""}","${o.customer}","${formatDate(o.createdAt)}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Apply filters on dropdown change
  const onDropdownChange = (key, value) => {
    if (key === "insured") setInsured(value);
    if (key === "status") setStatus(value);
    setSearchParams(buildParams({ [key]: value === "all" ? undefined : value }));
  };

  return (
    <div>
      {/* Header */}
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>Orders</h1>
        <button style={s.csvBtn} onClick={handleCSV} title="Download CSV">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download CSV
        </button>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      {/* Search + Date Range */}
      <div style={s.toolbar}>
        <div style={s.searchBox}>
          <span style={s.searchIcon}>🔍</span>
          <input
            style={s.searchInput}
            type="text"
            placeholder="Search for an order"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>

        <input style={s.dateInput} type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSearchParams(buildParams({ from: e.target.value || undefined })); }} />
        <span style={s.dateSep}>–</span>
        <input style={s.dateInput} type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSearchParams(buildParams({ to: e.target.value || undefined })); }} />
      </div>

      {/* Dropdown Filters */}
      <div style={s.filtersRow}>
        <select style={s.dropdown} value={insured} onChange={(e) => onDropdownChange("insured", e.target.value)}>
          <option value="all">Insured Status</option>
          <option value="insured">Insured</option>
          <option value="not_insured">Not Insured</option>
        </select>
        <select style={s.dropdown} value={status} onChange={(e) => onDropdownChange("status", e.target.value)}>
          <option value="all">Payment Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {/* Table */}
      <div style={s.card}>
        {orders.length === 0 && !error ? (
          <div style={s.emptyState}>No orders match your filters.</div>
        ) : (
          <>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Order</th>
                  <th style={s.th} />
                  <th style={s.th}>Total</th>
                  <th style={s.th}>Amount Insured</th>
                  <th style={s.th}>Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const sb = getStatusBadge(order.financialStatus);
                  return (
                    <tr key={order.id}>
                      <td style={s.td}>
                        <span style={s.orderName}>{order.name}</span>
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, background: sb.bg, color: sb.color }}>{sb.label}</span>
                        {order.isInsured && (
                          <span style={{ ...s.badge, background: "#eff6ff", color: "#1e40af" }}>Insured</span>
                        )}
                      </td>
                      <td style={{ ...s.td, ...s.amount }}>{formatMoney(order.total, order.currency)}</td>
                      <td style={{ ...s.td, ...s.amount }}>
                        {order.isInsured && order.insuredAmount
                          ? formatMoney(order.insuredAmount, order.currency)
                          : <span style={{ color: "#d1d5db" }}>—</span>
                        }
                      </td>
                      <td style={{ ...s.td, ...s.date }}>{formatDate(order.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={s.pagination}>
              <button style={{ ...s.pageBtn, ...(pageInfo.hasPreviousPage ? {} : s.pageBtnDisabled) }} onClick={goPrev} disabled={!pageInfo.hasPreviousPage}>
                ← Previous
              </button>
              <span style={{ fontSize: "13px", color: "#9ca3af" }}>Showing {orders.length} orders</span>
              <button style={{ ...s.pageBtn, ...(pageInfo.hasNextPage ? {} : s.pageBtnDisabled) }} onClick={goNext} disabled={!pageInfo.hasNextPage}>
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
