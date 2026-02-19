import db from "../db.server";
import { CASHBACK_CONFIG } from "../config";
import { getEmailTemplate } from "../email-templates/utils";

/**
 * Cron job endpoint to process delayed cashback emails
 * Triggered by node-cron scheduler (see app/cron.server.js)
 * Finds all cashbacks scheduled for today or earlier and sends them
 */
export const action = async ({ request }) => {
  console.log('🕐 Cron job triggered: Processing delayed cashbacks');

  try {
    // Verify this is a legitimate cron request from Vercel
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Optional: Add secret verification for security
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️  Unauthorized cron request');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find all pending cashbacks that are ready to be sent
    const today = new Date();
    const pendingCashbacks = await db.pendingCashback.findMany({
      where: {
        emailSent: false,
        emailScheduledFor: {
          lte: today
        }
      },
      orderBy: {
        emailScheduledFor: 'asc'
      }
    });

    console.log(`📦 Found ${pendingCashbacks.length} cashback(s) to process`);

    if (pendingCashbacks.length === 0) {
      return Response.json({ 
        success: true, 
        processed: 0,
        message: 'No cashbacks to process'
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Process each pending cashback
    for (const cashback of pendingCashbacks) {
      try {
        console.log(`\n🎁 Processing cashback for order ${cashback.orderName}`);
        
        // Get shop session to create discount code
        const sessions = await import("../shopify.server").then(m => 
          m.sessionStorage.findSessionsByShop(cashback.shopDomain)
        );
        const activeSession = sessions.find(s => s.isOnline === false) || sessions[0];

        if (!activeSession) {
          throw new Error(`No active session found for shop: ${cashback.shopDomain}`);
        }

        // Create admin GraphQL client
        const admin = {
          graphql: async (query, options) => {
            const response = await fetch(`https://${cashback.shopDomain}/admin/api/2025-10/graphql.json`, {
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

        // Generate unique discount code
        const discountCode = `${CASHBACK_CONFIG.DISCOUNT_CODE_PREFIX}${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
        
        // Set discount validity period
        const startsAt = new Date().toISOString();
        const endsAt = new Date(Date.now() + CASHBACK_CONFIG.CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

        // Build context based on whether customer exists
        // For registered customers: restrict to that customer only
        // For guest checkout: allow anyone (since we can't restrict)
        let context;
        if (cashback.customerId) {
          // Try customer-specific first, but have fallback
          context = {
            customers: {
              add: [`gid://shopify/Customer/${cashback.customerId}`]
            }
          };
        } else {
          context = { all: "ALL" };
        }

        // Create discount code in Shopify
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
                title: `Cashback ${cashback.cashbackAmount} - Order ${cashback.orderName}`,
                code: discountCode,
                startsAt,
                endsAt,
                context,
                customerGets: {
                  value: {
                    discountAmount: {
                      amount: cashback.cashbackAmount,
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
        
        // Log full response for debugging
        console.log('📋 Discount API response:', JSON.stringify(discountData, null, 2));

        // Check for top-level GraphQL errors (auth issues, malformed query, etc.)
        if (discountData.errors) {
          throw new Error(`GraphQL error: ${JSON.stringify(discountData.errors)}`);
        }

        if (!discountData.data?.discountCodeBasicCreate) {
          throw new Error(`No discount data in response: ${JSON.stringify(discountData)}`);
        }

        const userErrors = discountData.data.discountCodeBasicCreate.userErrors || [];

        // If customer-specific code failed with invalid customer ID, retry with "all customers"
        if (userErrors.length > 0) {
          const hasInvalidCustomerError = userErrors.some(err => 
            err.code === 'INVALID' && err.field?.includes('customers')
          );
          
          if (hasInvalidCustomerError && cashback.customerId) {
            console.warn(`⚠️  Customer ID ${cashback.customerId} invalid, retrying with public code...`);
            
            // Retry with "all customers" context
            const retryResponse = await admin.graphql(
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
                    title: `Cashback ${cashback.cashbackAmount} - Order ${cashback.orderName}`,
                    code: discountCode,
                    startsAt,
                    endsAt,
                    context: { all: "ALL" }, // Use public code as fallback
                    customerGets: {
                      value: {
                        discountAmount: {
                          amount: cashback.cashbackAmount,
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
            
            const retryData = await retryResponse.json();
            console.log('📋 Retry discount API response:', JSON.stringify(retryData, null, 2));

            if (retryData.errors) {
              throw new Error(`GraphQL error (retry): ${JSON.stringify(retryData.errors)}`);
            }

            const retryErrors = retryData.data?.discountCodeBasicCreate?.userErrors || [];
            
            if (retryErrors.length > 0) {
              throw new Error(`Discount creation failed (retry): ${JSON.stringify(retryErrors)}`);
            }
            
            const retryDiscount = retryData.data?.discountCodeBasicCreate?.codeDiscountNode;
            if (!retryDiscount) {
              throw new Error('Discount code was not created (no codeDiscountNode in retry response)');
            }

            const actualCode = retryDiscount.codeDiscount?.codes?.nodes?.[0]?.code;
            if (!actualCode) {
              throw new Error('Discount created but no code returned in retry response');
            }
            console.log(`✅ Discount code created (public fallback): ${actualCode}`);
            
            // Tag customer as VIP (if customer exists) - skip since customer ID was invalid
            // Send email and mark as complete
            await sendCashbackEmail({
              email: cashback.customerEmail,
              customerName: cashback.customerName,
              discountCode: actualCode,
              cashbackAmount: cashback.cashbackAmount,
              orderNumber: cashback.orderName,
              shopDomain: cashback.shopDomain
            });
            
            console.log(`📧 Email sent to ${cashback.customerEmail}`);
            
            await db.pendingCashback.update({
              where: { id: cashback.id },
              data: {
                emailSent: true,
                emailSentAt: new Date(),
                discountCode: actualCode,
                errorMessage: null
              }
            });
            
            console.log(`✅ Cashback processed successfully for order ${cashback.orderName} (fallback)`);
            results.success++;
            continue; // Skip to next cashback
          } else {
            // Different error, throw it
            throw new Error(`Discount creation failed: ${JSON.stringify(userErrors)}`);
          }
        }

        const codeDiscountNode = discountData.data.discountCodeBasicCreate.codeDiscountNode;
        if (!codeDiscountNode) {
          throw new Error('Discount code was not created (no codeDiscountNode in response)');
        }
        
        const actualCode = codeDiscountNode.codeDiscount?.codes?.nodes?.[0]?.code;
        if (!actualCode) {
          throw new Error('Discount created but no code returned in response');
        }

        console.log(`✅ Discount code created: ${actualCode} (ID: ${codeDiscountNode.id})`);

        // Tag customer as VIP (if customer exists)
        if (cashback.customerId) {
          try {
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
                    id: `gid://shopify/Customer/${cashback.customerId}`,
                    tags: [CASHBACK_CONFIG.VIP_TAG]
                  }
                }
              }
            );
            console.log(`🏷️  Customer tagged as VIP`);
          } catch (tagError) {
            console.warn('⚠️  Failed to tag customer:', tagError.message);
            // Continue even if tagging fails
          }
        }

        // Send cashback email
        await sendCashbackEmail({
          email: cashback.customerEmail,
          customerName: cashback.customerName,
          discountCode: actualCode,
          cashbackAmount: cashback.cashbackAmount,
          orderNumber: cashback.orderName,
          shopDomain: cashback.shopDomain
        });

        console.log(`📧 Email sent to ${cashback.customerEmail}`);

        // Update database record as sent
        await db.pendingCashback.update({
          where: { id: cashback.id },
          data: {
            emailSent: true,
            emailSentAt: new Date(),
            discountCode: actualCode,
            errorMessage: null
          }
        });

        console.log(`✅ Cashback processed successfully for order ${cashback.orderName}`);
        results.success++;

      } catch (error) {
        console.error(`❌ Failed to process cashback for order ${cashback.orderName}:`, error.message);
        
        // Update retry count and error message
        await db.pendingCashback.update({
          where: { id: cashback.id },
          data: {
            retryCount: cashback.retryCount + 1,
            errorMessage: error.message
          }
        });

        results.failed++;
        results.errors.push({
          orderId: cashback.orderId,
          orderName: cashback.orderName,
          error: error.message
        });
      }
    }

    console.log(`\n✅ Cron job completed: ${results.success} succeeded, ${results.failed} failed`);

    return Response.json({
      success: true,
      processed: pendingCashbacks.length,
      succeeded: results.success,
      failed: results.failed,
      errors: results.errors
    });

  } catch (error) {
    console.error('❌ Cron job error:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
};

// Also handle GET requests for manual testing
export const loader = async ({ request }) => {
  console.log('🧪 Manual test trigger via GET request');
  return action({ request });
};

/**
 * Send cashback email using Resend API
 */
async function sendCashbackEmail({ email, customerName, discountCode, cashbackAmount, orderNumber, shopDomain }) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + CASHBACK_CONFIG.CODE_EXPIRY_DAYS);
  const formattedExpiry = expiryDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Load and populate the email template
  const emailHtml = getEmailTemplate('meonutrition-cashback', {
    CUSTOMER_NAME: customerName,
    CASHBACK_CODE: discountCode,
    CASHBACK_AMOUNT: `$${cashbackAmount}`,
    STORE_URL: `https://${shopDomain}`,
    EXPIRY_DATE: formattedExpiry,
    ORDER_NUMBER: orderNumber
  });

  const RESEND_API_KEY = "re_YZV1ECpr_3NYamiQGCEffvuyKQisGTRCo";
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@plus.meonutrition.com';

  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  console.log(`📧 Sending email to ${email}...`);
  
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
      html: emailHtml,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`Email sending failed: ${JSON.stringify(result)}`);
  }

  console.log(`✅ Email sent successfully to ${email}`);
  return result;
}
