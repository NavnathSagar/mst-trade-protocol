import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const ABI = [
  "function confirmShipmentByCarrier(uint256 _lcId, string memory _eBoLHash) external",
  "function listInvoiceForFactoring(uint256 _lcId, uint256 _discountedPrice) external",
  "function confirmDeliveryAndSettle(uint256 _lcId) external",
];

export async function POST(req: NextRequest) {
  try {
    const { action, lcId, eBoLHash, askAmount, networkMode } = await req.json();
    const relayerKey = process.env.PRIVATE_KEY;

    if (!relayerKey) {
      return NextResponse.json(
        { error: "Relayer PRIVATE_KEY not configured on server" },
        { status: 500 }
      );
    }

    const rpcUrl =
      networkMode === "mainnet"
        ? "https://mariorpc.mstblockchain.com/"
        : "https://testnetrpc.mstblockchain.com";
    const contractAddr =
      process.env.NEXT_PUBLIC_TESTNET_CONTRACT_ADDRESS ||
      "0x7469FaD978c171B7da28CaAB2B8eF3D171Ae4f74";

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const relayerWallet = new ethers.Wallet(relayerKey, provider);
    const contract = new ethers.Contract(contractAddr, ABI, relayerWallet);

    let tx;
    if (action === "attestBol") {
      tx = await contract.confirmShipmentByCarrier(lcId, eBoLHash);
    } else if (action === "listFactoring") {
      tx = await contract.listInvoiceForFactoring(lcId, ethers.parseEther(askAmount));
    } else if (action === "settleDelivery") {
      tx = await contract.confirmDeliveryAndSettle(lcId);
    } else {
      return NextResponse.json({ error: "Unsupported relayer action" }, { status: 400 });
    }

    await tx.wait();
    return NextResponse.json({
      success: true,
      relayerAddress: relayerWallet.address,
      txHash: tx.hash,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.reason || err.message || "Relayer execution failed" },
      { status: 500 }
    );
  }
}