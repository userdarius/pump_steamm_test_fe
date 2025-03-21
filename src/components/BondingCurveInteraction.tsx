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
    "0x4c80d97de0920eed5b2449b9805c70935c4254e60a58f9e26304c953f6cdd7f8"
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
        arguments: [
          tx.object(registryId), // registry: &mut Registry
          tx.object(treasuryCapId), // treasury_cap: TreasuryCap<OTW>
          tx.object(metadataId), // metadata: CoinMetadata<OTW>
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
        const tokens = await getOwnedTokens(
          currentAccount.address,
          coinTypeArg
        );
        setOwnedTokens(tokens);
        if (tokens.length > 0) {
          setSelectedToken(tokens[0].id);
        }
      } catch (error) {
        console.error("Error refreshing tokens:", error);
      }
    }
  };

  // Format token balance for display
  const formatBalance = (balance: bigint): string => {
    return (Number(balance) / 1000000000).toFixed(9);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Contract Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2">Package ID</label>
            <input
              type="text"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Package ID"
            />
          </div>
          <div>
            <label className="block mb-2">Registry ID</label>
            <input
              type="text"
              value={registryId}
              onChange={(e) => setRegistryId(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Registry ID"
            />
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex mb-4">
          <button
            className={`mr-2 px-4 py-2 rounded ${
              transactionType === "create"
                ? "bg-blue-500 text-white"
                : "bg-gray-200"
            }`}
            onClick={() => setTransactionType("create")}
          >
            Create Token
          </button>
          <button
            className={`mr-2 px-4 py-2 rounded ${
              transactionType === "buy"
                ? "bg-blue-500 text-white"
                : "bg-gray-200"
            }`}
            onClick={() => setTransactionType("buy")}
          >
            Buy Tokens
          </button>
          <button
            className={`px-4 py-2 rounded ${
              transactionType === "sell"
                ? "bg-blue-500 text-white"
                : "bg-gray-200"
            }`}
            onClick={() => setTransactionType("sell")}
          >
            Sell Tokens
          </button>
        </div>

        {transactionType === "create" && (
          <div>
            <h2 className="text-xl font-bold mb-4">
              Bind Token to Bonding Curve
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-2">Treasury Cap ID</label>
                <input
                  type="text"
                  value={treasuryCapId}
                  onChange={(e) => setTreasuryCapId(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Treasury Cap ID"
                />
              </div>
              <div>
                <label className="block mb-2">Metadata ID</label>
                <input
                  type="text"
                  value={metadataId}
                  onChange={(e) => setMetadataId(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Metadata ID"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block mb-2">Token Name (Display Only)</label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Token Name"
                />
              </div>
              <div>
                <label className="block mb-2">
                  Token Symbol (Display Only)
                </label>
                <input
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Token Symbol"
                />
              </div>
              <div>
                <label className="block mb-2">
                  Token Description (Display Only)
                </label>
                <input
                  type="text"
                  value={tokenDescription}
                  onChange={(e) => setTokenDescription(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Token Description"
                />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Note: Token name, symbol, and description are for display purposes
              only. The actual values are already set in the metadata object.
            </p>
            <button
              onClick={createTokenWithCurve}
              disabled={loading}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              {loading ? "Creating..." : "Bind Token to Curve"}
            </button>
          </div>
        )}

        {transactionType === "buy" && (
          <div>
            <h2 className="text-xl font-bold mb-4">Buy Tokens</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-2">Bonding Curve ID</label>
                <input
                  type="text"
                  value={bondingCurveId}
                  onChange={(e) => setBondingCurveId(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Bonding Curve ID"
                />
              </div>
              <div>
                <label className="block mb-2">Coin Type</label>
                <input
                  type="text"
                  value={coinTypeArg}
                  onChange={(e) => setCoinTypeArg(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Coin Type"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block mb-2">Amount of SUI to spend</label>
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="SUI Amount"
                step="0.000000001"
                min="0"
              />
            </div>
            <button
              onClick={buyTokens}
              disabled={loading || hasTransitioned}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              {loading ? "Buying..." : "Buy Tokens"}
            </button>
            {hasTransitioned && (
              <p className="text-red-500 mt-2">
                This bonding curve has transitioned to AMM mode and buying is no
                longer available.
              </p>
            )}
          </div>
        )}

        {transactionType === "sell" && (
          <div>
            <h2 className="text-xl font-bold mb-4">Sell Tokens</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-2">Bonding Curve ID</label>
                <input
                  type="text"
                  value={bondingCurveId}
                  onChange={(e) => setBondingCurveId(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Bonding Curve ID"
                />
              </div>
              <div>
                <label className="block mb-2">Coin Type</label>
                <input
                  type="text"
                  value={coinTypeArg}
                  onChange={(e) => setCoinTypeArg(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Coin Type"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block mb-2">Select Token</label>
              <select
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                className="w-full p-2 border rounded"
              >
                {ownedTokens.map((token) => (
                  <option key={token.id} value={token.id}>
                    {token.id} ({formatBalance(token.balance)})
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block mb-2">Amount of tokens to sell</label>
              <input
                type="number"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Token Amount"
                step="0.000000001"
                min="0"
              />
            </div>
            <button
              onClick={sellTokens}
              disabled={loading || hasTransitioned}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              {loading ? "Selling..." : "Sell Tokens"}
            </button>
            {hasTransitioned && (
              <p className="text-red-500 mt-2">
                This bonding curve has transitioned to AMM mode and selling is
                no longer available.
              </p>
            )}
          </div>
        )}
      </div>

      {ownedTokens.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Your Tokens</h2>
          <button
            onClick={refreshTokens}
            className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
          >
            Refresh Tokens
          </button>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Token ID</th>
                <th className="border p-2 text-left">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ownedTokens.map((token) => (
                <tr key={token.id}>
                  <td className="border p-2 text-left font-mono text-sm">
                    {token.id}
                  </td>
                  <td className="border p-2 text-left">
                    {formatBalance(token.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {txResult && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Transaction Result</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {txResult}
          </pre>
        </div>
      )}
    </div>
  );
};

export default BondingCurveInteraction;
