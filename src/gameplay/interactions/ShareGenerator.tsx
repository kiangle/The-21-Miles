import React, { useCallback } from 'react'
import { COLORS } from '../../app/config/constants'

/**
 * ShareGenerator — "Show someone"
 *
 * Generates a share card with the key numbers.
 * No "Share your cascade." Just "Show someone."
 */

interface Props {
  currency: string
  monthlyHit: number
  monthlyHitPct: number
  crisisDay: number
  roleName: string
  visible: boolean
}

export default function ShareGenerator({ currency, monthlyHit, monthlyHitPct, crisisDay, roleName, visible }: Props) {
  const shareText = `21 miles of water just took ${monthlyHitPct}% of this family's income. ${currency} ${monthlyHit.toLocaleString()} more every month. Day ${crisisDay}. #21Miles`

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = shareText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }, [shareText])

  const handleTwitter = useCallback(() => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
    window.open(url, '_blank', 'width=600,height=400')
  }, [shareText])

  if (!visible) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 100,
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '20px 28px',
      background: 'rgba(10, 10, 18, 0.92)',
      borderRadius: 16,
      backdropFilter: 'blur(16px)',
      border: `1px solid ${COLORS.gold}33`,
      zIndex: 30,
      textAlign: 'center',
      maxWidth: 400,
    }}>
      <div style={{
        color: COLORS.textPrimary,
        fontSize: 22,
        fontWeight: 'bold',
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        marginBottom: 4,
      }}>
        {currency} {monthlyHit.toLocaleString()}
      </div>
      <div style={{
        color: COLORS.textSecondary,
        fontSize: 13,
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        marginBottom: 16,
      }}>
        extra every month · Day {crisisDay}
      </div>
      <p style={{
        color: COLORS.textPrimary,
        fontSize: 14,
        lineHeight: 1.6,
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        margin: '0 0 16px 0',
      }}>
        {roleName}'s story doesn't end here. Twenty-one miles of water decides
        whether {roleName.toLowerCase().includes('amara') ? 'she can do her job' : 'the medicine reaches the hospital'}.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button
          onClick={handleCopy}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: `1px solid ${COLORS.gold}66`,
            background: 'transparent',
            color: COLORS.gold,
            fontSize: 13,
            fontFamily: "'Instrument Sans', system-ui, sans-serif",
            cursor: 'pointer',
          }}
        >
          Copy
        </button>
        <button
          onClick={handleTwitter}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            background: COLORS.gold,
            color: COLORS.dark,
            fontSize: 13,
            fontFamily: "'Instrument Sans', system-ui, sans-serif",
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Show someone
        </button>
      </div>
    </div>
  )
}
