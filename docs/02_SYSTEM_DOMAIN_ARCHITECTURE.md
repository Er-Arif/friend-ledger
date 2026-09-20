# Friend Ledger

## System & Domain Architecture Baseline

### Version 1.0

## 1. Purpose

This document defines the authoritative system and domain architecture for the Friend Ledger MVP.

It translates the approved Product Requirements Baseline into technical rules that will later drive:

* PostgreSQL schema design
* API contracts
* backend implementation
* mobile application behavior
* authorization
* ledger calculations
* settlement processing
* automated tests

This document does not define the final physical PostgreSQL schema or production application code.

---

# 2. Architectural Principles

Friend Ledger shall follow these principles:

**Server authority**

The backend is authoritative for sessions, participation, payments, shares, settlements and calculated balances.

The mobile client must never be trusted to determine authorization or final monetary values.

**Ledger over mutable balances**

Balances are derived from financial records.

A mutable `current_balance` value shall not be treated as the financial source of truth.

**Exact money**

All monetary calculations must use integer minor units.

For INR:

```text
₹1.00 = 100 paise
₹2400.00 = 240000 paise
```

Floating-point arithmetic shall not be used for money.

**User ownership**

A user controls their own participation and records only money they personally paid.

**Historical preservation**

Leaving a session, closing a session or settling a debt shall never erase the original financial history.

**Simple centralized architecture**

The MVP shall use one backend application and one PostgreSQL database.

No microservices are required.

---

# 3. High-Level System Architecture

```text
┌───────────────────────┐
│ Android / iOS App     │
│ React Native + Expo   │
│ TypeScript            │
└───────────┬───────────┘
            │
            │ HTTPS
            ▼
┌───────────────────────┐
│ FastAPI Backend       │
│                       │
│ Authentication        │
│ Sessions              │
│ Participation         │
│ Payments              │
│ Ledger                │
│ Balances              │
│ Settlements           │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ PostgreSQL            │
└───────────────────────┘
```

Development:

```text
Mobile App
    ↓
Local FastAPI
    ↓
Local PostgreSQL
```

Beta/production:

```text
Mobile App
    ↓
Internet
    ↓
Railway FastAPI
    ↓
Railway PostgreSQL
```

---

# 4. Application Architecture Style

The backend shall be implemented as a modular monolith.

Logical modules:

```text
auth
users
sessions
participation
payments
ledger
balances
settlements
```

These modules shall exist inside one FastAPI application and share one PostgreSQL database.

The project shall not introduce microservices, message brokers or distributed infrastructure for MVP.

---

# 5. Core Domain Entities

The core domain consists of:

```text
User
Session
SessionParticipation
Payment
PaymentShare
Settlement
```

Balances are calculated domain projections rather than primary financial records.

---

# 6. User

A `User` represents a registered Friend Ledger account.

Conceptual attributes:

```text
User
--------------------------------
id
display_name
username
password_hash
created_at
updated_at
status
```

`id` is the permanent internal identity.

Username is used for authentication and user identification.

Passwords shall never be stored directly.

The creator of a session is still an ordinary user after session creation.

There shall be no permanent session administrator or financial administrator role in MVP.

---

# 7. Authentication

Authentication shall use:

```text
username
password
```

After successful login, the backend shall issue authenticated session credentials or tokens.

Recommended architecture:

```text
short-lived access token
+
longer-lived refresh token
```

The exact token implementation will be finalized during API/security design.

Passwords shall be securely hashed using an appropriate password-hashing algorithm.

No OTP, email verification, phone verification or external identity provider is required.

Password recovery is not part of the initial MVP unless a separate local recovery-code mechanism is deliberately added later.

---

# 8. Session

A `Session` represents one outing.

Examples:

```text
Sunday Mall
Dinner
Movie Night
City Centre
Weekend Trip
```

Conceptual attributes:

```text
Session
--------------------------------
id
name
join_code
created_by
created_at
closed_at
status
```

Session status:

```text
ACTIVE
CLOSED
```

A newly created session starts as `ACTIVE`.

The user creating the session automatically becomes its first active participant.

`created_by` exists for historical information only.

It does not grant special authority.

---

# 9. Join Code

Every active session shall have an opaque join code.

The code must:

* be difficult enough to prevent trivial guessing;
* be easy to enter manually;
* uniquely resolve to an active session;
* stop working after the session is closed.

A short alphanumeric format is preferred over a purely sequential identifier.

Example:

```text
7K4P9X
```

Ambiguous characters may be excluded.

