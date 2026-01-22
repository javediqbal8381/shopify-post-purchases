import {
  reactExtension,
  BlockStack,
  Checkbox,
  Text,
  useCartLines,
  useApplyCartLinesChange,
  useApplyAttributeChange,
  useApi,
  useAttributes,
} from '@shopify/ui-extensions-react/checkout';
import { useState, useEffect } from 'react';

export default reactExtension('purchase.checkout.cart-line-list.render-after', () => <CheckoutProtection />);

function CheckoutProtection() {
  const { query } = useApi();
  const cartLines = useCartLines();
  const applyCartLinesChange = useApplyCartLinesChange();
  const applyAttributeChange = useApplyAttributeChange();
  const attributes = useAttributes();
  
  const CASHBACK_PERCENT = 5;
  const INSURANCE_PERCENT = 4;
  const PROTECTION_HANDLE = 'order-protection';
  
  const [protectionVariantId, setProtectionVariantId] = useState(null);
  
  // Calculate cart total (excluding protection)
  const cartTotal = cartLines.reduce((total, line) => {
    if (protectionVariantId && line.merchandise.id === protectionVariantId) {
      return total;
    }
    return total + parseFloat(line.cost.totalAmount.amount);
  }, 0);
  
  const insuranceFee = (cartTotal * INSURANCE_PERCENT / 100).toFixed(2);
  const cashbackAmount = (cartTotal * CASHBACK_PERCENT / 100).toFixed(2);
  
  // Check if protection is in cart by variant title (most reliable)
  const protectionLine = cartLines.find(line => {
    if (protectionVariantId && line.merchandise.id === protectionVariantId) {
      return true;
    }
    const variantTitle = line.merchandise?.title?.toLowerCase() || '';
    if (variantTitle.includes('order protection') || variantTitle === 'order protection') {
      return true;
    }
    if (line.merchandise?.product?.handle === PROTECTION_HANDLE) {
      return true;
    }
    const productTitle = line.merchandise?.product?.title?.toLowerCase() || '';
    if (productTitle.includes('order protection') || productTitle.includes('protection')) {
      return true;
    }
    return false;
  });
  
  const protectionEnabled = attributes.find(attr => attr.key === '_protection_enabled')?.value === 'true';
  const [isChecked, setIsChecked] = useState(false);
  
  useEffect(() => {
    const hasProtection = protectionEnabled || !!protectionLine;
    setIsChecked(hasProtection);
    
    if (protectionLine && !protectionVariantId) {
      setProtectionVariantId(protectionLine.merchandise.id);
    }
  }, [protectionEnabled, protectionLine, protectionVariantId]);
  
  const handleToggle = async (checked) => {
    setIsChecked(checked);
    
    try {
      if (checked) {
        const result = await query(
          `query {
            products(first: 50) {
              nodes {
                id
                title
                handle
                tags
                variants(first: 1) {
                  nodes {
                    id
                  }
                }
              }
            }
          }`
        );
        
        const allProducts = result?.data?.products?.nodes || [];
        const product = allProducts.find(p => 
          p.handle === 'order-protection' || 
          p.title.toLowerCase().includes('protection') ||
          (p.tags && p.tags.includes('order-protection'))
        );
        
        const variantId = product?.variants?.nodes?.[0]?.id;
        
        if (!variantId) {
          setIsChecked(false);
          return;
        }
        
        setProtectionVariantId(variantId);
        
        await applyCartLinesChange({
          type: 'addCartLine',
          merchandiseId: variantId,
          quantity: 1,
        });
        
        await applyAttributeChange({
          type: 'updateAttribute',
          key: '_protection_enabled',
          value: 'true',
        });
        await applyAttributeChange({
          type: 'updateAttribute',
          key: '_cashback_amount',
          value: cashbackAmount,
        });
        await applyAttributeChange({
          type: 'updateAttribute',
          key: '_insurance_fee',
          value: insuranceFee,
        });
      } else {
        if (protectionLine) {
          const removeResult = await applyCartLinesChange({
            type: 'removeCartLine',
            id: protectionLine.id,
            quantity: parseInt(protectionLine.quantity, 10),
          });
          
          if (removeResult.type === 'success') {
            await applyAttributeChange({
              type: 'updateAttribute',
              key: '_protection_enabled',
              value: 'false',
            });
          } else {
            setIsChecked(true);
          }
        } else {
          setIsChecked(false);
        }
      }
    } catch (error) {
      setIsChecked(!checked);
    }
  };
  
  if (cartTotal === 0) return null;
  
  return (
    <BlockStack spacing="tight">
      <Checkbox
        checked={isChecked}
        onChange={handleToggle}
      >
        <BlockStack spacing="extraTight">
          <Text size="medium" emphasis="bold">
            Checkout+ for ${insuranceFee}
          </Text>
          <Text size="small" appearance="subdued">
            Protect your package, earn ${cashbackAmount} cashback, and more.
          </Text>
        </BlockStack>
      </Checkbox>
    </BlockStack>
  );
}
