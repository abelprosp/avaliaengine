export type PropertyCondition = 'excelente' | 'bom' | 'regular' | 'reforma'

export interface PropertyFormData {
  city: string
  neighborhood: string
  areaM2: number
  bedrooms: number
  bathrooms: number
  parking: number
  buildingAgeYears: number
  condition: PropertyCondition
  notes: string
}

export interface ValuationResult {
  source: 'openai' | 'heuristic'
  currency: string
  estimated: number
  min: number
  max: number
  summary: string
  factors: string[]
  /** Foto do ambiente enviada à API (visão), quando aplicável */
  usedRoomPhoto?: boolean
}

export type EvaluatePropertyOptions = {
  /** JPEG em base64 (sem prefixo data:) para modelo com visão */
  roomPhotoBase64?: string
}
