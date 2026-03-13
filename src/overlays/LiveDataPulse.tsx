import React from 'react'
import { COLORS } from '../app/config/constants'
import type { LiveParameters } from '../atlas/types'

/**
 * LiveDataPulse — "Updated X hours ago" with a live pulse.
 * Live data makes it real. No jargon.
 */

interface Props {
  liveParams: LiveParameters | null
  visible: boolean
}

export default function LiveDataPulse({ liveParams, visible }: Props) {
  if (!visible || !liveParams) return null

  const hours = Math.floor((Date.now() - new Date(liveParams.updated_at).getTime()) / (1000 * 60 * 60))
  const timeText = hours < 1 ? 'Updated just now' : `Updated ${hours} hours ago`

  const oilPrice = liveParams.parameters.brent_crude_usd?.value
  const hormuzTransits = liveParams.parameters.ais_hormuz_transits?.value
  const crisisDay = liveParams.crisis_day

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: 20,
      zIndex: 30,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 6,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: 'rgba(10, 10, 18, 0.75)',
        borderRadius: 20,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: COLORS.success,
          animation: 'pulse 2s ease-in-out infinite',
        }} />
        <span style={{
          color: COLORS.textSecondary,
          fontSize: 11,
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
        }}>
          {timeText}
        </span>
      </div>

      {oilPrice !== undefined && (
        <div style={{
          padding: '4px 10px',
          background: 'rgba(10, 10, 18, 0.6)',
          borderRadius: 12,
          color: COLORS.textSecondary,
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          Oil ${typeof oilPrice === 'number' ? oilPrice.toFixed(1) : oilPrice} · Day {crisisDay}
          {hormuzTransits === 0 && ' · Hormuz closed'}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
