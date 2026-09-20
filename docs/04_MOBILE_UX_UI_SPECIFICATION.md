# Friend Ledger

## Mobile UX/UI Specification

### Version 1.0

## 1. Purpose

This document defines the authoritative mobile UX/UI behavior for the Friend Ledger MVP.

It translates the approved:

* Product Requirements Baseline
* System & Domain Architecture
* PostgreSQL Logical Data Model
* API Contract Baseline

into the Android and iOS application experience.

This stage defines:

* navigation;
* screens;
* screen states;
* user actions;
* form behavior;
* validation presentation;
* outing workflow;
* payment workflow;
* balance workflow;
* settlement workflow;
* session participation behavior.

It does not define final visual branding, colors, logo, fonts, production React Native components or implementation code.

---

# 2. UX Principles

Friend Ledger shall prioritize:

1. Fast interaction
2. Minimal data entry
3. Clear money information
4. Personal financial perspective
5. Explainable balances
6. Equal Android/iOS behavior
7. No unnecessary social features
8. No unnecessary confirmation workflows

The application should feel closer to a lightweight utility than a social network.

---

# 3. Primary User Journey

The main usage pattern is:

```text
Open App
   ↓
Home
   ↓
Start Outing OR Join Outing
   ↓
Active Outing
   ↓
Add Payments
   ↓
Leave when finished
   ↓
Balances
   ↓
Settle later
```

The user should never need more than a few taps to record a normal shared payment.

---

# 4. Primary Navigation

The main authenticated application shall use four primary areas:

```text
Home
Outings
Balances
Profile
```

Recommended bottom navigation:

```text
┌──────────────────────────────┐
│                              │
│        Current Screen        │
│                              │
├──────────────────────────────┤
│ Home  Outings  Balances  Me  │
└──────────────────────────────┘
```

The exact icon set will be chosen during visual implementation.

---

# 5. Application Startup

When the app launches:

```text
Launch
  ↓
Check stored authentication
  ↓
Valid session?
```

If yes:

```text
Home
```

If no:

```text
Login / Register
```

The application should avoid showing authentication screens repeatedly when a valid refresh session exists.

---

# 6. Splash Screen

Purpose:

* app initialization;
* authentication restoration;
* brief branding presentation.

Contents:

```text
Friend Ledger

Loading...
```

The splash screen must not unnecessarily delay navigation.

---

# 7. First-Time Entry

A new user sees:

```text
Friend Ledger

Split shared spending
without losing track.

[ Create Account ]

Already have an account?
[ Log In ]
```

No long onboarding carousel is required.

---

# 8. Registration Screen

Fields:

```text
Your name
Username
Password
Confirm password
```

Example:

```text
Your name
Arif Ali

Username
arif

Password
••••••••

Confirm password
••••••••

[ Create Account ]
```

Validation should occur inline.

Examples:

```text
Username is already taken.
```

```text
Passwords do not match.
```

```text
Password must meet minimum requirements.
```

Successful registration automatically signs the user in.

---

# 9. Login Screen

Fields:

```text
Username
Password
```

Action:

```text
[ Log In ]
```

Secondary action:

```text
Create Account
```

There is no MVP:

```text
Forgot Password via OTP
Email recovery
Phone recovery
```

unless a later recovery mechanism is deliberately introduced.

---

# 10. Home Screen

The Home screen is the application's operational starting point.

Its most important actions are:

```text
Start Outing
Join Outing
```

Recommended structure:

```text
Good evening, Arif

┌──────────────────────────┐
│ + Start Outing           │
└──────────────────────────┘

┌──────────────────────────┐
│ Scan / Join Outing       │
└──────────────────────────┘
```

Below these actions:

```text
Active Outing
Recent Outings
Balance Summary
```

Only relevant sections should appear.

---

# 11. Home Without Active Outing

Example:

```text
Good evening, Arif

[ + Start Outing ]

[ Scan / Join Outing ]

Your Balance

I owe              ₹550
Owed to me          ₹875

Recent Outings

Sunday Mall
18 Sep

Movie Night
12 Sep
```

The screen should remain uncluttered.

---

# 12. Home With Active Outing

When the user has an active outing, it should become prominent.

Example:

```text
ACTIVE OUTING

Sunday Mall

4 people

Your payments today
₹2,400

[ Open Outing ]

--------------------------

[ + Start Another Outing ]

[ Join Outing ]
```

MVP may permit a user to participate in multiple active sessions, although the UI should emphasize the most recently active one.

---

# 13. Start Outing Screen

The flow should be extremely small.

Screen:

```text
Start Outing

Name
[ Sunday Mall ]

Optional

[ Start Outing ]
```

The name may be empty.

If empty, the app may display a generic title such as:

```text
Outing
```

After creation, immediately navigate to the active outing screen.

---

# 14. Newly Created Outing

After creation:

```text
Sunday Mall
ACTIVE

Invite friends by showing this:

┌───────────────────┐
│                   │
│      QR CODE      │
│                   │
└───────────────────┘

Code

7K4P9X

[ Copy Code ]

Participants

Arif
```

There is no invitation-sending workflow required.

The user physically shows the QR or code to friends.

---

# 15. Join Outing Entry

From Home:

```text
Join Outing

[ Scan QR ]

or

Enter code

[ _ _ _ _ _ _ ]

[ Join ]
```

QR scan is the preferred fast action.

Manual code remains available as fallback.

---

# 16. QR Scanner

QR scanner screen:

```text
Scan Friend Ledger QR

┌─────────────────────────┐
│                         │
│       CAMERA VIEW       │
│                         │
│      ┌───────────┐      │
│      │ scan area │      │
│      └───────────┘      │
│                         │
└─────────────────────────┘

Enter code instead
```

When a valid QR is detected:

```text
Joining...
```

then navigate directly into the outing.

No separate invitation-acceptance flow is needed.

---

# 17. Invalid Join Code

Examples:

```text
This outing code is invalid.
```

```text
This outing has already ended.
```

```text
You're already participating in this outing.
```

The user stays on the join screen and can retry.

---

# 18. Joining Success

Successful join should feel immediate.

Example:

```text
✓ Joined Sunday Mall
```

Then transition directly to the Active Outing screen.

The success state may appear briefly as a toast rather than a separate full screen.

---

# 19. Active Outing Screen

This is one of the most important screens.

Recommended structure:

```text
Sunday Mall                     ACTIVE

4 people

Arif
Sameer
Faizan
Imran

--------------------------------

Your payments
₹2,400

[ + Add Payment ]

--------------------------------

Recent activity

Dinner                    ₹2,400
You

Movie                     ₹1,600
Sameer

Cab                         ₹600
Imran
```

Secondary menu:

```text
Show QR / Code
Leave Outing
```

---

# 20. Participant List

The active participant list shows only users currently participating.

Example:

```text
Participants 4

Arif
Sameer
Faizan
Imran
```

A user who leaves should disappear from the active list.

Historical participation remains available internally.

No dramatic notification is required when someone leaves.

---

# 21. Show Session QR

Any active participant may reopen the join information.

Screen or bottom sheet:

```text
Join Sunday Mall

[ QR CODE ]

7K4P9X

[ Copy Code ]
```

The session creator is not the only person allowed to show the join code.

---

# 22. Add Payment Entry Point

The primary action on an active outing is:

```text
+ Add Payment
```

This should remain large and immediately accessible.

The user should not navigate through an expense-management hierarchy first.

---

# 23. Add Payment Screen

Default layout:

```text
Add Payment

Amount
₹ [ 2400 ]

What was this for?
[ Dinner ]

Shared with

✓ Arif
✓ Sameer
✓ Faizan
✓ Imran

Split

● Equal
○ Custom

[ Save Payment ]
```

The payer is not shown as an editable field.

The backend already knows:

```text
payer = logged-in user
```

---

# 24. Amount Entry

The amount field should:

* open numeric keyboard;
* accept rupees and paise;
* visually format currency;
* reject zero;
* reject negative values.

Example:

```text
₹2,400.00
```

The UI converts this into integer paise before sending to the API.

---

# 25. Payment Description

Description is required.

Examples:

```text
Dinner
Movie
Cab
Coffee
Tickets
Parking
```

The field should remain short.

No category selection is required for MVP.

---

# 26. Shared With Defaults

When opening Add Payment, currently active participants may be selected by default.

