import React from 'react'
import { COLORS } from '../app/config/constants'
import type { WhatIfResponse } from '../atlas/types'

/**
 * ComparePanel — side-by-side comparison.
 *
 * "How things stand now" vs "If this happens..."
 * ZERO jargon. No "baseline." No "altered future."
 */

interface Props {
  whatIf: WhatIfResponse | null
  visible: boolean
}

export default function ComparePanel({ whatIf, visible }: Props) {
  if (!visible || !whatIf) return null

  return (
    <div style={{
      position: 'absolute',
      top: 60,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 24,
      padding: '16px 24px',
      background: 'rgba(10, 10, 18, 0.88)',
      borderRadius: 16,
      backdropFilter: 'blur(12px)',
      zIndex: 30,
      maxWidth: '90vw',
    }}>
      {/* How things stand now */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{
          color: COLORS.textSecondary,
          fontSize: 11,
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          marginBottom: 8,
          letterSpacing: 0.5,
        }}>
          How things stand now
        </div>
        {whatIf.deltas.map((d, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>{d.label}</span>
            <span style={{ color: COLORS.textPrimary, fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{d.baseline}</span>
          </div>
        ))}
        {whatIf.household_delta && (
          <div style={{
            marginTop: 8,
            padding: '8px 0',
            borderTop: `1px solid ${COLORS.textSecondary}22`,
            color: COLORS.textPrimary,
            fontSize: 14,
            fontWeight: 'bold',
          }}>
            {whatIf.household_delta.baseline_display}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{
        width: 1,
        background: `${COLORS.textSecondary}33`,
        alignSelf: 'stretch',
      }} />

      {/* If this happens... */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{
          color: whatIf.direction === 'worsens' ? COLORS.danger : COLORS.success,
          fontSize: 11,
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          marginBottom: 8,
          letterSpacing: 0.5,
        }}>
          If this happens...
        </div>
        {whatIf.deltas.map((d, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>{d.label}</span>
            <span style={{
              color: whatIf.direction === 'worsens' ? COLORS.danger : COLORS.success,
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
            }}>{d.altered}</span>
          </div>
        ))}
        {whatIf.household_delta && (
          <div style={{
            marginTop: 8,
            padding: '8px 0',
            borderTop: `1px solid ${COLORS.textSecondary}22`,
            color: whatIf.direction === 'worsens' ? COLORS.danger : COLORS.success,
            fontSize: 14,
            fontWeight: 'bold',
          }}>
            {whatIf.household_delta.scenario_display}
          </div>
        )}
      </div>
    </div>
  )
}
