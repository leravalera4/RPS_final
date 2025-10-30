# Rock Paper Scissors Game Smart Contract

This is a Solana smart contract for a Rock Paper Scissors game with the following features:

- User profiles with game statistics
- Support for both SOL and Points as currency
- SOL escrow for secure gameplay
- MagicBlock Ephemeral Rollups integration for ultra-fast gameplay
- Multi-round games with configurable winning conditions

## SOL Escrow Implementation

The SOL escrow functionality allows players to stake SOL when creating or joining games. The implementation ensures that:

1. When creating a game with SOL currency, the stake amount is transferred from the creator's wallet to the game account
2. When joining a game with SOL currency, the stake amount is transferred from the joiner's wallet to the game account
3. When a game is finished, 95% of the total pot (2x stake amount) is transferred to the winner, with 5% kept as a house fee
4. If a game is abandoned, the stake amounts are refunded to both players

### Key Instructions

- `create_game`: Transfers SOL from the creator to the game account when currency type is SOL
- `join_game`: Transfers SOL from the joiner to the game account when currency type is SOL
- `finalize_game`: Transfers 95% of the total pot to the winner
- `finalize_abandoned_game`: Refunds SOL to both players if the game is abandoned

### Testing

The SOL escrow functionality has been tested with the following test cases:

- Creating a game with SOL currency and verifying the transfer
- Joining a game with SOL currency and verifying the transfer
- Completing a game and verifying the winner receives the reward
- Abandoning a game and verifying both players receive refunds

## MagicBlock Integration

The contract includes integration with MagicBlock's Ephemeral Rollups for ultra-fast gameplay:

- `delegate_game`: Delegates game execution to an ephemeral rollup
- `commit_game_state`: Periodically commits game state back to the base layer
- `undelegate_game`: Returns game execution to the base layer

## Building and Testing

To build and test the contract:

```bash
# Build the contract
anchor build

# Test on localnet
anchor test --skip-local-validator

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## Next Steps

1. Frontend integration with the SOL escrow functionality
2. Testing on devnet with real SOL
3. Performance optimization for high-volume gameplay 