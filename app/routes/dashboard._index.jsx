/**
 * Dashboard Home — /dashboard
 *
 * Tabbed layout: Protect | CashBack
 * - Protect: insured-order KPIs, attach rate bar chart, donut breakdowns, top products table
 * - CashBack: cashback KPIs, area chart over time, recent orders table
 *
 * Data is scoped to the logged-in user's shopDomain.
 * Charts powered by Recharts.
 */

import { useState, useCallback } from "react";
import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import prisma from "../db.server";
import { requireDashboardAuth } from "../dashboard/auth/session.server";
import DateRangeFilter from "../dashboard/components/DateRangeFilter";

// ─── Loader ──────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const user = requireDashboardAuth(request);
  const rawShop = user.shopDomain;
  const shopDomain = rawShop.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const url = new URL(request.url);

  const tab = url.searchParams.get("tab") || "protect";

  // Parse date range — supports explicit from/to or legacy "range" (days) param
  const paramFrom = url.searchParams.get("dateFrom");
  const paramTo = url.searchParams.get("dateTo");
  const filterLabel = url.searchParams.get("filterLabel") || null;
  const excludeDaysParam = url.searchParams.get("excludeDays");
  const excludeMonthsParam = url.searchParams.get("excludeMonths");
  const excludeDays = excludeDaysParam ? excludeDaysParam.split(",").map(Number) : [];
  const excludeMonths = excludeMonthsParam ? excludeMonthsParam.split(",").map(Number) : [];

  let dateFrom, dateTo;
  if (paramFrom && paramTo) {
    dateFrom = new Date(paramFrom);
    dateTo = new Date(paramTo);
  } else {
    const rangeDays = parseInt(url.searchParams.get("range") || "30", 10) || 30;
    dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - rangeDays);
    dateTo = new Date();
  }
  const days = Math.max(1, Math.round((dateTo - dateFrom) / (1000 * 60 * 60 * 24)));

  // ── Cashback stats — fetch all records for bucketing ──
  const cbWhere = { shopDomain: { in: [shopDomain, rawShop] }, createdAt: { gte: dateFrom, lte: dateTo } };
  // Helper: check if a date should be excluded
  const isExcluded = (d) => {
    const jsDay = d.getDay(); // 0=Sun
    const dayIdx = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon mapping to match our DAY_NAMES
    if (excludeDays.length > 0 && excludeDays.includes(dayIdx)) return true;
    if (excludeMonths.length > 0 && excludeMonths.includes(d.getMonth())) return true;
    return false;
  };

  const allCbRecordsRaw = await prisma.pendingCashback.findMany({
    where: cbWhere,
    select: {
      id: true, orderId: true, orderName: true, customerEmail: true, customerName: true,
      cashbackAmount: true, emailSent: true, emailSentAt: true, emailScheduledFor: true,
      discountCode: true, errorMessage: true, orderCreatedAt: true, createdAt: true,
    },
  });
  const allCbRecords = allCbRecordsRaw.filter((r) => !isExcluded(new Date(r.createdAt)));

  // Build a Set of cashback order numeric IDs for cross-referencing with Shopify
  const cbOrderIdSet = new Set(allCbRecords.map((r) => r.orderId));

  const cbTotal = allCbRecords.length;
  const cbPending = allCbRecords.filter((r) => !r.emailSent && !r.errorMessage).length;
  const cbSent = allCbRecords.filter((r) => r.emailSent).length;
  const cbFailed = allCbRecords.filter((r) => !!r.errorMessage).length;
  const totalIssued = allCbRecords.reduce((sum, r) => sum + parseFloat(r.cashbackAmount || "0"), 0);

  // Build daily, weekly, monthly buckets from cashback records
  const cbDailyMap = {};
  const weeklyMap = {};
  const monthlyMap = {};
  for (const rec of allCbRecords) {
    const d = new Date(rec.createdAt);
    const amt = parseFloat(rec.cashbackAmount || "0");

    // Daily
    const dk = d.toISOString().slice(0, 10);
    if (!cbDailyMap[dk]) cbDailyMap[dk] = { date: dk, count: 0, amount: 0 };
    cbDailyMap[dk].count += 1;
    cbDailyMap[dk].amount += amt;

    // Weekly (Monday of the week)
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    const wk = monday.toISOString().slice(0, 10);
    if (!weeklyMap[wk]) weeklyMap[wk] = { week: wk, count: 0, amount: 0 };
    weeklyMap[wk].count += 1;
    weeklyMap[wk].amount += amt;

    // Monthly
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[mk]) monthlyMap[mk] = { month: mk, count: 0, amount: 0 };
    monthlyMap[mk].count += 1;
    monthlyMap[mk].amount += amt;
  }

  // Fill daily cashback buckets for the full date range
  const cbDailyData = [];
  for (let d = 0; d <= days; d++) {
    const date = new Date(dateFrom);
    date.setDate(dateFrom.getDate() + d);
    const key = date.toISOString().slice(0, 10);
    cbDailyData.push(cbDailyMap[key] || { date: key, count: 0, amount: 0 });
  }

  const weeklyData = Object.values(weeklyMap).sort((a, b) => a.week.localeCompare(b.week));
  const monthlyData = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

  // ── Shopify orders + discount usage ──
  let dailyData = [];
  let shopifyError = null;
  let cbOrderRevenue = 0;
  let protect = { totalOrders: 0, insuredOrders: 0, attachRate: 0, insuredRevenue: 0, statusBreakdown: [], topProducts: [] };
  const discountUsageMap = new Map(); // code → { used: bool, usageCount: number }

  const session = await prisma.session.findFirst({
    where: { shop: shopDomain, isOnline: false },
    orderBy: { createdAt: "desc" },
  });

  if (session?.accessToken) {
    try {
      // Fetch all CASHBACK discount codes and their usage from Shopify
      const discountQuery = `{
        codeDiscountNodes(first: 100, query: "title:Cashback*") {
          nodes {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                status
                asyncUsageCount
                codes(first: 1) {
                  nodes { code }
                }
              }
            }
          }
        }
      }`;
      const discountRes = await fetch(`https://${shopDomain}/admin/api/2025-10/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": session.accessToken },
        body: JSON.stringify({ query: discountQuery }),
      });
      if (discountRes.ok) {
        const discountData = await discountRes.json();
        console.log("[Dashboard] Shopify discount data:", JSON.stringify(discountData, null, 2));
        const discountNodes = discountData.data?.codeDiscountNodes?.nodes || [];
        for (const node of discountNodes) {
          const disc = node.codeDiscount;
          const code = disc?.codes?.nodes?.[0]?.code;
          if (code) {
            discountUsageMap.set(code, {
              used: (disc.asyncUsageCount || 0) > 0,
              usageCount: disc.asyncUsageCount || 0,
              status: disc.status,
            });
          }
        }
      }
    } catch (err) {
      console.error("Discount usage fetch error:", err.message);
    }

    try {
      const isoFrom = dateFrom.toISOString();
      const isoTo = dateTo.toISOString();
      const query = `{
        orders(first: 250, sortKey: CREATED_AT, reverse: true, query: "created_at:>='${isoFrom}' AND created_at:<='${isoTo}'") {
          nodes {
            id name createdAt
            totalPriceSet { shopMoney { amount currencyCode } }
            displayFinancialStatus
            customer { firstName lastName }
            lineItems(first: 20) {
              nodes { title quantity product { handle } originalTotalSet { shopMoney { amount } } }
            }
          }
        }
      }`;

      const res = await fetch(`https://${shopDomain}/admin/api/2025-10/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": session.accessToken },
        body: JSON.stringify({ query }),
      });

      if (res.ok) {
        const data = await res.json();
        const nodes = data.data?.orders?.nodes || [];

        // ── Build daily buckets from dateFrom to dateTo ──
        const dailyMap = {};
        for (let d = 0; d <= days; d++) {
          const date = new Date(dateFrom);
          date.setDate(dateFrom.getDate() + d);
          const key = date.toISOString().slice(0, 10);
          dailyMap[key] = { date: key, orders: 0, revenue: 0, insured: 0, attachRate: 0 };
        }

        // ── Protect aggregation accumulators ──
        let totalOrders = 0, insuredOrders = 0, insuredRevenue = 0;
        const statusMap = {};
        const productMap = {};

        for (const order of nodes) {
          const orderDate = new Date(order.createdAt);
          if (isExcluded(orderDate)) continue;
          const key = orderDate.toISOString().slice(0, 10);
          const orderTotal = parseFloat(order.totalPriceSet.shopMoney.amount || "0");

          // Cross-reference: is this a cashback-eligible order?
          const numericId = order.id.replace(/\D/g, "");
          if (cbOrderIdSet.has(numericId)) cbOrderRevenue += orderTotal;

          const isInsured = order.lineItems.nodes.some((item) => {
            const handle = item.product?.handle || "";
            const title = (item.title || "").toLowerCase();
            return handle.includes("order-protection") || title.includes("checkout+") || title.includes("protection");
          });

          totalOrders++;
          if (isInsured) {
            insuredOrders++;
            insuredRevenue += orderTotal;

            // Status breakdown (only insured orders)
            const st = order.displayFinancialStatus || "PENDING";
            statusMap[st] = (statusMap[st] || 0) + 1;

            // Product frequency — count non-protection line items in insured orders
            for (const item of order.lineItems.nodes) {
              const handle = item.product?.handle || "";
              const title = (item.title || "").toLowerCase();
              const isProtectionLine = handle.includes("order-protection") || title.includes("checkout+") || title.includes("protection");
              if (!isProtectionLine && item.title) {
                productMap[item.title] = (productMap[item.title] || 0) + item.quantity;
              }
            }
          }

          if (dailyMap[key]) {
            dailyMap[key].orders += 1;
            dailyMap[key].revenue += orderTotal;
            if (isInsured) dailyMap[key].insured += 1;
          }
        }

        // Compute per-day attach rate
        for (const day of Object.values(dailyMap)) {
          day.attachRate = day.orders > 0 ? Math.round((day.insured / day.orders) * 100) : 0;
        }

        dailyData = Object.values(dailyMap);

        // Status breakdown for donut
        const statusBreakdown = Object.entries(statusMap).map(([name, value]) => {
          const label = name.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
          return { name: label, value };
        });

        // Top products sorted by count
        const topProducts = Object.entries(productMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        protect = {
          totalOrders, insuredOrders,
          attachRate: totalOrders > 0 ? ((insuredOrders / totalOrders) * 100).toFixed(2) : "0",
          insuredRevenue: insuredRevenue.toFixed(2),
          statusBreakdown,
          topProducts,
        };

      }
    } catch (err) {
      console.error("Shopify order fetch error:", err.message);
      shopifyError = err.message;
    }
  }

  // Fallback empty daily buckets
  if (dailyData.length === 0) {
    for (let d = 0; d <= days; d++) {
      const date = new Date(dateFrom);
      date.setDate(dateFrom.getDate() + d);
      dailyData.push({ date: date.toISOString().slice(0, 10), orders: 0, revenue: 0, insured: 0, attachRate: 0 });
    }
  }

  // Enrich cashback records with Shopify discount usage data
  const recentCbOrders = allCbRecords
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20)
    .map((r) => {
      const usage = r.discountCode ? discountUsageMap.get(r.discountCode) : null;
      return {
        orderName: r.orderName,
        customerName: r.customerName,
        customerEmail: r.customerEmail,
        cashbackAmount: r.cashbackAmount,
        discountCode: r.discountCode,
        emailSent: r.emailSent,
        emailSentAt: r.emailSentAt,
        emailScheduledFor: r.emailScheduledFor,
        errorMessage: r.errorMessage,
        orderCreatedAt: r.orderCreatedAt,
        redeemed: usage?.used || false,
      };
    });

  const sentCodes = allCbRecords.filter((r) => r.emailSent && r.discountCode);
  const cbRedeemed = sentCodes.filter((r) => discountUsageMap.get(r.discountCode)?.used).length;
  const cbUnredeemed = sentCodes.length - cbRedeemed;
  const redeemedAmount = sentCodes
    .filter((r) => discountUsageMap.get(r.discountCode)?.used)
    .reduce((sum, r) => sum + parseFloat(r.cashbackAmount || "0"), 0);

  return Response.json({
    tab, activeRange: days, shopifyError, filterLabel,
    excludeDays, excludeMonths,
    protect, dailyData,
    cashback: {
      total: cbTotal, pending: cbPending, sent: cbSent, failed: cbFailed,
      totalIssued, cbOrderRevenue, weeklyData, monthlyData, cbDailyData, recentCbOrders,
      redeemed: cbRedeemed, unredeemed: cbUnredeemed, redeemedAmount,
    },
  });
};