Example:

```text
✓ Arif
✓ Sameer
✓ Faizan
✓ Imran
```

The payer may deselect themselves.

Example:

Arif buys a movie ticket only for Sameer:

```text
☐ Arif
✓ Sameer
```

Valid.

---

# 27. Prevent Personal-Only Payments

If the logged-in payer selects only themselves:

```text
✓ Arif
```

the app shall prevent saving.

Message:

```text
Friend Ledger is for shared payments.

Add at least one other person who benefited from this payment.
```

This mirrors server validation.

---

# 28. Equal Split Preview

Example:

```text
Dinner
₹2,400

4 people

Arif       ₹600
Sameer     ₹600
Faizan     ₹600
Imran      ₹600
```

For uneven division:

```text
₹100

Arif       ₹33.34
Sameer     ₹33.33
Imran      ₹33.33
```

The UI may calculate a preview.

The server remains authoritative.

---

# 29. Custom Split

When Custom is selected:

```text
Custom Split

Arif
₹ [ 500 ]

Sameer
₹ [ 700 ]

Faizan
₹ [ 600 ]

Imran
₹ [ 600 ]

-----------------

Assigned
₹2,400

Payment total
₹2,400
```

If mismatch:

```text
₹100 remaining
```

or:

```text
₹50 over
```

Save remains disabled until totals match exactly.

---

# 30. Save Payment

When Save is pressed:

```text
Save Payment
    ↓
Show loading state
    ↓
API request with idempotency key
```

The button must become temporarily disabled to reduce duplicate taps.

Example:

```text
[ Saving... ]
```

On success:

```text
✓ Payment added
```

Return to the Active Outing screen.

---

# 31. Payment Activity Item

Each payment row should show:

```text
Dinner
₹2,400

Arif
8:20 PM
```

If current user is payer:

```text
You
```

may replace their name.

Example:

```text
Dinner                    ₹2,400
You · 8:20 PM
```

---

# 32. Payment Detail Screen

Opening a payment shows:

```text
Dinner

₹2,400

Paid by
Arif

Shared with

Arif       ₹600
Sameer     ₹600
Faizan     ₹600
Imran      ₹600

Sunday Mall
20 Sep · 8:20 PM
```

If current user owns the payment and session is still active:

```text
[ Correct Payment ]
```

or:

```text
[ Void Payment ]
```

---

# 33. Correct Payment UX

Selecting Correct Payment should explain:

```text
Correct this payment?

The original entry will remain in history
and a corrected payment will be created.
```

Then reopen the Add Payment interface prefilled with original values.

On save:

```text
Original payment → VOIDED
Corrected payment → ACTIVE
```

The user should not need to understand the database mechanics.

---

# 34. Voided Payment Display

Voided transactions should remain visible but visually subdued.

Example:

```text
Dinner                    ₹2,400
Voided
```

Opening it shows:

```text
This payment was corrected.

Reason:
Wrong amount entered.
```

If replacement exists:

```text
View corrected payment
```

---

# 35. Leave Outing

Menu action:

```text
Leave Outing
```

Confirmation:

```text
Leave this outing?

You won't be included in future payments.

Your previous payments and balances
will stay unchanged.

[ Cancel ]
[ Leave ]
```

Leaving only affects the current user's participation.

---

# 36. After Leaving

After leaving:

```text
You left Sunday Mall.
```

The session remains accessible as history.

If session remains active, user may see:

```text
[ Rejoin Outing ]
```

when opening it again.

---

# 37. Rejoin Outing

Rejoin confirmation can remain simple:

```text
Rejoin Sunday Mall?

[ Cancel ]
[ Rejoin ]
```

On success, a new participation period begins.

The user becomes eligible for future payments only.

Earlier payment participation remains unchanged.

---

# 38. Last Participant Behavior

If the current user becomes the final active participant:

```text
You're the only person still active in this outing.
```

Options:

```text
[ Finish Outing ]
[ Keep Open ]
```

The user may also use Leave.

If the last active user leaves:

```text
active participants = 0
```

the backend automatically closes the outing.

---

# 39. Finish Outing

Confirmation:

```text
Finish this outing?

No new payments can be added after it ends.

Existing payments and balances will remain.

[ Cancel ]
[ Finish ]
```

