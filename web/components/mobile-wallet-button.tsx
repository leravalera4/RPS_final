"use client"

import React from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { isMobileDevice, isInWalletBrowser, showMobileWalletModal } from '@/utils/mobile-wallet-deeplinks'

interface MobileWalletButtonProps {
  children: React.ReactNode
  className?: string
}

export function MobileWalletButton({ children, className = '' }: MobileWalletButtonProps) {
  const { select, wallets, publicKey, connecting } = useWallet()

  const handleConnect = () => {
    const isMobile = isMobileDevice()
    const isInWallet = isInWalletBrowser()

    if (isMobile && !isInWallet) {
      // On mobile browser (not in wallet), show deeplink modal
      showMobileWalletModal()
      return
    }

    // Desktop or in-app browser - use regular wallet adapter
    // Try to find mobile wallet adapter first, fallback to Phantom
    const mobileWallet = wallets.find(wallet => 
      wallet.adapter.name.toLowerCase().includes('mobile') ||
      wallet.adapter.name.toLowerCase().includes('solana mobile')
    )
    
    const phantomWallet = wallets.find(wallet => 
      wallet.adapter.name.toLowerCase().includes('phantom')
    )
    
    const walletToUse = mobileWallet || phantomWallet || wallets[0]
    
    if (walletToUse) {
      select(walletToUse.adapter.name)
    }
  }

  if (publicKey) {
    return <>{children}</>
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className={`${className} ${connecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {connecting ? 'Connecting...' : children}
    </button>
  )
}

export default MobileWalletButton