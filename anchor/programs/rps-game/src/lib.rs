use anchor_lang::prelude::*;
use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;

declare_id!("GstXQkBpu26KABj6YZ3pYKJhQphoQ72YL1zL38NC6D9U");

#[program]
pub mod rps_game {
    use super::*;

    pub fn initialize_user_profile(ctx: Context<InitializeUserProfile>) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.points_balance = 0;
        user_profile.wins = 0;
        user_profile.losses = 0;
        user_profile.total_games = 0;
        user_profile.total_points_earned = 0;
        user_profile.referral_code = generate_referral_code(&ctx.accounts.user.key());
        user_profile.referred_by = None;
        user_profile.referral_count = 0;
        user_profile.referral_earnings = 0;
        user_profile.created_at = Clock::get()?.unix_timestamp;
        
        msg!("User profile initialized for {} with referral code {:?}", ctx.accounts.user.key(), user_profile.referral_code);
        Ok(())
    }

    pub fn set_referrer(ctx: Context<SetReferrer>, referrer_code: [u8; 8]) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        let referrer_profile = &mut ctx.accounts.referrer_profile;
        
        // Validate referrer code matches
        require!(referrer_profile.referral_code == referrer_code, GameError::InvalidReferralCode);
        
        // Can't refer yourself
        require!(ctx.accounts.user.key() != ctx.accounts.referrer.key(), GameError::CannotReferYourself);
        
        // Can only set referrer once
        require!(user_profile.referred_by.is_none(), GameError::ReferrerAlreadySet);
        
        // Set the referrer
        user_profile.referred_by = Some(ctx.accounts.referrer.key());
        
        // Increment referrer's count
        referrer_profile.referral_count += 1;
        
        msg!("User {} referred by {} with code {:?}", 
            ctx.accounts.user.key(), 
            ctx.accounts.referrer.key(),
            referrer_code
        );
        
        Ok(())
    }

    pub fn create_game(
        ctx: Context<CreateGame>,
        game_id: String,
        stake_amount: u64,
        currency_type: CurrencyType,
        rounds_to_win: u8,
    ) -> Result<()> {
        // Validate inputs
        require!(game_id.len() <= 32, GameError::GameIdTooLong);
        require!(stake_amount > 0, GameError::InvalidStakeAmount);
        require!(rounds_to_win > 0 && rounds_to_win <= 10, GameError::InvalidRoundsToWin);
        
        // For points games, check if user has enough points
        if currency_type == CurrencyType::Points {
            let user_profile = &ctx.accounts.user_profile;
            require!(
                user_profile.points_balance >= stake_amount,
                GameError::InsufficientPoints
            );
        } else if currency_type == CurrencyType::Sol {
            // For SOL games, transfer the stake amount to the game account
            require!(
                **ctx.accounts.user.lamports.borrow() >= stake_amount,
                GameError::InsufficientSol
            );
            
            // Transfer SOL from user to game account
            anchor_lang::solana_program::program::invoke(
                &anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.user.key(),
                    &ctx.accounts.game.key(),
                    stake_amount,
                ),
                &[
                    ctx.accounts.user.to_account_info(),
                    ctx.accounts.game.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }
        
        let game = &mut ctx.accounts.game;
        game.game_id = game_id;
        game.player1 = ctx.accounts.user.key();
        game.player2 = None;
        game.game_status = GameStatus::WaitingForPlayer;
        game.stake_amount = stake_amount;
        game.currency_type = currency_type;
        game.rounds_to_win = rounds_to_win;
        game.current_round = 1;
        game.player1_rounds_won = 0;
        game.player2_rounds_won = 0;
        game.player1_move_commitment = None;
        game.player2_move_commitment = None;
        game.winner = None;
        game.created_at = Clock::get()?.unix_timestamp;
        
        // Deduct points for points games
        if currency_type == CurrencyType::Points {
            let user_profile = &mut ctx.accounts.user_profile;
            user_profile.points_balance -= stake_amount;
        }
        
        msg!("Game {} created by {}", game.game_id, ctx.accounts.user.key());
        Ok(())
    }

    pub fn join_game(ctx: Context<JoinGame>, _game_id: String) -> Result<()> {
        // Validate game can be joined
        require!(ctx.accounts.game.game_status == GameStatus::WaitingForPlayer, GameError::GameNotJoinable);
        require!(ctx.accounts.game.player1 != ctx.accounts.user.key(), GameError::CannotJoinOwnGame);
        require!(ctx.accounts.game.player2.is_none(), GameError::GameAlreadyFull);
        
        // For points games, check if user has enough points and deduct them
        if ctx.accounts.game.currency_type == CurrencyType::Points {
            require!(
                ctx.accounts.user_profile.points_balance >= ctx.accounts.game.stake_amount,
                GameError::InsufficientPoints
            );
            ctx.accounts.user_profile.points_balance -= ctx.accounts.game.stake_amount;
        } else if ctx.accounts.game.currency_type == CurrencyType::Sol {
            // For SOL games, transfer the stake amount to the game account
            require!(
                **ctx.accounts.user.lamports.borrow() >= ctx.accounts.game.stake_amount,
                GameError::InsufficientSol
            );
            
            // Transfer SOL from user to game account
            anchor_lang::solana_program::program::invoke(
                &anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.user.key(),
                    &ctx.accounts.game.key(),
                    ctx.accounts.game.stake_amount,
                ),
                &[
                    ctx.accounts.user.to_account_info(),
                    ctx.accounts.game.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }
        
        let game = &mut ctx.accounts.game;
        game.player2 = Some(ctx.accounts.user.key());
        game.game_status = GameStatus::InProgress;
        
        msg!("Player {} joined game {}", ctx.accounts.user.key(), game.game_id);
        Ok(())
    }

    pub fn commit_move(ctx: Context<CommitMove>, _game_id: String, move_commitment: [u8; 32]) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let player = ctx.accounts.user.key();
        
        // Validate game is in progress
        require!(game.game_status == GameStatus::InProgress, GameError::GameNotInProgress);
        
        // Validate user is a player
        require!(
            player == game.player1 || player == game.player2.unwrap_or(game.player1),
            GameError::NotAPlayer
        );
        
        // Commit the move
        if player == game.player1 {
            require!(game.player1_move_commitment.is_none(), GameError::MoveAlreadyCommitted);
            game.player1_move_commitment = Some(move_commitment);
        } else {
            require!(game.player2_move_commitment.is_none(), GameError::MoveAlreadyCommitted);
            game.player2_move_commitment = Some(move_commitment);
        }
        
        msg!("Move committed for player {} in game {}", player, game.game_id);
        Ok(())
    }

    pub fn reveal_move(
        ctx: Context<RevealMove>,
        _game_id: String,
        player_move: Move,
        nonce: u64,
    ) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let player = ctx.accounts.user.key();
        
        // Validate game is in progress
        require!(game.game_status == GameStatus::InProgress, GameError::GameNotInProgress);
        
        // Validate user is a player
        require!(
            player == game.player1 || player == game.player2.unwrap_or(game.player1),
            GameError::NotAPlayer
        );
        
        // Validate commitment exists
        let commitment = if player == game.player1 {
            require!(game.player1_move_commitment.is_some(), GameError::MoveNotCommitted);
            game.player1_move_commitment.unwrap()
        } else {
            require!(game.player2_move_commitment.is_some(), GameError::MoveNotCommitted);
            game.player2_move_commitment.unwrap()
        };
        
        // Validate the revealed move matches the commitment
        let expected_commitment = hash_move(player_move, nonce);
        require!(commitment == expected_commitment, GameError::InvalidCommitment);
        
        // Store the revealed move (in a real implementation, you'd store this)
        // For now, we'll process both moves if both are revealed
        
        // Check if both moves are committed
        if game.player1_move_commitment.is_some() && game.player2_move_commitment.is_some() {
            // Both moves are committed, but we need both revealed to determine winner
            // This is a simplified version - in reality, you'd store revealed moves separately
            msg!("Move revealed for player {} in game {}", player, game.game_id);
        }
        
        Ok(())
    }

    pub fn process_round(
        ctx: Context<ProcessRound>,
        _game_id: String,
        player1_move: Move,
        player1_nonce: u64,
        player2_move: Move,
        player2_nonce: u64,
    ) -> Result<()> {
        let game = &mut ctx.accounts.game;
        
        // Validate game is in progress
        require!(game.game_status == GameStatus::InProgress, GameError::GameNotInProgress);
        
        // Validate both moves are committed
        require!(
            game.player1_move_commitment.is_some() && game.player2_move_commitment.is_some(),
            GameError::BothMovesNotCommitted
        );
        
        // Validate the moves match the commitments
        let player1_commitment = hash_move(player1_move, player1_nonce);
        let player2_commitment = hash_move(player2_move, player2_nonce);
        
        require!(
            game.player1_move_commitment.unwrap() == player1_commitment,
            GameError::InvalidCommitment
        );
        require!(
            game.player2_move_commitment.unwrap() == player2_commitment,
            GameError::InvalidCommitment
        );
        
        // Determine round winner
        let round_result = determine_winner(player1_move, player2_move);
        
        match round_result {
            RoundResult::Player1Win => {
                game.player1_rounds_won += 1;
                msg!("Round {} won by Player 1", game.current_round);
            },
            RoundResult::Player2Win => {
                game.player2_rounds_won += 1;
                msg!("Round {} won by Player 2", game.current_round);
            },
            RoundResult::Draw => {
                msg!("Round {} is a draw", game.current_round);
            }
        }
        
        // Check if game is complete
        if game.player1_rounds_won >= game.rounds_to_win {
            game.game_status = GameStatus::Finished;
            game.winner = Some(game.player1);
            msg!("Game {} completed! Winner: Player 1", game.game_id);
        } else if game.player2_rounds_won >= game.rounds_to_win {
            game.game_status = GameStatus::Finished;
            game.winner = Some(game.player2.unwrap());
            msg!("Game {} completed! Winner: Player 2", game.game_id);
        } else {
            // Prepare for next round
            game.current_round += 1;
            game.player1_move_commitment = None;
            game.player2_move_commitment = None;
            msg!("Round {} completed, starting round {}", game.current_round - 1, game.current_round);
        }
        
        Ok(())
    }

    pub fn set_winner(ctx: Context<SetWinner>, _game_id: String, winner: Pubkey) -> Result<()> {
        let game = &mut ctx.accounts.game;
        
        // Validate game is in progress
        require!(game.game_status == GameStatus::InProgress, GameError::GameNotInProgress);
        
        // Validate winner is one of the players
        require!(
            winner == game.player1 || winner == game.player2.unwrap_or(game.player1),
            GameError::NotAPlayer
        );
        
        // Set winner and mark game as finished
        game.winner = Some(winner);
        game.game_status = GameStatus::Finished;
        
        msg!("Game {} winner set to: {}", game.game_id, winner);
        Ok(())
    }

    pub fn finalize_game(ctx: Context<FinalizeGameWithReferral>, _game_id: String) -> Result<()> {
        // Validate game is finished
        require!(ctx.accounts.game.game_status == GameStatus::Finished, GameError::GameNotFinished);
        require!(ctx.accounts.game.winner.is_some(), GameError::NoWinner);
        
        let winner_key = ctx.accounts.game.winner.unwrap();
        let total_pot = ctx.accounts.game.stake_amount * 2;
        
        // Update stats for both players
        let player1_profile = &mut ctx.accounts.player1_profile;
        let player2_profile = &mut ctx.accounts.player2_profile;
        
        // Determine which profile is the winner
        msg!("DEBUG: winner_key = {}", winner_key);
        msg!("DEBUG: game.player1 = {}", ctx.accounts.game.player1);
        msg!("DEBUG: game.player2 = {:?}", ctx.accounts.game.player2);
        
        if winner_key == ctx.accounts.game.player1 {
            // Player 1 is the winner
            player1_profile.wins += 1;
            player1_profile.total_games += 1;
            player2_profile.losses += 1;
            player2_profile.total_games += 1;
            
            // Distribute rewards based on currency type
            if ctx.accounts.game.currency_type == CurrencyType::Points {
                // Winner gets full pot for points games
                player1_profile.points_balance += total_pot;
                player1_profile.total_points_earned += total_pot;
            } else if ctx.accounts.game.currency_type == CurrencyType::Sol {
                // For SOL games, use dynamic fee based on stake amount
                let fee_rate = get_platform_fee_rate(ctx.accounts.game.stake_amount);
                let total_fees = total_pot * fee_rate / 10000; // fee_rate is in basis points
                let winner_amount = total_pot - total_fees;
                
                // Check if winner has a referrer AND this is their first game - take 1% from platform fee
                if let Some(referrer_key) = player1_profile.referred_by {
                    if referrer_key == ctx.accounts.referrer.key() && player1_profile.total_games == 0 {
                        let referral_commission = total_pot / 100; // 1% of total pot
                        let platform_fee_amount = total_fees - referral_commission; // Reduce platform fee by referral amount
                        
                        // Transfer commission to referrer
                        **ctx.accounts.game.to_account_info().try_borrow_mut_lamports()? -= referral_commission;
                        **ctx.accounts.referrer.to_account_info().try_borrow_mut_lamports()? += referral_commission;
                        
                        // Transfer remaining platform fee to platform wallet
                        **ctx.accounts.game.to_account_info().try_borrow_mut_lamports()? -= platform_fee_amount;
                        **ctx.accounts.platform_wallet.to_account_info().try_borrow_mut_lamports()? += platform_fee_amount;
                        
                        // Update referrer's earnings
                        ctx.accounts.referrer_profile.referral_earnings += referral_commission;
                        
                        msg!("Referral commission: {} lamports ({} SOL) transferred to referrer {} (taken from platform fee)", 
                            referral_commission,
                            referral_commission as f64 / LAMPORTS_PER_SOL as f64,
                            referrer_key
                        );
                    } else {
                        // Referrer key doesn't match - no referral commission
                        **ctx.accounts.game.to_account_info().try_borrow_mut_lamports()? -= total_fees;
                        **ctx.accounts.platform_wallet.to_account_info().try_borrow_mut_lamports()? += total_fees;
                    }
                } else {
                    // No referrer - all fees go to platform
                    **ctx.accounts.game.to_account_info().try_borrow_mut_lamports()? -= total_fees;
                    **ctx.accounts.platform_wallet.to_account_info().try_borrow_mut_lamports()? += total_fees;
                }
                
                // Transfer from game escrow to player1 (the actual winner)
                **ctx.accounts.game.to_account_info().try_borrow_mut_lamports()? -= winner_amount;
                **ctx.accounts.player1.to_account_info().try_borrow_mut_lamports()? += winner_amount;
                
                // SOL game winners also get 100 bonus points
                player1_profile.points_balance += 100;
                
                // Record the points equivalent for stats (including bonus)
                player1_profile.total_points_earned += winner_amount + 100;
                
                msg!("Transferred {} lamports ({} SOL) to winner {} (Player1) + 100 bonus points, fee rate: {}%", 
                    winner_amount,
                    winner_amount as f64 / anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL as f64,
                    winner_key,
                    fee_rate as f64 / 100.0
                );
                
                msg!("Platform fee: {} lamports ({} SOL) transferred to platform wallet {}", 
                    total_fees,
                    total_fees as f64 / anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL as f64,
                    ctx.accounts.platform_wallet.key()
                );
            }
        } else {
            // Player 2 is the winner
            player2_profile.wins += 1;
            player2_profile.total_games += 1;
            player1_profile.losses += 1;
            player1_profile.total_games += 1;
            
            // Distribute rewards based on currency type
            if ctx.accounts.game.currency_type == CurrencyType::Points {
                // Winner gets full pot for points games
                player2_profile.points_balance += total_pot;
                player2_profile.total_points_earned += total_pot;
            } else if ctx.accounts.game.currency_type == CurrencyType::Sol {
                // For SOL games, use dynamic fee based on stake amount
                let fee_rate = get_platform_fee_rate(ctx.accounts.game.stake_amount);
                let total_fees = total_pot * fee_rate / 10000; // fee_rate is in basis points
                let winner_amount = total_pot - total_fees;
                
                // Check if winner has a referrer - take 1% from platform fee
                if let Some(referrer_key) = player2_profile.referred_by {
                    if referrer_key == ctx.accounts.referrer.key() {
                        let referral_commission = total_pot / 100; // 1% of total pot
                        let platform_fee_amount = total_fees - referral_commission; // Reduce platform fee by referral amount
                        
                        // Transfer commission to referrer
                        **ctx.accounts.game.to_account_info().try_borrow_mut_lamports()? -= referral_commission;
                        **ctx.accounts.referrer.to_account_info().try_borrow_mut_lamports()? += referral_commission;
                        
                        // Transfer remaining platform fee to platform wallet
                        **ctx.accounts.game.to_account_info().try_borrow_mut_lamports()? -= platform_fee_amount;
                        **ctx.accounts.platform_wallet.to_account_info().try_borrow_mut_lamports()? += platform_fee_amount;
                        
                        // Update referrer's earnings
                        ctx.accounts.referrer_profile.referral_earnings += referral_commission;
                        
                        msg!("Referral commission: {} lamports ({} SOL) transferred to referrer {} (taken from platform fee)", 
                            referral_commission,
                            referral_commission as f64 / LAMPORTS_PER_SOL as f64,
                            referrer_key
                        );
                    } else {
                        // Referrer key doesn't match - no referral commission
                        **ctx.accounts.game.to_account_info().try_borrow_mut_lamports()? -= total_fees;
                        **ctx.accounts.platform_wallet.to_account_info().try_borrow_mut_lamports()? += total_fees;
                    }
                } else {
                    // No referrer - all fees go to platform
                    **ctx.accounts.game.to_account_info().try_borrow_mut_lamports()? -= total_fees;
                    **ctx.accounts.platform_wallet.to_account_info().try_borrow_mut_lamports()? += total_fees;
                }
                
                // Transfer from game escrow to player2 (the actual winner)
                **ctx.accounts.game.to_account_info().try_borrow_mut_lamports()? -= winner_amount;
                **ctx.accounts.player2.to_account_info().try_borrow_mut_lamports()? += winner_amount;
                
                // SOL game winners also get 100 bonus points
                player2_profile.points_balance += 100;
                
                // Record the points equivalent for stats (including bonus)
                player2_profile.total_points_earned += winner_amount + 100;
                
                msg!("Transferred {} lamports ({} SOL) to winner {} (Player2) + 100 bonus points, fee rate: {}%", 
                    winner_amount,
                    winner_amount as f64 / anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL as f64,
                    winner_key,
                    fee_rate as f64 / 100.0
                );
                
                msg!("Platform fee: {} lamports ({} SOL) transferred to platform wallet {}", 
                    total_fees,
                    total_fees as f64 / anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL as f64,
                    ctx.accounts.platform_wallet.key()
                );
            }
        }
        
        msg!(
            "Game {} finalized! Winner: {}, Pot: {}",
            ctx.accounts.game.game_id,
            winner_key,
            total_pot
        );
        
        Ok(())
    }
}

