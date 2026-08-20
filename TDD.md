# TDD

## Test strategy

This project currently has no automated test suite configured. The recommended test design is risk-based and split by unit, integration, and end-to-end coverage, with the heaviest emphasis on auth, order pricing, payment callbacks, and file-backed product workflows.

## Test layers

### Unit tests

Target the logic that can be validated without live infrastructure.

Priority unit targets:

- `services/productService.js`
  - file validation rules
  - existing image parsing
  - image reference validation
  - sort normalization
  - multiple-image equality checks
  - changed-field detection for partial update
- `utils/product-i18n.js`
  - product localization mapping
  - search condition generation
- auth helper logic extracted or wrapped from existing routes
  - member identity resolution precedence
- price / coupon calculation logic once isolated from route handlers

Representative unit cases:

- create product rejects missing main image
- create product rejects more than three secondary images
- update product keeps unchanged text fields out of SQL update payload
- existing image JSON parsing handles empty, invalid, and valid JSON
- multiple image merge preserves intended order and trims to max length
- localized product mapping falls back correctly when English fields are absent

### Integration tests

Validate route-to-database and route-to-provider orchestration with controlled dependencies or test doubles.

Priority integration targets:

- `POST /login`
- `GET /auth/check`
- `POST /logout`
- `POST /register-list/add`
- `POST /member`
- `PUT /member/edit`
- `GET /product/api`
- `GET /product/one/:pid`
- `POST /product/add-v2`
- `PUT /product/edit/:pid`
- `DELETE /product/delete/:pid`
- `POST /comments/add`
- `POST /order-list/add`
- `POST /order-list/one/:oid`
- `POST /order-list/payment/return`
- coupon creation / assignment / retrieval flows

Representative integration cases:

- login succeeds with correct password and creates session state
- login fails for unknown account
- member profile read returns `401` without auth context
- product list paging returns total rows and page counts
- product detail returns `404` for missing product
- product create stores the main record and child image rows together
- product update changes only submitted fields
- comment submission is rejected when purchase history is absent
- order creation recalculates totals from DB values instead of caller totals
- coupon application flips both coupon tables to used status on successful order create
- payment callback updates order state only when checksum validation succeeds

### End-to-end tests

Validate the highest-risk business flows with the frontend or API client behavior that resembles production usage.

Priority end-to-end scenarios:

- member logs in, remains authenticated, and logs out
- member browses products, views detail, and sees localized content
- admin uploads product images and creates a new product
- admin edits a product while keeping existing secondary images
- buyer places an order with multiple products
- buyer applies a valid coupon during checkout
- hosted payment callback marks the order as paid
- buyer posts a comment after purchase

## Risk-based coverage map

### Highest risk

- authentication correctness across JWT, session, and body-token paths
- order total recomputation and coupon discount handling
- payment callback verification and order-status transition
- product image upload, compression, and persistence
- partial product update behavior for retained vs newly uploaded images

These should be covered first and on every release candidate.

### Medium risk

- member registration and profile update
- coupon expiry refresh behavior
- order history and detail ownership checks
- comment purchase eligibility checks
- CORS and cookie-based session behavior across allowed origins

### Lower risk

- static file exposure
- simple list retrieval endpoints without privileged side effects
- translation-field mapping that does not alter persisted state

## Test data design

Use fixtures or seeded data for:

- one valid member with hashed password
- one unauthenticated request path
- multiple products with varied `sales_condition`, category, and price
- one product with multiple secondary images
- one member with and without prior purchase history
- one active coupon, one used coupon, and one expired coupon
- one unpaid order, one paid order, and one failed order

## Manual vs automated boundaries

Automate:

- pure data transformation
- route auth outcomes
- DB-backed CRUD assertions
- coupon and order pricing rules
- payment callback state transitions using mocked provider payloads

Prefer manual or staged-environment verification for:

- real Firebase Storage uploads
- real TinyPNG compression behavior
- real Redis connectivity behavior under deployment settings
- real ECPay hosted checkout redirects and callback round-trips
- browser-level CORS and cookie interactions across deployed frontends

## Suggested execution order

1. Add unit coverage for `productService`.
2. Add integration coverage for login, member auth, and product read APIs.
3. Add integration coverage for order creation, coupon application, and payment callback.
4. Add one end-to-end happy path for login -> browse -> order -> payment callback.

## Release verification checklist

- Verify login, auth check, and logout with both valid and invalid inputs.
- Verify product list filters and pagination.
- Verify product create and edit with image uploads.
- Verify order creation totals with and without coupon application.
- Verify payment callback updates status and emits Firestore event.
- Verify comment posting remains blocked until purchase exists.
