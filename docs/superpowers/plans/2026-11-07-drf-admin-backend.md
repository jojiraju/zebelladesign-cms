# Zebella Admin Backend (DRF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Django REST Framework backend for the Zebella admin panel, move every panel page onto it, and remove Firebase, Cloudinary and the in-browser demo mode.

**Architecture:** One Django project with focused apps, one PostgreSQL database and local file storage switchable to S3, served behind Caddy in Docker Compose. The API keeps the data shapes the panel already uses (camelCase, paise, epoch ms), so page logic and report calculations stay as they are.

**Tech Stack:** Python 3.12 (3.11 locally), Django 5.2 LTS, DRF, djangorestframework-simplejwt, django-cors-headers, Pillow, razorpay, django-storages[s3], pytest-django, PostgreSQL 16, Caddy 2, React 19, Vite.

**Spec:** `docs/superpowers/specs/2026-11-07-drf-admin-backend-design.md` (read it with this plan; it defines the data model, endpoints and business rules, and tasks refer to it by section)

## Global Constraints

- New backend repo: `C:\Users\Lenovo\OneDrive\Desktop\Zebella designs\zebelladesign-api`, with its own `git init`. Nothing gets pushed to any remote.
- Panel work happens on a new branch, `feature/drf-admin-api`, in `zebelladesign-cms`.
- All API JSON: camelCase top-level fields, money in integer paise, timestamps in epoch ms (customer `createdAt` and `lastSignIn` stay ISO strings), string IDs.
- Day boundaries: `Asia/Kolkata`. `TIME_ZONE = "Asia/Kolkata"`, `USE_TZ = True`.
- Lists: `{ "count", "results" }` with `limit` and `offset`. Exception: `GET /users` returns `{ "users": [...] }`.
- Errors: `{ "message": "...", "errors": {...} }`. `message` is always a readable sentence.
- Access token 1 hour, refresh token 7 days with rotation and blacklist. Login limited to 5 attempts a minute per IP.
- Images: JPG, PNG, WebP, AVIF, max 8 MB, longest edge 2000 px, stored as WebP. Videos: MP4, WebM, max 50 MB.
- Upload folder prefixes: `products/`, `categories/`, `collections/`, `content/`.
- `PAYMENTS_BACKEND=fake` must refuse to start when `DEBUG` is off.
- No secrets in git. Real Razorpay keys are never used in tests.
- The panel has no test framework and this plan doesn't add one. Panel tasks verify with `npm run build`, `npm run lint` and a browser walkthrough against the seeded API.

## Review Focus

1. **Parallel requests when the access token expires.** The Dashboard fires several requests at once. With refresh rotation, two simultaneous refreshes would blacklist each other and log the user out. They must share one refresh. Pinned in Task 12.
2. **Corrupt, empty or extremely large-dimension images.** A zero-byte file, a renamed text file or a decompression bomb must return a readable 400, never a 500. Pinned in Task 4.
3. **Blank, zero, negative or decimal refund amounts.** Each must return 400 with nothing sent to Razorpay. Pinned in Task 8.
4. **An order placed at 00:30 IST.** That is the previous day in UTC, and it must count toward the IST day in daily stats. Pinned in Task 10.
5. **Saving a form twice without changing images.** A URL returned by the API and sent back must not gain a double prefix, and external URLs and empty strings must survive unchanged. Pinned in Task 4.

---

## Part A: Backend

Run all backend commands from `zebelladesign-api` using `.venv/Scripts/python`.

### Task 1: Project scaffold and API conventions

**Files:**
- Create: `requirements.txt`, `requirements-dev.txt`, `manage.py`, `config/{settings,urls,wsgi}.py`, `pytest.ini`, `.gitignore`, `.env.example`, `README.md`
- Create: `core/{serializers,pagination,exceptions,views,urls}.py`
- Test: `tests/test_conventions.py`, `tests/test_settings.py`

