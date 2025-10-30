## Project Overview

This is a full-stack Rock-Paper-Scissors game with Solana wallet integration, supporting both points-based and SOL-based gameplay with MagicBlock Ephemeral Rollups integration for ultra-fast 10ms block times.

## Commands and Scripts

### Backend (`backend/`)
```bash
# Development
npm run dev          # Start server with nodemon (port 3001)
npm start           # Production server start
npm test            # Run Jest tests
npm run fund-wallet  # Display service wallet funding information

# Dependencies
npm install         # Install backend dependencies
```

### Frontend (`web/`)
```bash
# Development
npm run dev         # Start Next.js dev server (port 3000)
npm run build       # Build for production
npm run start       # Start production server
npm run lint        # Run Next.js linter

# Dependencies
npm install         # Install frontend dependencies
```

### Smart Contract (`anchor/`)
```bash
# Development
anchor build        # Build the Anchor program
anchor test --skip-local-validator  # Run tests against existing validator
anchor deploy       # Deploy to configured network
yarn install        # Install dependencies

# Linting
npm run lint        # Check code formatting with Prettier
npm run lint:fix    # Auto-fix formatting issues
```

## Architecture Overview

### Three-Tier Architecture
1. **Frontend** (`web/`): Next.js + React app with Solana wallet integration
2. **Backend** (`backend/`): Express.js + Socket.io for real-time game coordination
3. **Smart Contract** (`anchor/`): Solana/Anchor program for game state and SOL escrow

### Key Architectural Patterns

#### Dual Currency System
- **Points**: Managed off-chain, 100 points per game, stored in Supabase
- **SOL**: On-chain escrow via Anchor program with 95% winner payout, 5% house fee
- Currency type determined at game creation and affects all game logic

#### Real-time Game Flow
1. Player creates/joins game via frontend
2. Backend coordinates matchmaking and game state via Socket.io
3. For SOL games: on-chain transactions handle escrow/payout
4. Game moves processed in real-time through WebSocket events
5. MagicBlock integration provides 10ms block times for enhanced UX

#### State Management
- **Frontend**: React hooks (`use-game.ts`, `use-anchor-program.ts`) 
- **Backend**: GameManager class handles concurrent games and player queues
- **Database**: Supabase for user profiles, stats, and persistent game history
- **Blockchain**: Anchor program accounts for game state and user profiles

### Directory Structure
- `backend/src/game/`: Core game logic and state management
- `backend/src/socket/`: WebSocket event handlers
- `backend/src/services/`: Database operations and auto-finalization
- `web/hooks/`: Custom React hooks for game state and Solana integration
- `web/components/`: Reusable UI components (uses shadcn/ui + Tailwind)
- `anchor/programs/rps-game/`: Solana smart contract implementation

## Development Patterns

### Game State Coordination
Games maintain state across three layers:
- Backend GameManager for real-time coordination
- Frontend React state for UI reactivity  
- On-chain accounts for SOL escrow and permanent records

### Error Handling
- Frontend: Toast notifications for user feedback
- Backend: Structured error responses with game state validation
- Smart Contract: Anchor error codes with descriptive messages

### Testing Strategy
- Backend: Jest tests for game logic (`test/gameLogic.test.js`)
- Smart Contract: Anchor tests for on-chain functionality
- Integration: WebSocket flow testing (`test/websocket.test.js`)

## Key Integration Points

### Solana Wallet Integration
- Uses `@solana/wallet-adapter-react` for wallet connections
- Program ID: `FD79uPpUdF6KQTiqd2V387UkP29uJtHFJvH2J66uemsL`
- PDA derivation patterns: `[b"game", game_id]`, `[b"user_profile", wallet_pubkey]`

### MagicBlock Ephemeral Rollups
- Conditional compilation with `ephemeral` feature flag
- `delegate_game`: Move execution to ephemeral rollup
- `commit_game_state`: Periodic state commits to base layer
- `undelegate_game`: Return to base layer execution

### Database Schema
- User profiles with points balance and game statistics
- Game history tracking for leaderboards
- Supabase configuration in `backend/src/config/supabase.js`

## Environment Configuration

Required environment variables:
- **Backend**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PORT`, `SERVICE_WALLET_PRIVATE_KEY` (optional)
- **Frontend**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_BACKEND_URL`
- **Anchor**: Network configuration in `Anchor.toml`

### Service Wallet Configuration
The backend uses a persistent service wallet for auto-finalization:
- Automatically created on first run and saved to `backend/service-wallet.json`
- For production, set `SERVICE_WALLET_PRIVATE_KEY` environment variable
- Must be funded with devnet SOL for transactions (use `npm run fund-wallet`)
- Wallet persists across server restarts for consistent operation

Use provided `.env.example` files as templates.
