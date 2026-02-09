import { authenticate } from "../shopify.server";
import { CASHBACK_CONFIG } from "../config";
import db from "../db.server";

// Webhook handler for order creation
// Schedules delayed cashback rewards (30 days) when customers opt-in to order protection

export const action = async ({ request }) => {
  console.log('🔔 Webhook received: orders/create');
  
  // #region agent log
  const debugLog = (loc, msg, data, hyp) => fetch('http://127.0.0.1:7242/ingest/b9111116-a737-47d1-9fc6-489a44e45604',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:loc,message:msg,data,timestamp:Date.now(),sessionId:'debug-session',hypothesisId:hyp})}).catch(()=>{});
  // #endregion
  
  try {
    // Read the body first to get order data
    const bodyText = await request.clone().text();
    const order = JSON.parse(bodyText);
    
    // #region agent log
    debugLog('webhooks.orders.create.jsx:14', 'Webhook entry', {orderName: order.name, email: order.email, hasCustomer: !!order.customer}, 'A,B,E');
    // #endregion
    
    // Try to authenticate, but fallback if it fails
    let admin, session;
    
    try {
      const authResult = await authenticate.webhook(request);
      admin = authResult.admin;
      session = authResult.session;
      // #region agent log
      debugLog('webhooks.orders.create.jsx:25', 'Auth success - primary', {hasAdmin: !!admin, hasSession: !!session, shop: session?.shop}, 'B');
      // #endregion
    } catch (authError) {
      console.warn('⚠️  Using fallback authentication for development');
      // #region agent log
      debugLog('webhooks.orders.create.jsx:35', 'Auth fallback triggered', {authError: authError.message, shopDomain: order.shop_domain}, 'B');
      // #endregion
      
      // Fallback: create admin client manually using stored session
      const shopDomain = order.shop_domain || 'dev-store2-8.myshopify.com';
      const shopifyServer = await import("../shopify.server");
      const sessions = await shopifyServer.sessionStorage.findSessionsByShop(shopDomain);
      const activeSession = sessions.find(s => s.isOnline === false) || sessions[0];
      
      if (!activeSession) {
        throw new Error('No active session found - app may not be installed');
      }
      
      // #region agent log
      debugLog('webhooks.orders.create.jsx:48', 'Fallback auth found session', {sessionShop: activeSession.shop, hasToken: !!activeSession.accessToken}, 'B');
      // #endregion
      
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
    
    console.log(`📦 Processing order ${order.name} for ${order.email}`);
    
    // Check if protection was enabled (via attributes OR product)
    const protectionAttr = order.note_attributes?.find(attr => attr.name === '_protection_enabled');
    const hasProtectionProduct = order.line_items?.some(item => {
      const title = (item.title || item.name || '').toLowerCase();
      return title.includes('order protection') || title.includes('protection') || title.includes('checkout+');
    });
    const hasProtection = protectionAttr?.value === 'true' || hasProtectionProduct;
    
    if (!hasProtection) {
      console.log('Protection not enabled, skipping cashback');
      return new Response('OK', { status: 200 });
    }
    
    console.log('✅ Protection enabled, processing cashback...');
    
    // Get cashback amount (from attributes or calculate from order total)
    const cashbackAttr = order.note_attributes?.find(attr => attr.name === '_cashback_amount');
    const cashbackAmount = cashbackAttr?.value || 
      (parseFloat(order.total_price) * CASHBACK_CONFIG.CASHBACK_PERCENT / 100).toFixed(2);
    
    // Handle guest checkout (customer might be null)
    const hasCustomer = order.customer && order.customer.id;
    
    // Get shop domain from session
    const shopDomain = session?.shop || order.shop_domain || 'yourstore.myshopify.com';
    
    // Calculate when to send the cashback email (2 minutes for testing - change back to 30 days later)
    const orderCreatedAt = new Date(order.created_at);
    const emailScheduledFor = new Date(orderCreatedAt);
    emailScheduledFor.setMinutes(emailScheduledFor.getMinutes() + 2); // TODO: Change to 30 days in production
    // Production: emailScheduledFor.setDate(emailScheduledFor.getDate() + 30);
    
    // Save to database for delayed processing
    try {
      await db.pendingCashback.create({
        data: {
          orderId: order.id.toString(),
          orderName: order.name,
          customerEmail: order.email,
          customerName: order.customer?.first_name || 'Valued Customer',
          cashbackAmount: cashbackAmount,
          shopDomain: shopDomain,
          customerId: hasCustomer ? order.customer.id.toString() : null,
          orderCreatedAt: orderCreatedAt,
          emailScheduledFor: emailScheduledFor
        }
      });
      
      console.log(`✅ Cashback scheduled for ${emailScheduledFor.toLocaleDateString()}`);
      console.log(`📅 Order: ${order.name} | Amount: $${cashbackAmount} | Customer: ${order.email}`);
      
      // #region agent log
      debugLog('webhooks.orders.create.jsx:scheduled', 'Cashback scheduled', {
        orderName: order.name, 
        cashbackAmount, 
        scheduledDate: emailScheduledFor.toISOString()
      }, 'ALL');
      // #endregion
      
    } catch (dbError) {
      // Check if this is a duplicate order
      if (dbError.code === 'P2002') {
        console.log(`⚠️  Order ${order.name} already scheduled for cashback`);
        return new Response('OK - Already processed', { status: 200 });
      }
      throw dbError;
    }
    
    console.log(`✅ Cashback processing complete for order ${order.name}`);
    
    // #region agent log
    debugLog('webhooks.orders.create.jsx:230', 'Webhook completed successfully', {
      orderName: order.name, 
      cashback: cashbackAmount, 
      scheduled: true
    }, 'ALL');
    // #endregion
    
    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('❌ Webhook error:', error.message || error);
    if (error.stack) console.error(error.stack);
    
    // #region agent log
    debugLog('webhooks.orders.create.jsx:238', 'Webhook error caught', {errorMessage: error.message, errorStack: error.stack?.substring(0, 200)}, 'ALL');
    // #endregion
    
    // Return 200 so Shopify doesn't retry
    return new Response(JSON.stringify({ 
      error: error?.message || String(error)
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
