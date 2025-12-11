import React from "react";
import { P2POrderChat } from "./P2POrderChat";
import type { P2POrder } from "@/lib/p2p-api";

interface P2PDialogWithChatProps {
  children: React.ReactNode;
  order?: P2POrder | null;
}

export function P2PDialogWithChat({
  children,
  order,
}: P2PDialogWithChatProps) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Dialog Content Row */}
      <div className="flex-1">{children}</div>

      {/* Chat Row */}
      {order && <P2POrderChat order={order} />}
    </div>
  );
}
