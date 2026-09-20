# Friend Ledger

## PostgreSQL Logical Data Model & API Contract Baseline

### Version 1.0

## 1. Purpose

This document defines the Stage 3 technical baseline for Friend Ledger.

It translates the approved Product Requirements and System & Domain Architecture into:

* logical PostgreSQL entities;
* relationships;
* data types;
* integrity constraints;
* indexes;
* transactional rules;
* API resources;
* API request contracts;
* API response contracts;
* authentication contracts;
* error contracts.

This stage does **not** create production SQL migrations or application code.

---

# 2. Technology Baseline

Mobile:

* React Native
* Expo
* TypeScript
* Android
* iOS

Backend:

* Python
* FastAPI

Database:

* PostgreSQL

Production hosting:

* Railway

Communication:

* HTTPS
* JSON REST API

API version prefix:

```text
/api/v1
```

---

# 3. PostgreSQL Conventions

## 3.1 Primary Keys

All major entities shall use UUID identifiers.

Logical type:

```text
UUID
```

UUIDs must never carry business meaning.

---

## 3.2 Timestamps

All authoritative timestamps shall use timezone-aware PostgreSQL timestamps.

Logical type:

```text
TIMESTAMPTZ
```

Times shall be stored in UTC.

The mobile application converts them to device-local time for display.

---

## 3.3 Money

All money shall be stored as integer minor units.

For INR:

```text
₹1.00 = 100
₹100.00 = 10000
₹2400.00 = 240000
```

Logical type:

```text
BIGINT
```

Field naming convention:

```text
amount_minor
total_amount_minor
```

Floating-point types shall never be used for money.

---

## 3.4 Currency

MVP supports INR only.

A currency column is therefore not required in the initial schema.

Multi-currency support is deferred.

---

## 3.5 Deletion

Financial entities shall not use physical deletion during normal product operations.

Corrections shall use explicit status changes such as:

```text
VOIDED
```

or replacement records.

---

# 4. Core Logical Tables

The initial logical database consists of:

```text
users
auth_sessions
sessions
session_participations
payments
payment_shares
settlements
idempotency_records
audit_events
```

---

# 5. users

Purpose:

Stores permanent Friend Ledger accounts.

Logical structure:

| Column              | Type        | Rules            |
| ------------------- | ----------- | ---------------- |
| id                  | UUID        | Primary key      |
| display_name        | VARCHAR(80) | Required         |
| username            | VARCHAR(40) | Required         |
| username_normalized | VARCHAR(40) | Required, unique |
| password_hash       | TEXT        | Required         |
| status              | VARCHAR(20) | Required         |
| created_at          | TIMESTAMPTZ | Required         |
| updated_at          | TIMESTAMPTZ | Required         |

Allowed status values:

```text
ACTIVE
DISABLED
```

MVP normally creates users as:

```text
ACTIVE
```

Username normalization shall occur before persistence.

Example:

```text
Arif.Ali
```

may normalize to:

```text
arif.ali
```

Usernames shall be compared using the normalized value.

Recommended constraints:

```text
display_name length > 0
username_normalized length > 0
username_normalized UNIQUE
```

Recommended indexes:

```text
UNIQUE(username_normalized)
```

---

# 6. auth_sessions

Purpose:

Stores long-lived authenticated device sessions and refresh-token state.

Access tokens may remain stateless and short-lived.

Logical structure:

| Column             | Type         | Rules       |
| ------------------ | ------------ | ----------- |
| id                 | UUID         | Primary key |
| user_id            | UUID         | FK users.id |
| refresh_token_hash | TEXT         | Required    |
| device_label       | VARCHAR(120) | Optional    |
| created_at         | TIMESTAMPTZ  | Required    |
| expires_at         | TIMESTAMPTZ  | Required    |
| revoked_at         | TIMESTAMPTZ  | Nullable    |
| last_used_at       | TIMESTAMPTZ  | Nullable    |

Foreign key:

```text
user_id → users.id
```

Recommended indexes:

```text
INDEX(user_id)
INDEX(expires_at)
```

Refresh tokens themselves shall never be stored in plaintext.

---

# 7. sessions

Purpose:

Represents an outing.

Logical structure:

| Column             | Type        | Rules            |
| ------------------ | ----------- | ---------------- |
| id                 | UUID        | Primary key      |
| name               | VARCHAR(80) | Nullable         |
| join_code          | VARCHAR(8)  | Required, unique |
| created_by_user_id | UUID        | FK users.id      |
| status             | VARCHAR(20) | Required         |
| created_at         | TIMESTAMPTZ | Required         |
| closed_at          | TIMESTAMPTZ | Nullable         |

Allowed status:

```text
ACTIVE
CLOSED
```

Rules:

```text
ACTIVE  → closed_at IS NULL
CLOSED  → closed_at IS NOT NULL
```

