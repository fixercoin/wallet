import { useEffect, useMemo, useRef, useState } from "react";

export type EventMessage =
  | { kind: "snapshot"; data: { orders: any[] } }
  | { kind: "order:new"; data: any }
  | { kind: "chat"; data: { id: string; text: string; at: number } }
  | { kind: "notification"; data: any }
  | { kind: "pong"; ts: number };

export function useDurableRoom(roomId: string, httpBase: string = "") {
  const [events, setEvents] = useState<EventMessage[]>([]);

  const base =
    httpBase || (typeof window !== "undefined" ? window.location.origin : "");
  const ordersUrl = useMemo(() => `${base}/api/p2p/orders`, [base]);

  useEffect(() => {
    let mounted = true;
    let intervalId: any = null;

    const fetchSnapshot = async () => {
      try {
        const res = await fetch(`${ordersUrl}`);
        if (!res.ok) return;
        const data = await res.json();
        // normalize into snapshot event
        const snapshot: EventMessage = {
          kind: "snapshot",
          data: { orders: data.orders || [] },
        };
        if (mounted) setEvents((prev) => [...prev, snapshot]);
      } catch (e) {
        // ignore
      }
    };

    // Initial fetch and then poll every 5s
    fetchSnapshot();
    intervalId = setInterval(fetchSnapshot, 5000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [ordersUrl]);

  const send = (_data: any) => {
    // Polling mode does not support sending via WS
    console.warn("DurableRoom polling mode: send() is a no-op");
  };

  return { events, send };
}
