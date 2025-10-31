# Installment Payment Plans

## Overview

This module enables customers to pay photographers over time using individual Stripe Invoices with automatic charging, platform fee collection, and Connect transfers.

## Architecture

- **Stripe Invoices**: Individual scheduled invoices for each payment (simpler and more reliable than subscription schedules)
- **Auto-Collection**: Invoices automatically charge on their due dates
- **Stripe Connect**: Routes funds to photographer's connected account minus platform fee
- **Firestore**: Stores plan and payment records for tracking
- **Webhooks**: Automated payment status updates

## How It Works

1. **Photographer creates plan** → System calculates payment schedule
2. **Stripe invoices created** → One invoice per payment, scheduled to auto-charge on due dates
3. **Platform fee deducted** → Automatically retained on your main Stripe account
4. **Photographer receives payout** → Transferred to their Stripe Connect account via Connect
5. **Webhooks update status** → Real-time tracking of payment success/failure for each invoice

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```bash
# Stripe keys (already configured)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Platform fee configuration (set to 0 = no platform fees)
PLATFORM_FEE_BPS=0

# Firebase credentials (already configured)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### 2. Stripe Connect Setup

Each photographer needs a Stripe Connect account:

```javascript
// Your existing Stripe Connect flow handles this
// When creating a plan, use the photographer's connected account ID
const stripeConnectedAccountId = photographer.stripeAccountId;
```

### 3. Webhook Configuration

Set up Stripe webhooks to point to:
```
https://your-domain.com/api/webhooks/installments
```

Listen for these events:
- `invoice.payment_succeeded` - Payment completed
- `invoice.payment_failed` - Payment declined/failed
- `invoice.voided` - Invoice was cancelled

### 4. Testing in Sandbox

#### Create Test Plan

```bash
curl -X POST https://your-domain.com/api/installments/preview \
  -H "Content-Type: application/json" \
  -d '{
    "totalAmount": 100000,
    "cadence": "monthly",
    "startDate": "2025-01-01T00:00:00Z",
    "numberOfPayments": 6
  }'
```

#### Expected Response

```json
{
  "totalAmount": 100000,
  "numberOfPayments": 6,
  "perInstallmentAmount": 16666,
  "platformFee": 5000,
  "platformFeePerPayment": 833,
  "photographerReceivesTotal": 95000,
  "photographerReceivesPerPayment": 15833,
  "cadence": "monthly",
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2025-06-01T00:00:00.000Z",
  "paymentSchedule": [
    {
      "paymentNumber": 1,
      "dueDate": "2025-01-01T00:00:00.000Z",
      "amount": 16666,
      "platformFee": 833,
      "photographerPayout": 15833
    }
    // ... more payments
  ]
}
```

## API Endpoints

### POST /api/installments/preview
Preview payment breakdown before creating plan

**Request:**
```json
{
  "totalAmount": 100000,
  "cadence": "monthly",
  "startDate": "2025-01-01",
  "numberOfPayments": 6
}
```

### POST /api/installments/create
Create a new installment plan

**Request:**
```json
{
  "sessionId": "session-uuid",
  "photographerId": "photographer-id",
  "stripeConnectedAccountId": "acct_...",
  "customerEmail": "client@example.com",
  "customerName": "Jane Doe",
  "totalAmount": 100000,
  "cadence": "monthly",
  "startDate": "2025-01-01",
  "numberOfPayments": 6
}
```

### GET /api/installments/:planId
Get plan details and payment statuses

**Response:**
```json
{
  "plan": { ... },
  "payments": [
    {
      "paymentNumber": 1,
      "status": "paid",
      "paidAt": "2025-01-01T10:30:00Z"
    }
  ]
}
```

### GET /api/installments/session/:sessionId
Get all plans for a photography session

### GET /api/installments/photographer/:photographerId
Get all plans for a photographer

### POST /api/installments/:planId/cancel
Cancel an installment plan

**Request:**
```json
{
  "reason": "Customer requested cancellation"
}
```

## Payment Flow

```
Customer Card Charged
       ↓
Platform Stripe Account Receives Full Amount
       ↓
Platform Fee Retained ($amount × platformFeeBps / 10000)
       ↓
Remaining Amount Transferred to Photographer's Connect Account
```

## Cadence Options

- **Biweekly**: Every 14 days from start date
- **Monthly**: Same day each month (handles month-end dates automatically)

## Platform Fee Calculation

- **Current Setting: 0% (no platform fees)**
- All payment amounts go directly to the photographer via Stripe Connect
- Platform fee can be configured via PLATFORM_FEE_BPS environment variable (in basis points: 500 = 5%)
- Example if enabled: $1000 total → $50 platform fee → $950 to photographer
- Per payment: Fee is split equally across all payments
- Last payment: Adjusted for rounding to ensure exact total

## Firestore Collections

### `installmentPlans`
- Plan configuration and status
- Stripe IDs and metadata
- Financial breakdowns

### `installmentPayments`
- Individual payment records
- Due dates and statuses
- Stripe invoice/charge IDs

### `installmentWebhooks`
- Webhook event log
- Processing status
- Error tracking

## Testing with Stripe Test Mode

1. Use test API keys (`sk_test_...`)
2. Test cards:
   - `4242 4242 4242 4242` - Succeeds
   - `4000 0000 0000 9995` - Declines
3. Use Stripe CLI for webhook testing:
   ```bash
   stripe listen --forward-to localhost:5000/api/webhooks/installments
   ```

## Error Handling

- **Payment failures**: Automatic retry via Stripe
- **Webhook failures**: Logged in Firestore for manual review
- **Validation errors**: Clear error messages returned to API caller

## Security

- ✅ Webhook signature verification
- ✅ Firestore security rules required
- ✅ Input validation on all endpoints
- ✅ Secure Stripe Connect flow

## Monitoring

Check these for health:
1. Firestore `installmentWebhooks` collection for failed events
2. Stripe Dashboard → Connect → Transfers
3. Plan statuses in `installmentPlans` collection

## Support

For issues:
1. Check webhook logs in Firestore
2. Verify Stripe Connect account is active
3. Ensure webhook endpoint is accessible
4. Review platform fee calculation in preview

## Migration from Old System

The old PostgreSQL-based payment plans remain intact. This new system operates independently and offers:
- ✅ Automated Stripe-managed billing
- ✅ Automatic Connect transfers
- ✅ Platform fee collection
- ✅ Webhook-driven status updates
- ✅ Production-grade reliability

Choose which system to use based on your needs.
