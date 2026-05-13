import { useMemo, useState } from 'react'
import { MobileCameraPanel } from './components/MobileCameraPanel'
import { PropertyViewer3D } from './components/PropertyViewer3D'
import { evaluateProperty } from './lib/valuation'
import type { PropertyCondition, PropertyFormData, ValuationResult } from './types/property'
import './App.css'

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

export default function App() {
  const [form, setForm] = useState<PropertyFormData>(defaultForm)
  const [roomPhotoBase64, setRoomPhotoBase64] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ValuationResult | null>(null)

  const hasAiKey = useMemo(() => Boolean((import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim()), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const valuation = await evaluateProperty(form, {
        roomPhotoBase64: roomPhotoBase64 ?? undefined,
      })
      setResult(valuation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao avaliar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>AvaliaEngine</h1>
          <p className="tagline">
            Visualize um ambiente em 3D com PlayCanvas, use a câmera para QR ou foto do ambiente, e obtenha faixa de
            valor com IA (OpenAI) ou estimativa local.
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
            <p className="hint">Arraste para orbitar, role para aproximar.</p>
          </div>
          <PropertyViewer3D />
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
                {result.usedRoomPhoto ? ' · Foto do ambiente enviada na avaliação' : ''}
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
