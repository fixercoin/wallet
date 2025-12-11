export interface PaymentMethod {
  id: string;
  userId: string;
  name: string;
  walletAddress: string;
  createdAt: string;
  lastUsed?: string;
}

export interface PaymentMethodData {
  name: string;
  idCard: string;
  password: string;
  walletAddress: string;
}

export async function savePaymentMethod(
  wallet: string,
  data: PaymentMethodData,
): Promise<PaymentMethod> {
  const response = await fetch("/api/fiat/payment-methods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      ...data,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to save payment method");
  }

  return result.method;
}

export async function getPaymentMethods(wallet: string): Promise<{
  methods: PaymentMethod[];
  latestMethod: PaymentMethod | null;
}> {
  const response = await fetch(
    `/api/fiat/payment-methods?wallet=${encodeURIComponent(wallet)}`,
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to get payment methods");
  }

  return result;
}

export async function deletePaymentMethod(
  wallet: string,
  methodId: string,
): Promise<void> {
  const response = await fetch("/api/fiat/payment-methods", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      methodId,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to delete payment method");
  }
}
