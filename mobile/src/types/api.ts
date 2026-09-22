/**
 * API Contract Types matching FastAPI /api/v1 backend
 */

export interface User {
  id: string;
  display_name: string;
  username: string;
  status: 'ACTIVE' | 'DISABLED';
  upi_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegisterRequest {
  display_name: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ParticipantRead {
  user_id: string;
  display_name: string;
  username: string;
  joined_at: string;
}

export interface CurrentUserSessionState {
  is_active: boolean;
}

export interface SessionBasicRead {
  id: string;
  name: string | null;
  status: 'ACTIVE' | 'CLOSED';
}

export interface ParticipationRead {
  id: string;
  joined_at: string;
}

export interface SessionListItem {
  id: string;
  name: string | null;
  status: 'ACTIVE' | 'CLOSED';
  created_at: string;
  closed_at: string | null;
  active_participant_count: number;
  current_user_is_active: boolean;
}

export interface SessionListResponse {
  items: SessionListItem[];
}

export interface SessionDetailResponse {
  id: string;
  name: string | null;
  join_code: string | null;
  status: 'ACTIVE' | 'CLOSED';
  created_at: string;
  closed_at: string | null;
  active_participants: ParticipantRead[];
  current_user: CurrentUserSessionState;
}

export interface SessionCreateRequest {
  name?: string | null;
}

export interface SessionCreateResponse {
  id: string;
  name: string | null;
  join_code: string;
  status: 'ACTIVE' | 'CLOSED';
  created_at: string;
  current_user: CurrentUserSessionState;
}

export interface SessionJoinRequest {
  join_code: string;
}

export interface SessionJoinResponse {
  session: SessionBasicRead;
  participation: ParticipationRead;
}

export interface SessionLeaveResponse {
  session_id: string;
  left_at: string;
  session_status: 'ACTIVE' | 'CLOSED';
}

export interface SessionFinishResponse {
  session_id: string;
  status: 'ACTIVE' | 'CLOSED';
  closed_at: string;
}

export interface PaymentUserRead {
  user_id: string;
  display_name: string;
  username: string;
}

export interface PaymentShareRead {
  user_id: string;
  display_name: string;
  username: string;
  amount_minor: number;
}

export interface PaymentRead {
  id: string;
  session_id: string;
  payer: PaymentUserRead;
  description: string;
  total_amount_minor: number;
  split_type: 'EQUAL' | 'CUSTOM';
  status: 'ACTIVE' | 'VOIDED';
  corrected_from_payment_id: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  shares: PaymentShareRead[];
}

export interface PaymentListResponse {
  items: PaymentRead[];
}

export interface CustomShareInput {
  user_id: string;
  amount_minor: number;
}

export interface PaymentCreateRequest {
  description: string;
  total_amount_minor: number;
  split_type: 'EQUAL' | 'CUSTOM';
  participant_user_ids: string[];
  custom_shares?: CustomShareInput[] | null;
}

export interface PaymentVoidRequest {
  reason?: string | null;
}

export interface BalancePersonRead {
  user_id: string;
  display_name: string;
  username: string;
  upi_id?: string | null;
}

export interface BalanceItem {
  person: BalancePersonRead;
  direction: 'I_OWE' | 'OWED_TO_ME';
  amount_minor: number;
}

export interface BalanceSummaryResponse {
  total_i_owe_minor: number;
  total_owed_to_me_minor: number;
  items: BalanceItem[];
}

export interface PairwiseBalanceResponse {
  person: BalancePersonRead;
  direction: 'I_OWE' | 'OWED_TO_ME' | 'SETTLED';
  amount_minor: number;
  counterparty_upi_id?: string | null;
}

export interface LedgerEntry {
  source_type: 'PAYMENT' | 'SETTLEMENT';
  payment_id: string | null;
  settlement_id: string | null;
  session_id: string | null;
  description: string;
  created_at: string;
  direction: 'I_OWE' | 'OWED_TO_ME' | 'SETTLED_BY_ME' | 'SETTLED_TO_ME';
  amount_minor: number;
  method: string | null;
}

export interface PairwiseLedgerResponse {
  person: BalancePersonRead;
  balance: PairwiseBalanceResponse;
  entries: LedgerEntry[];
}

export type SettlementMethod = 'CASH' | 'UPI' | 'OTHER';

export interface SettlementUserRead {
  user_id: string;
  display_name: string;
  username: string;
}

export interface SettlementRead {
  id: string;
  from_user: SettlementUserRead;
  to_user: SettlementUserRead;
  amount_minor: number;
  method: SettlementMethod;
  note: string | null;
  status: 'ACTIVE' | 'VOIDED';
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
}

export interface SettlementCreateRequest {
  to_user_id: string;
  amount_minor: number;
  method: SettlementMethod;
  note?: string | null;
}

export interface SettlementVoidRequest {
  reason?: string | null;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
  request_id: string;
}

export interface UserUpiUpdateRequest {
  upi_id: string | null;
}

export interface RealtimeTicketResponse {
  ticket: string;
  expires_in: number;
}

export type RealtimeEventType =
  | 'SESSION_CREATED'
  | 'SESSION_UPDATED'
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  | 'SESSION_FINISHED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_VOIDED'
  | 'SETTLEMENT_CREATED'
  | 'SETTLEMENT_VOIDED'
  | 'BALANCE_CHANGED'
  | 'UPI_PROFILE_UPDATED';

export interface RealtimeEvent {
  type: RealtimeEventType;
  session_id?: string;
  payment_id?: string;
  settlement_id?: string;
  user_id?: string;
  from_user_id?: string;
  to_user_id?: string;
}

