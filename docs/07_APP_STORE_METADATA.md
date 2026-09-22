# Friend Ledger — App Store & TestFlight Metadata

**Release**: v1.0.0 Release Candidate  
**Platform**: iOS (App Store Connect & TestFlight)  
**Package / Bundle ID**: `com.friendledger.app` *(Confirm with your Apple Developer Account)*  

---

## 1. App Store Listing Information

### App Name
```text
Friend Ledger
```

### Subtitle (Max 30 characters)
```text
Split bills, track balances
```
*(28 characters)*

### Primary Category
`Finance`

### Secondary Category
`Utilities`

### Content Rights / Age Rating
`4+` (No age-restricted content, gambling, mature themes, or medical information)

---

## 2. Keywords (Max 100 characters, comma-separated, no spaces after commas)
```text
split,bills,ledger,expenses,group,friends,settlement,upi,dining,trips,shared,iou,debt,money,tracker
```
*(99 characters)*

---

## 3. App Descriptions

### Promotional Text (Max 170 characters)
```text
Keep shared outings simple and transparent. Split payments with friends, track pairwise balances, and settle up via UPI without complex debt circles.
```
*(150 characters)*

### Short Description (for Android / App Store preview cards)
```text
Track shared expenses, calculate exact pairwise balances, and settle debts with friends easily via UPI.
```

### Full Description
```text
Friend Ledger is the calm, transparent expense-sharing companion designed for friends, roommates, and travel groups. 

Keep your shared outings simple and clear: no confusing multilateral debt simplification, no social feeds, and no hidden financial gymnastics. Every transaction is transparently accounted for between you and the person you shared it with.

KEY FEATURES:

• INSTANT OUTINGS & QR SHARING
Create an outing in seconds and invite friends instantly using a 6-character join code or direct QR code scanning.

• CLEAR, EXACT SPLITS
Split dining bills, taxi rides, or groceries equally or with custom amounts. Payments are calculated down to the exact paisa with transparent rounding.

• STRICT PAIRWISE BALANCES
See exactly who owes whom. Friend Ledger preserves direct 1:1 financial relationships instead of reshuffling your debts among strangers.

• UPI-ASSISTED SETTLEMENTS
Settle debts effortlessly. Creditors can display dynamic UPI payment QR codes, and debtors can launch their favorite UPI app (Google Pay, PhonePe, Paytm) with payee and amount pre-filled.

• SECURE & PRIVATE
Friend Ledger is not a payment gateway. We never store bank passwords, card numbers, or UPI PINs. UPI payments happen securely inside your trusted banking applications.

• REALTIME SYNCHRONIZATION
Stay up-to-date as payments and settlements happen live during your outing with instant WebSocket synchronization.

Download Friend Ledger today and experience split bills done right.
```

---

## 4. App Privacy Nutrition Label

| Data Category | Data Type | Linked to User? | Used for Tracking? | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Contact Info** | Display Name | Yes | No | App Functionality (User Identification) |
| **Identifiers** | User ID, Username | Yes | No | App Functionality (Account Management) |
| **Financial Info** | Ledger Records, UPI ID (VPA) | Yes | No | App Functionality (Expense Tracking & Settlement Routing) |
| **User Content** | Outing Names, Payment Notes | Yes | No | App Functionality (Expense Organization) |
| **Diagnostics** | Crash Logs (via OS) | No | No | App Functionality / Stability |

### Explicit Privacy Disclosures:
- **Tracking**: Friend Ledger does **NOT** track users across other apps or websites.
- **Advertising**: **Zero** third-party advertising or ad SDKs.
- **Analytics**: No third-party behavioral analytics tracking SDKs.
- **Contacts**: No address book or contact list access requested.
- **Location**: No location tracking or GPS access requested.
- **Financial Credentials**: Friend Ledger does **NOT** process or store bank account numbers, debit/credit cards, or UPI PINs.

---

## 5. Device Permissions Inventory

| Permission | iOS Key (`Info.plist`) | Required Usage Description | Purpose |
| :--- | :--- | :--- | :--- |
| **Camera** | `NSCameraUsageDescription` | `Friend Ledger needs camera access to scan QR codes for joining outings.` | Scanning QR codes on a friend's screen to join outings instantly. |

---

## 6. TestFlight Beta Information

### TestFlight Beta App Description
```text
Friend Ledger v1.0.0 Release Candidate builds on Expo SDK 57 and FastAPI. This build includes real-time synchronization, QR-based outing joining, and external UPI payment deep-linking with explicit confirmation.
```

### Feedback Email Placeholder
`beta-feedback@[YOUR-DOMAIN].com`

### Privacy Policy URL Placeholder
`https://[YOUR-DOMAIN].com/privacy`

### Support URL Placeholder
`https://[YOUR-DOMAIN].com/support`

### "What to Test" Instructions (for App Store Connect submission)
```text
1. Outing Creation & QR Join:
   - Create a new outing on Device A.
   - On Device B, tap "Join Outing", scan the QR code displayed on Device A, and verify immediate entry.

2. Add Payment & Realtime Invalidation:
   - On Device A, tap "+ Add Payment" and record a shared bill.
   - Verify that Device B receives a realtime balance and payment update without manual refresh.

3. UPI-Assisted Settlement & AppState Return:
   - Under Profile, add a valid UPI ID (e.g. name@bank).
   - In the pairwise balance view, tap "Collect via UPI" to view the generated UPI QR code.
   - On the debtor device, tap "Record Settlement" -> "Pay via UPI App" to trigger deep-linking.
   - Return to Friend Ledger and verify the explicit confirmation dialog appears before recording.

4. Offline / Reconnect Recovery:
   - Toggle airplane mode during an active outing and verify automatic WebSocket reconnect and data recovery upon reconnecting.
```