For example:

```text
0
O
1
I
```

Join attempts shall eventually be rate-limited at the API layer.

---

# 10. QR Architecture

The QR code is simply another representation of the session join information.

The QR shall not contain:

* passwords;
* authentication tokens;
* financial information;
* private account credentials.

Conceptually it may contain:

```text
friendledger://join/7K4P9X
```

or an equivalent internal join payload.

QR generation occurs inside the mobile application.

No external QR service is required.

Scanning a valid QR leads to the same backend join operation as manually entering the join code.

---

# 11. Session Participation

Participation shall not be represented by a single permanent membership flag.

A user may:

```text
join
leave
rejoin
leave again
```

Therefore participation must preserve time periods.

Conceptual model:

```text
SessionParticipation
--------------------------------
id
session_id
user_id
joined_at
left_at
```

An active participation has:

```text
left_at = null
```

A completed participation has a `left_at` value.

Example:

```text
Arif
18:00 → 20:00

Arif
20:30 → 22:00
```

These are two participation periods belonging to the same user and session.

---

# 12. Joining Rule

To join a session:

```text
Authenticated User
        ↓
Enters code / scans QR
        ↓
Backend validates session
        ↓
Backend creates active participation
        ↓
User becomes ACTIVE participant
```

Joining is allowed only when the session is `ACTIVE`.

A user who already has an active participation cannot join again.

A user who previously left may rejoin by creating a new participation period.

No creator approval is required.

---

# 13. Leaving Rule

A participant may leave only their own active participation.

The backend performs:

```text
current participation.left_at = current time
```

Leaving does not alter:

* previous payments;
* previous shares;
* previous settlements;
* historical balances.

Leaving only changes eligibility for future session activity.

---

# 14. Session Closing

No ordinary participant may close a session while multiple other active participants remain.

The normal lifecycle is:

```text
Several participants
        ↓
Users leave individually
        ↓
One participant remains
        ↓
Final participant may Finish
```

Alternatively:

```text
Final participant chooses Leave
        ↓
Active participant count = 0
        ↓
System automatically closes session
```

The backend must enforce this rule.

A malicious or modified mobile client must not be able to bypass it.

Session closing means:

```text
status = CLOSED
closed_at = timestamp
```

After closing:

* joining is prohibited;
* rejoining is prohibited;
* new payments are prohibited;
* existing history remains available;
* balances remain valid;
* settlements may still occur.

---

# 15. Active Participant Definition

A user is active in a session when an active participation exists:

```text
joined_at <= current_time
AND
left_at IS NULL
```

Only active participants may create new session payments.

Payment participants must normally be selected from the currently active users in that session.

---

# 16. Payment

A `Payment` represents money actually paid by the authenticated user on behalf of one or more people.

Conceptual structure:

```text
Payment
--------------------------------
id
session_id
payer_user_id
description
total_amount_minor
created_at
status
```

The backend derives:

```text
payer_user_id = authenticated_user.id
```

The client shall not be allowed to submit an arbitrary payer identity.

There is no normal `Paid By` selector.

---

# 17. Payment Validity

A valid payment must:

* belong to an active session;
* be created by an active participant;
* have an amount greater than zero;
* include at least one selected participant;
* involve at least one person other than the payer;
* have valid participant shares;
* have shares whose total exactly equals the payment amount.

This prevents Friend Ledger from becoming a personal expense tracker.

Example rejected transaction:

```text
Arif pays ₹500
Only participant: Arif
```

There is no shared financial relationship, so it should not be recorded.

---

# 18. Payment Participants

The payer may or may not participate in the expense.

Example A:

```text
Dinner ₹2,400

Arif
Sameer
Faizan
Imran
```

Arif paid and also consumed part of the dinner.

Example B:

```text
Movie ticket ₹500

Paid by Arif
Participant: Sameer only
```

Arif paid entirely on Sameer's behalf.

Both are valid.

---

# 19. PaymentShare

Every payment shall produce explicit persisted participant shares.

Conceptual entity:

```text
PaymentShare
--------------------------------
id
payment_id
user_id
amount_minor
```

Example:

```text
Payment = ₹2,400

Arif     ₹600
Sameer   ₹600
Faizan   ₹600
Imran    ₹600
```

The shares stored at creation time become part of the historical financial record.

Future changes to split algorithms must not recalculate old payments.

---

# 20. Equal Split Algorithm

Money is represented as integer paise.

Example:

```text
₹100 = 10000 paise
```

For `N` participants:

```text
base_share = total_minor DIV N
remainder  = total_minor MOD N
```

Example:

```text
10000 DIV 3 = 3333
remainder = 1
```

Shares become:

```text
3334
3333
3333
```

or:

```text
₹33.34
₹33.33
₹33.33
```

Total remains exactly:

```text
₹100.00
```

Remainder allocation must be deterministic.

Recommended order:

```text
1. payer, if payer participates
2. remaining participants ordered by participation join time
3. user ID as final stable tie-breaker
```

The server performs the final calculation.

The client may preview the split but is not authoritative.

---

# 21. Custom Split

For custom amount splitting, the client submits the desired participant amounts.

The backend validates:

```text
SUM(shares) = payment total
```

Every share must be non-negative.

At least one person other than the payer must have a positive share.

Invalid custom splits are rejected.

---

# 22. Financial Source of Truth

The financial source of truth consists of:

```text
Payments
PaymentShares
Settlements
```

Balances are derived from these records.

Friend Ledger shall not depend on manually maintained mutable balances such as:

```text
users.balance
```

or:

```text
friend_balances.current_amount
```

as authoritative financial records.

Such values may later exist as caches or projections for performance, but must always be rebuildable from the ledger.

---

# 23. Pairwise Debt Calculation

For users A and B, payments create directional obligations.

If A pays an amount containing B's share:

```text
B owes A
```

Example:

```text
Arif pays ₹1,500.

Shares:
Arif   ₹500
Sameer ₹500
Imran  ₹500
```

Ledger effects:

```text
Sameer → Arif ₹500
Imran  → Arif ₹500
```

Arif's own ₹500 share creates no debt to himself.

---

# 24. Cross-Session Net Balance

The pairwise balance between two users is calculated across all relevant payments and settlements.

Example:

Session 1:

```text
Arif owes Sameer ₹200
```

Session 2:

```text
Sameer owes Arif ₹500
```

Net position:

```text
Sameer owes Arif ₹300
```

The original session transactions remain unchanged.

Only the displayed aggregate balance is netted.

---

# 25. Balance Direction

For the currently authenticated user:

Positive receivable:

```text
Other person owes me
```

Negative position:

```text
I owe other person
```

The mobile interface shall translate this into:

```text
I OWE
```

and:

```text
OWED TO ME
```

Users do not need to understand positive/negative accounting signs.

---

# 26. Balance Projection

A conceptual balance query for user A calculates all pairwise ledger movements involving A.

For each other user B:

```text
amount B owes A
-
amount A owes B
+
settlement effects
```

The resulting value determines the displayed direction.

No transaction is deleted simply because opposite-direction transactions cancel mathematically.

---

# 27. Direct Debt Preservation

The system shall not perform multi-party debt redirection.

Example:

```text
Arif → Sameer ₹500
Sameer → Imran ₹500
```

shall remain two relationships.

The MVP shall not rewrite this as:

```text
Arif → Imran ₹500
```

Pairwise netting occurs only between the same two users.

---

# 28. Settlement

A `Settlement` represents repayment from one user to another.

Conceptual structure:

```text
Settlement
--------------------------------
id
from_user_id
to_user_id
amount_minor
method
created_at
created_by
```

Supported MVP methods:

```text
CASH
UPI
OTHER
```

Friend Ledger records the repayment.

Friend Ledger does not transfer the money.

---

# 29. Settlement Ownership

A settlement is normally recorded by the person who actually paid the repayment.

Example:

```text
Arif owes Sameer ₹500.

Arif pays Sameer ₹300 through UPI.
```

Arif records:

```text
from = Arif
to = Sameer
amount = ₹300
```

The backend derives `from_user_id` from the authenticated user.

A user shall not normally create a settlement claiming another person made the repayment.

---

# 30. Partial Settlement

Partial settlement is supported.

Example:

Before:

```text
Arif owes Sameer ₹500
```

Settlement:

```text
Arif → Sameer ₹300
```

After:

```text
Arif owes Sameer ₹200
```

---

# 31. Settlement Validation

For MVP, a settlement should not exceed the current amount the authenticated user owes the recipient.

Example:

Current:

```text
Arif owes Sameer ₹500
```

Valid:

```text
₹100
₹300
₹500
```

Rejected:

```text
₹700
```

This prevents accidental balance reversal through a settlement entry.

If users genuinely need to record another financial transaction, it should be represented through the appropriate payment mechanism rather than an oversized settlement.

---

# 32. Settlement Scope

