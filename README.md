# Pump Steamm Contract Testing Frontend

A simple frontend application for testing the Pump Steamm bonding curve smart contracts on the Sui blockchain.

## Setup

1. Install dependencies:

```
npm install
```

2. Start the development server:

```
npm start
```

## Usage

1. Connect your wallet using the "Connect Wallet" button
2. Enter the following information:

   - Package ID: The ID of the deployed Pump Steamm package
   - Bonding Curve ID: The object ID of the bonding curve (after creation)
   - Coin Type Argument: The type argument for the token (e.g., "0x2::sui::SUI")

3. Create a new bonding curve or interact with an existing one:
   - Create Bonding Curve: Creates a new bonding curve
   - Buy Tokens: Buy tokens through the bonding curve by providing SUI
   - Sell Tokens: Sell tokens back to the bonding curve

Note: For the sell tokens functionality, you need to modify the code to include the actual coin object ID of the token you want to sell.

## Contract Functions

The main functions available in the bonding curve contract are:

- `create_token`: Creates a new bonding curve
- `buy`: Buy tokens through the bonding curve
- `sell`: Sell tokens back to the bonding curve

## Development

This project uses:

- React
- TypeScript
- Sui Wallet Kit for wallet integration
- Vite for the development server
