"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

// ============================================================================
// 1. MST NETWORK & CONTRACT CONFIGURATION
// ============================================================================
const DEFAULT_TESTNET_CONTRACT = "0x7469FaD978c171B7da28CaAB2B8eF3D171Ae4f74";

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
      DEFAULT_TESTNET_CONTRACT
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

const INITIAL_VERIFIED_TXS = [
  {
    timestamp: "Block Verified",
    action: "Issued Active Letter of Credit #2 (LC-2026-9042)",
    hash: "0x74373cc71f88ea2496d1221a090231f76b979f5531848186d4c3a3ab241ee9d4",
  },
  {
    timestamp: "Block Verified",
    action: "Settled 70% Escrow Vault on Delivery (LC #1)",
    hash: "0x62d8b334acf31663d9f5f1e3a0f77e2791d062e44ca1d64e53f202650c6479c2",
  },
  {
    timestamp: "Block Verified",
    action: "Financed Receivable Claim on Exchange (LC #1)",
    hash: "0x53d5dff4bdaa6d7444364359cf1322a460b28938b7fadc738e89edf7e2daa7c8",
  },
  {
    timestamp: "Block Verified",
    action: "Exporter Listed 70% Receivable for Factoring (LC #1)",
    hash: "0x24d413857f1388d00870e18adb4a26404d370cfd3a6f49a683343cbbffd22a57",
  },
  {
    timestamp: "Block Verified",
    action: "Carrier Anchored SHA-256 e-BoL Digest (LC #1)",
    hash: "0x08c6d3aff2c3f39fc5e5daccd0a0190f73fa3fd9477e19c277a76b1ff5367312",
  },
  {
    timestamp: "Block Verified",
    action: "Issued Letter of Credit #1 & Disbursed 30% Advance",
    hash: "0x9591dd00318091a94698ac635641560bd65371069eecc90ceb60ff8107821b80",
  },
  {
    timestamp: "Contract Genesis",
    action: "Protocol Smart Contract Deployed on MST Testnet",
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
    label: "Awaiting Carrier Dispatch",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    step: 1,
  },
  1: {
    label: "In Transit (e-BoL Verified)",
    dot: "bg-blue-600",
    badge: "bg-blue-50 text-blue-800 border-blue-200",
    step: 2,
  },
  2: {
    label: "Receivable Financed",
    dot: "bg-indigo-600",
    badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
    step: 3,
  },
  3: {
    label: "Settled & Closed",
    dot: "bg-emerald-600",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    step: 4,
  },
  4: {
    label: "Under Arbitration Hold",
    dot: "bg-red-600",
    badge: "bg-red-50 text-red-800 border-red-200",
    step: 2,
  },
  5: {
    label: "Arbitration Resolved",
    dot: "bg-slate-600",
    badge: "bg-slate-100 text-slate-800 border-slate-300",
    step: 4,
  },
};

// ============================================================================
// 2. WALLET & RPC CONNECTION UTILITIES
// ============================================================================
function getInjectedProvider() {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.bridgekey?.ethereum || w.ethereum || null;
}

async function ensureMSTNetwork(mode: NetworkMode) {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error("No Web3 wallet detected. Please open BridgeKey Wallet.");
  }
  const target = MST_NETWORKS[mode];
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: target.chainIdHex }],
    });
  } catch (err: any) {
    if (err.code === 4902 || err?.data?.originalError?.code === 4902) {
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
    throw new Error("BridgeKey Wallet extension not found.");
  }
  await ensureMSTNetwork(mode);
  const browserProvider = new ethers.BrowserProvider(rawProvider);
  const accounts = await browserProvider.send("eth_requestAccounts", []);
  const signer = await browserProvider.getSigner();
  const bal = await browserProvider.getBalance(accounts[0]);
  return {
    address: accounts[0],
    balance: ethers.formatEther(bal),
    signer,
  };
}

