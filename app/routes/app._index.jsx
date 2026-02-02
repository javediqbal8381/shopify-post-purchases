import { useLoaderData, Form } from "react-router";
import { authenticate } from "../shopify.server";
import { CASHBACK_CONFIG } from "../config";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  // Check if protection product exists
  const response = await admin.graphql(
    `#graphql
    query getProtectionProduct {
      products(first: 1, query: "tag:order-protection") {
        nodes {
          id
          title
          handle
          status
          variants(first: 1) {
            nodes {
              id
              price
            }
          }
        }
      }
    }`
  );
  
  const data = await response.json();
  const protectionProduct = data.data?.products?.nodes[0];
  
  return Response.json({
    protectionProduct,
    config: CASHBACK_CONFIG
  });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  
  if (action === "create_product") {
    // Create hidden protection product
    const response = await admin.graphql(
      `#graphql
      mutation productCreate($input: ProductInput!, $media: [CreateMediaInput!]) {
        productCreate(input: $input, media: $media) {
          product {
            id
            title
            handle
            variants(first: 1) {
              nodes {
                id
              }
            }
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
            title: "Order Protection",
            handle: CASHBACK_CONFIG.PROTECTION_PRODUCT_HANDLE,
            status: "ACTIVE",
            vendor: "Store",
            productType: "Service",
            tags: ["order-protection", "hidden"]
          }
        }
      }
    );
    
    const result = await response.json();
    const productId = result.data?.productCreate?.product?.id;
    
    if (!productId) {
      return Response.json({ 
        success: false, 
        error: result.data?.productCreate?.userErrors 
      });
    }
    
    // Update the default variant to set price to 0
    const variantId = result.data?.productCreate?.product?.variants?.nodes?.[0]?.id;
    
    if (variantId) {
      await admin.graphql(
        `#graphql
        mutation productVariantUpdate($input: ProductVariantInput!) {
          productVariantUpdate(input: $input) {
            productVariant {
              id
              price
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
              id: variantId,
              price: "0.00",
              taxable: false,
              inventoryPolicy: "CONTINUE"
            }
          }
        }
      );
    }
    
    return Response.json({ success: true, product: result.data?.productCreate?.product });
  }
  
  return Response.json({ success: false });
};