**Interfaces:**
- Produces: `core.serializers.CamelModelSerializer` (ModelSerializer that converts top-level field names both ways and leaves JSON values untouched), `core.serializers.EpochMsField` (DateTimeField to and from epoch ms, nullable), `core.pagination.capped(max_limit: int) -> type[LimitOffsetPagination]` (default limit equals the cap), `core.exceptions.api_exception_handler`, `GET /api/health` returning `{"ok": true}`.
- Settings env vars: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ORIGINS`, `DATABASE_URL` (SQLite default), `MEDIA_ROOT`, `MEDIA_BASE_URL`, `STORAGE_BACKEND`, `PAYMENTS_BACKEND`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, plus the S3 settings.

- [ ] **Step 1:** Run `git init`, create `.venv`, and install pinned requirements.
- [ ] **Step 2: Write failing tests:** `test_camel_top_level_only` (`seo_title` becomes `seoTitle`, but a JSON value `{"some_key": 1}` is unchanged, and `seoTitle` in input maps to `seo_title`); `test_epoch_ms_round_trip`; `test_epoch_ms_null`; `test_validation_error_shape` (400 body has a sentence in `message` and field errors in `errors`); `test_404_shape`; `test_pagination_cap` (`limit=999999` is clamped); `test_health`; `test_fake_payments_refused_without_debug` (settings validation raises `ImproperlyConfigured`); `test_production_settings_require_secret_key`.
- [ ] **Step 3:** Run `.venv/Scripts/python -m pytest tests/test_conventions.py tests/test_settings.py -v`. Expected: FAIL.
- [ ] **Step 4:** Implement the interfaces above. `settings.py` selects `STORAGES["default"]` from `STORAGE_BACKEND` (`local` or `s3`), and sets security headers and HSTS when `DEBUG` is off.
- [ ] **Step 5:** Re-run. Expected: PASS.
- [ ] **Step 6:** Commit: `feat: scaffold Django project and API conventions`.

### Task 2: Accounts, roles and authentication

**Files:**
- Create: `accounts/{models,permissions,serializers,views,urls,admin}.py`, `accounts/management/commands/create_admin.py`
- Test: `tests/test_auth.py`, `tests/test_users.py`, `tests/factories.py`, `tests/conftest.py`

**Interfaces:**
- Produces: `accounts.models.User` (UUID `id`, unique `email` stored lowercase, `name`, nullable `role`, `verified`); `accounts.permissions.ROLE_PERMISSIONS`; `can(role: str | None, perm: str) -> bool`; `HasPerm(*perms: str)` (factory returning a DRF permission class, any listed permission passes); `IsStaffRole`.
- Fixtures in `tests/conftest.py`, used by later tasks: `api_as(role: str | None) -> APIClient`, `make_user(role=None, **kw) -> User`.

- [ ] **Step 1: Write failing tests:** login returns `token`, `refresh` and `user` with `uid`, `email`, `name`, `role`; wrong password returns 401 with `message`; `Admin@X.com` logs in the account `admin@x.com`; login updates `last_login`; the sixth attempt in a minute returns 429; refresh rotates, and the old refresh token then fails; logout blacklists; `/me` returns the live role after a role change without a new login; a customer can log in but gets 403 from an admin endpoint; `GET /users?q=` matches on email or name and returns `{users: [...]}` capped at 2000, each with `uid`, `email`, `name`, `verified`, `createdAt`, `lastSignIn` and `role`; `POST /users` changes the role and writes no password; an admin removing their own role gets 400; removing the last admin gets 400; `create_admin` creates a user with role `admin`.
- [ ] **Step 2:** Run `.venv/Scripts/python -m pytest tests/test_auth.py tests/test_users.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implement, with `AUTH_USER_MODEL = "accounts.User"` set before the first migration. The `ROLE_PERMISSIONS` values are copied from spec section 4.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add users, roles and JWT authentication`.

### Task 3: Audit log

**Files:**
- Create: `audit/{models,service,serializers,views,urls}.py`
- Modify: `accounts/views.py` (audit role changes)
- Test: `tests/test_audit.py`

**Interfaces:**
- Produces: `audit.service.record(actor: User, action: str, target: str, detail: dict | None = None) -> None`. Call it inside the caller's transaction, so a rollback removes the entry too. `GET /api/admin/audit-logs`, newest first, cap 200, JSON fields `actor`, `actorEmail`, `action`, `target`, `detail`, `createdAt`.

- [ ] **Step 1: Write failing tests:** `record` stores actor ID and email; an exception after `record` inside `transaction.atomic` leaves no row; a list is newest first; `POST`, `PUT`, `PATCH` and `DELETE` return 405; a role change writes an `AuditLog`.
- [ ] **Step 2:** Run `.venv/Scripts/python -m pytest tests/test_audit.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implement, using a read-only view with permission `audit:read`.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add append-only audit log`.

### Task 4: Uploads and media references

**Files:**
- Create: `uploads/{refs,processing,views,urls}.py`
- Test: `tests/test_uploads.py`, `tests/test_refs.py`

**Interfaces:**
- Produces: `uploads.refs.to_path(value: str) -> str` (strips the media base URL, returns external URLs and `""` unchanged); `to_url(value: str) -> str` (adds the base only to relative paths, idempotent); `doc_to_paths(data) -> data` and `doc_to_urls(data) -> data` (recursive, touching only keys `imageUrl`, `mobileImageUrl`, `desktopImage`, `mobileImage`, and `url` inside `images`); `uploads.refs.MediaRefField` (serializer field applying these).
- Produces: `uploads.processing.process_image(file) -> ContentFile`, `check_video(file) -> str` (returns the extension). Both raise `ValidationError`.
- Endpoints: `POST /api/admin/uploads`, `DELETE /api/admin/uploads?path=`.

- [ ] **Step 1: Write failing tests (refs):** `to_url(to_path(to_url(p))) == to_url(p)`; saving an API response back twice leaves a single prefix; external `https://…` URLs are unchanged both ways; `""` stays `""`; `doc_to_paths` handles nested `hero.imageUrl` and `featuredCollections[].imageUrl`, and leaves other string keys that merely contain the base URL alone.
- [ ] **Step 2: Write failing tests (uploads):** a PNG comes back as `{url, path}` with a `.webp` path and an image with longest edge at most 2000 px and no EXIF; a stored name ignores the client filename; a zero-byte file, a text file named `.jpg`, an SVG, a 9 MB file and a decompression-bomb image each return 400 with `message` (bomb test: set `Image.MAX_IMAGE_PIXELS` low, and convert `DecompressionBombError` and `Warning` to a `ValidationError`); an MP4 signature passes with `kind=video`; a 51 MB video returns 400; a folder of `../x`, `/etc` or `secrets/x` returns 400; `DELETE` removes a file, a missing file returns 200, and `path=../settings.py` returns 400; fulfillment gets 403; editor gets 201.
- [ ] **Step 3:** Run `.venv/Scripts/python -m pytest tests/test_uploads.py tests/test_refs.py -v`. Expected: FAIL.
- [ ] **Step 4:** Implement, using `default_storage` only, so the S3 switch works without code changes. Permission: `HasPerm("catalog:write", "content:write")`. Accepted prefixes come from Global Constraints.
- [ ] **Step 5:** Re-run. Expected: PASS.
- [ ] **Step 6:** Commit: `feat: add file uploads with image processing`.

