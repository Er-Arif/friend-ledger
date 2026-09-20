# Friend Ledger

## Product Requirements Baseline

### Version 1.0 — MVP Draft

## 1. Product Purpose

Friend Ledger is a mobile application for groups of friends who spend money together during outings such as restaurants, shopping trips, malls, movies, travel, cafés, and similar activities.

The application solves the problem of one person paying for shared expenses and the group later forgetting:

* who paid;
* who participated in a particular expense;
* how much each person owes;
* who still needs to receive money;
* which amounts have already been settled.

Friend Ledger records shared payments during an outing and maintains an accurate person-to-person financial ledger.

The application does not act as a bank, wallet, payment processor, or personal expense tracker.

---

# 2. Supported Platforms

The user-facing product shall be a mobile application.

Supported platforms:

* Android
* iOS

The same application and business rules shall operate on both platforms.

Technology baseline:

* React Native
* Expo
* TypeScript

There shall be no user-facing web application in MVP.

---

# 3. Backend Baseline

The mobile application shall communicate through the internet with a centralized backend.

Technology baseline:

* FastAPI
* Python
* PostgreSQL

Development environment:

* Backend and PostgreSQL may initially run locally.

Beta/production environment:

* FastAPI and PostgreSQL shall be hosted on Railway.

A custom domain is not required.

---

# 4. User Account

Every participant must have an account before participating in an outing.

MVP registration shall be intentionally simple.

Required information:

* Display name
* Unique username
* Password

The system shall assign every account a permanent internal user identifier.

MVP shall NOT require:

* Mobile number
* Email address
* OTP
* Google authentication
* Apple authentication
* Social-media authentication

Users should normally remain signed in on their device after successful authentication.

---

# 5. Fundamental Ownership Rule

A user controls only:

* their own account;
* their own session participation;
* payments they personally record as having paid;
* settlements involving their account.

A user shall not have authority to:

* make another user join;
* remove another participant;
* make another participant leave;
* record another participant as the payer of a payment;
* close an active outing for everybody else.

The creator of an outing does not receive special financial authority.

---

# 6. Outing / Session

The user-facing term shall be:

**Outing**

The internal technical/domain term may be:

**Session**

Any authenticated user may start an outing.

Starting an outing shall immediately create an active session and automatically add its creator as the first participant.

An outing may optionally have a user-friendly name, for example:

* Sunday Mall
* Dinner
* Movie Night
* City Centre
* Weekend Trip

---

# 7. Session Join Mechanism

When an outing is created, the system shall generate:

* a short session/join code;
* a QR code representing the session.

Another authenticated user may join by:

1. scanning the QR code; or
2. manually entering the join code.

No invitation system shall be required.

No approval from the creator shall be required.

No separate confirmation workflow shall be required.

Successfully scanning or entering a valid session code and selecting Join constitutes the user's voluntary participation in that session.

---

# 8. Session Participation

Every participant shall have participation history.

The system must record at minimum:

* session;
* user;
* joined timestamp;
* left timestamp.

A participant may leave an outing at any time.

Leaving shall affect future participation only.

Leaving shall NOT:

* delete previous payments;
* delete previous shares;
* change earlier balances;
* remove historical participation.

A participant may later rejoin the same active outing.

Rejoining creates a new participation period instead of modifying historical participation.

Example:

Arif:

* Joined 18:00
* Left 20:00
* Rejoined 20:30
* Left 22:00

---

# 9. Late Joining

A participant who joins after an outing has already started shall not automatically become responsible for earlier payments.

Example:

* Dinner recorded at 18:30
* Faizan joins at 19:00

Faizan shall not be added retrospectively to the dinner payment.

---

# 10. Leaving Early

A participant who leaves shall no longer appear as an active participant for new payments.

Example:

* Sameer leaves at 21:00
* Cab payment recorded at 21:30

Sameer shall not automatically participate in the cab payment.

Previous payments involving Sameer remain unchanged.

---

# 11. Session Closing

No participant shall have a normal action that closes an active outing for all other active participants.

Each participant leaves independently.

When no active participants remain, the system may automatically close the outing.

If only one active participant remains, the application may provide that user with:

**Finish Outing**

Finishing an outing shall:

* mark the session closed;
* prevent new payments from being recorded in that session;
* preserve all historical payments;
* preserve all balances;
* preserve all settlements.

Closing an outing does NOT mean that all debts have been settled.

---

