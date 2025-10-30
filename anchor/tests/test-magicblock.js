const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, SystemProgram, Keypair } = anchor.web3;
const { assert } = require('chai');
const fs = require('fs');
const path = require('path');

// Configure connections
const devnetConnection = new Connection('https://api.devnet.solana.com', 'confirmed');
const magicRouterConnection = new Connection('https://devnet-rpc.magicblock.app', 'confirmed');
const ephemeralRollupConnection = new Connection('https://devnet.magicblock.app', 'confirmed');

// Load the IDL from the deployed program
const programId = new PublicKey('FD79uPpUdF6KQTiqd2V387UkP29uJtHFJvH2J66uemsL');

// Helper function to generate a random string for game IDs
function generateRandomGameId() {
  return 'game_' + Math.random().toString(36).substring(2, 10);
}

// Helper function to calculate a PDA for a game
function findGamePDA(gameId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('game'), Buffer.from(gameId)],
    programId
  )[0];
}

// Helper function to calculate a PDA for a user profile
function findUserProfilePDA(userPubkey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_profile'), userPubkey.toBuffer()],
    programId
  )[0];
}

// Main test function
async function runTest() {
  try {
    console.log('Loading wallet and program...');
    
    // Load wallet from the default Solana CLI path
    const homedir = require('os').homedir();
    const keypairPath = path.join(homedir, '.config', 'solana', 'id.json');
    
    let wallet;
    try {
      const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
      const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
      wallet = new anchor.Wallet(keypair);
      console.log(`Loaded wallet: ${wallet.publicKey.toString()}`);
    } catch (error) {
      console.error('Failed to load wallet:', error);
      return;
    }
    
    // Create provider
    const provider = new anchor.AnchorProvider(
      devnetConnection,
      wallet,
      { commitment: 'confirmed' }
    );
    
    // Load program IDL from local file
    console.log('Loading program IDL from local file...');
    let idl;
    try {
      const idlPath = path.join(__dirname, '..', 'target', 'idl', 'rps_game.json');
      idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
      console.log('IDL loaded successfully');
    } catch (error) {
      console.error('Failed to load IDL from file:', error);
      return;
    }
    
    // Create program instance
    const program = new anchor.Program(idl, programId, provider);
    
    // Check wallet balance
    const balance = await devnetConnection.getBalance(wallet.publicKey);
    console.log(`Wallet balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    
    if (balance < anchor.web3.LAMPORTS_PER_SOL) {
      console.log('Wallet balance too low. Please fund your wallet with more SOL.');
      return;
    }
    
    // Step 1: Initialize user profile
    const userProfilePDA = findUserProfilePDA(wallet.publicKey);
    
    try {
      console.log('Initializing user profile...');
      await program.methods
        .initializeUserProfile()
        .accounts({
          userProfile: userProfilePDA,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log('User profile initialized');
    } catch (error) {
      // If the account already exists, that's fine
      if (!error.toString().includes('already in use')) {
        console.error('Error initializing user profile:', error);
        return;
      }
      console.log('User profile already exists');
    }
    
    // Step 2: Create a game
    const gameId = generateRandomGameId();
    const gamePDA = findGamePDA(gameId);
    
    console.log(`Creating game with ID: ${gameId}...`);
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
    
    // Step 3: Delegate the game to MagicBlock
    console.log('Delegating game to MagicBlock...');
    await program.methods
      .delegateGame(gameId)
      .accounts({
        game: gamePDA,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`Game delegated to MagicBlock: ${gameId}`);
    
    // Step 4: Undelegate the game from MagicBlock
    console.log('Undelegating game from MagicBlock...');
    await program.methods
      .undelegateGame(gameId)
      .accounts({
        game: gamePDA,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log(`Game undelegated from MagicBlock: ${gameId}`);
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
runTest(); 