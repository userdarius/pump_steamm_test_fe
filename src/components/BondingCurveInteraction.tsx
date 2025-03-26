import React, { useState, useEffect } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { getOwnedTokens } from "../utils/suiUtils";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import {
  SuiObjectChange,
  SuiTransactionBlockResponse,
} from "@mysten/sui/client";
import init, {
  update_constants,
  update_identifiers,
} from "@mysten/move-bytecode-template";
import { bcs } from "@mysten/sui/bcs";
import { SuiClient } from "@mysten/sui/client";
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
    "0xdd718c698ebfb995e2ca740fd5c9ac625fe748b0a5e1e76db3ee629641688881"
  );
  const [registryId, setRegistryId] = useState(
    "0x7cd97809c61e369a592901d0b1c34520342e55325742420beae271d031c193f6"
  );
  const [bondingCurveId, setBondingCurveId] = useState("");
  const [coinTypeArg, setCoinTypeArg] = useState("");

  // State for token objects
  const [treasuryCapId, setTreasuryCapId] = useState("");
  const [metadataId, setMetadataId] = useState("");

  // State for token creation
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [customCoinType, setCustomCoinType] = useState("");

  // State for token transactions
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [ownedTokens, setOwnedTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>("");

  // UI state
  const [txResult, setTxResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [transactionType, setTransactionType] = useState("create"); // create, buy, sell
  const [transactionStatus, setTransactionStatus] = useState<
    "idle" | "loading" | "confirmed" | "failed"
  >("idle");
  const [transactionDigest, setTransactionDigest] = useState<string>("");
  const [transactionError, setTransactionError] = useState<string>("");

  // Stats for display
  const [virtualSuiReserves, setVirtualSuiReserves] = useState<string>("0");
  const [virtualTokenReserves, setVirtualTokenReserves] = useState<string>("0");
  const [hasTransitioned, setHasTransitioned] = useState(false);

  // WASM initialization state
  const [wasmInitialized, setWasmInitialized] = useState(false);

  // Initialize WASM module when component mounts
  useEffect(() => {
    const initWasm = async () => {
      try {
        console.log("Starting WASM module initialization...");

        // Use a try-catch to specifically catch and log WebAssembly-related errors
        try {
          await init();
          console.log("WASM module initialized successfully");
          setWasmInitialized(true);
        } catch (wasmError: any) {
          console.error("WebAssembly initialization error:", wasmError);

          // Try with a manual fallback approach if needed
          if (wasmError.message && wasmError.message.includes("MIME type")) {
            console.warn(
              "MIME type issue detected, attempting manual fallback..."
            );
            setTxResult(
              "WebAssembly module had MIME type issues. Contact the developer to fix the server configuration."
            );
          } else {
            setTxResult(
              `WebAssembly initialization failed: ${
                wasmError.message || "Unknown error"
              }`
            );
          }
        }
      } catch (error: any) {
        console.error("Failed to initialize WASM module:", error);
        setTxResult(
          `Failed to initialize WebAssembly module: ${
            error.message || "Unknown error"
          }. Please refresh the page and try again.`
        );
      }
    };

    initWasm();
  }, []);

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

  // Helper function to sign and execute a transaction
  const signAndExecute = async (
    transaction: Transaction,
    options?: { auction?: boolean }
  ): Promise<SuiTransactionBlockResponse> => {
    return new Promise((resolve, reject) => {
      signAndExecuteTransaction(
        {
          transaction: transaction.serialize(),
        },
        {
          onSuccess: (result) =>
            resolve(result as unknown as SuiTransactionBlockResponse),
          onError: (error) => reject(error),
        }
      );
    });
  };

  const createCoin = async (bytecode: Uint8Array<ArrayBufferLike>) => {
    const client = new SuiClient({
      url: "https://fullnode.testnet.sui.io:443",
    });
    const transaction = new Transaction();

    const [upgradeCap] = transaction.publish({
      modules: [[...bytecode]],
      dependencies: [normalizeSuiAddress("0x1"), normalizeSuiAddress("0x2")],
    });
    transaction.transferObjects(
      [upgradeCap],
      transaction.pure.address(currentAccount?.address!)
    );

    const res = await signAndExecute(transaction);

    const res2 = await client.waitForTransaction({
      digest: res.digest,
      options: {
        showBalanceChanges: true,
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });

    // Debug: Log transaction result details
    console.log("Transaction successful! Digest:", res2.digest);
    console.log("Transaction effects:", res2.effects);
    console.log("Transaction object changes:", res2.objectChanges);

    // Get TreasuryCap id from transaction
    const treasuryCapObjectChange: SuiObjectChange | undefined =
      res2.objectChanges?.find(
        (change) =>
          change.type === "created" && change.objectType.includes("TreasuryCap")
      );
    if (!treasuryCapObjectChange)
      throw new Error("TreasuryCap object change not found");
    if (treasuryCapObjectChange.type !== "created")
      throw new Error("TreasuryCap object change is not of type 'created'");

    // Get CoinMetadata id from transaction
    const coinMetaObjectChange: SuiObjectChange | undefined =
      res2.objectChanges?.find(
        (change) =>
          change.type === "created" &&
          change.objectType.includes("CoinMetadata")
      );
    if (!coinMetaObjectChange)
      throw new Error("CoinMetadata object change not found");
    if (coinMetaObjectChange.type !== "created")
      throw new Error("CoinMetadata object change is not of type 'created'");

    const treasuryCapId = treasuryCapObjectChange.objectId;
    const coinType = treasuryCapObjectChange.objectType
      .split("<")[1]
      .split(">")[0];
    const coinMetadataId = coinMetaObjectChange.objectId;

    console.log(
      "coinType:",
      coinType,
      "treasuryCapId:",
      treasuryCapId,
      "coinMetadataId:",
      coinMetadataId
    );

    return { treasuryCapId, coinType, coinMetadataId };
  };

  // Helper function to create token bytecode
  const createTokenBytecode = async (
    tokenName: string,
    tokenSymbol: string,
    tokenDescription: string,
    moduleNameForToken: string,
    structNameForToken: string
  ): Promise<Uint8Array> => {
    if (!wasmInitialized) {
      throw new Error(
        "WASM module is not initialized yet. Please check the console for errors and try refreshing the page."
      );
    }

    // For debugging
    console.log("Creating bytecode with parameters:", {
      tokenName,
      tokenSymbol,
      tokenDescription,
      moduleNameForToken,
      structNameForToken,
    });

    try {
      // Use bytecode from TEST_TOKEN which properly transfers metadata to sender
      const bytecode = Buffer.from(
        "oRzrCwYAAAAKAQAMAgweAyocBEYIBU5GB5QBpQEIuQJgBpkDCAqhAwUMpgMpAA4BCwIGAg8CEAIRAAICAAEBBwEAAAIADAEAAQIDDAEAAQQEAgAFBQcAAAkAAQABCgEEAQACBwYHAQIDDAsBAQwEDQgJAAEDAgUDCgMCAggABwgEAAELAgEIAAEIBQELAQEJAAEIAAcJAAIKAgoCCgILAQEIBQcIBAILAwEJAAsCAQkAAQYIBAEFAQsDAQgAAgkABQxDb2luTWV0YWRhdGEGT3B0aW9uClRFU1RfVE9LRU4LVHJlYXN1cnlDYXAJVHhDb250ZXh0A1VybARjb2luD2NyZWF0ZV9jdXJyZW5jeQtkdW1teV9maWVsZARpbml0BG5vbmUGb3B0aW9uD3B1YmxpY190cmFuc2ZlcgZzZW5kZXIKdGVzdF90b2tlbgh0cmFuc2Zlcgp0eF9jb250ZXh0A3VybAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgoCBQRURVNUAAIBCAEAAAAAAhMLADEJBwAHAAcAOAAKATgBDAIKAS4RBDgCCwILAS4RBDgDAgA=",
        "base64"
      );

      console.log(
        "Bytecode loaded from Base64 string, proceeding with updates..."
      );

      // Replace the module and struct names in the bytecode
      // Update from TEST_TOKEN to the user's token name
      let updated = update_identifiers(bytecode, {
        TEST_TOKEN: structNameForToken,
        test_token: moduleNameForToken,
      });
      console.log("update_identifiers completed successfully");

      // Replace the token symbol (update from TEST to user's symbol)
      updated = update_constants(
        updated,
        bcs.string().serialize(tokenSymbol).toBytes(),
        bcs.string().serialize("TEST").toBytes(),
        "Vector(U8)" // type of the constant
      );
      console.log("update_constants for symbol completed successfully");

      // Replace the token name (update from TEST to user's name)
      updated = update_constants(
        updated,
        bcs.string().serialize(tokenName).toBytes(), // new value
        bcs.string().serialize("TEST").toBytes(), // current value
        "Vector(U8)" // type of the constant
      );
      console.log("update_constants for name completed successfully");

      // Replace the token description (update from TEST to user's description)
      updated = update_constants(
        updated,
        bcs.string().serialize(tokenDescription).toBytes(), // new value
        bcs.string().serialize("TEST").toBytes(), // current value
        "Vector(U8)" // type of the constant
      );
      console.log("update_constants for description completed successfully");

      // Add icon URL if needed (not in the TEST_TOKEN template but we can add it)
      const iconUrl = "https://example.com/token-icon.png";
      try {
        // Note: This may fail if the template doesn't have an icon URL to replace
        updated = update_constants(
          updated,
          bcs.string().serialize(iconUrl).toBytes(), // new value
          bcs.string().serialize("https://example.com/template.png").toBytes(), // try to replace if exists
          "Vector(U8)" // type of the constant
        );
        console.log("update_constants for icon completed successfully");
      } catch (iconError) {
        console.log("Icon URL not updated, using default");
      }

      console.log("Bytecode generation completed successfully");
      return updated;
    } catch (error: any) {
      console.error("Error in createTokenBytecode:", error);
      throw new Error(
        `Failed to create token bytecode: ${error.message || "Unknown error"}`
      );
    }
  };

  // Function to create a new token with bonding curve
  const createTokenWithCurve = async () => {
    if (!packageId || !registryId || !tokenName || !tokenSymbol) {
      setTxResult(
        "Please fill in all required fields: Package ID, Registry ID, Token Name, and Token Symbol"
      );
      return;
    }

    if (!wasmInitialized) {
      setTxResult(
        "WebAssembly module is still initializing. Please try again in a moment."
      );
      return;
    }

    try {
      setLoading(true);
      setTransactionStatus("loading");
      setTransactionDigest("");
      setTransactionError("");
      setTxResult("Creating token...");

      // Step 1: Create the token
      if (!currentAccount) {
        throw new Error("No connected wallet");
      }

      // Generate module name (lowercase) and struct name (uppercase) from token symbol
      // This is what we'll use for the token - address will be assigned on publish
      const moduleNameForToken = tokenSymbol.toLowerCase().replace(/\s+/g, "_");
      const structNameForToken = tokenSymbol.toUpperCase().replace(/\s+/g, "_");

      // Create the basic identifier for the token - address will be assigned on chain
      // For custom coin type, extract just the module and struct names
      let moduleForCreation, structForCreation;

      if (customCoinType) {
        const parts = customCoinType.split("::");
        if (parts.length === 3) {
          // Ignore the address part (parts[0]) from custom coin type
          moduleForCreation = parts[1];
          structForCreation = parts[2];
        } else {
          // If format is not valid, use the default
          moduleForCreation = moduleNameForToken;
          structForCreation = structNameForToken;
        }
      } else {
        moduleForCreation = moduleNameForToken;
        structForCreation = structNameForToken;
      }

      const tokenIdentifier = `dummy::${moduleForCreation}::${structForCreation}`;
      console.log("Creating token with identifier:", tokenIdentifier);

      // Generate token bytecode
      const bytecode = await createTokenBytecode(
        tokenName,
        tokenSymbol,
        tokenDescription || `${tokenName} Token`,
        moduleForCreation,
        structForCreation
      );

      // Create the coin using our createCoin helper
      try {
        const { treasuryCapId, coinType, coinMetadataId } = await createCoin(
          bytecode
        );

        console.log("Token created successfully:", {
          treasuryCapId,
          coinType,
          coinMetadataId,
        });

        setTxResult("Token created successfully! Now binding to curve...");
        setTreasuryCapId(treasuryCapId);
        setMetadataId(coinMetadataId);
        setCoinTypeArg(coinType);

        // Step 2: Bind token to bonding curve
        const bindTx = new Transaction();
        bindTx.setGasBudget(100000000);

        console.log("registryId:", registryId);
        console.log("treasuryCapId:", treasuryCapId);
        console.log("coinMetadataId:", coinMetadataId);
        console.log("Coin type:", coinType);

        bindTx.moveCall({
          target: `${packageId}::bonding_curve::bind_token_to_curve_entry`,
          typeArguments: [coinType],
          arguments: [
            bindTx.object(registryId), // registry: &mut Registry
            bindTx.object(treasuryCapId), // treasury_cap: TreasuryCap<T>
            bindTx.object(coinMetadataId), // metadata: CoinMetadata<T>
          ],
        });

        // Execute binding transaction
        signAndExecuteTransaction(
          {
            transaction: bindTx.serialize(),
          },
          {
            onSuccess: (bindResult) => {
              handleTransactionSuccess(bindResult);
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
      setTransactionStatus("loading");
      setTransactionDigest("");
      setTransactionError("");
      setTxResult("Selling tokens...");

      // Fetch the latest bonding curve object before constructing the transaction
      const latestBondingCurveId = await fetchLatestObjectId(bondingCurveId);

      const tx = new Transaction();
      // Convert to 9 decimals (consistent with the contract)
      const amount = Math.floor(Number(sellAmount) * 1000000000);

      // Split the selected token
      const tokenObj = tx.object(selectedToken);
      const [tokenToSell] = tx.splitCoins(tokenObj, [amount]);

      // Call the sell function with the latest bonding curve object
      tx.moveCall({
        target: `${packageId}::bonding_curve::sell`,
        typeArguments: [coinTypeArg],
        arguments: [tx.object(latestBondingCurveId), tokenToSell],
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

  // Also add the same pattern to buyTokens for consistency
  const buyTokens = async () => {
    if (!packageId || !bondingCurveId || !Number(buyAmount)) {
      setTxResult("Please fill all fields for buying tokens");
      return;
    }

    try {
      setLoading(true);
      setTransactionStatus("loading");
      setTransactionDigest("");
      setTransactionError("");
      setTxResult("Buying tokens...");

      // Fetch the latest bonding curve object before constructing the transaction
      const latestBondingCurveId = await fetchLatestObjectId(bondingCurveId);

      const tx = new Transaction();
      // Convert to 9 decimals (consistent with the contract)
      const amount = Math.floor(Number(buyAmount) * 1000000000);

      // Create SUI coin for payment
      const [coin] = tx.splitCoins(tx.gas, [amount]);

      // Call the buy function with the latest bonding curve object
      tx.moveCall({
        target: `${packageId}::bonding_curve::buy`,
        typeArguments: [coinTypeArg],
        arguments: [tx.object(latestBondingCurveId), coin],
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

  // Add function to fetch the latest object ID
  const fetchLatestObjectId = async (objectId: string): Promise<string> => {
    try {
      // Use SUI RPC to get the latest object
      const response = await fetch("https://fullnode.devnet.sui.io", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sui_getObject",
          params: [
            objectId,
            {
              showContent: true,
              showOwner: true,
            },
          ],
        }),
      });

      const data = await response.json();

      if (data.result && data.result.data) {
        // If successful, return the same ID (it will use the latest version)
        console.log("Fetched latest bonding curve object:", data.result.data);
        return objectId;
      } else {
        console.warn(
          "Could not fetch latest object, using current ID:",
          objectId
        );
        return objectId;
      }
    } catch (error) {
      console.error("Error fetching latest object:", error);
      // Return the original ID if there's an error
      return objectId;
    }
  };

  // Format token balance for display
  const formatBalance = (balance: bigint): string => {
    return (Number(balance) / 1000000000).toFixed(9);
  };

  const handleTransactionSuccess = (result: any) => {
    setTransactionStatus("confirmed");
    setTransactionDigest(result.digest || "");

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
    setTransactionStatus("failed");

    let errorMessage = "Transaction failed";

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      errorMessage = error.message || error.toString() || JSON.stringify(error);
    } else if (error !== null && error !== undefined) {
      errorMessage = String(error);
    }

    setTransactionError(errorMessage);
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

      {/* Transaction Status Display */}
      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          backgroundColor:
            transactionStatus === "loading"
              ? "#f9fafb"
              : transactionStatus === "confirmed"
              ? "#dcfce7"
              : transactionStatus === "failed"
              ? "#fee2e2"
              : "#f7f7f7",
          borderRadius: "6px",
          textAlign: "center",
          display: transactionStatus !== "idle" ? "block" : "none",
        }}
      >
        {transactionStatus === "loading" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                border: "3px solid #e5e7eb",
                borderTopColor: "#3b82f6",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <style>
              {`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}
            </style>
            <p style={{ fontWeight: "medium" }}>Transaction in progress...</p>
          </div>
        )}

        {transactionStatus === "confirmed" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ color: "#22c55e" }}
            >
              <path
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                fill="currentColor"
              />
            </svg>
            <div>
              <p style={{ fontWeight: "medium", marginBottom: "5px" }}>
                Transaction Confirmed
              </p>
              {transactionDigest && (
                <p
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    wordBreak: "break-all",
                  }}
                >
                  Digest: {transactionDigest}
                </p>
              )}
            </div>
          </div>
        )}

        {transactionStatus === "failed" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ color: "#ef4444" }}
            >
              <path
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                fill="currentColor"
              />
            </svg>
            <div>
              <p style={{ fontWeight: "medium", marginBottom: "5px" }}>
                Transaction Failed
              </p>
              {transactionError && (
                <p style={{ fontSize: "14px", color: "#6b7280" }}>
                  Error: {transactionError}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transaction result display (keep for backward compatibility) */}
      {txResult && transactionStatus === "idle" && (
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
                Token Name
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
                Token Symbol
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
                Token Description
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

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Custom Module/Struct Names (Optional)
            </label>
            <input
              type="text"
              value={customCoinType}
              onChange={(e) => setCustomCoinType(e.target.value)}
              placeholder="0xANY::module_name::STRUCT_NAME"
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />
            <div style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}>
              <p>
                Leave blank to automatically generate module and struct names
                based on token symbol.
              </p>
              <p>
                Format: <code>0xANY::module_name::STRUCT_NAME</code> (the
                address part is ignored)
              </p>
              <p>
                Example: <code>0x123::my_token::MY_TOKEN</code>
              </p>
              <p>
                Note: The actual address will be assigned when the token is
                published to the chain.
              </p>
              <p>
                By convention, module name should be lowercase and struct name
                uppercase.
              </p>
            </div>
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
              {loading ? "Creating..." : "Create & Bind Token to Curve"}
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