`created_by_user_id` exists for history only.

It grants no administrative privileges.

Recommended indexes:

```text
UNIQUE(join_code)
INDEX(created_by_user_id)
INDEX(status)
INDEX(created_at)
```

---

# 8. Join Code Format

MVP shall use a six-character uppercase code.

Recommended alphabet:

```text
23456789ABCDEFGHJKLMNPQRSTUVWXYZ
```

Characters such as:

```text
0 O 1 I
```

are excluded to reduce typing mistakes.

Example:

```text
7K4P9X
```

Join codes shall be generated using cryptographically secure randomness.

Codes shall not be sequential.

A code belonging to a closed session shall no longer permit joining.

For MVP, codes do not need to be reused.

---

# 9. session_participations

Purpose:

Stores each period during which a user participated in a session.

Logical structure:

| Column     | Type        | Rules          |
| ---------- | ----------- | -------------- |
| id         | UUID        | Primary key    |
| session_id | UUID        | FK sessions.id |
| user_id    | UUID        | FK users.id    |
| joined_at  | TIMESTAMPTZ | Required       |
| left_at    | TIMESTAMPTZ | Nullable       |

Foreign keys:

```text
session_id → sessions.id
user_id    → users.id
```

Constraint:

```text
left_at IS NULL
OR
left_at > joined_at
```

A user may have several historical participation rows in the same session.

Example:

```text
18:00 → 20:00
20:30 → 22:00
```

But a user must never have more than one active participation in the same session.

Required partial unique constraint:

```text
UNIQUE(session_id, user_id)
WHERE left_at IS NULL
```

Recommended indexes:

```text
INDEX(session_id)
INDEX(user_id)
INDEX(session_id, joined_at)
INDEX(user_id, joined_at)
```

---

# 10. payments

Purpose:

Represents money paid by one authenticated participant.

Logical structure:

| Column                    | Type         | Rules            |
| ------------------------- | ------------ | ---------------- |
| id                        | UUID         | Primary key      |
| session_id                | UUID         | FK sessions.id   |
| payer_user_id             | UUID         | FK users.id      |
| description               | VARCHAR(120) | Required         |
| total_amount_minor        | BIGINT       | Required, > 0    |
| split_type                | VARCHAR(20)  | Required         |
| status                    | VARCHAR(20)  | Required         |
| corrected_from_payment_id | UUID         | Nullable self-FK |
| created_at                | TIMESTAMPTZ  | Required         |
| voided_at                 | TIMESTAMPTZ  | Nullable         |
| voided_by_user_id         | UUID         | Nullable         |
| void_reason               | VARCHAR(250) | Nullable         |

Allowed `split_type`:

```text
EQUAL
CUSTOM
```

Allowed `status`:

```text
ACTIVE
VOIDED
```

Foreign keys:

```text
session_id → sessions.id
payer_user_id → users.id
corrected_from_payment_id → payments.id
voided_by_user_id → users.id
```

Rules:

```text
total_amount_minor > 0
```

For active payment:

```text
status = ACTIVE
voided_at IS NULL
voided_by_user_id IS NULL
```

For voided payment:

```text
status = VOIDED
voided_at IS NOT NULL
voided_by_user_id IS NOT NULL
```

Recommended indexes:

```text
INDEX(session_id, created_at)
INDEX(payer_user_id, created_at)
INDEX(status)
INDEX(corrected_from_payment_id)
```

---

# 11. Payment Ownership

The API shall never accept arbitrary payer identity.

The backend derives:

```text
payer_user_id = authenticated_user.id
```

Therefore a malicious mobile client cannot send:

```json
{
  "payer_user_id": "someone-else"
}
```

and create a financial record on another user's behalf.

---

# 12. payment_shares

Purpose:

Stores the immutable calculated responsibility of each participant for a payment.

Logical structure:

| Column       | Type        | Rules          |
| ------------ | ----------- | -------------- |
| id           | UUID        | Primary key    |
| payment_id   | UUID        | FK payments.id |
| user_id      | UUID        | FK users.id    |
| amount_minor | BIGINT      | Required, > 0  |
| created_at   | TIMESTAMPTZ | Required       |

Foreign keys:

```text
payment_id → payments.id
user_id → users.id
```

Required uniqueness:

```text
UNIQUE(payment_id, user_id)
```

Constraint:

```text
amount_minor > 0
```

Recommended indexes:

```text
INDEX(payment_id)
INDEX(user_id)
INDEX(user_id, payment_id)
```

The sum of all shares must equal:

```text
payments.total_amount_minor
```

This invariant must be validated transactionally by the backend.

---

# 13. Valid Payment Participant Rules

When creating a payment:

1. session must be ACTIVE;
2. payer must currently be an active participant;
3. every selected user must currently be an active participant;
4. selected users must be unique;
5. at least one selected user other than the payer must have a positive share;
6. share total must equal payment total.