// Account validation structures
#[derive(Accounts)]
pub struct InitializeUserProfile<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 8 + 4 + 4 + 4 + 8 + 8 + 33 + 4 + 8 + 8, // discriminator + points_balance + wins + losses + total_games + total_points_earned + referral_code + referred_by + referral_count + referral_earnings + created_at
        seeds = [b"user_profile", user.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetReferrer<'info> {
    #[account(
        mut,
        seeds = [b"user_profile", user.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(
        mut,
        seeds = [b"user_profile", referrer.key().as_ref()],
        bump
    )]
    pub referrer_profile: Account<'info, UserProfile>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: This account is validated by the referrer_profile seeds
    pub referrer: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct CreateGame<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 33 + 1 + 8 + 1 + 1 + 1 + 1 + 1 + 33 + 33 + 33 + 8, // discriminator + game data
        seeds = [b"game", game_id.as_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(
        mut,
        seeds = [b"user_profile", user.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct JoinGame<'info> {
    #[account(
        mut,
        seeds = [b"game", game_id.as_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(
        mut,
        seeds = [b"user_profile", user.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct CommitMove<'info> {
    #[account(
        mut,
        seeds = [b"game", game_id.as_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct RevealMove<'info> {
    #[account(
        mut,
        seeds = [b"game", game_id.as_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct ProcessRound<'info> {
    #[account(
        mut,
        seeds = [b"game", game_id.as_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct SetWinner<'info> {
    #[account(
        mut,
        seeds = [b"game", game_id.as_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct FinalizeGameWithReferral<'info> {
    #[account(
        mut,
        seeds = [b"game", game_id.as_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(
        mut,
        seeds = [b"user_profile", game.player1.as_ref()],
        bump
    )]
    pub player1_profile: Account<'info, UserProfile>,
    
    #[account(
        mut,
        seeds = [b"user_profile", game.player2.unwrap().as_ref()],
        bump
    )]
    pub player2_profile: Account<'info, UserProfile>,
    
    /// CHECK: This account is checked against the game's player1 field
    #[account(mut, address = game.player1)]
    pub player1: UncheckedAccount<'info>,
    
    /// CHECK: This account is checked against the game's player2 field
    #[account(mut, address = game.player2.unwrap())]
    pub player2: UncheckedAccount<'info>,
    
    /// CHECK: Platform wallet for collecting fees
    #[account(mut)]
    pub platform_wallet: UncheckedAccount<'info>,
    
    /// CHECK: Referrer account for commission payouts (can be same as platform_wallet if no referrer)
    #[account(mut)]
    pub referrer: UncheckedAccount<'info>,
    
    /// Referrer profile for tracking earnings (can be any profile if no referrer)
    #[account(mut)]
    pub referrer_profile: Account<'info, UserProfile>,
    
    pub system_program: Program<'info, System>,
}

// Game state and user profile structures
#[account]
pub struct Game {
    pub game_id: String,
    pub player1: Pubkey,
    pub player2: Option<Pubkey>,
    pub game_status: GameStatus,
    pub stake_amount: u64,
    pub currency_type: CurrencyType,
    pub rounds_to_win: u8,
    pub current_round: u8,
    pub player1_rounds_won: u8,
    pub player2_rounds_won: u8,
    pub player1_move_commitment: Option<[u8; 32]>,
    pub player2_move_commitment: Option<[u8; 32]>,
    pub winner: Option<Pubkey>,
    pub created_at: i64,
}

#[account]
pub struct UserProfile {
    pub points_balance: u64,
    pub wins: u32,
    pub losses: u32,
    pub total_games: u32,
    pub total_points_earned: u64,
    pub referral_code: [u8; 8], // 8-character referral code
    pub referred_by: Option<Pubkey>, // Who referred this user
    pub referral_count: u32, // Number of users this user has referred
    pub referral_earnings: u64, // Total SOL earned from referrals in lamports
    pub created_at: i64,
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameStatus {
    WaitingForPlayer,
    InProgress,
    Finished,
    Abandoned,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum CurrencyType {
    Points,
    Sol,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Move {
    Rock,
    Paper,
    Scissors,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RoundResult {
    Player1Win,
    Player2Win,
    Draw,
}

// Error definitions
#[error_code]
pub enum GameError {
    #[msg("Game ID too long (max 32 characters)")]
    GameIdTooLong,
    #[msg("Invalid stake amount")]
    InvalidStakeAmount,
    #[msg("Invalid rounds to win")]
    InvalidRoundsToWin,
    #[msg("Game not joinable")]
    GameNotJoinable,
    #[msg("Cannot join own game")]
    CannotJoinOwnGame,
    #[msg("Game already full")]
    GameAlreadyFull,
    #[msg("Game not in progress")]
    GameNotInProgress,
    #[msg("Move already committed")]
    MoveAlreadyCommitted,
    #[msg("Move not committed")]
    MoveNotCommitted,
    #[msg("Both moves not committed")]
    BothMovesNotCommitted,
    #[msg("Not a player")]
    NotAPlayer,
    #[msg("Game not finished")]
    GameNotFinished,
    #[msg("No winner")]
    NoWinner,
    #[msg("Insufficient points")]
    InsufficientPoints,
    #[msg("Insufficient SOL")]
    InsufficientSol,
    #[msg("Invalid commitment")]
    InvalidCommitment,
    #[msg("Invalid referral code")]
    InvalidReferralCode,
    #[msg("Cannot refer yourself")]
    CannotReferYourself,
    #[msg("Referrer already set")]
    ReferrerAlreadySet,
}

/// Calculate platform fee based on stake amount
/// Returns fee percentage as basis points (e.g., 500 = 5%)
pub fn get_platform_fee_rate(stake_amount: u64) -> u64 {
    // Convert lamports to SOL for comparison
    let stake_sol = stake_amount as f64 / anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL as f64;
    
    if stake_sol <= 0.01 {
        500  // 5% = 500 basis points
    } else if stake_sol <= 0.05 {
        300  // 3% = 300 basis points  
    } else {
        200  // 2% = 200 basis points
    }
}

pub fn hash_move(player_move: Move, nonce: u64) -> [u8; 32] {
    let move_byte = match player_move {
        Move::Rock => 0u8,
        Move::Paper => 1u8,
        Move::Scissors => 2u8,
    };
    
    let mut data = Vec::new();
    data.push(move_byte);
    data.extend_from_slice(&nonce.to_le_bytes());
    
    anchor_lang::solana_program::hash::hash(&data).to_bytes()
}

pub fn generate_referral_code(pubkey: &Pubkey) -> [u8; 8] {
    let hash = anchor_lang::solana_program::hash::hash(pubkey.as_ref());
    let mut code = [0u8; 8];
    
    // Use first 8 bytes of hash and convert to alphanumeric
    for i in 0..8 {
        let byte = hash.to_bytes()[i];
        // Convert to alphanumeric (A-Z, 0-9)
        code[i] = match byte % 36 {
            0..=25 => b'A' + (byte % 26),
            _ => b'0' + (byte % 10),
        };
    }
    
    code
}

pub fn determine_winner(move1: Move, move2: Move) -> RoundResult {
    match (move1, move2) {
        (Move::Rock, Move::Scissors) | (Move::Paper, Move::Rock) | (Move::Scissors, Move::Paper) => RoundResult::Player1Win,
        (Move::Scissors, Move::Rock) | (Move::Rock, Move::Paper) | (Move::Paper, Move::Scissors) => RoundResult::Player2Win,
        _ => RoundResult::Draw,
    }
}
