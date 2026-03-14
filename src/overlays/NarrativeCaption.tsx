import React, { useState, useEffect } from 'react'
import { COLORS } from '../app/config/constants'

/**
 * NarrativeCaption — ink text displayed as cinematic captions.
 * Short. Sharp. Reveal-oriented. No dashboard DNA.
 */

interface Props {
  text: string
  choices: { text: string; index: number }[]
  onChoose: (index: number) => void
  visible: boolean
}

export default function NarrativeCaption({ text, choices, onChoose, visible }: Props) {
  const [displayText, setDisplayText] = useState('')
  const [showChoices, setShowChoices] = useState(false)

  useEffect(() => {
    if (!visible || !text) {
      setDisplayText('')
      setShowChoices(false)
      return
    }

    // Typewriter effect
    setShowChoices(false)
    let i = 0
    setDisplayText('')
    const interval = setInterval(() => {
      i++
      setDisplayText(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setTimeout(() => setShowChoices(true), 400)
      }
    }, 25)

    return () => clearInterval(interval)
  }, [text, visible])

  if (!visible || !text) return null

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  return (
    <div style={{
      position: 'absolute',
      bottom: isMobile
        ? (choices.length > 0 ? 70 : 50)
        : (choices.length > 0 ? 160 : 80),
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: isMobile ? 'calc(100vw - 24px)' : 600,
      width: isMobile ? 'calc(100vw - 24px)' : undefined,
      padding: isMobile ? '12px 16px' : '20px 32px',
      background: 'rgba(10, 10, 18, 0.88)',
      borderRadius: 12,
      backdropFilter: 'blur(12px)',
      zIndex: 25,
      maxHeight: isMobile ? '35vh' : undefined,
      overflowY: isMobile ? 'auto' : undefined,
    }}>
      <p style={{
        color: COLORS.textPrimary,
        fontSize: isMobile ? 14 : 16,
        lineHeight: isMobile ? 1.5 : 1.7,
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        margin: 0,
        whiteSpace: 'pre-wrap',
      }}>
        {displayText}
      </p>

      {showChoices && choices.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {choices.map((c) => (
            <button
              key={c.index}
              onClick={() => onChoose(c.index)}
              style={{
                background: 'rgba(200, 169, 110, 0.12)',
                border: `1px solid ${COLORS.gold}44`,
                borderRadius: 8,
                padding: '10px 16px',
                color: COLORS.gold,
                fontSize: 14,
                fontFamily: "'Instrument Sans', system-ui, sans-serif",
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(200, 169, 110, 0.25)'
                e.currentTarget.style.borderColor = `${COLORS.gold}88`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(200, 169, 110, 0.12)'
                e.currentTarget.style.borderColor = `${COLORS.gold}44`
              }}
            >
              {c.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