A payer may be included.

A payer may also be excluded.

Valid:

```text
Arif pays ₹500 only for Sameer.
```

Shares:

```text
Sameer ₹500
```

Invalid:

```text
Arif pays ₹500 only for Arif.
```

because Friend Ledger is not a personal spending tracker.

---

# 14. Equal Split Validation

For equal splitting:

```text
total_amount_minor >= participant_count
```

This ensures every selected participant receives at least one minor unit.

Example:

```text
₹100.00 = 10000 paise
3 participants
```

Calculation:

```text
base = 3333
remainder = 1
```

Final:

```text
3334
3333
3333
```

The server determines the final allocation.

---

# 15. Equal Split Remainder Order

Remainder distribution must be deterministic.

Order:

1. payer first if payer participates;
2. remaining participants ordered by current participation `joined_at`;
3. user UUID as final tie-breaker.

The exact generated `PaymentShare` values are persisted.

Future versions do not recalculate historical shares.

---

# 16. Custom Split Validation

For custom split:

```text
SUM(all amount_minor) = payment.total_amount_minor
```

Every persisted share must satisfy:

```text
amount_minor > 0
```

Duplicate users are rejected.

At least one user other than the payer must receive a positive share.

---

# 17. Payment Correction Strategy

MVP shall **not silently overwrite financial history**.

If the payer discovers an error while the session is still ACTIVE:

1. original payment is marked `VOIDED`;
2. if necessary, a new corrected payment is created;
3. new payment may reference:

```text
corrected_from_payment_id
```

Example:

```text
Original:
Dinner ₹2400
VOIDED

Replacement:
Dinner ₹2200
corrected_from = original payment
```

Once a session is CLOSED, payments belonging to it become immutable.

Hard deletion is prohibited.

---

# 18. settlements

Purpose:

Represents money repaid between two users.

Logical structure:

| Column       | Type         | Rules         |
| ------------ | ------------ | ------------- |
| id           | UUID         | Primary key   |
| from_user_id | UUID         | FK users.id   |
| to_user_id   | UUID         | FK users.id   |
| amount_minor | BIGINT       | Required, > 0 |
| method       | VARCHAR(20)  | Required      |
| note         | VARCHAR(160) | Nullable      |
| status       | VARCHAR(20)  | Required      |
| created_at   | TIMESTAMPTZ  | Required      |
| voided_at    | TIMESTAMPTZ  | Nullable      |
| void_reason  | VARCHAR(250) | Nullable      |

Allowed methods:

```text
CASH
UPI
OTHER
```

Allowed status:

```text
ACTIVE
VOIDED
```

Constraints:

```text
from_user_id <> to_user_id
amount_minor > 0
```

Recommended indexes:

```text
INDEX(from_user_id, created_at)
INDEX(to_user_id, created_at)
INDEX(from_user_id, to_user_id)
INDEX(status)
```

The authenticated user creating a settlement must equal:

```text
from_user_id
```

The API shall derive this value.

---

# 19. Settlement Validation

Before creating a settlement, backend calculates the current pairwise net balance.

Example:

```text
Arif owes Sameer ₹500
```

Valid settlement amounts:

```text
₹100
₹300
₹500
```

Invalid:

```text
₹700
```

A settlement cannot exceed the amount the current user presently owes that recipient.

Validation and insertion occur in one database transaction.

---

# 20. Settlement Corrections

Settlements shall not be physically deleted.

If a settlement was entered incorrectly, the user who created it may void it.

Voiding restores its financial effect to the calculated balance.

A voided settlement remains visible in history/audit records.

---

# 21. idempotency_records

Purpose:

Protects financial mutation endpoints from duplicate mobile retries.

Logical structure:

| Column          | Type         | Rules       |
| --------------- | ------------ | ----------- |
| id              | UUID         | Primary key |
| user_id         | UUID         | FK users.id |
| idempotency_key | VARCHAR(80)  | Required    |
| operation_scope | VARCHAR(120) | Required    |
| request_hash    | VARCHAR(128) | Required    |
| response_status | INTEGER      | Required    |
| response_body   | JSONB        | Required    |
| created_at      | TIMESTAMPTZ  | Required    |
| expires_at      | TIMESTAMPTZ  | Required    |

Required uniqueness:

```text
UNIQUE(user_id, operation_scope, idempotency_key)
```

Important mutation endpoints include:

```text
create session
join session
create payment
void payment
create settlement
void settlement
```

If the same idempotency key is reused with different request content, the request shall be rejected.

---

# 22. audit_events

Purpose:

Provides operational auditability.

This table is not the source of financial truth.

Logical structure:

| Column        | Type        | Rules                |
| ------------- | ----------- | -------------------- |
| id            | UUID        | Primary key          |
| actor_user_id | UUID        | Nullable FK users.id |
| event_type    | VARCHAR(80) | Required             |
| entity_type   | VARCHAR(50) | Required             |
| entity_id     | UUID        | Nullable             |
| session_id    | UUID        | Nullable             |
| metadata      | JSONB       | Nullable             |
| created_at    | TIMESTAMPTZ | Required             |

Example event types:

```text
USER_REGISTERED
USER_LOGGED_IN
SESSION_CREATED
SESSION_JOINED
SESSION_LEFT
SESSION_CLOSED
PAYMENT_CREATED
PAYMENT_VOIDED
SETTLEMENT_CREATED
SETTLEMENT_VOIDED
```

Recommended indexes:

```text
INDEX(actor_user_id, created_at)
INDEX(session_id, created_at)
INDEX(entity_type, entity_id)
INDEX(event_type, created_at)
```

---

# 23. Logical Relationships

```text
User
 │
 ├── AuthSessions
 │
 ├── creates Sessions
 │
 ├── SessionParticipations
 │
 ├── Payments as payer
 │
 ├── PaymentShares
 │
 └── Settlements
```

Session:

```text
Session
 │
 ├── SessionParticipations
 └── Payments
       │
       └── PaymentShares
```

Settlements exist between users and are not tied to one specific session.

---

# 24. Financial Source of Truth

Authoritative financial records:

```text
ACTIVE Payments
ACTIVE PaymentShares
ACTIVE Settlements
```

Voided financial records remain historical but contribute zero to current balances.

There shall be no authoritative:

```text
users.current_balance
```

field.

Balances are computed from ledger records.

---

# 25. Pairwise Ledger Formula

For users A and B:

Each active payment paid by A containing a share for B creates:

```text
B → A
```

for that share amount.

Each active payment paid by B containing a share for A creates:

```text
A → B
```

for that share amount.

Settlements reduce debt in their recorded direction.

Pairwise netting occurs only between A and B.

---

# 26. Example Pairwise Calculation

Payment 1:

```text
Arif pays Dinner
Sameer's share = ₹600
```

Effect:

```text
Sameer owes Arif ₹600
```

Payment 2:

```text
Sameer pays Movie
Arif's share = ₹400
```

Effect:

```text
Arif owes Sameer ₹400
```

Net:

```text
Sameer owes Arif ₹200
```

If Sameer settles ₹150:

```text
Sameer owes Arif ₹50
```

---

# 27. No Multi-Party Simplification

Given:

```text
Arif owes Sameer ₹500
Sameer owes Imran ₹500
```

the system shall preserve:

```text
Arif → Sameer ₹500
Sameer → Imran ₹500
```

It shall not create:

```text
Arif → Imran ₹500
```

MVP supports pairwise netting only.

---

# 28. Transaction Boundaries

## Create Session

Single transaction:

```text
create session
+
create creator participation
+
create audit event
```

Either all succeed or none succeed.

---

## Join Session

Single transaction:

```text
lock/validate session
validate no active participation
create participation
create audit event
```

---

## Leave Session

Single transaction:

```text
lock session
close caller's active participation
count remaining active participants
if zero:
    close session
create audit event(s)
```

---

## Finish Session

Single transaction:

```text
lock session
verify caller is active
verify active count = 1
close caller participation
close session
create audit events
```

---

## Create Payment

Single transaction:

```text
validate session
validate payer participation
validate selected participants
calculate/validate split
create Payment
create all PaymentShares
create audit event
```

Partial payment persistence is prohibited.

---

## Void Payment

Single transaction:

```text
validate ownership
validate session ACTIVE
validate payment ACTIVE
mark VOIDED
create audit event
```

---

## Create Settlement

Single transaction:

```text
calculate pairwise outstanding balance
validate amount
create Settlement
create audit event
```

---

# 29. Concurrency Controls

Session-changing operations shall lock the relevant session row where required.

This prevents race conditions such as two final participants leaving simultaneously while both independently believe the session remains active.

Critical invariants:

```text
one active participation per user/session
```

```text
closed session cannot accept new participants
```

```text
closed session cannot accept new payments
```

```text
payment share total equals payment total
```

```text
settlement cannot exceed current debt
```

Database constraints and application transactions shall both be used.

---

# 30. API Authentication

Protected endpoints use:

```text
Authorization: Bearer <access-token>
```

Access tokens shall be short-lived.

Refresh tokens shall be used to obtain new access tokens without repeatedly asking for credentials.

Mobile refresh tokens shall be stored using secure device storage.

---

# 31. Common API Conventions

Base URL:

```text
/api/v1
```

Request content type:

```text
application/json
```

Identifiers:

```text
UUID strings
```

Money:

```text
integer minor units
```

Example:

```json
{
  "amount_minor": 240000
}
```

