import { authenticate } from "../shopify.server";
import { CASHBACK_CONFIG } from "../config";

// Webhook handler for order creation
// Processes cashback rewards when customers opt-in to order protection

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
      const shopDomain = order.shop_domain || 'checkout-plus-dev-store-2.myshopify.com';
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
    
    // Generate discount code
    const discountCode = `${CASHBACK_CONFIG.DISCOUNT_CODE_PREFIX}${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    
    // Handle guest checkout (customer might be null)
    const hasCustomer = order.customer && order.customer.id;
    
    // Create discount using modern Discount API
    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + CASHBACK_CONFIG.CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    
    // Build context (replaces deprecated customerSelection)
    let context = {};
    if (hasCustomer) {
      context = {
        customers: {
          add: [`gid://shopify/Customer/${order.customer.id}`]
        }
      };
      // #region agent log
      debugLog('webhooks.orders.create.jsx:89', 'Context: customer-specific', {customerId: order.customer.id, contextType: 'customers'}, 'A,E');
      // #endregion
    } else {
      // For guest checkout, make it available to all customers
      context = {
        all: "ALL"
      };
      // #region agent log
      debugLog('webhooks.orders.create.jsx:98', 'Context: all customers', {contextType: 'all'}, 'A');
      // #endregion
    }
    
    // #region agent log
    debugLog('webhooks.orders.create.jsx:103', 'Before discount mutation', {code: discountCode, amount: cashbackAmount, startsAt, endsAt, context: JSON.stringify(context)}, 'A,D');
    // #endregion
    
    const discountResponse = await admin.graphql(
      `#graphql
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                status
                codes(first: 1) {
                  nodes {
                    code
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      {
        variables: {
          basicCodeDiscount: {
            title: `Cashback ${cashbackAmount} - Order ${order.name}`,
            code: discountCode,
            startsAt,
            endsAt,
            context,
            customerGets: {
              value: {
                discountAmount: {
                  amount: cashbackAmount,
                  appliesOnEachItem: false
                }
              },
              items: {
                all: true
              }
            },
            usageLimit: 1,
            appliesOncePerCustomer: true
          }
        }
      }
    );
    
    const discountData = await discountResponse.json();
    
    // #region agent log
    debugLog('webhooks.orders.create.jsx:151', 'Discount response received', {hasData: !!discountData.data, hasErrors: !!(discountData.errors), responseKeys: Object.keys(discountData)}, 'A,C');
    // #endregion
    
    // Log full response for debugging
    console.log('📋 Discount creation response:', JSON.stringify(discountData, null, 2));
    
    const userErrors = discountData.data?.discountCodeBasicCreate?.userErrors || [];
    
    // #region agent log
    debugLog('webhooks.orders.create.jsx:160', 'User errors check', {errorCount: userErrors.length, errors: userErrors}, 'A,C');
    // #endregion
    
    if (userErrors.length > 0) {
      console.error('❌ Discount creation errors:', userErrors);
      throw new Error(`Failed to create discount code: ${JSON.stringify(userErrors)}`);
    }
    
    // Get the actual code from the response (in case Shopify modified it)
    const createdDiscount = discountData.data?.discountCodeBasicCreate?.codeDiscountNode?.codeDiscount;
    const actualCode = createdDiscount?.codes?.nodes?.[0]?.code || discountCode;
    const discountStatus = createdDiscount?.status;
    const discountId = discountData.data?.discountCodeBasicCreate?.codeDiscountNode?.id;
    
    // #region agent log
    debugLog('webhooks.orders.create.jsx:178', 'Discount extracted from response', {hasDiscount: !!createdDiscount, actualCode, discountStatus, discountId, codesArray: createdDiscount?.codes?.nodes}, 'C,D');
    // #endregion
    
    if (!discountId) {
      throw new Error('Discount was created but no ID was returned');
    }
    
    console.log(`✅ Discount code created: ${actualCode}`);
    console.log(`📊 Discount status: ${discountStatus}`);
    console.log(`🆔 Discount ID: ${discountId}`);
    
    // Use the actual code from Shopify response
    const finalDiscountCode = actualCode;
    
    // Tag customer as VIP (only if customer exists, not guest checkout)
    if (hasCustomer) {
      await admin.graphql(
        `#graphql
        mutation customerUpdate($input: CustomerInput!) {
          customerUpdate(input: $input) {
            customer {
              id
              tags
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            input: {
              id: `gid://shopify/Customer/${order.customer.id}`,
              tags: [CASHBACK_CONFIG.VIP_TAG]
            }
          }
        }
      );
    }
    
    // Get shop domain from session
    const shopDomain = session?.shop || order.shop_domain || 'yourstore.myshopify.com';
    
    // Send email with cashback code
    await sendCashbackEmail({
      email: order.email,
      customerName: order.customer?.first_name || 'Valued Customer',
      discountCode: finalDiscountCode,
      cashbackAmount,
      orderNumber: order.name,
      shopDomain
    });
    
    console.log(`✅ Cashback processed: ${finalDiscountCode} for $${cashbackAmount}`);
    
    // #region agent log
    debugLog('webhooks.orders.create.jsx:230', 'Webhook completed successfully', {finalCode: finalDiscountCode, cashback: cashbackAmount, emailSent: true}, 'ALL');
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

