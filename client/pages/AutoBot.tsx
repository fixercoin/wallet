import { useNavigate } from "react-router-dom";
import { MarketMaker } from "@/components/wallet/MarketMaker";

export default function AutoBot() {
  const navigate = useNavigate();

  return <MarketMaker onBack={() => navigate("/")} />;
}