means:

```text
₹2,400.00
```

---

# 32. Authentication API

## POST /auth/register

Creates a user account.

Request:

```json
{
  "display_name": "Arif Ali",
  "username": "arif",
  "password": "user-secret-password"
}
```

Success:

```text
201 Created
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "display_name": "Arif Ali",
    "username": "arif"
  },
  "access_token": "token",
  "refresh_token": "token"
}
```

---

## POST /auth/login

Request:

```json
{
  "username": "arif",
  "password": "user-secret-password"
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "display_name": "Arif Ali",
    "username": "arif"
  },
  "access_token": "token",
  "refresh_token": "token"
}
```

---

## POST /auth/refresh

Request:

```json
{
  "refresh_token": "token"
}
```

Response:

```json
{
  "access_token": "new-access-token",
  "refresh_token": "new-refresh-token"
}
```

Refresh-token rotation is recommended.

---

## POST /auth/logout

Revokes the current refresh session.

Success:

```text
204 No Content
```

---

# 33. Current User API

## GET /me

Returns current account information.

Response:

```json
{
  "id": "uuid",
  "display_name": "Arif Ali",
  "username": "arif",
  "created_at": "2026-09-20T15:30:00Z"
}
```

---

# 34. Session API

## POST /sessions

Creates a new outing.

Request:

```json
{
  "name": "Sunday Mall"
}
```

`name` may be null or omitted.

Backend automatically:

```text
creates session
generates join code
joins creator
```

Response:

```json
{
  "id": "uuid",
  "name": "Sunday Mall",
  "join_code": "7K4P9X",
  "status": "ACTIVE",
  "created_at": "2026-09-20T14:00:00Z",
  "current_user": {
    "participation_status": "ACTIVE"
  }
}
```

---

## POST /sessions/join

Joins using QR-derived or manually entered code.

Request:

```json
{
  "join_code": "7K4P9X"
}
```

Response:

```json
{
  "session": {
    "id": "uuid",
    "name": "Sunday Mall",
    "status": "ACTIVE"
  },
  "participation": {
    "id": "uuid",
    "joined_at": "2026-09-20T14:05:00Z"
  }
}
```

---

## GET /sessions/{session_id}

Available to users who have participated in the session.

Response:

```json
{
  "id": "uuid",
  "name": "Sunday Mall",
  "status": "ACTIVE",
  "created_at": "2026-09-20T14:00:00Z",
  "active_participants": [
    {
      "user_id": "uuid",
      "display_name": "Arif Ali",
      "username": "arif",
      "joined_at": "2026-09-20T14:00:00Z"
    }
  ],
  "current_user": {
    "is_active": true
  }
}
```

---

## GET /sessions

Returns current user's outing history.

Optional filters:

```text
status=ACTIVE
status=CLOSED
```

Pagination shall use cursor-based pagination where practical.

---

## POST /sessions/{session_id}/leave

Leaves the caller's active participation.

No body required.

Response:

```json
{
  "session_id": "uuid",
  "left_at": "2026-09-20T18:30:00Z",
  "session_status": "ACTIVE"
}
```

If caller was the final active participant:

```json
{
  "session_id": "uuid",
  "left_at": "2026-09-20T18:30:00Z",
  "session_status": "CLOSED"
}
```

---

## POST /sessions/{session_id}/finish

Allowed only when:

```text
caller is active
AND
active participant count = 1
```

Response:

```json
{
  "session_id": "uuid",
  "status": "CLOSED",
  "closed_at": "2026-09-20T19:00:00Z"
}
```

---

# 35. Payment API

## POST /sessions/{session_id}/payments

Creates a payment.

Header:

```text
Idempotency-Key: <client-generated-uuid>
```

### Equal Split Request

```json
{
  "description": "Dinner",
  "total_amount_minor": 240000,
  "split": {
    "type": "EQUAL",
    "participant_user_ids": [
      "user-arif",
      "user-sameer",
      "user-faizan",
      "user-imran"
    ]
  }
}
```

The request does not contain:

```text
payer_user_id
```

Backend derives payer from authentication.

Response:

```json
{
  "id": "payment-uuid",
  "session_id": "session-uuid",
  "payer": {
    "id": "user-arif",
    "display_name": "Arif Ali"
  },
  "description": "Dinner",
  "total_amount_minor": 240000,
  "split_type": "EQUAL",
  "shares": [
    {
      "user_id": "user-arif",
      "amount_minor": 60000
    },
    {
      "user_id": "user-sameer",
      "amount_minor": 60000
    },
    {
      "user_id": "user-faizan",
      "amount_minor": 60000
    },
    {
      "user_id": "user-imran",
      "amount_minor": 60000
    }
  ],
  "status": "ACTIVE",
  "created_at": "2026-09-20T14:20:00Z"
}
```

---

