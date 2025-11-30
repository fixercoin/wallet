import React, { useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DocSection {
  id: string;
  title: string;
  content: string;
  subsections?: { title: string; content: string }[];
}

const documentationSections: DocSection[] = [
  {
    id: "create-account",
    title: "HOW TO CREATE AN ACCOUNT",
    content:
      "CREATING A SECURE WALLET ACCOUNT IS THE FIRST STEP TO USING FIXORIUM. FOLLOW THESE STEPS TO GET STARTED WITH A NEW WALLET.",
    subsections: [
      {
        title: "STEP 1: OPEN THE WALLET SETUP",
        content:
          "WHEN YOU FIRST OPEN FIXORIUM, YOU'LL SEE THE WALLET SETUP SCREEN WITH TWO OPTIONS: 'CREATE NEW WALLET' AND 'IMPORT WALLET'.",
      },
      {
        title: "STEP 2: CLICK CREATE NEW WALLET",
        content:
          "SELECT THE 'CREATE NEW WALLET' BUTTON TO GENERATE A NEW SECURE WALLET WITH A RANDOMLY GENERATED RECOVERY PHRASE.",
      },
      {
        title: "STEP 3: SECURE YOUR RECOVERY PHRASE",
        content:
          "A 12-WORD RECOVERY PHRASE WILL BE DISPLAYED. THIS IS CRUCIAL FOR ACCOUNT RECOVERY. WRITE IT DOWN ON PAPER AND STORE IT IN A SAFE PLACE. NEVER SHARE THIS PHRASE WITH ANYONE.",
      },
      {
        title: "STEP 4: CONFIRM YOUR RECOVERY PHRASE",
        content:
          "YOU'LL BE ASKED TO CONFIRM YOUR RECOVERY PHRASE BY SELECTING THE WORDS IN THE CORRECT ORDER. THIS ENSURES YOU'VE WRITTEN THEM DOWN CORRECTLY.",
      },
      {
        title: "STEP 5: SET UP YOUR WALLET",
        content:
          "AFTER CONFIRMATION, YOUR WALLET IS CREATED AND READY TO USE. YOU CAN NOW ACCESS THE DASHBOARD, RECEIVE FUNDS, AND PERFORM TRANSACTIONS.",
      },
      {
        title: "SECURITY TIPS",
        content:
          "• NEVER STORE YOUR RECOVERY PHRASE DIGITALLY ON DEVICES CONNECTED TO THE INTERNET\n• DO NOT SHARE YOUR RECOVERY PHRASE OR PRIVATE KEY WITH ANYONE\n• STORE YOUR RECOVERY PHRASE IN A SAFE PHYSICAL LOCATION (SAFE DEPOSIT BOX, HOME SAFE, ETC.)\n• USE A STRONG PASSWORD IF YOU ENABLE WALLET ENCRYPTION\n• REGULARLY BACKUP YOUR RECOVERY PHRASE",
      },
    ],
  },
  {
    id: "import-wallet",
    title: "HOW TO IMPORT A WALLET",
    content:
      "IF YOU ALREADY HAVE A SOLANA WALLET, YOU CAN IMPORT IT INTO FIXORIUM USING YOUR RECOVERY PHRASE OR PRIVATE KEY.",
    subsections: [
      {
        title: "IMPORTING VIA RECOVERY PHRASE",
        content:
          "1. CLICK 'IMPORT WALLET' ON THE SETUP SCREEN\n2. SELECT 'RECOVERY PHRASE' AS THE IMPORT METHOD\n3. ENTER YOUR 12-WORD RECOVERY PHRASE SEPARATED BY SPACES\n4. YOUR WALLET WILL BE IMPORTED AND READY TO USE\n\nNOTE: THE RECOVERY PHRASE MUST BE IN THE EXACT SAME ORDER AS ORIGINALLY CREATED.",
      },
      {
        title: "IMPORTING VIA PRIVATE KEY",
        content:
          "1. CLICK 'IMPORT WALLET' ON THE SETUP SCREEN\n2. SELECT 'PRIVATE KEY' AS THE IMPORT METHOD\n3. PASTE YOUR PRIVATE KEY (IN BASE58 FORMAT)\n4. YOUR WALLET WILL BE IMPORTED\n\nWARNING: IMPORTING VIA PRIVATE KEY CREATES A VIEW-ONLY WALLET WITHOUT A RECOVERY PHRASE. YOU CANNOT RECOVER THIS WALLET WITH JUST THE PRIVATE KEY.",
      },
      {
        title: "IMPORTING MULTIPLE WALLETS",
        content:
          "YOU CAN IMPORT AND MANAGE MULTIPLE WALLETS IN FIXORIUM. EACH WALLET IS STORED SEPARATELY AND YOU CAN SWITCH BETWEEN THEM FROM THE ACCOUNTS SECTION IN SETTINGS. ALL WALLETS ARE STORED LOCALLY ON YOUR DEVICE.",
      },
      {
        title: "IMPORTANT WARNINGS",
        content:
          "• ONLY IMPORT WALLETS ON SECURE DEVICES\n• NEVER IMPORT WALLETS ON PUBLIC OR SHARED COMPUTERS\n• BE CAUTIOUS OF CLIPBOARD HIJACKING MALWARE\n• VERIFY THE WALLET ADDRESS AFTER IMPORT TO ENSURE IT'S CORRECT\n• DO NOT IMPORT WALLETS YOU DON'T TRUST OR CONTROL",
      },
    ],
  },
  {
    id: "swap-tokens",
    title: "HOW TO SWAP TOKENS",
    content:
      "SWAP TOKENS DIRECTLY IN YOUR WALLET USING INTEGRATED DEX PROTOCOLS. INSTANTLY EXCHANGE ONE TOKEN FOR ANOTHER.",
    subsections: [
      {
        title: "ACCESSING THE SWAP INTERFACE",
        content:
          "FROM THE DASHBOARD, CLICK THE 'SWAP' BUTTON IN THE NAVIGATION MENU. YOU'LL SEE THE TOKEN SWAP INTERFACE WITH INPUT AND OUTPUT FIELDS.",
      },
      {
        title: "SELECTING TOKENS",
        content:
          "1. CLICK ON THE 'FROM' TOKEN TO SELECT THE TOKEN YOU WANT TO SELL\n2. CLICK ON THE 'TO' TOKEN TO SELECT THE TOKEN YOU WANT TO RECEIVE\n3. YOU CAN ALSO CLICK THE SWAP ARROW ICON TO REVERSE THE TOKENS\n4. YOUR AVAILABLE BALANCE FOR THE 'FROM' TOKEN IS SHOWN BELOW THE INPUT FIELD",
      },
      {
        title: "ENTERING AMOUNT",
        content:
          "TYPE THE AMOUNT YOU WANT TO SWAP IN THE 'FROM' FIELD. THE EXPECTED OUTPUT AMOUNT IN THE 'TO' FIELD WILL UPDATE AUTOMATICALLY BASED ON CURRENT MARKET PRICES. CLICK 'MAX' TO USE YOUR ENTIRE AVAILABLE BALANCE.",
      },
      {
        title: "REVIEWING THE EXCHANGE RATE",
        content:
          "BEFORE CONFIRMING, REVIEW THE EXCHANGE RATE AND ESTIMATED OUTPUT. THE RATE INCLUDES SLIPPAGE TOLERANCE (TYPICALLY 0.5%-2%). HIGHER SLIPPAGE = LOWER MINIMUM OUTPUT BUT HIGHER SUCCESS RATE.",
      },
      {
        title: "CONFIRMING THE SWAP",
        content:
          "CLICK 'SWAP' TO EXECUTE THE TRANSACTION. YOU'LL NEED TO SIGN THE TRANSACTION WITH YOUR WALLET. ONCE SIGNED, THE SWAP IS SUBMITTED TO THE BLOCKCHAIN AND WILL COMPLETE WITHIN SECONDS TO A FEW MINUTES.",
      },
      {
        title: "SWAP TIPS",
        content:
          "• CHECK THE NETWORK FEE BEFORE SWAPPING\n• PAIR THE TOKENS YOU WANT TO SWAP ARE ON THE SAME BLOCKCHAIN (SOLANA)\n• LARGE SWAPS MAY HAVE HIGHER SLIPPAGE\n• SLIPPAGE IS THE DIFFERENCE BETWEEN EXPECTED AND MINIMUM OUTPUT PRICE\n• FAILED SWAPS DON'T CONSUME SOL FOR FEES (NATIVE FAILURE)\n• POPULAR PAIRS HAVE BETTER LIQUIDITY AND LOWER SLIPPAGE",
      },
    ],
  },
  {
    id: "limit-orders",
    title: "HOW TO PLACE LIMIT ORDERS",
    content:
      "SET LIMIT ORDERS TO BUY OR SELL TOKENS AT SPECIFIC PRICES. YOUR ORDER EXECUTES AUTOMATICALLY WHEN THE MARKET PRICE REACHES YOUR TARGET.",
    subsections: [
      {
        title: "ACCESSING LIMIT ORDERS",
        content:
          "FROM THE DASHBOARD, NAVIGATE TO 'MARKET MAKER' OR 'LIMIT ORDERS' SECTION TO CREATE AND MANAGE YOUR ORDERS.",
      },
      {
        title: "CREATING A BUY LIMIT ORDER",
        content:
          "1. SELECT 'BUY' AS THE ORDER TYPE\n2. CHOOSE THE TOKEN YOU WANT TO BUY\n3. ENTER THE QUANTITY YOU WANT TO BUY\n4. SET YOUR MAXIMUM PRICE (LIMIT PRICE) PER TOKEN\n5. REVIEW THE TOTAL COST (QUANTITY × PRICE)\n6. CLICK 'CREATE ORDER' TO PLACE THE ORDER\n\nYOUR ORDER WILL REMAIN ACTIVE UNTIL IT'S FILLED, CANCELLED, OR EXPIRES.",
      },
      {
        title: "CREATING A SELL LIMIT ORDER",
        content:
          "1. SELECT 'SELL' AS THE ORDER TYPE\n2. CHOOSE THE TOKEN YOU WANT TO SELL\n3. ENTER THE QUANTITY YOU WANT TO SELL\n4. SET YOUR MINIMUM PRICE (LIMIT PRICE) PER TOKEN\n5. REVIEW THE TOTAL VALUE YOU'LL RECEIVE\n6. CLICK 'CREATE ORDER' TO PLACE THE ORDER\n\nYOUR ORDER WILL REMAIN ACTIVE UNTIL IT'S FILLED, CANCELLED, OR EXPIRES.",
      },
      {
        title: "MANAGING ACTIVE ORDERS",
        content:
          "VIEW ALL YOUR ACTIVE ORDERS IN THE 'ORDERS' SECTION. YOU CAN:\n• MONITOR ORDER STATUS AND FILLS\n• PARTIAL FILLS SHOW HOW MUCH HAS BEEN EXECUTED\n• CANCEL ORDERS AT ANY TIME (NO FEE FOR CANCELLATION)\n• VIEW FILLED ORDERS IN HISTORY\n• CREATE NEW ORDERS WHILE OTHERS ARE ACTIVE",
      },
      {
        title: "ORDER EXECUTION",
        content:
          "ORDERS EXECUTE WHEN MARKET CONDITIONS ARE MET:\n• BUY ORDERS EXECUTE WHEN PRICE DROPS TO OR BELOW YOUR LIMIT\n• SELL ORDERS EXECUTE WHEN PRICE RISES TO OR ABOVE YOUR LIMIT\n• ORDERS CAN PARTIALLY FILL IF NOT ENOUGH VOLUME IS AVAILABLE\n• EXECUTION IS SUBJECT TO NETWORK CONDITIONS\n• FAILED ORDERS REMAIN ACTIVE UNLESS CANCELLED",
      },
      {
        title: "LIMIT ORDER TIPS",
        content:
          "• SET REALISTIC PRICES BASED ON CURRENT MARKET\n• POPULAR TOKENS EXECUTE FASTER THAN LESS LIQUID TOKENS\n• CHECK THE ORDER BOOK BEFORE SETTING PRICES\n• LOWER LIMIT PRICES FOR BUYS AND HIGHER LIMITS FOR SELLS\n• MONITOR YOUR ORDERS REGULARLY\n• CANCEL ORDERS YOU NO LONGER WANT TO EXECUTE\n• LIQUIDITY AND VOLUME AFFECT EXECUTION SPEED",
      },
    ],
  },
  {
    id: "burn-tokens",
    title: "How to Burn Tokens",
    content:
      "Permanently remove tokens from circulation by sending them to a null address. This reduces total supply and can increase token value.",
    subsections: [
      {
        title: "What is Token Burning?",
        content:
          "Token burning is the process of sending tokens to a dead address (null address) where they cannot be recovered. This permanently removes tokens from circulation and reduces the total supply.",
      },
      {
        title: "Accessing the Burn Feature",
        content:
          "From the Dashboard, click on a token and select 'Burn Token' or navigate to the Burn section from the main menu.",
      },
      {
        title: "Selecting Tokens to Burn",
        content:
          "1. Choose the token you want to burn from your wallet\n2. Enter the quantity to burn\n3. Click 'MAX' to burn your entire balance of that token\n4. Review the amount before burning",
      },
      {
        title: "Confirming the Burn",
        content:
          "1. Review the burn transaction details\n2. Confirm that you want to permanently remove these tokens\n3. Sign the transaction with your wallet\n4. The tokens will be sent to the null address and permanently destroyed",
      },
      {
        title: "After Burning",
        content:
          "Once burned:\n• Tokens are permanently removed from circulation\n• This action cannot be undone\n• Your wallet balance for that token decreases\n• The burn transaction is recorded on the blockchain\n• You can view the burn in your transaction history",
      },
      {
        title: "Important Warnings",
        content:
          "• Token burning is PERMANENT and CANNOT be reversed\n• Double-check the amount before confirming\n• Only burn tokens you own and control\n• Verify you have the correct token selected\n• Pay attention to token decimals\n• Some tokens may not be burnable (check token contract)",
      },
    ],
  },
  {
    id: "stake-tokens",
    title: "How to Stake Tokens",
    content:
      "Earn rewards by staking your tokens for a fixed period. Lock your tokens to generate passive income through staking rewards.",
    subsections: [
      {
        title: "Understanding Staking",
        content:
          "Staking allows you to lock tokens for a set period and earn rewards. The longer you stake, the more rewards you earn. Current APY is 10% (varies by token and conditions).",
      },
      {
        title: "Accessing Staking",
        content:
          "From the Dashboard, select a token and click 'Stake' to access the staking interface. You can also navigate to 'Stake Tokens' from the main menu.",
      },
      {
        title: "Choosing Stake Period",
        content:
          "Select your lock period:\n• 30 days: Standard staking period\n• 60 days: Extended period with higher rewards\n• 90 days: Maximum period with maximum rewards\n\nRewards increase proportionally with the lock period.",
      },
      {
        title: "Entering Stake Amount",
        content:
          "1. Enter the amount of tokens you want to stake\n2. Minimum stake is typically 10 million tokens\n3. Click 'MAX' to stake your entire available balance\n4. The expected reward will be calculated automatically",
      },
      {
        title: "Confirming Your Stake",
        content:
          "1. Review the stake details:\n   • Amount staked\n   • Lock period\n   • Expected reward\n   • Total value at unlock\n2. Click 'Start Staking' to create the stake\n3. Sign the transaction with your wallet",
      },
      {
        title: "Managing Active Stakes",
        content:
          "View all active stakes in the 'Active Stakes' section:\n• Monitor remaining lock time\n• See current reward amount\n• View stake details\n• Countdown timer shows when stake unlocks\n• 'Withdrawal Locked' button during lock period\n• 'Withdraw' button becomes available when time expires",
      },
      {
        title: "Withdrawing Stakes",
        content:
          "When the lock period expires:\n1. Click 'Withdraw' on your stake\n2. Receive your original tokens PLUS rewards\n3. Sign the withdrawal transaction\n4. Tokens are returned to your wallet\n\nYou cannot withdraw until the lock period is complete.",
      },
      {
        title: "Staking Tips",
        content:
          "• Stakes cannot be withdrawn early\n• Rewards are calculated daily\n• Lock the maximum period (90 days) for best rewards\n• Reward calculation: (Amount × 10% APY ÷ 365) × Days\n• Staking is non-custodial - you retain control\n• Monitor your active stakes regularly\n• Plan your lock periods strategically",
      },
    ],
  },
  {
    id: "lock-tokens",
    title: "How to Lock Tokens",
    content:
      "Create token locks to restrict token transfers for a specific duration. Useful for project security and investor confidence.",
    subsections: [
      {
        title: "What is Token Locking?",
        content:
          "Token locking restricts the movement of tokens for a set period. Locked tokens cannot be sold or transferred until the lock expires. This is commonly used by projects to build investor confidence.",
      },
      {
        title: "Accessing Token Lock",
        content:
          "From the Dashboard, select 'Token Lock' from the menu or click on a token and select 'Lock Token' option.",
      },
      {
        title: "Creating a Token Lock",
        content:
          "1. Select the token you want to lock\n2. Enter the number of tokens to lock\n3. Choose the lock duration (days)\n4. Review the lock details\n5. Click 'Create Lock' to execute",
      },
      {
        title: "Lock Duration Options",
        content:
          "Lock periods can range from 1 day to several years:\n• Short locks: 7-30 days for testing\n• Standard locks: 90-180 days\n• Long-term locks: 1-4 years\n• Custom duration: Set any duration you prefer",
      },
      {
        title: "Managing Locked Tokens",
        content:
          "View all token locks in the 'Token Locks' section:\n• See locked amount and duration\n• Monitor time remaining\n• View original lock date and unlock date\n• Cannot transfer or sell locked tokens\n• Can create new locks while others are active",
      },
      {
        title: "Token Unlock",
        content:
          "When the lock period expires:\n• Tokens automatically become transferable\n• No action needed - happens automatically\n• You can sell or transfer immediately\n• View unlock history in transaction records",
      },
      {
        title: "Important Notes",
        content:
          "• Locked tokens cannot be moved or transferred\n• Locks cannot be extended or modified\n• Locks cannot be cancelled early\n• Only the token holder can create locks\n• Lock information is stored on-chain (public)\n• Locks are permanent until expiration",
      },
    ],
  },
  {
    id: "wallet-history",
    title: "How to Check Wallet History",
    content:
      "View all your transactions, trades, and wallet activities. Keep track of all movements and changes to your account.",
    subsections: [
      {
        title: "Accessing Wallet History",
        content:
          "From the Dashboard, click 'Wallet History' or 'Transaction History' in the navigation menu to view all your activities.",
      },
      {
        title: "Transaction Types",
        content:
          "Your wallet history shows multiple transaction types:\n• Receives: Incoming transfers\n• Sends: Outgoing transfers\n• Swaps: Token exchanges\n• Stakes: Staking operations\n• Burns: Token burns\n• Locks: Token lock creations",
      },
      {
        title: "Transaction Details",
        content:
          "Each transaction shows:\n• Transaction type and description\n• Amount and tokens involved\n• Date and time\n• Transaction status (Pending, Confirmed, Failed)\n• Transaction hash/ID\n• Fee information (if applicable)\n• Wallet addresses (from/to)",
      },
      {
        title: "Filtering History",
        content:
          "Filter your history by:\n• Transaction type (Receives, Sends, Swaps, etc.)\n• Date range\n• Token\n• Status (All, Confirmed, Pending, Failed)\n• Search by amount or address",
      },
      {
        title: "Viewing Transaction Details",
        content:
          "Click on any transaction to see:\n• Complete transaction information\n• Full wallet addresses\n• Exact amounts and fees\n• Token prices at transaction time\n• Blockchain confirmation status\n• Explorer link to view on-chain",
      },
      {
        title: "Exporting History",
        content:
          "You can export your transaction history:\n• Download as CSV for accounting\n• Import into tax software\n• Print records for documentation\n• Share with accountants or auditors\n• Keep personal records for tax purposes",
      },
      {
        title: "History Tips",
        content:
          "• Keep records for tax reporting\n• Note the purpose of transactions\n• Monitor unusual activities\n• Verify large transaction amounts\n• Check fee structures\n• Review failed transactions\n• Use filters for quick lookups",
      },
    ],
  },
  {
    id: "external-connections",
    title: "How to Connect with External Apps/Websites",
    content:
      "Connect your Fixorium wallet to external dApps and websites. Interact with DeFi protocols, NFT marketplaces, and blockchain services.",
    subsections: [
      {
        title: "Understanding Wallet Connections",
        content:
          "Many blockchain applications require wallet connections to function. These connections allow dApps to:\n• Read your wallet balance and token holdings\n• Request transaction signatures (with your approval)\n• Display your portfolio\n• Enable trading and swaps on external platforms",
      },
      {
        title: "Connecting to dApps",
        content:
          "When visiting a dApp:\n1. Look for 'Connect Wallet' button\n2. Select 'Solana' as the blockchain\n3. Choose 'Fixorium' from wallet options (if available)\n4. Approve the connection request\n5. The dApp can now read your wallet info",
      },
      {
        title: "Approving Transactions",
        content:
          "When a dApp requests a transaction:\n1. Review the transaction details carefully\n2. Check what you're signing (swap details, contract interactions, etc.)\n3. Verify the amount and token\n4. Check the recipient address\n5. Click 'Sign' only if you agree\n6. Never sign if the details seem wrong",
      },
      {
        title: "Popular dApps",
        content:
          "Common applications you can connect to:\n• Jupiter: DEX for token swaps\n• Magic Eden: NFT marketplace\n• Raydium: Liquidity pools and swaps\n• Serum: Trading platform\n• Phantom/Solflare: Wallet bridges\n• Marinade: Liquid staking\n• And many more Solana ecosystem apps",
      },
      {
        title: "Managing Connections",
        content:
          "View and manage active connections:\n1. Go to Settings\n2. Find 'Connected Apps' section\n3. See all connected dApps\n4. Disconnect from apps you no longer use\n5. Review permissions granted\n6. Remove suspicious connections",
      },
      {
        title: "Security Best Practices",
        content:
          "• Only connect to trusted, verified websites\n• Check URL carefully (watch for typos/spoofing)\n• Never approve unlimited spending allowances\n• Disconnect from apps you don't use\n• Review what permissions you're granting\n• Use hardware wallets for large amounts\n• Be cautious of new or unverified dApps\n• Research projects before connecting",
      },
      {
        title: "Warning Signs",
        content:
          "Avoid connecting to:\n• Websites with suspicious URLs\n• Unverified or newly created projects\n• Requests for unlimited approvals\n• Apps asking for your private key\n• Sites claiming to 'double' your tokens\n• Offers that seem too good to be true\n• Unaudited smart contracts",
      },
    ],
  },
  {
    id: "security",
    title: "Security & Safety Guidelines",
    content:
      "Comprehensive security information to keep your wallet and funds safe. Understand best practices for cryptocurrency security.",
    subsections: [
      {
        title: "Wallet Security Fundamentals",
        content:
          "Essential security principles:\n• Your private key = full control of your funds\n• Never share your private key or recovery phrase\n• Private keys stored locally on your device\n• Fixorium never has access to your keys\n• Recovery phrase is the only way to restore your wallet\n• Losing your recovery phrase means losing access forever",
      },
      {
        title: "Password Security",
        content:
          "If using password protection:\n• Use a strong, unique password (16+ characters)\n• Include numbers, symbols, and mixed case\n• Avoid common words and personal information\n• Don't reuse passwords across services\n• Store passwords securely (password manager recommended)\n• Never share your password with anyone\n• Change passwords periodically",
      },
      {
        title: "Device Security",
        content:
          "Secure the device running Fixorium:\n• Use a trusted, updated device\n• Enable device lock with strong PIN/biometric\n• Keep operating system and apps updated\n• Run antivirus/malware protection\n• Use a VPN for public WiFi\n• Avoid using public computers\n• Enable two-factor authentication on related accounts\n• Use hardware wallets for large holdings",
      },
      {
        title: "Recovery Phrase Protection",
        content:
          "Protecting your recovery phrase:\n• Write it down on paper (never digitally)\n• Store in a secure physical location\n• Multiple copies in different safe locations\n• Never photograph or screenshot the phrase\n• Avoid sharing even with trusted people\n• Use a safe deposit box or home safe\n• Consider using metal recovery phrase plates\n• Memorize the phrase if possible",
      },
      {
        title: "Phishing & Scams",
        content:
          "Protect yourself from scams:\n• Verify website URLs before entering credentials\n• Be wary of unexpected messages/emails\n• Never click links in unsolicited messages\n• Scammers impersonate Fixorium and other projects\n• 'Limited time offers' are usually scams\n• Too-good-to-be-true returns are always scams\n• Report suspicious activity to authorities\n• Use official Fixorium channels only",
      },
      {
        title: "Transaction Security",
        content:
          "Before confirming any transaction:\n• Verify the recipient address carefully\n• Check the amount and token type\n• Review the transaction fee\n• Confirm the purpose of the transaction\n• Use small test amounts for new addresses\n• Never send to addresses you don't recognize\n• Double-check after confirming\n• Blockchain transactions are permanent",
      },
      {
        title: "Backup Strategy",
        content:
          "Create a comprehensive backup:\n• Multiple copies of recovery phrase\n• Stored in separate secure locations\n• Geographic redundancy recommended\n• Physical copies in fireproof safe\n• Consider metal seed phrase storage\n• Update backups if you change security measures\n• Test recovery process occasionally\n• Keep backups updated with new wallets",
      },
      {
        title: "What Never to Do",
        content:
          "Critical security DON'Ts:\n• ❌ Never share private key or recovery phrase\n• ❌ Never enter credentials on unknown websites\n• ❌ Never click suspicious links\n• ❌ Never use public WiFi for sensitive operations\n• ❌ Never store credentials digitally (unencrypted)\n• ❌ Never screenshot or photograph your keys\n• ❌ Never grant unlimited token approvals\n• ❌ Never ignore security warnings\n• ❌ Never trust unexpected offers/deals",
      },
      {
        title: "If You Think You're Compromised",
        content:
          "If you suspect a security breach:\n1. Do not panic\n2. Stop using the compromised device\n3. Access Fixorium from a trusted device\n4. Create a new wallet immediately\n5. Transfer funds to the new wallet\n6. Investigate how the breach occurred\n7. Update all passwords and security measures\n8. Enable extra security on all accounts\n9. Monitor the compromised wallet for activity",
      },
      {
        title: "Security Resources",
        content:
          "Additional security information:\n• Solana Official Documentation: solana.com\n• Security Best Practices: ledger.com/security\n• Blockchain Security: ethereum.org\n• Scam Prevention: antiphishing.org\n• Fixorium Support: Contact 24/7 helpline\n• Emergency Contact: Use Twitter or Telegram",
      },
    ],
  },
  {
    id: "disclaimers",
    title: "Terms, Disclaimers & Legal",
    content:
      "Important legal information, disclaimers, and terms of use. Please read carefully before using Fixorium.",
    subsections: [
      {
        title: "General Disclaimer",
        content:
          "Fixorium is provided 'as is' without warranties of any kind. The wallet is a non-custodial service - you maintain full control and responsibility for your assets. Fixorium is not responsible for:\n• Lost, stolen, or compromised funds\n• User errors in transactions\n• Market fluctuations or price changes\n• Third-party service failures\n• Smart contract vulnerabilities\n• Network issues or blockchain problems",
      },
      {
        title: "Risk Acknowledgment",
        content:
          "Using Fixorium and cryptocurrency involves significant risks:\n• Cryptocurrency prices are highly volatile\n• You can lose your entire investment\n• Blockchain transactions are irreversible\n• Smart contracts may contain bugs\n• Market liquidity can be unpredictable\n• Regulatory changes may affect usage\n• Hacking and theft risks exist\n• Technology is still evolving\n• No guarantees of returns or income",
      },
      {
        title: "Non-Custodial Nature",
        content:
          "Important points about wallet control:\n• Fixorium does NOT hold your private keys\n• Fixorium does NOT have access to your funds\n• You are solely responsible for your assets\n• Lost recovery phrases cannot be recovered\n• Fixorium cannot recover lost or stolen funds\n• Support cannot reset passwords or recovery phrases\n• You must manage your own security\n• Backup your recovery phrase immediately",
      },
      {
        title: "No Financial Advice",
        content:
          "Disclaimer regarding financial advice:\n• Fixorium provides no financial advice\n• Nothing in this wallet is investment advice\n• You must do your own research\n• Consult professionals before investing\n• Past performance doesn't guarantee future results\n• Information is provided for educational purposes only\n• Make your own investment decisions\n• No guarantee of returns or profits",
      },
      {
        title: "Regulatory Compliance",
        content:
          "Regulatory information:\n• Cryptocurrency regulations vary by jurisdiction\n• You are responsible for tax reporting\n• Consult local authorities about regulations\n• Some services may be restricted in your country\n• Fixorium complies with applicable laws\n• Use at your own legal risk\n• Report cryptocurrency taxes correctly\n• Verify local crypto regulations",
      },
      {
        title: "Service Availability",
        content:
          "Service terms and limitations:\n• Fixorium may experience downtime\n• Services may be unavailable occasionally\n• Features may change or be discontinued\n• No guarantees of 24/7 uptime\n• We maintain the service continuously\n• Critical bugs may require temporary closure\n• Updates may cause brief unavailability\n• Blockchain issues can affect service",
      },
      {
        title: "Intellectual Property",
        content:
          "Intellectual property and usage:\n• Fixorium interface design is proprietary\n• Smart contracts may be audited code\n• You may use the service for personal use only\n• Unauthorized copying is prohibited\n• Fixorium trademarks are protected\n• User content remains your property\n• We reserve the right to modify the service\n• Updates may affect functionality",
      },
      {
        title: "Limitation of Liability",
        content:
          "Liability limitations:\n• Fixorium is not liable for:\n  - Lost, stolen, or compromised funds\n  - User errors or mistakes\n  - Third-party actions or hacks\n  - Market losses or poor investments\n  - Service interruptions\n  - Data loss or corruption\n  - Indirect or consequential damages\n• Your sole remedy is discontinuing use\n• No liability for third-party services\n• Blockchain is immutable and permanent",
      },
      {
        title: "Third-Party Services",
        content:
          "Important about external integrations:\n• Fixorium may integrate with third parties\n• We're not responsible for third-party services\n• Third parties have their own terms\n• Third-party failures are their responsibility\n• Verify third-party security and legitimacy\n• Use at your own risk\n• Disconnect from unused services\n• Review third-party privacy policies",
      },
      {
        title: "Age Restriction",
        content:
          "Age and capacity requirements:\n• Must be 18+ to use Fixorium\n• Must have legal capacity to use services\n• Parental consent if required by law\n• Cannot use if prohibited in your jurisdiction\n• We assume you're of legal age\n• Misrepresenting age is prohibited",
      },
      {
        title: "Modifications to Terms",
        content:
          "Changes to this agreement:\n• Fixorium may modify terms at any time\n• Continued use means acceptance of changes\n• Check terms regularly for updates\n• Major changes will be announced\n• You can stop using if you disagree\n• Effective date will be posted\n• Your rights won't be reduced without notice",
      },
      {
        title: "Dispute Resolution",
        content:
          "Handling disputes and complaints:\n• Contact support for issues: 24/7 helpline\n• Describe your issue clearly\n• Provide relevant transaction details\n• Support will investigate\n• Blockchain transactions are final\n• Cannot reverse confirmed transactions\n• For serious issues, contact authorities\n• Escalate through proper channels",
      },
    ],
  },
];

export default function DocumentationPage({
  onBack,
}: {
  onBack: () => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["create-account"]),
  );

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground relative overflow-hidden pb-8">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />

      <div className="w-full relative z-20">
        <div>
          <div className="mt-6 mb-4 p-6 border-0 bg-transparent relative mx-0">
            <div className="flex items-center gap-3 -mt-4 -mx-6 px-6 pt-4 pb-2 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 p-0 rounded-[2px] bg-transparent hover:bg-white/10 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors flex-shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="font-medium text-sm text-gray-900">
                DOCUMENTATION & GUIDES
              </div>
            </div>

            <div className="space-y-3 md:space-y-4 px-4 sm:px-6">
              {/* Introduction Card */}
              <Card className="w-full bg-gradient-to-br from-[#a855f7]/10 to-[#22c55e]/10 rounded-lg border border-[#a855f7]/30">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-white">
                      Welcome to Fixorium Documentation
                    </h2>
                    <p className="text-sm text-gray-300">
                      Complete guides covering all features of your secure Solana
                      wallet. Learn how to create accounts, swap tokens, stake for
                      rewards, and keep your funds secure.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Documentation Sections */}
              {documentationSections.map((section) => (
                <Card
                  key={section.id}
                  className="w-full bg-transparent rounded-lg border border-gray-300/30 overflow-hidden"
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex-1 text-left">
                      <h3 className="text-base font-semibold text-white">
                        {section.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {section.content}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-500 flex-shrink-0 ml-4 transition-transform ${
                        expandedSections.has(section.id) ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {expandedSections.has(section.id) && section.subsections && (
                    <CardContent className="px-4 pb-4 border-t border-gray-300/20 bg-white/2">
                      <div className="space-y-4 pt-4">
                        {section.subsections.map((subsection, idx) => (
                          <div key={idx}>
                            <h4 className="text-sm font-semibold text-yellow-400 mb-2">
                              {subsection.title}
                            </h4>
                            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                              {subsection.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}

              {/* Support Section */}
              <Card className="w-full bg-gradient-to-br from-[#22c55e]/10 to-[#a855f7]/10 rounded-lg border border-[#22c55e]/30">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-white">
                      Need Additional Help?
                    </h3>
                    <p className="text-xs text-gray-300">
                      If you have questions not covered in this documentation,
                      contact our 24/7 support team through Twitter, Telegram, or
                      other official channels. Our team is ready to help!
                    </p>
                    <div className="pt-2 border-t border-gray-300/20">
                      <p className="text-xs font-semibold text-yellow-400">
                        Remember: Never share your private keys or recovery phrase
                        with anyone, including support staff.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