// ============================================================================
// 3. ENTERPRISE TRADE FINANCE TERMINAL
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
  >(INITIAL_VERIFIED_TXS);

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
      "MST Trade Treasury | Programmable Letters of Credit & RWA Factoring";
  }, []);

  const syncLedger = useCallback(async () => {
    setIsSyncing(true);
    try {
      const rpc = new ethers.JsonRpcProvider(net.rpcUrls[0]);
      const code = await rpc.getCode(net.contractAddress);
      if (!code || code === "0x") {
        setRecords([]);
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
          totalAmount: ethers.formatEther(item.totalAmount),
          advancePaid: ethers.formatEther(item.advancePaid),
          lockedEscrow: ethers.formatEther(item.lockedEscrow),
          factoringPrice: ethers.formatEther(item.factoringPrice),
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
            factoringPrice: ethers.formatEther(item.factoringPrice),
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

      // Automatically query on-chain events so all transactions appear in the Audit Log
      try {
        const currentBlock = await rpc.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 9000);
        const events = await contract.queryFilter("*", fromBlock, currentBlock);

        const discoveredTxs = events
          .map((ev: any) => {
            const name = ev.fragment?.name || "ContractExecution";
            const idArg = ev.args?.[0] ? `LC #${Number(ev.args[0])}` : "";
            const labelMap: Record<string, string> = {
              LOCOpened: `Issued Letter of Credit (${idArg}) & Disbursed 30% Advance`,
              ShipmentAttestedOnChain: `Carrier Anchored SHA-256 e-BoL Digest (${idArg})`,
              InvoiceListedForFactoring: `Exporter Listed 70% Receivable for Factoring (${idArg})`,
              InvoiceFactoredOnChain: `Financed Receivable Claim on Exchange (${idArg})`,
              DeliveryConfirmedAndSettled: `Settled 70% Escrow Vault on Delivery (${idArg})`,
              DisputeRaised: `Placed Arbitration Hold (${idArg})`,
              DisputeResolved: `Arbitration Resolved On-Chain (${idArg})`,
            };
            return {
              timestamp: `Block #${ev.blockNumber}`,
              action: labelMap[name] || `Executed ${name} (${idArg})`,
              hash: ev.transactionHash,
            };
          })
          .reverse();

        setTxHistory((prev) => {
          const combined = [...discoveredTxs, ...prev, ...INITIAL_VERIFIED_TXS];
          const uniqueMap = new Map();
          for (const item of combined) {
            if (item.hash && !uniqueMap.has(item.hash.toLowerCase())) {
              uniqueMap.set(item.hash.toLowerCase(), item);
            }
          }
          return Array.from(uniqueMap.values());
        });
      } catch (eventErr) {
        console.warn("Event indexing fallback:", eventErr);
      }
    } catch (err) {
      console.error("Ledger sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [net.contractAddress, net.rpcUrls, selectedId]);

  useEffect(() => {
    syncLedger();
  }, [syncLedger]);

  const handleWalletConnect = async (targetMode: NetworkMode = networkMode) => {
    try {
      const res = await connectWallet(targetMode);
      setAccount(res.address);
      setBalance(Number(res.balance).toFixed(4));
      if (!exporterInput) setExporterInput(res.address);
      if (!carrierInput) setCarrierInput(res.address);
    } catch (err: any) {
      setBannerMsg({
        type: "error",
        text: err.message || "Could not connect wallet.",
      });
    }
  };

  const logTransaction = (action: string, hash: string) => {
    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setTxHistory((prev) => {
      const filtered = prev.filter(
        (item) => item.hash.toLowerCase() !== hash.toLowerCase()
      );
      return [{ timestamp: now, action, hash }, ...filtered];
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
        text: "Awaiting signature in BridgeKey Wallet to issue Letter of Credit...",
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

      logTransaction(`Issued Letter of Credit (${referenceInput})`, tx.hash);
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
    setBolFileName(`Inspecting ${file.name} via AI Compliance Oracle...`);
    setAiReport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("invoiceCode", selectedRecord.invoiceCode);
      const res = await fetch("/api/verify-bol", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setBolFileName(
          `${file.name} (${data.aiReport.complianceScore} Compliance Match)`
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

      logTransaction(`Carrier Attested e-BoL (LC #${lcId})`, tx.hash);
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

      logTransaction(`Listed Receivable #${lcId} on Exchange`, tx.hash);
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

      logTransaction(`Financed Receivable #${lcId} (${price} ${symbol})`, tx.hash);
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

      logTransaction(`Settled Escrow Vault (LC #${lcId})`, tx.hash);
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

      logTransaction(`Placed Arbitration Hold (LC #${lcId})`, tx.hash);
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

      logTransaction(`Arbitration Resolved (LC #${lcId})`, tx.hash);
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
  const openFactoringList = records.filter(
    (r) => r.state === 1 && r.isListedForFactoring
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Institutional Bar */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-slate-900 text-white flex items-center justify-center font-semibold text-sm tracking-wider">
              TF
            </div>
            <div>
              <span className="font-semibold text-slate-900 tracking-tight text-sm block leading-none">
                MST Trade Treasury
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Programmable Letters of Credit &amp; Receivables Desk
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {[
              { id: "ledger", label: "Instruments Ledger", count: records.length },
              { id: "issue", label: "Issue Letter of Credit" },
              {
                id: "factoring",
                label: "Receivables Exchange",
                count: openFactoringList.length,
              },
              { id: "explorer", label: "Contract Audit Log", count: txHistory.length },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id as NavSection)}
                className={`px-3.5 py-2 rounded-md text-xs font-medium transition flex items-center gap-2 ${
                  activeNav === item.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      activeNav === item.id
                        ? "bg-slate-700 text-slate-200"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Network & Wallet Controls */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              onClick={() => {
                setNetworkMode("testnet");
                if (account) handleWalletConnect("testnet");
              }}
              className={`px-2.5 py-1 rounded font-medium transition ${
                networkMode === "testnet"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Testnet (91562037)
            </button>
            <button
              onClick={() => {
                setNetworkMode("mainnet");
                if (account) handleWalletConnect("mainnet");
              }}
              className={`px-2.5 py-1 rounded font-medium transition ${
                networkMode === "mainnet"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Mainnet (4646)
            </button>
          </div>

          {account ? (
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span className="font-mono font-medium text-slate-800">
                {balance} {symbol}
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-slate-600">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
            </div>
          ) : (
            <button
              onClick={() => handleWalletConnect(networkMode)}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded-md transition"
            >
              Connect BridgeKey
            </button>
          )}
        </div>
      </header>

      {/* Sub-header KPI Strip */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-slate-400 uppercase tracking-wider text-[10px] block">
                Settlement Contract
              </span>
              <a
                href={`${explorer}/address/${net.contractAddress}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-slate-800 hover:text-blue-600 underline decoration-slate-300"
              >
                {net.contractAddress}
              </a>
            </div>
            <div className="h-7 w-px bg-slate-200 hidden sm:block" />
            <div>
              <span className="text-slate-400 uppercase tracking-wider text-[10px] block">
                Cumulative Trade Volume
              </span>
              <span className="font-mono font-semibold text-slate-900">
                {totalVolume.toFixed(4)} {symbol}
              </span>
            </div>
            <div className="h-7 w-px bg-slate-200 hidden sm:block" />
            <div>
              <span className="text-slate-400 uppercase tracking-wider text-[10px] block">
                Active Escrow Reserve (70% Tranches)
              </span>
              <span className="font-mono font-semibold text-blue-700">
                {activeVaultBalance.toFixed(4)} {symbol}
              </span>
            </div>
          </div>

          <button
            onClick={syncLedger}
            disabled={isSyncing}
            className="text-xs text-slate-600 hover:text-slate-900 border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-md font-medium transition"
          >
            {isSyncing ? "Syncing RPC..." : "Sync Ledger"}
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {bannerMsg && (
        <div
          className={`px-6 py-2.5 text-xs border-b flex items-center justify-between ${
            bannerMsg.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : bannerMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <span className="font-medium">{bannerMsg.text}</span>
            <button
              onClick={() => setBannerMsg(null)}
              className="text-slate-500 hover:text-slate-900 font-mono ml-4"
            >
              [Dismiss]
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
        {/* VIEW 1: INSTRUMENTS LEDGER + INSPECTOR DRAWER */}
        {activeNav === "ledger" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: Ledger Table */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Letters of Credit &amp; Escrow Ledger
                  </h2>
                  <p className="text-xs text-slate-500">
                    Select an instrument to inspect shipping documentation, factoring terms, or execute settlement.
                  </p>
                </div>
                <button
                  onClick={() => setActiveNav("issue")}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-3.5 py-2 rounded-md transition"
                >
                  + New Letter of Credit
                </button>
              </div>

              {records.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="text-sm font-medium text-slate-800">
                    No active trade instruments found on-chain
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Issue a new Letter of Credit to lock importer funds into the smart contract vault and disburse the 30% manufacturing advance.
                  </p>
                  <button
                    onClick={() => setActiveNav("issue")}
                    className="mt-2 inline-flex bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-md"
                  >
                    Issue First Letter of Credit
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">Instrument</th>
                        <th className="py-3 px-4">Counterparties</th>
                        <th className="py-3 px-4 text-right">Face Value</th>
                        <th className="py-3 px-4 text-right">Escrow (70%)</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {records.map((rec) => {
                        const meta = STATUS_META[rec.state] || STATUS_META[0];
                        const isSelected =
                          selectedRecord && selectedRecord.lcId === rec.lcId;
                        return (
                          <tr
                            key={rec.lcId}
                            onClick={() => setSelectedId(rec.lcId)}
                            className={`cursor-pointer transition ${
                              isSelected
                                ? "bg-slate-100/90"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="py-3.5 px-4 font-mono">
                              <div className="font-semibold text-slate-900">
                                {rec.invoiceCode}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                ID #{rec.lcId}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                              <div>
                                Exp: {rec.exporter.slice(0, 6)}...
                                {rec.exporter.slice(-4)}
                              </div>
                              <div className="text-slate-400">
                                Car: {rec.carrier.slice(0, 6)}...
                                {rec.carrier.slice(-4)}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900">
                              {rec.totalAmount} {symbol}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                              {rec.lockedEscrow} {symbol}
                            </td>
                            <td className="py-3.5 px-4">
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

            {/* Right 5 Columns: Instrument Dossier & Settlement Operations */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
              {!selectedRecord ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Select a Letter of Credit from the ledger to inspect details and execute lifecycle operations.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {/* Dossier Header */}
                  <div className="p-5 flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-mono uppercase text-slate-400">
                        Instrument Dossier • ID #{selectedRecord.lcId}
                      </span>
                      <h3 className="text-base font-semibold text-slate-900 font-mono mt-0.5">
                        {selectedRecord.invoiceCode}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        (STATUS_META[selectedRecord.state] || STATUS_META[0])
                          .badge
                      }`}
                    >
                      {
                        (STATUS_META[selectedRecord.state] || STATUS_META[0])
                          .label
                      }
                    </span>
                  </div>

                  {/* Lifecycle Progress Stepper */}
                  <div className="px-5 py-4 bg-slate-50/60">
                    <div className="grid grid-cols-4 gap-2 text-[11px]">
                      {[
                        { s: 1, title: "1. Issued (30%)" },
                        { s: 2, title: "2. e-BoL Signed" },
                        { s: 3, title: "3. Factoring" },
                        { s: 4, title: "4. Settled (70%)" },
                      ].map((item) => {
                        const currentStep = (
                          STATUS_META[selectedRecord.state] || STATUS_META[0]
                        ).step;
                        const active = currentStep >= item.s;
                        return (
                          <div key={item.s} className="space-y-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                active ? "bg-slate-900" : "bg-slate-200"
                              }`}
                            />
                            <span
                              className={`block font-medium ${
                                active ? "text-slate-900" : "text-slate-400"
                              }`}
                            >
                              {item.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Financial Tranche Breakdown */}
                  <div className="p-5 space-y-3 text-xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Capital Allocation &amp; Beneficiary Rights
                    </div>
                    <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-md border border-slate-200/80 font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans">
                          Total Commitment
                        </span>
                        <span className="font-semibold text-slate-900">
                          {selectedRecord.totalAmount} {symbol}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans">
                          Disbursed Advance (30%)
                        </span>
                        <span className="font-semibold text-emerald-700">
                          {selectedRecord.advancePaid} {symbol}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans">
                          Escrow Reserve (70%)
                        </span>
                        <span className="font-semibold text-blue-700">
                          {selectedRecord.lockedEscrow} {symbol}
                        </span>
                      </div>
                    </div>

                    <dl className="space-y-2 pt-2 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Importer (Applicant):</dt>
                        <dd className="font-mono text-slate-800">
                          {selectedRecord.buyer.slice(0, 10)}...
                          {selectedRecord.buyer.slice(-6)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Exporter (Supplier):</dt>
                        <dd className="font-mono text-slate-800">
                          {selectedRecord.exporter.slice(0, 10)}...
                          {selectedRecord.exporter.slice(-6)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Designated Carrier:</dt>
                        <dd className="font-mono text-slate-800">
                          {selectedRecord.carrier.slice(0, 10)}...
                          {selectedRecord.carrier.slice(-6)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">
                          70% Vault Beneficiary:
                        </dt>
                        <dd className="font-mono font-semibold text-slate-900">
                          {selectedRecord.beneficiary.slice(0, 10)}...
                          {selectedRecord.beneficiary.slice(-6)}
                          {selectedRecord.state === 2 && " (Assignee)"}
                        </dd>
                      </div>
                      {selectedRecord.eBoLHash && (
                        <div className="pt-2 border-t border-slate-100">
                          <dt className="text-slate-500 mb-1">
                            Electronic Bill of Lading (SHA-256 Digest):
                          </dt>
                          <dd className="font-mono text-[11px] bg-slate-100 px-2.5 py-1.5 rounded text-slate-800 break-all">
                            {selectedRecord.eBoLHash}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Role-Based Execution Controls */}
                  <div className="p-5 space-y-4 bg-slate-50/40">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Available Settlement &amp; Document Actions
                    </div>

                    {/* Action A: Carrier e-BoL Attestation (when state == 0) */}
                    {selectedRecord.state === 0 && (
                      <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3">
                        <div className="text-xs font-semibold text-slate-900">
                          Logistics Carrier: Register Bill of Lading (e-BoL)
                        </div>
                        <p className="text-xs text-slate-500">
                          Attach the shipping document to run AI compliance verification, compute its SHA-256 checksum, and anchor proof of dispatch on MST Blockchain.
                        </p>
                        <input
                          type="file"
                          onChange={(e) =>
                            handleDocumentUpload(e.target.files?.[0])
                          }
                          className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-slate-300 file:bg-slate-50 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-100"
                        />
                        {bolFileName && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            Document: {bolFileName}
                          </div>
                        )}
                        {aiReport && (
                          <div className="bg-emerald-50/80 border border-emerald-200 rounded p-2.5 text-[11px] space-y-1">
                            <div className="flex items-center justify-between font-semibold text-emerald-900">
                              <span>
                                ✓ AI Compliance Oracle: {aiReport.documentType}
                              </span>
                              <span className="font-mono bg-emerald-200/70 px-1.5 py-0.5 rounded text-emerald-950">
                                {aiReport.complianceScore}
                              </span>
                            </div>
                            <div className="text-emerald-800">
                              {aiReport.summary}
                            </div>
                            <div className="font-mono text-[10px] text-emerald-700">
                              Route: {aiReport.vesselAndPort}
                            </div>
                          </div>
                        )}
                        <input
                          type="text"
                          placeholder="SHA-256 Document Digest (0x...)"
                          value={bolInput}
                          onChange={(e) => setBolInput(e.target.value)}
                          className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono bg-white"
                        />
                        <button
                          onClick={() =>
                            handleAttestShipment(selectedRecord.lcId)
                          }
                          disabled={isSubmitting}
                          className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-md transition"
                        >
                          Anchor Bill of Lading On-Chain
                        </button>
                      </div>
                    )}

                    {/* Action B: Exporter Receivable Factoring (when state == 1 and not listed) */}
                    {selectedRecord.state === 1 &&
                      !selectedRecord.isListedForFactoring && (
                        <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3">
                          <div className="text-xs font-semibold text-slate-900">
                            Exporter Treasury: Discount Receivable for Early Liquidity
                          </div>
                          <p className="text-xs text-slate-500">
                            Offer your locked{" "}
                            <span className="font-mono font-semibold text-slate-800">
                              {selectedRecord.lockedEscrow} {symbol}
                            </span>{" "}
                            receivable to liquidity providers at a discount for immediate settlement.
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.0001"
                              placeholder={`Ask Price (e.g. ${(
                                Number(selectedRecord.lockedEscrow) * 0.95
                              ).toFixed(4)})`}
                              value={discountInput}
                              onChange={(e) => setDiscountInput(e.target.value)}
                              className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono bg-white"
                            />
                            <button
                              onClick={() =>
                                handleListReceivable(
                                  selectedRecord.lcId,
                                  discountInput ||
                                    (
                                      Number(selectedRecord.lockedEscrow) * 0.95
                                    ).toFixed(4)
                                )
                              }
                              disabled={isSubmitting}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-4 py-1.5 rounded-md transition"
                            >
                              List on Exchange
                            </button>
                          </div>
                        </div>
                      )}

                    {/* Action C: Financier Buyout (when listed for factoring) */}
                    {selectedRecord.state === 1 &&
                      selectedRecord.isListedForFactoring && (
                        <div className="bg-indigo-50/60 border border-indigo-200 rounded-md p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-indigo-950">
                              Receivable Available for Immediate Financing
                            </span>
                            <span className="text-[11px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                              Yield:{" "}
                              {(
                                Number(selectedRecord.lockedEscrow) -
                                Number(selectedRecord.factoringPrice)
                              ).toFixed(4)}{" "}
                              {symbol}
                            </span>
                          </div>
                          <p className="text-xs text-indigo-900/80">
                            Disburse{" "}
                            <strong className="font-mono">
                              {selectedRecord.factoringPrice} {symbol}
                            </strong>{" "}
                            to the Exporter today to acquire 100% claim on the{" "}
                            <strong className="font-mono">
                              {selectedRecord.lockedEscrow} {symbol}
                            </strong>{" "}
                            escrow vault upon delivery.
                          </p>
                          <button
                            onClick={() =>
                              handlePurchaseReceivable(
                                selectedRecord.lcId,
                                selectedRecord.factoringPrice
                              )
                            }
                            disabled={isSubmitting}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-2 rounded-md transition"
                          >
                            Settle Buyout ({selectedRecord.factoringPrice}{" "}
                            {symbol})
                          </button>
                        </div>
                      )}

                    {/* Action D: Final Port Delivery & Release (when state == 1 or 2) */}
                    {(selectedRecord.state === 1 ||
                      selectedRecord.state === 2) && (
                      <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3">
                        <div className="text-xs font-semibold text-slate-900">
                          Customs / Importer: Final Delivery Acceptance
                        </div>
                        <p className="text-xs text-slate-500">
                          Confirm cargo arrival to release the{" "}
                          <span className="font-mono font-medium text-slate-800">
                            {selectedRecord.lockedEscrow} {symbol}
                          </span>{" "}
                          escrow reserve to the current beneficiary.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleSettleDelivery(selectedRecord.lcId)
                            }
                            disabled={isSubmitting}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 rounded-md transition"
                          >
                            Confirm Arrival &amp; Release Vault
                          </button>
                          <button
                            onClick={() =>
                              handleDisputeHold(selectedRecord.lcId)
                            }
                            disabled={isSubmitting}
                            className="border border-red-300 text-red-700 hover:bg-red-50 text-xs font-medium px-3 py-2 rounded-md transition"
                          >
                            Place Hold
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action E: On-Chain Arbitration Resolution (when state == 4) */}
                    {selectedRecord.state === 4 && (
                      <div className="bg-red-50/70 border border-red-200 rounded-md p-4 space-y-3">
                        <div className="text-xs font-semibold text-red-900">
                          Arbitration Hold Active — Arbiter Settlement Required
                        </div>
                        <p className="text-xs text-red-800">
                          The 70% escrow reserve ({selectedRecord.lockedEscrow}{" "}
                          {symbol}) is frozen on-chain. The designated protocol Arbiter can release funds to the Beneficiary or refund the Importer.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleResolveDispute(selectedRecord.lcId, true)
                            }
                            disabled={isSubmitting}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium py-2 rounded-md transition"
                          >
                            Release to Beneficiary
                          </button>
                          <button
                            onClick={() =>
                              handleResolveDispute(selectedRecord.lcId, false)
                            }
                            disabled={isSubmitting}
                            className="flex-1 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium py-2 rounded-md transition"
                          >
                            Refund Importer
                          </button>
                        </div>
                      </div>
                    )}

                    {(selectedRecord.state === 3 ||
                      selectedRecord.state === 5) && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3.5 text-xs text-emerald-900">
                        This Letter of Credit has been fulfilled and 100% of escrowed funds have been settled on-chain.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: ISSUE NEW LETTER OF CREDIT */}
        {activeNav === "issue" && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Issue Programmable Letter of Credit
                </h2>
                <p className="text-xs text-slate-500">
                  Capital is locked in the MST smart contract vault: 30% is routed immediately to the Exporter, and 70% is held pending carrier attestation.
                </p>
              </div>
              {account && (
                <button
                  type="button"
                  onClick={() => {
                    setExporterInput(account);
                    setCarrierInput(account);
                    setReferenceInput(
                      `LC-2026-${Math.floor(1000 + Math.random() * 9000)}`
                    );
                  }}
                  className="text-xs text-blue-700 hover:text-blue-900 font-medium underline"
                >
                  Use Connected Wallet for Counterparties
                </button>
              )}
            </div>

            <form onSubmit={handleIssueLC} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Commercial Invoice / LC Reference
                  </label>
                  <input
                    type="text"
                    required
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Commitment Value ({symbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Beneficiary Exporter Wallet Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={exporterInput}
                  onChange={(e) => setExporterInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Authorized Logistics Carrier Wallet Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={carrierInput}
                  onChange={(e) => setCarrierInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Smart Contract Settlement Schedule
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Immediate Manufacturing Advance (30%):</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {(Number(amountInput || 0) * 0.3).toFixed(4)} {symbol}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Escrow Reserve Locked Until Delivery (70%):</span>
                  <span className="font-mono font-semibold text-blue-700">
                    {(Number(amountInput || 0) * 0.7).toFixed(4)} {symbol}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveNav("ledger")}
                  className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-md transition"
                >
                  {isSubmitting
                    ? "Authorizing On-Chain..."
                    : `Authorize & Lock ${amountInput} ${symbol}`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW 3: RECEIVABLES FACTORING EXCHANGE */}
        {activeNav === "factoring" && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Verified Trade Receivables Exchange
              </h2>
              <p className="text-xs text-slate-500">
                Institutional liquidity providers can purchase carrier-attested export receivables at a discount and receive full escrow settlement upon cargo arrival.
              </p>
            </div>

            {openFactoringList.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No verified trade receivables are currently listed for secondary factoring.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-5">Instrument</th>
                    <th className="py-3 px-5">Exporter</th>
                    <th className="py-3 px-5">e-BoL Proof</th>
                    <th className="py-3 px-5 text-right">Escrow Claim (70%)</th>
                    <th className="py-3 px-5 text-right">Buyout Ask</th>
                    <th className="py-3 px-5 text-right">Net Spread</th>
                    <th className="py-3 px-5 text-right">Execution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {openFactoringList.map((item) => {
                    const spread =
                      Number(item.lockedEscrow) - Number(item.factoringPrice);
                    return (
                      <tr key={item.lcId} className="hover:bg-slate-50">
                        <td className="py-3.5 px-5 font-mono font-semibold text-slate-900">
                          {item.invoiceCode} (#{item.lcId})
                        </td>
                        <td className="py-3.5 px-5 font-mono text-slate-600">
                          {item.exporter.slice(0, 8)}...{item.exporter.slice(-4)}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-slate-500">
                          {item.eBoLHash.slice(0, 16)}...
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono font-medium text-slate-900">
                          {item.lockedEscrow} {symbol}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono font-semibold text-indigo-700">
                          {item.factoringPrice} {symbol}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono text-emerald-700">
                          +{spread.toFixed(4)} {symbol}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() =>
                              handlePurchaseReceivable(
                                item.lcId,
                                item.factoringPrice
                              )
                            }
                            disabled={isSubmitting}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-1.5 rounded transition"
                          >
                            Acquire Claim
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* VIEW 4: SMART CONTRACT AUDIT LOG */}
        {activeNav === "explorer" && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  On-Chain Settlement &amp; Verification Log
                </h2>
                <p className="text-xs text-slate-500">
                  Live indexed events and verifiable transactions on MSTScan Explorer ({explorer}).
                </p>
              </div>
              <a
                href={`${explorer}/address/${net.contractAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-blue-700 hover:underline"
              >
                Open Contract on MSTScan ↗
              </a>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-5">Block / Status</th>
                  <th className="py-3 px-5">Lifecycle Operation</th>
                  <th className="py-3 px-5">Transaction Hash</th>
                  <th className="py-3 px-5 text-right">Explorer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {txHistory.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3.5 px-5 font-mono text-slate-500">
                      {item.timestamp}
                    </td>
                    <td className="py-3.5 px-5 font-medium text-slate-900">
                      {item.action}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-600">
                      {item.hash}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <a
                        href={`${explorer}/tx/${item.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline font-medium"
                      >
                        Verify on MSTScan ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}