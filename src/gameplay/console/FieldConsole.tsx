import React from 'react'
import { COLORS } from '../../app/config/constants'
import type { LensId, TimeId, FutureId } from '../../state/machine/worldContext'
import type { WhatIfSummary } from '../../atlas/types'

/**
 * FieldConsole — floating, minimal, always available.
 * Never blocks the stage. Feels like a field instrument.
 * Four controls. No jargon.
 *
 * Follow: "Follow the..." (Shipping · Freight · Medicine · Food)
 * Time: scrubber (Day 1 · Day 3 · Week 1 · Month 1)
 * What next?: "What happens next?" (dynamic from Atlas)
 * Eyes: "See through..." (role names)
 */

interface Props {
  lens: LensId
  time: TimeId
  future: FutureId
  roleId: 'nurse' | 'driver' | null
  whatIfOptions: WhatIfSummary[]
  visible: boolean
  onLens: (lens: LensId) => void
  onTime: (time: TimeId) => void
  onFuture: (future: FutureId) => void
  onSwitchPerspective: () => void
}

const lensOptions: { id: LensId; label: string }[] = [
  { id: 'shipping', label: 'Shipping' },
  { id: 'freight', label: 'Freight' },
  { id: 'medicine', label: 'Medicine' },
  { id: 'household', label: 'Food' },
]

const timeOptions: { id: TimeId; label: string }[] = [
  { id: 'day1', label: 'Day 1' },
  { id: 'day3', label: 'Day 3' },
  { id: 'week1', label: 'Week 1' },
  { id: 'month1', label: 'Month 1' },
]

export default function FieldConsole({
  lens, time, future, roleId, whatIfOptions,
  visible, onLens, onTime, onFuture, onSwitchPerspective,
}: Props) {
  if (!visible) return null

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  return (
    <div style={{
      position: 'absolute',
      bottom: isMobile ? 8 : 20,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: isMobile ? 6 : 12,
      padding: isMobile ? '6px 10px' : '10px 16px',
      background: 'rgba(10, 10, 18, 0.82)',
      borderRadius: isMobile ? 12 : 16,
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(200, 169, 110, 0.15)',
      zIndex: 40,
      flexWrap: 'wrap',
      justifyContent: 'center',
      maxWidth: isMobile ? '96vw' : '90vw',
    }}>
      {/* Follow the... */}
      <ControlGroup label="Follow the...">
        {lensOptions.map(opt => (
          <Chip
            key={opt.id}
            label={opt.label}
            active={lens === opt.id}
            onClick={() => onLens(opt.id)}
          />
        ))}
      </ControlGroup>

      {/* Time scrubber */}
      <ControlGroup label="">
        {timeOptions.map(opt => (
          <Chip
            key={opt.id}
            label={opt.label}
            active={time === opt.id}
            onClick={() => onTime(opt.id)}
          />
        ))}
      </ControlGroup>

      {/* What happens next? */}
      {whatIfOptions.length > 0 && (
        <ControlGroup label="What happens next?">
          {whatIfOptions.map(opt => {
            const futureId = opt.id === 'whatif_redsea' ? 'redSea'
              : opt.id === 'whatif_reserves' ? 'reserves'
              : 'closureEnds'
            return (
              <Chip
                key={opt.id}
                label={opt.label.replace('What if ', '').replace('?', '')}
                active={future === futureId}
                onClick={() => onFuture(futureId as FutureId)}
                color={opt.direction === 'worsens' ? COLORS.danger : COLORS.success}
              />
            )
          })}
        </ControlGroup>
      )}

      {/* See through... */}
      {roleId && (
        <ControlGroup label="See through...">
          <Chip
            label={roleId === 'nurse' ? "Amara's eyes" : "Joseph's eyes"}
            active={true}
            onClick={onSwitchPerspective}
          />
        </ControlGroup>
      )}
    </div>
  )
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      {label && (
        <span style={{
          fontSize: 9,
          color: COLORS.textSecondary,
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          letterSpacing: 0.5,
        }}>
          {label}
        </span>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        {children}
      </div>
    </div>
  )
}

function Chip({ label, active, onClick, color }: {
  label: string
  active: boolean
  onClick: () => void
  color?: string
}) {
  const activeColor = color || COLORS.gold
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  return (
    <button
      onClick={onClick}
      style={{
        padding: isMobile ? '3px 7px' : '4px 10px',
        borderRadius: 12,
        border: `1px solid ${active ? activeColor : 'rgba(255,255,255,0.1)'}`,
        background: active ? `${activeColor}22` : 'transparent',
        color: active ? activeColor : COLORS.textSecondary,
        fontSize: isMobile ? 10 : 11,
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        cursor: 'pointer',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
