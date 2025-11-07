import React, { useEffect, useState } from "react";
import {
  getDerivedPrice,
  type SupportedToken,
} from "@/lib/services/derived-price";

type Props = { token: SupportedToken; className?: string };

export const TokenDerivedPrice: React.FC<Props> = ({ token, className }) => {
  const [tokensPerSol, setTokensPerSol] = useState<number | null>(null);
  const [tokenUsd, setTokenUsd] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    getDerivedPrice(token)
      .then((p) => {
        if (!mounted) return;
        setTokensPerSol(p.tokensPerSol);
        setTokenUsd(p.tokenUsd);
      })
      .catch(() => {})
      .finally(() => {});
    const id = setInterval(() => {
      getDerivedPrice(token).then((p) => {
        if (!mounted) return;
        setTokensPerSol(p.tokensPerSol);
        setTokenUsd(p.tokenUsd);
      });
    }, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [token]);

  const fmt = (n: number | null, dHigh = 6, dLow = 8) => {
    if (n === null || !Number.isFinite(n)) return "-";
    if (n >= 1) return n.toFixed(2);
    if (n >= 0.01) return n.toFixed(dHigh);
    return n.toFixed(dLow);
  };

  return (
    <div className={className || "text-sm text-gray-300"}>
      <div>
        1 SOL = {fmt(tokensPerSol)} {token}
      </div>
      <div>
        1 {token} = ${fmt(tokenUsd, 6, 8)} USDT
      </div>
    </div>
  );
};

export default TokenDerivedPrice;
