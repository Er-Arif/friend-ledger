# Friend Ledger

## Stage 7 Architecture & Implementation Specification: Realtime & UPI Enhancements

### Version 1.0

---

## 1. Executive Summary

Stage 7 implements three high-impact enhancements to Friend Ledger without compromising core financial invariants or architectural boundaries:

1. **Prominent Persistent "Add Payment" CTA**: Replaces the unobtrusive header text button on Outing Details with an eye-level, thumb-accessible action button while preserving multi-user activation rules (preventing payment creation when the user is alone in an outing).
2. **UPI-Assisted Settlement & QR Collection**: Adds an optional UPI ID to user profiles, enables creditors to generate standard UPI payment QR codes (`upi://pay`), and empowers debtors to deep-link directly into their installed UPI apps while strictly requiring explicit user confirmation before recording settlements.
3. **Ticket-Authenticated Realtime Invalidation**: Establishes a lightweight, secure WebSocket synchronization channel that notifies connected clients to invalidate and refetch stale cached data immediately upon remote financial mutations.

---

## 2. Invariants & Guardrails

All Stage 7 implementations rigorously respect Friend Ledger's core domain constraints:

* **Strict Pairwise Debts**: No transitive debt simplification or multilateral pooling. Balances are always calculated strictly pairwise between two individuals.
* **Server Authority**: The backend remains the sole authority for money calculations, participation states, and settlement records.
* **Invalidation-Only WebSockets**: WebSocket payloads are strictly lightweight invalidation signals (containing event type and relevant entity IDs). They never transmit authoritative financial state or balance totals. Mobile clients must refetch state through authenticated REST endpoints.
* **Idempotent Financial Mutations**: All financial submissions (`POST /api/v1/sessions/{id}/payments`, `POST /api/v1/settlements`, `POST /api/v1/settlements/{id}/void`) require client-generated UUID `Idempotency-Key` headers.
* **Payer Settlement Recording**: Consistent with cash settlements, the paying debtor records the settlement. Creditor-side QR presentation is strictly an aid for receiving funds.
* **No Gateway Fallacy**: Friend Ledger is not a bank or payment gateway. Opening an external UPI application does not guarantee payment execution. The app never marks a settlement recorded merely because the UPI app launched; explicit user confirmation is always required upon return.
* **Audit Privacy**: Audit logs record configuration events (`UPI_ID_UPDATED`) with boolean flags (`{"configured": true}`) rather than logging raw VPAs in audit metadata.

---

## 3. Backend Architecture & API Contracts

### 3.1 User UPI Profile

* **Database Migration**: Added nullable `upi_id VARCHAR(128)` to the `users` table via Alembic revision `cd6ff882a510`.
* **Validation**: Regex `^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z0-9.\-_]{2,50}$`, max length 128, trimmed, whitespace prohibited, empty strings normalized to `null`.
* **API Endpoint**: `PATCH /api/v1/me/upi`
  - Request: `{ "upi_id": "username@bank" }` or `{ "upi_id": null }`
  - Response: Updated `UserRead` model.
  - Audit: Emits `UPI_ID_UPDATED` with actor ID and `{ "configured": bool }`.
  - Realtime: Broadcasts `UPI_PROFILE_UPDATED` to invalidate cached counterparty balance profiles.

### 3.2 Counterparty UPI Discovery in Balances

To enable seamless settlement routing without exposing unneeded user directory information:
* `GET /api/v1/me/balances/{user_id}` and `GET /api/v1/me/balances/{user_id}/ledger` return:
  - `counterparty_upi_id: str | None`: Populated with the debtor's counterparty UPI ID if configured.

### 3.3 Realtime Ticket-Based WebSocket Architecture

Because standard browser and native WebSocket APIs do not support custom HTTP headers (such as `Authorization: Bearer <token>`), Friend Ledger uses a secure ticket exchange pattern:

1. **Ticket Request**: `POST /api/v1/realtime/ticket` (Authenticated with Bearer access token)
   - Generates a cryptographically random, unguessable token (`secrets.token_urlsafe(32)`).
   - Stores ticket in-memory with a 60-second TTL and associated `user_id`.
   - Returns `{ "ticket": "...", "expires_in": 60 }`.
2. **WebSocket Connection**: `GET /api/v1/realtime/ws?ticket={ticket}`
   - Validates and consumes the ticket atomically. Single-use only.
   - If missing, invalid, or expired, closes connection immediately with code `1008` (Policy Violation).
   - Upon successful validation, registers the active WebSocket into `ConnectionManager`.
