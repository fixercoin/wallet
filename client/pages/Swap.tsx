import { useNavigate } from "react-router-dom";
import { SwapInterface } from "@/components/wallet/SwapInterface";

export default function SwapPage() {
  const navigate = useNavigate();

  return (
    <SwapInterface onBack={() => navigate("/")} />
  );
}
