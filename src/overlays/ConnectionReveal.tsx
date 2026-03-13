import React, { useEffect, useState } from 'react'
import { COLORS } from '../app/config/constants'
import type { ConnectionDiscovery } from '../atlas/types'

/**
 * ConnectionReveal — "You traced a link"
 *
 * No header label needed. The text IS the discovery.
 * Just the text with a subtle visual pulse.
 */

interface Props {
  connections: ConnectionDiscovery[]
  visible: boolean
}

export default function ConnectionReveal({ connections, visible }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (connections.length > 0 && visible) {
      setCurrentIdx(connections.length - 1)
      setShow(true)
      const timer = setTimeout(() => setShow(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [connections, visible])

  if (!show || connections.length === 0) return null

  const conn = connections[currentIdx]
  if (!conn) return null

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: 500,
      padding: '24px 32px',
      background: 'rgba(10, 10, 18, 0.92)',
      borderRadius: 16,
      backdropFilter: 'blur(16px)',
      border: `1px solid ${COLORS.gold}33`,
      zIndex: 35,
      animation: 'fadeInUp 0.8s ease-out',
    }}>
      <div style={{
        color: COLORS.textSecondary,
        fontSize: 11,
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        marginBottom: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}>
        You traced a link
      </div>
      <p style={{
        color: COLORS.textPrimary,
        fontSize: 16,
        lineHeight: 1.7,
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        margin: 0,
      }}>
        {conn.condition}
      </p>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translate(-50%, -45%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </div>
  )
}