The Finish option appears only when backend rules permit it.

---

# 40. Closed Outing Screen

Example:

```text
Sunday Mall
ENDED

20 Sep 2026

Participants
4

Total shared spending
₹4,600

Your payments
₹2,400

[ View Payments ]
```

No:

```text
+ Add Payment
```

No:

```text
Join
```

No:

```text
Rejoin
```

Balances remain available separately.

---

# 41. Outings Tab

The Outings section contains:

```text
Active
Past
```

Example:

```text
Outings

ACTIVE

Sunday Mall
4 people
Today

-----------------

PAST

Movie Night
18 Sep

Dinner
12 Sep
```

Tapping any outing opens its details.

---

# 42. Balances Tab

The Balances screen is the financial center of the app.

Recommended structure:

```text
Balances

[ I OWE ]     [ OWED TO ME ]
```

A segmented control or tabs may be used.

---

# 43. I Owe Screen

Example:

```text
I OWE

Total
₹670

Sameer
₹420

Rahul
₹250
```

If nothing is owed:

```text
You're all settled.

You don't currently owe anyone.
```

---

# 44. Owed to Me Screen

Example:

```text
OWED TO ME

Total
₹1,050

Imran
₹750

Faizan
₹300
```

Empty state:

```text
Nothing pending.

Nobody currently owes you money.
```

---

# 45. Balance Row

Each row shows:

```text
Sameer

You owe ₹420
```

or:

```text
Imran

Owes you ₹750
```

Opening the row enters the pairwise ledger.

---

# 46. Person Ledger Screen

Example:

```text
Sameer

You owe
₹350

[ Settle ]

-----------------------

Sunday Mall

Movie
-₹400

Dinner
+₹600

Coffee
-₹550

-----------------------

Current
-₹350
```

Signs are presented from the current user's perspective.

Positive:

```text
they owe you
```

Negative:

```text
you owe them
```

The UI should preferably use words alongside numbers rather than relying only on signs.

---

# 47. Ledger Item Detail

A ledger item may be opened to display its source payment.

Example:

```text
Dinner
Sunday Mall

Arif paid
₹2,400

Sameer's share
₹600

Effect on your balance with Sameer
+₹600
```

Every balance should remain explainable.

---

# 48. Settlement Entry

When the current user owes someone:

```text
Sameer

You owe
₹500

[ Settle ]
```

Tapping Settle:

```text
Record Payment to Sameer

Amount
₹ [ 500 ]

Method

● UPI
○ Cash
○ Other

Note
[ optional ]

[ Record Settlement ]
```

This does not actually transfer money.

---

# 49. Settlement Amount Rules

Default amount:

```text
full outstanding balance
```

The user may reduce it for partial settlement.

Example:

```text
You owe ₹500

Paying
₹300

Remaining after settlement
₹200
```

The user cannot enter more than current outstanding debt.

---

# 50. Settlement Confirmation

Before recording:

```text
Record ₹300 paid to Sameer via UPI?

Friend Ledger will only record this payment.
It will not transfer money.

[ Cancel ]
[ Confirm ]
```

This clarification is important.

---

# 51. Settlement Success

Example:

```text
✓ Settlement recorded

You still owe Sameer
₹200
```

If fully settled:

```text
✓ You're settled with Sameer
```

---

# 52. Settlement History

Settlement entries appear in the person ledger.

Example:

```text
Dinner               +₹600
Movie                 -₹400
Settlement via UPI    +₹300
```

The effect direction shall be displayed consistently from the current user's perspective.

---

# 53. Void Settlement

A settlement recorded incorrectly may be opened.

Action:

```text
Void Settlement
```

Confirmation:

```text
Void this settlement?

The balance will be recalculated.

[ Cancel ]
[ Void ]
```

The original record remains in history as voided.

---

# 54. Profile Screen

MVP profile screen:

```text
Profile

Arif Ali
@arif

------------------

Account

Username
arif

------------------

Session

Log Out
```

Future settings may appear later.

The profile screen should not become a dumping ground for unnecessary configuration.

---

# 55. Account Summary

A compact financial summary may optionally appear in Profile:

```text
Your Account

I owe
₹670

Owed to me
₹1,050

Net
+₹380
```

