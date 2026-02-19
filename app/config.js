// Cashback & Insurance Configuration
export const CASHBACK_CONFIG = {
  // Cashback percentage customer earns
  CASHBACK_PERCENT: 5,
  
  // Insurance fee percentage
  INSURANCE_PERCENT: 4,
  
  // Hidden product handle for order protection
  PROTECTION_PRODUCT_HANDLE: 'order-protection',
  
  // Discount code prefix
  DISCOUNT_CODE_PREFIX: 'CASHBACK',
  
  // VIP customer tag
  VIP_TAG: 'VIP-CASHBACK',
  
  // Code expiry days
  CODE_EXPIRY_DAYS: 365,

  // Delay before sending cashback email (in minutes)
  // Set via env: CASHBACK_DELAY_MINUTES=43200 for 30 days (30*24*60)
  // Use small values for testing: CASHBACK_DELAY_MINUTES=2
  CASHBACK_DELAY_MINUTES: parseInt(process.env.CASHBACK_DELAY_MINUTES || '43200', 10),
};

