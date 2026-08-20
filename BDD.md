# BDD

## Scope

This document defines the externally visible backend behavior for the PetPet Shop backend service.

Unless a feature explicitly says otherwise, the backend returns JSON responses for API calls, persists state in MySQL, and may create side effects in Redis session storage, Firebase Storage, Firestore, or payment-provider flows.

## Primary user-facing capabilities

### Authentication and session

The backend shall allow a member to log in with `account` and `password`.

Acceptance behavior:

- When credentials are valid, the backend returns `success: true`, a member identifier, the account value, and a signed JWT token.
- When credentials are invalid or required fields are missing, the backend returns a failure payload with a code that distinguishes missing input, unknown account, and wrong password.
- When login succeeds, the backend stores the authenticated member in the server session.
- When `/auth/check` is called with a live session, the backend returns the logged-in member summary.
- When `/auth/check` is called without a live session, the backend returns `401`.
- When `/logout` is called, the backend destroys the session and clears the `sid` cookie.

What must not happen:

- A successful login must not be reported when the password comparison fails.
- Auth check must not return member identity for an unauthenticated request.

### Member registration and profile maintenance

The backend shall allow a visitor to create a member profile and allow an authenticated member to read and edit their profile.

Acceptance behavior:

- Registration accepts member identity and contact fields and may include one profile image upload.
- When a profile image is included, the backend uploads it to Firebase Storage and stores the resulting public URL in the member record.
- Passwords are hashed before the member record is inserted.
- Reading the member profile requires an authenticated member context from JWT, session, or request token.
- Editing the member profile updates only submitted fields and may replace the stored profile photo.

What must not happen:

- Profile reads must not disclose another member's data without authenticated member context.
- Plaintext passwords must not be stored in the persisted profile record created through the registration flow.

### Product browse and detail

The backend shall expose product list, detail, and recommendation APIs for storefront use.

Acceptance behavior:

- Product list supports paging.
- Product list supports filtering by search word, price range, category tags, and sort order.
- The default storefront list returns only on-shelf products.
- The admin-oriented full list returns products regardless of on-shelf status.
- Product detail returns the base product plus ordered secondary images.
- Recommendation returns a small random subset of currently sellable products.
- Product responses include Chinese and English fields where present.
- Product endpoints respect the request language middleware for localized messages and filtering support.

What must not happen:

- Product detail must not return a successful detail payload for a nonexistent `pid`.
- Invalid page requests must not silently claim success; they should redirect or report the pagination issue in the response payload.

### Product administration and media

The backend shall allow product media upload and product create, update, and delete operations.

Acceptance behavior:

- Product image uploads accept image files only.
- Uploaded images are compressed, stored in Firebase Storage, and returned as signed URLs.
- Product creation persists the main product record and up to three secondary images.
- Product update can change text fields, replace the main image, keep selected existing images, and append new secondary images up to the configured limit.
- Product delete removes the product row and linked secondary-image rows when deletion is allowed by product identifier rules.

What must not happen:

- Requests without the required main product image on create must not be treated as successful.
- More than the supported number of secondary images must not be persisted.

### Comments and review eligibility

The backend shall expose product comments and allow comment submission only for eligible buyers.

Acceptance behavior:

- Product comments can be listed by product with paging.
- Comment submission requires `pid`, `sid`, and `content`.
- Before inserting a comment, the backend checks whether the member has purchased the product.
- When purchase eligibility is missing, the backend rejects the submission.

What must not happen:

- The backend must not accept a comment for a product that the member has never purchased.

### Coupon issuance and redemption

The backend shall manage coupon creation, coupon ownership, and coupon status transitions.

Acceptance behavior:

- Coupon APIs can create coupon definitions.
- Coupon ownership records can be created for a member.
- Coupon listing for a member returns joined coupon and ownership data.
- Expired coupons are marked as expired when retrieved after expiry.
- Used coupons are marked as used during successful order placement.

What must not happen:

- A coupon that is not assigned to the ordering member must not be applied to that member's order.
- A coupon that is already used or inactive must not be treated as a valid discount source.

### Order placement and payment

The backend shall allow a member or checkout client to create an order, retrieve order history, inspect order detail, and complete payment.

Acceptance behavior:

- Order creation accepts buyer identity, contact data, shipping data, payment method, product identifiers, quantities, and an optional coupon.
- The backend recalculates totals from database product prices instead of trusting client-submitted totals.
- Shipping fee is added by backend rule.
- Coupon discount is subtracted by backend rule and clamped so final price does not drop below zero.
- Order creation persists one order header and one or more order line records.
- Order history can be retrieved for a member.
- Order detail returns both order header context and ordered product rows.
- Payment creation returns the HTML form payload needed to start the ECPay checkout flow.
- Payment callback verifies the checksum from the payment provider before changing order status.
- Successful payment updates the order to paid and writes a success event to Firestore.
- Failed payment updates the order to failed and writes a failure event to Firestore.

What must not happen:

- The backend must not trust a payment callback that fails checksum verification.
- Order creation must not accept mismatched product and quantity arrays.
- Order detail must not reveal another member's order data when member ownership does not match.

### Common transport behavior

The backend shall expose CORS-enabled APIs for the configured frontend origins and support JSON and form-data requests used by the frontend.

Acceptance behavior:

- The server accepts requests from configured localhost and deployed frontend origins.
- The server supports JSON bodies, URL-encoded bodies, cookies, and multipart form-data where the route expects uploads.
- Unmatched routes return `404`.

## Side effects to preserve

- Session creation, lookup, and deletion through Redis-backed session storage.
- MySQL inserts, updates, deletes, and list queries across profile, product, comment, coupon, and order tables.
- Firebase Storage uploads for member and product images.
- Firestore order event writes after payment callbacks.
- ECPay payment initiation and callback handling.

## Closed-loop invariants

- Authenticated identity used for protected member and order reads must come from server-recognized auth context, not from unchecked display-only input.
- Stored order totals must be derived from server-side product pricing and discount logic.
- Product create and update flows must preserve the one-main-image plus limited-secondary-images contract.
- Comment posting must remain gated by a successful purchase relationship.
- Coupon usage and payment status changes must remain synchronized with order side effects.
