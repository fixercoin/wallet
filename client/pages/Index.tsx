import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { WalletSetup } from "@/components/wallet/WalletSetup";
import { Dashboard } from "@/components/wallet/Dashboard";
import { SendTransaction } from "@/components/wallet/SendTransaction";
import { ReceiveTransaction } from "@/components/wallet/ReceiveTransaction";
import { SwapInterface } from "@/components/wallet/SwapInterface";
import { TokenDetail } from "@/components/wallet/TokenDetail";
import { Settings } from "@/components/wallet/Settings";
import { MarketMaker } from "@/components/wallet/MarketMaker";
import { Airdrop } from "@/components/wallet/Airdrop";
import { Accounts } from "@/components/wallet/Accounts";
import { TokenLock } from "@/components/wallet/TokenLock";
import { BurnToken } from "@/components/wallet/BurnToken";
import { TokenManage } from "@/components/wallet/TokenManage";

type Screen =
  | "dashboard"
  | "send"
  | "receive"
  | "swap"
  | "token-detail"
  | "token-manage"
  | "settings"
  | "autobot"
  | "setup"
  | "accounts"
  | "airdrop"
  | "lock"
  | "burn";

interface ScreenState {
  screen: Screen;
  tokenMint?: string;
}

export default function Index() {
  const { wallet } = useWallet();
  const [currentScreen, setCurrentScreen] = useState<ScreenState>({
    screen: "dashboard",
  });
  const [isAutoBotActive, setIsAutoBotActive] = useState(false);

  // If no wallet is set up, show the wallet setup screen
  if (!wallet) {
    return (
      <WalletSetup
        onComplete={() => setCurrentScreen({ screen: "dashboard" })}
      />
    );
  }

  const navigateToScreen = (screen: Screen, tokenMint?: string) => {
    setCurrentScreen({ screen, tokenMint });
  };

  const navigateToDashboard = () => {
    setCurrentScreen({ screen: "dashboard" });
  };

  const handleTokenClick = (tokenMint: string) => {
    navigateToScreen("token-manage", tokenMint);
  };

  const handleTokenManageContinue = (tokenMint: string) => {
    navigateToScreen("token-detail", tokenMint);
  };

  const handleBuyToken = (tokenMint: string) => {
    // For buy functionality, redirect to swap with the token pre-selected
    navigateToScreen("swap");
  };

  const handleSellToken = (tokenMint: string) => {
    // For sell functionality, redirect to swap with the token pre-selected
    navigateToScreen("swap");
  };

  const handleSendToken = (tokenMint: string) => {
    navigateToScreen("send", tokenMint);
  };

  // Render the appropriate screen based on current state
  switch (currentScreen.screen) {
    case "send":
      return (
        <SendTransaction
          onBack={navigateToDashboard}
          initialMint={currentScreen.tokenMint}
        />
      );

    case "receive":
      return <ReceiveTransaction onBack={navigateToDashboard} />;

    case "swap":
      return <SwapInterface onBack={navigateToDashboard} />;

    case "token-detail":
      return (
        <TokenDetail
          tokenMint={currentScreen.tokenMint || ""}
          onBack={navigateToDashboard}
          onBuy={handleBuyToken}
          onSell={handleSellToken}
          onSend={handleSendToken}
          onReceive={() => navigateToScreen("receive")}
        />
      );

    case "token-manage":
      return (
        <TokenManage
          tokenMint={currentScreen.tokenMint || ""}
          onBack={navigateToDashboard}
          onContinue={handleTokenManageContinue}
        />
      );

    case "settings":
      return (
        <Settings
          onBack={navigateToDashboard}
          onOpenSetup={() => navigateToScreen("setup")}
        />
      );

    case "accounts":
      return (
        <Accounts
          onBack={navigateToDashboard}
          onOpenSetup={() => navigateToScreen("setup")}
        />
      );

    case "setup":
      return (
        <WalletSetup
          onComplete={() => setCurrentScreen({ screen: "dashboard" })}
        />
      );

    case "autobot":
      return <MarketMaker onBack={navigateToDashboard} />;

    case "airdrop":
      return <Airdrop onBack={navigateToDashboard} />;

    case "lock":
      return <TokenLock onBack={navigateToDashboard} />;

    case "burn":
      return <BurnToken onBack={navigateToDashboard} />;

    case "dashboard":
    default:
      return (
        <Dashboard
          onSend={() => navigateToScreen("send")}
          onReceive={() => navigateToScreen("receive")}
          onSwap={() => navigateToScreen("swap")}
          onAutoBot={() => navigateToScreen("autobot")}
          onAirdrop={() => navigateToScreen("airdrop")}
          onTokenClick={handleTokenClick}
          onSettings={() => navigateToScreen("settings")}
          onOpenSetup={() => navigateToScreen("setup")}
          onAccounts={() => navigateToScreen("accounts")}
          onLock={() => navigateToScreen("lock")}
          onBurn={() => navigateToScreen("burn")}
        />
      );
  }
}
