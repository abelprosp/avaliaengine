import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { MobileCameraPanel } from './components/MobileCameraPanel'
import { LiveCamera3DView } from './components/LiveCamera3DView'
import { PropertyViewer3D } from './components/PropertyViewer3D'
import { SplatViewer3D } from './components/SplatViewer3D'
import { ingestSplatFile } from './lib/splatPipeline'
import { evaluateProperty } from './lib/valuation'
import type { PropertyCondition, PropertyFormData, ValuationResult } from './types/property'
import './App.css'

const SupersplatPackFrame = lazy(() =>
  import('./components/SupersplatPackFrame').then((m) => ({ default: m.SupersplatPackFrame })),
)

const defaultForm: PropertyFormData = {
  city: 'São Paulo',
  neighborhood: 'Pinheiros',
  areaM2: 78,
  bedrooms: 2,
  bathrooms: 2,
  parking: 1,
  buildingAgeYears: 12,
  condition: 'bom',
  notes: '',
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

type ViewerTab = 'demo' | 'live' | 'splat'

export default function App() {
  const [viewTab, setViewTab] = useState<ViewerTab>('demo')
  const [form, setForm] = useState<PropertyFormData>(defaultForm)
  const [roomPhotoBase64, setRoomPhotoBase64] = useState<string | null>(null)
  const [roomScan3dFrames, setRoomScan3dFrames] = useState<string[] | null>(null)

  const [splatViewUrl, setSplatViewUrl] = useState<string | null>(null)
  const [splatPromptBlock, setSplatPromptBlock] = useState<string | null>(null)
  const [splatRowCount, setSplatRowCount] = useState<number | null>(null)
  const [splatBusy, setSplatBusy] = useState(false)

  const splatUrlRef = useRef<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ValuationResult | null>(null)

  const hasAiKey = useMemo(() => Boolean((import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim()), [])

  useEffect(() => {
    return () => {
      if (splatUrlRef.current) {
        URL.revokeObjectURL(splatUrlRef.current)
        splatUrlRef.current = null
      }
    }
  }, [])

  function clearSplatAsset() {
    if (splatUrlRef.current) {
      URL.revokeObjectURL(splatUrlRef.current)
      splatUrlRef.current = null
    }
    setSplatViewUrl(null)
    setSplatPromptBlock(null)
    setSplatRowCount(null)
  }

  async function onSplatFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setSplatBusy(true)
    setError(null)
    try {
      if (splatUrlRef.current) {
        URL.revokeObjectURL(splatUrlRef.current)
      }
      const r = await ingestSplatFile(file)
      splatUrlRef.current = r.viewUrl
      setSplatViewUrl(r.viewUrl)
      setSplatPromptBlock(r.promptBlock)
      setSplatRowCount(r.summary.rowCount)
      setViewTab('splat')
    } catch (err) {
      clearSplatAsset()
      setError(err instanceof Error ? err.message : 'Falha ao processar o splat.')
    } finally {
      setSplatBusy(false)
    }
  }

  async function handleSubmit(submitEvent: React.FormEvent) {
    submitEvent.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const valuation = await evaluateProperty(form, {
        roomPhotoBase64: roomPhotoBase64 ?? undefined,
        roomScanFramesBase64: roomScan3dFrames ?? undefined,
        splatTransformContext: splatPromptBlock ?? undefined,
      })
      setResult(valuation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao avaliar.')
    } finally {
      setLoading(false)
    }
  }

  const visionBits = [
    result?.usedMultiFrameScan && 'passeio multi-vista',
    result?.usedRoomPhoto && 'foto única',
    result?.usedSplatTransform && 'splat-transform',
  ].filter(Boolean)

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>AvaliaEngine</h1>
          <p className="tagline">
            Ecossistema PlayCanvas no browser: motor 3D + React, processamento com{' '}
            <code>@playcanvas/splat-transform</code>, visualização GSplat, passeio com a câmera e envio para a IA
            (OpenAI). O editor completo do PlayCanvas continua a ser uma aplicação à parte.
          </p>
        </div>
        <span className={`pill ${hasAiKey ? 'pill-on' : 'pill-off'}`}>
          {hasAiKey ? 'IA: OpenAI ativa' : 'IA: modo local (sem chave)'}
        </span>
      </header>

      <main className="grid">
        <section className="panel panel-3d" aria-label="Visualização 3D">
          <div className="panel-head">
            <h2>Ambiente 3D</h2>
            <p className="hint">
              <strong>Cena demo</strong> — primitivas; <strong>Câmera 3D</strong> — vídeo ao vivo como textura no
              motor; <strong>Gaussian Splat</strong> — ficheiro + splat-transform.
            </p>
          </div>

          <div className="viewer-tabs" role="tablist" aria-label="Modo de visualização">
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === 'demo'}
              className={`viewer-tab ${viewTab === 'demo' ? 'viewer-tab--active' : ''}`}
              onClick={() => setViewTab('demo')}
            >
              Cena demo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === 'live'}
              className={`viewer-tab ${viewTab === 'live' ? 'viewer-tab--active' : ''}`}
              onClick={() => setViewTab('live')}
            >
              Câmera 3D tempo real
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === 'splat'}
              className={`viewer-tab ${viewTab === 'splat' ? 'viewer-tab--active' : ''}`}
              onClick={() => setViewTab('splat')}
            >
              Gaussian Splat
            </button>
          </div>

          {viewTab === 'demo' ? <PropertyViewer3D /> : null}
          {viewTab === 'live' ? <LiveCamera3DView /> : null}
          {viewTab === 'splat' ? <SplatViewer3D key={splatViewUrl ?? 'empty'} splatUrl={splatViewUrl} /> : null}

          <div className="splat-toolbar">
            <label className="splat-file-label">
              <span>{splatBusy ? 'A processar splat…' : 'Carregar scan (.ply, .sog, .spz, …)'}</span>
              <input
                type="file"
                accept=".ply,.sog,.spz,.splat,.ksplat,.lcc"
                disabled={splatBusy}
                onChange={onSplatFile}
              />
            </label>
            {splatRowCount != null ? (
              <p className="hint splat-meta">
                {splatRowCount.toLocaleString('pt-BR')} gaussianas · resumo <code>splat-transform</code> incluído no
                pedido à IA.
              </p>
            ) : null}
            {splatViewUrl ? (
              <button type="button" className="btn-ghost splat-clear" onClick={clearSplatAsset}>
                Remover ficheiro splat
              </button>
            ) : null}
          </div>

          <details className="ecosystem-details">
            <summary>Viewer empacotado SuperSplat (npm) + ligações do ecossistema</summary>
            <p className="hint">
              O pacote <code>@playcanvas/supersplat-viewer</code> expõe o HTML/CSS/JS usado em{' '}
              <a href="https://superspl.at" target="_blank" rel="noreferrer">
                superspl.at
              </a>
              . Abaixo carrega-se esse pacote <strong>só se abrir esta secção</strong> (ficheiro grande).
            </p>
            <ul className="ecosystem-links">
              <li>
                <a href="https://github.com/playcanvas/engine" target="_blank" rel="noreferrer">
                  playcanvas/engine
                </a>{' '}
                — motor WebGL/WebGPU
              </li>
              <li>
                <a href="https://github.com/playcanvas/react" target="_blank" rel="noreferrer">
                  playcanvas/react
                </a>{' '}
                — integração React
              </li>
              <li>
                <a href="https://github.com/playcanvas/supersplat" target="_blank" rel="noreferrer">
                  playcanvas/supersplat
                </a>{' '}
                — editor de splats (exporte .ply/.sog para carregar aqui)
              </li>
              <li>
                <a href="https://github.com/playcanvas/splat-transform" target="_blank" rel="noreferrer">
                  playcanvas/splat-transform
                </a>{' '}
                — leitura e estatísticas usadas nesta app
              </li>
              <li>
                <a href="https://github.com/playcanvas/editor" target="_blank" rel="noreferrer">
                  playcanvas/editor
                </a>{' '}
                — editor visual no browser (projeto separado)
              </li>
              <li>
                <a href="https://github.com/playcanvas/pcui" target="_blank" rel="noreferrer">
                  playcanvas/pcui
                </a>{' '}
                — UI usada em ferramentas como o SuperSplat
              </li>
            </ul>
            <div className="pack-frame-host">
              <Suspense fallback={<p className="hint">A preparar viewer empacotado…</p>}>
                <SupersplatPackFrame />
              </Suspense>
            </div>
          </details>
        </section>

        <section className="panel panel-form" aria-label="Dados do imóvel">
          <div className="panel-head">
            <h2>Dados para avaliação</h2>
            <p className="hint">Preencha o máximo possível para a IA contextualizar melhor.</p>
          </div>

          <MobileCameraPanel
            form={form}
            onFormChange={setForm}
            photoBase64={roomPhotoBase64}
            onPhotoChange={setRoomPhotoBase64}
            scan3dFrames={roomScan3dFrames}
            onScan3dFramesChange={setRoomScan3dFrames}
          />

          <form className="form" onSubmit={handleSubmit}>
            <label>
              Cidade
              <input
                required
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </label>
            <label>
              Bairro
              <input
                value={form.neighborhood}
                onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
              />
            </label>

            <div className="row-2">
              <label>
                Área útil (m²)
                <input
                  type="number"
                  min={10}
                  step={1}
                  required
                  value={form.areaM2}
                  onChange={(e) => setForm((f) => ({ ...f, areaM2: Number(e.target.value) }))}
                />
              </label>
              <label>
                Idade (anos)
                <input
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={form.buildingAgeYears}
                  onChange={(e) => setForm((f) => ({ ...f, buildingAgeYears: Number(e.target.value) }))}
                />
              </label>
            </div>

            <div className="row-3">
              <label>
                Quartos
                <input
                  type="number"
                  min={0}
                  max={20}
                  required
                  value={form.bedrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bedrooms: Number(e.target.value) }))}
                />
              </label>
              <label>
                Banheiros
                <input
                  type="number"
                  min={0}
                  max={20}
                  required
                  value={form.bathrooms}
                  onChange={(e) => setForm((f) => ({ ...f, bathrooms: Number(e.target.value) }))}
                />
              </label>
              <label>
                Vagas
                <input
                  type="number"
                  min={0}
                  max={10}
                  required
                  value={form.parking}
                  onChange={(e) => setForm((f) => ({ ...f, parking: Number(e.target.value) }))}
                />
              </label>
            </div>

            <label>
              Estado de conservação
              <select
                value={form.condition}
                onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as PropertyCondition }))}
              >
                <option value="excelente">Excelente</option>
                <option value="bom">Bom</option>
                <option value="regular">Regular</option>
                <option value="reforma">Precisa de reforma</option>
              </select>
            </label>

            <label>
              Observações
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Vista, andar, condomínio, lazer, transporte…"
              />
            </label>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Avaliando…' : 'Avaliar valor de mercado'}
            </button>
            {error ? <p className="error">{error}</p> : null}
          </form>
        </section>

        <section className="panel panel-result" aria-live="polite">
          <div className="panel-head">
            <h2>Resultado</h2>
            <p className="hint">Estimativa educativa; não é laudo nem parecer jurídico.</p>
          </div>

          {!result ? (
            <p className="placeholder">Envie o formulário para ver a faixa sugerida.</p>
          ) : (
            <div className="result">
              <p className="result-source">
                Fonte: {result.source === 'openai' ? 'modelo OpenAI (gpt-4o-mini)' : 'estimativa heurística no navegador'}
                {visionBits.length > 0 ? ` · ${visionBits.join(', ')}` : ''}
              </p>
              <p className="result-big">{formatBrl(result.estimated)}</p>
              <p className="result-range">
                Faixa: {formatBrl(result.min)} — {formatBrl(result.max)}
              </p>
              <p className="result-summary">{result.summary}</p>
              {result.factors.length > 0 ? (
                <ul className="result-factors">
                  {result.factors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>
          Para usar a IA: crie um arquivo <code>.env</code> na raiz com{' '}
          <code>VITE_OPENAI_API_KEY=sua_chave</code> e reinicie o <code>npm run dev</code>. Em produção, prefira um
          backend para não expor a chave.
        </p>
      </footer>
    </div>
  )
}
