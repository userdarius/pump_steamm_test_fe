# Pump Steamm

A Sui Move smart contract implementation for a bonding curve-based token system with automated market making capabilities.

## Overview

Pump Steamm is a decentralized token system that implements a bonding curve mechanism for automated market making. The system allows for continuous token minting and burning based on a mathematical formula, creating a dynamic price discovery mechanism.

## Project Structure

```
pump_steamm/
├── sources/                 # Main source code directory
│   ├── bonding_curve.move   # Core bonding curve implementation
│   ├── registry.move        # Token registry management
│   ├── admin.move          # Administrative functions
│   ├── decimal.move        # Decimal number handling
│   ├── math.move           # Mathematical utilities
│   ├── events.move         # Event definitions
│   └── version.move        # Version management
├── tests/                  # Test files
├── simulation/             # Simulation scripts and tools
└── Move.toml              # Project configuration and dependencies
```

## Core Components

### Bonding Curve

The `bonding_curve.move` module implements the core bonding curve mechanism, which determines token prices based on supply and demand. This creates an automated market making system where:

- Token prices increase as supply decreases
- Token prices decrease as supply increases

The bonding curve module uses one-time witnesses (OTWs) from token modules to create new tokens with bonding curves, ensuring each token is unique and properly authenticated.

### Registry

The `registry.move` module manages the registration and tracking of tokens within the system, ensuring proper organization and accessibility.

### Token Creation

To create a new token with a bonding curve:

1. Create a new module with your token name
2. Define a one-time witness type (with the same name as your module in UPPERCASE)
3. In the module's init function, call `bonding_curve::create_token_with_curve` with your one-time witness

This approach follows Sui's best practices for token creation and ensures security through proper authentication.

### Administrative Functions

The `admin.move` module provides administrative capabilities for system management and upgrades.

## Dependencies

- Sui Framework (testnet version)
- Custom mathematical utilities for precise calculations
- Decimal handling for accurate price calculations

### Building

```bash
sui move build
```

### Testing

```bash
sui move test
```
