import type { SummaryData } from '@playcanvas/splat-transform'

const SPLAT_EXT = /\.(ply|sog|spz|splat|ksplat|lcc)$/i

export function isSplatFilename(name: string): boolean {
  return SPLAT_EXT.test(name)
}

/** Texto compacto para o prompt da IA (evita histogramas enormes). */
export function summaryToPromptBlock(summary: SummaryData, filename: string): string {
  const colunas: Record<string, { min: number; max: number; mean: number; mediana: number }> = {}
  for (const [col, st] of Object.entries(summary.columns)) {
    colunas[col] = { min: st.min, max: st.max, mean: st.mean, mediana: st.median }
  }
  const payload = {
    fonte: '@playcanvas/splat-transform (computeSummary)',
    arquivo: filename,
    gaussianas: summary.rowCount,
    colunas,
  }
  const s = JSON.stringify(payload)
  return s.length > 14_000 ? `${s.slice(0, 14_000)}…[truncado]` : s
}

export type SplatIngestResult = {
  viewUrl: string
  summary: SummaryData
  promptBlock: string
  fileName: string
}

/**
 * Lê o arquivo com splat-transform (MemoryReadFileSystem) e gera resumo estatístico para a IA.
 * A prévia WebGL usa o mesmo ficheiro via URL de objeto (PlayCanvas engine / GSplat).
 */
export async function ingestSplatFile(file: File): Promise<SplatIngestResult> {
  const fileName = file.name || 'scene.ply'
  if (!isSplatFilename(fileName)) {
    throw new Error('Use .ply, .sog, .spz, .splat, .ksplat ou .lcc exportados do SuperSplat ou pipeline compatível.')
  }

  const { readFile, getInputFormat, MemoryReadFileSystem, computeSummary } = await import('@playcanvas/splat-transform')

  const inputFormat = getInputFormat(fileName)
  const buf = new Uint8Array(await file.arrayBuffer())
  const fs = new MemoryReadFileSystem()
  fs.set(fileName, buf)

  const tables = await readFile({
    filename: fileName,
    inputFormat,
    options: {
      iterations: 10,
      lodSelect: [],
      unbundled: false,
      lodChunkCount: 512,
      lodChunkExtent: 16,
    },
    params: [],
    fileSystem: fs,
  })

  const table = tables[0]
  if (!table) {
    throw new Error('Arquivo lido mas sem tabela de dados — formato ou conteúdo inválido.')
  }

  const summary = computeSummary(table)
  const viewUrl = URL.createObjectURL(file)

  return {
    viewUrl,
    summary,
    promptBlock: summaryToPromptBlock(summary, fileName),
    fileName,
  }
}
