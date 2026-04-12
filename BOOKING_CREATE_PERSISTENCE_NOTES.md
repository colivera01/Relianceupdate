# Booking create — persistence and wizard alignment

**Date:** 2026-04-12  
**Source:** `BOOKING_LIVE_DATA_COMPLETION_AUDIT.md` (gaps §4.1–§4.3, §5.1–§5.3).

## 1. Fields collected on wizard submit (`POST /api/bookings`)

| Field | Source in UI | Persistence |
|-------|----------------|-------------|
| `service_id` | Route + loaded service | **Booking** `serviceId` (FK) |
| `vendor_id` | Loaded service | **Booking** `vendorId` (FK) |
| `booking_date` | Date step | **Booking** `scheduledFor` / `date` (combined with time) |
| `booking_time` | Time step | Same |
| `amount` | Catalog `service.price` (wizard sends explicit number) | **Booking** `amount` (Decimal); falls back to DB service price on API if omitted |
| `title` | `service.name` | **Booking** `title` |
| `client_name` | Details: full name | **Booking** `clientName` |
| `user_notes` | Details: special instructions | **`customerMetadata`** JSON (`user_notes`) |
| `client_email` | Details: email | **`customerMetadata`** JSON (`client_email`) |
| `client_phone` | Details: phone | **`customerMetadata`** JSON (`client_phone`) |
| `custom_fields` | Wizard object (`customer_*`, `service_address`) | **`customerMetadata`** JSON (`custom_fields` object) |
| `user_id` | `resolveCustomerUserId` | **Derived / auth** — resolves `Booking.userId` with `getUserIdFromRequest` precedence |

**Not collected as separate POST fields:** payment method, card data (removed from flow).

**Derived on server:** `status` (`PENDING`), slot validation via `checkVendorSlotAvailability`, `userId` resolution from auth + body.

**Deprecated response mirror:** `meta.user_notes`, `meta.client_email`, `meta.client_phone`, `meta.custom_fields` — populated from persisted `customer_metadata` for older clients.

## 2. Design choices (minimal schema)

- **Queryable total:** `Booking.amount` holds the service/catalog total at create (wizard sends `amount`; API still defaults from `Service.price` if absent).
- **Flexible customer extras:** Single nullable **`customerMetadata`** column (**`String` / `NVARCHAR(MAX)`** storing JSON; SQL Server has no Prisma **`Json`** type) with intentional **snake_case** keys: `user_notes`, `client_email`, `client_phone`, `custom_fields`. Avoids many nullable columns while keeping **`amount`** and core FKs queryable.

## 3. Wizard truth

- Final step is **Review & confirm** with an explicit **“No in-app payment yet”** callout; decorative card/PayPal inputs were removed.
- Confirmation page states that **no card/wallet payment** ran in-app and that the total is the **stored service price** on the booking.

## 4. Migration

- `prisma/migrations/20260412120000_booking_customer_metadata/migration.sql` — adds `customerMetadata` to `dbo.bookings` when missing (SQL Server–compatible guard).