export default function Index() {
  const { protectionProduct, config } = useLoaderData();
  
  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ fontSize: "32px", marginBottom: "8px" }}>Cashback & Protection System</h1>
        <p style={{ color: "#666" }}>Build your own Onwards-style checkout protection</p>
      </div>
      
      {/* Business Model Explanation */}
      <div style={{ 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        padding: "24px", 
        borderRadius: "12px", 
        marginBottom: "20px"
      }}>
        <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>💰 How This Makes Money</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>For Your Customer:</h3>
            <ul style={{ lineHeight: "1.8", paddingLeft: "20px" }}>
              <li>Order: $100</li>
              <li>Pays extra: ${config.INSURANCE_PERCENT} (insurance fee)</li>
              <li>Gets back: ${config.CASHBACK_PERCENT} (cashback code)</li>
              <li><strong>Net profit: ${config.CASHBACK_PERCENT - config.INSURANCE_PERCENT} for customer</strong></li>
            </ul>
          </div>
          <div>
            <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>For You (Store Owner):</h3>
            <ul style={{ lineHeight: "1.8", paddingLeft: "20px" }}>
              <li>You keep the ${config.INSURANCE_PERCENT} insurance fee</li>
              <li>Customer is happy (they got $6 more value)</li>
              <li>Customer becomes VIP (easier returns)</li>
              <li><strong>You earn ${config.INSURANCE_PERCENT} per order</strong></li>
            </ul>
          </div>
        </div>
        <p style={{ marginTop: "16px", fontSize: "14px", opacity: "0.9" }}>
          ⚠️ <strong>Why build this yourself?</strong> Onwards takes 75% of the insurance fee ($3 out of $4). Building it yourself means you keep 100% ($4 out of $4).
        </p>
      </div>
      
      {/* Configuration Card */}
      <div style={{ 
        background: "white", 
        padding: "24px", 
        borderRadius: "12px", 
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        marginBottom: "20px"
      }}>
        <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>Current Configuration</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div style={{ padding: "16px", background: "#f5f5f5", borderRadius: "8px" }}>
            <div style={{ fontSize: "14px", color: "#666" }}>Cashback %</div>
            <div style={{ fontSize: "28px", fontWeight: "bold", color: "#4CAF50" }}>{config.CASHBACK_PERCENT}%</div>
          </div>
          <div style={{ padding: "16px", background: "#f5f5f5", borderRadius: "8px" }}>
            <div style={{ fontSize: "14px", color: "#666" }}>Insurance %</div>
            <div style={{ fontSize: "28px", fontWeight: "bold", color: "#667eea" }}>{config.INSURANCE_PERCENT}%</div>
          </div>
          <div style={{ padding: "16px", background: "#f5f5f5", borderRadius: "8px" }}>
            <div style={{ fontSize: "14px", color: "#666" }}>Code Expiry</div>
            <div style={{ fontSize: "28px", fontWeight: "bold" }}>{config.CODE_EXPIRY_DAYS}d</div>
          </div>
        </div>
      </div>
      
      {/* Protection Product Setup */}
      <div style={{ 
        background: "white", 
        padding: "24px", 
        borderRadius: "12px", 
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        marginBottom: "20px"
      }}>
        <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>Order Protection Product</h2>
        
        {protectionProduct ? (
          <div>
            <div style={{ padding: "16px", background: "#e8f5e9", borderRadius: "8px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>✅</span>
                <span style={{ fontWeight: "600" }}>Protection product is set up!</span>
              </div>
            </div>
            <div style={{ padding: "16px", background: "#f5f5f5", borderRadius: "8px" }}>
              <p><strong>Product ID:</strong> {protectionProduct.id}</p>
              <p><strong>Title:</strong> {protectionProduct.title}</p>
              <p><strong>Handle:</strong> {protectionProduct.handle}</p>
              <p><strong>Variant ID:</strong> {protectionProduct.variants.nodes[0]?.id}</p>
              <p style={{ marginTop: "12px", fontSize: "14px", color: "#666" }}>
                Copy the Variant ID above and add it to your cart theme extension settings.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: "16px", color: "#666" }}>
              Create a hidden product that will be added to cart when customers opt for protection.
            </p>
            <Form method="post">
              <input type="hidden" name="action" value="create_product" />
              <button
                type="submit"
                style={{
                  background: "#4CAF50",
                  color: "white",
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Create Protection Product
              </button>
            </Form>
          </div>
        )}
      </div>
      
      {/* Setup Instructions */}
      <div style={{ 
        background: "white", 
        padding: "24px", 
        borderRadius: "12px", 
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
      }}>
        <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>Setup Instructions</h2>
        <ol style={{ lineHeight: "1.8", paddingLeft: "20px" }}>
          <li><strong>Create Protection Product</strong> - Click the button above (if not already created)</li>
          <li><strong>Enable Cart Drawer Extension</strong> - Follow these steps:
            <ul style={{ marginTop: "8px", paddingLeft: "20px", lineHeight: "1.6" }}>
              <li>Go to <strong>Online Store → Themes</strong> in Shopify Admin</li>
              <li>Click <strong>Customize</strong> on your active theme</li>
              <li>In the theme customizer, look for <strong>"App embeds"</strong> in the left sidebar (or click "..." menu)</li>
              <li>Find <strong>"Checkout+ (Auto-inject)"</strong> and toggle it <strong>ON</strong></li>
              <li>Click <strong>Save</strong></li>
            </ul>
          </li>
          <li><strong>Test</strong> - Add items to cart and open cart drawer - the Checkout+ checkbox should appear automatically</li>
          <li><strong>Email Setup</strong> - Configure Klaviyo email settings in the webhook handler</li>
        </ol>
        
        <div style={{ marginTop: "16px", padding: "12px", background: "#e3f2fd", borderRadius: "8px", borderLeft: "4px solid #2196f3" }}>
          <strong>💡 Tip:</strong> If you can't find "App embeds", make sure you've deployed the extension first using <code>shopify app deploy</code>
        </div>
        
        <div style={{ marginTop: "20px", padding: "16px", background: "#fff3cd", borderRadius: "8px", borderLeft: "4px solid #ffc107" }}>
          <strong>⚠️ Important:</strong>
          <p style={{ marginTop: "8px", fontSize: "14px" }}>
            Make sure to configure the email sending service in the webhook handler code to send cashback codes to customers.
          </p>
        </div>
      </div>
      
      {/* How It Works */}
      <div style={{ 
        background: "white", 
        padding: "24px", 
        borderRadius: "12px", 
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        marginTop: "20px"
      }}>
        <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>How It Works</h2>
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", gap: "12px", padding: "12px", background: "#f5f5f5", borderRadius: "8px" }}>
            <span style={{ fontSize: "24px" }}>1️⃣</span>
            <div>
              <strong>Customer sees upsell in cart</strong>
              <p style={{ fontSize: "14px", color: "#666", margin: "4px 0 0" }}>Shows insurance fee + cashback they'll earn</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", padding: "12px", background: "#f5f5f5", borderRadius: "8px" }}>
            <span style={{ fontSize: "24px" }}>2️⃣</span>
            <div>
              <strong>They check the box</strong>
              <p style={{ fontSize: "14px", color: "#666", margin: "4px 0 0" }}>Protection product added to cart automatically</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", padding: "12px", background: "#f5f5f5", borderRadius: "8px" }}>
            <span style={{ fontSize: "24px" }}>3️⃣</span>
            <div>
              <strong>Order completes</strong>
              <p style={{ fontSize: "14px", color: "#666", margin: "4px 0 0" }}>Webhook detects protection purchase</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", padding: "12px", background: "#f5f5f5", borderRadius: "8px" }}>
            <span style={{ fontSize: "24px" }}>4️⃣</span>
            <div>
              <strong>Cashback code generated</strong>
              <p style={{ fontSize: "14px", color: "#666", margin: "4px 0 0" }}>Discount code created via Admin API</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", padding: "12px", background: "#f5f5f5", borderRadius: "8px" }}>
            <span style={{ fontSize: "24px" }}>5️⃣</span>
            <div>
              <strong>Email sent to customer</strong>
              <p style={{ fontSize: "14px", color: "#666", margin: "4px 0 0" }}>Customer receives cashback code + tagged as VIP</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
