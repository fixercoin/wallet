import type { ChangeEvent, FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Paperclip,
  PlugZap,
  RefreshCcw,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";

const ORDER_SESSION_KEY = "express-cloudflare-p2p-session";
const MAX_MESSAGES = 300;
const MAX_RECONNECT_ATTEMPTS = 6;

const ASSET_OPTIONS = [
  { value: "USDC", label: "USDC" },
  { value: "SOL", label: "SOL" },
  { value: "FIXER", label: "FIXER" },
];

const PAYMENT_OPTIONS = [
  { value: "bank", label: "Bank Transfer" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "firstpay", label: "FirstPay" },
];

const FIAT_OPTIONS = [
  { value: "PKR", label: "PKR" },
  { value: "USD", label: "USD" },
];

type OrderRole = "buyer" | "seller";

type OrderPhase =
  | "awaiting_counterparty"
  | "awaiting_payment"
  | "buyer_paid"
  | "seller_confirmed"
  | "completed"
  | "cancelled"
  | "appealed";

interface OrderSession {
  orderId: string;
  token: string;
  role: OrderRole;
}

interface ParticipantSummary {
  displayName?: string;
  address?: string;
  avatarUrl?: string;
}

interface OrderAttachment {
  id: string;
  url: string;
  name: string;
  uploadedBy: OrderRole | "system";
  contentType?: string;
  size?: number;
  uploadedAt: number;
}

interface OrderSnapshot {
  orderId: string;
  status: OrderPhase;
  assetSymbol: string;
  tokenAmount: number;
  fiatAmount: number;
  fiatCurrency: string;
  paymentMethod?: string;
  buyer: ParticipantSummary | null;
  seller: ParticipantSummary | null;
  escrowAddress?: string;
  attachments: OrderAttachment[];
  lastEventAt: number;
}

interface ChatMessage {
  id: string;
  sender: OrderRole | "system";
  body: string;
  ts: number;
  attachments: OrderAttachment[];
}

interface ConnectionState {
  phase: "idle" | "connecting" | "open" | "reconnecting" | "error" | "closed";
  attempts: number;
  error: string | null;
}

interface WorkerOutboundMessage {
  type: string;
  payload?: unknown;
}

interface WorkerInboundEvent {
  type: string;
  payload?: any;
  message?: string;
}

type ChatAction =
  | { type: "reset"; payload: ChatMessage[] }
  | { type: "upsert"; payload: ChatMessage };

const ACTION_LABELS: Record<string, string> = {
  mark_paid: "I've Paid",
  mark_received: "I've Received",
  cancel: "Cancel",
  appeal: "Appeal",
  accept: "Accept Order",
};

const ACTION_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  mark_paid: "default",
  mark_received: "default",
  cancel: "destructive",
  appeal: "secondary",
  accept: "default",
};

function chatReducer(state: ChatMessage[], action: ChatAction): ChatMessage[] {
  switch (action.type) {
    case "reset":
      return dedupeMessages(action.payload);
    case "upsert":
      return dedupeMessages([...state, action.payload]);
    default:
      return state;
  }
}

function dedupeMessages(list: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const item of list) {
    map.set(item.id, item);
  }
  return Array.from(map.values())
    .sort((a, b) => a.ts - b.ts)
    .slice(-MAX_MESSAGES);
}

function safeParseJSON<T = unknown>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRole(value: unknown): OrderRole | "system" {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "buyer") return "buyer";
  if (normalized === "seller") return "seller";
  return "system";
}

function parseOrderStatus(value: unknown): OrderPhase {
  const normalized = String(value ?? "").toLowerCase();
  if (
    ["waiting_counterparty", "awaiting_counterparty", "draft"].includes(
      normalized,
    )
  ) {
    return "awaiting_counterparty";
  }
  if (
    [
      "pending",
      "awaiting_payment",
      "waiting_payment",
      "waiting_for_payment",
    ].includes(normalized)
  ) {
    return "awaiting_payment";
  }
  if (["buyer_paid", "payment_submitted"].includes(normalized)) {
    return "buyer_paid";
  }
  if (
    ["seller_confirmed", "released", "seller_released"].includes(normalized)
  ) {
    return "seller_confirmed";
  }
  if (["completed", "settled", "done"].includes(normalized)) {
    return "completed";
  }
  if (["cancelled", "canceled"].includes(normalized)) {
    return "cancelled";
  }
  if (["appealed", "disputed"].includes(normalized)) {
    return "appealed";
  }
  return "awaiting_payment";
}

function normalizeParticipant(value: any): ParticipantSummary | null {
  if (!value || typeof value !== "object") return null;
  const address =
    typeof value.address === "string"
      ? value.address
      : typeof value.wallet === "string"
        ? value.wallet
        : undefined;
  const displayName =
    typeof value.displayName === "string" && value.displayName
      ? value.displayName
      : typeof value.name === "string"
        ? value.name
        : undefined;
  const avatarUrl =
    typeof value.avatarUrl === "string" && value.avatarUrl
      ? value.avatarUrl
      : undefined;
  if (!address && !displayName) return null;
  return { address, displayName, avatarUrl };
}

