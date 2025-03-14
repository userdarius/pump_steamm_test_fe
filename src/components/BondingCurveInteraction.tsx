import React, { useState, useEffect } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { getOwnedTokens } from "../utils/suiUtils";
import { bcs } from "@mysten/sui/bcs";

// Define types for transaction results and events
interface SuiEvent {
  type: string;
  parsedJson?: {
    bonding_curve_id?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface TransactionEffects {
  events?: SuiEvent[];
  [key: string]: any;
}

interface TransactionResult {
  digest?: string;
  effects?: TransactionEffects;
  [key: string]: any;
}

type TokenInfo = {
  id: string;
  balance: bigint;
};

const BondingCurveInteraction: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // Default to the package ID from pump_steamm
  const [packageId, setPackageId] = useState(
    "0xa97e62009dfb93f3ee1e5600bfa225739f332f05483ef4f77005a8c5591f4ff0"
  );

  const [bondingCurveId, setBondingCurveId] = useState("");
  const [coinTypeArg, setCoinTypeArg] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [txResult, setTxResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [ownedTokens, setOwnedTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>("");

  // Added state for token creation
  const [registryId, setRegistryId] = useState("");
  const [tokenFactoryId, setTokenFactoryId] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");

  // Fetch user's tokens when address or coin type changes
  useEffect(() => {
    const fetchTokens = async () => {
      if (currentAccount && coinTypeArg) {
        try {
          const tokens = await getOwnedTokens(
            currentAccount.address,
            coinTypeArg
          );
          setOwnedTokens(tokens);
          if (tokens.length > 0) {
            setSelectedToken(tokens[0].id);
          }
        } catch (error) {
          console.error("Error fetching tokens:", error);
        }
      }
    };

    fetchTokens();
  }, [currentAccount, coinTypeArg]);

  // Function to create a new bonding curve
  const createBondingCurve = async () => {
    if (
      !packageId ||
      !registryId ||
      !tokenFactoryId ||
      !tokenName ||
      !tokenSymbol ||
      !tokenDescription
    ) {
      setTxResult("Please fill in all required token information");
      return;
    }

    try {
      setLoading(true);
      setTxResult("Creating bonding curve...");

      // Create a direct transaction with a simple approach
      const tx = new Transaction();
      tx.setGasBudget(100000000);

      // First, get the transaction context's address as a string
      const sender = currentAccount?.address || "";

      // Log parameters we're using for clarity
      console.log("Using parameters:");
      console.log("- Package ID:", packageId);
      console.log("- Registry ID:", registryId);
      console.log("- Token Factory ID:", tokenFactoryId);
      console.log("- Token name:", tokenName);
      console.log("- Token symbol:", tokenSymbol);
      console.log("- Token description:", tokenDescription);

      // Convert strings to byte arrays
      const nameBytes = Array.from(new TextEncoder().encode(tokenName));
      const symbolBytes = Array.from(new TextEncoder().encode(tokenSymbol));
      const descBytes = Array.from(new TextEncoder().encode(tokenDescription));

      // Use create_unique_token function which now requires token factory
      tx.moveCall({
        target: `${packageId}::bonding_curve::create_unique_token`,
        arguments: [
          tx.object(registryId),
          tx.pure.vector("u8", nameBytes),
          tx.pure.vector("u8", symbolBytes),
          tx.pure.vector("u8", descBytes),
          tx.object(tokenFactoryId),
        ],
      });

      console.log("Transaction built:", tx);

      signAndExecuteTransaction(
        {
          transaction: tx.serialize(),
        },
        {
          onSuccess: (result) => {
            handleTransactionSuccess(result);
            setLoading(false);
          },
          onError: (error) => {
            handleTransactionError(error);
            setLoading(false);
          },
        }
      );
    } catch (error) {
      handleTransactionError(error);
      setLoading(false);
    }
  };

  const handleTransactionSuccess = (result: any) => {
    setTxResult(JSON.stringify(result, null, 2));

    // Try to extract bonding curve ID and coin type from events
    try {
      if (result.effects?.events) {
        // Look for NewBondingCurveResult event
        const newBondingCurveEvent = result.effects.events.find(
          (event: SuiEvent) =>
            event.type.includes("::bonding_curve::NewBondingCurveResult")
        );

        if (newBondingCurveEvent?.parsedJson?.bonding_curve_id) {
          setBondingCurveId(newBondingCurveEvent.parsedJson.bonding_curve_id);
          console.log(
            "Found bonding curve ID:",
            newBondingCurveEvent.parsedJson.bonding_curve_id
          );

          // Extract the coin type from the event
          if (newBondingCurveEvent?.parsedJson?.coin_type) {
            // Convert to proper coin type format
            const rawType = newBondingCurveEvent.parsedJson.coin_type;
            console.log("Raw coin type:", rawType);

            // Extract the relevant part for frontend use
            const typeParts = rawType.split("::");
            if (typeParts.length === 3) {
              const coinTypeFormatted = `${packageId}::${typeParts[2]}`;
              setCoinTypeArg(coinTypeFormatted);
              console.log("Set coin type to:", coinTypeFormatted);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error parsing transaction result:", error);
    }
  };

  const handleTransactionError = (error: any) => {
    console.error("Transaction error:", error);

    let errorMessage = "Transaction failed";

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      errorMessage = error.message || error.toString() || JSON.stringify(error);
    } else if (error !== null && error !== undefined) {
      errorMessage = String(error);
    }

    // Try to extract SUI error details
    try {
      const errorJson = JSON.parse(errorMessage);
      if (errorJson.data && errorJson.data.errors) {
        errorMessage = errorJson.data.errors
          .map((e: any) => e.message || JSON.stringify(e))
          .join(", ");
      }
    } catch (e) {
      // Not a JSON error, use the original message
    }

    setTxResult(`Error: ${errorMessage}`);
  };

  // Function to buy tokens
  const buyTokens = async () => {
    if (!packageId || !bondingCurveId || !Number(buyAmount)) {
      setTxResult("Please fill all fields for buying tokens");
      return;
    }

    try {
      setLoading(true);
      setTxResult("Buying tokens...");

      const tx = new Transaction();
      // Convert to 9 decimals (consistent with the updated contract)
      const amount = Math.floor(Number(buyAmount) * 1000000000);

      // Create SUI coin for payment
      const [coin] = tx.splitCoins(tx.gas, [amount]);

      // Call the buy function
      tx.moveCall({
        target: `${packageId}::bonding_curve::buy`,
        typeArguments: [coinTypeArg],
        arguments: [tx.object(bondingCurveId), coin],
      });

      signAndExecuteTransaction(
        {
          transaction: tx.serialize(),
        },
        {
          onSuccess: (result) => {
            setTxResult(JSON.stringify(result, null, 2));
            refreshTokens(); // Refresh token list after successful purchase
            setLoading(false);
          },
          onError: (error) => {
            handleTransactionError(error);
            setLoading(false);
          },
        }
      );
    } catch (error) {
      handleTransactionError(error);
      setLoading(false);
    }
  };

  // Function to sell tokens
  const sellTokens = async () => {
    if (
      !packageId ||
      !bondingCurveId ||
      !Number(sellAmount) ||
      !selectedToken
    ) {
      setTxResult("Please fill all fields for selling tokens");
      return;
    }

    try {
      setLoading(true);
      setTxResult("Selling tokens...");

      const tx = new Transaction();
      // Convert to 9 decimals (consistent with the updated contract)
      const amount = Math.floor(Number(sellAmount) * 1000000000);

      // Use the selected token object ID
      // Create a coin object with the amount to sell
      const [tokenCoin] = tx.splitCoins(tx.object(selectedToken), [amount]);

      // Call the sell function
      tx.moveCall({
        target: `${packageId}::bonding_curve::sell`,
        typeArguments: [coinTypeArg],
        arguments: [tx.object(bondingCurveId), tokenCoin],
      });

      signAndExecuteTransaction(
        {
          transaction: tx.serialize(),
        },
        {
          onSuccess: (result) => {
            setTxResult(JSON.stringify(result, null, 2));
            refreshTokens(); // Refresh token list after successful sale
            setLoading(false);
          },
          onError: (error) => {
            handleTransactionError(error);
            setLoading(false);
          },
        }
      );
    } catch (error) {
      handleTransactionError(error);
      setLoading(false);
    }
  };

  // Function to refresh token list
  const refreshTokens = async () => {
    if (currentAccount && coinTypeArg) {
      try {
        setLoading(true);
        const tokens = await getOwnedTokens(
          currentAccount.address,
          coinTypeArg
        );
        setOwnedTokens(tokens);
        if (tokens.length > 0) {
          setSelectedToken(tokens[0].id);
        }
        setTxResult("Token list refreshed");
        setLoading(false);
      } catch (error) {
        setTxResult(
          `Error refreshing tokens: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        setLoading(false);
      }
    }
  };

  if (!currentAccount) {
    return <div>Please connect your wallet first</div>;
  }

  return (
    <div>
      <h2>Bonding Curve Interaction</h2>

      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          border: "1px solid #ddd",
          borderRadius: "5px",
        }}
      >
        <h3>Configuration</h3>
        <div>
          <label htmlFor="packageId">Package ID:</label>
          <input
            id="packageId"
            type="text"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
      </div>

      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          border: "1px solid #ddd",
          borderRadius: "5px",
        }}
      >
        <h3>Create New Bonding Curve</h3>
        <div>
          <label htmlFor="registryId">Registry ID:</label>
          <input
            id="registryId"
            type="text"
            value={registryId}
            onChange={(e) => setRegistryId(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <div>
          <label htmlFor="tokenFactoryId">Token Factory ID:</label>
          <input
            id="tokenFactoryId"
            type="text"
            value={tokenFactoryId}
            onChange={(e) => setTokenFactoryId(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <div>
          <label htmlFor="tokenName">Token Name:</label>
          <input
            id="tokenName"
            type="text"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <div>
          <label htmlFor="tokenSymbol">Token Symbol:</label>
          <input
            id="tokenSymbol"
            type="text"
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <div>
          <label htmlFor="tokenDescription">Token Description:</label>
          <input
            id="tokenDescription"
            type="text"
            value={tokenDescription}
            onChange={(e) => setTokenDescription(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <button
          onClick={createBondingCurve}
          disabled={loading}
          style={{
            padding: "10px 20px",
            backgroundColor: loading ? "#ccc" : "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Processing..." : "Create Token & Bonding Curve"}
        </button>
      </div>

      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          border: "1px solid #ddd",
          borderRadius: "5px",
        }}
      >
        <h3>Interact with Existing Bonding Curve</h3>
        <div>
          <label htmlFor="bondingCurveId">Bonding Curve ID:</label>
          <input
            id="bondingCurveId"
            type="text"
            value={bondingCurveId}
            onChange={(e) => setBondingCurveId(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <div>
          <label htmlFor="coinTypeArg">Coin Type (e.g. 0x...::xxx):</label>
          <input
            id="coinTypeArg"
            type="text"
            value={coinTypeArg}
            onChange={(e) => setCoinTypeArg(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="buyAmount">Buy Amount (SUI):</label>
            <input
              id="buyAmount"
              type="number"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              style={{ width: "100%" }}
            />
            <button
              onClick={buyTokens}
              disabled={loading}
              style={{
                padding: "5px 10px",
                backgroundColor: loading ? "#ccc" : "#0070f3",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: "5px",
              }}
            >
              {loading ? "Processing..." : "Buy Tokens"}
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="sellAmount">Sell Amount (Tokens):</label>
            <input
              id="sellAmount"
              type="number"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              style={{ width: "100%" }}
            />
            {ownedTokens.length > 0 && (
              <select
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                style={{ width: "100%", marginTop: "5px" }}
              >
                {ownedTokens.map((token) => (
                  <option key={token.id} value={token.id}>
                    {token.id.substring(0, 8)}... (
                    {Number(token.balance) / 1000000000} tokens)
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={sellTokens}
              disabled={loading || ownedTokens.length === 0}
              style={{
                padding: "5px 10px",
                backgroundColor:
                  loading || ownedTokens.length === 0 ? "#ccc" : "#0070f3",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor:
                  loading || ownedTokens.length === 0
                    ? "not-allowed"
                    : "pointer",
                marginTop: "5px",
              }}
            >
              {loading ? "Processing..." : "Sell Tokens"}
            </button>
          </div>
        </div>
        <button
          onClick={refreshTokens}
          disabled={loading || !coinTypeArg}
          style={{
            padding: "5px 10px",
            backgroundColor: loading || !coinTypeArg ? "#ccc" : "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: loading || !coinTypeArg ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Processing..." : "Refresh Token List"}
        </button>
      </div>

      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          border: "1px solid #ddd",
          borderRadius: "5px",
        }}
      >
        <h3>Owned Tokens</h3>
        {ownedTokens.length > 0 ? (
          <ul>
            {ownedTokens.map((token) => (
              <li key={token.id}>
                ID: {token.id.substring(0, 12)}...{" "}
                <strong>
                  Balance: {Number(token.balance) / 1000000000} tokens
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>No tokens found. Buy some tokens first!</p>
        )}
      </div>

      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          border: "1px solid #ddd",
          borderRadius: "5px",
          maxHeight: "300px",
          overflow: "auto",
        }}
      >
        <h3>Transaction Result</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{txResult}</pre>
      </div>
    </div>
  );
};

export default BondingCurveInteraction;