Settlements are person-to-person financial records.

They are not required to belong to one specific outing because the displayed debt may be aggregated across several outings.

Example:

```text
Mall        ₹200 owed
Dinner      ₹300 owed

Total       ₹500 owed
```

A single ₹500 settlement may settle both economically.

The historical outing records remain unchanged.

---

# 33. Payment Modification Policy

Financial history requires controlled correction.

During an `ACTIVE` session, the payer may correct or void a payment they created.

A user cannot modify another user's payment.

Once a session becomes `CLOSED`, its payments become immutable in MVP.

This gives users time to correct mistakes during the outing while preventing old historical outings from being silently rewritten later.

Any payment correction mechanism must retain sufficient history to identify that a change occurred.

Physical implementation may use:

```text
revision history
```

or:

```text
void + replacement
```

The exact database design will be finalized during Stage 3.

Hard deletion of committed financial history shall not be used.

---

# 34. Session Transaction Visibility

Users who participate in a session may view the shared transaction history of that session for transparency and verification.

The main Home and Balance interfaces remain user-centric.

The application should emphasize:

```text
I OWE
OWED TO ME
```

rather than presenting everyone with a global financial scoreboard.

Shared session history exists primarily so participants can verify what was recorded.

---

# 35. Authorization Rules

Authorization shall be enforced by the backend.

Conceptual rules:

| Action                      | Allowed User                                      |
| --------------------------- | ------------------------------------------------- |
| Create session              | Any authenticated user                            |
| Join session                | Authenticated user with valid active join code    |
| Leave session               | That participant only                             |
| Rejoin session              | Same authenticated user                           |
| Create payment              | Active participant                                |
| Set payer                   | Backend only                                      |
| Edit payment                | Original payer only, while allowed                |
| View session history        | Session participant                               |
| Record settlement           | User making the repayment                         |
| Finish session              | Only when server closing conditions are satisfied |
| Remove another participant  | Nobody in MVP                                     |
| Force another user to leave | Nobody in MVP                                     |

The client hiding a button is not authorization.

The API must independently enforce every rule.

---

# 36. Transaction Boundaries

Critical operations shall execute atomically inside PostgreSQL transactions.

### Create Payment

One transaction must create:

```text
Payment
+
all PaymentShares
```

Either all records commit or none commit.

A payment must never exist with only some shares saved.

### Join Session

Validation and creation of the active participation must occur atomically.

### Leave Session

Closing the participation and evaluating session auto-close conditions must occur consistently.

### Settlement

Outstanding balance validation and settlement creation must be handled atomically.

---

# 37. Idempotency

Mobile networks are unreliable.

A user may tap Save once while the client retries the request.

Without protection, this could create:

```text
Dinner ₹2400
Dinner ₹2400
```

twice.

Financial mutation endpoints should therefore support idempotent request handling.

Each mutation may carry a unique client request identifier.

If the same request is received again, the server returns the original result rather than creating another financial record.

This is especially important for:

```text
payments
settlements
session creation
```

---

# 38. Concurrency

Multiple friends may perform actions simultaneously.

Example:

```text
Arif adds dinner
Sameer adds parking
Imran leaves
```

at nearly the same time.

The backend must not rely on the order in which screens happen to refresh.

PostgreSQL transactions, constraints and server-side validation shall protect invariants.

Important invariants include:

```text
payment shares sum exactly to payment total
```

```text
one user cannot have multiple simultaneous active participations in the same session
```

```text
closed sessions reject new payments
```

```text
settlement cannot exceed valid outstanding debt
```

---

# 39. Server Time

Authoritative timestamps shall be generated or validated by the backend/database.

The system must not rely solely on a phone's local clock.

This prevents incorrect timelines caused by:

* wrong device time;
* timezone settings;
* deliberate clock manipulation.

Times should be stored using timezone-aware UTC timestamps.

The mobile application may display them in the device's local timezone.

---

# 40. Session Lifecycle

Canonical lifecycle:

```text
CREATE
  ↓
ACTIVE
  ↓
Participants join / leave / rejoin
  ↓
Active participant count reaches 1
  ↓
Final participant may Finish

OR

Final participant leaves
  ↓
Active participant count reaches 0
  ↓
AUTO CLOSE
  ↓
CLOSED
```

A `CLOSED` session never returns to `ACTIVE` in MVP.

---

# 41. Participant Lifecycle

```text
Not participating
       ↓
      JOIN
       ↓
     ACTIVE
       ↓
      LEAVE
       ↓
      LEFT
       ↓
 optional REJOIN
       ↓
     ACTIVE
```

