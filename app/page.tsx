"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

// ============================================================================
// 1. MST NETWORK & CONTRACT CONFIGURATION
// ============================================================================
const DEFAULT_TESTNET_CONTRACT = "0x7469FaD978c171B7da28CaAB2B8eF3D171Ae4f74";
// Remains empty until you deploy to Mainnet so Testnet & Mainnet stay strictly separated
const DEFAULT_MAINNET_CONTRACT = "";

const getCleanAddress = (envVal: string | undefined, fallback: string) => {
  const trimmed = (envVal || "").trim();
  return ethers.isAddress(trimmed) ? trimmed : fallback;
};

const MST_NETWORKS = {
  testnet: {
    chainIdDecimal: 91562037,
    chainIdHex: "0x5752195",
    chainName: "MST Testnet",
    nativeCurrency: { name: "MST Testnet Coin", symbol: "tMSTC", decimals: 18 },
    rpcUrls: ["https://testnetrpc.mstblockchain.com"],
    blockExplorerUrls: ["https://testnet.mstscan.com"],
    contractAddress: getCleanAddress(
      process.env.NEXT_PUBLIC_TESTNET_CONTRACT_ADDRESS,
      DEFAULT_TESTNET_CONTRACT
    ),
  },
  mainnet: {
    chainIdDecimal: 4646,
    chainIdHex: "0x1226",
    chainName: "MST Mainnet",
    nativeCurrency: { name: "MST Coin", symbol: "MSTC", decimals: 18 },
    rpcUrls: ["https://mariorpc.mstblockchain.com/"],
    blockExplorerUrls: ["https://mstscan.com"],
    contractAddress: getCleanAddress(
      process.env.NEXT_PUBLIC_MAINNET_CONTRACT_ADDRESS,
      DEFAULT_MAINNET_CONTRACT
    ),
  },
};

const MST_TRADE_PROTOCOL_ABI = [
  "function nextLcId() view returns (uint256)",
  "function arbiter() view returns (address)",
  "function createLetterOfCredit(address payable _exporter, address _carrier, string memory _invoiceCode) external payable returns (uint256)",
  "function createLetterOfCredit(address payable _exporter, address _carrier) external payable returns (uint256)",
  "function confirmShipmentByCarrier(uint256 _lcId, string memory _eBoLHash) external",
  "function listInvoiceForFactoring(uint256 _lcId, uint256 _discountedPrice) external",
  "function buyFactoredInvoice(uint256 _lcId) external payable",
  "function confirmDeliveryAndSettle(uint256 _lcId) external",
  "function raiseDispute(uint256 _lcId, string memory _reason) external",
  "function resolveDispute(uint256 _lcId, bool _releaseToBeneficiary) external",
  "function getAllLettersOfCredit() external view returns (tuple(uint256 lcId, address buyer, address exporter, address carrier, address beneficiary, string invoiceCode, uint256 totalAmount, uint256 advancePaid, uint256 lockedEscrow, uint256 factoringPrice, bool isListedForFactoring, string eBoLHash, uint8 state, uint256 createdAt)[])",
  "event LOCOpened(uint256 indexed lcId, address indexed buyer, address indexed exporter, string invoiceCode, uint256 totalAmount, uint256 advancePaid)",
  "event ShipmentAttestedOnChain(uint256 indexed lcId, address indexed carrier, string eBoLHash)",
  "event InvoiceListedForFactoring(uint256 indexed lcId, uint256 lockedEscrow, uint256 buyoutPrice)",
  "event InvoiceFactoredOnChain(uint256 indexed lcId, address indexed exporter, address indexed liquidityProvider, uint256 buyoutPaid)",
  "event DeliveryConfirmedAndSettled(uint256 indexed lcId, address indexed finalBeneficiary, uint256 payoutAmount)",
  "event DisputeRaised(uint256 indexed lcId, address indexed raisedBy, string reason)",
  "event DisputeResolved(uint256 indexed lcId, address indexed winner, uint256 amount)",
];

const INITIAL_TESTNET_TXS = [
  {
    timestamp: "Block Verified",
    action: "Issued active Letter of Credit #2",
    hash: "0x74373cc71f88ea2496d1221a090231f76b979f5531848186d4c3a3ab241ee9d4",
  },
  {
    timestamp: "Block Verified",
    action: "Settled escrow vault on delivery",
    hash: "0x62d8b334acf31663d9f5f1e3a0f77e2791d062e44ca1d64e53f202650c6479c2",
  },
  {
    timestamp: "Block Verified",
    action: "Financed receivable claim on exchange",
    hash: "0x53d5dff4bdaa6d7444364359cf1322a460b28938b7fadc738e89edf7e2daa7c8",
  },
  {
    timestamp: "Block Verified",
    action: "Exporter listed 70% receivable for factoring",
    hash: "0x24d413857f1388d00870e18adb4a26404d370cfd3a6f49a683343cbbffd22a57",
  },
  {
    timestamp: "Block Verified",
    action: "Carrier anchored e-BoL digest",
    hash: "0x08c6d3aff2c3f39fc5e5daccd0a0190f73fa3fd9477e19c277a76b1ff5367312",
  },
  {
    timestamp: "Block Verified",
    action: "Issued Letter of Credit #1 & disbursed 30% advance",
    hash: "0x9591dd00318091a94698ac635641560bd65371069eecc90ceb60ff8107821b80",
  },
  {
    timestamp: "Contract Genesis",
    action: "Protocol smart contract deployed on MST Testnet",
    hash: "0x1b2b6262f8c39857dc80c54d09c4b963df7c224eaf9ff17764298b5da9c83965",
  },
];

type NetworkMode = "testnet" | "mainnet";
type NavSection = "ledger" | "issue" | "factoring" | "explorer";

interface LOCRecord {
  lcId: number;
  buyer: string;
  exporter: string;
  carrier: string;
  beneficiary: string;
  invoiceCode: string;
  totalAmount: string;
  advancePaid: string;
  lockedEscrow: string;
  factoringPrice: string;
  isListedForFactoring: boolean;
  eBoLHash: string;
  state: number;
  createdAt: number;
}

const STATUS_META: Record<
  number,
  { label: string; dot: string; badge: string; step: number }
> = {
  0: {
    label: "Awaiting dispatch",
    dot: "bg-amber-600",
    badge: "bg-[#FBF3E4] text-[#9A5B13] border-[#F0DEC0]",
    step: 1,
  },
  1: {
    label: "Shipped",
    dot: "bg-blue-600",
    badge: "bg-blue-50 text-blue-800 border-blue-200",
    step: 2,
  },
  2: {
    label: "Financed",
    dot: "bg-indigo-600",
    badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
    step: 3,
  },
  3: {
    label: "Settled",
    dot: "bg-[#16794F]",
    badge: "bg-[#E6F4ED] text-[#16794F] border-[#C5E6D5]",
    step: 4,
  },
  4: {
    label: "Dispute hold",
    dot: "bg-red-600",
    badge: "bg-red-50 text-red-800 border-red-200",
    step: 2,
  },
  5: {
    label: "Resolved",
    dot: "bg-[#16794F]",
    badge: "bg-[#E6F4ED] text-[#16794F] border-[#C5E6D5]",
    step: 4,
  },
};

