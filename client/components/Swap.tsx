import React from "react";
import { getBalance } from "../lib/wallet";

export default function Swap({ wallet }) {
  const [balance, setBalance] = React.useState(0);

  React.useEffect(() => {
    if (wallet?.publicKey) {
      getBalance(wallet.publicKey.toString()).then(setBalance);
    }
  }, [wallet]);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">Wallet Swap</h2>
      <p>Balance: {balance} SOL</p>
    </div>
  );
}
