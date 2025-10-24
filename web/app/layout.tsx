import type { Metadata, Viewport } from 'next'
import { Orbitron } from 'next/font/google'
import './globals.css'
import { WalletContextProvider } from "@/components/wallet-provider"

const orbitron = Orbitron({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RPS Magic Block - Rock Paper Scissors on Solana',
  description: 'Play Rock Paper Scissors on the Solana blockchain. Stake SOL, challenge players, and climb the leaderboard in this exciting Web3 game.',
  icons: {
    icon: [
      {
        url: '/icons/logo.svg',
        type: 'image/svg+xml',
      }
    ],
    apple: [
      {
        url: '/icons/logo.svg',
        type: 'image/svg+xml',
      }
    ],
  },
  manifest: '/manifest.json',
  openGraph: {
    title: '🎮 RPS Magic Block - Rock Paper Scissors on Solana',
    description: 'Play Rock Paper Scissors on the Solana blockchain! Stake SOL, challenge players, and climb the leaderboard in this exciting Web3 game. 🚀',
    url: 'https://rps-test-front.onrender.com',
    siteName: 'RPS Magic Block',
    images: [
      {
        url: '/placeholder.jpg',
        width: 1200,
        height: 630,
        alt: 'RPS Magic Block - Rock Paper Scissors on Solana',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '🎮 RPS Magic Block - Rock Paper Scissors on Solana',
    description: 'Play Rock Paper Scissors on the Solana blockchain! Stake SOL, challenge players, and climb the leaderboard in this exciting Web3 game. 🚀',
    images: ['/placeholder.jpg'],
    creator: '@lera_valera_4',
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={orbitron.className}>
      <body>
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
        
        {/* Microsoft Clarity Analytics */}
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "tvaz76na92");
            `
          }}
        />
      </body>
    </html>
  )
}
