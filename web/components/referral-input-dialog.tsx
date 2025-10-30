'use client'

import { useState } from 'react'
import { Gift, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useReferral } from '@/hooks/use-referral'

interface ReferralInputDialogProps {
  trigger?: React.ReactNode | null
  onSuccess?: (bonus: number) => void
  initialCode?: string
  autoOpen?: boolean
}

export function ReferralInputDialog({ trigger, onSuccess, initialCode, autoOpen }: ReferralInputDialogProps) {
  const [open, setOpen] = useState(autoOpen || false)
  const [code, setCode] = useState(initialCode || '')
  const [validating, setValidating] = useState(false)
  const [creating, setCreating] = useState(false)
  
  const { validateReferralCode, createReferral } = useReferral()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!code.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a referral code',
        variant: 'destructive',
      })
      return
    }

    setValidating(true)

    try {
      // First validate the code
      const validation = await validateReferralCode(code.trim().toUpperCase())
      
      if (!validation.valid) {
        toast({
          title: 'Invalid Code',
          description: validation.error || 'Referral code not found',
          variant: 'destructive',
        })
        setValidating(false)
        return
      }

      setValidating(false)
      setCreating(true)

      // Create the referral relationship
      const result = await createReferral(code.trim().toUpperCase())
      
      if (!result.success) {
        toast({
          title: 'Error',
          description: result.error || 'Failed to apply referral code',
          variant: 'destructive',
        })
        setCreating(false)
        return
      }

      toast({
        title: 'Success!',
        description: `You received ${result.signupBonus} points! Referrer received ${result.referrerBonus} points.`,
      })

      onSuccess?.(result.signupBonus || 100)
      setOpen(false)
      setCode('')
      
    } catch (error) {
      console.error('Error processing referral:', error)
      toast({
        title: 'Error',
        description: 'An error occurred while processing the referral code',
        variant: 'destructive',
      })
    } finally {
      setValidating(false)
      setCreating(false)
    }
  }

  const isLoading = validating || creating

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-800/50 hover:text-white">
              <Gift className="h-4 w-4 mr-2" />
              I have a referral code
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px] bg-gray-900/95 border-gray-700/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Gift className="h-5 w-5 text-purple-400" />
            Referral Code
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Enter your friend's referral code to get bonus points
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="referral-code" className="text-gray-300">Referral Code</Label>
            <Input
              id="referral-code"
              placeholder="Enter 8-character code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              disabled={isLoading}
              className="font-mono bg-gray-800/80 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20"
            />
          </div>
          
          <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg">
            <h4 className="font-medium text-purple-100 mb-2">
              What you'll get:
            </h4>
            <ul className="text-sm text-purple-200 space-y-1">
              <li>• +100 points immediately upon signup</li>
              <li>• Your friend gets +50 points</li>
              <li>• +25 points to friend for your first game</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800/50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {validating ? 'Validating...' : creating ? 'Applying...' : 'Apply Code'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