// ─── Colors ──────────────────────────────────────────────────
const C = {
  primary: "#142b6f",
  teal: "#2dd4bf",
  tealDark: "#0d9488",
  green: "#10b981",
  blue: "#1e40af",
  amber: "#f59e0b",
  red: "#ef4444",
};

const DONUT_PALETTE = ["#38bdf8", "#a78bfa", "#fb923c", "#f87171", "#34d399", "#fbbf24", "#818cf8"];

// ─── Styles ──────────────────────────────────────────────────
const s = {
  pageTitle: { fontSize: "28px", fontWeight: "700", color: "#111827", marginBottom: "4px", letterSpacing: "-0.02em" },
  // Tab bar
  tabBar: { display: "flex", gap: "0", borderBottom: "2px solid #e5e7eb", marginBottom: "24px" },
  tab: {
    padding: "12px 24px", fontSize: "15px", fontWeight: "500", color: "#9ca3af",
    cursor: "pointer", border: "none", background: "none",
    borderBottom: "2px solid transparent", marginBottom: "-2px", transition: "all 0.15s",
  },
  tabActive: { color: "#111827", fontWeight: "600", borderBottomColor: "#111827" },
  // Filter
  filterBar: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", flexWrap: "wrap" },
  filterIcon: { padding: "8px 10px", fontSize: "15px", color: "#6b7280", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  // Summary KPI cards — large centered numbers
  summaryLabel: { fontSize: "13px", fontWeight: "500", color: "#6b7280", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  summaryValue: { fontSize: "40px", fontWeight: "700", color: "#1e293b", lineHeight: 1, textAlign: "center", padding: "16px 0 8px" },
  summaryCard: { background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", padding: "20px 24px" },
  // Section headings
  sectionHeading: { fontSize: "14px", fontWeight: "500", color: "#9ca3af", textAlign: "center", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.06em" },
  // Generic card
  card: { background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", padding: "24px" },
  cardTitle: { fontSize: "14px", fontWeight: "600", color: "#111827", marginBottom: "20px" },
  // Table
  table: { width: "100%", background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", borderCollapse: "collapse", fontSize: "14px" },
  th: { textAlign: "left", padding: "12px 16px", fontSize: "12px", fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" },
  td: { padding: "12px 16px", borderBottom: "1px solid #f3f4f6", color: "#374151" },
  badge: { display: "inline-block", padding: "2px 8px", borderRadius: "9999px", fontSize: "12px", fontWeight: "500" },
  emptyState: { textAlign: "center", padding: "40px", color: "#9ca3af", fontSize: "14px" },
  // KPI bar (horizontal strip for cashback tab)
  kpiBar: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb", marginBottom: "24px", overflow: "hidden" },
  kpiItem: { padding: "20px 24px", borderRight: "1px solid #f3f4f6" },
  kpiLabel: { fontSize: "12px", fontWeight: "500", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" },
  kpiValue: { fontSize: "28px", fontWeight: "700", lineHeight: 1 },
  dot: { width: "8px", height: "8px", borderRadius: "50%", display: "inline-block" },
  // Coming soon overlay
  comingSoon: { position: "absolute", top: "10px", right: "12px", fontSize: "10px", color: "#a78bfa", background: "#f5f3ff", padding: "2px 8px", borderRadius: "4px", fontWeight: "600", letterSpacing: "0.04em" },
};

// ─── Info tooltip icon ───────────────────────────────────────
const infoStyle = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: "16px", height: "16px", borderRadius: "50%", fontSize: "10px",
  fontWeight: "700", color: "#9ca3af", border: "1.5px solid #d1d5db",
  cursor: "help", flexShrink: 0, lineHeight: 1, userSelect: "none",
};

function InfoTip({ text }) {
  if (!text) return null;
  return <span style={infoStyle} title={text}>?</span>;
}

// ─── Tooltip descriptions ────────────────────────────────────
const HINTS = {
  totalInsured: "Total number of orders where the customer added order protection at checkout.",
  totalOrders: "Total number of orders placed in your store during this period.",
  attachRate: "Percentage of orders that included order protection. (Insured Orders / Total Orders × 100)",
  insuredRevenue: "Total dollar value of all orders that had protection added.",
  byStatus: "Breakdown of insured orders by their payment status (Paid, Pending, Refunded).",
  byProduct: "Which products appear most often in orders that include protection.",
  topProducts: "Ranked list of products most frequently purchased alongside order protection.",
  dailyChart: "Daily count of insured orders over the selected time period.",
  cbPurchases: "Number of orders where customers opted into Checkout+ and earned a cashback code.",
  cbRevenue: "Total order value of orders where customers received cashback codes.",
  cbIssued: "Total dollar amount of cashback codes issued to customers.",
  cbAvg: "Average cashback amount per order.",
  cbSent: "Number of cashback emails successfully delivered with discount codes.",
  cbPending: "Number of cashback emails scheduled but not yet sent (sent 30 days after order).",
  cbFailed: "Number of cashback emails that failed to send due to errors.",
  cbRedeemed: "Number of cashback codes that customers have used at checkout.",
  cbUnredeemed: "Number of sent cashback codes that haven't been used yet.",
  cbRedeemedAmt: "Total dollar value of cashback codes that have been redeemed by customers.",
  weeklyCbPurchases: "Number of cashback-eligible orders per week.",
  monthlyCbRevenue: "Total cashback amount issued per month.",
};

// ─── Shared helpers ──────────────────────────────────────────
const RANGES = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

const RADIAN = Math.PI / 180;

function renderDonutLabel({ cx, cy, midAngle, outerRadius, name, value, percent }) {
  const midR = outerRadius + 14;
  const mx = cx + midR * Math.cos(-midAngle * RADIAN);
  const my = cy + midR * Math.sin(-midAngle * RADIAN);
  const endR = outerRadius + 44;
  const ex = cx + endR * Math.cos(-midAngle * RADIAN);
  const ey = cy + endR * Math.sin(-midAngle * RADIAN);
  const textX = ex + (ex > cx ? 6 : -6);
  const anchor = ex > cx ? "start" : "end";
  return (
    <g>
      <path d={`M${mx},${my}L${ex},${ey}`} stroke="#cbd5e1" strokeWidth={1} fill="none" />
      <text x={textX} y={ey - 1} textAnchor={anchor} dominantBaseline="central" style={{ fontSize: "12px", fill: "#374151", fontWeight: 500 }}>{name}</text>
      <text x={textX} y={ey + 14} textAnchor={anchor} dominantBaseline="central" style={{ fontSize: "11px", fill: "#a1a1aa" }}>
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
}

function DonutCenter({ viewBox, total, label }) {
  return (
    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={viewBox.cx} dy="-6" style={{ fontSize: "26px", fontWeight: "700", fill: "#1e293b" }}>{total.toLocaleString()}</tspan>
      <tspan x={viewBox.cx} dy="22" style={{ fontSize: "12px", fill: "#9ca3af" }}>{label}</tspan>
    </text>
  );
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <div style={{ color: "#6b7280", marginBottom: "6px" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ fontWeight: "600", color: p.color, marginBottom: "2px" }}>
          {p.dataKey === "attachRate" ? `${p.value}%` : p.dataKey === "revenue" ? `$${p.value.toFixed(2)}` : p.value} {p.dataKey === "attachRate" ? "attach rate" : p.dataKey}
        </div>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────
export default function DashboardHome() {
  const { tab: initialTab, activeRange, protect, dailyData, cashback, shopifyError, filterLabel } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = searchParams.get("tab") || initialTab || "protect";
  const currentRangeLabel = filterLabel || RANGES.find((r) => r.value === activeRange)?.label || `Last ${activeRange} days`;

  const switchTab = useCallback((t) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", t);
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleFilterApply = useCallback(({ from, to, excludeDays, excludeMonths, label }) => {
    const params = new URLSearchParams(searchParams);
    params.set("dateFrom", from.toISOString());
    params.set("dateTo", to.toISOString());
    params.set("filterLabel", label);
    params.delete("range");
    if (excludeDays?.length > 0) params.set("excludeDays", excludeDays.join(","));
    else params.delete("excludeDays");
    if (excludeMonths?.length > 0) params.set("excludeMonths", excludeMonths.join(","));
    else params.delete("excludeMonths");
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleRefresh = useCallback(() => navigate(".", { replace: true }), [navigate]);

  return (
    <div>
      <h1 style={s.pageTitle}>Dashboard</h1>

      {/* ── Tab Bar ── */}
      <div style={s.tabBar}>
        {["protect", "cashback"].map((t) => (
          <button key={t} onClick={() => switchTab(t)} style={{ ...s.tab, ...(activeTab === t ? s.tabActive : {}) }}>
            {t === "protect" ? "Protect" : "CashBack"}
          </button>
        ))}
      </div>

      {/* ── Date Range Filter ── */}
      <div style={s.filterBar}>
        <DateRangeFilter onApply={handleFilterApply} activeLabel={currentRangeLabel} />
        <button style={s.filterIcon} onClick={handleRefresh} title="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {shopifyError && (
        <div style={{ background: "#fffbeb", color: "#92400e", padding: "10px 16px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px", border: "1px solid #fde68a" }}>
          Could not fetch store data: {shopifyError}
        </div>
      )}

      {/* ─────────────── PROTECT TAB ─────────────── */}
      {activeTab === "protect" && <ProtectTab protect={protect} dailyData={dailyData} activeRange={activeRange} currentRangeLabel={currentRangeLabel} />}

      {/* ─────────────── CASHBACK TAB ─────────────── */}
      {activeTab === "cashback" && <CashbackTab cashback={cashback} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROTECT TAB
// ─────────────────────────────────────────────────────────────
function ProtectTab({ protect, dailyData, activeRange, currentRangeLabel }) {
  const { totalOrders, insuredOrders, attachRate, insuredRevenue, statusBreakdown, topProducts } = protect;

  // Product breakdown for donut (top 6 + "Other")
  const productDonut = (() => {
    if (topProducts.length === 0) return [];
    const top = topProducts.slice(0, 6);
    const otherCount = topProducts.slice(6).reduce((sum, p) => sum + p.count, 0);
    const result = top.map((p) => ({ name: p.name, value: p.count }));
    if (otherCount > 0) result.push({ name: "Other", value: otherCount });
    return result;
  })();

  // KPI row for the inline stats above the chart
  const chartKpis = [
    { label: "Insured Orders", value: insuredOrders.toLocaleString() },
    { label: "Attach Rate", value: `${attachRate}%` },
  ];

  return (
    <>
      {/* ── Attach Rate Area Chart (top, matching reference design) ── */}
      <div style={{ ...s.card, marginBottom: "24px", padding: "24px 24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
            {chartKpis.map((k) => (
              <div key={k.label}>
                <div style={{ fontSize: "12px", fontWeight: "500", color: "#9ca3af", marginBottom: "4px" }}>{k.label}</div>
                <div style={{ fontSize: "22px", fontWeight: "700", color: "#1e293b" }}>{k.value}</div>
              </div>
            ))}
            <InfoTip text={HINTS.dailyChart} />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="attachFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6CB4EE" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#6CB4EE" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f3f4f6" horizontal={true} vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "#c0c5ce" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, "auto"]} tick={{ fontSize: 10, fill: "#c0c5ce" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              formatter={(v, name) => [name === "insured" ? v : `${v}%`, name === "insured" ? "Insured Orders" : "Attach Rate"]}
              labelFormatter={formatDate}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            />
            <Area type="monotone" dataKey="insured" stroke="#6CB4EE" strokeWidth={2} fill="url(#attachFill)" dot={false} activeDot={{ r: 4, stroke: "#6CB4EE", fill: "#fff", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Donut Charts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <DonutCard
          title="Insured Orders by Status"
          hint={HINTS.byStatus}
          data={statusBreakdown.length > 0 ? statusBreakdown : [{ name: "No data", value: 1 }]}
          colors={DONUT_PALETTE}
          total={insuredOrders}
          totalLabel="Total"
          empty={statusBreakdown.length === 0}
        />
        <DonutCard
          title="Insured Orders by Product"
          hint={HINTS.byProduct}
          data={productDonut.length > 0 ? productDonut : [{ name: "No data", value: 1 }]}
          colors={DONUT_PALETTE}
          total={insuredOrders}
          totalLabel="Total"
          empty={productDonut.length === 0}
        />
      </div>

      {/* ── Summary KPI Cards ── */}
      <div style={s.sectionHeading}>Summary</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <SummaryCard label="Total Insured Orders" value={insuredOrders.toLocaleString()} hint={HINTS.totalInsured} />
        <SummaryCard label="Total Orders" value={totalOrders.toLocaleString()} hint={HINTS.totalOrders} />
        <SummaryCard label="Attach Rate" value={`${attachRate}%`} hint={HINTS.attachRate} />
        <SummaryCard label="Insured Revenue" value={`$${parseFloat(insuredRevenue).toLocaleString()}`} hint={HINTS.insuredRevenue} />
      </div>

      {/* ── Top Insured Products Table ── */}
      <div style={{ ...s.card, padding: 0, marginBottom: "24px" }}>
        <div style={{ padding: "16px 20px", fontWeight: "600", fontSize: "14px", color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>Top Insured Products <InfoTip text={HINTS.topProducts} /></div>
        {topProducts.length === 0 ? (
          <div style={s.emptyState}>No insured orders yet.</div>
        ) : (
          <table style={{ ...s.table, border: "none" }}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Product</th>
                <th style={{ ...s.th, textAlign: "right" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={p.name}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={{ ...s.td, fontWeight: "500" }}>{p.name}</td>
                  <td style={{ ...s.td, textAlign: "right", fontWeight: "600" }}>{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ─── Summary KPI Card ────────────────────────────────────────
function SummaryCard({ label, value, comingSoon, small, hint }) {
  return (
    <div style={{ ...s.summaryCard, position: "relative" }}>
      <div style={s.summaryLabel}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>{label} <InfoTip text={hint} /></span>
      </div>
      <div style={{ ...s.summaryValue, fontSize: small ? "30px" : "40px", color: comingSoon ? "#cbd5e1" : "#1e293b" }}>
        {value}
      </div>
      {comingSoon && <span style={s.comingSoon}>Coming Soon</span>}
    </div>
  );
}

// ─── Donut Card ──────────────────────────────────────────────
function DonutCard({ title, data, colors, total, totalLabel, comingSoon, empty, hint }) {
  return (
    <div style={{ ...s.card, position: "relative", padding: "16px 20px" }}>
      <div style={{ fontSize: "14px", fontWeight: "600", color: "#111827", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>{title} <InfoTip text={hint} /></div>
      {comingSoon && <span style={s.comingSoon}>Coming Soon</span>}
      {empty ? (
        <div style={{ ...s.emptyState, padding: "60px 20px" }}>No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data} cx="50%" cy="50%"
              innerRadius={60} outerRadius={90}
              paddingAngle={2} dataKey="value"
              stroke="#fff" strokeWidth={2}
              label={data.length <= 7 ? renderDonutLabel : false}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} opacity={comingSoon ? 0.5 : 1} />
              ))}
            </Pie>
            {/* Center label */}
            <Tooltip formatter={(value, name) => [value, name]} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }} />
            {total > 0 && (
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
                <tspan x="50%" dy="-8" style={{ fontSize: "22px", fontWeight: "700", fill: comingSoon ? "#cbd5e1" : "#1e293b" }}>{total.toLocaleString()}</tspan>
                <tspan x="50%" dy="20" style={{ fontSize: "11px", fill: "#9ca3af" }}>{totalLabel}</tspan>
              </text>
            )}
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CASHBACK TAB
// ─────────────────────────────────────────────────────────────
const CB_GOLD = "#eab308";
const CB_GREEN = "#10b981";
const CB_BLUE = "#3b82f6";

function CashbackTab({ cashback }) {
  const {
    total, pending, sent, failed, totalIssued, cbOrderRevenue,
    weeklyData, monthlyData, cbDailyData, recentCbOrders,
    redeemed, unredeemed, redeemedAmount,
  } = cashback;

  const avgCashback = total > 0 ? (totalIssued / total).toFixed(2) : "0";
  const redemptionRate = sent > 0 ? ((redeemed / sent) * 100).toFixed(1) : "0";

  const fmtWeek = (w) => new Date(w + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtMonth = (m) => {
    const [y, mo] = m.split("-");
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const statusLabel = (row) => {
    if (row.errorMessage) return { text: "Failed", bg: "#fef2f2", color: "#b91c1c" };
    if (row.redeemed) return { text: "Redeemed", bg: "#fefce8", color: "#854d0e" };
    if (row.emailSent) return { text: "Sent", bg: "#ecfdf5", color: "#065f46" };
    return { text: "Scheduled", bg: "#eff6ff", color: "#1e40af" };
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <>
      {/* ── Summary KPIs — Row 1 ── */}
      <div style={s.sectionHeading}>Summary</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
        <SummaryCard label="CashBack Orders" value={total.toLocaleString()} hint={HINTS.cbPurchases} />
        <SummaryCard label="Order Revenue" value={`$${cbOrderRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} hint={HINTS.cbRevenue} />
        <SummaryCard label="CashBack Issued" value={`$${totalIssued.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} hint={HINTS.cbIssued} />
      </div>

      {/* ── Summary KPIs — Row 2 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
        <SummaryCard label="Redeemed" value={redeemed.toLocaleString()} hint={HINTS.cbRedeemed} small />
        <SummaryCard label="Unredeemed" value={unredeemed.toLocaleString()} hint={HINTS.cbUnredeemed} small />
        <SummaryCard label="Redeemed Value" value={`$${redeemedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} hint={HINTS.cbRedeemedAmt} small />
      </div>

      {/* ── Summary KPIs — Row 3 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <SummaryCard label="Avg CashBack" value={`$${avgCashback}`} hint={HINTS.cbAvg} small />
        <SummaryCard label="CashBack Sent" value={sent.toLocaleString()} hint={HINTS.cbSent} small />
        <SummaryCard label="CashBack Pending" value={pending.toLocaleString()} hint={HINTS.cbPending} small />
        <SummaryCard label="Failed" value={failed.toLocaleString()} hint={HINTS.cbFailed} small />
      </div>

      {/* ── Daily CashBack Issued Chart ── */}
      <div style={{ ...s.card, marginBottom: "24px", padding: "24px 24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "32px" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: "500", color: "#9ca3af", marginBottom: "4px" }}>Total Issued</div>
              <div style={{ fontSize: "22px", fontWeight: "700", color: "#1e293b" }}>${totalIssued.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: "500", color: "#9ca3af", marginBottom: "4px" }}>Orders</div>
              <div style={{ fontSize: "22px", fontWeight: "700", color: "#1e293b" }}>{total}</div>
            </div>
          </div>
        </div>
        {cbDailyData.every((d) => d.count === 0) ? (
          <div style={s.emptyState}>No cashback data for this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cbDailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cbFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CB_GOLD} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={CB_GOLD} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f3f4f6" horizontal vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "#c0c5ce" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10, fill: "#c0c5ce" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v, name) => [name === "amount" ? `$${v.toFixed(2)}` : v, name === "amount" ? "CashBack Issued" : "Orders"]}
                labelFormatter={formatDate}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              />
              <Area type="monotone" dataKey="amount" stroke={CB_GOLD} strokeWidth={2} fill="url(#cbFill)" dot={false} activeDot={{ r: 4, stroke: CB_GOLD, fill: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Weekly & Monthly Charts side by side ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <div style={s.card}>
          <div style={{ ...s.cardTitle, display: "flex", alignItems: "center", gap: "8px" }}>Weekly Purchases <InfoTip text={HINTS.weeklyCbPurchases} /></div>
          {weeklyData.length === 0 ? (
            <div style={s.emptyState}>No data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="week" tickFormatter={fmtWeek} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={(w) => new Date(w + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} formatter={(v) => [v, "Purchases"]} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }} />
                <Bar dataKey="count" fill={CB_BLUE} radius={[3, 3, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={s.card}>
          <div style={{ ...s.cardTitle, display: "flex", alignItems: "center", gap: "8px" }}>Monthly Issued <InfoTip text={HINTS.monthlyCbRevenue} /></div>
          {monthlyData.length === 0 ? (
            <div style={s.emptyState}>No data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={(m) => { const [y, mo] = m.split("-"); return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }); }} formatter={(v) => [`$${v.toFixed(2)}`, "Issued"]} contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }} />
                <Bar dataKey="amount" fill={CB_GREEN} radius={[3, 3, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Recent CashBack Orders Table ── */}
      <div style={{ ...s.card, padding: 0, marginBottom: "24px" }}>
        <div style={{ padding: "16px 20px", fontWeight: "600", fontSize: "14px", color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
          Recent CashBack Orders <InfoTip text="Individual cashback records showing customer, amount, status, and scheduled email date." />
        </div>
        {recentCbOrders.length === 0 ? (
          <div style={s.emptyState}>No cashback orders yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ ...s.table, border: "none" }}>
              <thead>
                <tr>
                  <th style={s.th}>Order</th>
                  <th style={s.th}>Customer</th>
                  <th style={{ ...s.th, textAlign: "right" }}>CashBack</th>
                  <th style={s.th}>Code</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Used</th>
                  <th style={s.th}>Email Date</th>
                  <th style={s.th}>Order Date</th>
                </tr>
              </thead>
              <tbody>
                {recentCbOrders.map((row, i) => {
                  const st = statusLabel(row);
                  return (
                    <tr key={i}>
                      <td style={{ ...s.td, fontWeight: "600" }}>{row.orderName}</td>
                      <td style={s.td}>
                        <div style={{ fontWeight: "500" }}>{row.customerName}</div>
                        <div style={{ fontSize: "12px", color: "#9ca3af" }}>{row.customerEmail}</div>
                      </td>
                      <td style={{ ...s.td, textAlign: "right", fontWeight: "600" }}>${parseFloat(row.cashbackAmount).toFixed(2)}</td>
                      <td style={s.td}>
                        {row.discountCode ? (
                          <code style={{ fontSize: "12px", background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px" }}>{row.discountCode}</code>
                        ) : (
                          <span style={{ color: "#d1d5db", fontSize: "13px" }}>—</span>
                        )}
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.text}</span>
                      </td>
                      <td style={s.td}>
                        {row.emailSent ? (
                          row.redeemed
                            ? <span style={{ ...s.badge, background: "#fefce8", color: "#854d0e" }}>Yes</span>
                            : <span style={{ ...s.badge, background: "#f3f4f6", color: "#6b7280" }}>No</span>
                        ) : (
                          <span style={{ color: "#d1d5db", fontSize: "13px" }}>—</span>
                        )}
                      </td>
                      <td style={{ ...s.td, fontSize: "13px" }}>
                        {row.emailSent ? fmtDate(row.emailSentAt) : fmtDate(row.emailScheduledFor)}
                      </td>
                      <td style={{ ...s.td, fontSize: "13px" }}>{fmtDate(row.orderCreatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
