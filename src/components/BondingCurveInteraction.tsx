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

  // Default to the package ID from pump_steamm_copy
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
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [tokenTypeArg, setTokenTypeArg] = useState(""); // Keep this for internal use
  const [moduleName, setModuleName] = useState(""); // New state for module name

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
      console.log("- Token name:", tokenName);
      console.log("- Token symbol:", tokenSymbol);
      console.log("- Token description:", tokenDescription);

      // Convert strings to byte arrays
      const nameBytes = Array.from(new TextEncoder().encode(tokenName));
      const symbolBytes = Array.from(new TextEncoder().encode(tokenSymbol));
      const descBytes = Array.from(new TextEncoder().encode(tokenDescription));

      // Updated to use the pump_steamm_copy contract interface
      tx.moveCall({
        target: `${packageId}::bonding_curve::create_unique_token`,
        arguments: [
          tx.object(registryId),
          tx.pure.vector("u8", nameBytes),
          tx.pure.vector("u8", symbolBytes),
          tx.pure.vector("u8", descBytes),
        ],
      });

      console.log("Transaction built:", tx);

      signAndExecuteTransaction(
        {
          transaction: tx.serialize(),
        },
        {
          onSuccess: (result) => {
            setTxResult(JSON.stringify(result, null, 2));
            handleTransactionSuccess(result);
            setLoading(false);
          },
          onError: (error) => {
            handleTransactionError(error);

            // Add more specific error information for debugging
            console.error("Full transaction error:", error);

            // If we're still getting errors, try advising the user about the CLI approach
            const errorStr = String(error);
            if (errorStr.includes("VMVerificationOrDeserializationError")) {
              setTxResult(
                (prevResult) =>
                  prevResult +
                  "\n\nIf the above method fails, try using the Sui CLI with:\n\nsui client call --package " +
                  packageId +
                  " --module bonding_curve --function create_unique_token --args " +
                  registryId +
                  ' "[' +
                  nameBytes +
                  ']" "[' +
                  symbolBytes +
                  ']" "[' +
                  descBytes +
                  ']"'
              );
            }
            setLoading(false);
          },
        }
      );
    } catch (error) {
      handleTransactionError(error);
      setLoading(false);
    }
  };

  // Helper function to handle transaction success
  const handleTransactionSuccess = (result: any) => {
    try {
      // Cast the result to our TransactionResult type
      const txResult = result as unknown as TransactionResult;
      // Look for the NewBondingCurveResult event in the transaction effects
      const events = txResult.effects?.events || [];
      console.log("Transaction events:", events);

      // Look for bonding curve events from pump_steamm_copy
      const bondingCurveEvent = events.find(
        (event: SuiEvent) =>
          event.type &&
          (event.type.includes("::bonding_curve::NewBondingCurveResult") ||
            event.type.includes("::bonding_curve::TokenCreated"))
      );

      if (bondingCurveEvent && bondingCurveEvent.parsedJson) {
        // Extract bonding curve ID - field name might be bonding_curve_id or token_id depending on event
        const bondingCurveId =
          bondingCurveEvent.parsedJson.bonding_curve_id ||
          bondingCurveEvent.parsedJson.token_id;

        const coinType =
          bondingCurveEvent.parsedJson.coin_type ||
          bondingCurveEvent.parsedJson.token_type;

        if (bondingCurveId) {
          setBondingCurveId(bondingCurveId);

          // If we have the coin_type in the event, use that
          if (coinType) {
            setCoinTypeArg(coinType);
            setTokenTypeArg(coinType);
          } else {
            // Otherwise use our best guess based on the package ID
            const generatedType = `${packageId}::bonding_curve::TokenWitness`;
            setCoinTypeArg(generatedType);
            setTokenTypeArg(generatedType);
          }

          setTxResult(
            `Bonding curve created successfully with ID: ${bondingCurveId}`
          );

          // Attempt to refresh token list in case any were minted
          setTimeout(() => {
            refreshTokens();
          }, 2000); // Small delay to allow blockchain to update
        }
      }
    } catch (error) {
      console.error("Error extracting bonding curve ID:", error);
    }
  };

  // Helper function to handle transaction errors
  const handleTransactionError = (error: any) => {
    console.error("Transaction error details:", error);

    // Provide a more detailed error message
    let errorMessage = "Error executing transaction";

    if (error instanceof Error) {
      errorMessage = `Error: ${error.message}`;

      // Check for Sui-specific error properties
      if ("cause" in error) {
        const causeObj = error.cause as any;
        errorMessage += `\nCause: ${JSON.stringify(error.cause)}`;

        // Extract error details if they exist
        if (causeObj?.data?.error) {
          errorMessage += `\nSUI Error: ${causeObj.data.error}`;
        }

        // Look for specific VMVerificationOrDeserializationError patterns
        if (
          typeof causeObj === "string" &&
          causeObj.includes("VMVerificationOrDeserializationError")
        ) {
          errorMessage += `\nDetailed VM Error: ${causeObj}`;
        }
      }

      // Check for code property which often contains useful error info
      if ("code" in error && (error as any).code) {
        errorMessage += `\nError Code: ${(error as any).code}`;
      }
    } else {
      errorMessage = `Error: ${String(error)}`;
    }

    setTxResult(errorMessage);
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
      const amount = Math.floor(Number(buyAmount) * 1000000000);

      // Create SUI coin for payment
      const [coin] = tx.splitCoins(tx.gas, [amount]);

      // Call the buy function - the interface is the same in pump_steamm_copy
      tx.moveCall({
        target: `${packageId}::bonding_curve::buy`,
        typeArguments: [coinTypeArg],
        arguments: [tx.object(bondingCurveId), coin],
      });

      // Serialize transaction to string to avoid type conflicts
      const serializedTx = tx.serialize();

      signAndExecuteTransaction(
        {
          transaction: serializedTx,
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
      const amount = Math.floor(Number(sellAmount) * 1000000000);

      // Use the selected token object ID
      // Create a coin object with the amount to sell
      const [tokenCoin] = tx.splitCoins(tx.object(selectedToken), [amount]);

      // Call the sell function - the interface is the same in pump_steamm_copy
      tx.moveCall({
        target: `${packageId}::bonding_curve::sell`,
        typeArguments: [coinTypeArg],
        arguments: [tx.object(bondingCurveId), tokenCoin],
      });

      // Serialize transaction to string to avoid type conflicts
      const serializedTx = tx.serialize();

      signAndExecuteTransaction(
        {
          transaction: serializedTx,
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
          backgroundColor: "#f8f9fa",
          borderRadius: "5px",
        }}
      >
        <p style={{ fontSize: "14px", color: "#444", marginBottom: "10px" }}>
          This interface allows you to interact with the pump_steamm_copy
          bonding curve contracts. You can create new tokens, buy tokens with
          SUI, and sell tokens back to the bonding curve.
        </p>
        <p style={{ fontSize: "14px", color: "#444", marginBottom: "0" }}>
          The bonding curve uses a constant product formula (x * y = k) to
          determine token prices, with virtual reserves to establish the initial
          price curve.
        </p>
      </div>

      <div>
        <h3>Contract Information</h3>
        <div>
          <label>
            Package ID:
            <input
              type="text"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              placeholder="Enter package ID"
            />
            <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
              Default: pump_steamm_copy package ID
            </div>
          </label>
        </div>
        <div>
          <label>
            Bonding Curve ID:
            <input
              type="text"
              value={bondingCurveId}
              onChange={(e) => setBondingCurveId(e.target.value)}
              placeholder="Enter bonding curve object ID"
              readOnly={true}
              title="This will be automatically populated after creating a token"
              style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
            />
            {!bondingCurveId && (
              <div
                style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}
              >
                This will be automatically populated after creating a token
              </div>
            )}
          </label>
        </div>
        <div>
          <label>
            Coin Type Argument:
            <input
              type="text"
              value={coinTypeArg}
              onChange={(e) => setCoinTypeArg(e.target.value)}
              placeholder="Enter coin type argument (e.g., 0x2::sui::SUI)"
              readOnly={true}
              title="This will be automatically populated to match the token type"
              style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
            />
            {!coinTypeArg && (
              <div
                style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}
              >
                This will be automatically set to match the token type
              </div>
            )}
          </label>
        </div>
      </div>

      <div>
        <h3>Create Bonding Curve</h3>
        <div style={{ marginBottom: "15px", fontSize: "14px", color: "#444" }}>
          Create a new token with the pump_steamm_copy bonding curve contract.
          Each token will have a unique ID in the system.
        </div>
        <div>
          <label>
            Registry ID:
            <input
              type="text"
              value={registryId}
              onChange={(e) => setRegistryId(e.target.value)}
              placeholder="Enter registry object ID"
            />
            <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
              The registry object ID from the pump_steamm_copy package
              deployment
            </div>
          </label>
        </div>
        <div>
          <label>
            Token Name:
            <input
              type="text"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="Enter token name"
            />
          </label>
        </div>
        <div>
          <label>
            Token Symbol:
            <input
              type="text"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value)}
              placeholder="Enter token symbol"
            />
          </label>
        </div>
        <div>
          <label>
            Token Description:
            <input
              type="text"
              value={tokenDescription}
              onChange={(e) => setTokenDescription(e.target.value)}
              placeholder="Enter token description"
            />
          </label>
        </div>
        <button onClick={createBondingCurve} disabled={loading}>
          Create Bonding Curve
        </button>
      </div>

      <div>
        <h3>Buy Tokens</h3>
        <div>
          <label>
            SUI Amount:
            <input
              type="number"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              placeholder="Enter SUI amount"
            />
          </label>
        </div>
        <button onClick={buyTokens} disabled={loading}>
          Buy Tokens
        </button>
      </div>

      <div>
        <h3>Sell Tokens</h3>
        <div>
          <label>
            Select Token:
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              disabled={ownedTokens.length === 0}
            >
              {ownedTokens.length === 0 ? (
                <option value="">No tokens available</option>
              ) : (
                ownedTokens.map((token) => (
                  <option key={token.id} value={token.id}>
                    {token.id} (Balance: {Number(token.balance) / 1000000000}{" "}
                    tokens)
                  </option>
                ))
              )}
            </select>
          </label>
          <button onClick={refreshTokens} disabled={loading}>
            Refresh Tokens
          </button>
        </div>
        <div>
          <label>
            Token Amount:
            <input
              type="number"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              placeholder="Enter token amount"
            />
          </label>
        </div>
        <button
          onClick={sellTokens}
          disabled={loading || ownedTokens.length === 0}
        >
          Sell Tokens
        </button>
      </div>

      <div>
        <h3>Transaction Result</h3>
        <pre style={{ maxHeight: "300px", overflow: "auto" }}>{txResult}</pre>
      </div>
    </div>
  );
};

export default BondingCurveInteraction;
