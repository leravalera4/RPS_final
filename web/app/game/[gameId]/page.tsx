"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { EphemeralStatus } from '../../../components/ephemeral-status'

interface GamePageProps {
  params: Promise<{ gameId: string }>
}

export default function GamePage({ params }: GamePageProps) {
  const router = useRouter()
  const { authenticated } = usePrivy()
  const connected = authenticated // Use Privy authentication state

  useEffect(() => {
    const initializeGame = async () => {
      const { gameId } = await params
      
      if (!gameId) {
        console.error('No game ID provided')
        router.replace('/')
        return
      }

      console.log('🔗 Game page loaded for:', gameId)
      
      // Validate game exists by calling backend API
      try {
        const response = await fetch(`http://localhost:3001/api/games/${gameId}`)
        const data = await response.json()
        
        if (!data.success || !data.game) {
          console.error('❌ Game not found:', gameId)
          alert('Game not found or no longer available')
          router.replace('/')
          return
        }

        console.log('✅ Game validated, storing for auto-join')
        
        // Store the game ID and mark it for immediate joining (skip confirmation)
        sessionStorage.setItem('autoJoinGameId', gameId)
        sessionStorage.setItem('autoJoinSkipConfirmation', 'true')
        
        // Use replace instead of push to avoid back button issues and reduce redirect flicker
        router.replace('/')
        
      } catch (error) {
        console.error('❌ Error validating game:', error)
        alert('Unable to connect to game server')
        router.replace('/')
      }
    }

    initializeGame()
  }, [params, router])

  // Show loading state while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-bold text-purple-400 mb-2">Joining Game...</h2>
        <p className="text-gray-400">Please wait while we connect you to the game</p>
      </div>
    </div>
  )
} 