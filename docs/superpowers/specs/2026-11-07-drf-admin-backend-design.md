# Zebella admin backend (DRF) and Firebase removal: design

Status: awaiting review
Date: 2026-11-07

## 1. Goal

Replace Firebase with a Django REST Framework backend as the single source of truth for Zebella, starting with everything the admin panel (`zebelladesign-cms`) needs.

This is phase 1 of 3:

| Phase | Scope | Spec |
|---|---|---|
| 1. Admin backend | This document | Here |
| 2. Storefront read API | Public catalog and content, newsletter sign-up, product events | Separate, later |
| 3. Commerce | Customer accounts, cart, checkout, Razorpay payments and webhooks, emails | Separate, later |

All phases share one Django project, one database and one deployment.

### Decided by the owner

- Build a DRF backend and remove Firebase from the panel.
- The storefront moves to DRF too, in later phases.
- There is no data to migrate. The system starts fresh.
- Host on a single KVM 2 VPS (2 vCPU, 8 GB RAM, 100 GB disk).
- Store files on local disk first, with S3 possible later through configuration.

### Assumptions in the confirmed brief

- Phase 1 covers the admin backend only.
- Cloudinary upload code is removed along with Firebase.
- The backend lives in a new git repo, separate from the panel.
- Staff log in with email and password and receive JWTs.
- Refunds are built now and tested against Razorpay test keys.
- The in-browser demo mode is removed, and sample data moves to a backend seed command.

### Done when

1. Every panel route works against the API, with no Firebase or Cloudinary code or dependency left.
2. Role permissions are enforced by the server and covered by tests.
3. Image and video uploads work, and resize and convert images on the server.
4. The stack runs under Docker Compose with HTTPS, nightly backups and a disk alert, ready to deploy to the VPS.

### Out of scope for phase 1

- Public storefront endpoints, checkout, payment capture and Razorpay webhooks.
- Sending email, including tracking emails and password reset emails.
- Any change to the storefront repo. It stays on Firebase until phases 2 and 3.
- Moving report calculations to the server.

## 2. Architecture

```
Browser (admin panel)
        | HTTPS
        v
      Caddy  ---- static files: panel build, /media/
        |
        v  /api/*
 Gunicorn + Django REST Framework
        |                  |
        v                  v
   PostgreSQL        media/ on disk (S3 later)
```

- **New repo:** `zebelladesign-api`, created next to `zebelladesign-cms`.
- **Stack:** Python 3.12 in Docker (3.11 also works locally), Django 5.2 LTS, DRF, `djangorestframework-simplejwt`, `django-cors-headers`, Pillow, `razorpay`, `django-storages[s3]`, `pytest-django`.
- **Caddy instead of Nginx:** the brief named Nginx. Caddy does the same job and renews HTTPS certificates automatically with less configuration.
- **Database:** PostgreSQL 17 everywhere: local development, tests and production. SQLite isn't supported, and the server refuses to start with any other database, because stock and refund safety depend on row locks.

### Django apps

| App | Owns |
|---|---|
| `accounts` | Custom user (email login), roles, permissions, auth endpoints, customer list |
| `catalog` | Category, Collection, Product, Variant, InventoryMovement, Coupon |
| `orders` | Order, OrderItem, OrderNote, Refund, status transitions, Razorpay client |
| `content` | Banner, Testimonial, homepage and store settings documents, NewsletterSubscriber |
| `audit` | AuditLog and the `record()` helper |
| `uploads` | Upload and delete endpoints, image processing, media path helpers |
| `reports` | Daily stats, ProductEvent |

Views stay thin. Anything that changes stock, orders or refunds lives in a service function that runs in a database transaction and writes its audit entry in the same transaction.

## 3. API conventions

The panel's page logic and calculations should change as little as possible, so the API keeps the data shapes the panel already uses:

- **Base path:** `/api/admin/*` and `/api/auth/*`.
- **Field names:** camelCase at the serializer level, through a small mixin. Keys inside JSON fields such as homepage content are left untouched.
- **Money:** integer paise.
- **Timestamps:** epoch milliseconds, except customer `createdAt` and `lastSignIn`, which stay ISO strings as the panel expects.
- **Day boundaries:** `Asia/Kolkata`.
- **IDs:** strings in JSON. Product, user and coupon IDs are UUIDs, category and collection IDs are their slugs, order IDs look like `ZB-24001`.
- **Lists:** `{ "count": n, "results": [...] }`, with `limit` and `offset` parameters. Each endpoint has a maximum `limit` that fits the panel's current caps: orders 10,000, products 2,000, events 50,000, audit logs 200, newsletter 1,000.
- **Errors:** `{ "message": "...", "errors": { field: [...] } }`. `message` is always a readable sentence, which is what `api.ts` shows in toasts.