# 12. Shared Payment Definition

Friend Ledger records shared financial transactions.

A payment should be recorded when one user has paid money involving one or more other users.

Examples:

Valid:

* Arif pays a restaurant bill shared with Sameer and Imran.
* Sameer pays for Arif's movie ticket.
* Imran pays a taxi fare shared with three friends.
* Faizan temporarily pays for an item purchased for Arif.

Not relevant:

* Arif buys something only for himself and pays himself.
* Sameer buys his own coffee with his own money.

Friend Ledger is not intended to track personal spending.

---

# 13. Payment Ownership

A payment shall always belong to the authenticated user who records it.

Therefore:

**payer = authenticated user**

The Add Payment interface shall NOT contain a normal "Paid By" selector.

A user cannot claim through the standard workflow that another person paid an expense.

If Sameer paid, Sameer should record the payment from Sameer's account.

---

# 14. Adding a Payment

A payment shall contain at minimum:

* session;
* payer;
* amount;
* description;
* selected participants;
* split method;
* calculated share for every selected participant;
* creation timestamp.

The payer may also be included in the split where appropriate.

Example:

Restaurant bill:

₹2,400

Participants:

* Arif
* Sameer
* Faizan
* Imran

Equal split:

₹600 each.

Because Arif paid ₹2,400:

* Arif funded ₹2,400.
* Arif consumed ₹600.
* Sameer owes ₹600.
* Faizan owes ₹600.
* Imran owes ₹600.

---

# 15. Split Methods

MVP shall support:

### Equal Split

The selected participants share the payment equally.

### Custom Amount Split

The payer may assign an exact amount to each selected participant.

The total of all participant shares must equal the payment total.

Future versions may add:

* percentage split;
* share/ratio split.

These are not required for MVP.

---

# 16. Monetary Precision

Money shall never be calculated using binary floating-point values.

Amounts shall be represented using exact monetary values.

For Indian rupees, calculations should support paise.

Example:

₹100 split among three users must result in shares whose exact total remains ₹100.

A valid result could be:

* ₹33.34
* ₹33.33
* ₹33.33

Total:

₹100.00

The application must define deterministic rounding rules.

---

# 17. Payment Shares

The system shall persist the calculated monetary share of each participant at the time a payment is created.

Example:

Payment:

₹2,400

Stored payment shares:

* Arif: ₹600
* Sameer: ₹600
* Faizan: ₹600
* Imran: ₹600

Historical payments must not change simply because splitting logic is modified in a future application version.

---

# 18. Personal Balance Model

The main financial experience shall be user-centric.

Users primarily need to answer:

1. Who do I owe?
2. Who owes me?

The application shall therefore provide two primary balance views:

### I Owe

Displays people to whom the current user owes money.

Example:

Sameer ₹420
Rahul ₹250

### Owed to Me

Displays people who owe money to the current user.

Example:

Imran ₹750
Faizan ₹300

The interface should not unnecessarily expose a global debt leaderboard.

---

# 19. Cross-Outing Balance

Balances between two users may span multiple outings.

Example:

Outing A:

Arif owes Sameer ₹200.

Outing B:

Sameer owes Arif ₹500.

Their current relationship becomes:

Sameer owes Arif ₹300.

The original outings and payments shall remain visible in history.

The aggregate balance is derived from the underlying ledger.

---

# 20. Person-to-Person Ledger

A user must be able to select another person and understand exactly why money is owed.

Example:

Sameer

Current balance:

You owe Sameer ₹350.

Ledger:

* Movie ticket: -₹400
* Dinner: +₹600
* Coffee: -₹550

Net:

-₹350

Balances shall always be explainable through underlying transactions.

The application must not display unexplained or opaque debt totals.

---

# 21. Settlements

Users shall be able to record that money has been repaid.

MVP settlement methods may include:

* Cash
* UPI
* Other

The application does not process the payment itself.

The system records the settlement in the ledger.

Example:

Before:

Arif owes Sameer ₹500.

Arif records settlement:

₹300.

After:

Arif owes Sameer ₹200.

Settlements must not delete or modify the original expense records.

---

# 22. Direct Debt Preservation

MVP shall preserve actual person-to-person financial relationships.

Example:

Arif owes Sameer ₹500.

Sameer owes Imran ₹500.

The system shall NOT automatically transform this into:

Arif owes Imran ₹500.

Future versions may introduce an optional balance-simplification feature.