Each rejoin creates another participation period rather than overwriting the previous period.

---

# 42. Payment Lifecycle

Recommended conceptual lifecycle:

```text
CREATED
   ↓
ACTIVE
```

During the session, correction may result in:

```text
REVISED
```

or:

```text
VOIDED
```

depending on the Stage 3 implementation.

After session close, financial payment history becomes immutable.

---

# 43. Settlement Lifecycle

MVP settlements are simple ledger records.

Conceptually:

```text
RECORDED
```

No payment gateway means there is no external asynchronous payment state such as:

```text
PROCESSING
FAILED
REFUNDED
```

Those states are unnecessary.

---

# 44. Ledger Explainability

Every balance shown to the user must be traceable to ledger events.

Example:

```text
Sameer owes you ₹320
```

Opening Sameer must allow the application to explain this using items such as:

```text
Dinner          +₹600
Movie           -₹400
Coffee          +₹120
Settlement       ₹0
----------------------
Net             +₹320
```

The exact UI is defined later.

The architectural requirement is that sufficient underlying data exists to produce this explanation.

---

# 45. Derived Data

The following should normally be derived:

```text
total I owe
total owed to me
pairwise balance
session total spend
amount paid by user
amount consumed by user
current active participant count
```

These values may later be cached for performance but are not authoritative ledger records.

---

# 46. Database Responsibility

PostgreSQL shall be responsible for:

* persistent identity;
* sessions;
* participation periods;
* payments;
* payment shares;
* settlements;
* integrity constraints;
* durable timestamps;
* transaction consistency.

The database should enforce critical invariants where practical.

Application validation alone is insufficient for financial integrity.

---

# 47. Backend Responsibility

FastAPI shall be responsible for:

* authentication;
* authorization;
* domain validation;
* session lifecycle;
* split calculation;
* balance calculation;
* settlement validation;
* transaction orchestration;
* idempotency;
* API responses.

Business logic should not be buried inside route handlers.

Routes should delegate to domain/application services.

---

# 48. Mobile Responsibility

The React Native application shall be responsible for:

* registration/login UI;
* session creation UI;
* QR generation;
* QR scanning;
* join-code entry;
* participant display;
* payment entry;
* split preview;
* balance display;
* settlement entry;
* local navigation;
* secure credential storage;
* presentation formatting.

The mobile application may calculate previews for responsiveness, but final financial calculations remain server-authoritative.

---

# 49. Suggested Backend Module Structure

```text
backend/
└── app/
    ├── api/
    ├── auth/
    ├── users/
    ├── sessions/
    ├── payments/
    ├── ledger/
    ├── settlements/
    ├── db/
    ├── core/
    └── tests/
```

More detailed packaging will be finalized during implementation.

The architecture should remain understandable rather than introducing unnecessary abstraction layers.

---

# 50. Ledger Service

The backend should contain a dedicated ledger/balance service responsible for calculations such as:

```text
calculate_pair_balance(A, B)

calculate_user_balances(A)

calculate_session_payment_effect(payment)

apply_settlement_effect(settlement)
```

API endpoints shall not contain duplicated balance formulas.

There must be one authoritative calculation implementation.

---

# 51. Split Service

Payment splitting should be isolated into its own domain logic.

Conceptually:

```text
split_equal(total, participants)

validate_custom_split(total, shares)
```

The same implementation shall be exercised by automated tests.

---

# 52. Realtime Behavior

Realtime infrastructure is not required for correctness in MVP.

The initial app may refresh data:

* after the current user performs an action;
* when a screen regains focus;
* through pull-to-refresh;
* through lightweight periodic refresh if required.

The architecture may later support WebSockets or another realtime channel.

Financial correctness must never depend on WebSocket delivery.

The backend/database remain authoritative.

---

# 53. Offline Behavior

MVP is online-first.

Creating or mutating financial records requires backend connectivity.

The app may display previously loaded information when offline, but it shall not pretend an unsynchronized payment has been committed.

Offline transaction queues and conflict resolution are deferred.

---

# 54. Security Boundaries

The mobile application is considered an untrusted client.

A modified app must not be able to:

* specify another payer;
* leave another participant;
* create payments in a closed session;
* join a closed session;
* create invalid shares;
* settle somebody else's debt;
* exceed an outstanding settlement balance;
* close a session in violation of session rules.

Every such condition is verified server-side.

---

# 55. Secrets

The mobile application shall not contain:

