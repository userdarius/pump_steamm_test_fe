# Pump Steamm

A Sui Move implementation of a bonding curve and automated market making system for token trading.

## Overview

Pump Steamm implements an advanced bonding curve mechanism that allows continuous token minting and burning based on mathematical formulas. The system dynamically transitions from a bonding curve to an automated market maker (AMM) once certain liquidity thresholds are reached.

## Key Features

- **Dynamic Bonding Curve**: Tokens are minted and burned based on mathematical formulas that ensure a continuous price curve
- **Virtual Reserves**: Uses virtual reserves to stabilize pricing and reduce volatility in early stages
- **Automatic Transition**: Transitions from bonding curve to AMM once sufficient liquidity is achieved
- **Slippage Protection**: Built-in mechanics to handle slippage appropriately for larger trades
- **Supply Caps**: Maximum supply protections to prevent unlimited minting

## Technical Details

### Constants

- **Initial Virtual SUI**: 30,000 SUI (with 9 decimals)
- **Maximum Token Supply**: 1 billion tokens (with 9 decimals)
- **Listing Threshold**: 69,000 SUI (with 9 decimals, triggers transition to AMM)

### Bonding Curve Formula

The system uses a constant product formula where:

- K = Initial Virtual SUI \* Initial Virtual Tokens
- When buying tokens, the amount minted is calculated based on the SUI provided
- When selling tokens, the SUI received is calculated based on the tokens provided

The formulas ensure slippage - larger trades get proportionally fewer tokens or SUI due to the curve's design, which protects the system from exploitation.

### State Transition

The system begins as a bonding curve mechanism and automatically transitions to an AMM once the virtual SUI reserves reach the listing threshold. This creates a seamless progression from token launch to trading.

## Project Structure

```
pump_steamm/
├── sources/
│   ├── bonding_curve.move  # Core implementation of bonding curve mechanics
│   ├── registry.move       # Token registry for tracking bonding curves
│   ├── events.move         # Event definitions for system transparency
│   ├── version.move        # Version control for upgrades
│   ├── global_admin.move   # Administrative functions
│   └── test_token.move     # Test token implementation
├── tests/
│   └── pump_steamm_tests.move  # Comprehensive test suite
└── Move.toml               # Project configuration
```

## Testing

The project includes a comprehensive test suite that verifies:

- Token minting and burning calculations
- Buy and sell operations
- Slippage behavior
- Transition mechanism
- Maximum supply protections
- Negative value protections
- Edge case handling

## Usage

### Creating a Token with Bonding Curve

To create a new token with a bonding curve:

1. Create a module with your token name
2. Define a one-time witness (OTW) type
3. Create the token using `coin::create_currency` with your OTW
4. Bind the token to a curve using `bonding_curve::bind_token_to_curve_entry`

Example:

```move
module my_project::my_token {
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin, TreasuryCap, CoinMetadata};
    use sui::transfer;
    use std::option;
    use pump_steamm::bonding_curve;
    use pump_steamm::registry;

    struct MY_TOKEN has drop {}

    fun init(witness: MY_TOKEN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            9,            // Decimals
            b"MYTKN",     // Symbol
            b"My Token",  // Name
            b"Description",
            option::none(),
            ctx
        );

        // Get registry from somewhere (shared object)
        let registry = registry::get();

        bonding_curve::bind_token_to_curve_entry(
            &mut registry,
            treasury_cap,
            metadata,
            ctx
        );
    }
}
```

### Buying and Selling Tokens

Once a token is created with a bonding curve, users can:

```move
// Buy tokens
bonding_curve::buy<MY_TOKEN>(bonding_curve, payment, ctx);

// Sell tokens
bonding_curve::sell<MY_TOKEN>(bonding_curve, tokens, ctx);
```

## Building and Testing

```bash
# Build the project
sui move build

# Run the tests
sui move test
```
