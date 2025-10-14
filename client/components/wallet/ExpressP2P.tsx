import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const ExpressP2P: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);
  return null;
};

export default ExpressP2P;
