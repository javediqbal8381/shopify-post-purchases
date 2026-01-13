import {
  reactExtension,
  BlockStack,
  Checkbox,
  Text,
  useCartLines,
  useApplyCartLinesChange,
  useApplyAttributeChange,
  useApi,
  useTotalAmount,
} from '@shopify/ui-extensions-react/checkout';
import { useState, useEffect } from 'react';

export default reactExtension('purchase.checkout.cart-line-list.render-after', () => <CheckoutProtection />);

function CheckoutProtection() {
  const { query } = useApi();
  const cartLines = useCartLines();
  const applyCartLinesChange = useApplyCartLinesChange();
  const applyAttributeChange = useApplyAttributeChange();
  
  const CASHBACK_PERCENT = 5;
  const INSURANCE_PERCENT = 4;
  const PROTECTION_HANDLE = 'order-protection';
  
  // Store the protection variant ID dynamically
  const [protectionVariantId, setProtectionVariantId] = useState(null);
  
  // Calculate cart total (excluding protection)
  const cartTotal = cartLines.reduce((total, line) => {
    // Skip protection product by checking merchandise ID
    if (protectionVariantId && line.merchandise.id === protectionVariantId) {
      return total;
    }
    return total + parseFloat(line.cost.totalAmount.amount);
  }, 0);
  
  const insuranceFee = (cartTotal * INSURANCE_PERCENT / 100).toFixed(2);
  const cashbackAmount = (cartTotal * CASHBACK_PERCENT / 100).toFixed(2);
  
  // Check if protection is in cart by merchandise ID
  const protectionLine = cartLines.find(
    line => protectionVariantId && line.merchandise.id === protectionVariantId
  );
  
  console.log('🔍 Checking cart lines:');
  console.log('  Protection variant ID:', protectionVariantId);
  console.log('  Cart merchandise IDs:', cartLines.map(l => l.merchandise.id));
  console.log('  Protection line found:', !!protectionLine);
  
  const [isChecked, setIsChecked] = useState(!!protectionLine);
  
  useEffect(() => {
    const hasProtection = !!protectionLine;
    console.log('useEffect - Has protection:', hasProtection);
    setIsChecked(hasProtection);
    
    // If protection is found and we don't have the variant ID yet, store it
    if (protectionLine && !protectionVariantId) {
      setProtectionVariantId(protectionLine.merchandise.id);
      console.log('Stored protection variant ID from cart:', protectionLine.merchandise.id);
    }
  }, [protectionLine, protectionVariantId]);
  
  const handleToggle = async (checked) => {
    console.log('Checkbox toggled:', checked);
    setIsChecked(checked);
    
    try {
      if (checked) {
        // Get protection product variant ID
        console.log('Querying for protection product...');
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
        
        console.log('Query result:', JSON.stringify(result, null, 2));
        
        // Try multiple ways to find the product
        const allProducts = result?.data?.products?.nodes || [];
        console.log('Total products found:', allProducts.length);
        console.log('All product handles:', allProducts.map(p => p.handle));
        console.log('All product titles:', allProducts.map(p => p.title));
        
        // Find by handle or tags
        const product = allProducts.find(p => 
          p.handle === 'order-protection' || 
          p.title.toLowerCase().includes('protection') ||
          (p.tags && p.tags.includes('order-protection'))
        );
        
        const variantId = product?.variants?.nodes?.[0]?.id;
        
        console.log('Found product:', product);
        console.log('Variant ID:', variantId);
        
        if (!variantId) {
          console.error('❌ Protection product not found. Please create it in Products with handle "order-protection"');
          setIsChecked(false);
          return;
        }
        
        // Store the variant ID for future reference
        setProtectionVariantId(variantId);
        
        console.log('Adding product to cart with variant ID:', variantId);
        
        // Add protection product
        const addResult = await applyCartLinesChange({
          type: 'addCartLine',
          merchandiseId: variantId,
          quantity: 1,
        });
        
        console.log('Add cart line result:', addResult);
        
        console.log('Product added, setting attributes...');
        
        // Save metadata as cart attributes
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
        
        console.log('✅ Protection added successfully!');
      } else {
        // Remove protection
        console.log('=== REMOVING PROTECTION ===');
        console.log('Current cart lines:', cartLines.length);
        console.log('Protection line to remove:', protectionLine);
        
        if (protectionLine) {
          console.log('Removing line ID:', protectionLine.id);
          console.log('Line quantity:', protectionLine.quantity);
          
          const removeResult = await applyCartLinesChange({
            type: 'removeCartLine',
            id: protectionLine.id,
            quantity: parseInt(protectionLine.quantity, 10),
          });
          
          console.log('Remove result:', removeResult);
          
          if (removeResult.type === 'success') {
            await applyAttributeChange({
              type: 'updateAttribute',
              key: '_protection_enabled',
              value: 'false',
            });
            console.log('✅ Protection removed successfully!');
          } else {
            console.error('❌ Failed to remove protection:', removeResult);
            setIsChecked(true); // Revert checkbox
          }
        } else {
          console.log('❌ No protection line found in cart to remove');
          console.log('All cart lines:', cartLines.map(l => ({
            id: l.id,
            handle: l.merchandise?.product?.handle,
            title: l.merchandise?.product?.title,
            productId: l.merchandise?.product?.id
          })));
          setIsChecked(false); // Keep it unchecked since there's nothing to remove
        }
      }
    } catch (error) {
      console.error('❌ Failed to toggle protection:', error);
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      if (error.stack) console.error('Stack:', error.stack);
      setIsChecked(!checked); // Revert on error
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

