# MST Trade Treasury — Programmable Letters of Credit (e-LC) & RWA Receivables Exchange

An institutional Trade Finance, Programmable Letter of Credit (e-LC), and Real-World Asset (RWA) Receivables Factoring protocol built natively on the **MST Blockchain** for **MST Blockchain Buildathon 2.0**.

---

## 🔗 On-Chain Deployment & Verification (MST Blockchain)

| Network | Chain ID | Contract Address | Explorer Link |
| :--- | :--- | :--- | :--- |
| **MST Testnet** | `91562037` | `0x7469FaD978c171B7da28CaAB2B8eF3D171Ae4f74` | [View Contract on Testnet MSTScan](https://testnet.mstscan.com/address/0x7469FaD978c171B7da28CaAB2B8eF3D171Ae4f74) |
| **MST Mainnet** | `4646` | `0x7469FaD978c171B7da28CaAB2B8eF3D171Ae4f74` *(Testnet Active)* | [MSTScan Explorer](https://mstscan.com) |

### Verifiable On-Chain Lifecycle Transactions (`testnet.mstscan.com`)
Every core state transition of the smart contract has been executed and verified on the MST Blockchain:

1. **Smart Contract Deployment:** [`0x1b2b6262f8c39857dc80c54d09c4b963df7c224eaf9ff17764298b5da9c83965`](https://testnet.mstscan.com/tx/0x1b2b6262f8c39857dc80c54d09c4b963df7c224eaf9ff17764298b5da9c83965)
2. **Issue Letter of Credit #1 & Auto-Disburse 30% Advance (`createLetterOfCredit`):** [`0x9591dd00318091a94698ac635641560bd65371069eecc90ceb60ff8107821b80`](https://testnet.mstscan.com/tx/0x9591dd00318091a94698ac635641560bd65371069eecc90ceb60ff8107821b80)
3. **Logistics Carrier e-BoL SHA-256 Attestation (`confirmShipmentByCarrier`):** [`0x08c6d3aff2c3f39fc5e5daccd0a0190f73fa3fd9477e19c277a76b1ff5367312`](https://testnet.mstscan.com/tx/0x08c6d3aff2c3f39fc5e5daccd0a0190f73fa3fd9477e19c277a76b1ff5367312)
4. **Exporter Lists 70% Escrow Receivable for RWA Factoring (`listInvoiceForFactoring`):** [`0x24d413857f1388d00870e18adb4a26404d370cfd3a6f49a683343cbbffd22a57`](https://testnet.mstscan.com/tx/0x24d413857f1388d00870e18adb4a26404d370cfd3a6f49a683343cbbffd22a57)
5. **Liquidity Provider Acquires Factored Receivable (`buyFactoredInvoice`):** [`0x53d5dff4bdaa6d7444364359cf1322a460b28938b7fadc738e89edf7e2daa7c8`](https://testnet.mstscan.com/tx/0x53d5dff4bdaa6d7444364359cf1322a460b28938b7fadc738e89edf7e2daa7c8)
6. **Final Port Arrival & 70% Escrow Vault Settlement (`confirmDeliveryAndSettle`):** [`0x62d8b334acf31663d9f5f1e3a0f77e2791d062e44ca1d64e53f202650c6479c2`](https://testnet.mstscan.com/tx/0x62d8b334acf31663d9f5f1e3a0f77e2791d062e44ca1d64e53f202650c6479c2)
7. **Active Letter of Credit #2 for Live Judge Testing (`LC-2026-9042`):** [`0x74373cc71f88ea2496d1221a090231f76b979f5531848186d4c3a3ab241ee9d4`](https://testnet.mstscan.com/tx/0x74373cc71f88ea2496d1221a090231f76b979f5531848186d4c3a3ab241ee9d4)

---

## 🎯 Problem Statement
Indian MSME exporters face severe working-capital bottlenecks in domestic and cross-border B2B trade:
* **30–60 Day Settlement Delays:** Traditional bank Letters of Credit (LC) require weeks of paper verification and charge 5–8% in intermediary fees.
* **Counterparty Default Risk:** Exporters risk non-payment after dispatching goods, while importers risk paying upfront without cryptographic proof of shipment.
* **Trapped Capital During Transit:** 70% of invoice capital remains locked while cargo is at sea, starving manufacturers of liquidity for subsequent orders.

---

## 💡 Solution & Why Blockchain is Core
Cross-border trade involves four mutually distrusting parties (Importer, Exporter, Logistics Carrier, and Liquidity Provider) who cannot rely on a single centralized Web2 administrator to hold custody of funds or reassign financial claims.

**MST Trade Treasury** enforces the entire trade lifecycle inside a single Solidity state machine (`contracts/MSTTradeProtocol.sol`):
1. **30/70 Programmable Escrow Vault:** Importer locks `MSTC` on-chain; the contract immediately disburses a **30% manufacturing advance** to the Exporter and holds **70% in escrow**.
2. **Cryptographic Bill of Lading (e-BoL) & AI Compliance Check:** Logistics Carrier uploads the shipping Bill of Lading, verifies compliance via `/api/verify-bol`, and signs the SHA-256 document digest on-chain.
3. **Secondary RWA Receivables Exchange (DeFi Factoring):** Once shipment is attested on-chain, the Exporter can list their locked 70% receivable at a discount. Any liquidity provider on MST Blockchain can purchase the claim on-chain (`buyFactoredInvoice`), giving the Exporter instant cash while the smart contract atomically reassigns the `beneficiary` payout address to the financier.
4. **Automated Delivery Settlement & Arbitration Hold:** Confirming cargo arrival releases the 70% reserve directly to the active beneficiary, while discrepancies trigger an on-chain arbitration freeze (`raiseDispute`).

---

## 🛡️ Security Considerations & Known Limitations
* **Security Controls:** Role-based access modifiers (`msg.sender == lc.carrier`, `msg.sender == lc.exporter`, `msg.sender == arbiter`), Checks-Effects-Interactions (CEI) pattern (zeroing `lockedEscrow = 0` and updating state prior to external `.call{value}("")` transfers to prevent re-entrancy), and SHA-256 document digest anchoring.
* **Known Limitations:** Currently settles in native `MSTC`/`tMSTC` and uses a single designated arbiter address for dispute resolution. Future iterations will support ERC-20 stablecoin vaults and multi-sig arbiter quorums.

---

## 🚀 Local Setup & Deployment

```bash
git clone [https://github.com/NavnathSagar/mst-trade-protocol.git](https://github.com/NavnathSagar/mst-trade-protocol.git)
cd mst-trade-protocol
npm install
npm run dev