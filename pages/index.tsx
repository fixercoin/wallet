import React, { useEffect, useState } from "react";
import { getWalletBalance, getSPLTokens } from "@/client/api";

const PUBLIC_KEY = "YOUR_WALLET_PUBLIC_KEY";

export default function Index() {
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [splTokens, setSplTokens] = useState<any[]>([]);

  useEffect(() => {
    async function fetchWalletData() {
      try {
        const balance = await getWalletBalance(PUBLIC_KEY);
        setSolBalance(balance);

        const tokens = await getSPLTokens(PUBLIC_KEY);
        setSplTokens(tokens);
      } catch (err) {
        console.error(err);
      }
    }
    fetchWalletData();
  }, []);

  return (
    <div>
      <h1>Wallet Dashboard</h1>
      <p>SOL Balance: {solBalance ?? "Loading..."}</p>
      <h2>SPL Tokens</h2>
      <ul>
        {splTokens.length
          ? splTokens.map((t) => (
              <li key={t.mint}>
                {t.symbol}: {t.amount}
              </li>
            ))
          : "Loading tokens..."}
      </ul>
    </div>
  );
}
