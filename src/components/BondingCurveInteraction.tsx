import React, { useState, useEffect } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { getOwnedTokens } from "../utils/suiUtils";

// Define types for transaction results and events
interface SuiEvent {
  type: string;
  parsedJson?: {
    bonding_curve_id?: string;
    coin_type?: string;
    sui_amount?: string;
    tokens_minted?: string;
    token_amount?: string;
    sui_received?: string;
    virtual_sui_reserves?: string;
    virtual_token_reserves?: string;
    [key: string]: any;
  };
}

// Use a generic interface that allows for different structures
interface TransactionResult {
  digest?: string;
  effects?: any; // Using any here to accommodate different response structures
  [key: string]: any;
}

type TokenInfo = {
  id: string;
  balance: bigint;
};

const BondingCurveInteraction: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // State for contract interaction
  const [packageId, setPackageId] = useState(
    "0xfe67289f3d0176e30f2cde3de83b7e42aeccf2a18b79f1d36c3b41dd983fcf41"
  );
  const [registryId, setRegistryId] = useState("");
  const [bondingCurveId, setBondingCurveId] = useState("");
  const [coinTypeArg, setCoinTypeArg] = useState("");

  // State for token objects
  const [treasuryCapId, setTreasuryCapId] = useState("");
  const [metadataId, setMetadataId] = useState("");

  // State for token creation
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");

  // State for token transactions
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [ownedTokens, setOwnedTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>("");

  // UI state
  const [txResult, setTxResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [transactionType, setTransactionType] = useState("create"); // create, buy, sell

  // Stats for display
  const [virtualSuiReserves, setVirtualSuiReserves] = useState<string>("0");
  const [virtualTokenReserves, setVirtualTokenReserves] = useState<string>("0");
  const [hasTransitioned, setHasTransitioned] = useState(false);

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

  // Function to create a new token with bonding curve
  const createTokenWithCurve = async () => {
    if (!packageId || !registryId || !treasuryCapId || !metadataId) {
      setTxResult(
        "Please fill in all required fields: Package ID, Registry ID, Treasury Cap ID, and Metadata ID"
      );
      return;
    }

    try {
      setLoading(true);
      setTxResult("Binding token to bonding curve...");

      const tx = new Transaction();
      tx.setGasBudget(100000000);

      tx.moveCall({
        target: `${packageId}::bonding_curve::bind_token_to_curve`,
        typeArguments: [
          "0x0db1ec658bf451e0c1cf4fb11714d00e7981db93dd0e5c055725f4f08b31b576::test_token::TEST_TOKEN",
        ],
        arguments: [
          tx.object(registryId), // registry: &mut Registry
          tx.object(treasuryCapId), // treasury_cap: TreasuryCap<T>
          tx.object(metadataId), // metadata: CoinMetadata<T>
        ],
      });

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
      // Convert to 9 decimals (consistent with the contract)
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
            handleTransactionSuccess(result);
            refreshTokens();
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
      !selectedToken ||
      !Number(sellAmount)
    ) {
      setTxResult("Please fill all fields for selling tokens");
      return;
    }

    // Ensure the coinTypeArg is set before selling
    if (!coinTypeArg) {
      setTxResult("Coin type is not set. Please enter a valid coin type.");
      return;
    }

    try {
      setLoading(true);
      setTxResult("Selling tokens...");

      const tx = new Transaction();
      // Convert to 9 decimals (consistent with the contract)
      const amount = Math.floor(Number(sellAmount) * 1000000000);

      // Split the selected token
      const tokenObj = tx.object(selectedToken);
      const [tokenToSell] = tx.splitCoins(tokenObj, [amount]);

      // Call the sell function
      tx.moveCall({
        target: `${packageId}::bonding_curve::sell`,
        typeArguments: [coinTypeArg],
        arguments: [tx.object(bondingCurveId), tokenToSell],
      });

      signAndExecuteTransaction(
        {
          transaction: tx.serialize(),
        },
        {
          onSuccess: (result) => {
            handleTransactionSuccess(result);
            refreshTokens();
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

    // Process transaction events to extract information
    try {
      // Handle the potential different structure of the effects property
      const events =
        result.effects?.events ||
        (typeof result.effects === "string"
          ? JSON.parse(result.effects).events
          : []);

      if (events && events.length > 0) {
        // Handle NewBondingCurveResult event
        const newBondingCurveEvent = events.find((event: SuiEvent) =>
          event.type.includes("::bonding_curve::NewBondingCurveResult")
        );

        if (newBondingCurveEvent?.parsedJson?.bonding_curve_id) {
          setBondingCurveId(newBondingCurveEvent.parsedJson.bonding_curve_id);

          // Extract coin type from event
          if (newBondingCurveEvent?.parsedJson?.coin_type) {
            const rawType = newBondingCurveEvent.parsedJson.coin_type;
            const typeParts = rawType.split("::");
            if (typeParts.length === 3) {
              const coinTypeFormatted = `${typeParts[0]}::${typeParts[1]}::${typeParts[2]}`;
              setCoinTypeArg(coinTypeFormatted);
            }
          }
        }

        // Handle BuyResult event
        const buyEvent = events.find((event: SuiEvent) =>
          event.type.includes("::bonding_curve::BuyResult")
        );

        if (buyEvent?.parsedJson) {
          // Update UI with buy information if available
          if (
            buyEvent.parsedJson.sui_amount &&
            buyEvent.parsedJson.tokens_minted
          ) {
            setTxResult(
              `Successfully bought ${
                Number(buyEvent.parsedJson.tokens_minted) / 1000000000
              } tokens for ${
                Number(buyEvent.parsedJson.sui_amount) / 1000000000
              } SUI`
            );
          }
        }

        // Handle SellResult event
        const sellEvent = events.find((event: SuiEvent) =>
          event.type.includes("::bonding_curve::SellResult")
        );

        if (sellEvent?.parsedJson) {
          // Update UI with sell information if available
          if (
            sellEvent.parsedJson.token_amount &&
            sellEvent.parsedJson.sui_received
          ) {
            setTxResult(
              `Successfully sold ${
                Number(sellEvent.parsedJson.token_amount) / 1000000000
              } tokens for ${
                Number(sellEvent.parsedJson.sui_received) / 1000000000
              } SUI`
            );
          }
        }

        // Handle TransitionToAMMResult event
        const transitionEvent = events.find((event: SuiEvent) =>
          event.type.includes("::bonding_curve::TransitionToAMMResult")
        );

        if (transitionEvent?.parsedJson) {
          setHasTransitioned(true);
          if (transitionEvent.parsedJson.virtual_sui_reserves) {
            setVirtualSuiReserves(
              transitionEvent.parsedJson.virtual_sui_reserves
            );
          }
          if (transitionEvent.parsedJson.virtual_token_reserves) {
            setVirtualTokenReserves(
              transitionEvent.parsedJson.virtual_token_reserves
            );
          }
          setTxResult(
            `Bonding curve has transitioned to AMM mode with ${
              Number(transitionEvent.parsedJson.virtual_sui_reserves) /
              1000000000
            } SUI and ${
              Number(transitionEvent.parsedJson.virtual_token_reserves) /
              1000000000
            } tokens`
          );
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

    setTxResult(`Error: ${errorMessage}`);
  };

  const refreshTokens = async () => {
    if (currentAccount && coinTypeArg) {
      try {
        console.log("Refreshing tokens with coin type:", coinTypeArg);
        const tokens = await getOwnedTokens(
          currentAccount.address,
          coinTypeArg
        );
        console.log("Found tokens:", tokens);
        setOwnedTokens(tokens);
        if (tokens.length > 0) {
          setSelectedToken(tokens[0].id);
        } else {
          console.log(
            "No tokens found for address",
            currentAccount.address,
            "with coin type",
            coinTypeArg
          );
        }
      } catch (error) {
        console.error("Error refreshing tokens:", error);
      }
    } else {
      console.log(
        "Cannot refresh tokens: ",
        currentAccount ? "Missing coin type" : "Missing account"
      );
    }
  };

  // Format token balance for display
  const formatBalance = (balance: bigint): string => {
    return (Number(balance) / 1000000000).toFixed(9);
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        borderRadius: "8px",
        backgroundColor: "white",
      }}
    >
      <h2
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: "20px",
        }}
      >
        Bonding Curve Interaction
      </h2>

      {/* Transaction result display */}
      {txResult && (
        <div
          style={{
            marginBottom: "20px",
            padding: "10px",
            backgroundColor: "#f7f7f7",
            borderRadius: "6px",
            textAlign: "center",
          }}
        >
          <p>{txResult}</p>
        </div>
      )}

      {/* Bonding Curve Stats */}
      {(virtualSuiReserves !== "0" || virtualTokenReserves !== "0") && (
        <div
          style={{
            marginBottom: "20px",
            padding: "15px",
            backgroundColor: "#ebf5ff",
            borderRadius: "6px",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              textAlign: "center",
              marginBottom: "10px",
            }}
          >
            Bonding Curve Stats
          </h3>
          <div
            style={{ display: "flex", justifyContent: "center", gap: "20px" }}
          >
            <p>Virtual SUI Reserves: {virtualSuiReserves} SUI</p>
            <p>Virtual Token Reserves: {virtualTokenReserves} Tokens</p>
          </div>
        </div>
      )}

      {/* Transaction Type Selector */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <button
          style={{
            padding: "8px 16px",
            borderRadius: "4px",
            backgroundColor:
              transactionType === "create" ? "#2563eb" : "#e5e7eb",
            color: transactionType === "create" ? "white" : "black",
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => {
            setTransactionType("create");
          }}
        >
          Create Token
        </button>
        <button
          style={{
            padding: "8px 16px",
            borderRadius: "4px",
            backgroundColor: transactionType === "buy" ? "#2563eb" : "#e5e7eb",
            color: transactionType === "buy" ? "white" : "black",
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => {
            setTransactionType("buy");
          }}
        >
          Buy Tokens
        </button>
        <button
          style={{
            padding: "8px 16px",
            borderRadius: "4px",
            backgroundColor: transactionType === "sell" ? "#2563eb" : "#e5e7eb",
            color: transactionType === "sell" ? "white" : "black",
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => {
            setTransactionType("sell");
            refreshTokens(); // Refresh tokens when switching to sell mode
          }}
        >
          Sell Tokens
        </button>
      </div>

      {/* Create Token Form */}
      {transactionType === "create" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              textAlign: "center",
              marginBottom: "10px",
            }}
          >
            Create Token
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Package ID
              </label>
              <input
                type="text"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                placeholder="Package ID"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Registry ID
              </label>
              <input
                type="text"
                value={registryId}
                onChange={(e) => setRegistryId(e.target.value)}
                placeholder="Registry ID"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Treasury Cap ID
              </label>
              <input
                type="text"
                value={treasuryCapId}
                onChange={(e) => setTreasuryCapId(e.target.value)}
                placeholder="Treasury Cap ID"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Metadata ID
              </label>
              <input
                type="text"
                value={metadataId}
                onChange={(e) => setMetadataId(e.target.value)}
                placeholder="Metadata ID"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Token Name (Display Only)
              </label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="Token Name"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Token Symbol (Display Only)
              </label>
              <input
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                placeholder="Token Symbol"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Token Description (Display Only)
              </label>
              <input
                type="text"
                value={tokenDescription}
                onChange={(e) => setTokenDescription(e.target.value)}
                placeholder="Token Description"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          <div style={{ textAlign: "center", fontSize: "14px", color: "#666" }}>
            <p>
              Note: Token name, symbol, and description are for display purposes
              only. The actual values are already set in the metadata object.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              onClick={createTokenWithCurve}
              disabled={loading}
              style={{
                padding: "10px 20px",
                backgroundColor: loading ? "#9ca3af" : "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating..." : "Bind Token to Curve"}
            </button>
          </div>
        </div>
      )}

      {/* Buy Tokens Form */}
      {transactionType === "buy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              textAlign: "center",
              marginBottom: "10px",
            }}
          >
            Buy Tokens
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Bonding Curve ID
              </label>
              <input
                type="text"
                value={bondingCurveId}
                onChange={(e) => setBondingCurveId(e.target.value)}
                placeholder="Bonding Curve ID"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Coin Type
              </label>
              <input
                type="text"
                value={coinTypeArg}
                onChange={(e) => setCoinTypeArg(e.target.value)}
                placeholder="Coin Type"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          <div style={{ maxWidth: "400px", margin: "0 auto" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Amount of SUI to spend
            </label>
            <div style={{ display: "flex" }}>
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="SUI Amount"
                step="0.000000001"
                min="0"
                style={{
                  flexGrow: 1,
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRight: "none",
                  borderRadius: "4px 0 0 4px",
                }}
              />
              <span
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "0 4px 4px 0",
                }}
              >
                SUI
              </span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              onClick={buyTokens}
              disabled={loading || hasTransitioned}
              style={{
                padding: "10px 20px",
                backgroundColor:
                  loading || hasTransitioned ? "#9ca3af" : "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: loading || hasTransitioned ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Buying..." : "Buy Tokens"}
            </button>
          </div>

          {hasTransitioned && (
            <div style={{ textAlign: "center", color: "#d97706" }}>
              <p>
                This bonding curve has transitioned to AMM mode and buying is no
                longer available.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sell Tokens Form */}
      {transactionType === "sell" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              textAlign: "center",
              marginBottom: "10px",
            }}
          >
            Sell Tokens
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Bonding Curve ID
              </label>
              <input
                type="text"
                value={bondingCurveId}
                onChange={(e) => setBondingCurveId(e.target.value)}
                placeholder="Bonding Curve ID"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Coin Type
              </label>
              <input
                type="text"
                value={coinTypeArg}
                onChange={(e) => {
                  setCoinTypeArg(e.target.value);
                  // Schedule a refresh after the state updates
                  setTimeout(refreshTokens, 100);
                }}
                placeholder="Coin Type"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          <div style={{ maxWidth: "400px", margin: "0 auto" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "500",
                textAlign: "center",
              }}
            >
              Your Tokens ({ownedTokens.length})
            </label>
            {ownedTokens.length > 0 ? (
              <select
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              >
                {ownedTokens.map((token) => (
                  <option key={token.id} value={token.id}>
                    {token.id} - Balance: {formatBalance(token.balance)}
                  </option>
                ))}
              </select>
            ) : (
              <p style={{ textAlign: "center", color: "#666" }}>
                No tokens found of type {coinTypeArg || "[Type not specified]"}
              </p>
            )}
          </div>

          <div style={{ maxWidth: "400px", margin: "0 auto" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Amount of Tokens to Sell
            </label>
            <div style={{ display: "flex" }}>
              <input
                type="number"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                placeholder="Token Amount"
                step="0.000000001"
                min="0"
                style={{
                  flexGrow: 1,
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRight: "none",
                  borderRadius: "4px 0 0 4px",
                }}
              />
              <span
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "0 4px 4px 0",
                }}
              >
                Tokens
              </span>
            </div>
          </div>

          <div
            style={{ display: "flex", justifyContent: "center", gap: "10px" }}
          >
            <button
              onClick={sellTokens}
              disabled={loading}
              style={{
                padding: "10px 20px",
                backgroundColor: loading ? "#9ca3af" : "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Selling..." : "Sell Tokens"}
            </button>

            <button
              onClick={refreshTokens}
              style={{
                padding: "10px 20px",
                backgroundColor: "#e5e7eb",
                color: "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Refresh Token List
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BondingCurveInteraction;
