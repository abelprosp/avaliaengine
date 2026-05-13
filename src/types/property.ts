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
  /** Várias vistas (passeio pela câmera) enviadas à API */
  usedMultiFrameScan?: boolean
  /** Resumo estatístico de splat (@playcanvas/splat-transform) enviado ao texto da IA */
  usedSplatTransform?: boolean
}

export type EvaluatePropertyOptions = {
  /** JPEG em base64 (sem prefixo data:) para modelo com visão */
  roomPhotoBase64?: string
  /** Sequência de JPEGs (passeio 3D leve): ordem = caminhada aproximada pelo ambiente */
  roomScanFramesBase64?: string[]
  /** Bloco JSON/texto com estatísticas do splat (splat-transform → computeSummary) */
  splatTransformContext?: string
}