This is informational only.

The primary balance workflow remains in the Balances tab.

---

# 56. Logout

Selecting Logout:

```text
Log out of Friend Ledger?

[ Cancel ]
[ Log Out ]
```

Logging out revokes the current refresh session where possible and removes secure local credentials.

---

# 57. Loading States

Every network-backed screen must have a clear loading state.

Example:

```text
Loading outing...
```

Payment submission:

```text
Saving payment...
```

Balance loading:

```text
Updating balances...
```

Loading indicators should not block unrelated navigation unnecessarily.

---

# 58. Error States

Errors should be translated from backend error codes into friendly messages.

Example:

Backend:

```text
SESSION_CLOSED
```

UI:

```text
This outing has already ended.
```

Backend:

```text
PARTICIPANT_NOT_ACTIVE
```

UI:

```text
This person is no longer active in the outing.
```

Backend:

```text
SETTLEMENT_EXCEEDS_DEBT
```

UI:

```text
You currently owe Sameer only ₹500.
```

---

# 59. Network Failure

Example:

```text
Couldn't connect.

Check your internet connection and try again.

[ Retry ]
```

Financial writes must not be shown as successful until the server confirms them.

The client may safely retry using the same idempotency key.

---

# 60. Empty States

Home:

```text
No outings yet.

Start one when you're with friends.
```

Outings:

```text
No past outings.
```

Balances:

```text
You're all settled.
```

Session activity:

```text
No payments yet.

Add the first shared payment.
```

---

# 61. Refresh Behavior

Data should refresh:

* after adding a payment;
* after joining;
* after leaving;
* after settlement;
* when important screens regain focus;
* through pull-to-refresh where useful.

Realtime WebSocket behavior is not required for MVP.

---

# 62. Android and iOS Consistency

Business behavior shall be identical across Android and iOS.

Platform-native differences are permitted for:

* keyboard behavior;
* safe areas;
* back navigation;
* camera permissions;
* secure storage implementation;
* standard platform dialogs.

Financial and session rules must never differ by platform.

---

# 63. Camera Permission

QR scanning requires camera permission.

When first used:

```text
Friend Ledger needs camera access
to scan outing QR codes.
```

If declined:

```text
Camera access is unavailable.

You can still join using the outing code.
```

Manual code entry must always remain available.

---

# 64. Secure Storage

Authentication refresh credentials shall use secure device storage.

Expected technology direction:

```text
Expo SecureStore
```

Ordinary cached presentation data may use appropriate local application storage.

Database credentials are never stored in the mobile application.

---

# 65. Back Navigation

Back navigation must never accidentally:

* save a payment;
* settle money;
* leave an outing;
* finish an outing.

Financial and participation-changing actions require explicit user action.

---

# 66. Destructive Actions

Destructive or irreversible actions include:

```text
Void Payment
Void Settlement
Leave Outing
Finish Outing
Logout
```

Appropriate confirmation shall be used.

Do not overload users with confirmation dialogs for normal navigation.

---

# 67. Amount Presentation

INR display:

```text
₹500
₹1,250
₹2,400.50
```

Amounts with zero paise may omit `.00` in normal UI.

Internal calculations still use paise.

---

# 68. User Identity Presentation

Normal display:

```text
Arif Ali
```

Secondary identity where needed:

```text
@arif
```

This helps distinguish users with identical display names.

---

# 69. Session Name Fallback

If no custom outing name was provided, use:

```text
Outing
```

Optionally accompanied by date:

```text
Outing · 20 Sep
```

No generated humorous or complicated naming system is required.

---

# 70. UX Permission Matrix

| UI Action                  | Visibility                             |
| -------------------------- | -------------------------------------- |
| Start Outing               | Authenticated users                    |
| Join Outing                | Authenticated users                    |
| Add Payment                | Active participants only               |
| Show QR                    | Active participants                    |
| Leave Outing               | Current active participant             |
| Rejoin                     | Previous participant if session active |
| Finish Outing              | Final active participant only          |
| Correct Payment            | Original payer while session active    |
| Void Payment               | Original payer while session active    |
| Settle                     | When current user owes counterparty    |
| Void Settlement            | Settlement creator                     |
| Add another user's payment | Never                                  |