# 36. Custom Split Request

```json
{
  "description": "Cab",
  "total_amount_minor": 60000,
  "split": {
    "type": "CUSTOM",
    "shares": [
      {
        "user_id": "user-arif",
        "amount_minor": 20000
      },
      {
        "user_id": "user-sameer",
        "amount_minor": 25000
      },
      {
        "user_id": "user-imran",
        "amount_minor": 15000
      }
    ]
  }
}
```

Backend verifies:

```text
20000 + 25000 + 15000 = 60000
```

---

# 37. GET /sessions/{session_id}/payments

Returns session payment history.

Voided payments may be returned with explicit status so users can understand corrections.

Example:

```json
{
  "items": [
    {
      "id": "uuid",
      "description": "Dinner",
      "total_amount_minor": 240000,
      "payer": {
        "id": "uuid",
        "display_name": "Arif Ali"
      },
      "status": "ACTIVE",
      "created_at": "2026-09-20T14:20:00Z"
    }
  ],
  "next_cursor": null
}
```

---

# 38. GET /payments/{payment_id}

Returns complete payment details including shares.

Only users who participated in the relevant session may view it.

---

# 39. POST /payments/{payment_id}/void

Only original payer may void.

Only while session remains ACTIVE.

Request:

```json
{
  "reason": "Entered wrong amount"
}
```

Response:

```json
{
  "id": "payment-uuid",
  "status": "VOIDED",
  "voided_at": "2026-09-20T14:35:00Z"
}
```

---

# 40. Correcting a Payment

The mobile workflow should conceptually be:

```text
Edit Payment
     ↓
Void original
     ↓
Create corrected replacement
```

The corrected payment creation request may include:

```json
{
  "corrected_from_payment_id": "original-payment-uuid"
}
```

when exposed by the final API implementation.

This preserves history.

---

# 41. Balance API

## GET /me/balances

Returns pairwise current balances from the current user's perspective.

Response:

```json
{
  "i_owe": [
    {
      "user": {
        "id": "uuid",
        "display_name": "Sameer",
        "username": "sameer"
      },
      "amount_minor": 42000
    }
  ],
  "owed_to_me": [
    {
      "user": {
        "id": "uuid",
        "display_name": "Imran",
        "username": "imran"
      },
      "amount_minor": 75000
    }
  ],
  "totals": {
    "i_owe_minor": 42000,
    "owed_to_me_minor": 75000
  }
}
```

Zero balances need not be returned.

---

# 42. GET /me/balances/{user_id}

Returns detailed pairwise relationship.

Response:

```json
{
  "counterparty": {
    "id": "uuid",
    "display_name": "Sameer",
    "username": "sameer"
  },
  "direction": "THEY_OWE_ME",
  "amount_minor": 32000
}
```

Allowed direction:

```text
I_OWE
THEY_OWE_ME
SETTLED
```

---

# 43. Pairwise Ledger API

## GET /me/balances/{user_id}/ledger

Returns explainable ledger events between the current user and another user.

Example:

```json
{
  "counterparty": {
    "id": "uuid",
    "display_name": "Sameer"
  },
  "current_balance": {
    "direction": "THEY_OWE_ME",
    "amount_minor": 32000
  },
  "items": [
    {
      "type": "PAYMENT_SHARE",
      "session": {
        "id": "uuid",
        "name": "Sunday Mall"
      },
      "payment": {
        "id": "uuid",
        "description": "Dinner"
      },
      "effect_minor": 60000,
      "created_at": "2026-09-20T14:20:00Z"
    },
    {
      "type": "PAYMENT_SHARE",
      "session": {
        "id": "uuid",
        "name": "Sunday Mall"
      },
      "payment": {
        "id": "uuid",
        "description": "Movie"
      },
      "effect_minor": -40000,
      "created_at": "2026-09-20T15:00:00Z"
    },
    {
      "type": "PAYMENT_SHARE",
      "payment": {
        "description": "Coffee"
      },
      "effect_minor": 12000,
      "created_at": "2026-09-20T16:00:00Z"
    }
  ]
}
```

From the authenticated user's perspective:

```text
positive effect = increases amount owed to me
negative effect = increases amount I owe
```

---

# 44. Settlement API

## POST /settlements

Header:

```text
Idempotency-Key: <client-generated-uuid>
```

Request:

```json
{
  "to_user_id": "sameer-user-id",
  "amount_minor": 30000,
  "method": "UPI",
  "note": "Paid through GPay"
}
```

There is no:

```text
from_user_id
```

field.

Backend derives it from authenticated user.

Response:

```json
{
  "id": "uuid",
  "from_user_id": "arif-user-id",
  "to_user_id": "sameer-user-id",
  "amount_minor": 30000,
  "method": "UPI",
  "status": "ACTIVE",
  "created_at": "2026-09-20T20:00:00Z",
  "remaining_balance": {
    "direction": "I_OWE",
    "amount_minor": 20000
  }
}
```