function toAttachment(value: any): OrderAttachment | null {
  if (!value || typeof value !== "object") return null;
  const urlCandidate =
    typeof value.url === "string"
      ? value.url
      : typeof value.publicUrl === "string"
        ? value.publicUrl
        : typeof value.fileUrl === "string"
          ? value.fileUrl
          : undefined;
  if (!urlCandidate) return null;
  const id =
    typeof value.id === "string" && value.id
      ? value.id
      : generateId("attachment");
  const uploadedAtRaw = Number(
    value.uploadedAt ?? value.ts ?? value.timestamp ?? Date.now(),
  );
  const uploadedAt = Number.isFinite(uploadedAtRaw)
    ? uploadedAtRaw
    : Date.now();
  return {
    id,
    url: urlCandidate,
    name:
      typeof value.name === "string" && value.name
        ? value.name
        : typeof value.filename === "string" && value.filename
          ? value.filename
          : id,
    uploadedBy: normalizeRole(value.uploadedBy ?? value.owner ?? value.sender),
    contentType:
      typeof value.contentType === "string" && value.contentType
        ? value.contentType
        : undefined,
    size:
      typeof value.size === "number"
        ? value.size
        : Number(value.contentLength ?? value.bytes ?? 0) || undefined,
    uploadedAt,
  };
}

function normalizeAttachments(value: any): OrderAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toAttachment(item))
    .filter((item): item is OrderAttachment => Boolean(item));
}

function mergeAttachments(
  existing: OrderAttachment[],
  incoming?: OrderAttachment[],
): OrderAttachment[] {
  if (!incoming || incoming.length === 0) {
    return existing;
  }
  const map = new Map<string, OrderAttachment>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return Array.from(map.values()).sort((a, b) => a.uploadedAt - b.uploadedAt);
}

function buildEmptySnapshot(orderId: string | undefined): OrderSnapshot {
  return {
    orderId: orderId ?? "",
    status: "awaiting_payment",
    assetSymbol: "USDC",
    tokenAmount: 0,
    fiatAmount: 0,
    fiatCurrency: "PKR",
    paymentMethod: undefined,
    buyer: null,
    seller: null,
    escrowAddress: undefined,
    attachments: [],
    lastEventAt: Date.now(),
  };
}

function mergeOrderSnapshot(
  prev: OrderSnapshot | null,
  incoming: Partial<OrderSnapshot>,
  fallbackId: string | undefined,
): OrderSnapshot {
  const base = prev ?? buildEmptySnapshot(fallbackId);
  const merged: OrderSnapshot = {
    ...base,
    ...incoming,
    orderId: incoming.orderId ?? base.orderId,
    status: incoming.status ?? base.status,
    assetSymbol: incoming.assetSymbol ?? base.assetSymbol,
    tokenAmount:
      typeof incoming.tokenAmount === "number"
        ? incoming.tokenAmount
        : base.tokenAmount,
    fiatAmount:
      typeof incoming.fiatAmount === "number"
        ? incoming.fiatAmount
        : base.fiatAmount,
    fiatCurrency: incoming.fiatCurrency ?? base.fiatCurrency,
    paymentMethod: incoming.paymentMethod ?? base.paymentMethod,
    buyer: incoming.buyer ?? base.buyer,
    seller: incoming.seller ?? base.seller,
    escrowAddress: incoming.escrowAddress ?? base.escrowAddress,
    attachments: mergeAttachments(base.attachments, incoming.attachments),
    lastEventAt: incoming.lastEventAt ?? base.lastEventAt,
  };
  return merged;
}

function normalizeOrderPayload(
  raw: any,
  fallbackId: string | undefined,
): Partial<OrderSnapshot> {
  if (!raw || typeof raw !== "object") {
    return { orderId: fallbackId };
  }
  const orderId =
    typeof raw.orderId === "string" && raw.orderId
      ? raw.orderId
      : typeof raw.id === "string" && raw.id
        ? raw.id
        : fallbackId;
  const status = parseOrderStatus(raw.status ?? raw.orderStatus);
  const assetSymbol =
    typeof raw.assetSymbol === "string" && raw.assetSymbol
      ? raw.assetSymbol.toUpperCase()
      : typeof raw.tokenSymbol === "string" && raw.tokenSymbol
        ? raw.tokenSymbol.toUpperCase()
        : undefined;
  const tokenAmountRaw =
    raw.tokenAmount ?? raw.assetAmount ?? raw.quantity ?? raw.size;
  const fiatAmountRaw =
    raw.fiatAmount ?? raw.fiatValue ?? raw.amountFiat ?? raw.fiat;
  const fiatCurrency =
    typeof raw.fiatCurrency === "string" && raw.fiatCurrency
      ? raw.fiatCurrency.toUpperCase()
      : typeof raw.currency === "string" && raw.currency
        ? raw.currency.toUpperCase()
        : undefined;
  const attachments = normalizeAttachments(raw.attachments);
  const paymentMethod =
    typeof raw.paymentMethod === "string" && raw.paymentMethod
      ? raw.paymentMethod
      : typeof raw.method === "string" && raw.method
        ? raw.method
        : undefined;
  const lastEventAtRaw = Number(
    raw.lastEventAt ?? raw.updatedAt ?? raw.ts ?? Date.now(),
  );
  return {
    orderId,
    status,
    assetSymbol,
    tokenAmount:
      typeof tokenAmountRaw === "number"
        ? tokenAmountRaw
        : Number(tokenAmountRaw) || undefined,
    fiatAmount:
      typeof fiatAmountRaw === "number"
        ? fiatAmountRaw
        : Number(fiatAmountRaw) || undefined,
    fiatCurrency,
    paymentMethod,
    buyer: normalizeParticipant(raw.buyer),
    seller: normalizeParticipant(raw.seller),
    escrowAddress:
      typeof raw.escrowAddress === "string" && raw.escrowAddress
        ? raw.escrowAddress
        : typeof raw.escrowPubkey === "string" && raw.escrowPubkey
          ? raw.escrowPubkey
          : undefined,
    attachments: attachments.length ? attachments : undefined,
    lastEventAt: Number.isFinite(lastEventAtRaw) ? lastEventAtRaw : Date.now(),
  };
}

