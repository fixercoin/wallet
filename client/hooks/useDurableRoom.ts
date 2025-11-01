import { useEffect, useMemo, useRef, useState } from "react";

export type EventMessage =
  | { kind: "snapshot"; data: { orders: any[] } }
  | { kind: "order:new"; data: any }
  | { kind: "chat"; data: { id: string; text: string; at: number } }
  | { kind: "notification"; data: any }
  | { kind: "pong"; ts: number };

export function useDurableRoom(roomId: string, httpBase: string = "") {
  const [events, setEvents] = useState<EventMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const wsUrl = useMemo(() => {
    const base =
      httpBase || (typeof window !== "undefined" ? window.location.origin : "");
    const wsb = base.replace(/^http/, "ws");
    return `${wsb}/ws/${encodeURIComponent(roomId)}`;
  }, [roomId, httpBase]);

  useEffect(() => {
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as EventMessage;
        setEvents((prev) => [...prev, msg]);
      } catch {}
    };
    ws.onclose = () => (wsRef.current = null);
    return () => ws.close();
  }, [wsUrl]);

  const send = (data: any) => wsRef.current?.send(JSON.stringify(data));

  return { events, send };
}
