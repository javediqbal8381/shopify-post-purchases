Shopify anwards+ project

Tasks Todo 
make the discount code expire after usage so customer unable to use again

deploy backend in digital ocean droplet

Create a dashboard for the app and there will show the analytics.
cashback and insurence %age shold be like as onwards
create a dashboard to show all the details.
when click on the app in shopify apps section so it shoulkd go to dashboard
send the cashback email after 30 days.
ask markus after few days if the onwards installed the checkout+ on the non plus store


example site from where i get the design and flow idea
https://kinfield.com/


extension targets (where to place extensions)
https://shopify.dev/docs/api/checkout-ui-extensions/2023-07/extension-targets-overview#dynamic-extension-targets


For developement use local tunnel url in shopify webhook 
Then chage it for production (to our vercel deployed backend)


      

You can test orders using the Bogus Test 
gateway, or by activating test mode for your payment 
provider

Testing Checkout
Card Number: 1
CVV: Any 3 digits (e.g., 123)
Expiry: Any future date (e.g., 12/25)
Name: Any name
      

 Next steps                                                                  
   • Run `cd post-purchases-flow`                                            
   • For extensions, run `shopify app generate extension`                    
   • To see your app, run `shopify app dev`
   .  For an overview of commands, run `shopify app --help`



create a dev store with plus plan 


——————TODO——————

to install app 

if using developement webhook :
	everytime you restart server you have to update the webhook url in the shopify admin

for the cart transform API you have to also run some graphql code simple

try to to open the app first time in the sopify admin so it can save session inthe database in session tables. then it will work properly

what to do wh installing the app on new store 

create a hidden product
1. Go to: Products → Add product
2. Fill in:
* Title: Order Protection
* Description: Protection for your order with cashback rewards
* Price: $25.00 (or whatever you want as the insurance fee)
* SKU: (leave empty)
* Uncheck: "Charge tax on this product"
* Uncheck: "This is a physical product" (or set "Requires shipping" to NO)
* Product type: Service
* Vendor: Store
* Tags: order-protection, hidden
1. IMPORTANT: Make sure Status is set to Active (not Draft)
2. IMPORTANT: Make sure it's published to "Online Store" sales channel
* Scroll to "Inventory" section
* Check: ☑ "Continue selling when out of stock"
1. Click Save


add webhook in shopify admin
1. Go to Shopify Admin Settings:
* Open: https://admin.shopify.com/store/dev-store2-8/settings
* Or navigate: Settings → Notifications → Webhooks
1. Create a webhook:
* Click "Create webhook"
* Event: Select Order creation
* Format: JSON
* URL: https://shopify-post-purchases.vercel.app/webhooks/orders/create
* API version: 2026-01 (or latest)
* Click Save



📋 How to Activate the Cart Extension:
Step 1: Add the Block to Your Theme's Cart
1. Go to your Shopify Admin: https://dev-store2-8.myshopify.com/admin
2. Navigate to: Online Store → Themes → Customize (button on your active theme)
3. In the theme editor:
* Look for the cart drawer/page section (usually accessible by adding items to cart and opening it, or searching for "cart" in the sections)
* Or, click the home icon (top left) → Cart to open the cart template
1. Add the App Block:
* In the left sidebar, click "Add block" or "Add section" (depending on where you want it)
* Look for "Apps" section
* Find "Checkout+ (Cart)" or "Cart Checkout Plus"
* Drag it to where you want it in the cart (typically above or below the cart items list, before the checkout button)
1. Click "Save" in the top right

do npm run dev and then press g
GraphQL Mutations Needed:

1. get 
query {
  shopifyFunctions(first: 10) {
    nodes {
      id
      apiType
      title
    }
  }
}

1. First: Create the Cart Transform (the id copied from the ist one)

mutation {
  cartTransformCreate(
    functionId: "[ID_FROM_FIRST_MUTATION]"
  ) {
    cartTransform {
      id
      functionId
    }
    userErrors {
      field
      message
    }
  }
}



2. Second: Activate the Cart Transform
After creating it, you need to activate it:

mutation {
  cartTransformActivate(
    cartTransformId: "gid://shopify/CartTransform/[ID_FROM_2ND_MUTATION]"
  ) {
    cartTransform {
      id
      functionId
      status
    }
    userErrors {
      field
      message
    }
  }

}