---

# 45. GET /me/settlements

Returns settlements involving current user.

Optional filters:

```text
with_user_id
status
```

---

# 46. POST /settlements/{settlement_id}/void

Only the original `from_user_id` may void the settlement.

Request:

```json
{
  "reason": "Entered twice by mistake"
}
```

Response:

```json
{
  "id": "uuid",
  "status": "VOIDED",
  "voided_at": "2026-09-20T20:10:00Z"
}
```

---

# 47. Error Response Contract

All application errors shall use a consistent structure.

Example:

```json
{
  "error": {
    "code": "SESSION_CLOSED",
    "message": "This outing has already been closed.",
    "details": {}
  },
  "request_id": "uuid"
}
```

`message` is suitable for user-facing presentation where appropriate.

`code` is stable for mobile application logic.

---

# 48. Core Error Codes

Authentication:

```text
AUTH_REQUIRED
INVALID_CREDENTIALS
TOKEN_EXPIRED
TOKEN_INVALID
ACCOUNT_DISABLED
USERNAME_TAKEN
```

Sessions:

```text
SESSION_NOT_FOUND
SESSION_CLOSED
INVALID_JOIN_CODE
ALREADY_ACTIVE_PARTICIPANT
NOT_ACTIVE_PARTICIPANT
SESSION_FINISH_NOT_ALLOWED
```

Payments:

```text
PAYMENT_NOT_FOUND
INVALID_PAYMENT_AMOUNT
INVALID_PAYMENT_PARTICIPANTS
PARTICIPANT_NOT_ACTIVE
INVALID_SPLIT
SPLIT_TOTAL_MISMATCH
PAYMENT_NOT_OWNED
PAYMENT_ALREADY_VOIDED
PAYMENT_IMMUTABLE
```

Settlements:

```text
SETTLEMENT_NOT_FOUND
NO_OUTSTANDING_DEBT
SETTLEMENT_EXCEEDS_DEBT
INVALID_SETTLEMENT_AMOUNT
SETTLEMENT_NOT_OWNED
SETTLEMENT_ALREADY_VOIDED
```

Idempotency:

```text
IDEMPOTENCY_CONFLICT
```

Generic:

