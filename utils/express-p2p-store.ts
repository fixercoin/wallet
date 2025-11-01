import type { OrderRole } from "@/components/wallet/ExpressP2P";

type OrderPhase =
  | "awaiting_counterparty"
  | "awaiting_payment"
  | "buyer_paid"
  | "seller_confirmed"
  | "completed"
  | "cancelled"
  | "appealed";

type SessionRole = OrderRole | null;

type ParticipantSummary = {
  displayName?: string;
  address?: string;
  avatarUrl?: string;
};

type OrderAttachment = {
  id: string;
  url: string;
  name: string;
  uploadedBy: OrderRole | "system";
  contentType?: string;
  size?: number;
  uploadedAt: number;
};

type ChatMessage = {
  id: string;
  sender: OrderRole | "system";
  body: string;
  ts: number;
  attachments: OrderAttachment[];
};

type OrderSnapshot = {
  orderId: string;
  status: OrderPhase;
  assetSymbol: string;
  tokenAmount: number;
  fiatAmount: number;
  fiatCurrency: string;
  paymentMethod?: string;
  memo?: string;
  buyer: ParticipantSummary | null;
  seller: ParticipantSummary | null;
  escrowAddress?: string;
  attachments: OrderAttachment[];
  lastEventAt: number;
};

type CreateOrderInput = {
  assetSymbol?: string;
  fiatAmount?: number;
  tokenAmount?: number;
  fiatCurrency?: string;
  paymentMethod?: string;
  memo?: string;
  walletAddress?: string;
};

type CreateOrderResult = {
  orderId: string;
  token: string;
  inviteToken: string;
  role: OrderRole;
};

type PresignInput = {
  orderId: string;
  filename: string;
  contentType?: string;
  size?: number;
};

type PresignResult = {
  uploadUrl: string;
  fileUrl: string;
  method: "PUT" | "POST";
  headers?: Record<string, string>;
};

type PendingUpload = {
  id: string;
  orderId: string;
  filename: string;
  size?: number;
  contentType?: string;
  uploadedBy?: SessionRole;
  data?: Uint8Array | null;
  createdAt: number;
  updatedAt: number;
};

type StoredUpload = PendingUpload & {
  publicUrl: string;
};

type OrderConnection = {
  socket: WebSocketLike;
  token: string;
  role: SessionRole;
  address?: string;
  displayName?: string;
};

type OrderRoom = {
  id: string;
  buyerToken: string;
  inviteToken: string;
  createdAt: number;
  order: OrderSnapshot;
  chat: ChatMessage[];
  pendingUploads: Map<string, PendingUpload>;
  connections: Map<WebSocketLike, OrderConnection>;
};

type AcceptResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

type WebSocketLike = WebSocket & {
  accept?: () => void;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  readyState?: number;
};

type WebSocketMessageEvent = { data: unknown };

type WebSocketCloseEvent = { code?: number; reason?: string };

const MAX_MESSAGES = 300;
const MAX_ATTACHMENTS = 100;
const CLEANUP_AFTER_MS = 1000 * 60 * 60 * 4; // 4 hours
const CLEANUP_INTERVAL_MS = 1000 * 60 * 15; // 15 minutes

function randomId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function deriveAvailableActions(
  status: OrderPhase,
  role: SessionRole,
): string[] {
  if (!role) return [];
  switch (status) {
    case "awaiting_counterparty":
      return role === "seller" ? ["accept", "cancel"] : ["cancel"];
    case "awaiting_payment":
      return role === "buyer" ? ["mark_paid", "cancel"] : ["cancel"];
    case "buyer_paid":
      return role === "seller" ? ["mark_received", "appeal"] : ["appeal"];
    case "seller_confirmed":
      return role === "buyer" ? ["appeal"] : [];
    default:
      return [];
  }
}

function attachListener(
  socket: WebSocketLike,
  type: "message" | "close" | "error",
  handler: (event: any) => void,
) {
  const anySocket = socket as any;
  if (typeof anySocket.addEventListener === "function") {
    anySocket.addEventListener(type, handler);
    return;
  }
  if (typeof anySocket.on === "function") {
    anySocket.on(type, handler);
    return;
  }
  const prop = `on${type}`;
  if (prop in socket) {
    (socket as any)[prop] = handler;
  }
}