klaviyo platform
create metric
create flow and select that metric
disable the option 
make sure flow and metric is is live`
# Shopify anwards+ project

## Tasks Todo

* make the discount code expire after usage so customer unable to use again
* align the UI
* when i remove an item from cart in the drawer cart our UI hides
* deploy backend in digital ocean droplet

## Design & Flow Reference

* example site from where i get the design and flow idea
  [https://kinfield.com/](https://kinfield.com/)

## Extension Targets

* extension targets (where to place extensions)
  [https://shopify.dev/docs/api/checkout-ui-extensions/2023-07/extension-targets-overview#dynamic-extension-targets](https://shopify.dev/docs/api/checkout-ui-extensions/2023-07/extension-targets-overview#dynamic-extension-targets)

## Development Notes

* For developement use local tunnel url in shopify webhook
* Then chage it for production (to our vercel deployed backend)

## Testing Orders

You can test orders using the **Bogus Test gateway**, or by activating test mode for your payment provider

### Testing Checkout

* Card Number: 1
* CVV: Any 3 digits (e.g., 123)
* Expiry: Any future date (e.g., 12/25)
* Name: Any name

## Next steps

* Run `cd post-purchases-flow`
* For extensions, run `shopify app generate extension`
* To see your app, run `shopify app dev`
* For an overview of commands, run `shopify app --help`

---

## TODO

### To install app

* if using developement webhook :
  everytime you restart server you have to update the webhook url in the shopify admin

* for the cart transform API you have to also run some graphql code simple

* try to to open the app first time in the sopify admin so it can save session inthe database in session tables. then it will work properly

* what to do wh installing the app on new store

## Create a hidden product

1. Go to: **Products → Add product**
2. Fill in:

   * **Title:** Order Protection
   * **Description:** Protection for your order with cashback rewards
   * **Price:** $25.00 (or whatever you want as the insurance fee)
   * **SKU:** (leave empty)
   * Uncheck: "Charge tax on this product"
   * Uncheck: "This is a physical product" (or set "Requires shipping" to NO)
   * **Product type:** Service
   * **Vendor:** Store
   * **Tags:** order-protection, hidden
3. IMPORTANT: Make sure **Status** is set to **Active** (not Draft)
4. IMPORTANT: Make sure it's published to **Online Store** sales channel
5. Scroll to **Inventory** section

   * Check: ☑ "Continue selling when out of stock"
6. Click **Save**

## Add webhook in shopify admin

1. Go to Shopify Admin Settings:

   * Open: [https://admin.shopify.com/store/dev-store2-8/settings](https://admin.shopify.com/store/dev-store2-8/settings)
   * Or navigate: **Settings → Notifications → Webhooks**
2. Create a webhook:

   * Click "Create webhook"
   * **Event:** Select Order creation
   * **Format:** JSON
   * **URL:** [https://shopify-post-purchases.vercel.app/webhooks/orders/create](https://shopify-post-purchases.vercel.app/webhooks/orders/create)
   * **API version:** 2026-01 (or latest)
   * Click **Save**

## 📋 How to Activate the Cart Extension

### Step 1: Add the Block to Your Theme's Cart

1. Go to your Shopify Admin:
   [https://dev-store2-8.myshopify.com/admin](https://dev-store2-8.myshopify.com/admin)
2. Navigate to:
   **Online Store → Themes → Customize** (button on your active theme)
3. In the theme editor:

   * Look for the cart drawer/page section (usually accessible by adding items to cart and opening it, or searching for "cart" in the sections)
   * Or, click the home icon (top left) → Cart to open the cart template
4. Add the App Block:

   * In the left sidebar, click "Add block" or "Add section" (depending on where you want it)
   * Look for "Apps" section
   * Find "Checkout+ (Cart)" or "Cart Checkout Plus"
   * Drag it to where you want it in the cart (typically above or below the cart items list, before the checkout button)
5. Click "Save" in the top right

## Development Commands

* do `npm run dev` and then press `g`

## GraphQL Mutations Needed

### 1. First: Create the Cart Transform (you have this one)

```graphql
mutation {
  cartTransformCreate(
    functionId: "019bdfda-bd41-7a6a-85b4-f145ad08c712"
  ) {
    cartTransform {
      id
      functionId
    }
    userErrors {
      field
      message
    }
  }
}
```

### 2. Second: Activate the Cart Transform

After creating it, you need to activate it:

```graphql
mutation {
  cartTransformActivate(
    cartTransformId: "gid://shopify/CartTransform/[ID_FROM_FIRST_MUTATION]"
  ) {
    cartTransform {
      id
      functionId
      status
    }
    userErrors {
      field
      message
    }
  }
}
```

## Klaviyo platform

* create metric
* create flow and select that metric
* disable the option
* make sure flow and metric is is live










