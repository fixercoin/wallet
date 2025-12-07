import { useNavigate } from "react-router-dom";
import { BurnToken } from "@/components/wallet/BurnToken";

export default function BurnTokenPage() {
  const navigate = useNavigate();

  return <BurnToken onBack={() => navigate("/")} />;
}
