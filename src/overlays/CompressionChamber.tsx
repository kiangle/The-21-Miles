import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { COLORS } from '../app/config/constants'
import type { HouseholdImpactResponse } from '../atlas/types'

/**
 * CompressionChamber — "Your month"
 *
 * Budget is a physical space. As costs arrive, walls close in.
 * What's left at the end is what you have to live on.
 * ZERO labels like "compression chamber." Just the visual + number.
 */

interface Props {
  impact: HouseholdImpactResponse | null
  visible: boolean
  currency: string
}

export default function CompressionChamber({ impact, visible, currency }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !impact || !visible) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const size = 280
    const center = size / 2
    const wallThickness = 8

    // Calculate insets from household impact
    const cats = ['fuel', 'heating', 'food', 'transport'] as const
    const insets: Record<string, number> = {}
    let totalHit = 0

    for (const cat of cats) {
      const imp = impact.impacts[cat]
      if (imp) {
        const increase = imp.post_base - imp.pre
        const pct = increase / impact.baseline_income
        insets[cat] = pct
        totalHit += increase
      }
    }

    const totalPct = totalHit / impact.baseline_income

    // Background
    svg.append('rect')
      .attr('width', size)
      .attr('height', size)
      .attr('fill', COLORS.dark)
      .attr('rx', 8)

    // Initial chamber space (the "room")
    const chamberPadding = 30
    const chamberSize = size - chamberPadding * 2

    // Draw the initial space outline
    svg.append('rect')
      .attr('x', chamberPadding)
      .attr('y', chamberPadding)
      .attr('width', chamberSize)
      .attr('height', chamberSize)
      .attr('fill', 'none')
      .attr('stroke', COLORS.textSecondary)
      .attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.3)

    // Walls closing in — animate
    const fuelInset = (insets.fuel || 0) * chamberSize
    const foodInset = (insets.food || 0) * chamberSize
    const heatingInset = (insets.heating || 0) * chamberSize
    const transportInset = (insets.transport || 0) * chamberSize

    const wallData = [
      { id: 'fuel', x: chamberPadding, y: chamberPadding, w: chamberSize, h: wallThickness, target: fuelInset, dir: 'down', color: '#E8B94A', label: '' },
      { id: 'food', x: chamberPadding + chamberSize - wallThickness, y: chamberPadding, w: wallThickness, h: chamberSize, target: foodInset, dir: 'left', color: '#D4763C', label: '' },
      { id: 'heating', x: chamberPadding, y: chamberPadding + chamberSize - wallThickness, w: chamberSize, h: wallThickness, target: heatingInset, dir: 'up', color: '#C44B3F', label: '' },
      { id: 'transport', x: chamberPadding, y: chamberPadding, w: wallThickness, h: chamberSize, target: transportInset, dir: 'right', color: '#C8A96E', label: '' },
    ]

    // Animate walls closing
    wallData.forEach((wall, i) => {
      const rect = svg.append('rect')
        .attr('x', wall.x)
        .attr('y', wall.y)
        .attr('width', wall.dir === 'left' || wall.dir === 'right' ? wall.w : wall.w)
        .attr('height', wall.dir === 'up' || wall.dir === 'down' ? wall.h : wall.h)
        .attr('fill', wall.color)
        .attr('opacity', 0.7)

      // Animate inward
      rect.transition()
        .delay(800 + i * 600)
        .duration(1200)
        .ease(d3.easeQuadInOut)
        .attr(wall.dir === 'down' ? 'height' : wall.dir === 'up' ? 'height' : wall.dir === 'left' ? 'width' : 'width',
          wall.target + wallThickness)
        .attr(wall.dir === 'down' ? 'y' : wall.dir === 'up' ? 'y' : wall.dir === 'left' ? 'x' : 'x',
          wall.dir === 'down' ? wall.y :
          wall.dir === 'up' ? wall.y + chamberSize - wall.target - wallThickness :
          wall.dir === 'left' ? wall.x + chamberSize - wall.target - wallThickness :
          wall.x)
    })

    // Breathing particles — gold dots in the remaining space
    const particleCount = 30
    const remainX = chamberPadding + transportInset + wallThickness
    const remainY = chamberPadding + fuelInset + wallThickness
    const remainW = chamberSize - transportInset - foodInset - wallThickness * 2
    const remainH = chamberSize - fuelInset - heatingInset - wallThickness * 2

    for (let i = 0; i < particleCount; i++) {
      const px = remainX + Math.random() * remainW
      const py = remainY + Math.random() * remainH

      svg.append('circle')
        .attr('cx', px)
        .attr('cy', py)
        .attr('r', 2)
        .attr('fill', COLORS.gold)
        .attr('opacity', 0)
        .transition()
        .delay(3200 + i * 30)
        .duration(500)
        .attr('opacity', 0.6)
    }

    // Center number — the payoff
    const hitText = svg.append('text')
      .attr('x', center)
      .attr('y', center - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.textPrimary)
      .attr('font-size', 28)
      .attr('font-weight', 'bold')
      .attr('font-family', 'Inter, sans-serif')
      .attr('opacity', 0)
      .text(`${currency} ${totalHit.toLocaleString()}`)

    hitText.transition()
      .delay(3800)
      .duration(800)
      .attr('opacity', 1)

    svg.append('text')
      .attr('x', center)
      .attr('y', center + 16)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.textSecondary)
      .attr('font-size', 13)
      .attr('font-family', 'Inter, sans-serif')
      .attr('opacity', 0)
      .text('extra this month')
      .transition()
      .delay(4200)
      .duration(600)
      .attr('opacity', 0.8)

    // Percentage
    svg.append('text')
      .attr('x', center)
      .attr('y', center + 38)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.danger)
      .attr('font-size', 14)
      .attr('font-family', 'Inter, sans-serif')
      .attr('opacity', 0)
      .text(`${Math.round(totalPct * 100)}% of income`)
      .transition()
      .delay(4600)
      .duration(600)
      .attr('opacity', 0.9)

  }, [impact, visible, currency])

  if (!visible || !impact) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 100,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20,
    }}>
      <svg ref={svgRef} width={280} height={280} />
      {impact && (
        <div style={{
          textAlign: 'center',
          marginTop: 8,
          color: COLORS.textSecondary,
          fontSize: 11,
          fontFamily: 'Inter, sans-serif',
        }}>
          Updated {getTimeSince(impact.as_of_date)}
        </div>
      )}
    </div>
  )
}

function getTimeSince(dateStr: string): string {
  const then = new Date(dateStr).getTime()
  const now = Date.now()
  const hours = Math.floor((now - then) / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours} hours ago`
  return `${Math.floor(hours / 24)} days ago`
}
