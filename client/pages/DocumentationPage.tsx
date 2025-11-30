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
    title: "HOW TO BURN TOKENS",
    content:
      "PERMANENTLY REMOVE TOKENS FROM CIRCULATION BY SENDING THEM TO A NULL ADDRESS. THIS REDUCES TOTAL SUPPLY AND CAN INCREASE TOKEN VALUE.",
    subsections: [
      {
        title: "WHAT IS TOKEN BURNING?",
        content:
          "TOKEN BURNING IS THE PROCESS OF SENDING TOKENS TO A DEAD ADDRESS (NULL ADDRESS) WHERE THEY CANNOT BE RECOVERED. THIS PERMANENTLY REMOVES TOKENS FROM CIRCULATION AND REDUCES THE TOTAL SUPPLY.",
      },
      {
        title: "ACCESSING THE BURN FEATURE",
        content:
          "FROM THE DASHBOARD, CLICK ON A TOKEN AND SELECT 'BURN TOKEN' OR NAVIGATE TO THE BURN SECTION FROM THE MAIN MENU.",
      },
      {
        title: "SELECTING TOKENS TO BURN",
        content:
          "1. CHOOSE THE TOKEN YOU WANT TO BURN FROM YOUR WALLET\n2. ENTER THE QUANTITY TO BURN\n3. CLICK 'MAX' TO BURN YOUR ENTIRE BALANCE OF THAT TOKEN\n4. REVIEW THE AMOUNT BEFORE BURNING",
      },
      {
        title: "CONFIRMING THE BURN",
        content:
          "1. REVIEW THE BURN TRANSACTION DETAILS\n2. CONFIRM THAT YOU WANT TO PERMANENTLY REMOVE THESE TOKENS\n3. SIGN THE TRANSACTION WITH YOUR WALLET\n4. THE TOKENS WILL BE SENT TO THE NULL ADDRESS AND PERMANENTLY DESTROYED",
      },
      {
        title: "AFTER BURNING",
        content:
          "ONCE BURNED:\n• TOKENS ARE PERMANENTLY REMOVED FROM CIRCULATION\n• THIS ACTION CANNOT BE UNDONE\n• YOUR WALLET BALANCE FOR THAT TOKEN DECREASES\n• THE BURN TRANSACTION IS RECORDED ON THE BLOCKCHAIN\n• YOU CAN VIEW THE BURN IN YOUR TRANSACTION HISTORY",
      },
      {
        title: "IMPORTANT WARNINGS",
        content:
          "• TOKEN BURNING IS PERMANENT AND CANNOT BE REVERSED\n• DOUBLE-CHECK THE AMOUNT BEFORE CONFIRMING\n• ONLY BURN TOKENS YOU OWN AND CONTROL\n• VERIFY YOU HAVE THE CORRECT TOKEN SELECTED\n• PAY ATTENTION TO TOKEN DECIMALS\n• SOME TOKENS MAY NOT BE BURNABLE (CHECK TOKEN CONTRACT)",
      },
    ],
  },
  {
    id: "stake-tokens",
    title: "HOW TO STAKE TOKENS",
    content:
      "EARN REWARDS BY STAKING YOUR TOKENS FOR A FIXED PERIOD. LOCK YOUR TOKENS TO GENERATE PASSIVE INCOME THROUGH STAKING REWARDS.",
    subsections: [
      {
        title: "UNDERSTANDING STAKING",
        content:
          "STAKING ALLOWS YOU TO LOCK TOKENS FOR A SET PERIOD AND EARN REWARDS. THE LONGER YOU STAKE, THE MORE REWARDS YOU EARN. CURRENT APY IS 10% (VARIES BY TOKEN AND CONDITIONS).",
      },
      {
        title: "ACCESSING STAKING",
        content:
          "FROM THE DASHBOARD, SELECT A TOKEN AND CLICK 'STAKE' TO ACCESS THE STAKING INTERFACE. YOU CAN ALSO NAVIGATE TO 'STAKE TOKENS' FROM THE MAIN MENU.",
      },
      {
        title: "CHOOSING STAKE PERIOD",
        content:
          "SELECT YOUR LOCK PERIOD:\n• 30 DAYS: STANDARD STAKING PERIOD\n• 60 DAYS: EXTENDED PERIOD WITH HIGHER REWARDS\n• 90 DAYS: MAXIMUM PERIOD WITH MAXIMUM REWARDS\n\nREWARDS INCREASE PROPORTIONALLY WITH THE LOCK PERIOD.",
      },
      {
        title: "ENTERING STAKE AMOUNT",
        content:
          "1. ENTER THE AMOUNT OF TOKENS YOU WANT TO STAKE\n2. MINIMUM STAKE IS TYPICALLY 10 MILLION TOKENS\n3. CLICK 'MAX' TO STAKE YOUR ENTIRE AVAILABLE BALANCE\n4. THE EXPECTED REWARD WILL BE CALCULATED AUTOMATICALLY",
      },
      {
        title: "CONFIRMING YOUR STAKE",
        content:
          "1. REVIEW THE STAKE DETAILS:\n   • AMOUNT STAKED\n   • LOCK PERIOD\n   • EXPECTED REWARD\n   • TOTAL VALUE AT UNLOCK\n2. CLICK 'START STAKING' TO CREATE THE STAKE\n3. SIGN THE TRANSACTION WITH YOUR WALLET",
      },
      {
        title: "MANAGING ACTIVE STAKES",
        content:
          "VIEW ALL ACTIVE STAKES IN THE 'ACTIVE STAKES' SECTION:\n• MONITOR REMAINING LOCK TIME\n• SEE CURRENT REWARD AMOUNT\n• VIEW STAKE DETAILS\n• COUNTDOWN TIMER SHOWS WHEN STAKE UNLOCKS\n• 'WITHDRAWAL LOCKED' BUTTON DURING LOCK PERIOD\n• 'WITHDRAW' BUTTON BECOMES AVAILABLE WHEN TIME EXPIRES",
      },
      {
        title: "WITHDRAWING STAKES",
        content:
          "WHEN THE LOCK PERIOD EXPIRES:\n1. CLICK 'WITHDRAW' ON YOUR STAKE\n2. RECEIVE YOUR ORIGINAL TOKENS PLUS REWARDS\n3. SIGN THE WITHDRAWAL TRANSACTION\n4. TOKENS ARE RETURNED TO YOUR WALLET\n\nYOU CANNOT WITHDRAW UNTIL THE LOCK PERIOD IS COMPLETE.",
      },
      {
        title: "STAKING TIPS",
        content:
          "• STAKES CANNOT BE WITHDRAWN EARLY\n• REWARDS ARE CALCULATED DAILY\n• LOCK THE MAXIMUM PERIOD (90 DAYS) FOR BEST REWARDS\n• REWARD CALCULATION: (AMOUNT × 10% APY ÷ 365) × DAYS\n• STAKING IS NON-CUSTODIAL - YOU RETAIN CONTROL\n• MONITOR YOUR ACTIVE STAKES REGULARLY\n• PLAN YOUR LOCK PERIODS STRATEGICALLY",
      },
    ],
  },
  {
    id: "lock-tokens",
    title: "HOW TO LOCK TOKENS",
    content:
      "CREATE TOKEN LOCKS TO RESTRICT TOKEN TRANSFERS FOR A SPECIFIC DURATION. USEFUL FOR PROJECT SECURITY AND INVESTOR CONFIDENCE.",
    subsections: [
      {
        title: "WHAT IS TOKEN LOCKING?",
        content:
          "TOKEN LOCKING RESTRICTS THE MOVEMENT OF TOKENS FOR A SET PERIOD. LOCKED TOKENS CANNOT BE SOLD OR TRANSFERRED UNTIL THE LOCK EXPIRES. THIS IS COMMONLY USED BY PROJECTS TO BUILD INVESTOR CONFIDENCE.",
      },
      {
        title: "ACCESSING TOKEN LOCK",
        content:
          "FROM THE DASHBOARD, SELECT 'TOKEN LOCK' FROM THE MENU OR CLICK ON A TOKEN AND SELECT 'LOCK TOKEN' OPTION.",
      },
      {
        title: "CREATING A TOKEN LOCK",
        content:
          "1. SELECT THE TOKEN YOU WANT TO LOCK\n2. ENTER THE NUMBER OF TOKENS TO LOCK\n3. CHOOSE THE LOCK DURATION (DAYS)\n4. REVIEW THE LOCK DETAILS\n5. CLICK 'CREATE LOCK' TO EXECUTE",
      },
      {
        title: "LOCK DURATION OPTIONS",
        content:
          "LOCK PERIODS CAN RANGE FROM 1 DAY TO SEVERAL YEARS:\n• SHORT LOCKS: 7-30 DAYS FOR TESTING\n• STANDARD LOCKS: 90-180 DAYS\n• LONG-TERM LOCKS: 1-4 YEARS\n• CUSTOM DURATION: SET ANY DURATION YOU PREFER",
      },
      {
        title: "MANAGING LOCKED TOKENS",
        content:
          "VIEW ALL TOKEN LOCKS IN THE 'TOKEN LOCKS' SECTION:\n• SEE LOCKED AMOUNT AND DURATION\n• MONITOR TIME REMAINING\n• VIEW ORIGINAL LOCK DATE AND UNLOCK DATE\n• CANNOT TRANSFER OR SELL LOCKED TOKENS\n• CAN CREATE NEW LOCKS WHILE OTHERS ARE ACTIVE",
      },
      {
        title: "TOKEN UNLOCK",
        content:
          "WHEN THE LOCK PERIOD EXPIRES:\n• TOKENS AUTOMATICALLY BECOME TRANSFERABLE\n• NO ACTION NEEDED - HAPPENS AUTOMATICALLY\n• YOU CAN SELL OR TRANSFER IMMEDIATELY\n• VIEW UNLOCK HISTORY IN TRANSACTION RECORDS",
      },
      {
        title: "IMPORTANT NOTES",
        content:
          "• LOCKED TOKENS CANNOT BE MOVED OR TRANSFERRED\n• LOCKS CANNOT BE EXTENDED OR MODIFIED\n• LOCKS CANNOT BE CANCELLED EARLY\n• ONLY THE TOKEN HOLDER CAN CREATE LOCKS\n• LOCK INFORMATION IS STORED ON-CHAIN (PUBLIC)\n• LOCKS ARE PERMANENT UNTIL EXPIRATION",
      },
    ],
  },
  {
    id: "wallet-history",
    title: "HOW TO CHECK WALLET HISTORY",
    content:
      "VIEW ALL YOUR TRANSACTIONS, TRADES, AND WALLET ACTIVITIES. KEEP TRACK OF ALL MOVEMENTS AND CHANGES TO YOUR ACCOUNT.",
    subsections: [
      {
        title: "ACCESSING WALLET HISTORY",
        content:
          "FROM THE DASHBOARD, CLICK 'WALLET HISTORY' OR 'TRANSACTION HISTORY' IN THE NAVIGATION MENU TO VIEW ALL YOUR ACTIVITIES.",
      },
      {
        title: "TRANSACTION TYPES",
        content:
          "YOUR WALLET HISTORY SHOWS MULTIPLE TRANSACTION TYPES:\n• RECEIVES: INCOMING TRANSFERS\n• SENDS: OUTGOING TRANSFERS\n• SWAPS: TOKEN EXCHANGES\n• STAKES: STAKING OPERATIONS\n• BURNS: TOKEN BURNS\n• LOCKS: TOKEN LOCK CREATIONS",
      },
      {
        title: "TRANSACTION DETAILS",
        content:
          "EACH TRANSACTION SHOWS:\n• TRANSACTION TYPE AND DESCRIPTION\n• AMOUNT AND TOKENS INVOLVED\n• DATE AND TIME\n• TRANSACTION STATUS (PENDING, CONFIRMED, FAILED)\n• TRANSACTION HASH/ID\n• FEE INFORMATION (IF APPLICABLE)\n• WALLET ADDRESSES (FROM/TO)",
      },
      {
        title: "FILTERING HISTORY",
        content:
          "FILTER YOUR HISTORY BY:\n• TRANSACTION TYPE (RECEIVES, SENDS, SWAPS, ETC.)\n• DATE RANGE\n• TOKEN\n• STATUS (ALL, CONFIRMED, PENDING, FAILED)\n• SEARCH BY AMOUNT OR ADDRESS",
      },
      {
        title: "VIEWING TRANSACTION DETAILS",
        content:
          "CLICK ON ANY TRANSACTION TO SEE:\n• COMPLETE TRANSACTION INFORMATION\n• FULL WALLET ADDRESSES\n• EXACT AMOUNTS AND FEES\n• TOKEN PRICES AT TRANSACTION TIME\n• BLOCKCHAIN CONFIRMATION STATUS\n• EXPLORER LINK TO VIEW ON-CHAIN",
      },
      {
        title: "EXPORTING HISTORY",
        content:
          "YOU CAN EXPORT YOUR TRANSACTION HISTORY:\n• DOWNLOAD AS CSV FOR ACCOUNTING\n• IMPORT INTO TAX SOFTWARE\n• PRINT RECORDS FOR DOCUMENTATION\n• SHARE WITH ACCOUNTANTS OR AUDITORS\n• KEEP PERSONAL RECORDS FOR TAX PURPOSES",
      },
      {
        title: "HISTORY TIPS",
        content:
          "• KEEP RECORDS FOR TAX REPORTING\n• NOTE THE PURPOSE OF TRANSACTIONS\n• MONITOR UNUSUAL ACTIVITIES\n• VERIFY LARGE TRANSACTION AMOUNTS\n• CHECK FEE STRUCTURES\n• REVIEW FAILED TRANSACTIONS\n• USE FILTERS FOR QUICK LOOKUPS",
      },
    ],
  },
  {
    id: "external-connections",
    title: "HOW TO CONNECT WITH EXTERNAL APPS/WEBSITES",
    content:
      "CONNECT YOUR FIXORIUM WALLET TO EXTERNAL DAPPS AND WEBSITES. INTERACT WITH DEFI PROTOCOLS, NFT MARKETPLACES, AND BLOCKCHAIN SERVICES.",
    subsections: [
      {
        title: "UNDERSTANDING WALLET CONNECTIONS",
        content:
          "MANY BLOCKCHAIN APPLICATIONS REQUIRE WALLET CONNECTIONS TO FUNCTION. THESE CONNECTIONS ALLOW DAPPS TO:\n• READ YOUR WALLET BALANCE AND TOKEN HOLDINGS\n• REQUEST TRANSACTION SIGNATURES (WITH YOUR APPROVAL)\n• DISPLAY YOUR PORTFOLIO\n• ENABLE TRADING AND SWAPS ON EXTERNAL PLATFORMS",
      },
      {
        title: "CONNECTING TO DAPPS",
        content:
          "WHEN VISITING A DAPP:\n1. LOOK FOR 'CONNECT WALLET' BUTTON\n2. SELECT 'SOLANA' AS THE BLOCKCHAIN\n3. CHOOSE 'FIXORIUM' FROM WALLET OPTIONS (IF AVAILABLE)\n4. APPROVE THE CONNECTION REQUEST\n5. THE DAPP CAN NOW READ YOUR WALLET INFO",
      },
      {
        title: "APPROVING TRANSACTIONS",
        content:
          "WHEN A DAPP REQUESTS A TRANSACTION:\n1. REVIEW THE TRANSACTION DETAILS CAREFULLY\n2. CHECK WHAT YOU'RE SIGNING (SWAP DETAILS, CONTRACT INTERACTIONS, ETC.)\n3. VERIFY THE AMOUNT AND TOKEN\n4. CHECK THE RECIPIENT ADDRESS\n5. CLICK 'SIGN' ONLY IF YOU AGREE\n6. NEVER SIGN IF THE DETAILS SEEM WRONG",
      },
      {
        title: "POPULAR DAPPS",
        content:
          "COMMON APPLICATIONS YOU CAN CONNECT TO:\n• JUPITER: DEX FOR TOKEN SWAPS\n• MAGIC EDEN: NFT MARKETPLACE\n• RAYDIUM: LIQUIDITY POOLS AND SWAPS\n• SERUM: TRADING PLATFORM\n• PHANTOM/SOLFLARE: WALLET BRIDGES\n• MARINADE: LIQUID STAKING\n• AND MANY MORE SOLANA ECOSYSTEM APPS",
      },
      {
        title: "MANAGING CONNECTIONS",
        content:
          "VIEW AND MANAGE ACTIVE CONNECTIONS:\n1. GO TO SETTINGS\n2. FIND 'CONNECTED APPS' SECTION\n3. SEE ALL CONNECTED DAPPS\n4. DISCONNECT FROM APPS YOU NO LONGER USE\n5. REVIEW PERMISSIONS GRANTED\n6. REMOVE SUSPICIOUS CONNECTIONS",
      },
      {
        title: "SECURITY BEST PRACTICES",
        content:
          "• ONLY CONNECT TO TRUSTED, VERIFIED WEBSITES\n• CHECK URL CAREFULLY (WATCH FOR TYPOS/SPOOFING)\n• NEVER APPROVE UNLIMITED SPENDING ALLOWANCES\n• DISCONNECT FROM APPS YOU DON'T USE\n• REVIEW WHAT PERMISSIONS YOU'RE GRANTING\n• USE HARDWARE WALLETS FOR LARGE AMOUNTS\n• BE CAUTIOUS OF NEW OR UNVERIFIED DAPPS\n• RESEARCH PROJECTS BEFORE CONNECTING",
      },
      {
        title: "WARNING SIGNS",
        content:
          "AVOID CONNECTING TO:\n• WEBSITES WITH SUSPICIOUS URLS\n• UNVERIFIED OR NEWLY CREATED PROJECTS\n• REQUESTS FOR UNLIMITED APPROVALS\n• APPS ASKING FOR YOUR PRIVATE KEY\n• SITES CLAIMING TO 'DOUBLE' YOUR TOKENS\n• OFFERS THAT SEEM TOO GOOD TO BE TRUE\n• UNAUDITED SMART CONTRACTS",
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
        title: "WALLET SECURITY FUNDAMENTALS",
        content:
          "ESSENTIAL SECURITY PRINCIPLES:\n• YOUR PRIVATE KEY = FULL CONTROL OF YOUR FUNDS\n• NEVER SHARE YOUR PRIVATE KEY OR RECOVERY PHRASE\n• PRIVATE KEYS STORED LOCALLY ON YOUR DEVICE\n• FIXORIUM NEVER HAS ACCESS TO YOUR KEYS\n• RECOVERY PHRASE IS THE ONLY WAY TO RESTORE YOUR WALLET\n• LOSING YOUR RECOVERY PHRASE MEANS LOSING ACCESS FOREVER",
      },
      {
        title: "PASSWORD SECURITY",
        content:
          "IF USING PASSWORD PROTECTION:\n• USE A STRONG, UNIQUE PASSWORD (16+ CHARACTERS)\n• INCLUDE NUMBERS, SYMBOLS, AND MIXED CASE\n• AVOID COMMON WORDS AND PERSONAL INFORMATION\n• DON'T REUSE PASSWORDS ACROSS SERVICES\n• STORE PASSWORDS SECURELY (PASSWORD MANAGER RECOMMENDED)\n• NEVER SHARE YOUR PASSWORD WITH ANYONE\n• CHANGE PASSWORDS PERIODICALLY",
      },
      {
        title: "DEVICE SECURITY",
        content:
          "SECURE THE DEVICE RUNNING FIXORIUM:\n• USE A TRUSTED, UPDATED DEVICE\n• ENABLE DEVICE LOCK WITH STRONG PIN/BIOMETRIC\n• KEEP OPERATING SYSTEM AND APPS UPDATED\n• RUN ANTIVIRUS/MALWARE PROTECTION\n• USE A VPN FOR PUBLIC WIFI\n• AVOID USING PUBLIC COMPUTERS\n• ENABLE TWO-FACTOR AUTHENTICATION ON RELATED ACCOUNTS\n• USE HARDWARE WALLETS FOR LARGE HOLDINGS",
      },
      {
        title: "RECOVERY PHRASE PROTECTION",
        content:
          "PROTECTING YOUR RECOVERY PHRASE:\n• WRITE IT DOWN ON PAPER (NEVER DIGITALLY)\n• STORE IN A SECURE PHYSICAL LOCATION\n• MULTIPLE COPIES IN DIFFERENT SAFE LOCATIONS\n• NEVER PHOTOGRAPH OR SCREENSHOT THE PHRASE\n• AVOID SHARING EVEN WITH TRUSTED PEOPLE\n• USE A SAFE DEPOSIT BOX OR HOME SAFE\n• CONSIDER USING METAL RECOVERY PHRASE PLATES\n• MEMORIZE THE PHRASE IF POSSIBLE",
      },
      {
        title: "PHISHING & SCAMS",
        content:
          "PROTECT YOURSELF FROM SCAMS:\n• VERIFY WEBSITE URLS BEFORE ENTERING CREDENTIALS\n• BE WARY OF UNEXPECTED MESSAGES/EMAILS\n• NEVER CLICK LINKS IN UNSOLICITED MESSAGES\n• SCAMMERS IMPERSONATE FIXORIUM AND OTHER PROJECTS\n• 'LIMITED TIME OFFERS' ARE USUALLY SCAMS\n• TOO-GOOD-TO-BE-TRUE RETURNS ARE ALWAYS SCAMS\n• REPORT SUSPICIOUS ACTIVITY TO AUTHORITIES\n• USE OFFICIAL FIXORIUM CHANNELS ONLY",
      },
      {
        title: "TRANSACTION SECURITY",
        content:
          "BEFORE CONFIRMING ANY TRANSACTION:\n• VERIFY THE RECIPIENT ADDRESS CAREFULLY\n• CHECK THE AMOUNT AND TOKEN TYPE\n• REVIEW THE TRANSACTION FEE\n• CONFIRM THE PURPOSE OF THE TRANSACTION\n• USE SMALL TEST AMOUNTS FOR NEW ADDRESSES\n• NEVER SEND TO ADDRESSES YOU DON'T RECOGNIZE\n• DOUBLE-CHECK AFTER CONFIRMING\n• BLOCKCHAIN TRANSACTIONS ARE PERMANENT",
      },
      {
        title: "BACKUP STRATEGY",
        content:
          "CREATE A COMPREHENSIVE BACKUP:\n• MULTIPLE COPIES OF RECOVERY PHRASE\n• STORED IN SEPARATE SECURE LOCATIONS\n• GEOGRAPHIC REDUNDANCY RECOMMENDED\n• PHYSICAL COPIES IN FIREPROOF SAFE\n• CONSIDER METAL SEED PHRASE STORAGE\n• UPDATE BACKUPS IF YOU CHANGE SECURITY MEASURES\n• TEST RECOVERY PROCESS OCCASIONALLY\n• KEEP BACKUPS UPDATED WITH NEW WALLETS",
      },
      {
        title: "WHAT NEVER TO DO",
        content:
          "CRITICAL SECURITY DON'TS:\n• ❌ NEVER SHARE PRIVATE KEY OR RECOVERY PHRASE\n• ❌ NEVER ENTER CREDENTIALS ON UNKNOWN WEBSITES\n• ❌ NEVER CLICK SUSPICIOUS LINKS\n• ❌ NEVER USE PUBLIC WIFI FOR SENSITIVE OPERATIONS\n• ❌ NEVER STORE CREDENTIALS DIGITALLY (UNENCRYPTED)\n• ❌ NEVER SCREENSHOT OR PHOTOGRAPH YOUR KEYS\n• ❌ NEVER GRANT UNLIMITED TOKEN APPROVALS\n• ❌ NEVER IGNORE SECURITY WARNINGS\n• ❌ NEVER TRUST UNEXPECTED OFFERS/DEALS",
      },
      {
        title: "IF YOU THINK YOU'RE COMPROMISED",
        content:
          "IF YOU SUSPECT A SECURITY BREACH:\n1. DO NOT PANIC\n2. STOP USING THE COMPROMISED DEVICE\n3. ACCESS FIXORIUM FROM A TRUSTED DEVICE\n4. CREATE A NEW WALLET IMMEDIATELY\n5. TRANSFER FUNDS TO THE NEW WALLET\n6. INVESTIGATE HOW THE BREACH OCCURRED\n7. UPDATE ALL PASSWORDS AND SECURITY MEASURES\n8. ENABLE EXTRA SECURITY ON ALL ACCOUNTS\n9. MONITOR THE COMPROMISED WALLET FOR ACTIVITY",
      },
      {
        title: "SECURITY RESOURCES",
        content:
          "ADDITIONAL SECURITY INFORMATION:\n• SOLANA OFFICIAL DOCUMENTATION: SOLANA.COM\n• SECURITY BEST PRACTICES: LEDGER.COM/SECURITY\n• BLOCKCHAIN SECURITY: ETHEREUM.ORG\n• SCAM PREVENTION: ANTIPHISHING.ORG\n• FIXORIUM SUPPORT: CONTACT 24/7 HELPLINE\n• EMERGENCY CONTACT: USE TWITTER OR TELEGRAM",
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