async function sendCashbackEmail({ email, customerName, discountCode, cashbackAmount, orderNumber, shopDomain }) {
  const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code-box { background: white; padding: 20px; text-align: center; margin: 20px 0; border: 2px dashed #667eea; border-radius: 8px; }
        .code { font-size: 28px; font-weight: bold; color: #667eea; letter-spacing: 2px; }
        .amount { font-size: 32px; color: #4CAF50; font-weight: bold; }
        .cta { background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Your Cashback is Here!</h1>
        </div>
        <div class="content">
          <p>Hi ${customerName},</p>
          <p>Thank you for your order ${orderNumber}! As promised, here's your cashback reward:</p>
          
          <div class="code-box">
            <p style="margin: 0; font-size: 16px; color: #666;">Your Cashback Amount</p>
            <div class="amount">$${cashbackAmount}</div>
            <p style="margin: 20px 0 10px; font-size: 16px; color: #666;">Discount Code</p>
            <div class="code">${discountCode}</div>
          </div>
          
          <p><strong>How to use:</strong></p>
          <ul>
            <li>Valid on your next purchase</li>
            <li>Works store-wide on all products</li>
            <li>Valid for ${CASHBACK_CONFIG.CODE_EXPIRY_DAYS} days</li>
            <li>One-time use only</li>
          </ul>
          
          <div style="text-align: center;">
            <a href="https://${shopDomain}" class="cta">Shop Now</a>
          </div>
          
          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            Thanks for being a VIP customer! Enjoy your cashback reward.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const RESEND_API_KEY = "re_YZV1ECpr_3NYamiQGCEffvuyKQisGTRCo";
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@plus.meonutrition.com';

  // If Resend API key is configured, use Resend
  console.log(`📧 Attempting to send email to ${email}...`);
  if (RESEND_API_KEY) {
    try {
      console.log(`📧 Using Resend API with from: ${FROM_EMAIL}`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: `🎉 You earned $${cashbackAmount} cashback!`,
          html: emailTemplate,
        }),
      });

      const result = await response.json();
      console.log(`📧 Resend API response status: ${response.status}`, JSON.stringify(result));

      if (!response.ok) {
        throw new Error(`Resend API error: ${JSON.stringify(result)}`);
      }

      console.log(`✅ Email sent to ${email} - Code: ${discountCode}`);
      return;
    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      // Continue - email failure shouldn't block webhook processing
    }
  }

  // Fallback: log email details if Resend isn't configured
  console.log(`📧 Email not sent (configure RESEND_API_KEY) - Code: ${discountCode} to ${email}`);
}