```text
VALIDATION_ERROR
RESOURCE_NOT_FOUND
CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

---

# 49. HTTP Status Mapping

Recommended mapping:

```text
200 OK
201 Created
204 No Content

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests
500 Internal Server Error
```

Examples:

```text
INVALID_CREDENTIALS → 401
PAYMENT_NOT_OWNED → 403
SESSION_NOT_FOUND → 404
ALREADY_ACTIVE_PARTICIPANT → 409
SPLIT_TOTAL_MISMATCH → 422
```

---

# 50. Session Privacy

A user may access a session only if:

```text
they currently participate
OR
they previously participated
```

Possessing a session UUID alone does not grant access.

A valid join code allows joining only while the session is ACTIVE.

---

# 51. Participant Visibility

Participants may view:

* current active participants;
* shared session payments;
* payment shares;
* session history relevant to transparency.

The main product experience shall still prioritize personal balances rather than exposing a debt scoreboard.

---

# 52. User Discovery

MVP does not require a global user search or friend-request system.

Users become financially connected through shared sessions.

The Balance screen derives counterparties from actual ledger relationships.

---

# 53. Security Requirements

The backend shall enforce:

```text
authenticated identity
authorization
ownership
session status
participation status
monetary validation
split validation
settlement limits
```

Never trust these values merely because the mobile client provides them.

---

# 54. Password Security

Passwords shall:

* never be logged;
* never be stored in plaintext;
* never be included in audit metadata.

A modern password hashing algorithm shall be used.

Recommended implementation choice for later stages:

```text
Argon2id
```

Exact library configuration will be determined during implementation.

---

# 55. Token Security

Access tokens:

* short-lived;
* sent only through HTTPS.

Refresh tokens:

* longer-lived;
* rotated where practical;
* stored hashed server-side;
* stored securely on the mobile device;
* revocable during logout.

---

# 56. Rate Limiting

MVP backend should support rate limiting particularly for:

```text
login attempts
registration attempts
join-code attempts
```

This prevents trivial brute-force abuse.

The exact storage implementation may initially remain simple.

---

# 57. Pagination

Potentially growing history endpoints shall support pagination.

Examples:

```text
GET /sessions
GET /sessions/{id}/payments
GET /me/settlements
GET /me/balances/{user_id}/ledger
```

Cursor-based pagination is preferred over offset pagination for chronological financial history.

---

# 58. Sorting

Default ordering:

Session history:

```text
newest first
```

Payment history:

```text
newest first
```

Person ledger:

```text
newest first
```

Active participant list:

```text
joined_at ascending
```

---

# 59. Stage 3 API Surface Summary

Authentication:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

Account:

```text
GET /api/v1/me
```

Sessions:

```text
POST /api/v1/sessions
POST /api/v1/sessions/join
GET  /api/v1/sessions
GET  /api/v1/sessions/{session_id}
POST /api/v1/sessions/{session_id}/leave
POST /api/v1/sessions/{session_id}/finish
```

Payments:

```text
POST /api/v1/sessions/{session_id}/payments
GET  /api/v1/sessions/{session_id}/payments
GET  /api/v1/payments/{payment_id}
POST /api/v1/payments/{payment_id}/void
```

Balances:

```text
GET /api/v1/me/balances
GET /api/v1/me/balances/{user_id}
GET /api/v1/me/balances/{user_id}/ledger
```

Settlements:

```text
POST /api/v1/settlements
GET  /api/v1/me/settlements
POST /api/v1/settlements/{settlement_id}/void
```

---

# 60. Explicit Non-API Features

MVP does not provide endpoints for:

```text
friend requests
chat
social feed
GPS
maps
receipt uploads
AI
bank accounts
wallets
payment processing
OTP
SMS
email verification
admin financial editing
global debt simplification
```

---

# 61. First End-to-End Backend Acceptance Test

Users:

```text
Arif
Sameer
Faizan
Imran
```

## Step 1

Arif registers.

Sameer registers.

Faizan registers.

Imran registers.

## Step 2

Arif creates:

```text
Sunday Mall
```

Expected:

```text
session ACTIVE
Arif ACTIVE participant
join code generated
```

## Step 3

Sameer, Faizan and Imran join using the code.

Expected:

```text
4 active participants
```

## Step 4

Arif records:

```text
Dinner ₹2400
4-way equal split
```

Expected shares:

```text
Arif ₹600
Sameer ₹600
Faizan ₹600
Imran ₹600
```

## Step 5

Sameer records:

```text
Movie ₹1600
4-way equal split
```

Expected shares:

```text
₹400 each
```

Arif/Sameer net:

```text
Sameer owes Arif ₹200
```

## Step 6

Faizan leaves.

Expected:

```text
Faizan no longer active
historical shares unchanged
```

## Step 7

Imran records a later payment shared among:

```text
Arif
Sameer
Imran
```

Faizan cannot be selected as an active participant.

## Step 8

Each user retrieves:

```text
GET /me/balances
```

Expected:

Mathematically correct personal balances.

## Step 9

Sameer records a valid partial settlement.

Expected:

Pairwise balance decreases exactly.

## Step 10

Participants leave.

When the final participant leaves or finishes:

```text
session = CLOSED
```

## Step 11

Attempt another payment.

Expected:

```text
SESSION_CLOSED
```

## Step 12

Historical balances and ledger remain accessible.

---

# 62. Database Design Principles Locked

Stage 3 locks the following:

* UUID primary keys;
* UTC `TIMESTAMPTZ`;
* integer minor units for money;
* INR-only MVP;
* immutable historical shares;
* no hard deletion of financial records;
* void + replacement payment corrections;
* time-period session participation;
* global pairwise balances derived from ledger records;
* settlements independent of sessions;
* no authoritative stored user balance;
* idempotency for financial writes;
* backend-enforced authorization;
* PostgreSQL transactional integrity.

---

# 63. API Design Principles Locked

Stage 3 locks:

* REST JSON API;
* `/api/v1` versioning;
* authenticated Bearer access;
* refresh-token authentication;
* payer derived from authenticated user;
* settlement sender derived from authenticated user;
* session join through code;
* no invitation APIs;
* no friend-management APIs;
* no forced participant removal;
* no arbitrary group closing;
* structured stable error codes;
* integer money in all API payloads.

---

# 64. Stage 3 Completion Criteria

Stage 3 is complete when the following are accepted:

* logical entity model;
* relationships;
* monetary representation;
* constraints;
* index strategy;
* payment correction strategy;
* settlement model;
* auth-session model;
* idempotency model;
* audit model;
* endpoint surface;
* request/response shapes;
* error contract;
* transaction boundaries.

The next stage shall be:

# Stage 4 - Mobile UX/UI Specification

Stage 4 will define:

* application navigation;
* onboarding;
* register/login;
* Home;
* Start Outing;
* Join Outing;
* QR scanner;
* Active Outing;
* participant presentation;
* Add Payment;
* equal/custom split interfaces;
* Balances;
* I Owe;
* Owed to Me;
* person-to-person ledger;
* settlement flow;
* leave/rejoin behavior;
* empty states;
* loading/error states;
* Android/iOS interaction consistency.

Production migrations and backend implementation shall begin only after the Stage 4 interaction model is sufficiently defined.
