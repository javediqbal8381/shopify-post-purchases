import { authenticate } from "../shopify.server";
import { CASHBACK_CONFIG } from "../config";
import db from "../db.server";

// Webhook: orders/create
// 1. Auto-fulfills Checkout+ product (delayed to allow Shopify to create fulfillment orders)
// 2. Schedules delayed cashback rewards (30 days) for order protection customers

export const action = async ({ request }) => {
  try {
    const bodyText = await request.clone().text();
    const order = JSON.parse(bodyText);
    const shopDomainFromHeader = request.headers.get('x-shopify-shop-domain');

    // Authenticate webhook (with fallback for dev)
    let admin, session, shopDomain;

    try {
      const authResult = await authenticate.webhook(request);
      admin = authResult.admin;
      session = authResult.session;
    } catch (authError) {
      // Fallback: use stored session for the shop from webhook header
      shopDomain = shopDomainFromHeader || 'dev-store2-8.myshopify.com';
      const shopifyServer = await import("../shopify.server");
      const sessions = await shopifyServer.sessionStorage.findSessionsByShop(shopDomain);
      const activeSession = sessions.find(s => !s.isOnline) || sessions[0];

      if (!activeSession) throw new Error('No active session found');

      session = activeSession;
      admin = {
        graphql: async (query, options) => {
          return fetch(`https://${shopDomain}/admin/api/2025-10/graphql.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': activeSession.accessToken,
            },
            body: JSON.stringify({ query, variables: options?.variables }),
          });
        }
      };
    }

    if (!shopDomain) {
      shopDomain = shopDomainFromHeader || session?.shop || 'yourstore.myshopify.com';
    }

    console.log(`📦 Order ${order.name} | ${order.email} | Shop: ${shopDomain}`);

    // Check if order has protection enabled
    const protectionAttr = order.note_attributes?.find(attr => attr.name === '_protection_enabled');
    const hasProtectionProduct = order.line_items?.some(item => {
      const title = (item.title || item.name || '').toLowerCase();
      return title.includes('order protection') || title.includes('protection') || title.includes('checkout+');
    });
    const hasProtection = protectionAttr?.value === 'true' || hasProtectionProduct;

    if (!hasProtection) {
      return new Response('OK', { status: 200 });
    }

    // Auto-fulfill Checkout+ after delay (Shopify needs time to create fulfillment orders)
    if (hasProtectionProduct) {
      setTimeout(async () => {
        try {
          const orderQuery = await admin.graphql(
            `#graphql
            query getOrder($id: ID!) {
              order(id: $id) {
                id
                name
                fulfillmentOrders(first: 10) {
                  nodes {
                    id
                    status
                    lineItems(first: 50) {
                      nodes {
                        id
                        remainingQuantity
                        lineItem {
                          id
                          title
                          product { handle }
                        }
                      }
                    }
                  }
                }
              }
            }`,
            { variables: { id: `gid://shopify/Order/${order.id}` } }
          );

          const orderData = await orderQuery.json();
          const fulfillmentOrders = orderData.data?.order?.fulfillmentOrders?.nodes || [];

          for (const fo of fulfillmentOrders) {
            const protectionItems = fo.lineItems.nodes.filter(item => {
              const handle = item.lineItem.product?.handle || '';
              const title = item.lineItem.title?.toLowerCase() || '';
              return (handle.includes('order-protection') || title.includes('checkout+') || title.includes('order protection')) &&
                     item.remainingQuantity > 0;
            });

            if (protectionItems.length > 0 && (fo.status === 'OPEN' || fo.status === 'IN_PROGRESS')) {
              const res = await admin.graphql(
                `#graphql
                mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
                  fulfillmentCreateV2(fulfillment: $fulfillment) {
                    fulfillment { id status }
                    userErrors { field message }
                  }
                }`,
                {
                  variables: {
                    fulfillment: {
                      lineItemsByFulfillmentOrder: [{
                        fulfillmentOrderId: fo.id,
                        fulfillmentOrderLineItems: protectionItems.map(item => ({
                          id: item.id,
                          quantity: item.remainingQuantity
                        }))
                      }],
                      notifyCustomer: false
                    }
                  }
                }
              );

              const data = await res.json();
              const errors = data.data?.fulfillmentCreateV2?.userErrors || [];
              const fulfillment = data.data?.fulfillmentCreateV2?.fulfillment;

              if (errors.length > 0) {
                console.error(`❌ Auto-fulfill failed for ${order.name}:`, JSON.stringify(errors));
              } else {
                console.log(`✅ Checkout+ auto-fulfilled for ${order.name} (fulfillment: ${fulfillment?.id}, status: ${fulfillment?.status})`);
              }
              break;
            }
          }

        } catch (err) {
          console.error(`❌ Auto-fulfillment error for ${order.name}:`, err.message);
        }
      }, 10000);
    }

    // Schedule cashback (30 days from now)
    const cashbackAmount = order.note_attributes?.find(a => a.name === '_cashback_amount')?.value ||
      (parseFloat(order.total_price) * CASHBACK_CONFIG.CASHBACK_PERCENT / 100).toFixed(2);

    const orderCreatedAt = new Date(order.created_at);
    const emailScheduledFor = new Date(orderCreatedAt);
    emailScheduledFor.setMinutes(emailScheduledFor.getMinutes() + CASHBACK_CONFIG.CASHBACK_DELAY_MINUTES);

    try {
      await db.pendingCashback.create({
        data: {
          orderId: order.id.toString(),
          orderName: order.name,
          customerEmail: order.email,
          customerName: order.customer?.first_name || 'Valued Customer',
          cashbackAmount,
          shopDomain,
          customerId: order.customer?.id?.toString() || null,
          orderCreatedAt,
          emailScheduledFor
        }
      });
      console.log(`✅ Cashback $${cashbackAmount} scheduled for ${order.name}`);
    } catch (dbError) {
      if (dbError.code === 'P2002') {
        return new Response('OK', { status: 200 });
      }
      throw dbError;
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('❌ Webhook error:', error.message || error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
