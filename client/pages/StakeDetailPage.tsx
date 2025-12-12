import { useParams, useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { TokenStakingDetail } from "@/components/wallet/TokenStakingDetail";
import { useEffect, useState } from "react";
import { TokenInfo } from "@/lib/wallet";

export default function StakeDetailPage() {
  const { mint } = useParams<{ mint: string }>();
  const navigate = useNavigate();
  const { tokens } = useWallet();
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mint) {
      navigate("/stake");
      return;
    }

    const foundToken = tokens.find((t) => t.mint === mint);
    if (foundToken) {
      setToken(foundToken);
    } else {
      navigate("/stake");
    }
    setLoading(false);
  }, [mint, tokens, navigate]);

  if (loading || !token) {
    return null;
  }

  return <TokenStakingDetail token={token} onBack={() => navigate("/stake")} />;
}
