// World IDs
export const WORLD_ID = 'scenario:world_hormuz_energy'

// Chokepoint coordinates
export const HORMUZ = { lat: 26.5, lng: 56.3 }
export const BAB_EL_MANDEB = { lat: 12.6, lng: 43.3 }
export const SUEZ = { lat: 30.0, lng: 32.3 }
export const MALACCA = { lat: 1.4, lng: 103.8 }
export const CAPE = { lat: -34.4, lng: 18.5 }

// Kenya focus
export const NAIROBI = { lat: -1.29, lng: 36.82 }
export const MOMBASA = { lat: -4.05, lng: 39.67 }

// Globe rendering
export const GLOBE_RADIUS = 5
export const CAMERA_DISTANCE_SPACE = 18
export const CAMERA_DISTANCE_CLOSE = 8

// Colors — from the spec's visual species
export const COLORS = {
  shipping: '#88CCFF',
  shippingGlow: '#5BA3CF',
  freight: '#E8B94A',
  importStress: '#D4763C',
  medicine: '#C44B3F',
  household: '#C8A96E',
  rupture: '#FF3333',
  gold: '#C8A96E',
  dark: '#0A0A12',
  textPrimary: '#E8E4DC',
  textSecondary: '#8A8680',
  danger: '#C44B3F',
  success: '#4A9B7F',
  warning: '#E8B94A',
} as const

// Timing
export const FLY_TO_DURATION = 3 // seconds
export const BASELINE_DURATION = 6 // seconds
export const RUPTURE_DELAY = 1.5 // seconds before red pulse

// Particle counts
export const SHIPPING_PARTICLE_COUNT = 3000
export const SHIPPING_PARTICLE_COUNT_MOBILE = 1800
