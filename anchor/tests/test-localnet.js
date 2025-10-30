const assert = require('assert');
const anchor = require('@coral-xyz/anchor');
const { SystemProgram, Keypair, PublicKey } = anchor.web3;
const { BN } = anchor;
const crypto = require('crypto');

// Configure the connection to the local validator
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

// Get the program ID from the workspace
const program = anchor.workspace.RpsGame;
const connection = provider.connection;

// Increase test timeout
const TEST_TIMEOUT = 10000;

describe('RPS Game MagicBlock Integration Tests', function() {
  // Set timeout for all tests
  this.timeout(TEST_TIMEOUT);
  
  // Generate a unique game ID for each test run
  const gameId = `game-${Math.floor(Math.random() * 1000000)}`;
  
  // Generate a keypair for player 2
  const player2 = Keypair.generate();
  
  // Game parameters
  const stakeAmount = new BN(100);
  const currencyType = { points: {} }; // Use points for testing
  const roundsToWin = 3;
  
  // Move constants
  const ROCK = { rock: {} };
  const PAPER = { paper: {} };
  const SCISSORS = { scissors: {} };
  
  // Delegate config
  const delegateConfig = {
    lifetime: new BN(3600), // 1 hour
    updateFrequency: new BN(60), // Every minute
    blockTime: 10 // 10ms block time
  };
  
  // Store PDAs for later use
  let userProfilePDA;
  let player2ProfilePDA;
  let gamePDA;
  
  // Store move commitments
  let player1MoveHash;
  let player2MoveHash;
  const nonce = new BN(Date.now());
  
  it('Airdrop SOL to player 2', async () => {
    const airdropSignature = await connection.requestAirdrop(
      player2.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSignature);
    console.log(`Airdropped 1 SOL to player 2: ${player2.publicKey.toString()}`);
  });

  it('Initialize or fetch user profiles', async () => {
    // Find PDA for user profile
    [userProfilePDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from('user_profile'), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
    
    // Try to fetch user profile, initialize if it doesn't exist
    try {
      await program.account.userProfile.fetch(userProfilePDA);
      console.log('Player 1 profile already exists');
    } catch (e) {
      // Profile doesn't exist, initialize it
      await program.methods
        .initializeUserProfile()
        .accounts({
          userProfile: userProfilePDA,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log('Player 1 profile initialized');
    }
    
    // Find PDA for player 2 profile
    [player2ProfilePDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from('user_profile'), player2.publicKey.toBuffer()],
      program.programId
    );
    
    // Try to fetch player 2 profile, initialize if it doesn't exist
    try {
      await program.account.userProfile.fetch(player2ProfilePDA);
      console.log('Player 2 profile already exists');
    } catch (e) {
      // Profile doesn't exist, initialize it
      await program.methods
        .initializeUserProfile()
        .accounts({
          userProfile: player2ProfilePDA,
          user: player2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([player2])
        .rpc();
      console.log('Player 2 profile initialized');
    }
    
    console.log('User profiles ready for both players');
  });

  it('Create a new game', async () => {
    // Find PDA for game account
    [gamePDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from('game'), Buffer.from(gameId)],
      program.programId
    );
    
    // Create the game
    await program.methods
      .createGame(gameId, stakeAmount, currencyType, roundsToWin)
      .accounts({
        game: gamePDA,
        userProfile: userProfilePDA,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    // Fetch the game to verify it was created
    const game = await program.account.game.fetch(gamePDA);
    assert.equal(game.gameId, gameId);
    assert.equal(game.player1.toString(), provider.wallet.publicKey.toString());
    assert.equal(Object.keys(game.gameStatus)[0], 'waitingForPlayer');
    
    console.log(`Game created: ${gameId}`);
  });

  it('Delegate the game to MagicBlock', async () => {
    // Delegate the game to MagicBlock
    await program.methods
      .delegateGame(gameId, delegateConfig)
      .accounts({
        game: gamePDA,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`Game delegated to MagicBlock: ${gameId}`);
  });

  it('Player 2 joins the game', async () => {
    // Player 2 joins the game
    await program.methods
      .joinGame(gameId)
      .accounts({
        game: gamePDA,
        userProfile: player2ProfilePDA,
        user: player2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player2])
      .rpc();
    
    // Fetch the game to verify player 2 joined
    const game = await program.account.game.fetch(gamePDA);
    assert.equal(game.player2.toString(), player2.publicKey.toString());
    assert.equal(Object.keys(game.gameStatus)[0], 'inProgress');
    
    console.log(`Player 2 joined game: ${gameId}`);
  });

  it('Players submit move commitments', async () => {
    // Helper function to create move hash
    const createMoveHash = (move, nonce) => {
      const moveValue = move.rock ? 0 : move.paper ? 1 : 2;
      const nonceBuffer = Buffer.alloc(8);
      nonceBuffer.writeBigUInt64LE(BigInt(nonce));
      
      const data = Buffer.concat([Buffer.from([moveValue]), nonceBuffer]);
      return Array.from(crypto.createHash('sha256').update(data).digest());
    };
    
    // Player 1 submits ROCK
    player1MoveHash = createMoveHash(ROCK, nonce);
    await program.methods
      .submitMove(gameId, player1MoveHash)
      .accounts({
        game: gamePDA,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    // Player 2 submits SCISSORS
    player2MoveHash = createMoveHash(SCISSORS, nonce);
    await program.methods
      .submitMove(gameId, player2MoveHash)
      .accounts({
        game: gamePDA,
        user: player2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player2])
      .rpc();
    
    console.log('Both players submitted move commitments');
  });

  it('Commit game state to base layer', async () => {
    // Commit the game state back to the base layer
    await program.methods
      .commitGameState(gameId)
      .accounts({
        game: gamePDA,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`Game state committed to base layer: ${gameId}`);
  });

  it('Players reveal moves', async () => {
    // Player 1 reveals ROCK
    await program.methods
      .revealMoves(gameId, ROCK, nonce)
      .accounts({
        game: gamePDA,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    // Player 2 reveals SCISSORS
    await program.methods
      .revealMoves(gameId, SCISSORS, nonce)
      .accounts({
        game: gamePDA,
        user: player2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player2])
      .rpc();
    
    // Fetch the game to verify round result
    const game = await program.account.game.fetch(gamePDA);
    assert.equal(game.player1RoundsWon, 1);
    assert.equal(game.player2RoundsWon, 0);
    
    console.log('Both players revealed moves, Player 1 won the round (ROCK beats SCISSORS)');
  });

  it('Undelegate the game from MagicBlock', async () => {
    // Undelegate the game from MagicBlock
    await program.methods
      .undelegateGame(gameId)
      .accounts({
        game: gamePDA,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`Game undelegated from MagicBlock: ${gameId}`);
  });

  it('Abandon a game', async function() {
    // Increase timeout for this test
    this.timeout(TEST_TIMEOUT * 2);
    
    // Create a new game to abandon
    const abandonGameId = `game-abandon-${Math.floor(Math.random() * 1000000)}`;
    
    // Find PDA for the abandon game
    const [abandonGamePDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from('game'), Buffer.from(abandonGameId)],
      program.programId
    );
    
    // Create the game
    await program.methods
      .createGame(abandonGameId, stakeAmount, currencyType, roundsToWin)
      .accounts({
        game: abandonGamePDA,
        userProfile: userProfilePDA,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    // Abandon the game
    await program.methods
      .abandonGame(abandonGameId)
      .accounts({
        game: abandonGamePDA,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    // Fetch the game to verify it was abandoned
    const game = await program.account.game.fetch(abandonGamePDA);
    assert.equal(Object.keys(game.gameStatus)[0], 'abandoned');
    
    // Finalize the abandoned game
    await program.methods
      .finalizeAbandonedGame(abandonGameId)
      .accounts({
        game: abandonGamePDA,
        player1Profile: userProfilePDA,
        player2Profile: userProfilePDA, // Use player1 as player2 since no player2 joined
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`Game abandoned and finalized: ${abandonGameId}`);
  });
}); 