function safeJsonParse<T = any>(raw: unknown): T | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  if (raw instanceof ArrayBuffer) {
    try {
      const text = new TextDecoder().decode(new Uint8Array(raw));
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }
  if (ArrayBuffer.isView(raw)) {
    try {
      const text = new TextDecoder().decode(raw as Uint8Array);
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }
  return null;
}

class ExpressP2PStore {
  private rooms = new Map<string, OrderRoom>();
  private tokenIndex = new Map<
    string,
    { orderId: string; roleHint: SessionRole }
  >();
  private uploads = new Map<string, StoredUpload>();
  private lastCleanup = 0;

  createOrder(input: CreateOrderInput): CreateOrderResult {
    this.maybeCleanup();

    const orderId = randomId("order");
    const buyerToken = randomId("buyer");
    const inviteToken = randomId("seller");
    const now = Date.now();

    const order: OrderSnapshot = {
      orderId,
      status: "awaiting_counterparty",
      assetSymbol: normalizeString(input.assetSymbol?.toUpperCase(), "USDC"),
      tokenAmount: normalizeNumber(input.tokenAmount, 0),
      fiatAmount: normalizeNumber(input.fiatAmount, 0),
      fiatCurrency: normalizeString(input.fiatCurrency?.toUpperCase(), "PKR"),
      paymentMethod:
        normalizeString(input.paymentMethod, undefined as any) || undefined,
      memo: normalizeString(input.memo, undefined as any) || undefined,
      buyer: input.walletAddress
        ? {
            address: input.walletAddress,
            displayName: `Buyer ${input.walletAddress.slice(0, 4)}…${input.walletAddress.slice(-4)}`,
          }
        : {
            displayName: "Buyer",
          },
      seller: null,
      escrowAddress: undefined,
      attachments: [],
      lastEventAt: now,
    };

    const room: OrderRoom = {
      id: orderId,
      buyerToken,
      inviteToken,
      createdAt: now,
      order,
      chat: [],
      pendingUploads: new Map(),
      connections: new Map(),
    };

    this.rooms.set(orderId, room);
    this.tokenIndex.set(buyerToken, { orderId, roleHint: "buyer" });
    this.tokenIndex.set(inviteToken, { orderId, roleHint: "seller" });

    return {
      orderId,
      token: buyerToken,
      inviteToken,
      role: "buyer",
    };
  }

  createPresignedUpload(
    token: string | null,
    payload: PresignInput,
  ): PresignResult {
    if (!token) {
      throw Object.assign(new Error("Missing session token"), { status: 401 });
    }

    const roomEntry = this.tokenIndex.get(token);
    if (!roomEntry) {
      throw Object.assign(new Error("Invalid session token"), { status: 401 });
    }

    const room = this.rooms.get(roomEntry.orderId);
    if (!room || room.order.orderId !== payload.orderId) {
      throw Object.assign(new Error("Order session mismatch"), { status: 403 });
    }

    const uploadId = randomId("upload");
    const publicUrl = `/api/uploads/${uploadId}`;
    const now = Date.now();

    const entry: StoredUpload = {
      id: uploadId,
      orderId: room.order.orderId,
      filename: normalizeString(payload.filename, uploadId),
      size: normalizeNumber(payload.size, undefined as any) || undefined,
      contentType:
        normalizeString(payload.contentType, undefined as any) || undefined,
      uploadedBy: roomEntry.roleHint,
      data: null,
      createdAt: now,
      updatedAt: now,
      publicUrl,
    };

    room.pendingUploads.set(uploadId, entry);
    this.uploads.set(uploadId, entry);

    return {
      uploadUrl: publicUrl,
      fileUrl: publicUrl,
      method: "PUT",
    };
  }

  storeUploadData(
    uploadId: string,
    data: Uint8Array,
    contentType?: string,
  ): { ok: boolean; status: number; message?: string } {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      return { ok: false, status: 404, message: "Upload not found" };
    }
    upload.data = data;
    upload.contentType = contentType || upload.contentType;
    upload.updatedAt = Date.now();
    return { ok: true, status: 200 };
  }

  getUpload(uploadId: string): StoredUpload | null {
    const upload = this.uploads.get(uploadId);
    if (!upload || !upload.data) return null;
    return upload;
  }

  acceptWebSocketConnection(params: {
    orderId: string;
    token: string | null;
    socket: WebSocketLike;
  }): AcceptResult {
    const { orderId, token, socket } = params;
    if (!token) {
      return { ok: false, status: 401, message: "Missing session token" };
    }

    const entry = this.tokenIndex.get(token);
    if (!entry || entry.orderId !== orderId) {
      return { ok: false, status: 401, message: "Invalid session token" };
    }

    const room = this.rooms.get(orderId);
    if (!room) {
      return { ok: false, status: 404, message: "Order not found" };
    }

    try {
      socket.accept?.();
    } catch {
      // ignore
    }

    const connection: OrderConnection = {
      socket,
      token,
      role: entry.roleHint,
    };
    room.connections.set(socket, connection);

    attachListener(socket, "message", (event: WebSocketMessageEvent) => {
      this.handleSocketMessage(room, connection, event);
    });
    attachListener(socket, "close", () => {
      this.handleSocketClose(room, socket);
    });
    attachListener(socket, "error", () => {
      this.handleSocketClose(room, socket);
    });

    this.sendSystemNotice(connection, "Connected to order room.");
    return { ok: true };
  }

  private handleSocketMessage(
    room: OrderRoom,
    connection: OrderConnection,
    event: WebSocketMessageEvent,
  ) {
    const message = safeJsonParse<{ type?: string; payload?: any }>(event.data);
    if (!message || typeof message.type !== "string") {
      this.sendError(connection, "Invalid message format");
      return;
    }

    switch (message.type) {
      case "session.identify": {
        const role = normalizeString(
          message.payload?.role,
          "",
        ).toLowerCase() as OrderRole;
        if (role === "buyer" || role === "seller") {
          connection.role = role;
          connection.address =
            normalizeString(message.payload?.address, undefined as any) ||
            undefined;
          connection.displayName =
            normalizeString(message.payload?.displayName, undefined as any) ||
            undefined;
          this.updateParticipant(room, role, connection);
          this.broadcastOrderUpdate(room);
          this.sendSystemNotice(connection, `Role set to ${role}.`);
        } else {
          this.sendError(connection, "Unknown role");
        }
        return;
      }
      case "order.subscribe": {
        this.sendSnapshot(connection, room);
        this.sendChatHistory(connection, room);
        return;
      }
      case "chat.send": {
        const body = normalizeString(message.payload?.body, "");
        if (!body) {
          this.sendError(connection, "Empty message body");
          return;
        }
        if (!connection.role) {
          this.sendError(connection, "Identify session before chatting");
          return;
        }
        const chatMessage: ChatMessage = {
          id: randomId("msg"),
          sender: connection.role,
          body,
          ts: Date.now(),
          attachments: [],
        };
        this.addChatMessage(room, chatMessage);
        this.broadcast(room, { type: "chat.message", payload: chatMessage });
        return;
      }
      case "order.action": {
        const action = normalizeString(message.payload?.action, "") as string;
        if (!action) {
          this.sendError(connection, "Missing action");
          return;
        }
        if (!connection.role) {
          this.sendError(
            connection,
            "Identify session before performing actions",
          );
          return;
        }
        const result = this.performAction(room, connection.role, action);
        if (!result.ok) {
          this.sendError(connection, result.message || "Action failed");
        }
        return;
      }
      case "attachment.notify": {
        if (!connection.role) {
          this.sendError(connection, "Identify session before uploading");
          return;
        }
        const attachment = this.registerAttachment(
          room,
          connection,
          message.payload || {},
        );
        if (attachment) {
          this.broadcast(room, {
            type: "attachment.added",
            payload: attachment,
          });
          const chatMessage: ChatMessage = {
            id: `attachment-${attachment.id}`,
            sender: connection.role,
            body: attachment.name,
            ts: attachment.uploadedAt,
            attachments: [attachment],
          };
          this.addChatMessage(room, chatMessage);
          this.broadcast(room, { type: "chat.message", payload: chatMessage });
          this.broadcastOrderUpdate(room);
        }
        return;
      }
      default: {
        this.sendError(connection, "Unknown message type");
      }
    }
  }

  private handleSocketClose(room: OrderRoom, socket: WebSocketLike) {
    room.connections.delete(socket);
    if (room.connections.size === 0) {
      this.maybeCleanup();
    }
  }

  private sendSnapshot(connection: OrderConnection, room: OrderRoom) {
    const payload = {
      ...room.order,
      attachments: room.order.attachments.slice(),
      availableActions: deriveAvailableActions(
        room.order.status,
        connection.role,
      ),
      chat: room.chat.slice(),
    };
    this.safeSend(
      connection.socket,
      JSON.stringify({ type: "order.snapshot", payload }),
    );
  }

  private sendChatHistory(connection: OrderConnection, room: OrderRoom) {
    this.safeSend(
      connection.socket,
      JSON.stringify({
        type: "chat.history",
        payload: room.chat.slice(),
      }),
    );
  }

  private sendSystemNotice(connection: OrderConnection, message: string) {
    const payload = {
      type: "system.notice",
      payload: {
        id: randomId("notice"),
        message,
        ts: Date.now(),
      },
    };
    this.safeSend(connection.socket, JSON.stringify(payload));
  }

  private sendError(connection: OrderConnection, message: string) {
    this.safeSend(
      connection.socket,
      JSON.stringify({
        type: "error",
        payload: { message },
      }),
    );
  }

  private broadcast(room: OrderRoom, data: any) {
    const serialized = JSON.stringify(data);
    for (const conn of room.connections.values()) {
      this.safeSend(conn.socket, serialized);
    }
  }

  private safeSend(socket: WebSocketLike, payload: string) {
    try {
      if ((socket as any).readyState && (socket as any).readyState !== 1) {
        return;
      }
      socket.send(payload);
    } catch {
      // ignore
    }
  }

  private updateParticipant(
    room: OrderRoom,
    role: OrderRole,
    connection: OrderConnection,
  ) {
    const summary: ParticipantSummary = {
      displayName:
        connection.displayName ||
        (connection.address
          ? `${role === "buyer" ? "Buyer" : "Seller"} ${connection.address.slice(0, 4)}…${connection.address.slice(-4)}`
          : role === "buyer"
            ? "Buyer"
            : "Seller"),
      address: connection.address,
    };
    if (role === "buyer") {
      room.order.buyer = summary;
    } else {
      room.order.seller = summary;
      if (room.order.status === "awaiting_counterparty") {
        room.order.status = "awaiting_payment";
        room.order.lastEventAt = Date.now();
      }
    }
  }

  private addChatMessage(room: OrderRoom, message: ChatMessage) {
    room.chat.push(message);
    if (room.chat.length > MAX_MESSAGES) {
      room.chat.splice(0, room.chat.length - MAX_MESSAGES);
    }
    room.order.lastEventAt = message.ts;
  }

  private performAction(
    room: OrderRoom,
    role: OrderRole,
    action: string,
  ): { ok: boolean; message?: string } {
    const normalized = action.toLowerCase();
    const now = Date.now();
    const order = room.order;
    const previous = order.status;

    switch (normalized) {
      case "accept": {
        if (role !== "seller")
          return { ok: false, message: "Only sellers can accept" };
        if (order.status !== "awaiting_counterparty") {
          return { ok: false, message: "Order already accepted" };
        }
        order.status = "awaiting_payment";
        break;
      }
      case "mark_paid": {
        if (role !== "buyer")
          return { ok: false, message: "Only buyers can mark payment" };
        if (order.status !== "awaiting_payment") {
          return { ok: false, message: "Cannot mark paid in current state" };
        }
        order.status = "buyer_paid";
        break;
      }
      case "mark_received": {
        if (role !== "seller")
          return { ok: false, message: "Only sellers can confirm receipt" };
        if (order.status !== "buyer_paid") {
          return {
            ok: false,
            message: "Cannot confirm receipt before buyer pays",
          };
        }
        order.status = "seller_confirmed";
        break;
      }
      case "cancel": {
        if (
          !["awaiting_counterparty", "awaiting_payment", "buyer_paid"].includes(
            order.status,
          )
        ) {
          return { ok: false, message: "Cannot cancel at this stage" };
        }
        order.status = "cancelled";
        break;
      }
      case "appeal": {
        if (!["buyer_paid", "seller_confirmed"].includes(order.status)) {
          return { ok: false, message: "Appeals only allowed after payment" };
        }
        order.status = "appealed";
        break;
      }
      default:
        return { ok: false, message: "Unknown action" };
    }

    order.lastEventAt = now;
    this.broadcastOrderUpdate(room);
    const systemMessage: ChatMessage = {
      id: randomId("system"),
      sender: "system",
      body: `${role} performed ${normalized}`,
      ts: now,
      attachments: [],
    };
    this.addChatMessage(room, systemMessage);
    this.broadcast(room, { type: "chat.message", payload: systemMessage });

    if (
      previous === "seller_confirmed" &&
      order.status === "seller_confirmed"
    ) {
      // Automatically mark completed shortly after seller confirmation
      order.status = "completed";
      order.lastEventAt = now;
      this.broadcastOrderUpdate(room);
    }

    return { ok: true };
  }

  private registerAttachment(
    room: OrderRoom,
    connection: OrderConnection,
    payload: any,
  ): OrderAttachment | null {
    const now = Date.now();
    const url = normalizeString(payload?.url, "");
    if (!url) {
      this.sendError(connection, "Attachment URL missing");
      return null;
    }
    const name =
      normalizeString(payload?.name, payload?.filename) || "Attachment";
    const size = normalizeNumber(payload?.size, undefined as any) || undefined;
    const contentType =
      normalizeString(payload?.contentType, undefined as any) || undefined;

    const idFromUrlMatch = url.match(/([^/]+)$/);
    const attachmentId = normalizeString(
      payload?.id,
      idFromUrlMatch ? idFromUrlMatch[1] : randomId("file"),
    );

    const attachment: OrderAttachment = {
      id: attachmentId,
      url,
      name,
      uploadedBy: connection.role || "system",
      contentType,
      size,
      uploadedAt: now,
    };

    const existingIdx = room.order.attachments.findIndex(
      (item) => item.id === attachment.id,
    );
    if (existingIdx >= 0) {
      room.order.attachments[existingIdx] = attachment;
    } else {
      room.order.attachments.push(attachment);
      if (room.order.attachments.length > MAX_ATTACHMENTS) {
        room.order.attachments.splice(
          0,
          room.order.attachments.length - MAX_ATTACHMENTS,
        );
      }
    }
    room.order.lastEventAt = now;

    if (room.pendingUploads.has(attachment.id)) {
      room.pendingUploads.delete(attachment.id);
    }

    return attachment;
  }

  private broadcastOrderUpdate(room: OrderRoom) {
    const payload = {
      ...room.order,
      attachments: room.order.attachments.slice(),
      availableActions: [] as string[],
    };
    this.broadcast(room, { type: "order.update", payload });
  }

  private maybeCleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;

    for (const [orderId, room] of this.rooms.entries()) {
      if (room.connections.size > 0) continue;
      if (now - room.createdAt > CLEANUP_AFTER_MS) {
        this.rooms.delete(orderId);
        this.tokenIndex.delete(room.buyerToken);
        this.tokenIndex.delete(room.inviteToken);
      }
    }

    for (const [uploadId, upload] of this.uploads.entries()) {
      if (now - upload.updatedAt > CLEANUP_AFTER_MS) {
        this.uploads.delete(uploadId);
      }
    }
  }
}

function getSingleton(): ExpressP2PStore {
  const globalKey = "__EXPRESS_P2P_STORE_SINGLETON__";
  const globalObj = globalThis as Record<string, unknown>;
  if (!globalObj[globalKey]) {
    globalObj[globalKey] = new ExpressP2PStore();
  }
  return globalObj[globalKey] as ExpressP2PStore;
}

export const expressP2PStore = getSingleton();
export type {
  OrderRole,
  OrderPhase,
  OrderAttachment,
  ChatMessage,
  OrderSnapshot,
};
export type {
  CreateOrderInput,
  CreateOrderResult,
  PresignInput,
  PresignResult,
  AcceptResult,
};
