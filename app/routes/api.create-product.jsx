import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Create protection product
    const response = await admin.graphql(
      `#graphql
      mutation {
        productCreate(input: {
          title: "Order Protection"
          handle: "order-protection"
          status: ACTIVE
          vendor: "Store"
          productType: "Service"
          tags: ["order-protection", "hidden"]
        }) {
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
      }`
    );
    
    const result = await response.json();
    const product = result.data?.productCreate?.product;
    const variantId = product?.variants?.nodes?.[0]?.id;
    
    if (variantId) {
      // Update variant to $0 price and not taxable
      await admin.graphql(
        `#graphql
        mutation {
          productVariantUpdate(input: {
            id: "${variantId}"
            price: "0.00"
            taxable: false
          }) {
            productVariant {
              id
              price
            }
            userErrors {
              field
              message
            }
          }
        }`
      );
    }
    
    console.log('✅ Protection product created:', product?.id);
    console.log('✅ Variant ID:', variantId);
    
    return new Response(JSON.stringify({ 
      success: true, 
      product,
      variantId 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