It shall not be part of the default MVP ledger behavior.

---

# 23. Core Mobile Navigation

The MVP should remain compact.

Expected primary areas:

* Home
* Outing
* Balances
* Profile

The exact UX structure will be defined during the UX stage.

---

# 24. Expected Core Screens

MVP is expected to require approximately:

1. Splash
2. Register
3. Login
4. Home
5. Start Outing
6. Join Outing
7. Active Outing
8. Add Payment
9. Balances
10. Person Ledger
11. Profile

Additional screens should only be introduced when a concrete requirement justifies them.

---

# 25. Active Outing

The Active Outing screen should show at minimum:

* outing name;
* active participant count/list;
* current user's payments;
* recent shared payments;
* Add Payment action;
* Leave Outing action.

The user should not need to navigate through multiple screens simply to record a payment.

Fast payment entry is a major usability requirement.

---

# 26. QR Code

QR generation shall be performed by the application.

No external QR-generation service is required.

The QR shall encode enough information for the app to identify the target session.

The QR must not contain sensitive account credentials.

---

# 27. Internet Requirement

MVP requires internet connectivity for:

* authentication;
* creating sessions;
* joining sessions;
* recording shared payments;
* synchronizing data;
* retrieving balances;
* settlements.

Offline synchronization is not required for MVP.

Future versions may introduce queued offline transactions.

---

# 28. Security Baseline

Passwords shall never be stored in plaintext.

The backend shall store securely hashed passwords.

Authenticated API requests shall require valid authentication credentials/tokens.

Every sensitive operation must verify the authenticated user's identity.

The backend must enforce authorization rules independently of the mobile interface.

The mobile client must never be treated as trusted authority.

---

# 29. Auditability

Financial records must retain sufficient information to determine:

* who created a payment;
* when it was created;
* which session it belonged to;
* who participated;
* what each participant's share was;
* settlements subsequently recorded.

Modification/deletion policy will be finalized during architecture design.

---

# 30. Explicit MVP Exclusions

The following are NOT part of MVP:

* Website
* Web dashboard
* Friend-request system
* Social feed
* Messaging
* Phone-number authentication
* SMS OTP
* Email OTP
* Google login
* Apple login
* GPS
* Maps
* location tracking
* payment gateway
* wallet
* holding user money
* bank-account integration
* automatic payment confirmation
* receipt OCR
* AI features
* cloud receipt/file storage
* push notifications
* advanced analytics
* multi-currency support
* group debt simplification
* offline synchronization

These features may be considered only after the core ledger proves reliable.

---

# 31. MVP Success Scenario

The system shall successfully support the following scenario.

Four users exist:

* Arif
* Sameer
* Faizan
* Imran

Arif starts an outing.

The system generates a QR and join code.

Sameer, Faizan and Imran join independently.

Arif records:

Dinner ₹2,400 shared among four.

Sameer records:

Movie ₹1,600 shared among four.

Imran records:

Cab ₹600 shared among selected participants.

Faizan leaves the outing.

Another payment is recorded after Faizan leaves.

The system correctly excludes Faizan from new payments unless explicitly allowed by future requirements.

Each user can independently open Balances and see:

* I Owe
* Owed to Me

Each balance can be traced to its underlying transactions.

Users may record settlements.

Participants leave independently.

The outing eventually closes without one participant being able to forcibly terminate everybody else's active participation.

---

# 32. MVP Acceptance Principle

The MVP shall be considered functionally successful when multiple Android and iOS users can:

1. create accounts;
2. authenticate;
3. start an outing;
4. join through QR or code;
5. leave and rejoin;
6. record payments they personally made;
7. correctly divide those payments;
8. receive mathematically correct balances;
9. inspect why those balances exist;
10. record repayments;
11. retain balances after an outing closes.

Correctness of financial calculations takes priority over advanced features or visual polish.

---

# 33. Technical Baseline

Mobile:

* React Native
* Expo
* TypeScript

Backend:

* Python
* FastAPI

Database:

* PostgreSQL

Development:

* Local machine

Beta/production hosting:

* Railway

Source control:

* Git

Repository structure:

friend-ledger/

* docs/
* backend/
* mobile/

---

# 34. Status

This document represents the Stage 1 Product Requirements Baseline for the Friend Ledger MVP.

Changes affecting the fundamental financial or participation model should be deliberately reviewed before implementation.

The next engineering stage is:

**Stage 2 — System & Domain Architecture**