* PostgreSQL credentials;
* database passwords;
* Railway database connection strings;
* backend private signing secrets.

The mobile app knows only the public backend API address and its authenticated user credentials/tokens.

Only FastAPI communicates directly with PostgreSQL.

---

# 56. Audit Requirements

Important financial actions shall retain:

```text
actor
action
entity
timestamp
relevant previous/new state where required
```

At minimum the system must always determine:

* who created a payment;
* who received each share;
* who changed or voided a payment;
* who recorded a settlement;
* when each action occurred.

Detailed audit-table implementation is deferred to Stage 3.

---

# 57. Error Philosophy

Financial operations shall fail clearly rather than silently guessing.

Examples:

```text
Session is already closed.
```

```text
You are no longer an active participant.
```

```text
Custom shares total ₹999.99 but payment total is ₹1,000.00.
```

```text
You currently owe Sameer ₹500.00. A settlement of ₹700.00 cannot be recorded.
```

The server should return structured error codes suitable for friendly mobile messages.

---

# 58. MVP Performance Expectations

Friend Ledger is expected to have relatively small groups and transaction volumes.

Architecture shall prioritize:

```text
correctness
simplicity
maintainability
auditability
```

over premature high-scale optimization.

PostgreSQL and a single FastAPI deployment are more than adequate for the initial product.

---

# 59. Testing Architecture

Domain logic must be independently testable.

Critical automated test categories shall include:

```text
equal split rounding
custom split validation
payer excluded from split
late join
leave
rejoin
session auto-close
closed-session rejection
cross-session netting
partial settlements
opposite-direction debts
settlement limits
duplicate request protection
simultaneous operations
authorization violations
```

The financial engine shall have extensive unit tests before the mobile interface is considered production-ready.

---

# 60. Example End-to-End Domain Flow

Users:

```text
Arif
Sameer
Faizan
Imran
```

Arif creates session:

```text
Sunday Mall
```

Backend:

```text
Session = ACTIVE
Arif participation = ACTIVE
Join code generated
```

Sameer, Faizan and Imran join.

Arif records:

```text
Dinner ₹2400
```

Participants:

```text
Arif
Sameer
Faizan
Imran
```

Shares:

```text
₹600 each
```

Ledger effect:

```text
Sameer owes Arif ₹600
Faizan owes Arif ₹600
Imran owes Arif ₹600
```

Sameer records:

```text
Movie ₹1600
```

Four shares:

```text
₹400 each
```

Ledger effects include:

```text
Arif owes Sameer ₹400
Faizan owes Sameer ₹400
Imran owes Sameer ₹400
```

Pairwise Arif/Sameer net:

```text
Sameer owes Arif ₹600
Arif owes Sameer ₹400

Net:
Sameer owes Arif ₹200
```

Faizan leaves.

A later payment cannot automatically include Faizan.

Eventually all participants leave.

The session closes.

Balances remain available.

If Sameer later pays Arif ₹200 and records the settlement:

```text
Sameer → Arif ₹200
```

their pairwise balance becomes:

```text
₹0
```

The original dinner and movie records remain permanently available.

---

# 61. Architectural Decisions Locked by Stage 2

The following decisions are authoritative for MVP:

```text
Mobile-only user product
Android + iOS
React Native + Expo + TypeScript
FastAPI backend
PostgreSQL database
Railway production hosting
No custom domain requirement
No OTP
Username/password authentication
Centralized online ledger
Session join through QR or code
No invitation system
No session owner privilege
Users leave themselves only
No forced removal
No forced group closure
Payer always equals authenticated creator
Personal-only expenses are excluded
Money stored/calculated in integer minor units
Payment shares persisted
Balances derived from ledger records
Cross-session pairwise netting
No three-party debt simplification
Settlements do not process money
Closed-session payment history is immutable
Backend authorization is authoritative
```

---

# 62. Stage 2 Completion Criteria

Stage 2 is complete when the team accepts:

* the domain entities;
* lifecycle rules;
* source-of-truth model;
* payment ownership rules;
* monetary representation;
* splitting architecture;
* balance calculation approach;
* settlement model;
* authorization boundaries;
* transaction and concurrency model.

The next stage shall translate this architecture into:

**Stage 3 - PostgreSQL Logical Data Model and API Contract Baseline**

Stage 3 shall define:

```text
tables
relationships
keys
constraints
indexes
logical column types
API endpoints
request contracts
response contracts
error contracts
authentication contracts
```

without yet building the complete mobile interface.
