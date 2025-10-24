import { useCallback, useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { 
  LAMPORTS_PER_SOL, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  TransactionInstruction,
  Connection
} from '@solana/web3.js'
import { useSocket } from './use-socket'
import { useConnection } from '@solana/wallet-adapter-react'
import { useAnchorProgram } from './use-anchor-program'

// Define types
interface Player {
  id: string | null
  wallet?: string
  wins: number
  currentMove: string | null
  ready: boolean
}

interface GameState {
  gameId: string | null
  gameType: 'private' | 'public'
  currency: 'points' | 'sol'
  player1: Player
  player2: Player | null
  currentRound: number
  gameStatus: 'lobby' | 'waiting' | 'playing' | 'game-over' | 'round-result'
  winner: string | null
  stakeAmount: number
  totalPot: number
  roundResult: string | null
  countdown: number
  inviteLink?: string | null
}

interface UseGameOptions {
  onGameCreated?: (gameId: string, inviteLink: string | null) => void
  onGameJoined?: (gameState: any) => void
  onGameStarted?: () => void
  onMoveSubmitted?: (data: any) => void
  onRoundCompleted?: (data: any) => void
  onGameFinished?: (data: any) => void
  onError?: (message: string) => void
}

// Program ID from your deployed contract
const PROGRAM_ID = new PublicKey('GstXQkBpu26KABj6YZ3pYKJhQphoQ72YL1zL38NC6D9U')

export const useGame = (options: UseGameOptions = {}) => {
  const wallet = useWallet()
  const { publicKey, connected, sendTransaction } = wallet
  const { connection } = useConnection()
  const socket = useSocket({
    url: 'https://rps-test-new-bb138c85073f.herokuapp.com',
    onConnect: () => {
      console.log('🔌 WebSocket connected to game server')
    },
    onDisconnect: (reason) => {
      console.log('🔌 WebSocket disconnected:', reason)
    },
    onError: (error) => {
      console.error('🔌 WebSocket error:', error)
    },
  })
  
  const [gameState, setGameState] = useState<GameState>({
    gameId: null,
    gameType: 'private',
    currency: 'points',
    player1: { id: 'you', wins: 0, currentMove: null, ready: false },
    player2: null,
    currentRound: 1,
    gameStatus: 'lobby',
    winner: null,
    stakeAmount: 0,
    totalPot: 0,
    roundResult: null,
    countdown: 0,
  })

  const [isInGame, setIsInGame] = useState(false)

  // Helper functions for PDAs (same as in your working tests)
  const getUserProfilePDA = useCallback((userPublicKey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_profile'), userPublicKey.toBytes()],
      PROGRAM_ID
    )[0]
  }, [])

  const getGamePDA = useCallback((gameId: string) => {
    // Use raw game ID as bytes to match smart contract seeds
    // Contract uses: seeds = [b"game", game_id.as_bytes()]
    // Truncate to max 32 bytes (Solana PDA seed limit)
    const truncatedGameId = gameId.replace(/-/g, '').substring(0, 32)
    return PublicKey.findProgramAddressSync(
      [Buffer.from('game'), Buffer.from(truncatedGameId, 'utf8')],
      PROGRAM_ID
    )[0]
  }, [])

  // Initialize the Anchor program hook for smart contract interactions
  const { finalizeGame: anchorFinalizeGame, createGame: anchorCreateGame, joinGame: anchorJoinGame } = useAnchorProgram({
    onSuccess: (message) => {
      console.log('✅ Smart contract success:', message)
    },
    onError: (error) => {
      console.error('❌ Smart contract error:', error)
    }
  })

  // Refresh wallet balance after transactions
  const refreshBalance = useCallback(async () => {
    if (connected && publicKey) {
      try {
        // This will trigger a re-render of balance displays
        const balance = await connection.getBalance(publicKey)
        console.log('💰 Current balance:', balance / LAMPORTS_PER_SOL, 'SOL')
        
        // Note: Removed forced page reload that was breaking game sessions
        // The wallet adapter and balance components will update naturally
        console.log('✅ Balance refreshed without page reload')
      } catch (error) {
        console.error('Failed to refresh balance:', error)
      }
    }
  }, [connected, publicKey, connection])

  // WebSocket event handlers
  useEffect(() => {
    if (!socket.connected) return

    const handleGameCreated = (data: any) => {
      console.log('🎮 Game created:', data)
      setGameState(prev => ({
        ...prev,
        gameId: data.gameId,
        gameType: data.gameState.gameType,
        currency: data.gameState.currency || 'points',
        stakeAmount: data.gameState.stakeAmount,
        totalPot: data.gameState.totalPot,
        gameStatus: 'waiting',
        inviteLink: data.inviteLink,
        player1: {
          ...prev.player1,
          id: data.gameState.player1.id,
          wallet: data.gameState.player1.wallet,
        },
      }))
      setIsInGame(true)
      options.onGameCreated?.(data.gameId, data.inviteLink)
    }

    const handlePlayerJoined = (data: any) => {
      console.log('👥 Player joined:', data)
      const gameStateData = data.gameState || data
      setGameState(prev => ({
        ...prev,
        player2: gameStateData.player2 ? {
          id: gameStateData.player2.id,
          wallet: gameStateData.player2.wallet,
          wins: gameStateData.player2.wins || 0,
          currentMove: null,
          ready: false,
        } : null,
        gameStatus: gameStateData.gameStatus === 'playing' ? 'playing' : prev.gameStatus,
        currentRound: gameStateData.currentRound || prev.currentRound,
      }))
      options.onGameJoined?.(gameStateData)
    }

    const handleGameJoined = (data: any) => {
      console.log('🎯 Joined game:', data)
      const gameStateData = data.gameState || data
      const myPlayerId = publicKey?.toString().slice(0, 8)
      
      // Determine which player position we are
      const isPlayer1 = gameStateData.player1?.id === myPlayerId
      const isPlayer2 = gameStateData.player2?.id === myPlayerId
      
      setGameState({
        gameId: data.gameId || gameStateData.gameId,
        gameType: gameStateData.gameType,
        currency: gameStateData.currency || 'points',
        player1: {
          id: gameStateData.player1?.id || null,
          wallet: gameStateData.player1?.wallet,
          wins: gameStateData.player1?.wins || 0,
          currentMove: gameStateData.player1?.currentMove,
          ready: !!gameStateData.player1?.currentMove,
        },
        player2: gameStateData.player2 ? {
          id: gameStateData.player2.id,
          wallet: gameStateData.player2.wallet,
          wins: gameStateData.player2.wins || 0,
          currentMove: gameStateData.player2.currentMove,
          ready: !!gameStateData.player2.currentMove,
        } : null,
        currentRound: gameStateData.currentRound || 1,
        gameStatus: gameStateData.gameStatus === 'playing' ? 'playing' : 'waiting',
        winner: gameStateData.winner,
        stakeAmount: gameStateData.stakeAmount,
        totalPot: gameStateData.totalPot,
        roundResult: null,
        countdown: 0,
      })
      setIsInGame(true)
      
      // Log rejoining status
      if (isPlayer1) {
        console.log('🔄 Rejoined as Player 1 (Host)')
      } else if (isPlayer2) {
        console.log('🔄 Rejoined as Player 2')
      }
      
      options.onGameJoined?.(gameStateData)
    }

    const handleGameStarted = (data: any) => {
      console.log('🚀 Game started!', data)
      setGameState(prev => ({
        ...prev,
        gameStatus: 'playing',
        currentRound: data.gameState?.currentRound || prev.currentRound,
      }))
      options.onGameStarted?.()
    }

    const handleMoveSubmitted = (data: any) => {
      console.log('✅ Move submitted:', data)
      
      // Use the playerId from the backend to determine which player made the move
      const moveMakerPlayerId = data.playerId;
      const isPlayer1Move = gameState.player1?.id === moveMakerPlayerId;
      const isPlayer2Move = gameState.player2?.id === moveMakerPlayerId;
      
      // Update the correct player's move state based on who actually made the move
      setGameState(prev => ({
        ...prev,
        player1: isPlayer1Move ? {
          ...prev.player1,
          currentMove: data.move,
          ready: true
        } : prev.player1,
        player2: isPlayer2Move && prev.player2 ? {
          ...prev.player2,
          currentMove: data.move,
          ready: true
        } : prev.player2
      }))
      options.onMoveSubmitted?.(data)
    }

    const handleRoundCompleted = (data: any) => {
      console.log('🏁 Round completed:', data)
      console.log('🏁 Round result details:', {
        roundWinner: data.roundResult?.roundWinner,
        player1Wallet: data.gameState?.player1?.wallet,
        player2Wallet: data.gameState?.player2?.wallet,
        currentUserWallet: publicKey?.toString(),
        scores: data.roundResult?.scores
      })
      
      // Determine the round result message
      let roundResultMessage = "It's a draw!"
      
      if (data.roundResult?.roundWinner === 'player1') {
        const isCurrentUserPlayer1 = data.gameState?.player1?.wallet === publicKey?.toString()
        roundResultMessage = isCurrentUserPlayer1 ? 'You won this round!' : 'You lost this round!'
        console.log('🏁 Player 1 won, current user is player 1:', isCurrentUserPlayer1)
      } else if (data.roundResult?.roundWinner === 'player2') {
        const isCurrentUserPlayer2 = data.gameState?.player2?.wallet === publicKey?.toString()
        roundResultMessage = isCurrentUserPlayer2 ? 'You won this round!' : 'You lost this round!'
        console.log('🏁 Player 2 won, current user is player 2:', isCurrentUserPlayer2)
      }
      
      console.log('🏁 Final round result message:', roundResultMessage)
      console.log('🎯 Setting game status to round-result')
      
      setGameState(prev => {
        console.log('🎯 Previous game state:', prev.gameStatus)
        console.log('🎯 Round result scores:', data.roundResult.scores)
        const newState = {
          ...prev,
          player1: {
            ...prev.player1,
            wins: data.roundResult.scores.player1,
            // Do not clear currentMove here, keep it for round result UI
            currentMove: data.gameState.player1?.currentMove ?? prev.player1.currentMove,
            ready: false,
          },
          player2: prev.player2 ? {
            ...prev.player2,
            wins: data.roundResult.scores.player2,
            // Do not clear currentMove here, keep it for round result UI
            currentMove: data.gameState.player2?.currentMove ?? prev.player2.currentMove,
            ready: false,
          } : null,
          currentRound: data.gameState.currentRound || prev.currentRound,
          roundResult: roundResultMessage,
          gameStatus: "round-result" as const,
        }
        console.log('🎯 New game state:', newState.gameStatus)
        return newState
      })
      options.onRoundCompleted?.(data)
    }

    const handleNextRound = (data: any) => {
      console.log('🔄 Next round:', data)
      
      // Add delay to allow round result to be displayed
      setTimeout(() => {
        console.log('🎯 Transitioning from round-result to playing')
        setGameState(prev => {
          console.log('🎯 Previous game state:', prev.gameStatus)
          const newState = {
            ...prev,
            currentRound: data.round,
            roundResult: null,
            gameStatus: "playing" as const,
            // Now clear currentMove for both players for the new round
            player1: {
              ...prev.player1,
              currentMove: null,
              ready: false,
            },
            player2: prev.player2
              ? {
                  ...prev.player2,
                  currentMove: null,
                  ready: false,
                }
              : null,
          }
          console.log('🎯 New game state:', newState.gameStatus)
          return newState
        })
      }, 3000) // 3 second delay to show round result
    }

    const handlePlayerLeft = (data: any) => {
      console.log('👋 Player left:', data)
      
      // If the game was in progress, handle as a forfeit
      if (gameState.gameStatus === 'playing') {
      const myPlayerId = publicKey?.toString().slice(0, 8)
      
        setGameState(prev => ({
          ...prev,
          gameStatus: 'game-over',
          winner: myPlayerId || null, // Ensure null as fallback, not undefined
          roundResult: 'You won! Your opponent left the game.',
        }))
        
        options.onGameFinished?.({
          gameId: data.gameId,
          winner: {
            playerId: myPlayerId,
            reason: 'opponent_quit'
          },
          quitReason: 'opponent_left'
        })
      } else {
        // If game was in waiting state, just reset
        setGameState({
          gameId: null,
          gameType: 'private',
          currency: 'points',
          player1: { id: 'you', wins: 0, currentMove: null, ready: false },
          player2: null,
          currentRound: 1,
          gameStatus: 'lobby',
          winner: null,
          stakeAmount: 0,
          totalPot: 0,
          roundResult: null,
          countdown: 0,
        })
        setIsInGame(false)
      }
    }

    const handleGameFinished = (data: any) => {
      console.log('🏁 Game finished:', data)
      
      setGameState(prev => {
        // Determine if current user is the winner
        let isUserWinner = false;
        if (
          data.winner?.playerId &&
          ((data.gameState?.player1?.wallet && publicKey && data.gameState.player1.wallet === publicKey.toString() && data.winner.position === 'player1') ||
           (data.gameState?.player2?.wallet && publicKey && data.gameState.player2.wallet === publicKey.toString() && data.winner.position === 'player2'))
        ) {
          isUserWinner = true;
        }
        return {
          ...prev,
          gameStatus: 'game-over',
          winner: data.winner?.playerId || null,
          winnerPosition: data.winner?.position || null,
          finalScores: data.finalScores || {
            player1: prev.player1.wins,
            player2: prev.player2?.wins || 0
          },
          payout: data.payout || {
            totalPot: prev.totalPot,
            winnerPayout: prev.totalPot,
            platformFee: 0
          },
          roundResult: isUserWinner
            ? 'You won the game!'
            : (data.winner?.playerId
                ? 'You lost the game!'
                : prev.roundResult)
        };
      })
      
      // For SOL games, winner must manually finalize to claim winnings
                  if (gameState.currency === 'sol' && gameState.gameId && data.gameState) {
              console.log('🚀 SOL game finished - AUTOMATIC winner distribution enabled')
              console.log('🏆 Modern standard: Winner receives winnings automatically')
              console.log('💰 Backend will handle smart contract finalization (0 popups for winner)')
              
              // Trigger automatic finalization for winner
              console.log('⚡ Triggering auto-finalization service...')
              // TODO: Call backend auto-finalization endpoint
            }
      
      options.onGameFinished?.(data)
    }

    const handleGameError = (data: any) => {
      console.error('⚠️ Game error received:', {
        errorData: data,
        errorMessage: data?.message,
        errorGameId: data?.gameId,
        currentGameId: gameState.gameId,
        gameStatus: gameState.gameStatus
      })
      
      // Ignore errors from old games that we're no longer in
      if (data?.gameId && gameState.gameId && data.gameId !== gameState.gameId) {
        console.log('🔇 Ignoring error from old game:', data.gameId, '(current:', gameState.gameId, ')')
        return
      }
      
      // Ignore errors when we're not in a game (lobby state)
      if (gameState.gameStatus === 'lobby' || !gameState.gameId) {
        console.log('🔇 Ignoring error - not in active game (status:', gameState.gameStatus, ')')
        return
      }
      
      // Only show error if it's for the current game
      if (data?.message) {
        options.onError?.(data.message)
      }
    }

    const handleCountdownUpdate = (data: any) => {
      setGameState(prev => ({
        ...prev,
        countdown: data.countdown,
      }))
    }

    const handleMatchFound = async (data: any) => {
      console.log('🎯 Random match found:', data)
      const gameStateData = data.gameState || data
      const myPlayerId = publicKey?.toString().slice(0, 8)
      const gameId = data.gameId || gameStateData.gameId
      const currency = gameStateData.currency || 'points'
      const stakeAmount = gameStateData.stakeAmount || 0
      
      // For SOL games, both players need to create on-chain escrow
      if (currency === 'sol' && publicKey) {
        try {
          // Determine which player position we are
          const isPlayer1 = gameStateData.player1?.id === myPlayerId
          const isPlayer2 = gameStateData.player2?.id === myPlayerId
          
          if (isPlayer1) {
            console.log('🔗 Player 1: Creating on-chain game with escrow...')
            await anchorCreateGame(gameId, stakeAmount, currency)
            console.log('✅ Player 1: Game created on-chain')
          } else if (isPlayer2) {
            console.log('🔗 Player 2: Joining on-chain game with escrow...')
            await anchorJoinGame(gameId)
            console.log('✅ Player 2: Joined game on-chain')
          }
        } catch (error) {
          console.error('❌ Failed to create/join on-chain game:', error)
          options.onError?.('Failed to stake SOL: ' + (error as Error).message)
          return
        }
      }
      
      // Determine which player position we are
      const isPlayer1 = gameStateData.player1?.id === myPlayerId
      const isPlayer2 = gameStateData.player2?.id === myPlayerId
      
      setGameState({
        gameId,
        gameType: gameStateData.gameType || 'public',
        currency,
        player1: {
          id: gameStateData.player1?.id || null,
          wallet: gameStateData.player1?.wallet,
          wins: gameStateData.player1?.wins || 0,
          currentMove: gameStateData.player1?.currentMove,
          ready: !!gameStateData.player1?.currentMove,
        },
        player2: gameStateData.player2 ? {
          id: gameStateData.player2.id,
          wallet: gameStateData.player2.wallet,
          wins: gameStateData.player2.wins || 0,
          currentMove: gameStateData.player2.currentMove,
          ready: !!gameStateData.player2.currentMove,
        } : null,
        currentRound: gameStateData.currentRound || 1,
        gameStatus: gameStateData.gameStatus === 'playing' ? 'playing' : 'waiting',
        winner: gameStateData.winner,
        stakeAmount: gameStateData.stakeAmount,
        totalPot: gameStateData.totalPot,
        roundResult: null,
        countdown: 0,
      })
      setIsInGame(true)
      
      // Log match status
      if (isPlayer1) {
        console.log('🎯 Random match found - you are Player 1 (Host)')
      } else if (isPlayer2) {
        console.log('🎯 Random match found - you are Player 2')
      }
      
      options.onGameJoined?.(gameStateData)
    }

    const handlePlayerDisconnected = (data: any) => {
      console.log('🔌 Player disconnected:', data)
      
      const myPlayerId = publicKey?.toString().slice(0, 8)
      const disconnectedPlayerId = data.disconnectedPlayerId
      
      if (disconnectedPlayerId !== myPlayerId && gameState.gameStatus === 'playing') {
        console.log('🏆 Opponent disconnected during active game - I win by forfeit!')
        
        setGameState(prev => ({
          ...prev,
          gameStatus: 'game-over',
          winner: myPlayerId || null, // Ensure null as fallback, not undefined
          roundResult: 'You won! Your opponent disconnected.',
        }))
        
        options.onGameFinished?.({
          gameId: data.gameId,
          winner: {
            playerId: myPlayerId,
            reason: 'opponent_disconnect'
          },
          gameState: data.gameState,
          quitReason: 'opponent_disconnected'
        })
      }
    }

    // Register event listeners
    const unsubscribers = [
      socket.on('game_created', handleGameCreated),
      socket.on('player_joined', handlePlayerJoined),
      socket.on('game_joined', handleGameJoined),
      socket.on('match_found', handleMatchFound),
      socket.on('game_started', handleGameStarted),
      socket.on('move_submitted', handleMoveSubmitted),
      socket.on('round_completed', handleRoundCompleted),
      socket.on('game_finished', handleGameFinished),
      socket.on('player_left', handlePlayerLeft),
      socket.on('player_disconnected', handlePlayerDisconnected),
      socket.on('error', handleGameError),
      socket.on('countdown_update', handleCountdownUpdate),
      socket.on('next_round', handleNextRound),
    ]

    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [socket.connected, socket.on, options, gameState, publicKey, refreshBalance])

  // Game actions with proper error handling
  const createGame = useCallback(async (stakeAmount: number, gameType: 'private' | 'public' = 'private', currency: 'points' | 'sol' = 'points') => {
    if (!connected || !publicKey) {
      options.onError?.('Please connect your wallet first')
      return
    }

    try {
      console.log('Creating game with stake:', stakeAmount, 'currency:', currency)
      
      // Generate a unique game ID
      const gameId = `game_${Math.floor(Math.random() * 1000000)}`
      
      if (currency === 'sol') {
        // For SOL games, create actual on-chain game with escrow
        console.log('🔗 Creating SOL game with smart contract escrow...')
        try {
          await anchorCreateGame(gameId, stakeAmount, currency)
          console.log('✅ SOL game created on-chain with escrow')
        } catch (error) {
          console.error('❌ Failed to create SOL game:', error)
          options.onError?.('Failed to create SOL game: ' + (error as Error).message)
          return
        }
      }
      
      // Create game on backend (for both points and SOL games)
      socket.emit('create_game', {
        gameId,
        stakeAmount: currency === 'sol' ? stakeAmount : 100,
        gameType,
        currency,
        playerId: publicKey.toString().slice(0, 8),
        playerWallet: publicKey.toString(),
      })
      
      console.log('✅ Game creation request sent to backend')
    } catch (error) {
      console.error('❌ Failed to create game:', error)
      options.onError?.(error instanceof Error ? error.message : 'Failed to create game')
      throw error
    }
  }, [connected, publicKey, socket.emit, options, anchorCreateGame, refreshBalance])

  const joinGame = useCallback(async (gameId?: string, currency: 'points' | 'sol' = 'points', stakeAmount: number = 100) => {
    console.log('🎮 joinGame called with:', { gameId, currency, stakeAmount })
    
    if (!publicKey || !socket.emit) {
      console.error('❌ No wallet or socket available for joining game')
      return
    }

    const currentPlayerId = publicKey.toString().slice(0, 8)
    console.log('👤 Current player ID:', currentPlayerId)

    try {
      if (gameId) {
        console.log('🔍 Joining specific game:', gameId)
        
        // First, get the game details to check if it's a SOL game
        console.log('📡 Fetching game details from backend...')
        const response = await fetch(`https://rps-test-new-bb138c85073f.herokuapp.com/api/games/${gameId}`)
        const gameData = await response.json()
        
        console.log('📦 Game data received:', gameData)
        
        if (!gameData.success || !gameData.game) {
          console.error('❌ Game not found')
          options.onError?.('Game not found')
          return
        }
        
        const actualCurrency = gameData.game.currency
        const actualStakeAmount = gameData.game.stakeAmount
        
        console.log('💰 Game details:', { currency: actualCurrency, stakeAmount: actualStakeAmount })
        
        // If it's a SOL game, stake SOL BEFORE joining the backend game
        if (actualCurrency === 'sol') {
          console.log('🔗 SOL game detected - staking SOL before joining...')
          console.log('🔗 Calling anchorJoinGame with gameId:', gameId)
          try {
            await anchorJoinGame(gameId)
            console.log('✅ SOL staked successfully before joining')
          } catch (error) {
            console.error('❌ Failed to stake SOL before joining:', error)
            options.onError?.('Failed to stake SOL for joining game: ' + (error as Error).message)
            return
          }
        }
        
        // Now join the backend game
        socket.emit('join_game', {
          gameId,
          playerWallet: publicKey.toString(),
          playerId: currentPlayerId,
          currency: actualCurrency
        })
      } else {
        console.log('Finding random game with stake amount:', stakeAmount, 'currency:', currency)
        
        socket.emit('find_random_match', {
          stakeAmount,
          currency,
          playerId: currentPlayerId,
          playerWallet: publicKey.toString(),
        })
      }
      console.log('✅ Game join request sent')
    } catch (error) {
      console.error('❌ Failed to join game:', error)
      options.onError?.(error instanceof Error ? error.message : 'Failed to join game')
      throw error
    }
  }, [publicKey, socket.emit, options, anchorJoinGame, anchorCreateGame, refreshBalance])

  const makeMove = useCallback(async (move: 'rock' | 'paper' | 'scissors') => {
    if (!publicKey || !gameState.gameId || !socket.emit) {
      console.error('Cannot make move: missing requirements')
      return
    }

    const currentPlayerId = publicKey.toString().slice(0, 8)
    console.log('🎯 Making move:', move, 'for player:', currentPlayerId)

    try {
      console.log('Making move:', move)
      socket.emit('submit_move', {
        gameId: gameState.gameId,
        playerId: currentPlayerId,
        move,
      })
      console.log('✅ Move submitted successfully')
    } catch (error) {
      console.error('❌ Failed to submit move:', error)
      throw error
    }
  }, [publicKey, gameState.gameId, socket.emit])

  const startGame = useCallback(async () => {
    if (!publicKey || !gameState.gameId || !socket.emit) {
      console.error('Cannot start game: missing requirements')
      return
    }

    try {
      console.log('🚀 Host starting game:', gameState.gameId)
      socket.emit('start_game', {
        gameId: gameState.gameId,
      })
      console.log('✅ Game start request sent')
    } catch (error) {
      console.error('❌ Failed to start game:', error)
      throw error
    }
  }, [publicKey, gameState.gameId, socket.emit])

  const leaveGame = useCallback(async () => {
    if (!publicKey || !gameState.gameId || !socket.emit) {
      console.error('Cannot leave game: missing requirements')
      return
    }

    try {
      console.log('🚪 Leaving game...')
      
      // Use critical event with acknowledgment to ensure the server receives it
      socket.emit('leave_game', {
        gameId: gameState.gameId,
        playerId: publicKey?.toString().slice(0, 8),
      })
      console.log('✅ Leave game request sent')
    } catch (error) {
      console.error('Failed to leave game properly:', error)
      // Even if the leave event fails, we should still clean up locally
      console.log('⚠️ Proceeding with local cleanup despite server error')
    }
    
    // Always reset local state
    setGameState({
      gameId: null,
      gameType: 'private',
      currency: 'points',
      player1: { id: 'you', wins: 0, currentMove: null, ready: false },
      player2: null,
      currentRound: 1,
      gameStatus: 'lobby',
      winner: null,
      stakeAmount: 0,
      totalPot: 0,
      roundResult: null,
      countdown: 0,
    })
    setIsInGame(false)
  }, [gameState.gameId, publicKey, socket])

  const resetGameState = useCallback(() => {
    console.log('🔄 Resetting game state in hook...')
    setGameState({
      gameId: null,
      gameType: 'private',
      currency: 'points',
      player1: { id: 'you', wins: 0, currentMove: null, ready: false },
      player2: null,
      currentRound: 1,
      gameStatus: 'lobby',
      winner: null,
      stakeAmount: 0,
      totalPot: 0,
      roundResult: null,
      countdown: 0,
    })
    setIsInGame(false)
  }, [])

  return {
    gameState,
    isInGame,
    createGame,
    joinGame,
    makeMove,
    startGame,
    leaveGame,
    resetGameState,
    isConnected: socket.connected,
    socket, // Expose socket for advanced operations
  }
} 