The backend remains the final authority even when the UI hides unavailable actions.

---

# 71. Recommended Screen Inventory

Authentication:

```text
Splash
Welcome
Register
Login
```

Primary application:

```text
Home
Outings
Balances
Profile
```

Session:

```text
Start Outing
Join Outing
QR Scanner
Active Outing
Session QR
Closed Outing
```

Financial:

```text
Add Payment
Custom Split
Payment Detail
Correct Payment
Person Ledger
Record Settlement
Settlement Detail
```

Not every item requires a full standalone route.

Bottom sheets and modals may be used where appropriate.

---

# 72. Navigation Architecture

Recommended React Native / Expo Router conceptual structure:

```text
app/
│
├── (auth)/
│   ├── welcome
│   ├── login
│   └── register
│
├── (tabs)/
│   ├── home
│   ├── outings
│   ├── balances
│   └── profile
│
├── outing/
│   ├── start
│   ├── join
│   ├── scan
│   └── [sessionId]
│
├── payment/
│   └── [paymentId]
│
└── balance/
    └── [userId]
```

This is conceptual rather than final production code.

---

# 73. UX Success Criteria

A successful normal outing should require approximately:

### Starting

```text
Open app
→ Start Outing
→ Start
```

### Joining

```text
Open app
→ Join
→ Scan QR
```

### Adding a common payment

```text
Add Payment
→ Enter amount
→ Description
→ Confirm participants
→ Save
```

The application should resist feature creep that increases these paths unnecessarily.

---

# 74. Primary MVP Demonstration

Four users:

```text
Arif
Sameer
Faizan
Imran
```

Arif opens Home.

Taps:

```text
Start Outing
```

Creates:

```text
Sunday Mall
```

QR/code appears.

Sameer scans.

Faizan enters code.

Imran scans.

All arrive at the same Active Outing.

Arif records:

```text
Dinner ₹2,400
```

Sameer records:

```text
Movie ₹1,600
```

Imran records:

```text
Cab ₹600
```

Faizan leaves.

His name disappears from active participants.

A new payment does not include him.

Later everyone leaves.

Session closes.

On Arif's Balances screen:

```text
I OWE
...
```

and:

```text
OWED TO ME
...
```

are mathematically correct.

Opening a person explains exactly how the balance was created.

A settlement changes the balance without deleting any historical payment.

This represents the core MVP user experience.

---

# 75. Explicitly Deferred UX

Not part of MVP:

```text
Friend requests
Contacts import
Chat
Comments
Emoji reactions
Social feed
Receipt photos
OCR
AI entry
Location
Maps
Push notification center
Automatic UPI verification
Payment gateway
Analytics dashboard
Expense charts
Multi-currency UI
Group administrators
Global debt simplification UI
Web application
```

---

# 76. Stage 4 Locked Decisions

Stage 4 locks:

* mobile-first navigation;
* four main tabs;
* Home as action center;
* session join through QR/code;
* no invitation UX;
* no friend-list dependency;
* no payer selector;
* active-participant-based payment selection;
* equal and custom split interfaces;
* personal I Owe / Owed to Me balance model;
* explainable person ledger;
* settlement recording rather than payment processing;
* individual leave;
* final-user finish;
* session history after closing;
* void/correction UX for financial records;
* consistent Android/iOS behavior.

---

# 77. Stage 4 Completion

With the UX specification approved, the project has completed its pre-implementation design baseline:

```text
Stage 1
Product Requirements
✅

Stage 2
System & Domain Architecture
✅

Stage 3
Data Model & API Contracts
✅

Stage 4
Mobile UX/UI Specification
✅
```

The next stage is:

# Stage 5 - Backend Foundation & Implementation

Stage 5 begins actual code.

Recommended implementation order:

1. Python/FastAPI project initialization
2. configuration/environment system
3. PostgreSQL connection
4. SQLAlchemy models
5. Alembic migrations
6. user registration
7. authentication
8. session creation
9. session join/leave/rejoin
10. payment split engine
11. payment persistence
12. ledger engine
13. balances API
14. settlement engine
15. audit events
16. idempotency
17. automated tests

The mobile application implementation should begin after the core backend domain and API tests are operational.
