import type { PropertyCondition, PropertyFormData } from '../types/property'

const CONDITIONS: PropertyCondition[] = ['excelente', 'bom', 'regular', 'reforma']

function asFiniteNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function asCondition(v: unknown): PropertyCondition | undefined {
  if (typeof v !== 'string') return undefined
  const x = v.toLowerCase() as PropertyCondition
  return CONDITIONS.includes(x) ? x : undefined
}

/**
 * Interpreta o texto de um QR code (JSON) e devolve campos válidos para mesclar no formulário.
 * Chaves aceitas (inglês ou pt): city/cidade, neighborhood/bairro, areaM2/area_m2/m2, etc.
 */
export function parsePropertyQrPayload(raw: string): Partial<PropertyFormData> | null {
  let data: unknown
  try {
    data = JSON.parse(raw) as unknown
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>

  const out: Partial<PropertyFormData> = {}

  const city = o.city ?? o.cidade
  if (typeof city === 'string' && city.trim()) out.city = city.trim()

  const neighborhood = o.neighborhood ?? o.bairro
  if (typeof neighborhood === 'string') out.neighborhood = neighborhood.trim()

  const area = asFiniteNumber(o.areaM2 ?? o.area_m2 ?? o.m2 ?? o.area)
  if (area !== undefined && area > 0) out.areaM2 = Math.round(area)

  const bedrooms = asFiniteNumber(o.bedrooms ?? o.quartos)
  if (bedrooms !== undefined && bedrooms >= 0) out.bedrooms = Math.min(20, Math.max(0, Math.round(bedrooms)))

  const bathrooms = asFiniteNumber(o.bathrooms ?? o.banheiros)
  if (bathrooms !== undefined && bathrooms >= 0) out.bathrooms = Math.min(20, Math.max(0, Math.round(bathrooms)))

  const parking = asFiniteNumber(o.parking ?? o.vagas)
  if (parking !== undefined && parking >= 0) out.parking = Math.min(10, Math.max(0, Math.round(parking)))

  const age = asFiniteNumber(o.buildingAgeYears ?? o.idade ?? o.idade_anos)
  if (age !== undefined && age >= 0) out.buildingAgeYears = Math.min(120, Math.max(0, Math.round(age)))

  const condition = asCondition(o.condition ?? o.estado ?? o.conservacao)
  if (condition) out.condition = condition

  const notes = o.notes ?? o.observacoes ?? o.obs
  if (typeof notes === 'string') out.notes = notes.trim()

  return Object.keys(out).length > 0 ? out : null
}

export function mergePropertyForm(base: PropertyFormData, partial: Partial<PropertyFormData>): PropertyFormData {
  return { ...base, ...partial }
}
