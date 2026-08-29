export type TransactionRow = {
  id: string;
  createdAt: string;
  merchantId: string;
  providerId: string;
  paymentMethod: string;
  country: string;
  issuerBank: string;
  amountUsd: number;
  approved: boolean;
  declineCode: string | null;
  latencyMs: number;
  source: "fixture" | "live";
};

export type BaselineProfileRow = {
  merchantId: string;
  providerId: string;
  paymentMethod: string;
  country: string;
  hourUtc: number;
  dayType: "weekday" | "weekend";
  attempts: number;
  approved: number;
  avgAmountUsd: number;
};

export type IncidentRow = {
  id: string;
  label: string;
  presetId: string | null;
  filters: Partial<Pick<TransactionRow, "merchantId" | "providerId" | "paymentMethod" | "country" | "issuerBank">>;
  approvalMultiplier: number;
  dominantDeclineCode: string;
  startedAt: string;
  endsAt: string | null;
  stoppedAt: string | null;
  mitigatedAt: string | null;
};

export type PaymentSlice = Pick<TransactionRow, "merchantId" | "providerId" | "paymentMethod" | "country">;

export const formatPaymentSlice = (slice: Partial<PaymentSlice>) =>
  [slice.merchantId, slice.providerId, slice.paymentMethod, slice.country]
    .filter(Boolean)
    .join(" · ");