function toChatMessage(value: any): ChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const id =
    typeof value.id === "string" && value.id ? value.id : generateId("message");
  const sender = normalizeRole(value.sender ?? value.role ?? value.from);
  const bodyCandidate =
    typeof value.body === "string"
      ? value.body
      : typeof value.message === "string"
        ? value.message
        : "";
  const attachments = normalizeAttachments(value.attachments);
  if (!bodyCandidate && attachments.length === 0) {
    return null;
  }
  const tsRaw = Number(
    value.ts ?? value.timestamp ?? value.createdAt ?? Date.now(),
  );
  const ts = Number.isFinite(tsRaw) ? tsRaw : Date.now();
  return {
    id,
    sender,
    body: bodyCandidate,
    ts,
    attachments,
  };
}

function formatAmount(value: number | null | undefined, digits = 4): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

function describeRelativeTime(timestamp: number): string {
  const diff = timestamp - Date.now();
  const absDiff = Math.abs(diff);
  const rtf =
    typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl
      ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
      : null;
  if (!rtf) {
    return new Date(timestamp).toLocaleString();
  }
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
  ];
  let value = diff / 1000;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [divisor, nextUnit] of units) {
    if (Math.abs(value) < divisor) break;
    value /= divisor;
    unit = nextUnit;
  }
  if (unit === "month" && Math.abs(value) >= 12) {
    value /= 12;
    unit = "year";
  }
  return rtf.format(Math.round(value), unit);
}

