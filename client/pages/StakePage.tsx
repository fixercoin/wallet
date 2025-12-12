import { useNavigate } from "react-router-dom";
import { StakeTokens } from "@/components/wallet/StakeTokens";

export default function StakePage() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  const handleTokenSelect = (tokenMint: string) => {
    navigate(`/stake/${tokenMint}`);
  };

  return (
    <StakeTokens
      onBack={handleBack}
      onTokenSelect={handleTokenSelect}
    />
  );
}
