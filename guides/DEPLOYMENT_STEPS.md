to install the app on any dev store >

do to dev dashboard > https://dev.shopify.com/dashboard
if you want to add new dev store click the "dev stores" in the left.
click add dev store > select "plus plan" and add test data.
in the dev dashboard > click checkout-plus app > install this app on the store you want.
then go the shopify admin select that store and go to online store and click edit theme 
in the editor add a simple product to cart and open cart then > go to app embeds in left side bar. enable the checkout-plus (auto inject). save the editor (this will inject the UI in the cart)
then in shopify admin goto > settings > checkout edit.
in the editor clcik the Apps icon in the left most side and add both the checkout-protection and checkout-line-remove extensions and save the editor.

then go to the products in the shopify admin > create product with the details below.

create a hidden product
1. Go to: Products → Add product
2. Fill in:
* Title: Order Protection
* Description: Protection for your order with cashback rewards
* Price: $00.00
* SKU: (leave empty)
* Uncheck: "Charge tax on this product"
* Product type: Service
* Vendor: Store
* Tags: order-protection, hidden
* Catagory should be uncatagorized
* Add varient 
   put title as "Title" and this as "Protect against loss, theft and damage (ONW76)"
   make this a physical product by clicking the Varient
3. IMPORTANT: Make sure Status is set to Active (not Draft)
4. IMPORTANT: Make sure it's published to "Online Store" sales channel
* Scroll to "Inventory" section
* Check: ☑ "Continue selling when out of stock"

1. Click Save


then in vs code run command > npm start -- --reset. > select the org > select the store.

if it as password enter it (you can see it in the online store section in shopify admin)


then after the terminal is runing > press g to open graphql editor 

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