function formatFileSize(size?: number): string {
  if (!size || size <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function deriveAvailableActions(
  snapshot: OrderSnapshot | null,
  role: OrderRole | undefined,
  serverActions: string[] | null,
): string[] {
  if (serverActions && serverActions.length > 0) {
    return Array.from(
      new Set(serverActions.map((action) => action.toString())),
    );
  }
  if (!snapshot || !role) {
    return [];
  }
  switch (snapshot.status) {
    case "awaiting_counterparty":
      return role === "buyer" ? ["cancel"] : ["accept"];
    case "awaiting_payment":
      return role === "buyer" ? ["mark_paid", "cancel"] : ["cancel"];
    case "buyer_paid":
      return role === "seller" ? ["mark_received", "appeal"] : ["appeal"];
    case "seller_confirmed":
      return role === "buyer" ? ["appeal"] : [];
    case "appealed":
    case "completed":
    case "cancelled":
    default:
      return [];
  }
}

interface ExpressP2PProps {
  onBack?: () => void;
}

const defaultConnectionState: ConnectionState = {
  phase: "idle",
  attempts: 0,
  error: null,
};

function ExpressP2P({ onBack }: ExpressP2PProps) {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { toast } = useToast();

  const [session, setSession] = useState<OrderSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(ORDER_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as OrderSession;
      if (
        parsed &&
        typeof parsed.orderId === "string" &&
        typeof parsed.token === "string" &&
        (parsed.role === "buyer" || parsed.role === "seller")
      ) {
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  });

  const sessionRef = useRef<OrderSession | null>(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const manualCloseRef = useRef(false);
  const outboundQueueRef = useRef<WorkerOutboundMessage[]>([]);

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    session
      ? { phase: "connecting", attempts: 0, error: null }
      : defaultConnectionState,
  );
  const [connectionNonce, setConnectionNonce] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [order, setOrder] = useState<OrderSnapshot | null>(null);
  const [serverActions, setServerActions] = useState<string[] | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [chatMessages, dispatchMessages] = useReducer(chatReducer, []);

  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [createForm, setCreateForm] = useState({
    assetSymbol: ASSET_OPTIONS[0]?.value ?? "USDC",
    fiatAmount: "",
    tokenAmount: "",
    fiatCurrency: FIAT_OPTIONS[0]?.value ?? "PKR",
    paymentMethod: PAYMENT_OPTIONS[0]?.value ?? "bank",
    memo: "",
  });
  const [creatingOrder, setCreatingOrder] = useState(false);

  const [joinOrderId, setJoinOrderId] = useState("");
  const [joinToken, setJoinToken] = useState("");
  const [joinRole, setJoinRole] = useState<OrderRole>("seller");
  const [joinLoading, setJoinLoading] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);

  const hasWallet = Boolean(wallet?.publicKey);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!session) {
      window.localStorage.removeItem(ORDER_SESSION_KEY);
      return;
    }
    window.localStorage.setItem(ORDER_SESSION_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!session) {
      dispatchMessages({ type: "reset", payload: [] });
      setOrder(null);
      setServerActions(null);
      setPendingAction(null);
      setConnectionState(defaultConnectionState);
      setConnectionError(null);
      outboundQueueRef.current = [];
    }
  }, [session]);

  const flushPendingQueue = useCallback(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    while (outboundQueueRef.current.length > 0) {
      const next = outboundQueueRef.current.shift();
      if (next) {
        socket.send(JSON.stringify(next));
      }
    }
  }, []);

  const queueOutboundMessage = useCallback((message: WorkerOutboundMessage) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return;
    }
    outboundQueueRef.current.push(message);
    if (outboundQueueRef.current.length > 100) {
      outboundQueueRef.current.shift();
    }
  }, []);

  const handleInbound = useCallback(
    (event: WorkerInboundEvent) => {
      const { type, payload } = event;
      switch (type) {
        case "order.snapshot": {
          const snapshot = mergeOrderSnapshot(
            null,
            normalizeOrderPayload(payload, sessionRef.current?.orderId),
            sessionRef.current?.orderId,
          );
          setOrder(snapshot);
          if (Array.isArray(payload?.availableActions)) {
            setServerActions(
              payload.availableActions.map((action: any) => String(action)),
            );
          } else {
            setServerActions(null);
          }
          const historySource = Array.isArray(payload?.chat)
            ? payload.chat
            : Array.isArray(payload?.messages)
              ? payload.messages
              : [];
          const history = historySource
            .map((item: any) => toChatMessage(item))
            .filter((item): item is ChatMessage => Boolean(item));
          if (history.length) {
            dispatchMessages({ type: "reset", payload: history });
          } else {
            dispatchMessages({ type: "reset", payload: [] });
          }
          setPendingAction(null);
          setConnectionError(null);
          return;
        }
        case "order.update": {
          const normalized = normalizeOrderPayload(
            payload,
            sessionRef.current?.orderId,
          );
          setOrder((prev) =>
            mergeOrderSnapshot(prev, normalized, sessionRef.current?.orderId),
          );
          if (Array.isArray(payload?.availableActions)) {
            setServerActions(
              payload.availableActions.map((action: any) => String(action)),
            );
          } else if (Array.isArray(payload?.allowed)) {
            setServerActions(
              payload.allowed.map((action: any) => String(action)),
            );
          }
          setPendingAction(null);
          return;
        }
        case "order.actions": {
          if (Array.isArray(payload)) {
            setServerActions(payload.map((action: any) => String(action)));
          } else if (Array.isArray(payload?.allowed)) {
            setServerActions(
              payload.allowed.map((action: any) => String(action)),
            );
          }
          return;
        }
        case "chat.history": {
          const list = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.messages)
              ? payload.messages
              : [];
          const history = list
            .map((item: any) => toChatMessage(item))
            .filter((item): item is ChatMessage => Boolean(item));
          dispatchMessages({ type: "reset", payload: history });
          return;
        }
        case "chat.message": {
          const msg = toChatMessage(payload);
          if (msg) {
            dispatchMessages({ type: "upsert", payload: msg });
          }
          return;
        }
        case "attachment.added": {
          const attachment = toAttachment(payload);
          if (attachment) {
            setOrder((prev) =>
              mergeOrderSnapshot(
                prev,
                {
                  attachments: [attachment],
                  lastEventAt: attachment.uploadedAt,
                },
                sessionRef.current?.orderId,
              ),
            );
            const messagePayload = payload?.message ?? {
              id: `attachment-${attachment.id}`,
              sender: attachment.uploadedBy,
              body: attachment.name,
              ts: attachment.uploadedAt,
              attachments: [attachment],
            };
            const message = toChatMessage(messagePayload);
            if (message) {
              dispatchMessages({ type: "upsert", payload: message });
            }
          }
          return;
        }
        case "system.notice": {
          const message = toChatMessage({
            id: payload?.id ?? generateId("notice"),
            sender: "system",
            body:
              typeof payload?.message === "string"
                ? payload.message
                : "System notification",
            ts: Number(payload?.ts ?? Date.now()),
          });
          if (message) {
            dispatchMessages({ type: "upsert", payload: message });
          }
          return;
        }
        case "error": {
          const message =
            typeof payload?.message === "string"
              ? payload.message
              : typeof event.message === "string"
                ? event.message
                : "Order room error";
          setConnectionState((prev) => ({
            phase: "error",
            attempts: prev.attempts,
            error: message,
          }));
          setConnectionError(message);
          toast({
            title: "Order room error",
            description: message,
            variant: "destructive",
          });
          return;
        }
        default:
          return;
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!session?.orderId || !session?.token) return;
    if (typeof window === "undefined") return;

    let disposed = false;

    const clearTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      if (manualCloseRef.current) return;
      if (retryCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setConnectionState({
          phase: "error",
          attempts: retryCountRef.current,
          error: "Unable to reconnect to order room.",
        });
        setConnectionError("Unable to reconnect to order room.");
        return;
      }
      const delay = Math.min(15000, 1500 * 2 ** retryCountRef.current);
      retryCountRef.current += 1;
      setConnectionState({
        phase: "reconnecting",
        attempts: retryCountRef.current,
        error: null,
      });
      clearTimer();
      reconnectTimerRef.current = window.setTimeout(() => {
        if (!disposed) {
          connect();
        }
      }, delay);
    };

    function connect() {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socketUrl = `${protocol}://${window.location.host}/api/ws?orderId=${encodeURIComponent(session.orderId)}&token=${encodeURIComponent(session.token)}`;
      const socket = new WebSocket(socketUrl);
      wsRef.current = socket;
      setConnectionState({
        phase: retryCountRef.current > 0 ? "reconnecting" : "connecting",
        attempts: retryCountRef.current,
        error: null,
      });
      setConnectionError(null);

      socket.onopen = () => {
        if (disposed) return;
        retryCountRef.current = 0;
        setConnectionState({ phase: "open", attempts: 0, error: null });
        setConnectionError(null);
        socket.send(
          JSON.stringify({
            type: "order.subscribe",
            payload: { orderId: session.orderId },
          }),
        );
        flushPendingQueue();
      };

      socket.onmessage = (event) => {
        if (disposed) return;
        if (typeof event.data !== "string") return;
        const parsed = safeParseJSON<WorkerInboundEvent>(event.data);
        if (!parsed || typeof parsed !== "object" || !parsed.type) return;
        handleInbound(parsed);
      };

      socket.onerror = () => {
        if (disposed) return;
        setConnectionState((prev) => ({
          phase: "error",
          attempts: prev.attempts,
          error: "WebSocket error",
        }));
        setConnectionError("WebSocket error");
      };

      socket.onclose = (event) => {
        if (disposed) return;
        wsRef.current = null;
        if (manualCloseRef.current || event.code === 1000) {
          manualCloseRef.current = false;
          setConnectionState({
            phase: "closed",
            attempts: retryCountRef.current,
            error: null,
          });
          return;
        }
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimer();
      const activeSocket = wsRef.current;
      if (activeSocket) {
        activeSocket.onopen = null;
        activeSocket.onmessage = null;
        activeSocket.onerror = null;
        activeSocket.onclose = null;
        activeSocket.close(1000, "component teardown");
        wsRef.current = null;
      }
    };
  }, [
    session?.orderId,
    session?.token,
    connectionNonce,
    flushPendingQueue,
    handleInbound,
  ]);

  useEffect(() => {
    if (!messageViewportRef.current) return;
    messageViewportRef.current.scrollTop =
      messageViewportRef.current.scrollHeight;
  }, [chatMessages]);

  const availableActions = useMemo(
    () => deriveAvailableActions(order, session?.role, serverActions),
    [order, session?.role, serverActions],
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate("/");
  };

  const handleCreateOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasWallet) {
      toast({
        title: "Wallet required",
        description: "Connect or create a wallet before creating an order.",
        variant: "destructive",
      });
      return;
    }
    const fiatAmount = Number(createForm.fiatAmount);
    const tokenAmount = Number(createForm.tokenAmount);
    if (
      (!Number.isFinite(fiatAmount) || fiatAmount <= 0) &&
      (!Number.isFinite(tokenAmount) || tokenAmount <= 0)
    ) {
      toast({
        title: "Invalid amounts",
        description: "Enter a fiat amount or token amount greater than zero.",
        variant: "destructive",
      });
      return;
    }
    setCreatingOrder(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetSymbol: createForm.assetSymbol,
          fiatAmount: Number.isFinite(fiatAmount) ? fiatAmount : undefined,
          fiatCurrency: createForm.fiatCurrency,
          tokenAmount: Number.isFinite(tokenAmount) ? tokenAmount : undefined,
          paymentMethod: createForm.paymentMethod,
          memo: createForm.memo || undefined,
          walletAddress: wallet?.publicKey,
          role: "buyer",
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to create order (${response.status})`);
      }
      const data = await response.json();
      const orderId = String(
        data?.orderId ??
          data?.id ??
          data?.order?.id ??
          data?.result?.orderId ??
          "",
      );
      const token = String(
        data?.token ??
          data?.jwt ??
          data?.sessionToken ??
          data?.credentials?.token ??
          data?.orderToken ??
          "",
      );
      const role: OrderRole = data?.role === "seller" ? "seller" : "buyer";
      if (!orderId || !token) {
        throw new Error("Order ID or session token missing from response.");
      }
      setSession({ orderId, token, role });
      setOrder(null);
      setServerActions(null);
      setPendingAction(null);
      dispatchMessages({ type: "reset", payload: [] });
      setConnectionState({ phase: "connecting", attempts: 0, error: null });
      setConnectionNonce((value) => value + 1);
      setJoinOrderId(orderId);
      setJoinToken(token);
      setJoinRole(role);
      toast({
        title: "Order created",
        description: "Share the order ID securely with your counterparty.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create order.";
      toast({
        title: "Order creation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleJoinOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedId = joinOrderId.trim();
    const trimmedToken = joinToken.trim();
    if (!trimmedId || !trimmedToken) {
      toast({
        title: "Missing credentials",
        description: "Enter both the order ID and session token.",
        variant: "destructive",
      });
      return;
    }
    setJoinLoading(true);
    try {
      setSession({ orderId: trimmedId, token: trimmedToken, role: joinRole });
      setOrder(null);
      setServerActions(null);
      setPendingAction(null);
      dispatchMessages({ type: "reset", payload: [] });
      setConnectionState({ phase: "connecting", attempts: 0, error: null });
      setConnectionNonce((value) => value + 1);
      toast({
        title: "Joining order",
        description: "Connecting to the Cloudflare Durable Object room…",
      });
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLeaveOrder = () => {
    manualCloseRef.current = true;
    if (wsRef.current) {
      wsRef.current.close(1000, "user left");
      wsRef.current = null;
    }
    setSession(null);
    setOrder(null);
    setServerActions(null);
    setPendingAction(null);
    dispatchMessages({ type: "reset", payload: [] });
    setConnectionState(defaultConnectionState);
    setConnectionError(null);
    outboundQueueRef.current = [];
  };

  const handleRetryConnection = () => {
    if (!session) return;
    manualCloseRef.current = false;
    retryCountRef.current = 0;
    setConnectionNonce((value) => value + 1);
    setConnectionState({ phase: "connecting", attempts: 0, error: null });
  };

  const handleSendMessage = () => {
    if (!session) return;
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const optimistic: ChatMessage = {
      id: generateId("local-message"),
      sender: session.role,
      body: trimmed,
      ts: Date.now(),
      attachments: [],
    };
    dispatchMessages({ type: "upsert", payload: optimistic });
    queueOutboundMessage({
      type: "chat.send",
      payload: {
        id: optimistic.id,
        body: trimmed,
      },
    });
    setChatInput("");
  };

  const handleAction = (action: string) => {
    if (!session) return;
    setPendingAction(action);
    queueOutboundMessage({
      type: "order.action",
      payload: {
        action,
        orderId: session.orderId,
      },
    });
  };

  const handleUploadProof = useCallback(
    async (file: File) => {
      if (!session) return;
      setUploadingProof(true);
      try {
        const presignResponse = await fetch("/api/presign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({
            orderId: session.orderId,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          }),
        });
        if (!presignResponse.ok) {
          const text = await presignResponse.text();
          throw new Error(text || "Unable to request upload URL");
        }
        const presign = await presignResponse.json();
        const uploadUrl =
          presign?.uploadUrl ?? presign?.url ?? presign?.signedUrl ?? null;
        if (!uploadUrl) {
          throw new Error("Upload URL missing in presign response");
        }
        if (presign?.fields && typeof presign.fields === "object") {
          const form = new FormData();
          Object.entries(presign.fields).forEach(([key, value]) => {
            form.append(key, String(value));
          });
          form.append("file", file);
          await fetch(uploadUrl, {
            method: presign.method ?? "POST",
            body: form,
          });
        } else {
          const headers =
            presign?.headers && typeof presign.headers === "object"
              ? Object.fromEntries(
                  Object.entries(presign.headers).map(([key, value]) => [
                    key,
                    String(value),
                  ]),
                )
              : {};
          await fetch(uploadUrl, {
            method: presign?.method ?? "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
              ...headers,
            },
            body: file,
          });
        }
        const publicUrl =
          typeof presign?.fileUrl === "string"
            ? presign.fileUrl
            : typeof presign?.publicUrl === "string"
              ? presign.publicUrl
              : uploadUrl.split("?")[0];
        queueOutboundMessage({
          type: "attachment.notify",
          payload: {
            orderId: session.orderId,
            name: file.name,
            url: publicUrl,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          },
        });
        toast({
          title: "Proof uploaded",
          description: "Counterparty has been notified.",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed.";
        toast({
          title: "Upload failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setUploadingProof(false);
      }
    },
    [queueOutboundMessage, session, toast],
  );

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void handleUploadProof(file);
    event.target.value = "";
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard.`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser blocked the copy request.",
        variant: "destructive",
      });
    }
  };

  const connectionPhaseLabel = (() => {
    switch (connectionState.phase) {
      case "open":
        return "Connected";
      case "connecting":
        return "Connecting…";
      case "reconnecting":
        return `Reconnecting (${connectionState.attempts})`;
      case "error":
        return "Connection error";
      case "closed":
        return "Disconnected";
      default:
        return "Idle";
    }
  })();

  const connectionBadgeVariant: "default" | "secondary" | "destructive" =
    connectionState.phase === "open"
      ? "default"
      : connectionState.phase === "error"
        ? "destructive"
        : "secondary";

  const attachments = order?.attachments ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="hidden items-center gap-2 md:flex"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Express P2P</h1>
          <p className="text-sm text-muted-foreground">
            Real-time peer-to-peer trading powered by Cloudflare Workers and
            Durable Objects.
          </p>
        </div>
        {session && (
          <div className="ml-auto flex items-center gap-2">
            <Badge
              variant={connectionBadgeVariant}
              className="flex items-center gap-1"
            >
              <PlugZap className="h-3.5 w-3.5" />
              {connectionPhaseLabel}
            </Badge>
            {connectionState.phase === "error" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRetryConnection}
                aria-label="Retry connection"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {!session && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-border/70 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Create a buyer order</CardTitle>
              <CardDescription>
                Generate a new order Durable Object instance. Share the returned
                order ID securely with your counterparty.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleCreateOrder}>
                <div className="grid gap-2">
                  <Label htmlFor="assetSymbol">Asset</Label>
                  <select
                    id="assetSymbol"
                    value={createForm.assetSymbol}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        assetSymbol: event.target.value,
                      }))
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {ASSET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fiatAmount">Fiat amount</Label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      id="fiatAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={createForm.fiatAmount}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          fiatAmount: event.target.value,
                        }))
                      }
                    />
                    <select
                      value={createForm.fiatCurrency}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          fiatCurrency: event.target.value,
                        }))
                      }
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {FIAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tokenAmount">Token amount</Label>
                  <Input
                    id="tokenAmount"
                    type="number"
                    min="0"
                    step="0.0000001"
                    placeholder="0.0000"
                    value={createForm.tokenAmount}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        tokenAmount: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentMethod">Payment method</Label>
                  <select
                    id="paymentMethod"
                    value={createForm.paymentMethod}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        paymentMethod: event.target.value,
                      }))
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {PAYMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="memo">Escrow instructions (optional)</Label>
                  <Textarea
                    id="memo"
                    placeholder="Provide instructions or KYC requirements for the seller."
                    value={createForm.memo}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        memo: event.target.value,
                      }))
                    }
                  />
                </div>
                {!hasWallet && (
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <ShieldAlert className="h-4 w-4" />
                    Connect a wallet before creating an order.
                  </div>
                )}
                <Button type="submit" disabled={creatingOrder || !hasWallet}>
                  {creatingOrder ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating order
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4" />
                      Create order
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Join an existing order</CardTitle>
              <CardDescription>
                Sellers join the Durable Object room with the order ID and
                short-lived session token.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleJoinOrder}>
                <div className="grid gap-2">
                  <Label htmlFor="joinOrderId">Order ID</Label>
                  <Input
                    id="joinOrderId"
                    value={joinOrderId}
                    onChange={(event) => setJoinOrderId(event.target.value)}
                    placeholder="abc123"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="joinToken">Session token</Label>
                  <Textarea
                    id="joinToken"
                    value={joinToken}
                    onChange={(event) => setJoinToken(event.target.value)}
                    placeholder="Paste the secure token here"
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <RadioGroup
                    value={joinRole}
                    onValueChange={(value) => setJoinRole(value as OrderRole)}
                    className="grid grid-cols-2 gap-3"
                  >
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm shadow-sm">
                      <RadioGroupItem value="buyer" /> Buyer
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm shadow-sm">
                      <RadioGroupItem value="seller" /> Seller
                    </label>
                  </RadioGroup>
                </div>
                <Button type="submit" disabled={joinLoading}>
                  {joinLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting
                    </>
                  ) : (
                    <>
                      <PlugZap className="h-4 w-4" />
                      Join order
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {session && (
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <Card className="border border-border/70 bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Order overview
                  <Badge variant="secondary" className="capitalize">
                    {order ? order.status.replace(/_/g, " ") : "pending"}
                  </Badge>
                </CardTitle>
                <CardDescription>Order #{session.orderId}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border/60 bg-background/60 p-3">
                    <div className="text-xs uppercase text-muted-foreground">
                      Token amount
                    </div>
                    <div className="text-lg font-medium">
                      {formatAmount(order?.tokenAmount, 6)}{" "}
                      {order?.assetSymbol ?? createForm.assetSymbol}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/60 p-3">
                    <div className="text-xs uppercase text-muted-foreground">
                      Fiat value
                    </div>
                    <div className="text-lg font-medium">
                      {formatAmount(order?.fiatAmount, 2)}{" "}
                      {order?.fiatCurrency ?? createForm.fiatCurrency}
                    </div>
                  </div>
                </div>
                <div className="grid gap-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Payment method
                  </div>
                  <div className="font-medium uppercase">
                    {order?.paymentMethod ?? createForm.paymentMethod}
                  </div>
                </div>
                <div className="grid gap-2">
                  <div className="text-xs uppercase text-muted-foreground">
                    Participants
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="font-semibold">Buyer</div>
                      <div className="text-muted-foreground">
                        {order?.buyer?.displayName ?? "Pending"}
                      </div>
                      {order?.buyer?.address && (
                        <div className="break-all text-xs text-muted-foreground">
                          {order.buyer.address}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">Seller</div>
                      <div className="text-muted-foreground">
                        {order?.seller?.displayName ?? "Pending"}
                      </div>
                      {order?.seller?.address && (
                        <div className="break-all text-xs text-muted-foreground">
                          {order.seller.address}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {order?.escrowAddress && (
                  <div className="grid gap-1">
                    <div className="text-xs uppercase text-muted-foreground">
                      Escrow account
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(order.escrowAddress!, "Escrow address")
                      }
                      className="break-all text-left text-xs text-[hsl(var(--primary))] hover:underline"
                    >
                      {order.escrowAddress}
                    </button>
                  </div>
                )}
                <div className="grid gap-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Session token
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(session.token, "Session token")}
                    className="break-all text-left text-xs text-[hsl(var(--primary))] hover:underline"
                  >
                    {session.token}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    Keep this token secret. Share it only with the intended
                    counterparty.
                  </span>
                </div>
                <div className="grid gap-1">
                  <div className="text-xs uppercase text-muted-foreground">
                    Last event
                  </div>
                  <div>
                    {order ? describeRelativeTime(order.lastEventAt) : "—"}
                  </div>
                </div>
                <div className="grid gap-2">
                  <div className="text-xs uppercase text-muted-foreground">
                    Attachments
                  </div>
                  {attachments.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
                      No proof attachments uploaded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
                        >
                          <span className="truncate font-medium">
                            {attachment.name}
                          </span>
                          <span className="flex items-center gap-2 text-muted-foreground">
                            {attachment.uploadedBy !== "system" && (
                              <span className="capitalize">
                                {attachment.uploadedBy}
                              </span>
                            )}
                            {formatFileSize(attachment.size)}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingProof}
                  >
                    {uploadingProof ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading proof…
                      </>
                    ) : (
                      <>
                        <Paperclip className="h-4 w-4" />
                        Upload proof
                      </>
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                </div>
                <Button
                  variant="ghost"
                  onClick={handleLeaveOrder}
                  className="w-full"
                >
                  <XCircle className="h-4 w-4" />
                  Leave order
                </Button>
              </CardContent>
            </Card>
            {connectionError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ShieldAlert className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-semibold">Connection warning</div>
                  <div>{connectionError}</div>
                </div>
              </div>
            )}
          </div>

          <Card className="border border-border/70 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Room activity</CardTitle>
              <CardDescription>
                Chat and state changes are synchronised with the Durable Object
                in real time.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex h-[520px] flex-col gap-4">
              <ScrollArea className="flex-1 rounded-md border border-border/60 bg-background/60 p-3">
                <div
                  ref={messageViewportRef}
                  className="flex h-full flex-col gap-3"
                >
                  {chatMessages.length === 0 ? (
                    <div className="mt-10 text-center text-sm text-muted-foreground">
                      No messages yet. Start the conversation to coordinate the
                      trade.
                    </div>
                  ) : (
                    chatMessages.map((message) => {
                      const normalized = message.sender
                        .toString()
                        .toLowerCase();
                      const isSelf = normalized === session.role;
                      const isSystem = normalized === "system";
                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "rounded-md border px-3 py-2 text-sm shadow-sm",
                            isSystem && "border-dashed text-muted-foreground",
                            isSelf &&
                              "border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/5",
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between text-xs uppercase text-muted-foreground">
                            <span className="font-semibold">
                              {isSystem ? "System" : message.sender}
                            </span>
                            <span>{describeRelativeTime(message.ts)}</span>
                          </div>
                          {message.body && (
                            <div className="whitespace-pre-wrap text-sm">
                              {message.body}
                            </div>
                          )}
                          {message.attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {message.attachments.map((attachment) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1 text-xs hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
                                >
                                  <Paperclip className="h-3.5 w-3.5" />
                                  <span className="truncate">
                                    {attachment.name}
                                  </span>
                                  <span className="ml-auto shrink-0 text-muted-foreground">
                                    {formatFileSize(attachment.size)}
                                  </span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Available actions
                  </Label>
                  {availableActions.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                      Waiting for the next order state update.
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {availableActions.map((action) => {
                        const normalized = action.toLowerCase();
                        const label = ACTION_LABELS[normalized] ?? action;
                        const variant =
                          ACTION_VARIANTS[normalized] ?? "outline";
                        const loading = pendingAction === action;
                        return (
                          <Button
                            key={action}
                            variant={variant}
                            disabled={
                              loading || connectionState.phase === "error"
                            }
                            onClick={() => handleAction(action)}
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : normalized === "cancel" ? (
                              <XCircle className="h-4 w-4" />
                            ) : normalized === "appeal" ? (
                              <ShieldAlert className="h-4 w-4" />
                            ) : (
                              <PlugZap className="h-4 w-4" />
                            )}
                            {label}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <form
                  className="flex items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSendMessage();
                  }}
                >
                  <div className="flex-1">
                    <Label htmlFor="chatInput" className="sr-only">
                      Message
                    </Label>
                    <Textarea
                      id="chatInput"
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      placeholder="Write a message to your counterparty"
                      rows={2}
                      disabled={connectionState.phase === "error"}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      !chatInput.trim() || connectionState.phase === "error"
                    }
                    className="shrink-0"
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export { ExpressP2P };
export default ExpressP2P;
