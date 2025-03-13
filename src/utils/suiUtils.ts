import { SuiClient } from "@mysten/sui/client";

// Create a SUI client
export const suiClient = new SuiClient({
  url: "https://fullnode.testnet.sui.io:443",
});

// Function to get owned tokens of a specific type
export async function getOwnedTokens(
  address: string,
  coinType: string
): Promise<{ id: string; balance: bigint }[]> {
  try {
    const coins = await suiClient.getCoins({
      owner: address,
      coinType: coinType,
    });

    return coins.data.map((coin) => ({
      id: coin.coinObjectId,
      balance: BigInt(coin.balance),
    }));
  } catch (error) {
    console.error("Error fetching owned tokens:", error);
    return [];
  }
}