// ============================================================================
// 2. WALLET & RPC CONNECTION UTILITIES
// ============================================================================
let eip6963BridgeKeyProvider: any = null;
let eip6963AnyProvider: any = null;

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (event: any) => {
    const info = event?.detail?.info;
    const provider = event?.detail?.provider;
    if (provider && !eip6963AnyProvider) {
      eip6963AnyProvider = provider;
    }
    if (
      info?.name?.toLowerCase().includes("bridge") ||
      info?.rdns?.toLowerCase().includes("bridge") ||
      info?.name?.toLowerCase().includes("mst")
    ) {
      eip6963BridgeKeyProvider = provider;
    }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function getInjectedProvider() {
  if (typeof window === "undefined") return null;
  const w = window as any;

  // 1. Prefer BridgeKey-specific globals or EIP-6963 BridgeKey provider
  if (eip6963BridgeKeyProvider) return eip6963BridgeKeyProvider;
  if (w.bridgekey?.ethereum) return w.bridgekey.ethereum;
  if (w.bridgekey?.request) return w.bridgekey;
  if (w.mst?.ethereum) return w.mst.ethereum;

  // 2. Check providers array if multiple extensions are active
  if (Array.isArray(w.ethereum?.providers) && w.ethereum.providers.length > 0) {
    const bk = w.ethereum.providers.find(
      (p: any) => p.isBridgeKey || p.isBridgekey || p.isMST
    );
    if (bk) return bk;
    return w.ethereum.providers[0];
  }

  // 3. Standard window.ethereum or any EIP-6963 wallet
  if (w.ethereum) return w.ethereum;
  if (eip6963AnyProvider) return eip6963AnyProvider;

  return null;
}

async function ensureMSTNetwork(mode: NetworkMode, providerInstance?: any) {
  const provider = providerInstance || getInjectedProvider();
  if (!provider) {
    throw new Error(
      "No Web3 wallet detected in browser. Make sure BridgeKey (or MetaMask) extension is enabled and refresh the page (F5)."
    );
  }
  const target = MST_NETWORKS[mode];
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: target.chainIdHex }],
    });
  } catch (err: any) {
    // 4902 or unrecognized chain error -> Add the MST network automatically
    if (
      err.code === 4902 ||
      err?.data?.originalError?.code === 4902 ||
      String(err?.message || "").toLowerCase().includes("unrecognized") ||
      String(err?.message || "").toLowerCase().includes("add")
    ) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: target.chainIdHex,
            chainName: target.chainName,
            nativeCurrency: target.nativeCurrency,
            rpcUrls: target.rpcUrls,
            blockExplorerUrls: target.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

async function connectWallet(mode: NetworkMode) {
  const rawProvider = getInjectedProvider();
  if (!rawProvider) {
    throw new Error(
      "Wallet extension not detected! Please enable BridgeKey Wallet in chrome://extensions and refresh this tab (F5)."
    );
  }

  // 1. Request account authorization FIRST so the wallet popup always opens immediately
  const accounts = await rawProvider.request({
    method: "eth_requestAccounts",
  });
  if (!accounts || accounts.length === 0) {
    throw new Error("No wallet accounts returned.");
  }

  // 2. Then switch/add MST Testnet or Mainnet
  try {
    await ensureMSTNetwork(mode, rawProvider);
  } catch (switchErr) {
    console.warn("Network switch note:", switchErr);
  }

  const browserProvider = new ethers.BrowserProvider(rawProvider);
  const signer = await browserProvider.getSigner();
  let bal = BigInt(0);
  try {
    bal = await browserProvider.getBalance(accounts[0]);
  } catch {
    const directRpc = new ethers.JsonRpcProvider(MST_NETWORKS[mode].rpcUrls[0]);
    bal = await directRpc.getBalance(accounts[0]);
  }

  return {
    address: accounts[0],
    balance: ethers.formatEther(bal),
    signer,
  };
}

// ============================================================================
// 3. FIGMA UI — MST TREASURY WORKSPACE
// ============================================================================
export default function TradeFinanceTerminal() {
  const [networkMode, setNetworkMode] = useState<NetworkMode>("testnet");
  const [activeNav, setActiveNav] = useState<NavSection>("ledger");
  const [account, setAccount] = useState<string>("");
  const [balance, setBalance] = useState<string>("0.0000");

  const [records, setRecords] = useState<LOCRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bannerMsg, setBannerMsg] = useState<{
    type: "info" | "success" | "error";
    text: string;
  } | null>(null);

  const [txHistory, setTxHistory] = useState<
    { timestamp: string; action: string; hash: string }[]
  >(INITIAL_TESTNET_TXS);

  // Issuance Form State
  const [exporterInput, setExporterInput] = useState<string>("");
  const [carrierInput, setCarrierInput] = useState<string>("");
  const [referenceInput, setReferenceInput] = useState<string>("LC-2026-9108");
  const [amountInput, setAmountInput] = useState<string>("0.50");

  // Inspector Drawer Inputs & AI Oracle State
  const [bolInput, setBolInput] = useState<string>("");
  const [bolFileName, setBolFileName] = useState<string>("");
  const [aiReport, setAiReport] = useState<any>(null);
  const [discountInput, setDiscountInput] = useState<string>("");
  const [disputeReason, setDisputeReason] = useState<string>("");

  const net = MST_NETWORKS[networkMode];
  const symbol = net.nativeCurrency.symbol;
  const explorer = net.blockExplorerUrls[0];

  useEffect(() => {
    document.title =
      "MST Treasury | Programmable Letters of Credit & RWA Factoring";
  }, []);

  const syncLedger = useCallback(async () => {
    setIsSyncing(true);
    try {
      // If Mainnet has no contract address configured yet, clear both Instruments AND Audit Log
      if (!net.contractAddress || !ethers.isAddress(net.contractAddress)) {
        setRecords([]);
        setTxHistory([]);
        setSelectedId(null);
        setIsSyncing(false);
        return;
      }

      const rpc = new ethers.JsonRpcProvider(net.rpcUrls[0]);
      const code = await rpc.getCode(net.contractAddress);
      if (!code || code === "0x") {
        setRecords([]);
        setTxHistory([]);
        setSelectedId(null);
        setIsSyncing(false);
        return;
      }

      const contract = new ethers.Contract(
        net.contractAddress,
        MST_TRADE_PROTOCOL_ABI,
        rpc
      );

      let loaded: LOCRecord[] = [];
      try {
        const rawList = await contract.getAllLettersOfCredit();
        loaded = rawList.map((item: any) => ({
          lcId: Number(item.lcId),
          buyer: item.buyer,
          exporter: item.exporter,
          carrier: item.carrier,
          beneficiary: item.beneficiary,
          invoiceCode: item.invoiceCode || `LC-${Number(item.lcId)}`,
          totalAmount: Number(ethers.formatEther(item.totalAmount)).toFixed(4),
          advancePaid: Number(ethers.formatEther(item.advancePaid)).toFixed(4),
          lockedEscrow: Number(ethers.formatEther(item.lockedEscrow)).toFixed(4),
          factoringPrice: Number(
            ethers.formatEther(item.factoringPrice)
          ).toFixed(4),
          isListedForFactoring: Boolean(item.isListedForFactoring),
          eBoLHash: item.eBoLHash,
          state: Number(item.state),
          createdAt: Number(item.createdAt),
        }));
      } catch {
        const nextIdBig = await contract.nextLcId();
        const total = Number(nextIdBig) - 1;
        const legacyAbi = [
          "function lettersOfCredit(uint256) view returns (uint256 lcId, address buyer, address exporter, address carrier, address beneficiary, uint256 totalAmount, uint256 lockedEscrow, uint256 factoringPrice, bool isListedForFactoring, string eBoLHash, uint8 state, uint256 createdAt)",
        ];
        const legacyContract = new ethers.Contract(
          net.contractAddress,
          legacyAbi,
          rpc
        );
        for (let i = 1; i <= total; i++) {
          const item = await legacyContract.lettersOfCredit(i);
          const tot = Number(ethers.formatEther(item.totalAmount));
          const lck = Number(ethers.formatEther(item.lockedEscrow));
          loaded.push({
            lcId: Number(item.lcId),
            buyer: item.buyer,
            exporter: item.exporter,
            carrier: item.carrier,
            beneficiary: item.beneficiary,
            invoiceCode: `LC-2026-00${i}`,
            totalAmount: tot.toFixed(4),
            advancePaid: (tot * 0.3).toFixed(4),
            lockedEscrow: lck.toFixed(4),
            factoringPrice: Number(
              ethers.formatEther(item.factoringPrice)
            ).toFixed(4),
            isListedForFactoring: Boolean(item.isListedForFactoring),
            eBoLHash: item.eBoLHash,
            state: Number(item.state),
            createdAt: Number(item.createdAt),
          });
        }
      }

      const sorted = loaded.reverse();
      setRecords(sorted);
      if (sorted.length > 0 && selectedId === null) {
        setSelectedId(sorted[0].lcId);
      }

      const baselineForMode =
        networkMode === "testnet" ? INITIAL_TESTNET_TXS : [];

      try {
        const currentBlock = await rpc.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 9000);
        const events = await contract.queryFilter("*", fromBlock, currentBlock);

        const discoveredTxs = events
          .map((ev: any) => {
            const name = ev.fragment?.name || "ContractExecution";
            const idArg = ev.args?.[0] ? `#${Number(ev.args[0])}` : "";
            const labelMap: Record<string, string> = {
              LOCOpened: `Issued active Letter of Credit ${idArg}`,
              ShipmentAttestedOnChain: `Carrier anchored e-BoL digest (${idArg})`,
              InvoiceListedForFactoring: `Exporter listed receivable for factoring (${idArg})`,
              InvoiceFactoredOnChain: `Financed receivable claim on exchange (${idArg})`,
              DeliveryConfirmedAndSettled: `Settled escrow vault on delivery (${idArg})`,
              DisputeRaised: `Placed arbitration hold (${idArg})`,
              DisputeResolved: `Arbitration resolved on-chain (${idArg})`,
            };
            return {
              timestamp: "Block Verified",
              action: labelMap[name] || `Executed ${name} (${idArg})`,
              hash: ev.transactionHash,
            };
          })
          .reverse();

        const combined = [...discoveredTxs, ...baselineForMode];
        const uniqueMap = new Map();
        for (const item of combined) {
          if (item.hash && !uniqueMap.has(item.hash.toLowerCase())) {
            uniqueMap.set(item.hash.toLowerCase(), item);
          }
        }
        setTxHistory(Array.from(uniqueMap.values()));
      } catch {
        setTxHistory(baselineForMode);
      }
    } catch (err) {
      console.error("Ledger sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [net.contractAddress, net.rpcUrls, networkMode, selectedId]);

  useEffect(() => {
    syncLedger();
  }, [syncLedger]);

  const handleWalletConnect = async (targetMode: NetworkMode = networkMode) => {
    try {
      setBannerMsg({
        type: "info",
        text: `Opening wallet extension for ${MST_NETWORKS[targetMode].chainName}...`,
      });
      const res = await connectWallet(targetMode);
      setAccount(res.address);
      setBalance(Number(res.balance).toFixed(4));
      if (!exporterInput) setExporterInput(res.address);
      if (!carrierInput) setCarrierInput(res.address);
      setBannerMsg({
        type: "success",
        text: `Connected wallet ${res.address.slice(0, 6)}...${res.address.slice(
          -4
        )} on ${MST_NETWORKS[targetMode].chainName}.`,
      });
    } catch (err: any) {
      setBannerMsg({
        type: "error",
        text: err.message || "Could not connect wallet.",
      });
    }
  };

  const logTransaction = (action: string, hash: string) => {
    setTxHistory((prev) => {
      const filtered = prev.filter(
        (item) => item.hash.toLowerCase() !== hash.toLowerCase()
      );
      return [{ timestamp: "Block Verified", action, hash }, ...filtered];
    });
  };

  const selectedRecord =
    records.find((r) => r.lcId === selectedId) || records[0] || null;

  // Issue New Letter of Credit
  const handleIssueLC = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setBannerMsg({
        type: "info",
        text: "Awaiting signature in wallet to issue Letter of Credit...",
      });
      const { signer } = await connectWallet(networkMode);
      const contract = new ethers.Contract(
        net.contractAddress,
        MST_TRADE_PROTOCOL_ABI,
        signer
      );

      let tx;
      try {
        tx = await contract["createLetterOfCredit(address,address,string)"](
          exporterInput.trim(),
          carrierInput.trim(),
          referenceInput.trim(),
          { value: ethers.parseEther(amountInput) }
        );
      } catch {
        tx = await contract["createLetterOfCredit(address,address)"](
          exporterInput.trim(),
          carrierInput.trim(),
          { value: ethers.parseEther(amountInput) }
        );
      }

      setBannerMsg({
        type: "info",
        text: `Broadcasting issuance transaction ${tx.hash.slice(0, 12)}...`,
      });
      await tx.wait();

      logTransaction(
        `Issued active Letter of Credit (${referenceInput})`,
        tx.hash
      );
      setBannerMsg({
        type: "success",
        text: `Letter of Credit ${referenceInput} issued. 30% advance disbursed to Exporter; 70% locked in escrow vault.`,
      });
      await handleWalletConnect(networkMode);
      await syncLedger();
      setActiveNav("ledger");
    } catch (err: any) {
      setBannerMsg({
        type: "error",
        text: err.reason || err.message || "Transaction rejected.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload Document -> Calls /api/verify-bol AI Oracle + SHA-256 Digest
  const handleDocumentUpload = async (file: File | undefined) => {
    if (!file || !selectedRecord) return;
    setBolFileName(`Inspecting ${file.name}...`);
    setAiReport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("invoiceCode", selectedRecord.invoiceCode);
      const res = await fetch("/api/verify-bol", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setBolFileName(
          `${file.name} (${data.aiReport.complianceScore} Verified)`
        );
        setBolInput(data.onChainAttestationString);
        setAiReport(data.aiReport);
        return;
      }
    } catch {
      // Fallback to browser Web Crypto SHA-256
    }
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setBolFileName(file.name);
    setBolInput(`0x${hex}`);
  };

  // Carrier Attests Electronic Bill of Lading
  const handleAttestShipment = async (lcId: number) => {
    const hashValue =
      bolInput.trim() || ethers.id(`BOL-DOC-${lcId}-${Date.now()}`);
    try {
      setIsSubmitting(true);
      setBannerMsg({
        type: "info",
        text: `Attesting Electronic Bill of Lading for Instrument #${lcId}...`,
      });
      const { signer } = await connectWallet(networkMode);
      const contract = new ethers.Contract(
        net.contractAddress,
        MST_TRADE_PROTOCOL_ABI,
        signer
      );
      const tx = await contract.confirmShipmentByCarrier(lcId, hashValue);
      await tx.wait();

      logTransaction(`Carrier anchored e-BoL digest`, tx.hash);
      setBannerMsg({
        type: "success",
        text: `Bill of Lading checksum recorded on MST Blockchain for LC #${lcId}.`,
      });
      setBolInput("");
      setBolFileName("");
      setAiReport(null);
      await syncLedger();
    } catch (err: any) {
      setBannerMsg({
        type: "error",
        text: err.reason || err.message || "Failed to attest shipment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Exporter Lists Receivable for Factoring
  const handleListReceivable = async (lcId: number, askAmount: string) => {
    try {
      setIsSubmitting(true);
      setBannerMsg({
        type: "info",
        text: `Listing locked receivable #${lcId} for factoring at ${askAmount} ${symbol}...`,
      });
      const { signer } = await connectWallet(networkMode);
      const contract = new ethers.Contract(
        net.contractAddress,
        MST_TRADE_PROTOCOL_ABI,
        signer
      );
      const tx = await contract.listInvoiceForFactoring(
        lcId,
        ethers.parseEther(askAmount)
      );
      await tx.wait();

      logTransaction(`Listed receivable #${lcId} on exchange`, tx.hash);
      setBannerMsg({
        type: "success",
        text: `Receivable #${lcId} listed for early liquidity at ${askAmount} ${symbol}.`,
      });
      await syncLedger();
    } catch (err: any) {
      setBannerMsg({
        type: "error",
        text: err.reason || err.message || "Listing failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Financier Purchases Receivable
  const handlePurchaseReceivable = async (lcId: number, price: string) => {
    try {
      setIsSubmitting(true);
      setBannerMsg({
        type: "info",
        text: `Purchasing receivable #${lcId} for ${price} ${symbol}...`,
      });
      const { signer } = await connectWallet(networkMode);
      const contract = new ethers.Contract(
        net.contractAddress,
        MST_TRADE_PROTOCOL_ABI,
        signer
      );
      const tx = await contract.buyFactoredInvoice(lcId, {
        value: ethers.parseEther(price),
      });
      await tx.wait();

      logTransaction(`Financed receivable #${lcId} (${price} ${symbol})`, tx.hash);
      setBannerMsg({
        type: "success",
        text: `Receivable #${lcId} acquired. Exporter funded immediately; beneficiary rights assigned to your wallet.`,
      });
      await handleWalletConnect(networkMode);
      await syncLedger();
    } catch (err: any) {
      setBannerMsg({
        type: "error",
        text: err.reason || err.message || "Purchase failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delivery & Settle Escrow Vault
  const handleSettleDelivery = async (lcId: number) => {
    try {
      setIsSubmitting(true);
      setBannerMsg({
        type: "info",
        text: `Releasing 70% escrow vault for Instrument #${lcId}...`,
      });
      const { signer } = await connectWallet(networkMode);
      const contract = new ethers.Contract(
        net.contractAddress,
        MST_TRADE_PROTOCOL_ABI,
        signer
      );
      const tx = await contract.confirmDeliveryAndSettle(lcId);
      await tx.wait();

      logTransaction(`Settled escrow vault on delivery`, tx.hash);
      setBannerMsg({
        type: "success",
        text: `Delivery confirmed. Remaining 70% escrow balance settled to beneficiary.`,
      });
      await handleWalletConnect(networkMode);
      await syncLedger();
    } catch (err: any) {
      setBannerMsg({
        type: "error",
        text: err.reason || err.message || "Settlement failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Place Arbitration Hold
  const handleDisputeHold = async (lcId: number) => {
    const reason =
      disputeReason.trim() ||
      "Discrepancy in commercial invoice / port inspection";
    try {
      setIsSubmitting(true);
      const { signer } = await connectWallet(networkMode);
      const contract = new ethers.Contract(
        net.contractAddress,
        MST_TRADE_PROTOCOL_ABI,
        signer
      );
      const tx = await contract.raiseDispute(lcId, reason);
      await tx.wait();

      logTransaction(`Placed arbitration hold (LC #${lcId})`, tx.hash);
      setBannerMsg({
        type: "info",
        text: `Instrument #${lcId} placed under arbitration freeze.`,
      });
      setDisputeReason("");
      await syncLedger();
    } catch (err: any) {
      setBannerMsg({
        type: "error",
        text: err.reason || err.message || "Failed to place hold.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Arbiter Resolves Dispute On-Chain
  const handleResolveDispute = async (
    lcId: number,
    releaseToBeneficiary: boolean
  ) => {
    try {
      setIsSubmitting(true);
      setBannerMsg({
        type: "info",
        text: `Executing on-chain arbitration settlement for Instrument #${lcId}...`,
      });
      const { signer } = await connectWallet(networkMode);
      const contract = new ethers.Contract(
        net.contractAddress,
        MST_TRADE_PROTOCOL_ABI,
        signer
      );
      const tx = await contract.resolveDispute(lcId, releaseToBeneficiary);
      await tx.wait();

      logTransaction(`Arbitration resolved (LC #${lcId})`, tx.hash);
      setBannerMsg({
        type: "success",
        text: `Arbitration resolved on-chain for Instrument #${lcId}.`,
      });
      await handleWalletConnect(networkMode);
      await syncLedger();
    } catch (err: any) {
      setBannerMsg({
        type: "error",
        text: err.reason || err.message || "Arbitration resolution failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Portfolio Metrics
  const totalVolume = records.reduce(
    (acc, r) => acc + Number(r.totalAmount || 0),
    0
  );
  const activeVaultBalance = records
    .filter((r) => r.state !== 3 && r.state !== 5)
    .reduce((acc, r) => acc + Number(r.lockedEscrow || 0), 0);
  const openInstrumentsCount = records.filter(
    (r) => r.state !== 3 && r.state !== 5
  ).length;
  const openFactoringList = records.filter(
    (r) => r.state === 1 && r.isListedForFactoring
  );

  const navTitleMap: Record<NavSection, string> = {
    ledger: "Instruments",
    issue: "Issue LC",
    factoring: "Exchange",
    explorer: "Audit log",
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#111814] flex font-sans antialiased selection:bg-[#198754]/20">
      {/* =================================================================== */}
      {/* LEFT DARK SIDEBAR                                                   */}
      {/* =================================================================== */}
      <aside className="w-[248px] bg-[#141916] text-white flex flex-col justify-between shrink-0 sticky top-0 h-screen select-none">
        <div>
          {/* Brand Header */}
          <div className="px-5 pt-6 pb-7 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#1E8E5A] flex items-center justify-center text-white font-bold text-sm shadow-inner">
              M
            </div>
            <div>
              <div className="font-semibold text-[14px] text-white leading-tight">
                MST Treasury
              </div>
              <div className="text-[11px] text-[#8A9990] mt-0.5">
                Trade finance protocol
              </div>
            </div>
          </div>

          {/* Workspace Navigation */}
          <div className="px-3">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#69786F]">
              WORKSPACE
            </div>
            <nav className="space-y-1">
              {/* Instruments */}
              <button
                onClick={() => setActiveNav("ledger")}
                className={`w-full px-3 py-2.5 rounded-lg text-[13px] font-medium transition flex items-center justify-between ${
                  activeNav === "ledger"
                    ? "bg-[#212924] text-white"
                    : "text-[#9AA89F] hover:text-white hover:bg-[#1B221E]"
                }`}
              >
                <span className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h16M4 18h10"
                    />
                  </svg>
                  Instruments
                </span>
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-[#1E8E5A] text-white text-[11px] font-mono flex items-center justify-center">
                  {records.length}
                </span>
              </button>

              {/* Issue LC */}
              <button
                onClick={() => setActiveNav("issue")}
                className={`w-full px-3 py-2.5 rounded-lg text-[13px] font-medium transition flex items-center justify-between ${
                  activeNav === "issue"
                    ? "bg-[#212924] text-white"
                    : "text-[#9AA89F] hover:text-white hover:bg-[#1B221E]"
                }`}
              >
                <span className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Issue LC
                </span>
              </button>

              {/* Exchange */}
              <button
                onClick={() => setActiveNav("factoring")}
                className={`w-full px-3 py-2.5 rounded-lg text-[13px] font-medium transition flex items-center justify-between ${
                  activeNav === "factoring"
                    ? "bg-[#212924] text-white"
                    : "text-[#9AA89F] hover:text-white hover:bg-[#1B221E]"
                }`}
              >
                <span className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                  Exchange
                </span>
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-[#1E8E5A] text-white text-[11px] font-mono flex items-center justify-center">
                  {openFactoringList.length}
                </span>
              </button>

              {/* Audit Log */}
              <button
                onClick={() => setActiveNav("explorer")}
                className={`w-full px-3 py-2.5 rounded-lg text-[13px] font-medium transition flex items-center justify-between ${
                  activeNav === "explorer"
                    ? "bg-[#212924] text-white"
                    : "text-[#9AA89F] hover:text-white hover:bg-[#1B221E]"
                }`}
              >
                <span className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 opacity-80"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Audit log
                </span>
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-[#1E8E5A] text-white text-[11px] font-mono flex items-center justify-center">
                  {txHistory.length}
                </span>
              </button>
            </nav>
          </div>
        </div>

        {/* Bottom Assurance Box & RPC Status */}
        <div className="p-4 space-y-4">
          <div className="bg-[#1C231F] border border-[#28322C] rounded-xl p-4 space-y-2.5">
            <div className="h-6 w-6 rounded-md bg-[#1E8E5A]/20 text-[#2DD488] flex items-center justify-center text-xs font-bold">
              ✓
            </div>
            <div className="text-[12px] font-semibold text-white">
              On-chain assurance
            </div>
            <p className="text-[11px] text-[#8A9990] leading-relaxed">
              Every instrument is cryptographically anchored and settled on MST
              Chain.
            </p>
            <a
              href={
                net.contractAddress
                  ? `${explorer}/address/${net.contractAddress}`
                  : explorer
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2DD488] hover:underline pt-0.5"
            >
              View smart contract ↗
            </a>
          </div>

          <div className="px-2 flex items-center gap-2 text-[11px] text-[#8A9990]">
            <span className="h-2 w-2 rounded-full bg-[#2DD488]" />
            <span>
              {isSyncing
                ? `Syncing ${net.chainName}...`
                : `MSTnet RPC Operational`}
            </span>
          </div>
        </div>
      </aside>

      {/* =================================================================== */}
      {/* RIGHT MAIN WORKSPACE                                                */}
      {/* =================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-[72px] bg-[#FAF9F5] border-b border-[#E6E4DD] px-8 flex items-center justify-between sticky top-0 z-20">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#78827C]">
              INSTITUTIONAL TRADE DESK
            </div>
            <h1 className="text-[18px] font-semibold text-[#111814] leading-snug">
              {navTitleMap[activeNav]}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Network Switcher */}
            <div className="inline-flex rounded-lg border border-[#DCDAD2] bg-[#F2F0E8] p-0.5 text-xs">
              <button
                onClick={async () => {
                  setNetworkMode("testnet");
                  setBannerMsg({
                    type: "info",
                    text: "Switched workspace to MST Testnet (Chain ID: 91562037).",
                  });
                  try {
                    await ensureMSTNetwork("testnet");
                    if (account) await handleWalletConnect("testnet");
                  } catch {}
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  networkMode === "testnet"
                    ? "bg-white text-[#111814] shadow-2xs"
                    : "text-[#68736D] hover:text-[#111814]"
                }`}
              >
                Testnet
              </button>
              <button
                onClick={async () => {
                  setNetworkMode("mainnet");
                  setBannerMsg({
                    type: "info",
                    text: "Switched workspace to MST Mainnet (Chain ID: 4646). Deploy Mainnet contract & set NEXT_PUBLIC_MAINNET_CONTRACT_ADDRESS to index Mainnet positions.",
                  });
                  try {
                    await ensureMSTNetwork("mainnet");
                    if (account) await handleWalletConnect("mainnet");
                  } catch {}
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  networkMode === "mainnet"
                    ? "bg-white text-[#111814] shadow-2xs"
                    : "text-[#68736D] hover:text-[#111814]"
                }`}
              >
                Mainnet
              </button>
            </div>

            {/* Wallet Button */}
            {account ? (
              <button
                onClick={() => handleWalletConnect(networkMode)}
                className="bg-[#163828] text-white text-xs font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-2xs"
              >
                <span className="h-2 w-2 rounded-full bg-[#2DD488]" />
                <span className="font-mono">
                  {balance} {symbol}
                </span>
                <span className="opacity-40">|</span>
                <span className="font-mono">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
              </button>
            ) : (
              <button
                onClick={() => handleWalletConnect(networkMode)}
                className="bg-[#163828] hover:bg-[#1E4B36] text-white text-xs font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 transition shadow-2xs"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                Connect wallet
              </button>
            )}
          </div>
        </header>

        {/* Status Toast Banner */}
        {bannerMsg && (
          <div
            className={`px-8 py-2.5 text-xs border-b flex items-center justify-between ${
              bannerMsg.type === "error"
                ? "bg-red-50 border-red-200 text-red-900"
                : bannerMsg.type === "success"
                ? "bg-[#E6F4ED] border-[#C5E6D5] text-[#125D3B]"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            <span className="font-medium">{bannerMsg.text}</span>
            <button
              onClick={() => setBannerMsg(null)}
              className="text-xs underline opacity-75 hover:opacity-100 ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Content Container */}
        <main className="flex-1 px-8 py-8 max-w-[1360px] w-full mx-auto">
          {/* =============================================================== */}
          {/* VIEW 1: INSTRUMENTS (PORTFOLIO OVERVIEW + LEDGER + DOSSIER)     */}
          {/* =============================================================== */}
          {activeNav === "ledger" && (
            <div className="space-y-8">
              {/* Portfolio Overview Hero */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#198754]">
                    PORTFOLIO OVERVIEW
                  </div>
                  <h2 className="font-serif text-[36px] leading-[1.12] tracking-tight text-[#111814] max-w-xl">
                    Programmable trade, settled with certainty.
                  </h2>
                  <p className="text-[13px] text-[#68736D] pt-0.5">
                    Manage letters of credit, shipping attestations, and
                    receivable financing from one verifiable treasury workspace.
                  </p>
                </div>

                <button
                  onClick={() => setActiveNav("issue")}
                  className="bg-[#16794F] hover:bg-[#126340] text-white text-xs font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 transition shadow-2xs"
                >
                  <span>+</span>
                  <span>Issue letter of credit</span>
                </button>
              </div>

              {/* 4 KPI Cards with Sparklines & Gauges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Trade Volume */}
                <div className="bg-white border border-[#E6E4DD] rounded-xl p-5 flex flex-col justify-between min-h-[124px]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#68736D] font-medium">
                      Trade volume
                    </span>
                    <span className="text-[#9AA39E]">All-time</span>
                  </div>
                  <div className="flex items-end justify-between pt-4">
                    <div className="font-mono text-[24px] font-semibold text-[#111814] leading-none">
                      {totalVolume.toFixed(4)}{" "}
                      <span className="text-[11px] font-normal text-[#78827C]">
                        {symbol}
                      </span>
                    </div>
                    <svg className="w-16 h-7 text-[#16794F]" viewBox="0 0 64 28">
                      <path
                        d="M2 24 C16 22, 24 14, 38 14 C48 14, 54 6, 62 4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* Card 2: Escrow Reserve */}
                <div className="bg-white border border-[#E6E4DD] rounded-xl p-5 flex flex-col justify-between min-h-[124px]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#68736D] font-medium">
                      Escrow reserve
                    </span>
                    <span className="text-[#9AA39E]">70% tranche locked</span>
                  </div>
                  <div className="flex items-end justify-between pt-4">
                    <div className="font-mono text-[24px] font-semibold text-[#111814] leading-none">
                      {activeVaultBalance.toFixed(4)}{" "}
                      <span className="text-[11px] font-normal text-[#78827C]">
                        {symbol}
                      </span>
                    </div>
                    <svg className="w-14 h-8" viewBox="0 0 56 32">
                      <path
                        d="M 6 28 A 22 22 0 0 1 50 28"
                        fill="none"
                        stroke="#E6E4DD"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 6 28 A 22 22 0 0 1 40 11"
                        fill="none"
                        stroke="#16794F"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* Card 3: Open Instruments */}
                <div className="bg-white border border-[#E6E4DD] rounded-xl p-5 flex flex-col justify-between min-h-[124px]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#68736D] font-medium">
                      Open instruments
                    </span>
                    <span className="text-[#9AA39E]">Active lifecycle</span>
                  </div>
                  <div className="flex items-end justify-between pt-4">
                    <div className="font-mono text-[26px] font-semibold text-[#111814] leading-none">
                      {openInstrumentsCount}
                    </div>
                    <svg className="w-16 h-7 text-[#16794F]" viewBox="0 0 64 28">
                      <path
                        d="M2 22 C18 22, 28 18, 42 12 C50 8, 56 6, 62 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* Card 4: Factoring Offers */}
                <div className="bg-white border border-[#E6E4DD] rounded-xl p-5 flex flex-col justify-between min-h-[124px]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#68736D] font-medium">
                      Factoring offers
                    </span>
                    <span className="text-[#9AA39E]">Available to acquire</span>
                  </div>
                  <div className="flex items-end justify-between pt-4">
                    <div className="font-mono text-[26px] font-semibold text-[#111814] leading-none">
                      {openFactoringList.length}
                    </div>
                    <svg className="w-14 h-8" viewBox="0 0 56 32">
                      <path
                        d="M 6 28 A 22 22 0 0 1 50 28"
                        fill="none"
                        stroke="#E6E4DD"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Lower Split: Letters of Credit Table (Left) + Instrument Dossier (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 7 Columns: Letters of Credit Table */}
                <div className="lg:col-span-7 bg-white border border-[#E6E4DD] rounded-xl overflow-hidden">
                  <div className="px-6 py-5 border-b border-[#E6E4DD] flex items-center justify-between">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#111814]">
                        Letters of credit
                      </h3>
                      <p className="text-[11px] text-[#78827C] mt-0.5">
                        Live positions synchronized from {net.chainName}
                      </p>
                    </div>
                    <button
                      onClick={syncLedger}
                      className="text-[11px] text-[#68736D] hover:text-[#111814] border border-[#E6E4DD] px-2.5 py-1 rounded-md transition"
                    >
                      {isSyncing ? "Syncing..." : "Refresh"}
                    </button>
                  </div>

                  {records.length === 0 ? (
                    <div className="p-12 text-center space-y-2">
                      <div className="text-sm font-medium text-[#111814]">
                        No Letters of Credit indexed on {net.chainName}
                      </div>
                      <p className="text-xs text-[#78827C]">
                        {networkMode === "mainnet"
                          ? "Deploy MSTTradeProtocol.sol to MST Mainnet (Chain ID: 4646) and set NEXT_PUBLIC_MAINNET_CONTRACT_ADDRESS."
                          : "Issue a programmable Letter of Credit to initialize on-chain escrow."}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#E6E4DD] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8A948E]">
                            <th className="py-3.5 px-6">INSTRUMENT</th>
                            <th className="py-3.5 px-4">EXPORTER</th>
                            <th className="py-3.5 px-4">FACE VALUE</th>
                            <th className="py-3.5 px-6 text-right">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFECE6] text-xs">
                          {records.map((rec) => {
                            const meta =
                              STATUS_META[rec.state] || STATUS_META[0];
                            const isSelected =
                              selectedRecord &&
                              selectedRecord.lcId === rec.lcId;
                            return (
                              <tr
                                key={rec.lcId}
                                onClick={() => setSelectedId(rec.lcId)}
                                className={`cursor-pointer transition ${
                                  isSelected
                                    ? "bg-[#F5F4EE]"
                                    : "hover:bg-[#FAF9F5]"
                                }`}
                              >
                                <td className="py-4 px-6">
                                  <div className="font-mono font-semibold text-[#111814] text-[13px]">
                                    {rec.invoiceCode}
                                  </div>
                                  <div className="text-[11px] text-[#8A948E] font-mono mt-0.5">
                                    #{rec.lcId}
                                  </div>
                                </td>
                                <td className="py-4 px-4 font-mono text-[12px] text-[#5A655E]">
                                  {rec.exporter.slice(0, 6)}...
                                  {rec.exporter.slice(-4)}
                                </td>
                                <td className="py-4 px-4 font-mono">
                                  <div className="font-semibold text-[#111814] text-[13px]">
                                    {rec.totalAmount}
                                  </div>
                                  <div className="text-[10px] text-[#8A948E]">
                                    {symbol}
                                  </div>
                                </td>
                                <td className="py-4 px-6 text-right">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${meta.badge}`}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                                    />
                                    {meta.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Right 5 Columns: Selected Instrument Dossier */}
                <div className="lg:col-span-5 bg-white border border-[#E6E4DD] rounded-xl p-6 space-y-6">
                  {!selectedRecord ? (
                    <div className="py-12 text-center text-xs text-[#78827C]">
                      Select an instrument from the ledger to inspect its
                      on-chain dossier.
                    </div>
                  ) : (
                    <>
                      {/* Dossier Top Title & Badge */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#78827C]">
                            INSTRUMENT #{selectedRecord.lcId}
                          </div>
                          <h3 className="text-[20px] font-mono font-semibold text-[#111814] mt-0.5">
                            {selectedRecord.invoiceCode}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
                            (
                              STATUS_META[selectedRecord.state] ||
                              STATUS_META[0]
                            ).badge
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              (
                                STATUS_META[selectedRecord.state] ||
                                STATUS_META[0]
                              ).dot
                            }`}
                          />
                          {
                            (
                              STATUS_META[selectedRecord.state] ||
                              STATUS_META[0]
                            ).label
                          }
                        </span>
                      </div>

                      {/* 4-Stage Progress Bar */}
                      <div className="grid grid-cols-4 gap-2 pt-1">
                        {[
                          { s: 1, label: "Issued" },
                          { s: 2, label: "Shipped" },
                          { s: 3, label: "Financed" },
                          { s: 4, label: "Settled" },
                        ].map((st) => {
                          const cur = (
                            STATUS_META[selectedRecord.state] || STATUS_META[0]
                          ).step;
                          const active = cur >= st.s;
                          return (
                            <div key={st.s} className="space-y-1.5">
                              <div
                                className={`h-1 rounded-full ${
                                  active ? "bg-[#16794F]" : "bg-[#E6E4DD]"
                                }`}
                              />
                              <span
                                className={`block text-[11px] ${
                                  active
                                    ? "text-[#111814] font-medium"
                                    : "text-[#8A948E]"
                                }`}
                              >
                                {st.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* 2-Box Financial Tranche Cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#FAF9F5] border border-[#E6E4DD] rounded-lg p-3.5">
                          <div className="text-[11px] text-[#78827C]">
                            Advance paid
                          </div>
                          <div className="font-mono text-[15px] font-semibold text-[#16794F] mt-1">
                            {selectedRecord.advancePaid}{" "}
                            <span className="text-[11px] font-normal">
                              {symbol}
                            </span>
                          </div>
                        </div>
                        <div className="bg-[#FAF9F5] border border-[#E6E4DD] rounded-lg p-3.5">
                          <div className="text-[11px] text-[#78827C]">
                            Escrow reserve
                          </div>
                          <div className="font-mono text-[15px] font-semibold text-[#111814] mt-1">
                            {selectedRecord.lockedEscrow}{" "}
                            <span className="text-[11px] font-normal text-[#78827C]">
                              {symbol}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Counterparty Metadata List */}
                      <div className="space-y-2.5 text-[12px] border-t border-b border-[#EFECE6] py-4">
                        <div className="flex justify-between">
                          <span className="text-[#78827C]">Importer</span>
                          <span className="font-mono text-[#111814]">
                            {selectedRecord.buyer.slice(0, 6)}...
                            {selectedRecord.buyer.slice(-4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#78827C]">Exporter</span>
                          <span className="font-mono text-[#111814]">
                            {selectedRecord.exporter.slice(0, 6)}...
                            {selectedRecord.exporter.slice(-4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#78827C]">Carrier</span>
                          <span className="font-mono text-[#111814]">
                            {selectedRecord.carrier.slice(0, 6)}...
                            {selectedRecord.carrier.slice(-4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#78827C]">Beneficiary</span>
                          <span className="font-mono font-medium text-[#111814]">
                            {selectedRecord.beneficiary.slice(0, 6)}...
                            {selectedRecord.beneficiary.slice(-4)}
                          </span>
                        </div>
                        {selectedRecord.eBoLHash && (
                          <div className="pt-2">
                            <span className="text-[#78827C] block text-[11px] mb-1">
                              e-BoL SHA-256 Digest
                            </span>
                            <div className="font-mono text-[11px] bg-[#FAF9F5] border border-[#E6E4DD] px-2.5 py-1.5 rounded text-[#111814] break-all">
                              {selectedRecord.eBoLHash}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* AVAILABLE ACTION SECTION */}
                      <div className="space-y-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#78827C]">
                          AVAILABLE ACTION
                        </div>

                        {/* State 0: Register Electronic Bill of Lading */}
                        {selectedRecord.state === 0 && (
                          <div className="bg-[#FAF9F5] border border-[#E6E4DD] rounded-xl p-4 space-y-3">
                            <div>
                              <div className="text-[13px] font-semibold text-[#111814]">
                                Register Electronic Bill of Lading
                              </div>
                              <p className="text-[11px] text-[#68736D] mt-0.5">
                                Hash the shipping document locally, then anchor
                                its digest on-chain.
                              </p>
                            </div>

                            <label className="flex items-center justify-center gap-2 w-full bg-white hover:bg-[#F5F4EE] border border-[#DCDAD2] rounded-lg py-2.5 px-3 cursor-pointer text-xs font-medium text-[#111814] transition">
                              <svg
                                className="w-4 h-4 text-[#68736D]"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.8}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <span>
                                {bolFileName || "Choose shipping document"}
                              </span>
                              <input
                                type="file"
                                onChange={(e) =>
                                  handleDocumentUpload(e.target.files?.[0])
                                }
                                className="hidden"
                              />
                            </label>

                            {aiReport && (
                              <div className="bg-[#E6F4ED] border border-[#C5E6D5] rounded-lg p-2.5 text-[11px] text-[#125D3B] space-y-0.5">
                                <div className="font-semibold flex justify-between">
                                  <span>✓ {aiReport.documentType}</span>
                                  <span className="font-mono">
                                    {aiReport.complianceScore}
                                  </span>
                                </div>
                                <div className="text-[10px] opacity-90">
                                  {aiReport.summary}
                                </div>
                              </div>
                            )}

                            <input
                              type="text"
                              placeholder="0x... SHA-256 digest"
                              value={bolInput}
                              onChange={(e) => setBolInput(e.target.value)}
                              className="w-full bg-white border border-[#DCDAD2] rounded-lg px-3 py-2 text-xs font-mono text-[#111814] focus:outline-none focus:border-[#163828]"
                            />

                            <button
                              onClick={() =>
                                handleAttestShipment(selectedRecord.lcId)
                              }
                              disabled={isSubmitting}
                              className="w-full bg-[#163828] hover:bg-[#1E4B36] disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg transition"
                            >
                              {isSubmitting
                                ? "Anchoring on-chain..."
                                : "Anchor e-BoL on-chain"}
                            </button>
                          </div>
                        )}

                        {/* State 1: Exporter Factoring or Delivery Confirmation */}
                        {selectedRecord.state === 1 && (
                          <div className="space-y-3">
                            {!selectedRecord.isListedForFactoring ? (
                              <div className="bg-[#FAF9F5] border border-[#E6E4DD] rounded-xl p-4 space-y-3">
                                <div className="text-[13px] font-semibold text-[#111814]">
                                  List Receivable on Exchange
                                </div>
                                <p className="text-[11px] text-[#68736D]">
                                  Discount the locked{" "}
                                  {selectedRecord.lockedEscrow} {symbol}{" "}
                                  receivable for immediate liquidity.
                                </p>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    step="0.0001"
                                    placeholder={`Ask (${(
                                      Number(selectedRecord.lockedEscrow) * 0.95
                                    ).toFixed(4)})`}
                                    value={discountInput}
                                    onChange={(e) =>
                                      setDiscountInput(e.target.value)
                                    }
                                    className="flex-1 bg-white border border-[#DCDAD2] rounded-lg px-3 py-2 text-xs font-mono"
                                  />
                                  <button
                                    onClick={() =>
                                      handleListReceivable(
                                        selectedRecord.lcId,
                                        discountInput ||
                                          (
                                            Number(
                                              selectedRecord.lockedEscrow
                                            ) * 0.95
                                          ).toFixed(4)
                                      )
                                    }
                                    disabled={isSubmitting}
                                    className="bg-[#163828] hover:bg-[#1E4B36] text-white text-xs font-medium px-4 py-2 rounded-lg transition"
                                  >
                                    List claim
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-[#FAF9F5] border border-[#E6E4DD] rounded-xl p-4 space-y-2.5">
                                <div className="text-[13px] font-semibold text-[#111814]">
                                  Acquire Factored Receivable
                                </div>
                                <p className="text-[11px] text-[#68736D]">
                                  Pay{" "}
                                  <span className="font-mono font-semibold text-[#111814]">
                                    {selectedRecord.factoringPrice} {symbol}
                                  </span>{" "}
                                  to acquire the {selectedRecord.lockedEscrow}{" "}
                                  {symbol} escrow claim.
                                </p>
                                <button
                                  onClick={() =>
                                    handlePurchaseReceivable(
                                      selectedRecord.lcId,
                                      selectedRecord.factoringPrice
                                    )
                                  }
                                  disabled={isSubmitting}
                                  className="w-full bg-[#16794F] hover:bg-[#126340] text-white text-xs font-medium py-2.5 rounded-lg transition"
                                >
                                  Acquire claim ({selectedRecord.factoringPrice}{" "}
                                  {symbol})
                                </button>
                              </div>
                            )}

                            <div className="bg-[#FAF9F5] border border-[#E6E4DD] rounded-xl p-4 space-y-2.5">
                              <div className="text-[13px] font-semibold text-[#111814]">
                                Confirm Arrival &amp; Release Vault
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    handleSettleDelivery(selectedRecord.lcId)
                                  }
                                  disabled={isSubmitting}
                                  className="flex-1 bg-[#163828] hover:bg-[#1E4B36] text-white text-xs font-medium py-2.5 rounded-lg transition"
                                >
                                  Release 70% escrow
                                </button>
                                <button
                                  onClick={() =>
                                    handleDisputeHold(selectedRecord.lcId)
                                  }
                                  disabled={isSubmitting}
                                  className="border border-red-300 text-red-700 hover:bg-red-50 text-xs font-medium px-3 py-2.5 rounded-lg transition"
                                >
                                  Hold
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* State 2: Financed -> Confirm Delivery */}
                        {selectedRecord.state === 2 && (
                          <div className="bg-[#FAF9F5] border border-[#E6E4DD] rounded-xl p-4 space-y-3">
                            <div className="text-[13px] font-semibold text-[#111814]">
                              Confirm Arrival &amp; Settle to Assignee
                            </div>
                            <p className="text-[11px] text-[#68736D]">
                              Releases {selectedRecord.lockedEscrow} {symbol}{" "}
                              escrow reserve to the financing beneficiary.
                            </p>
                            <button
                              onClick={() =>
                                handleSettleDelivery(selectedRecord.lcId)
                              }
                              disabled={isSubmitting}
                              className="w-full bg-[#16794F] hover:bg-[#126340] text-white text-xs font-medium py-2.5 rounded-lg transition"
                            >
                              Confirm delivery &amp; settle
                            </button>
                          </div>
                        )}

                        {/* State 3 or 5: Settled */}
                        {(selectedRecord.state === 3 ||
                          selectedRecord.state === 5) && (
                          <div className="bg-[#E6F4ED] border border-[#C5E6D5] rounded-xl p-4 text-xs text-[#125D3B]">
                            All tranches for this instrument have been settled
                            on MST Blockchain.
                          </div>
                        )}

                        {/* State 4: Arbitration Hold */}
                        {selectedRecord.state === 4 && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                            <div className="text-xs font-semibold text-red-900">
                              Arbitration Hold Active
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleResolveDispute(
                                    selectedRecord.lcId,
                                    true
                                  )
                                }
                                disabled={isSubmitting}
                                className="flex-1 bg-[#163828] text-white text-xs py-2 rounded-lg"
                              >
                                Pay Beneficiary
                              </button>
                              <button
                                onClick={() =>
                                  handleResolveDispute(
                                    selectedRecord.lcId,
                                    false
                                  )
                                }
                                disabled={isSubmitting}
                                className="flex-1 bg-white border border-red-300 text-red-800 text-xs py-2 rounded-lg"
                              >
                                Refund Importer
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW 2: ISSUE LC                                                */}
          {/* =============================================================== */}
          {activeNav === "issue" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pt-4">
              <div className="lg:col-span-5 space-y-6">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#198754]">
                  NEW INSTRUMENT
                </div>
                <h2 className="font-serif text-[40px] leading-[1.1] tracking-tight text-[#111814]">
                  Issue a programmable Letter of Credit.
                </h2>
                <p className="text-[13px] text-[#68736D] leading-relaxed">
                  Fund the transaction once. The smart contract disburses the
                  supplier advance and secures the remaining balance until
                  delivery.
                </p>

                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-[#E6E4DD]">
                  <div>
                    <div className="font-mono text-[24px] font-semibold text-[#111814]">
                      30%
                    </div>
                    <div className="text-[11px] text-[#78827C] mt-0.5">
                      Released to exporter
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[24px] font-semibold text-[#111814]">
                      70%
                    </div>
                    <div className="text-[11px] text-[#78827C] mt-0.5">
                      Escrowed on-chain
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 bg-white border border-[#E6E4DD] rounded-xl p-7 shadow-2xs">
                <div className="flex items-start justify-between pb-6 border-b border-[#EFECE6]">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#111814]">
                      Instrument details
                    </h3>
                    <p className="text-[11px] text-[#78827C] mt-0.5">
                      All fields are recorded in the settlement transaction
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const fill =
                        account || "0x0b27D25A0849f5CFee253556Cf2190ebA336C60d";
                      setExporterInput(fill);
                      setCarrierInput(fill);
                      setReferenceInput(
                        `LC-2026-${Math.floor(1000 + Math.random() * 9000)}`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#5A655E] bg-[#F5F4EE] hover:bg-[#EAE8DF] px-3 py-1.5 rounded-md transition"
                  >
                    <span>⚡</span>
                    <span>Auto-fill wallet</span>
                  </button>
                </div>

                <form onSubmit={handleIssueLC} className="space-y-5 pt-6 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-[#5A655E] mb-1.5">
                        LC reference
                      </label>
                      <input
                        type="text"
                        required
                        value={referenceInput}
                        onChange={(e) => setReferenceInput(e.target.value)}
                        className="w-full bg-[#FAF9F5] border border-[#DCDAD2] rounded-lg px-3.5 py-2.5 font-mono text-[#111814] focus:bg-white focus:border-[#163828] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#5A655E] mb-1.5">
                        Commitment value
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        className="w-full bg-[#FAF9F5] border border-[#DCDAD2] rounded-lg px-3.5 py-2.5 font-mono text-[#111814] focus:bg-white focus:border-[#163828] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#5A655E] mb-1.5">
                      Exporter wallet
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="0x..."
                      value={exporterInput}
                      onChange={(e) => setExporterInput(e.target.value)}
                      className="w-full bg-[#FAF9F5] border border-[#DCDAD2] rounded-lg px-3.5 py-2.5 font-mono text-[#111814] focus:bg-white focus:border-[#163828] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#5A655E] mb-1.5">
                      Authorized carrier wallet
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="0x..."
                      value={carrierInput}
                      onChange={(e) => setCarrierInput(e.target.value)}
                      className="w-full bg-[#FAF9F5] border border-[#DCDAD2] rounded-lg px-3.5 py-2.5 font-mono text-[#111814] focus:bg-white focus:border-[#163828] focus:outline-none"
                    />
                  </div>

                  {/* Tranche Summary Strip */}
                  <div className="bg-[#FAF9F5] border border-[#E6E4DD] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-[11px]">
                    <div className="flex items-center gap-3">
                      <span className="text-[#78827C]">Immediate advance</span>
                      <span className="font-mono font-semibold text-[#16794F]">
                        {(Number(amountInput || 0) * 0.3).toFixed(4)} {symbol}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#78827C]">Escrow reserve</span>
                      <span className="font-mono font-semibold text-[#111814]">
                        {(Number(amountInput || 0) * 0.7).toFixed(4)} {symbol}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveNav("ledger")}
                      className="px-4 py-2.5 rounded-lg border border-[#DCDAD2] text-[#111814] hover:bg-[#F5F4EE] font-medium transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-[#163828] hover:bg-[#1E4B36] disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg transition"
                    >
                      {isSubmitting
                        ? "Authorizing on-chain..."
                        : "Authorize and issue"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW 3: EXCHANGE                                                */}
          {/* =============================================================== */}
          {activeNav === "factoring" && (
            <div className="space-y-8 pt-2">
              <div className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#198754]">
                  SECONDARY RECEIVABLES
                </div>
                <h2 className="font-serif text-[36px] leading-[1.12] tracking-tight text-[#111814]">
                  Acquire trade-backed yield.
                </h2>
                <p className="text-[13px] text-[#68736D]">
                  Carrier-attested claims with transparent pricing and on-chain
                  settlement.
                </p>
              </div>

              {openFactoringList.length === 0 ? (
                <div className="bg-white border border-[#E6E4DD] rounded-xl py-20 px-6 text-center space-y-2">
                  <div className="h-10 w-10 rounded-xl bg-[#F5F4EE] border border-[#E6E4DD] mx-auto flex items-center justify-center text-[#78827C]">
                    ⇄
                  </div>
                  <div className="text-[14px] font-semibold text-[#111814] pt-2">
                    No receivables listed
                  </div>
                  <p className="text-[12px] text-[#78827C] max-w-sm mx-auto">
                    Verified financing opportunities will appear here when
                    exporters list their escrow claims.
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-[#E6E4DD] rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E6E4DD] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8A948E]">
                        <th className="py-3.5 px-6">Instrument</th>
                        <th className="py-3.5 px-5">Exporter</th>
                        <th className="py-3.5 px-5">e-BoL Digest</th>
                        <th className="py-3.5 px-5 text-right">Escrow Claim</th>
                        <th className="py-3.5 px-5 text-right">Buyout Ask</th>
                        <th className="py-3.5 px-5 text-right">Yield</th>
                        <th className="py-3.5 px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE6]">
                      {openFactoringList.map((item) => {
                        const spread =
                          Number(item.lockedEscrow) -
                          Number(item.factoringPrice);
                        return (
                          <tr key={item.lcId} className="hover:bg-[#FAF9F5]">
                            <td className="py-4 px-6 font-mono font-semibold text-[#111814]">
                              {item.invoiceCode} (#{item.lcId})
                            </td>
                            <td className="py-4 px-5 font-mono text-[#5A655E]">
                              {item.exporter.slice(0, 6)}...
                              {item.exporter.slice(-4)}
                            </td>
                            <td className="py-4 px-5 font-mono text-[#78827C]">
                              {item.eBoLHash.slice(0, 18)}...
                            </td>
                            <td className="py-4 px-5 text-right font-mono font-medium text-[#111814]">
                              {item.lockedEscrow} {symbol}
                            </td>
                            <td className="py-4 px-5 text-right font-mono font-semibold text-[#16794F]">
                              {item.factoringPrice} {symbol}
                            </td>
                            <td className="py-4 px-5 text-right font-mono text-[#16794F]">
                              +{spread.toFixed(4)} {symbol}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <button
                                onClick={() =>
                                  handlePurchaseReceivable(
                                    item.lcId,
                                    item.factoringPrice
                                  )
                                }
                                disabled={isSubmitting}
                                className="bg-[#163828] hover:bg-[#1E4B36] text-white font-medium px-3.5 py-1.5 rounded-lg transition"
                              >
                                Acquire claim
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW 4: AUDIT LOG (Separates Testnet & Mainnet Cleanly)         */}
          {/* =============================================================== */}
          {activeNav === "explorer" && (
            <div className="bg-white border border-[#E6E4DD] rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-[#E6E4DD] flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-[#111814]">
                    On-chain audit log ({net.chainName})
                  </h2>
                  <p className="text-[11px] text-[#78827C] mt-0.5">
                    Indexed transactions and settlement events on {explorer}
                  </p>
                </div>
                <a
                  href={
                    net.contractAddress
                      ? `${explorer}/address/${net.contractAddress}`
                      : explorer
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-[#111814] hover:underline inline-flex items-center gap-1"
                >
                  Open MSTScan ↗
                </a>
              </div>

              {txHistory.length === 0 ? (
                <div className="p-16 text-center space-y-2">
                  <div className="text-sm font-medium text-[#111814]">
                    No transactions indexed on {net.chainName} yet
                  </div>
                  <p className="text-xs text-[#78827C] max-w-md mx-auto">
                    Switch to MST Testnet to inspect the 7 verified protocol
                    transactions, or deploy the contract to MST Mainnet (Chain
                    ID: 4646) once Mainnet MSTC gas is received.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#EFECE6]">
                  {txHistory.map((item, i) => (
                    <a
                      key={i}
                      href={`${explorer}/tx/${item.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-6 py-4 flex items-center justify-between hover:bg-[#FAF9F5] transition group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-[#E6F4ED] text-[#16794F] flex items-center justify-center text-xs font-bold">
                          ✓
                        </div>
                        <div>
                          <div className="text-[13px] font-medium text-[#111814]">
                            {item.action}
                          </div>
                          <div className="text-[11px] font-mono text-[#78827C] mt-0.5">
                            {item.timestamp} • {item.hash.slice(0, 10)}...
                            {item.hash.slice(-6)}
                          </div>
                        </div>
                      </div>
                      <span className="text-[#78827C] group-hover:text-[#111814] text-sm font-mono">
                        ↗
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}