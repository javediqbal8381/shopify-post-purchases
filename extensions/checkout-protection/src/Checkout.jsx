import {
  reactExtension,
  BlockStack,
  InlineLayout,
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

// Singleton to prevent duplicate renders
let renderCount = 0;

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
  const [instanceId] = useState(() => ++renderCount);
  
  // Only allow first instance
  if (instanceId > 1) {
    console.log('[CheckoutProtection] Duplicate instance, skipping');
    return null;
  }

  console.log('[CheckoutProtection] Component rendered');
  console.log('[CheckoutProtection] Cart lines count:', cartLines.length);
  console.log('[CheckoutProtection] Cart lines:', cartLines);
  console.log('[CheckoutProtection] Attributes:', attributes);

  // Calculate cart total (excluding protection)
  const cartTotal = cartLines.reduce((total, line) => {
    if (protectionVariantId && line.merchandise.id === protectionVariantId) {
      return total;
    }
    return total + parseFloat(line.cost.totalAmount.amount);
  }, 0);

  const insuranceFee = (cartTotal * INSURANCE_PERCENT / 100).toFixed(2);
  const cashbackAmount = (cartTotal * CASHBACK_PERCENT / 100).toFixed(2);

  console.log('[CheckoutProtection] Cart total:', cartTotal);
  console.log('[CheckoutProtection] Insurance fee:', insuranceFee);
  console.log('[CheckoutProtection] Cashback amount:', cashbackAmount);

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

  console.log('[CheckoutProtection] Protection line found:', protectionLine);
  console.log('[CheckoutProtection] Protection variant ID:', protectionVariantId);

  const protectionEnabled = attributes.find(attr => attr.key === '_protection_enabled')?.value === 'true';
  const [isChecked, setIsChecked] = useState(false);

  console.log('[CheckoutProtection] Protection enabled attribute:', protectionEnabled);

  useEffect(() => {
    console.log('[CheckoutProtection] useEffect triggered');
    const hasProtection = protectionEnabled || !!protectionLine;
    console.log('[CheckoutProtection] Has protection:', hasProtection);
    setIsChecked(hasProtection);

    if (protectionLine && !protectionVariantId) {
      console.log('[CheckoutProtection] Setting protection variant ID:', protectionLine.merchandise.id);
      setProtectionVariantId(protectionLine.merchandise.id);
    }
  }, [protectionEnabled, protectionLine, protectionVariantId]);

  const handleToggle = async (checked) => {
    console.log('[CheckoutProtection] handleToggle called, checked:', checked);
    setIsChecked(checked);

    try {
      if (checked) {
        console.log('[CheckoutProtection] Adding protection - querying product by handle...');
        const result = await query(
          `query {
            product(handle: "order-protection") {
              id
              title
              handle
              variants(first: 1) {
                nodes {
                  id
                }
              }
            }
          }`
        );

        console.log('[CheckoutProtection] Query result:', result);

        const product = result?.data?.product;
        console.log('[CheckoutProtection] Found protection product:', product);

        const variantId = product?.variants?.nodes?.[0]?.id;
        console.log('[CheckoutProtection] Protection variant ID:', variantId);

        if (!variantId) {
          console.error('[CheckoutProtection] No variant ID found - protection product not found!');
          setIsChecked(false);
          return;
        }

        setProtectionVariantId(variantId);

        console.log('[CheckoutProtection] Adding cart line with variant:', variantId);
        await applyCartLinesChange({
          type: 'addCartLine',
          merchandiseId: variantId,
          quantity: 1,
        });

        console.log('[CheckoutProtection] Setting attributes...');
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
        console.log('[CheckoutProtection] Protection added successfully');
      } else {
        console.log('[CheckoutProtection] Removing protection...');
        if (protectionLine) {
          console.log('[CheckoutProtection] Protection line to remove:', protectionLine);
          const removeResult = await applyCartLinesChange({
            type: 'removeCartLine',
            id: protectionLine.id,
            quantity: parseInt(protectionLine.quantity, 10),
          });

          console.log('[CheckoutProtection] Remove result:', removeResult);

          if (removeResult.type === 'success') {
            await applyAttributeChange({
              type: 'updateAttribute',
              key: '_protection_enabled',
              value: 'false',
            });
            console.log('[CheckoutProtection] Protection removed successfully');
          } else {
            console.error('[CheckoutProtection] Failed to remove protection, reverting checkbox');
            setIsChecked(true);
          }
        } else {
          console.log('[CheckoutProtection] No protection line found to remove');
          setIsChecked(false);
        }
      }
    } catch (error) {
      console.error('[CheckoutProtection] Error in handleToggle:', error);
      console.error('[CheckoutProtection] Error details:', error.message, error.stack);
      setIsChecked(!checked);
    }
  };

  if (cartTotal === 0) {
    console.log('[CheckoutProtection] Cart total is 0, not rendering');
    return null;
  }

  console.log('[CheckoutProtection] Rendering checkbox, isChecked:', isChecked);

  return (
    <InlineLayout spacing="base" columns={['fill', 'auto']} blockAlignment="start">
      <BlockStack spacing="extraTight">
        <Text size="medium" emphasis="bold">
          Checkout+ for ${insuranceFee}
        </Text>
        <Text size="small" appearance="subdued">
          Protect your package, earn ${cashbackAmount} cashback, and more.
        </Text>
      </BlockStack>
      <Checkbox
        checked={isChecked}
        onChange={handleToggle}
      />
    </InlineLayout>
  );
}
