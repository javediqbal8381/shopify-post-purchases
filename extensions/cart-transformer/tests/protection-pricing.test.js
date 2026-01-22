import { describe, it, expect } from 'vitest';
import { cartTransformRun } from '../src/cart_transform_run';

describe('Protection Pricing Test', () => {
  it('should calculate 4% fee for protection product', () => {
    const input = {
      cart: {
        lines: [
          {
            id: 'gid://shopify/CartLine/1',
            quantity: 1,
            cost: {
              amountPerQuantity: {
                amount: '749.95'
              }
            },
            merchandise: {
              __typename: 'ProductVariant',
              id: 'gid://shopify/ProductVariant/123',
              product: {
                handle: 'the-collection-snowboard-liquid'
              }
            }
          },
          {
            id: 'gid://shopify/CartLine/2',
            quantity: 1,
            cost: {
              amountPerQuantity: {
                amount: '0.00'
              }
            },
            merchandise: {
              __typename: 'ProductVariant',
              id: 'gid://shopify/ProductVariant/456',
              product: {
                handle: 'order-protection'
              }
            }
          }
        ]
      }
    };

    const result = cartTransformRun(input);
    
    console.log('Test Result:', JSON.stringify(result, null, 2));
    
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].update).toBeDefined();
    expect(result.operations[0].update.cartLineId).toBe('gid://shopify/CartLine/2');
    expect(result.operations[0].update.price.adjustment.fixedPricePerUnit.amount).toBe('29.98');
  });
});
