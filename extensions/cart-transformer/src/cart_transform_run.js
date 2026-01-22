// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

/**
 * @type {CartTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  const PROTECTION_HANDLE = 'order-protection';
  const FEE_PERCENTAGE = 4; // 4% of subtotal
  
  console.error('[Cart Transform] Function called with cart lines:', input.cart.lines.length);
  
  // Log all product handles for debugging
  input.cart.lines.forEach((line, idx) => {
    console.error(`[Cart Transform] Line ${idx}:`, JSON.stringify({
      typename: line.merchandise.__typename,
      variantId: line.merchandise.id,
      variantTitle: line.merchandise.title,
      productHandle: line.merchandise.product?.handle,
      productTitle: line.merchandise.product?.title,
      price: line.cost.amountPerQuantity.amount
    }));
  });
  
  // Find the Order Protection product in cart
  const protectionLineIndex = input.cart.lines.findIndex((line) => {
    const handle = line.merchandise.__typename === "ProductVariant" 
      ? line.merchandise.product?.handle 
      : null;
    return handle === PROTECTION_HANDLE;
  });

  // If protection not in cart, no changes needed
  if (protectionLineIndex === -1) {
    console.error('[Cart Transform] Protection product NOT FOUND in cart');
    return NO_CHANGES;
  }
  
  console.error(`[Cart Transform] Protection product FOUND at index ${protectionLineIndex}`);

  const protectionLine = input.cart.lines[protectionLineIndex];

  // Calculate cart subtotal (excluding protection product)
  let subtotal = 0;
  input.cart.lines.forEach((line, index) => {
    if (index !== protectionLineIndex) {
      const price = parseFloat(line.cost.amountPerQuantity.amount);
      subtotal += price * line.quantity;
    }
  });

  // Calculate protection fee (4% of subtotal)
  const protectionFee = subtotal * (FEE_PERCENTAGE / 100); 

  // Calculate the price adjustment needed
  // Since we can't use lineUpdate (Shopify Plus only), we use lineExpand
  // The product should have a base price set, and we adjust it here
  const currentPrice = parseFloat(protectionLine.cost.amountPerQuantity.amount);
  const priceAdjustment = protectionFee - currentPrice;

  console.error(`[Cart Transform] Current price: $${currentPrice.toFixed(2)}, Target: $${protectionFee.toFixed(2)}, Adjustment: $${priceAdjustment.toFixed(2)}`);

  // If the price is already correct (within 1 cent), don't adjust
  if (Math.abs(priceAdjustment) < 0.01) {
    console.error(`[Cart Transform] Price already correct, no adjustment needed`);
    return NO_CHANGES;
  }

  // Use lineExpand to adjust the price
  const expandOperation = {
    lineExpand: {
      cartLineId: protectionLine.id,
      expandedCartItems: [
        {
          merchandiseId: protectionLine.merchandise.id,
          quantity: 1,
          price: {
            adjustment: {
              fixedPricePerUnit: {
                amount: protectionFee.toFixed(2),
              },
            },
          },
        },
      ],
    },
  };

  console.error(`[Cart Transform] Subtotal: $${subtotal.toFixed(2)}, Protection Fee (4%): $${protectionFee.toFixed(2)}`);
  console.error(`[Cart Transform] Returning lineExpand operation`);

  return {
    operations: [expandOperation],
  };
};