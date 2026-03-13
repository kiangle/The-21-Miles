import React from 'react'

declare const __BUILD_COMMIT__: string
declare const __BUILD_BRANCH__: string
declare const __BUILD_TIMESTAMP__: string

const style: React.CSSProperties = {
  position: 'fixed',
  bottom: 8,
  right: 8,
  zIndex: 99999,
  background: 'rgba(0,0,0,0.75)',
  color: '#0f0',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '4px 8px',
  borderRadius: 4,
  pointerEvents: 'none',
  lineHeight: 1.4,
  whiteSpace: 'pre',
}

export default function BuildID() {
  return (
    <div style={style}>
      {__BUILD_BRANCH__}{'\n'}
      {__BUILD_COMMIT__}{'\n'}
      {__BUILD_TIMESTAMP__}
    </div>
  )
}
