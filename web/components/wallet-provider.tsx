"use client"

import React, { useMemo, useCallback } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { 
  PhantomWalletAdapter, 
  SolflareWalletAdapter, 
  CoinbaseWalletAdapter
} from '@solana/wallet-adapter-wallets'
import { SolanaMobileWalletAdapter } from '@solana-mobile/wallet-adapter-mobile'
import { clusterApiUrl } from '@solana/web3.js'
import type { WalletError } from '@solana/wallet-adapter-base'

interface WalletContextProviderProps {
  children: React.ReactNode
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  const endpoint = useMemo(() => clusterApiUrl('devnet'), [])
  
  const wallets = useMemo(() => {
    const baseWallets = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
    ]

    // Add mobile support
    if (typeof window !== 'undefined') {
      try {
        baseWallets.unshift(
          new SolanaMobileWalletAdapter({
            appIdentity: {
              name: 'RPS Arena',
              uri: window.location.origin,
              icon: '/favicon.ico',
            },
            cluster: 'devnet',
          })
        )
      } catch {
        // Mobile wallet not available, continue without it
      }
    }

    return baseWallets
  }, [])

  const onError = useCallback((error: WalletError) => {
    // Log all errors for debugging
    console.error('Wallet error:', error.name, error.message)
    
    // Only show user-facing errors for actionable issues
    if (error.name === 'WalletNotFoundError') {
      // User can install a wallet - this is actionable
      console.info('No Solana wallet found. Please install Phantom, Solflare, or another Solana wallet.')
    } else if (error.name === 'WalletConnectionError') {
      // Connection issues - usually temporary
      console.info('Wallet connection failed. Please try again.')
    }
    // All other errors (UserRejectedRequestError, etc.) are either user choices or technical issues
    // that don't need user notification
  }, [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true}
        onError={onError}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
} 