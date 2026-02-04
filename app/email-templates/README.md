# Email Templates

This folder contains HTML email templates for the Checkout+ app.

## Usage

### Using a Template

```javascript
import { getEmailTemplate } from "../email-templates/utils";

const emailHtml = getEmailTemplate('template-name', {
  VARIABLE_NAME: 'value',
  ANOTHER_VAR: 'another value'
});
```

### Available Templates

#### `meonutrition-cashback.html`
Cashback email for Meo Nutrition store.

**Variables:**
- `{{CUSTOMER_NAME}}` - Customer's first name
- `{{CASHBACK_CODE}}` - The discount code
- `{{CASHBACK_AMOUNT}}` - Amount with $ (e.g., "$5.00")
- `{{STORE_URL}}` - Store URL (e.g., "https://store.myshopify.com")
- `{{EXPIRY_DATE}}` - Formatted expiry date
- `{{ORDER_NUMBER}}` - Order number (optional)

### Creating New Templates

1. Create a new `.html` file in this folder
2. Use `{{VARIABLE_NAME}}` syntax for dynamic content
3. Test thoroughly across email clients
4. Document all variables in this README

### Template Guidelines

- Keep inline CSS for maximum email client compatibility
- Test on mobile and desktop
- Use web-safe fonts
- Keep max-width at 600px
- Avoid JavaScript (not supported in emails)
- Use absolute URLs for images

### Testing

Before deploying a new template:
1. Test in Gmail, Outlook, Apple Mail
2. Test on mobile devices
3. Verify all variables are replaced correctly
4. Check spam score
