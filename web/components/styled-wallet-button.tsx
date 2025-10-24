"use client"

import React, { useState, useEffect } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

export function StyledWalletButton() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button 
        className="!bg-gradient-to-r !from-purple-600 !via-purple-700 !to-pink-600 hover:!from-purple-700 hover:!via-purple-800 hover:!to-pink-700 !text-white !rounded-lg !px-3 !py-2 sm:!px-4 sm:!py-2 lg:!px-6 lg:!py-3 !font-bold !border-0 !shadow-xl hover:!shadow-2xl !transition-all !duration-300 !transform hover:!scale-105 !text-sm sm:!text-base whitespace-nowrap"
        disabled
      >
        Select Wallet
      </button>
    )
  }

  return (
    <WalletMultiButton 
      className="wallet-adapter-button-trigger !bg-gradient-to-r !from-purple-600 !via-purple-700 !to-pink-600 hover:!from-purple-700 hover:!via-purple-800 hover:!to-pink-700 !text-white !rounded-lg !px-3 !py-2 sm:!px-4 sm:!py-2 lg:!px-6 lg:!py-3 !font-bold !border-0 !shadow-xl hover:!shadow-2xl !transition-all !duration-300 !transform hover:!scale-105 !text-sm sm:!text-base whitespace-nowrap [&.wallet-adapter-button-connected]:!bg-gray-700 [&.wallet-adapter-button-connected]:hover:!bg-gray-600 [&.wallet-adapter-button-connected]:!shadow-none [&.wallet-adapter-button-connected]:!transform-none [&.wallet-adapter-button-connected]:hover:!scale-100"
    />
  )
} 