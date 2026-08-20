# SDD

## System intent

This backend is a Node.js + Express application for storefront, member, coupon, comment, and order workflows. It mixes route-level SQL handlers with a partial layered design for product administration.

## Runtime structure

### Entry and middleware

- `index.js` bootstraps the Express app.
- Global middleware handles CORS, request logging, JSON and URL-encoded parsing, cookies, static assets, session storage, and JWT extraction from the `Authorization` header.
- Session state is stored in Redis through `connect-redis`.
- JWT payloads are attached to `res.locals.jwt` when token verification succeeds.

### Route modules

Main mounted route groups:

- `/register-list` for registration and profile-image upload support during signup.
- `/product` for storefront product browsing and product administration.
- `/comments` for product comment read/write.
- `/order-list` for order history, order placement, and payment callbacks.
- `/coupon-show` for member-owned coupon retrieval.
- `/coupon-list` for coupon definition and coupon-assignment management.
- `/member` for authenticated profile read/update.

Standalone auth endpoints live directly in `index.js`:

- `POST /login`
- `GET /auth/check`
- `POST /logout`

## Dependency direction

The current design is hybrid:

- Most route modules depend directly on `utils/connect-mysql.js` and issue SQL in the route layer.
- The product admin v2 flow uses `routes/product.js -> controllers/productController.js -> services/productService.js -> repositories/productRepository.js -> MySQL`.
- Shared infrastructure utilities are consumed from `utils/*`.

Current dependency direction:

```text
index.js
-> routes/*
-> utils/*

routes/product.js
-> controllers/productController.js
-> services/productService.js
-> repositories/productRepository.js
-> utils/connect-mysql.js

routes/*
-> utils/connect-mysql.js
-> utils/upload-imgs.js
-> utils/connect-firebase.js
-> external providers
```

## Data and integration boundaries

### MySQL

MySQL is the primary system of record for:

- member profiles
- products
- product multiple images
- comments
- coupons
- coupon ownership / use
- order headers
- order line items

The app uses a shared promise pool from `utils/connect-mysql.js`.

### Redis

Redis stores Express session data. Session identity is used alongside JWT for auth-sensitive flows.

### Firebase

Firebase Storage stores uploaded member and product images.

Firestore stores payment outcome events keyed by order identifier.

### ECPay

ECPay is used for hosted payment initiation and asynchronous payment result callbacks.

### i18n

`utils/i18n.js` initializes i18next with preloaded `zh-TW` and `en-US` translation sets and exposes a language middleware. Product routes use this middleware together with `utils/product-i18n.js`.

## Main request flows

### Authentication flow

1. Client submits `account` and `password` to `POST /login`.
2. The server reads the member row from `profile`.
3. The server compares the submitted password with the stored bcrypt hash.
4. On success, the server signs a JWT and stores `{ sid, account }` in the Redis-backed session.
5. Later requests may authenticate through:
   - JWT in the `Authorization` header
   - session user data
   - in some routes, a token supplied in the request body

### Product browse flow

1. Client calls `/product/api` or `/product/api/all`.
2. Product route applies language middleware.
3. Query helpers build search, tag, price, and sort conditions.
4. Route executes count query and paginated list query.
5. Results are mapped into DTO-like list objects before response.

### Product admin v2 flow

1. Client submits multipart form-data to `/product/add-v2` or `/product/edit/:pid`.
2. Multer keeps files in memory.
3. Controller normalizes request body and delegates to `productService`.
4. Service validates file constraints, uploads images to Firebase Storage after TinyPNG compression, computes changed fields, and decides whether secondary images changed.
5. Repository writes the product row and any related `product_multiple_img` rows.

### Member profile update flow

1. Client calls `/member/edit`.
2. Route resolves member identity from JWT, session, or body token.
3. Route builds a partial update object from submitted fields.
4. If a new photo is present, the route compresses and uploads it to Firebase Storage.
5. Route updates the profile row in MySQL.

### Order placement flow

1. Client submits buyer, shipping, payment, product, quantity, and optional coupon data to `/order-list/add`.
2. Route loads authoritative product prices from MySQL.
3. Route recomputes subtotal and discount, then adds shipping.
4. Route validates and consumes coupon state when a coupon is applied.
5. Route inserts one `order_list` row.
6. Route inserts one or more `order_child` rows for each purchased product.

### Payment callback flow

1. Client is redirected to ECPay through `/order-list/payment/create/:oid`.
2. ECPay posts callback data to `/order-list/payment/return`.
3. The route recomputes the expected checksum.
4. If verification passes, the route updates `order_status`.
5. The route writes a Firestore event with `success` or `fail`.
6. The route returns `1|OK` to the payment provider.

## Module responsibilities

### `index.js`

- app bootstrap
- middleware registration
- auth/session setup
- top-level auth endpoints
- route mounting

### `routes/register-list.js`

- member registration
- profile-image upload during registration

### `routes/member.js`

- authenticated member profile fetch
- authenticated member profile partial update

### `routes/product.js`

- product listing, detail, and recommendation
- product image upload
- product create / update / delete
- language middleware integration for product content

### `controllers/productController.js`

- HTTP-to-service delegation for product v2 admin routes

### `services/productService.js`

- product image validation
- Firebase upload orchestration
- secondary-image merge and normalization
- product diffing for partial updates

### `repositories/productRepository.js`

- product row CRUD and related image-row persistence

### `routes/comments.js`

- comment list by product
- purchase-gated comment creation

### `routes/coupon-list.js`

- coupon definition CRUD-like operations
- coupon ownership insertion

### `routes/coupon-show.js`

- member coupon retrieval
- expiry-state refresh on read

### `routes/order-list.js`

- order history listing
- order detail retrieval
- order creation
- payment initiation and callback handling

## Contracts and payload shapes

Important request/response contracts:

- Login returns a status object with `success`, `code`, `sid`, `account`, and `token`.
- Product list returns pagination metadata plus `rows`.
- Product detail returns one product object with `images`.
- Product admin v2 routes expect multipart form-data with one `productImg` file and optional `images` files.
- Member edit expects optional scalar profile fields and optional `photo`.
- Order create expects arrays for `pid` and `actual_amount`.
- Payment callback relies on ECPay-posted fields including `CheckMacValue`, `CustomField1`, and `RtnCode`.

## Design constraints

- Uploaded files are processed in memory, so request sizes and concurrent uploads affect application memory.
- Auth is not centralized in a dedicated middleware; route modules resolve auth in mixed ways.
- Product admin logic is the only area consistently split into controller, service, and repository layers.
- The application relies on environment variables for MySQL, Redis, Firebase, JWT, session secret, TinyPNG, ECPay, and host configuration.

## Non-goals for this document

- This document does not enumerate every acceptance scenario.
- This document does not prescribe a future refactor plan.
- This document does not serve as a defect log or code review artifact.
