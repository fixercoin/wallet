import { normalizePhoneNumber } from "./otp-utils";

export interface SMSMessage {
  to: string;
  body: string;
  ts: number;
}

const STORAGE_KEY = "fake_sms_inbox";

export function sendSMS(phone: string, body: string): SMSMessage {
  const to = normalizePhoneNumber(phone);
  const msg: SMSMessage = { to, body, ts: Date.now() };
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || "{}";
    const store = JSON.parse(raw) as Record<string, SMSMessage[]>;
    const arr = store[to] || [];
    arr.push(msg);
    store[to] = arr;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("fake-sms: failed to store message", e);
  }
  return msg;
}

export function getMessages(phone: string): SMSMessage[] {
  try {
    const to = normalizePhoneNumber(phone);
    const raw = localStorage.getItem(STORAGE_KEY) || "{}";
    const store = JSON.parse(raw) as Record<string, SMSMessage[]>;
    return store[to] ? [...store[to]] : [];
  } catch (e) {
    console.warn("fake-sms: failed to read messages", e);
    return [];
  }
}

export function clearMessages(phone: string) {
  try {
    const to = normalizePhoneNumber(phone);
    const raw = localStorage.getItem(STORAGE_KEY) || "{}";
    const store = JSON.parse(raw) as Record<string, SMSMessage[]>;
    delete store[to];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("fake-sms: failed to clear messages", e);
  }
}
