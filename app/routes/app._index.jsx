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
  
  const styles = {
    container: {
      minHeight: "100vh",
      background: "#ffffff",
      padding: "60px 24px"
    },
    maxWidth: {
      maxWidth: "1100px",
      margin: "0 auto"
    },
    header: {
      textAlign: "center",
      marginBottom: "60px"
    },
    mainTitle: {
      fontSize: "36px",
      fontWeight: "600",
      color: "#000000",
      marginBottom: "12px",
      letterSpacing: "-0.02em"
    },
    subtitle: {
      fontSize: "16px",
      color: "#666666",
      fontWeight: "400"
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "20px",
      marginBottom: "60px"
    },
    statCard: {
      background: "#fafafa",
      padding: "32px 24px",
      borderRadius: "8px",
      textAlign: "center"
    },
    statLabel: {
      fontSize: "12px",
      color: "#999999",
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      marginBottom: "12px"
    },
    statValue: {
      fontSize: "40px",
      fontWeight: "600",
      lineHeight: "1"
    },
    card: {
      background: "#ffffff",
      padding: "40px",
      borderRadius: "0px",
      border: "1px solid #e8e8e8",
      marginBottom: "40px"
    },
    cardTitle: {
      fontSize: "20px",
      fontWeight: "600",
      color: "#000000",
      marginBottom: "24px",
      letterSpacing: "-0.01em"
    },
    heroCard: {
      background: "#142b6f",
      color: "white",
      padding: "50px 40px",
      borderRadius: "0px",
      marginBottom: "60px"
    },
    benefitsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: "30px",
      marginTop: "30px"
    },
    benefitCard: {
      padding: "0"
    },
    successBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "10px 16px",
      background: "#f0fdf4",
      color: "#166534",
      borderRadius: "4px",
      fontSize: "14px",
      fontWeight: "500",
      marginBottom: "24px",
      border: "1px solid #bbf7d0"
    },
    button: {
      background: "#142b6f",
      color: "white",
      padding: "14px 28px",
      border: "none",
      borderRadius: "4px",
      fontSize: "15px",
      fontWeight: "500",
      cursor: "pointer",
      transition: "background 0.2s ease"
    },
    infoBox: {
      background: "#fafafa",
      border: "none",
      borderRadius: "4px",
      padding: "20px",
      marginTop: "24px"
    },
    stepCard: {
      background: "#ffffff",
      padding: "24px",
      borderRadius: "0px",
      border: "1px solid #e8e8e8",
      marginBottom: "12px",
      display: "flex",
      gap: "20px",
      alignItems: "flex-start"
    },
    stepNumber: {
      background: "#000000",
      color: "white",
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "14px",
      fontWeight: "600",
      flexShrink: "0"
    }
  };
  
  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.mainTitle}>Checkout+</h1>
          <p style={styles.subtitle}>Cashback & Order Protection System</p>
        </div>
        
        {/* Stats Cards */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Cashback Rate</div>
            <div style={{...styles.statValue, color: "#22c55e"}}>{config.CASHBACK_PERCENT}%</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Insurance Fee</div>
            <div style={{...styles.statValue, color: "#142b6f"}}>{config.INSURANCE_PERCENT}%</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Code Expiry</div>
            <div style={{...styles.statValue, color: "#000000"}}>{config.CODE_EXPIRY_DAYS}d</div>
          </div>
        </div>
        
        {/* Hero - Business Model */}
        <div style={styles.heroCard}>
          <h2 style={{fontSize: "24px", fontWeight: "600", marginBottom: "30px"}}>How This Works</h2>
          <div style={styles.benefitsGrid}>
            <div style={styles.benefitCard}>
              <h3 style={{fontSize: "16px", fontWeight: "600", marginBottom: "16px"}}>For Your Customers</h3>
              <ul style={{lineHeight: "2", paddingLeft: "20px", fontSize: "14px", opacity: "0.95"}}>
                <li>Pay ${config.INSURANCE_PERCENT} protection fee</li>
                <li>Receive ${config.CASHBACK_PERCENT} cashback code</li>
                <li>Net gain: ${config.CASHBACK_PERCENT - config.INSURANCE_PERCENT} in value</li>
                <li>VIP status for easy returns</li>
              </ul>
            </div>
            <div style={styles.benefitCard}>
              <h3 style={{fontSize: "16px", fontWeight: "600", marginBottom: "16px"}}>For Your Store</h3>
              <ul style={{lineHeight: "2", paddingLeft: "20px", fontSize: "14px", opacity: "0.95"}}>
                <li>Keep 100% of ${config.INSURANCE_PERCENT} fee</li>
                <li>Build customer loyalty</li>
                <li>Increase repeat purchases</li>
                <li>Own your customer data</li>
              </ul>
            </div>
          </div>
          <div style={{marginTop: "30px", padding: "16px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", fontSize: "14px", opacity: "0.9"}}>
            <strong>Why Build This Yourself?</strong> Third-party services take 75% of fees. Building in-house means you keep all revenue.
          </div>
        </div>
        
        {/* Protection Product Setup */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Protection Product</h2>
          
          {protectionProduct ? (
            <>
              <div style={styles.successBadge}>
                <span>✓</span>
                <span>Product Successfully Created</span>
              </div>
              <div style={{background: "#fafafa", padding: "24px", borderRadius: "4px"}}>
                <div style={{display: "grid", gap: "16px", fontSize: "14px"}}>
                  <div style={{display: "flex", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid #e8e8e8"}}>
                    <span style={{color: "#666666"}}>Product Name</span>
                    <span style={{fontWeight: "500"}}>{protectionProduct.title}</span>
                  </div>
                  <div style={{display: "flex", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid #e8e8e8"}}>
                    <span style={{color: "#666666"}}>Handle</span>
                    <span style={{fontFamily: "monospace", fontSize: "13px"}}>{protectionProduct.handle}</span>
                  </div>
                  <div style={{display: "flex", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid #e8e8e8"}}>
                    <span style={{color: "#666666"}}>Variant ID</span>
                    <span style={{fontFamily: "monospace", fontSize: "13px"}}>{protectionProduct.variants.nodes[0]?.id}</span>
                  </div>
                  <div style={{display: "flex", justifyContent: "space-between"}}>
                    <span style={{color: "#666666"}}>Status</span>
                    <span style={{color: "#22c55e", fontWeight: "500"}}>Active</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <p style={{marginBottom: "24px", color: "#666666", fontSize: "14px", lineHeight: "1.6"}}>
                Create the hidden protection product that will be automatically added to cart when customers opt in for protection.
              </p>
              <Form method="post">
                <input type="hidden" name="action" value="create_product" />
                <button 
                  type="submit" 
                  style={styles.button}
                  onMouseOver={(e) => e.target.style.background = "#0f1f4f"}
                  onMouseOut={(e) => e.target.style.background = "#142b6f"}
                >
                  Create Protection Product
                </button>
              </Form>
            </>
          )}
        </div>
        
        {/* How It Works Flow */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Customer Journey</h2>
          <div>
            <div style={styles.stepCard}>
              <div style={styles.stepNumber}>1</div>
              <div>
                <h3 style={{fontSize: "15px", fontWeight: "500", marginBottom: "6px"}}>Cart Upsell Appears</h3>
                <p style={{fontSize: "14px", color: "#666666", margin: "0", lineHeight: "1.5"}}>Customer sees protection offer with clear benefits in their cart drawer</p>
              </div>
            </div>
            <div style={styles.stepCard}>
              <div style={styles.stepNumber}>2</div>
              <div>
                <h3 style={{fontSize: "15px", fontWeight: "500", marginBottom: "6px"}}>Customer Opts In</h3>
                <p style={{fontSize: "14px", color: "#666666", margin: "0", lineHeight: "1.5"}}>Protection product automatically added to cart with dynamic pricing</p>
              </div>
            </div>
            <div style={styles.stepCard}>
              <div style={styles.stepNumber}>3</div>
              <div>
                <h3 style={{fontSize: "15px", fontWeight: "500", marginBottom: "6px"}}>Order Completed</h3>
                <p style={{fontSize: "14px", color: "#666666", margin: "0", lineHeight: "1.5"}}>Webhook detects protection purchase and triggers automation</p>
              </div>
            </div>
            <div style={styles.stepCard}>
              <div style={styles.stepNumber}>4</div>
              <div>
                <h3 style={{fontSize: "15px", fontWeight: "500", marginBottom: "6px"}}>Code Generated</h3>
                <p style={{fontSize: "14px", color: "#666666", margin: "0", lineHeight: "1.5"}}>Unique cashback discount code created via Shopify Admin API</p>
              </div>
            </div>
            <div style={styles.stepCard}>
              <div style={styles.stepNumber}>5</div>
              <div>
                <h3 style={{fontSize: "15px", fontWeight: "500", marginBottom: "6px"}}>Email Delivered</h3>
                <p style={{fontSize: "14px", color: "#666666", margin: "0", lineHeight: "1.5"}}>Customer receives cashback code via Klaviyo and gets VIP tag</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Setup Guide */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Quick Setup Guide</h2>
          <div style={{fontSize: "14px", lineHeight: "1.8", color: "#333333"}}>
            <div style={{marginBottom: "24px"}}>
              <strong style={{display: "block", marginBottom: "8px", fontSize: "15px", color: "#000000"}}>1. Enable Theme Extension</strong>
              <ul style={{paddingLeft: "20px", margin: "8px 0", color: "#666666"}}>
                <li>Go to Online Store → Themes</li>
                <li>Click Customize on active theme</li>
                <li>Find App embeds in sidebar</li>
                <li>Toggle Checkout+ (Auto-inject) to ON</li>
              </ul>
            </div>
            <div style={{marginBottom: "24px"}}>
              <strong style={{display: "block", marginBottom: "8px", fontSize: "15px", color: "#000000"}}>2. Enable Cart Transformer</strong>
              <ul style={{paddingLeft: "20px", margin: "8px 0", color: "#666666"}}>
                <li>Go to Settings → Checkout</li>
                <li>Scroll to Cart transformer section</li>
                <li>Enable the transformer function</li>
              </ul>
            </div>
            <div>
              <strong style={{display: "block", marginBottom: "8px", fontSize: "15px", color: "#000000"}}>3. Configure Klaviyo</strong>
              <ul style={{paddingLeft: "20px", margin: "8px 0", color: "#666666"}}>
                <li>Add Klaviyo API key to environment variables</li>
                <li>Set up email template for cashback codes</li>
                <li>Test email delivery with test order</li>
              </ul>
            </div>
          </div>
          
          <div style={styles.infoBox}>
            <strong style={{fontSize: "14px"}}>Pro Tip</strong>
            <p style={{margin: "8px 0 0", fontSize: "13px", color: "#666666", lineHeight: "1.5"}}>
              Run <code style={{background: "#e8e8e8", padding: "2px 6px", borderRadius: "2px", fontFamily: "monospace"}}>shopify app deploy</code> after any extension changes to see them reflected in your store.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