## 4. Authentication and permissions

| Endpoint | Behavior |
|---|---|
| `POST /api/auth/login` | Returns `{ token, refresh, user }`. Rate limited to 5 attempts a minute per IP. |
| `POST /api/auth/refresh` | Rotates the refresh token and blacklists the old one. |
| `POST /api/auth/logout` | Blacklists the refresh token. |
| `GET /api/auth/me` | Returns the current user with their role from the database. |

- **Token lifetime:** access 1 hour, refresh 7 days. `api.ts` retries once after a refresh on a 401, and logs out if that fails.
- **Role source:** the database on every request, so role changes take effect immediately.
- **Passwords:** Django's default hashing and password validators.
- **Customers:** share the user table with `role = null`. They can log in but get 403 on every admin endpoint, and the panel shows its No Access page.
- **First administrator:** the `create_admin` management command replaces the `ADMIN_BOOTSTRAP_SECRET` claim form, which is removed from the No Access page.

### Permission matrix

The server uses the same table as `src/lib/permissions.ts`. The panel's copy stays as a UI hint.

| Permission | admin | editor | fulfillment |
|---|---|---|---|
| `content:write` | yes | yes | |
| `catalog:write` | yes | yes | |
| `coupons:write` | yes | yes | |
| `analytics:read` | yes | yes | |
| `orders:read` | yes | yes | yes |
| `orders:fulfil` | yes | | yes |
| `orders:refund` | yes | | |
| `inventory:write` | yes | | yes |
| `customers:read` | yes | | yes |
| `audit:read` | yes | | |
| `roles:manage` | yes | | |

### Panel security fixes

These are removed from `src/lib/auth.tsx` and `src/pages/Login.tsx`:

- Logging in as admin when the backend can't be reached.
- `devLogin` and the dev login button.
- Defaulting a missing or invalid role to `admin`. It becomes no role.
- Falling back to `demo_token` when no token is returned.

The panel also calls `/api/auth/me` on startup, so stored sessions are actually verified.

## 5. Data model

Fields not listed here match the TypeScript interfaces in the panel (`Products.tsx`, `Orders.tsx`, `resources.tsx`, `Content.tsx`, `Settings.tsx`).

