// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MSTTradeProtocol
 * @notice Programmable Letter of Credit (e-LC), On-Chain Bill of Lading & RWA Invoice Factoring on MST Blockchain
 */
contract MSTTradeProtocol {
    enum TradeState { 
        Created,           // 0: Buyer locked 100% MSTC (30% paid to Exporter, 70% locked)
        ShippedOnChain,    // 1: Carrier signed Electronic Bill of Lading (eBoL) on-chain
        InvoiceFactored,   // 2: Exporter sold 70% locked receivable to MST Liquidity Provider
        DeliveredSettled,  // 3: Final 70% settled to current Beneficiary
        Disputed,          // 4: Frozen for Arbiter resolution
        Resolved           // 5: Settled by Arbiter
    }

    struct LetterOfCredit {
        uint256 lcId;
        address payable buyer;
        address payable exporter;
        address carrier;               
        address payable beneficiary;   // Initially Exporter; updates to Liquidity Provider if factored
        string invoiceCode;
        uint256 totalAmount;
        uint256 advancePaid;
        uint256 lockedEscrow;          // 70% locked in contract
        uint256 factoringPrice;        // Discounted buyout price in MSTC
        bool isListedForFactoring;
        string eBoLHash;               // Cryptographic Bill of Lading hash signed on-chain
        TradeState state;
        uint256 createdAt;
    }

    uint256 public nextLcId = 1;
    address public arbiter;
    mapping(uint256 => LetterOfCredit) public lettersOfCredit;

    event LOCOpened(uint256 indexed lcId, address indexed buyer, address indexed exporter, string invoiceCode, uint256 totalAmount, uint256 advancePaid);
    event ShipmentAttestedOnChain(uint256 indexed lcId, address indexed carrier, string eBoLHash);
    event InvoiceListedForFactoring(uint256 indexed lcId, uint256 lockedEscrow, uint256 buyoutPrice);
    event InvoiceFactoredOnChain(uint256 indexed lcId, address indexed exporter, address indexed liquidityProvider, uint256 buyoutPaid);
    event DeliveryConfirmedAndSettled(uint256 indexed lcId, address indexed finalBeneficiary, uint256 payoutAmount);
    event DisputeRaised(uint256 indexed lcId, address indexed raisedBy, string reason);
    event DisputeResolved(uint256 indexed lcId, address indexed winner, uint256 amount);

    constructor(address _arbiter) {
        arbiter = _arbiter;
    }

    // TX 1: Buyer opens Programmable Letter of Credit (30% auto-sent to Exporter, 70% locked in vault)
    function createLetterOfCredit(
        address payable _exporter,
        address _carrier,
        string memory _invoiceCode
    ) external payable returns (uint256) {
        require(msg.value > 0, "Must lock MSTC in Letter of Credit");
        require(_exporter != address(0) && _carrier != address(0), "Invalid participant addresses");

        uint256 advance = (msg.value * 30) / 100;
        uint256 locked = msg.value - advance;

        uint256 id = nextLcId++;
        lettersOfCredit[id] = LetterOfCredit({
            lcId: id,
            buyer: payable(msg.sender),
            exporter: _exporter,
            carrier: _carrier,
            beneficiary: _exporter,
            invoiceCode: _invoiceCode,
            totalAmount: msg.value,
            advancePaid: advance,
            lockedEscrow: locked,
            factoringPrice: 0,
            isListedForFactoring: false,
            eBoLHash: "",
            state: TradeState.Created,
            createdAt: block.timestamp
        });

        (bool sent, ) = _exporter.call{value: advance}("");
        require(sent, "Advance MSTC transfer failed");

        emit LOCOpened(id, msg.sender, _exporter, _invoiceCode, msg.value, advance);
        return id;
    }

    // TX 2: Logistics Carrier attests Bill of Lading hash on-chain
    function confirmShipmentByCarrier(uint256 _lcId, string memory _eBoLHash) external {
        LetterOfCredit storage lc = lettersOfCredit[_lcId];
        require(lc.state == TradeState.Created, "Order not awaiting shipment");
        require(msg.sender == lc.carrier, "Only designated Carrier wallet can attest shipment");

        lc.eBoLHash = _eBoLHash;
        lc.state = TradeState.ShippedOnChain;

        emit ShipmentAttestedOnChain(_lcId, msg.sender, _eBoLHash);
    }

    // TX 3: Exporter lists locked 70% receivable for instant RWA Invoice Factoring
    function listInvoiceForFactoring(uint256 _lcId, uint256 _discountedPrice) external {
        LetterOfCredit storage lc = lettersOfCredit[_lcId];
        require(lc.state == TradeState.ShippedOnChain, "Shipment must be attested by Carrier first");
        require(msg.sender == lc.exporter, "Only Exporter can list invoice");
        require(_discountedPrice > 0 && _discountedPrice < lc.lockedEscrow, "Discount price must be less than locked escrow");

        lc.factoringPrice = _discountedPrice;
        lc.isListedForFactoring = true;

        emit InvoiceListedForFactoring(_lcId, lc.lockedEscrow, _discountedPrice);
    }

    // TX 4: Liquidity Provider buys the factored invoice on-chain
    function buyFactoredInvoice(uint256 _lcId) external payable {
        LetterOfCredit storage lc = lettersOfCredit[_lcId];
        require(lc.state == TradeState.ShippedOnChain && lc.isListedForFactoring, "Invoice not listed for factoring");
        require(msg.value == lc.factoringPrice, "Send exact factoring buyout amount in MSTC");

        address payable originalExporter = lc.exporter;
        lc.beneficiary = payable(msg.sender);
        lc.isListedForFactoring = false;
        lc.state = TradeState.InvoiceFactored;

        (bool sent, ) = originalExporter.call{value: msg.value}("");
        require(sent, "Factoring buyout transfer failed");

        emit InvoiceFactoredOnChain(_lcId, originalExporter, msg.sender, msg.value);
    }

    // TX 5: Buyer or Carrier confirms arrival -> Contract pays 70% vault to current Beneficiary
    function confirmDeliveryAndSettle(uint256 _lcId) external {
        LetterOfCredit storage lc = lettersOfCredit[_lcId];
        require(
            lc.state == TradeState.ShippedOnChain || lc.state == TradeState.InvoiceFactored,
            "Shipment not in active transit"
        );
        require(msg.sender == lc.buyer || msg.sender == lc.carrier, "Only Buyer or Carrier can confirm delivery");

        uint256 payout = lc.lockedEscrow;
        lc.lockedEscrow = 0;
        lc.state = TradeState.DeliveredSettled;

        (bool sent, ) = lc.beneficiary.call{value: payout}("");
        require(sent, "Final settlement transfer failed");

        emit DeliveryConfirmedAndSettled(_lcId, lc.beneficiary, payout);
    }

    // TX 6: On-Chain Dispute & Arbiter Resolution
    function raiseDispute(uint256 _lcId, string memory _reason) external {
        LetterOfCredit storage lc = lettersOfCredit[_lcId];
        require(lc.state != TradeState.DeliveredSettled && lc.state != TradeState.Resolved, "Already settled");
        require(msg.sender == lc.buyer || msg.sender == lc.exporter, "Only trade parties can raise dispute");

        lc.state = TradeState.Disputed;
        emit DisputeRaised(_lcId, msg.sender, _reason);
    }

    function resolveDispute(uint256 _lcId, bool _releaseToBeneficiary) external {
        LetterOfCredit storage lc = lettersOfCredit[_lcId];
        require(msg.sender == arbiter, "Only Arbiter can resolve");
        require(lc.state == TradeState.Disputed, "Order is not disputed");

        uint256 amount = lc.lockedEscrow;
        lc.lockedEscrow = 0;
        lc.state = TradeState.Resolved;

        address payable winner = _releaseToBeneficiary ? lc.beneficiary : lc.buyer;
        (bool sent, ) = winner.call{value: amount}("");
        require(sent, "Dispute payout failed");

        emit DisputeResolved(_lcId, winner, amount);
    }

    // Helper: Fetch all Letters of Credit for the Frontend Dashboard
    function getAllLettersOfCredit() external view returns (LetterOfCredit[] memory) {
        uint256 total = nextLcId - 1;
        LetterOfCredit[] memory list = new LetterOfCredit[](total);
        for (uint256 i = 1; i <= total; i++) {
            list[i - 1] = lettersOfCredit[i];
        }
        return list;
    }
}