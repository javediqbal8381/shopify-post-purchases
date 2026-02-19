import {
  reactExtension,
  Button,
  useCartLineTarget,
  useApplyCartLinesChange,
  useApplyAttributeChange,
} from '@shopify/ui-extensions-react/checkout';
import { useState } from 'react';

export default reactExtension('purchase.checkout.cart-line-item.render-after', () => <CartLineRemove />);

function CartLineRemove() {
  const cartLine = useCartLineTarget();
  const applyCartLinesChange = useApplyCartLinesChange();
  const applyAttributeChange = useApplyAttributeChange();
  
  const PROTECTION_HANDLE = 'order-protection';
  
  console.log('[CartLineRemove] Component rendered for line:', cartLine?.id);
  console.log('[CartLineRemove] Full cartLine data:', JSON.stringify(cartLine, null, 2));
  
  if (!cartLine) {
    console.log('[CartLineRemove] No cart line data available');
    return null;
  }
  
  // Check multiple ways to identify the protection product
  const merchandise = cartLine.merchandise;
  const productHandle = merchandise?.product?.handle;
  const productTitle = merchandise?.product?.title || '';
  const variantTitle = merchandise?.title || '';
  
  console.log('[CartLineRemove] Product handle:', productHandle);
  console.log('[CartLineRemove] Product title:', productTitle);
  console.log('[CartLineRemove] Variant title:', variantTitle);
  
  // Check if this cart line is the protection product
  const isProtectionProduct = 
    productHandle === PROTECTION_HANDLE ||
    productTitle.toLowerCase().includes('checkout+') ||
    productTitle.toLowerCase().includes('order protection') ||
    variantTitle.toLowerCase().includes('checkout+') ||
    variantTitle.toLowerCase().includes('order protection');
  
  console.log('[CartLineRemove] Is protection product:', isProtectionProduct);
  
  // Only render for protection product
  if (!isProtectionProduct) {
    return null;
  }
  
  const handleRemove = async () => {
    console.log('[CartLineRemove] Removing protection product...');
    
    try {
      const removeResult = await applyCartLinesChange({
        type: 'removeCartLine',
        id: cartLine.id,
        quantity: cartLine.quantity,
      });
      
      console.log('[CartLineRemove] Remove result:', removeResult);
      
      if (removeResult.type === 'success') {
        await applyAttributeChange({
          type: 'updateAttribute',
          key: '_protection_enabled',
          value: 'false',
        });
        console.log('[CartLineRemove] Protection removed successfully');
      }
    } catch (error) {
      console.error('[CartLineRemove] Error removing protection:', error);
    }
  };
  
  return (
    <Button kind="plain" appearance="critical" onPress={handleRemove}>
      remove
    </Button>
  );
}