- **User:** UUID `id` (`uid` in JSON), `email` (unique), `name`, `role` (nullable: admin, editor, fulfillment), `verified`, `date_joined`, `last_login`.
- **Category:** slug primary key, plus the fields in `resources.tsx`. **Collection** is the same with `featured`. The slug can't change after creation.
- **Product:** UUID id, FK to Category with `PROTECT`, M2M to Collection, unique `slug`, `images` as JSON `[{path, alt}]`, `video_path`, `price` and `sale_price` in paise, `status`, `featured`, `new_arrival`, `best_seller`, `sold_count` (read-only), `seo` JSON, `is_demo`, timestamps.
- **Variant:** FK to Product, `key` (the panel's variant `id`, such as `m-ivory`, unique per product), `sku`, `size`, `color`, `color_hex`, `stock`, `reserved`. It is its own table so a single row can be locked during stock changes.
- **InventoryMovement:** product ID, variant key, `delta`, `reason`, optional `order_id`, `actor`, `created_at`. Variant and order references are plain values so history survives deletions.
- **Coupon:** the fields in `resources.tsx`, unique `code`, `product_ids` and `collection_ids` as JSON arrays, `used_count` (read-only).
- **Order:** string primary key, nullable FK to User, `email`, `phone`, `shipping_address` JSON, paise totals, `coupon_code`, `payment_mode`, `payment_status`, `fulfillment_status`, `provider_order_id`, `provider_payment_id`, `paid_at`, `tracking` JSON, `cancel_reason`, `is_demo`, timestamps. Indexed on `created_at`, `fulfillment_status` and `user`.
- **OrderItem:** FK to Order, nullable FK to Product with `SET_NULL`, variant key, and name, SKU, image, size, color and price snapshots, so past orders never change when a product does.
- **OrderNote:** text, author email, time.
- **Refund:** FK to Order, `provider_refund_id`, `amount`, `status`, `reason`, `actor`, time. The API returns a single `refund` object on an order: the summed amount and the latest status.
- **Banner, Testimonial:** the fields in `resources.tsx`.
- **ContentDocument:** `key` primary key (`homepage`, `store_settings`), `data` JSON, `updated_at`. These two documents are deeply nested and only ever read and written whole, so JSON fits better than dozens of tables. Phase 2 reads the same documents.
- **NewsletterSubscriber:** `email`, `source`, `created_at`. Read-only in phase 1.
- **ProductEvent:** `product_id`, `name`, `type`, `created_at`, indexed on `created_at`. Read-only in phase 1.
- **AuditLog:** `actor`, `actor_email`, `action`, `target`, `detail` JSON, `created_at`. The API has no way to change or delete entries.

There is no `statsDaily` table. Daily stats are calculated from orders, so they can't drift out of step with them.

## 6. Endpoints

| Method and path | Permission | Notes |
|---|---|---|
| `GET /products`, `GET /products/:id` | any staff | Inventory and Dashboard need products for all roles |
| `POST /products`, `PUT /products/:id`, `PATCH /products/:id` | `catalog:write` | See rules below |
| `GET /categories`, `GET /collections` | any staff | The product editor and reports need these |
| `POST`, `PUT`, `DELETE` on `/categories`, `/collections` | `catalog:write` | Deleting a category still in use returns 409 |
| CRUD `/banners`, `/testimonials` | `content:write` | |
| CRUD `/coupons` | `coupons:write` | `usedCount` is read-only |
| `GET`, `PUT /content/homepage`, `/content/settings` | `content:write` | Replaces the whole document |
| `POST /inventory` | `inventory:write` | Body: `productId`, `variantId`, `delta`, `reason` |
| `GET /inventory/movements?productId=` | `inventory:write` | Newest first |
| `GET /orders?fulfillmentStatus=&userId=&from=&to=` | `orders:read` | Newest first. Dashboard counts use `count` with `limit=1` |
| `GET /orders/:id` | `orders:read` | |
| `PATCH /orders/:id` | `orders:fulfil` | `action`: `status`, `note` or `tracking`, as the panel sends today |
| `POST /orders/:id/refund` | `orders:refund` | Body: `amount` in paise, `reason` |
| `GET /users?q=` | `customers:read` | Response is `{ users: [...] }`, as the panel expects |
| `POST /users` | `roles:manage` | Body: `uid`, `role` |
| `GET /stats/daily?days=` | `analytics:read` | Same shape as `DayStat` |
| `GET /events?from=&to=` | `analytics:read` | |
| `GET /newsletter` | `roles:manage` | |
| `GET /audit-logs` | `audit:read` | |
| `POST /uploads`, `DELETE /uploads?path=` | `catalog:write` or `content:write` | See section 8 |

All paths are under `/api/admin`.

## 7. Business rules

These move from the browser, or from the storefront's endpoints, to the server.

**Products**
- Validation matches the editor: a name, an SKU, a category, a price above zero, a sale price below the regular price, at least one variant, and at least one image before publishing.
- The server generates the slug if it's blank and rejects duplicates.
- On create, stock is accepted and an `initial stock` movement is logged for each variant with stock.
- On update, `stock`, `reserved` and `soldCount` from the request are ignored, so a stale form can't overwrite live numbers. New variants start at zero stock.
- Removing a variant with `reserved > 0` is rejected.

**Inventory**
- Adjustments lock the variant row with `select_for_update`, and the result must not fall below `reserved`.
- Each adjustment writes a movement and an audit entry in the same transaction.

**Order status**

| From | Allowed next |
|---|---|
| `awaiting_payment` | `cancelled` |
| `processing` | `packed`, `cancelled` |
| `packed` | `shipped`, `cancelled` |
| `shipped` | `delivered` |
| `delivered`, `cancelled` | none |

- Any move other than to `cancelled` requires `paymentStatus = paid`.
- Cancelling an `awaiting_payment` order releases its `reserved` stock.
- Cancelling a later order adds its stock back and logs a movement.
- Cancelling a paid order sets `paymentStatus` to `refund_pending`.
- Saving tracking on a `packed` order moves it to `shipped`.

**Refunds**
- Allowed only when `paymentStatus` is `paid` or `refund_pending`.
- The order row is locked, and the amount must not exceed the total minus earlier refunds.
- The call to Razorpay uses a stable idempotency key, so a retry can't refund twice.
- `paymentStatus` becomes `refunded` only when Razorpay reports the refund as processed and the full total has been refunded. Otherwise a pending refund is recorded and the status stays as it was.
- With no webhook until phase 3, `GET /orders/:id` asks Razorpay for the latest status of any pending refund and saves the result. If Razorpay can't be reached, the order still loads with the last known status. List endpoints never call Razorpay.
- `PAYMENTS_BACKEND` is `razorpay` or `fake`. `fake` exists for local work with seeded orders, and the server refuses to start with it when `DEBUG` is off.
- If Razorpay keys are missing, the endpoint returns a clear 503 and changes nothing.

**Users**
- An admin can't remove their own role, and the last admin can't be removed.

**Audit**
- The server writes audit entries for every create, update, delete, status change, stock change, refund and role change. Existing action names are kept, such as `product.update` and `settings.store.update`. `src/lib/audit.ts` is deleted.

**Daily stats**
- Calculated from orders where `paymentStatus = paid` and `fulfillmentStatus != cancelled`, matching `isSale` in the panel and the sample data. Refunds are not netted out, matching `stats.ts`.

## 8. File storage

- **Upload:** `POST /api/admin/uploads` takes multipart `file`, `folder` and `kind` (`image` or `video`), and returns `{ url, path }`, the same shape as today's `Img`.
- **Folders:** must start with a prefix the panel uses today (`products/`, `categories/`, `collections/`, `content/`). `..` and absolute paths are rejected.
- **Images:** JPG, PNG, WebP or AVIF, up to 8 MB, verified by opening them with Pillow rather than trusting the file type. SVG is rejected. The server strips metadata, limits the longest edge to 2000 px and saves as WebP.
- **Videos:** MP4 or WebM, up to 50 MB, checked by file signature and stored unchanged.
- **Names:** generated by the server (`<folder>/<uuid>.<ext>`), never taken from the upload.
- **Paths, not URLs:** the database stores paths. Serializers accept either a URL or a path on write and return full URLs on read. For the JSON documents, the same conversion runs on values whose key is `imageUrl` or `mobileImageUrl`, and on `images[].url`. External URLs pass through unchanged. This keeps the panel's forms unchanged and means moving to S3 touches no data.
- **Switching to S3:** `STORAGE_BACKEND=s3` plus bucket settings selects `django-storages`. The local default is fully tested. The S3 branch can't be verified end to end until a bucket exists, so the switch includes one upload check.
- **Serving:** Caddy serves `/media/` with `X-Content-Type-Options: nosniff`.

## 9. Panel changes

**Removed**
- `src/lib/firebase.ts`, `src/lib/audit.ts`, `src/lib/demo/`, `src/demo-env.d.ts`.
- The `__DEMO__` define and aliases in `vite.config.ts`, and `DemoBar` in `App.tsx`.
- The `firebase` dependency, and Cloudinary code and variables.
- `revalidateStorefront` and its calls. The storefront isn't using this API yet, and phase 2 will trigger refreshes from the server.
- Sample images in `public/demo/` move to the backend repo. Any still used by the login page or UI stay.
- The storage-specific error messages in `ImageUploader.tsx`, and the promise of a customer email in the tracking toast.

**Changed**

| File | Change |
|---|---|
| `src/lib/api.ts` | Uses `VITE_API_BASE_URL` only, adds token refresh, and supports multipart uploads |
| `src/lib/auth.tsx` | Fixes from section 4 |
| `src/lib/hooks.ts` | `useDocs` becomes `useList(path, params)` with the same loading, error and reload behavior |
| `src/components/ResourceManager.tsx`, `DocEditor.tsx` | Call REST endpoints. `collection` becomes `endpoint` in each config |
| `src/components/ImageUploader.tsx` | `uploadFile` and `removeFile` call `/uploads` |
| `src/pages/Products.tsx` | Calls the API. Slug checks and stock preservation move to the server. The upload folder uses a browser-generated UUID |
| `Orders`, `Inventory`, `Customers`, `Dashboard`, `Misc` pages | Firestore reads become API reads |
| `src/lib/stats.ts`, `src/lib/reports.ts` | Fetch from the API. All calculations stay in the browser. The `sample` flag is removed |
| `src/pages/Login.tsx` | Removes the dev login button and the bootstrap form |
| `.env.example` | Only `VITE_API_BASE_URL` remains |

The local `.env` is left for the owner to clean up. Its old values stop being used.

## 10. Sample data

`python manage.py seed_demo` ports `src/lib/demo/seed.ts` and `specs.ts` to Python:

- The products, categories, collections, coupons, content, customers, orders, movements, events, newsletter and audit data the panel uses today, marked `is_demo` where the model allows it.
- Three staff users (admin, editor, fulfillment), with passwords passed to the command or generated and written to a local git-ignored file.
- Sample images copied into `media/`.

It uses a fixed random seed and refuses to run when `DEBUG` is off unless `--force` is passed. Event volume is reduced from 14,000 to about 3,000, which is enough to exercise the reports.

## 11. Deployment

Files live in `zebelladesign-api/deploy/`:

- `docker-compose.yml` with `db`, `api` and `caddy`, plus named volumes for the database and media.
- A `Caddyfile` with automatic HTTPS. It sets the upload size limit to 60 MB.
- `deploy.sh`, which pulls the code, builds the images, runs migrations and restarts. The panel's static build is placed in a directory Caddy serves.
- `backup.sh`, run nightly by cron: `pg_dump` plus media, sent off the server with `rclone` to a remote set in configuration, keeping 14 days.
- `disk_alert.sh`, run by cron: posts to `ALERT_WEBHOOK_URL` when disk use passes 80%.
- `DEPLOY.md` with step-by-step instructions, including SSH key setup.

Production settings: `DEBUG=False`, secrets from environment variables only, `ALLOWED_HOSTS`, CORS limited to the panel's origin, secure proxy headers and HSTS.

**Needed from the owner at deployment:** a domain name, SSH access by key, an off-site backup destination, an alert webhook, and Razorpay test keys. None of these block building or local testing.

## 12. Error handling

- Failed validation returns 400, permission failures 403, a missing record 404, a conflict such as deleting a category in use 409, and login throttling 429, all in the error format from section 3.
- A Razorpay error returns 502 with its message and records no refund.
- Unexpected errors return a generic 500 message and are logged to stdout, so `docker compose logs` shows them.

## 13. Testing

**Backend (`pytest-django`)**
- A permission matrix test covering every endpoint against every role, plus logged-out and customer users. This is the main guarantee that enforcement moved to the server.
- Auth: login, wrong password, throttling, refresh rotation, logout blacklisting, role change taking effect immediately.
- Business rules: all of section 7, including that stale forms can't overwrite stock, every order transition, and stock restoration on cancel.
- Refunds with a mocked Razorpay client: full, partial, over-limit, double submit, and gateway error.
- Uploads: valid files, a fake image with a valid extension, SVG, oversize, path traversal, and URL and path conversion.
- Concurrency: two simultaneous stock adjustments and two simultaneous refunds. The whole suite runs on PostgreSQL.
- `seed_demo` runs cleanly on an empty database.

**Panel**
- `npm run build` and `npm run lint` pass.
- A search of `src` and `package.json` finds no `firebase`, `cloudinary` or `__DEMO__`.
- A browser walkthrough against the seeded API, covering every route as admin and spot checks as editor and fulfillment, including creating a product with an image upload, adjusting stock, moving an order through its statuses, a refund on the fake backend, and role changes.

**Deployment**
- `docker compose up` works locally, and a login and an upload succeed through Caddy on the local machine. The real VPS deployment happens with the owner.

## 14. Known limitations

- Reports load up to 10,000 orders and all matching events into the browser, as they do today. This is fine at launch and can move to the server when volume requires it.
- Tokens stay in `localStorage`, as they do today. The 1-hour access token limits the exposure, but a cross-site scripting bug could still steal a session.
- The panel and the storefront use different data until phases 2 and 3, so panel changes won't appear on the live storefront during that time. Firebase can't be shut down until then.
- Refund status relies on the page re-check until the phase 3 webhook exists.