### Task 5: Categories, collections and coupons

**Files:**
- Create: `catalog/{models,serializers,views,urls}.py` (Category, Collection, Coupon first)
- Test: `tests/test_catalog_taxonomy.py`, `tests/test_coupons.py`

**Interfaces:**
- Consumes: `CamelModelSerializer`, `EpochMsField`, `MediaRefField`, `HasPerm`, `IsStaffRole`, `record`.
- Produces: `catalog.models.Category`, `Collection`, `Coupon`. `GET` requires `IsStaffRole`, writes require `catalog:write`. Coupons require `coupons:write` for all methods. Audit action names: `categories.create`, `categories.update`, `categories.delete`, and likewise for `collections` and `coupons`.

- [ ] **Step 1: Write failing tests:** `POST /categories` with slug `festive` returns `id == "festive"`; a duplicate returns 400 with `"festive" already exists` in `message`; `PATCH` with a different slug returns 400, while the same slug passes (the panel's form always sends it); `imageUrl` round-trips as a URL while the database holds a path; collections add `featured`; a coupon with `usedCount: 99` in `POST` stores 0; `PATCH` can't change `usedCount`; a duplicate coupon `code` returns 400; `productIds` round-trips as a list; blank `minOrder` as `null` is accepted; `startsAt` round-trips in ms; each write creates an audit row with the right action; list order follows the `order` field.
- [ ] **Step 2:** Run `.venv/Scripts/python -m pytest tests/test_catalog_taxonomy.py tests/test_coupons.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implement. Trim strings and uppercase coupon `code` on the server too.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add categories, collections and coupons`.

### Task 6: Products, variants and inventory

**Files:**
- Modify: `catalog/{models,serializers,views,urls}.py`
- Create: `catalog/services.py`
- Test: `tests/test_products.py`, `tests/test_inventory.py`, `tests/test_concurrency.py`

**Interfaces:**
- Produces: `catalog.models.Product`, `Variant`, `InventoryMovement`.
- Produces: `catalog.services.create_product(actor, data) -> Product`; `update_product(actor, product, data) -> Product`; `adjust_stock(actor, product_id: str, variant_key: str, delta: int, reason: str, order_id: str | None = None, audit: bool = True) -> Variant` (locks the row; used by Task 7).
- JSON: variants as `{id, sku, size, color, colorHex, stock, reserved}`, where `id` is the variant key. `images` as `[{url, path, alt}]`. `categoryId`, `categorySlug` (read from the FK), `collectionIds`, `videoUrl`, `soldCount`, `seo`, `isDemo`.

- [ ] **Step 1: Write failing tests (products):** each validation from spec section 7 returns 400 with a readable `message` (no name, no SKU, no category, price 0, sale price at or above price, no variants, publishing with no images); a blank slug is generated from the name; a duplicate slug's `message` contains the slug; create with `stock: 5` writes an `initial stock` movement with `delta 5`, and stock 0 writes none; `PUT` with changed `stock`, `reserved` and `soldCount` leaves them unchanged; `PUT` with a new variant starts it at stock 0 even if the body says 50; `PUT` removing a variant with `reserved > 0` returns 400; `PATCH {status}` works and writes audit action `product.status`; deleting a category in use returns 409; `?limit=2000` is allowed.
- [ ] **Step 2: Write failing tests (inventory):** `POST /inventory` with `delta: 5` adds stock and writes a movement with `actor` and an audit row `inventory.adjust`; a result below `reserved` returns 400 and changes nothing; an unknown product or variant returns 404; `reason` under 2 characters returns 400; `delta: 0` returns 400; `GET /inventory/movements?productId=` is newest first and scoped to that product. Mark `test_concurrency.py` as `@pytest.mark.postgres`: two threads each adjusting `-3` on stock 5 with `reserved 0` give one success and one 400, ending at stock 2.
- [ ] **Step 3:** Run `.venv/Scripts/python -m pytest tests/test_products.py tests/test_inventory.py -v`. Expected: FAIL.
- [ ] **Step 4:** Implement with `transaction.atomic` and `select_for_update`. Permissions per spec section 6.
- [ ] **Step 5:** Re-run. Expected: PASS.
- [ ] **Step 6:** Commit: `feat: add products, variants and stock adjustments`.

### Task 7: Orders and fulfillment

**Files:**
- Create: `orders/{models,serializers,services,views,urls}.py`
- Test: `tests/test_orders.py`

**Interfaces:**
- Consumes: `catalog.services.adjust_stock`, `record`.
- Produces: `orders.models.Order`, `OrderItem`, `OrderNote`, `Refund`. `orders.services.change_status(actor, order_id, status) -> Order`; `add_note(actor, order_id, text) -> Order`; `save_tracking(actor, order_id, carrier, tracking_number, url="") -> Order`. JSON matches the `Order` interface in `Orders.tsx`, including `items`, `notes` (`{text, by, at}`), `tracking.shippedAt` and `refund`.
- Filters: `fulfillmentStatus`, `userId`, `from`, `to` (ms). Newest first. Cap 10,000. `prefetch_related` items and notes, with a test limiting the query count so list size doesn't change the number of queries.

- [ ] **Step 1: Write failing tests:** parametrize every (from, to) pair against the spec section 7 table, asserting 200 or 400; a non-cancel move on an unpaid order returns 400; cancelling `awaiting_payment` lowers `reserved` and leaves `stock`; cancelling `processing` raises `stock` and writes a movement with `order_id`; cancelling a paid order sets `refund_pending` and `cancelReason`; cancelling an already cancelled order returns 400 and doesn't restore stock twice; `action: note` stores `by` as the actor's email; a blank note returns 400; tracking on `packed` moves to `shipped` and sets `shippedAt`; tracking on `processing` saves without changing status; tracking on an unpaid order returns 400; each action writes an audit row (`order.status`, `order.note`, `order.tracking`); filters work; a deleted product leaves its order item snapshot intact.
- [ ] **Step 2:** Run `.venv/Scripts/python -m pytest tests/test_orders.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implement with the order row locked during changes. The transition table lives only in `orders/services.py`.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add orders and fulfillment actions`.

### Task 8: Refunds and the payment gateway

**Files:**
- Create: `orders/gateway.py`
- Modify: `orders/services.py`, `orders/views.py`, `orders/urls.py`, `orders/serializers.py`
- Test: `tests/test_refunds.py`, `tests/test_concurrency.py`

**Interfaces:**
- Produces: `orders.gateway.RefundResult(id: str, status: str, amount: int)`; `GatewayError`; `GatewayNotConfigured`; `get_gateway()`, returning `RazorpayGateway` or `FakeGateway`, each with `refund(payment_id: str, amount: int, idempotency_key: str, notes: dict) -> RefundResult` and `fetch_refund(payment_id: str, refund_id: str) -> RefundResult`.
- Produces: `orders.services.issue_refund(actor, order_id, amount: int, reason: str) -> Order`; `sync_pending_refunds(order) -> Order` (never raises on gateway errors).
- The idempotency key is a hash of (order ID, amount, count of earlier refunds), passed to Razorpay as the `X-Refund-Idempotency` header.

- [ ] **Step 1: Write failing tests (gateway mocked):** `amount` of blank, missing, `0`, `-100`, `10.5` or `"abc"` each returns 400 and the gateway isn't called; above the remaining amount returns 400 and the gateway isn't called; a full refund with `processed` sets `paymentStatus = refunded`; a partial refund leaves `paid` and `refund.amount` shows the sum; two partials adding up to the total end as `refunded`; a `pending` result leaves `paymentStatus` as it was and stores the refund; `GatewayError` returns 502 with its message and stores no refund; `GatewayNotConfigured` returns 503 and changes nothing; an unpaid order returns 400; a retry after a gateway timeout sends the same idempotency key; `GET /orders/:id` updates a pending refund to processed; `GET /orders/:id` still returns 200 when `fetch_refund` raises; `GET /orders` never calls the gateway; `refund` writes audit `order.refund`; editor and fulfillment get 403. Add `@pytest.mark.postgres`: two simultaneous full refunds give exactly one success.
- [ ] **Step 2:** Run `.venv/Scripts/python -m pytest tests/test_refunds.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implement. Hold the order lock across the gateway call, so a second refund waits and then sees the first one.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add refunds through Razorpay`.

### Task 9: Banners, testimonials, content documents and newsletter

**Files:**
- Create: `content/{models,serializers,views,urls}.py`
- Test: `tests/test_content.py`

**Interfaces:**
- Consumes: `doc_to_paths`, `doc_to_urls`, `MediaRefField`.
- Produces: `content.models.Banner`, `Testimonial`, `ContentDocument`, `NewsletterSubscriber`. Endpoints per spec section 6. `/content/homepage` uses document key `homepage`, `/content/settings` uses `store_settings`.

- [ ] **Step 1: Write failing tests:** `GET` of an empty document returns `{}` with 200, so the panel's defaults apply; `PUT` then `GET` returns the same structure with image URLs resolved and the database holding paths; a non-object body returns 400; audit actions are exactly `homepageContent.main.update` and `settings.store.update`; banner CRUD with `startsAt: null` works; `desktopImage` round-trips; testimonial `verified` defaults to false; `GET /newsletter` is newest first with cap 1000, and `POST` returns 405.
- [ ] **Step 2:** Run `.venv/Scripts/python -m pytest tests/test_content.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implement. Permissions: `content:write`, and `roles:manage` for newsletter.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add content, banners, testimonials and newsletter`.

### Task 10: Daily stats, events, and the permission matrix

**Files:**
- Create: `reports/{models,services,views,urls}.py`
- Test: `tests/test_reports.py`, `tests/test_permission_matrix.py`

**Interfaces:**
- Produces: `reports.models.ProductEvent`; `reports.services.daily_stats(days: int) -> list[dict]`, shaped like `DayStat` in `src/lib/stats.ts` (`day`, `orders`, `revenue`, `discount`, `products`, `categories`), oldest first, containing only days with sales.
- Endpoints: `GET /stats/daily?days=`, `GET /events?from=&to=` (cap 50,000).

- [ ] **Step 1: Write failing tests (reports):** an order created at `2026-11-07T19:00:00Z` (00:30 IST on 8 November) counts under `2026-11-08`; failed, pending, refunded and cancelled orders are excluded; `products[id]` and `categories[slug]` carry `qty` and `revenue`; `days=30` excludes older orders; an order whose product was deleted is still counted and doesn't crash; events filter by `from` and `to`.
- [ ] **Step 2: Write failing test (matrix):** a table of (method, path, permission) covering every route in spec section 6 and every role plus anonymous and customer, asserting 401 for anonymous, 403 where the role lacks the permission, and not 401 or 403 otherwise. Add `test_every_admin_route_is_in_the_matrix`, which walks the URL resolver and fails if any `/api/admin/` route is missing from the table.
- [ ] **Step 3:** Run `.venv/Scripts/python -m pytest tests/test_reports.py tests/test_permission_matrix.py -v`. Expected: FAIL.
- [ ] **Step 4:** Implement `reports`, and fix any permission gaps the matrix finds.
- [ ] **Step 5:** Run the whole suite: `.venv/Scripts/python -m pytest -m "not postgres" -v`. Expected: all PASS.
- [ ] **Step 6:** Commit: `feat: add stats, events and permission matrix tests`.

### Task 11: Seed data and deployment

**Files:**
- Create: `core/management/commands/seed_demo.py`, `core/seed/{specs,policies,build}.py`, `seed_assets/` (copied from the panel's `public/demo/`)
- Create: `Dockerfile`, `deploy/{docker-compose.yml,docker-compose.test.yml,Caddyfile,deploy.sh,backup.sh,disk_alert.sh,DEPLOY.md}`
- Test: `tests/test_seed.py`

**Interfaces:**
- Consumes: all models.
- Produces: `python manage.py seed_demo [--password P] [--force]`. Staff emails: `admin@zebelladesigns.example`, `content@zebelladesigns.example`, `dispatch@zebelladesigns.example`. If no password is given, one is generated and written to the git-ignored `.seed-credentials`.

- [ ] **Step 1: Write failing tests:** the command runs on an empty database and produces all three staff roles, at least one order in each fulfillment status, at least 3,000 events and a `store_settings` document; running it twice doesn't create duplicates or fail (it clears `is_demo` data first); it refuses when `DEBUG` is off without `--force`; passwords don't appear in stdout when `--password` is given; `daily_stats(30)` returns data.
- [ ] **Step 2:** Run `.venv/Scripts/python -m pytest tests/test_seed.py -v`. Expected: FAIL.
- [ ] **Step 3:** Port `src/lib/demo/seed.ts`, `specs.ts` and `policies.ts` to Python using `random.Random(20261105)`. Exact generated values needn't match the TypeScript. Reduce events from 14,000 to 3,000.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Write the Docker and deploy files per spec section 11. `Caddyfile` takes `ADMIN_DOMAIN` and `API_DOMAIN`, using `tls internal` when `LOCAL_TLS=1`.
- [ ] **Step 6:** Run the PostgreSQL tests: `docker compose -f deploy/docker-compose.test.yml up -d`, then with `DATABASE_URL` set to that database, run `.venv/Scripts/python -m pytest -m postgres -v`. Expected: PASS, including both concurrency tests.
- [ ] **Step 7:** Run `docker compose -f deploy/docker-compose.yml up -d --build` with `LOCAL_TLS=1`, run migrations and `seed_demo`, then use `curl -k` through Caddy to log in and to upload an image, and fetch that image back from `/media/`. Expected: 200 on all three, and the image response has `X-Content-Type-Options: nosniff`.
- [ ] **Step 8:** Run `backup.sh` with a local `rclone` remote and restore the dump into a scratch database. Run `disk_alert.sh` with a threshold of 0 against a local test listener. Expected: the restored database has the same order count, and the alert arrives.
- [ ] **Step 9:** Commit: `feat: add demo seed and Docker deployment`.

## Part B: Panel

Run these from `zebelladesign-cms`. For each browser check, run the API with `manage.py runserver` on port 8000 with `seed_demo` loaded, and the panel with `npm run dev`.

### Task 12: API client, auth and login

**Files:**
- Modify: `src/lib/api.ts`, `src/lib/auth.tsx`, `src/lib/hooks.ts`, `src/pages/Login.tsx`, `.env.example`, `.gitignore`

**Interfaces:**
- Produces: `api<T>(path, init)`, as today, sending `FormData` without a JSON content type; `apiList<T>(path, params?) -> Promise<{count: number; results: T[]}>`; `useList<T>(path, params?) -> {data, count, loading, error, reload}`, replacing `useDocs`; `Doc<T>` stays exported.
- Local storage keys: keep `zebella_auth_token` and `zebella_auth_user`, add `zebella_auth_refresh`.

- [ ] **Step 1:** Create the branch, committing the spec and plan first: `git checkout -b feature/drf-admin-api`, then `git add docs` and commit `docs: add DRF backend design and plan`.
- [ ] **Step 2:** Stop tracking `.env`: add it to `.gitignore` and run `git rm --cached .env`. The local file stays.
- [ ] **Step 3:** Rewrite `api.ts`. On a 401, refresh and retry once. Keep the refresh in a single shared promise, so parallel 401s wait for one refresh rather than each starting their own. If the refresh fails, clear the session.
- [ ] **Step 4:** Apply the `auth.tsx` and `Login.tsx` changes from spec section 4: remove the fallbacks, `devLogin`, the dev button and the bootstrap form; call `/api/auth/me` on startup and clear the session on 401; a missing role stays `null`.
- [ ] **Step 5: Browser check.** Log in as admin and reach the Dashboard shell; a wrong password shows the server's message; with the API stopped, login shows an error and does **not** log in. Log in as a customer and see No Access. Set a stored access token to garbage and reload the Dashboard: read the network log to confirm exactly one `/api/auth/refresh` call despite parallel 401s, and that the user stays logged in.
- [ ] **Step 6:** Commit: `feat: connect panel auth to the API and remove login fallbacks`.

### Task 13: Generic editors and uploads

**Files:**
- Modify: `src/components/ResourceManager.tsx`, `src/components/DocEditor.tsx`, `src/components/ImageUploader.tsx`, `src/pages/resources.tsx`, `src/pages/Content.tsx`, `src/pages/Settings.tsx`, `src/pages/Misc.tsx`

**Interfaces:**
- Consumes: `api`, `apiList`, `useList`.
- Produces: `ResourceConfig.endpoint: string`, replacing `collection` (`/api/admin/categories` and so on). `DocEditor` takes `endpoint`, replacing `col` and `id`. `uploadFile(file, folder, opts) -> Promise<Img>` and `removeFile(path?)` keep their signatures. The `onCreate`, `revalidate`, `idFrom` and `slugFrom` options go if unused after the change, while `beforeSave` and `afterLoad` stay.

- [ ] **Step 1:** Replace Firestore calls in `ResourceManager` with `useList` plus `POST`, `PATCH` and `DELETE`. Remove client-side `updatedAt`, `createdAt` and `audit()` calls.
- [ ] **Step 2:** Replace Firestore calls in `DocEditor` with `GET` and `PUT`, and in `Misc.tsx` with `useList`. Keep the CSV export working.
- [ ] **Step 3:** Rewrite `uploadFile` and `removeFile` to use `/api/admin/uploads`. Remove Cloudinary and Firebase error messages. Client-side type and size checks stay as a quick first check.
- [ ] **Step 4: Browser check.** Create, edit and delete one category, collection, banner, testimonial and coupon. Confirm a fixed coupon of ₹100 reloads as 100. Upload a category image and reload. Save the homepage and settings twice and confirm images still load. Export the newsletter CSV. Check the audit log shows these actions.
- [ ] **Step 5:** Commit: `feat: move generic editors and uploads to the API`.

### Task 14: Products, inventory, orders and customers

**Files:**
- Modify: `src/pages/Products.tsx`, `src/pages/Inventory.tsx`, `src/pages/Orders.tsx`, `src/pages/Customers.tsx`

**Interfaces:**
- Consumes: `api`, `apiList`, `useList`.

- [ ] **Step 1:** `Products.tsx`: use the API for list and editor. Remove the slug scan, the transaction, client movements and `audit()`. Use `crypto.randomUUID()` for the upload folder on new products. Keep form validation as immediate feedback.
- [ ] **Step 2:** `Inventory.tsx`: replace product and movement reads. The adjust call is unchanged except for removing `revalidateStorefront`.
- [ ] **Step 3:** `Orders.tsx`: replace reads with `apiList` and `api`. Keep the `NEXT` map for showing buttons. Change the tracking toast to `Tracking saved`, with no mention of email.
- [ ] **Step 4:** `Customers.tsx`: read orders with `?userId=`. Change the confirmation copy, since roles now apply immediately: remove "They must sign in again to apply it", and the Staff access hint, "Staff must sign in again for a change to apply."
- [ ] **Step 5: Browser check.** Create a product with two variants, images and a video, publish it, then reload. Edit it and confirm stock is unchanged. Adjust stock and view its history. Move an order from processing to delivered, add a note and tracking, cancel another order and see `refund_pending`, then refund it on the fake backend, including a partial refund. Change a customer's role, then log in as them to confirm the new permissions.
- [ ] **Step 6:** Commit: `feat: move products, inventory, orders and customers to the API`.

### Task 15: Dashboard, stats and reports

**Files:**
- Modify: `src/pages/Dashboard.tsx`, `src/lib/stats.ts`, `src/lib/reports.ts`, `src/pages/Analytics.tsx`

- [ ] **Step 1:** `Dashboard.tsx`: replace reads with `apiList`, using `count` with `limit=1` for counts. Remove `isConfigured` branches. Keep the per-permission guards. Add a guard so roles without `orders:read` don't call orders.
- [ ] **Step 2:** `stats.ts` reads `/stats/daily?days=`. `reports.ts` reads `/orders?from=&to=&limit=10000` and `/products?limit=2000`, `/users?q=` and `/events`. Calculations stay as they are. Remove `sample` and its notice in `Analytics.tsx`.
- [ ] **Step 3: Browser check.** Dashboard numbers and charts render as admin, editor and fulfillment with no failed requests that the page doesn't handle. Open every reports tab across each preset range. Export one Excel report. As editor, the Customers tab shows its existing "unavailable" behavior, not a crash. Compare 30-day revenue on the Dashboard with the Sales tab for the same range.
- [ ] **Step 4:** Commit: `feat: move dashboard and reports to the API`.

### Task 16: Remove Firebase and final verification

**Files:**
- Delete: `src/lib/firebase.ts`, `src/lib/audit.ts`, `src/lib/demo/`, `src/demo-env.d.ts`, `public/demo/`
- Modify: `vite.config.ts`, `src/App.tsx` (`DemoBar`, `__DEMO__`), `package.json`, `package-lock.json`, `README.md`

- [ ] **Step 1:** Delete the files, remove `revalidateStorefront`, remove the `isDemo` branches that referred to demo mode (the `isDemo` field on products and orders stays), and run `npm uninstall firebase`.
- [ ] **Step 2:** Replace the template README with setup instructions for the panel and a pointer to the API repo.
- [ ] **Step 3:** Run `git grep -inE "firebase|firestore|cloudinary|__DEMO__|/demo/" -- src package.json index.html vite.config.ts .env.example`. Expected: no output.
- [ ] **Step 4:** Run `npm run build` and `npm run lint`. Expected: both exit 0.
- [ ] **Step 5:** Full walkthrough with the panel's production build (`npm run preview`) against the seeded API. Visit every route in `src/App.tsx` as admin, and spot check as editor and fulfillment, including that routes they lack show the existing no-permission behavior. Expected: no console errors and no failed requests other than handled 403s.
- [ ] **Step 6:** Run the whole backend suite one last time, on PostgreSQL. Expected: all PASS.
- [ ] **Step 7:** Commit: `chore: remove Firebase, Cloudinary and demo mode`.
