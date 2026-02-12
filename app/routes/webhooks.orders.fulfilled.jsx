import { authenticate } from "../shopify.server";
import { CASHBACK_CONFIG } from "../config";

// Auto-fulfill Order Protection line items when fulfillments are created
// Triggered by fulfillments/create webhook

export const action = async ({ request }) => {
  console.log('🔔 Webhook received: fulfillments/create');
  console.log('🚫 AUTO-FULFILLMENT DISABLED FOR TESTING');
  return new Response('OK - Disabled for testing', { status: 200 });
  
  console.log('📋 Headers:', JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));
  
  try {
    const bodyText = await request.clone().text();
    console.log('📦 Raw body preview:', bodyText.substring(0, 300));
    const fulfillment = JSON.parse(bodyText);
    
    console.log(`✅ Fulfillment parsed for order ID: ${fulfillment.order_id}`);
    console.log(`📦 Fulfillment line items count: ${fulfillment.line_items?.length || 0}`);
    
    // Authenticate webhook
    let admin, session;
    try {
      const authResult = await authenticate.webhook(request);
      admin = authResult.admin;
      session = authResult.session;
      console.log('✅ Authentication successful');
    } catch (authError) {
      console.warn('⚠️  Using fallback authentication');
      // Get shop domain from fulfillment or admin_graphql_api_id
      const shopDomain = fulfillment.admin_graphql_api_id?.match(/https:\/\/([^\/]+)/)?.[1];
      
      if (!shopDomain) {
        console.error('❌ Cannot determine shop domain');
        return new Response('OK', { status: 200 });
      }
      
      const shopifyServer = await import("../shopify.server");
      const sessions = await shopifyServer.sessionStorage.findSessionsByShop(shopDomain);
      const activeSession = sessions.find(s => !s.isOnline) || sessions[0];
      
      if (!activeSession) {
        throw new Error('No active session found');
      }
      
      session = activeSession;
      admin = {
        graphql: async (query, options) => {
          const response = await fetch(`https://${shopDomain}/admin/api/2025-10/graphql.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': activeSession.accessToken,
            },
            body: JSON.stringify({ query, variables: options?.variables }),
          });
          return response;
        }
      };
    }
    
    console.log(`📦 Processing fulfillment for order ID: ${fulfillment.order_id}`);
    
    // Get the full order details to check for protection items
    const orderResponse = await admin.graphql(
      `#graphql
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          lineItems(first: 100) {
            nodes {
              id
              title
              product {
                handle
              }
              fulfillmentStatus
            }
          }
          fulfillmentOrders(first: 10) {
            nodes {
              id
              status
              lineItems(first: 50) {
                nodes {
                  id
                  lineItem {
                    id
                    title
                    product {
                      handle
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      {
        variables: {
          id: `gid://shopify/Order/${fulfillment.order_id}`
        }
      }
    );
    
    const orderData = await orderResponse.json();
    console.log('📦 GraphQL response preview:', JSON.stringify(orderData).substring(0, 500));
    
    if (!orderData.data?.order) {
      console.error('❌ Order not found');
      return new Response('OK - Order not found', { status: 200 });
    }
    
    const order = orderData.data.order;
    console.log(`📦 Order ${order.name} has ${order.lineItems.nodes.length} line items`);
    
    // Find protection items in the order
    const protectionItems = order.lineItems.nodes.filter(item => {
      const handle = item.product?.handle || '';
      const title = item.title?.toLowerCase() || '';
      const isProtection = handle.includes(CASHBACK_CONFIG.PROTECTION_PRODUCT_HANDLE) ||
                          title.includes('order-protection') ||
                          title.includes('checkout+');
      
      if (isProtection) {
        console.log(`🎯 Found protection item: "${item.title}" (status: ${item.fulfillmentStatus})`);
      }
      return isProtection;
    });
    
    if (protectionItems.length === 0) {
      console.log('ℹ️  No protection items in this order, skipping');
      return new Response('OK - No protection items', { status: 200 });
    }
    
    // Check if protection items are already fulfilled
    const unfulfilledProtection = protectionItems.filter(item => {
      return item.fulfillmentStatus !== 'FULFILLED';
    });
    
    if (unfulfilledProtection.length === 0) {
      console.log('✅ All protection items already fulfilled');
      return new Response('OK - Already fulfilled', { status: 200 });
    }
    
    console.log(`🎯 Need to fulfill ${unfulfilledProtection.length} protection item(s)`);
    
    // Find ALL fulfillment orders (including closed/scheduled ones)
    const fulfillmentOrders = order.fulfillmentOrders.nodes;
    console.log(`📦 Found ${fulfillmentOrders.length} total fulfillment order(s)`);
    
    if (fulfillmentOrders.length === 0) {
      console.log('ℹ️  No fulfillment orders found - cannot create fulfillment');
      return new Response('OK - No fulfillment orders', { status: 200 });
    }
    
    // Try to find protection items in ANY fulfillment order
    for (const fulfillmentOrder of fulfillmentOrders) {
      console.log(`📦 Checking fulfillment order ${fulfillmentOrder.id} (status: ${fulfillmentOrder.status})`);
      
      const protectionLineItems = fulfillmentOrder.lineItems.nodes.filter(item => {
        const handle = item.lineItem.product?.handle || '';
        const title = item.lineItem.title?.toLowerCase() || '';
        return handle.includes(CASHBACK_CONFIG.PROTECTION_PRODUCT_HANDLE) ||
               title.includes('order-protection') ||
               title.includes('checkout+');
      });
      
      if (protectionLineItems.length === 0) {
        console.log('ℹ️  No protection items in this fulfillment order');
        continue;
      }
      
      console.log(`📦 Found ${protectionLineItems.length} protection item(s) in fulfillment order`);
      console.log(`📦 Fulfillment order status: ${fulfillmentOrder.status}`);
      
      // Only fulfill if the fulfillment order is in a valid state
      if (fulfillmentOrder.status === 'OPEN' || fulfillmentOrder.status === 'IN_PROGRESS' || fulfillmentOrder.status === 'SCHEDULED') {
        console.log(`📦 Creating fulfillment for protection items`);
        
        // Create fulfillment for protection items
        const fulfillmentResponse = await admin.graphql(
          `#graphql
          mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
            fulfillmentCreateV2(fulfillment: $fulfillment) {
              fulfillment {
                id
                status
                createdAt
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              fulfillment: {
                lineItemsByFulfillmentOrder: [{
                  fulfillmentOrderId: fulfillmentOrder.id,
                  fulfillmentOrderLineItems: protectionLineItems.map(item => ({
                    id: item.id,
                    quantity: 1
                  }))
                }],
                notifyCustomer: false,
                trackingInfo: {
                  company: "Digital Service",
                  number: "N/A"
                }
              }
            }
          }
        );
        
        const fulfillmentData = await fulfillmentResponse.json();
        console.log('📦 Fulfillment response:', JSON.stringify(fulfillmentData, null, 2).substring(0, 500));
        
        const userErrors = fulfillmentData.data?.fulfillmentCreateV2?.userErrors || [];
        
        if (userErrors.length > 0) {
          console.error('❌ Fulfillment errors:', JSON.stringify(userErrors, null, 2));
          continue;
        }
        
        const createdFulfillment = fulfillmentData.data?.fulfillmentCreateV2?.fulfillment;
        console.log(`✅ Protection items fulfilled successfully! ID: ${createdFulfillment?.id}`);
        
        console.log(`✅ Auto-fulfillment complete for order ${order.name}`);
        return new Response('OK', { status: 200 });
      } else {
        console.log(`⚠️  Fulfillment order status "${fulfillmentOrder.status}" - cannot fulfill`);
      }
    }
    
    console.log('ℹ️  No eligible fulfillment orders found for protection items');
    return new Response('OK - No eligible fulfillment orders', { status: 200 });
    
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    if (error.stack) console.error(error.stack);
    
    // Return 200 to prevent Shopify retries
    return new Response(JSON.stringify({ 
      error: error?.message || String(error)
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
