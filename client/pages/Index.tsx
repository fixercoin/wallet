import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";
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
import { StakeTokens } from "@/components/wallet/StakeTokens";
import { TokenStakingDetail } from "@/components/wallet/TokenStakingDetail";
import DocumentationPage from "./DocumentationPage";

type Screen =
  | "dashboard"
  | "send"
  | "receive"
  | "swap"
  | "token-detail"
  | "token-manage"
  | "settings"
  | "documentation"
  | "autobot"
  | "setup"
  | "accounts"
  | "airdrop"
  | "lock"
  | "burn"
  | "stake-tokens"
  | "stake-token-detail";

interface ScreenState {
  screen: Screen;
  tokenMint?: string;
}

export default function Index() {
  const navigate = useNavigate();
  const { wallet, tokens, isInitialized, requiresPassword } = useWallet();
  const [currentScreen, setCurrentScreen] = useState<ScreenState>({
    screen: "dashboard",
  });
  const [isAutoBotActive, setIsAutoBotActive] = useState(false);

  // Wait for wallet context to be initialized from localStorage
  if (!isInitialized) {
    console.log("[Index] Wallet context initializing...");
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-300">Loading wallet...</p>
        </div>
      </div>
    );
  }

  // If password is required, don't show setup - let PasswordPromptDialog handle it
  if (requiresPassword && !wallet) {
    console.log("[Index] Wallet is password protected, awaiting unlock...");
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-gray-300">Waiting for password unlock...</p>
        </div>
      </div>
    );
  }

  // If no wallet exists (new user), show the wallet setup screen
  if (!wallet) {
    console.log("[Index] No wallet found, showing wallet setup screen");
    return (
      <WalletSetup
        onComplete={() => setCurrentScreen({ screen: "dashboard" })}
      />
    );
  }

  // Wallet exists - show dashboard
  console.log("[Index] ✅ Wallet loaded successfully:", wallet.publicKey);

  const navigateToScreen = (screen: Screen, tokenMint?: string) => {
    setCurrentScreen({ screen, tokenMint });
  };

  const navigateToDashboard = () => {
    setCurrentScreen({ screen: "dashboard" });
  };

  const handleTokenClick = (tokenMint: string) => {
    navigateToScreen("token-detail", tokenMint);
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
          onDocumentation={() => navigateToScreen("documentation")}
        />
      );

    case "documentation":
      return <DocumentationPage onBack={navigateToDashboard} />;

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

    case "stake-tokens":
      return (
        <StakeTokens
          onBack={navigateToDashboard}
          onTokenSelect={(tokenMint) =>
            navigateToScreen("stake-token-detail", tokenMint)
          }
        />
      );

    case "stake-token-detail": {
      const selectedToken = tokens.find(
        (t) => t.mint === currentScreen.tokenMint,
      );
      if (!selectedToken) {
        return <StakeTokens onBack={navigateToDashboard} />;
      }
      return (
        <TokenStakingDetail
          token={selectedToken}
          onBack={navigateToDashboard}
        />
      );
    }

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
          onStakeTokens={() => navigateToScreen("stake-tokens")}
        />
      );
  }
}
