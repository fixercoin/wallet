export interface PaymentMethod {
  id: string;
  userId: string;
  name: string;
  idCard: string;
  password: string;
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

const PAYMENT_METHODS_STORAGE_KEY = "fiat_payment_methods";

export function generateUserId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";

  for (let i = 0; i < 3; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  id += "-";

  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return id.toUpperCase();
}

export function savePaymentMethod(
  wallet: string,
  data: PaymentMethodData,
): PaymentMethod {
  const userId = generateUserId();
  const paymentMethod: PaymentMethod = {
    id: `${wallet}_${Date.now()}`,
    userId,
    name: data.name,
    idCard: data.idCard,
    password: data.password,
    walletAddress: data.walletAddress,
    createdAt: new Date().toISOString(),
  };

  const stored = localStorage.getItem(PAYMENT_METHODS_STORAGE_KEY);
  const methods: PaymentMethod[] = stored ? JSON.parse(stored) : [];
  methods.push(paymentMethod);
  localStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(methods));

  return paymentMethod;
}

export function getPaymentMethods(wallet: string): PaymentMethod[] {
  const stored = localStorage.getItem(PAYMENT_METHODS_STORAGE_KEY);
  const methods: PaymentMethod[] = stored ? JSON.parse(stored) : [];
  return methods.filter((m) => m.id.startsWith(wallet));
}

export function getLatestPaymentMethod(wallet: string): PaymentMethod | null {
  const methods = getPaymentMethods(wallet);
  if (methods.length === 0) return null;
  return methods[methods.length - 1];
}

export function updatePaymentMethodLastUsed(methodId: string): void {
  const stored = localStorage.getItem(PAYMENT_METHODS_STORAGE_KEY);
  const methods: PaymentMethod[] = stored ? JSON.parse(stored) : [];

  const method = methods.find((m) => m.id === methodId);
  if (method) {
    method.lastUsed = new Date().toISOString();
    localStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(methods));
  }
}
