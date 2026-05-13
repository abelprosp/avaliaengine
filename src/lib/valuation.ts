import type { EvaluatePropertyOptions, PropertyFormData, ValuationResult } from '../types/property'

function cityTierM2(city: string): number {
  const c = city.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (/sao paulo|rio de janeiro|brasilia/.test(c)) return 9800
  if (/belo horizonte|curitiba|porto alegre|recife|salvador|fortaleza|goiania/.test(c)) return 6200
  if (/campinas|santos|florianopolis|vitoria/.test(c)) return 7200
  return 4200
}

function conditionFactor(condition: PropertyFormData['condition']): number {
  switch (condition) {
    case 'excelente':
      return 1.08
    case 'bom':
      return 1
    case 'regular':
      return 0.92
    case 'reforma':
      return 0.78
    default:
      return 1
  }
}

function ageFactor(years: number): number {
  if (years <= 2) return 1.05
  if (years <= 10) return 1
  if (years <= 25) return 0.94
  return 0.86
}

export function heuristicValuation(data: PropertyFormData, options?: EvaluatePropertyOptions): ValuationResult {
  const base = cityTierM2(data.city)
  const roomBoost = 1 + 0.04 * Math.max(0, data.bedrooms - 2)
  const bathBoost = 1 + 0.02 * Math.max(0, data.bathrooms - 1)
  const parkingBoost = 1 + 0.015 * data.parking
  const m2 = Math.max(20, data.areaM2)

  const raw = m2 * base * roomBoost * bathBoost * parkingBoost * conditionFactor(data.condition) * ageFactor(data.buildingAgeYears)

  const spread = 0.12
  const estimated = Math.round(raw / 1000) * 1000
  const min = Math.round(estimated * (1 - spread) / 1000) * 1000
  const max = Math.round(estimated * (1 + spread) / 1000) * 1000

  const factors = [
    `Referência de m² para a cidade informada: aprox. R$ ${base.toLocaleString('pt-BR')}/m²`,
    `Ponderação por quartos, banheiros e vagas`,
    `Estado: ${data.condition}; idade do imóvel: ${data.buildingAgeYears} anos`,
  ]
  if (options?.roomPhotoBase64) {
    factors.push(
      'Foto do ambiente anexada: o modo local não interpreta imagens; configure a chave OpenAI para análise visual na avaliação.',
    )
  }

  return {
    source: 'heuristic',
    currency: 'BRL',
    estimated,
    min,
    max,
    usedRoomPhoto: Boolean(options?.roomPhotoBase64),
    summary:
      'Estimativa rápida baseada em metro quadrado médio por perfil de cidade, idade, estado de conservação e composição do imóvel. Não substitui laudo ou estudo de mercado.',
    factors,
  }
}

function parseJsonFromAssistant(content: string): Partial<ValuationResult> | null {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(content.slice(start, end + 1)) as Partial<ValuationResult>
  } catch {
    return null
  }
}

export async function evaluateProperty(
  data: PropertyFormData,
  options?: EvaluatePropertyOptions,
): Promise<ValuationResult> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
  const hasPhoto = Boolean(options?.roomPhotoBase64?.trim())

  if (!apiKey?.trim()) {
    return heuristicValuation(data, options)
  }

  const system = `Você é um analista imobiliário brasileiro. Responda APENAS um JSON válido com as chaves:
{"currency":"BRL","estimated":number,"min":number,"max":number,"summary":"string curta em pt-BR","factors":["bullet1","bullet2","bullet3"]}
Valores em reais inteiros, coerentes com o mercado brasileiro. Se faltar dado, assuma valores medianos e declare na summary.
Se receber foto de ambiente interno, use-a só como indício de acabamento, conservação aparente e padrão — não infira metragem legal a partir da imagem.`

  const userText = `Dados do imóvel:
- Cidade: ${data.city}
- Bairro: ${data.neighborhood || 'não informado'}
- Área útil (m²): ${data.areaM2}
- Quartos: ${data.bedrooms}, Banheiros: ${data.bathrooms}, Vagas: ${data.parking}
- Idade aproximada do imóvel (anos): ${data.buildingAgeYears}
- Estado (formulário): ${data.condition}
- Observações: ${data.notes || 'nenhuma'}
Contexto 3D: o usuário pode ter visualizado um ambiente simplificado no app (primitivas), não é planta oficial.
${hasPhoto ? 'Segue também uma foto JPEG capturada pelo usuário no local (ambiente real).' : ''}`

  type ContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }

  const userContent: ContentPart[] = [{ type: 'text', text: userText }]
  if (hasPhoto && options?.roomPhotoBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${options.roomPhotoBase64}` },
    })
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.35,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    const fallback = heuristicValuation(data, options)
    return {
      ...fallback,
      summary: `${fallback.summary} (API de IA indisponível; usando estimativa local.)`,
    }
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = body.choices?.[0]?.message?.content ?? ''
  const parsed = parseJsonFromAssistant(content)
  if (!parsed?.estimated || !parsed.min || !parsed.max) {
    return heuristicValuation(data, options)
  }

  return {
    source: 'openai',
    currency: parsed.currency ?? 'BRL',
    estimated: Math.round(Number(parsed.estimated)),
    min: Math.round(Number(parsed.min)),
    max: Math.round(Number(parsed.max)),
    summary: parsed.summary ?? 'Avaliação gerada por modelo de linguagem.',
    factors: Array.isArray(parsed.factors) ? parsed.factors.map(String) : [],
    usedRoomPhoto: hasPhoto,
  }
}