3. **Broadcasting & Resilience**:
   - `broadcast_to_users(user_ids, payload)` delivers non-blocking JSON events.
   - Broken pipes or disconnected sockets are caught and cleaned up silently without affecting core database transaction commits.
   - Broadcast triggers are hooked after `db.commit()` in session, payment, settlement, and profile routers.

#### Event Schema:
```json
{
  "type": "PAYMENT_CREATED" | "PAYMENT_VOIDED" | "SETTLEMENT_CREATED" | "SETTLEMENT_VOIDED" | "BALANCE_CHANGED" | "SESSION_CREATED" | "SESSION_UPDATED" | "PARTICIPANT_JOINED" | "PARTICIPANT_LEFT" | "SESSION_FINISHED" | "UPI_PROFILE_UPDATED",
  "session_id": "optional-uuid",
  "payment_id": "optional-uuid",
  "settlement_id": "optional-uuid",
  "actor_id": "user-uuid",
  "timestamp": "ISO-8601"
}
```

---

## 4. Mobile UX & Client Implementation

### 4.1 Prominent Persistent Add Payment CTA

* Located on `mobile/src/app/outings/[id].tsx` directly beneath the "Payments" section header and above the payment items list.
* Rendered in the primary emerald theme with plus icon.
* **Activation Rules**:
  - Outing must be `ACTIVE`.
  - Number of active participants (`left_at == null`) must be $\ge 2$.
  - When the user is alone, the button is hidden and an informative "Waiting for friends to join" card explains that payments cannot be created until another person joins.

### 4.2 UPI Settlement & Collection

* **Profile Setup** (`mobile/src/app/(tabs)/profile.tsx`):
  - Users can view, edit, or remove their UPI ID with inline format validation.
* **Creditor Collection Flow** (`mobile/src/app/settlements/collect.tsx`):
  - Accessible via "Collect via UPI" button on the pairwise ledger screen when owed money.
  - Verifies creditor has configured their own UPI ID; guides them to profile settings if not.
  - Allows requesting full debt amount or partial amounts.
  - Renders a high-contrast QR code (`UPIPaymentQR.tsx`) encoding the standard `upi://pay` URI, alongside quick "Copy UPI ID" action.
* **Debtor Payment & AppState Return Flow** (`mobile/src/app/settlements/record.tsx`):
  - If payee has a UPI ID, displays "Pay via UPI App" primary button (`Linking.openURL(upiUri)`).
  - Uses React Native `AppState` listener: when returning from background (`active` state), displays an explicit confirmation card:
    - *"Did you complete the payment in your UPI app?"*
    - `[Yes, Record Settlement]` - Submits idempotent settlement recording to backend.
    - `[Not Yet]` - Keeps the screen ready without recording erroneous debt reduction.
  - If no UPI app is installed or external launch fails, provides inline fallback with UPI ID copy and QR code modal.
  - If counterparty has not configured a UPI ID, supports standard manual settlement recording.

### 4.3 Realtime Client Synchronization

* Implemented in `mobile/src/lib/realtime.ts` (`RealtimeService` class).
* Automatically calls `realtime.connect()` when auth tokens are loaded or updated, and `realtime.disconnect()` on logout.
* Reconnect logic implements exponential backoff (`1s`, `2s`, `5s`, `10s`, `30s`).
* Listens to React Native `AppState` transitions: immediately reconnects when app resumes from background.
* UI Screens (`outings.tsx`, `outings/[id].tsx`, `balances.tsx`, `balances/[userId].tsx`) subscribe to invalidation events and trigger non-intrusive background refetches.

---

## 5. Verification & Test Coverage

* **Backend Test Suite**: 111 pytest tests (`uv run pytest -vv`) passing with 100% success rate.
  - `tests/test_upi_profile.py`: 6 tests covering profile update, clear, validation, audit logs, and pairwise counterparty exposure.
  - `tests/test_realtime.py`: 6 tests covering ticket generation, unauthenticated rejection, single-use ticket consumption, and targeted user event broadcasts.
* **Alembic Database State**: Current head `cd6ff882a510`, clean autogenerate check.
* **Mobile Test Suite**: 19 node unit tests passing (`npm test`), testing money formatting, UPI URI generation, UPI ID validation, and QR encoding/decoding.
* **Mobile Static Analysis**: `npx tsc --noEmit` clean (0 errors), `npm run lint` clean (0 errors/warnings), `npx expo-doctor` passed (21/21 checks).
