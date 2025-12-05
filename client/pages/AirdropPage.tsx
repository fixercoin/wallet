import { useNavigate } from "react-router-dom";
import { Airdrop } from "@/components/wallet/Airdrop";

export default function AirdropPage() {
  const navigate = useNavigate();

  return <Airdrop onBack={() => navigate("/")} />;
}
