const anchor = require('@coral-xyz/anchor');
const { SystemProgram, PublicKey } = anchor.web3;
const { assert } = require('chai');

// Configure the client to use the devnet cluster
anchor.setProvider(anchor.AnchorProvider.env());
const provider = anchor.getProvider();
const program = anchor.workspace.RpsGame;

// Helper function to generate a random string for game IDs
function generateRandomGameId() {
  return 'game_' + Math.random().toString(36).substring(2, 10);
}

// Helper function to calculate a PDA for a game
function findGamePDA(gameId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('game'), Buffer.from(gameId)],
    program.programId
  )[0];
}

// Helper function to calculate a PDA for a user profile
function findUserProfilePDA(userPubkey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_profile'), userPubkey.toBuffer()],
    program.programId
  )[0];
}

// Helper function to create a move commitment
async function createMoveCommitment(move, nonce) {
  const moveValue = move === 'rock' ? 0 : move === 'paper' ? 1 : 2;
  const data = Buffer.alloc(9);
  data[0] = moveValue;
  data.writeUInt64LE(nonce, 1);
  
  // Hash the data
  const hash = anchor.utils.sha256.hash(data);
  return Buffer.from(hash, 'hex');
}

describe('RPS Game on Devnet', () => {
  const wallet = provider.wallet;
  let gameId;
  
  it('Initializes a user profile', async () => {
    const userProfilePDA = findUserProfilePDA(wallet.publicKey);
    
    try {
      await program.methods
        .initializeUserProfile()
        .accounts({
          userProfile: userProfilePDA,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log('User profile initialized');
      
      // Fetch the user profile
      const userProfile = await program.account.userProfile.fetch(userProfilePDA);
      assert.equal(userProfile.wallet.toString(), wallet.publicKey.toString());
      assert.equal(userProfile.totalGames, 0);
      assert.equal(userProfile.wins, 0);
      assert.equal(userProfile.losses, 0);
      assert.equal(userProfile.pointsBalance, 300);
    } catch (error) {
      // If the account already exists, that's fine
      if (!error.toString().includes('already in use')) {
        throw error;
      }
      console.log('User profile already exists');
    }
  });

  it('Creates a game', async () => {
    gameId = generateRandomGameId();
    const gamePDA = findGamePDA(gameId);
    const userProfilePDA = findUserProfilePDA(wallet.publicKey);
    
    await program.methods
      .createGame(
        gameId,
        new anchor.BN(100), // stake amount
        { points: {} }, // currency type
        3 // rounds to win
      )
      .accounts({
        game: gamePDA,
        userProfile: userProfilePDA,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`Game created with ID: ${gameId}`);
    
    // Fetch the game
    const game = await program.account.game.fetch(gamePDA);
    assert.equal(game.gameId, gameId);
    assert.equal(game.player1.toString(), wallet.publicKey.toString());
    assert.isNull(game.player2);
    assert.equal(game.stakeAmount.toString(), '100');
    assert.deepEqual(game.currencyType, { points: {} });
    assert.deepEqual(game.gameStatus, { waitingForPlayer: {} });
    assert.equal(game.roundsToWin, 3);
  });

  it('Delegates a game to MagicBlock', async () => {
    const gamePDA = findGamePDA(gameId);
    
    await program.methods
      .delegateGame(gameId)
      .accounts({
        game: gamePDA,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`Game delegated to MagicBlock: ${gameId}`);
  });

  it('Undelegates a game from MagicBlock', async () => {
    const gamePDA = findGamePDA(gameId);
    
    await program.methods
      .undelegateGame(gameId)
      .accounts({
        game: gamePDA,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`Game undelegated from MagicBlock: ${gameId}`);
  });
});
