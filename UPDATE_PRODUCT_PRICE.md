// Script to update Order Protection product price
// This needs to be run through Shopify Admin API

// The protection product price needs to be set to the insurance percentage
// For a $100 order with 4% insurance = $4.00

// Manual steps:
// 1. Go to Products → Order Protection
// 2. Set variant price to: $0.01 (we'll calculate actual price in extension)
// 3. Make sure:
//    - SKU: (leave empty)
//    - Taxable: NO (uncheck)
//    - Requires shipping: NO (uncheck)
// 4. Save

// The actual insurance fee calculation happens in the checkout extension
// based on cart total × INSURANCE_PERCENT (4%)

