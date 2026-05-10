import { useEffect, useMemo, useState } from 'react'

type PaymentMethod = 'contanti' | 'bonifico' | 'altro'

interface Contribution {
  id: string
  contributorName: string
  amount: number
  date: string
  paymentMethod: PaymentMethod
  notes: string
  createdAt: string
}

interface CollectionData {
  type: 'civita-young-collection'
  version: 1
  voucherCode: string
  beneficiaryName: string
  occasion: string
  title: string
  issueDate: string
  notes: string
  collectorName?: string
  closed?: boolean
  closedAt?: string
  contributions: Contribution[]
  exportedAt?: string
}

const STORAGE_KEY = 'civita-young-colletta:v1'
const today = () => new Date().toISOString().slice(0, 10)
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
const money = (value: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0)

const emptyData: CollectionData = {
  type: 'civita-young-collection',
  version: 1,
  voucherCode: '',
  beneficiaryName: '',
  occasion: 'Compleanno',
  title: 'Buono Compleanno',
  issueDate: today(),
  notes: '',
  collectorName: '',
  closed: false,
  contributions: [],
}

function loadData(): CollectionData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...emptyData, ...JSON.parse(raw) } : emptyData
  } catch {
    return emptyData
  }
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || '')))
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function App() {
  const [data, setData] = useState<CollectionData>(() => loadData())
  const [form, setForm] = useState({ contributorName: '', amount: 5, date: today(), paymentMethod: 'contanti' as PaymentMethod, notes: '' })
  const [filter, setFilter] = useState('')
  const total = useMemo(() => data.contributions.reduce((sum, item) => sum + item.amount, 0), [data.contributions])
  const filtered = useMemo(() => data.contributions.filter((item) => item.contributorName.toLowerCase().includes(filter.toLowerCase())), [data.contributions, filter])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  function updateInfo(key: keyof CollectionData, value: string) {
    setData((current) => ({ ...current, [key]: value }))
  }

  function addContribution() {
    const amount = Number(form.amount)
    if (data.closed) return alert('La colletta e chiusa. Riaprila per modificare.')
    if (!data.beneficiaryName.trim()) return alert('Inserisci il nome del beneficiario.')
    if (!form.contributorName.trim()) return alert('Inserisci il nome del partecipante.')
    if (!Number.isFinite(amount) || amount <= 0) return alert('Inserisci un importo positivo.')
    const sameName = data.contributions.some((item) => item.contributorName.trim().toLowerCase() === form.contributorName.trim().toLowerCase())
    if (sameName && !confirm('Questo nome risulta gia inserito. Vuoi aggiungerlo comunque?')) return
    setData((current) => ({
      ...current,
      contributions: [...current.contributions, { ...form, amount, id: uid(), createdAt: new Date().toISOString() }],
    }))
    setForm({ contributorName: '', amount: 5, date: today(), paymentMethod: 'contanti', notes: '' })
  }

  function editAmount(id: string, oldAmount: number) {
    if (data.closed) return alert('La colletta e chiusa. Riaprila per modificare.')
    const raw = prompt('Nuovo importo', String(oldAmount))
    if (raw === null) return
    const amount = Number(raw.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) return alert('Inserisci un importo positivo.')
    setData((current) => ({ ...current, contributions: current.contributions.map((item) => item.id === id ? { ...item, amount } : item) }))
  }

  function removeContribution(id: string) {
    if (data.closed) return alert('La colletta e chiusa. Riaprila per modificare.')
    if (!confirm('Eliminare questo partecipante?')) return
    setData((current) => ({ ...current, contributions: current.contributions.filter((item) => item.id !== id) }))
  }

  function exportJson() {
    const payload = { ...data, exportedAt: new Date().toISOString() }
    download(`${fileBaseName()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8')
  }

  function exportCsv() {
    const header = ['Codice buono', 'Beneficiario', 'Partecipante', 'Importo', 'Data', 'Metodo', 'Note']
    const rows = data.contributions.map((item) => [data.voucherCode, data.beneficiaryName, item.contributorName, item.amount, item.date, item.paymentMethod, item.notes])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')
    download(`${fileBaseName()}.csv`, csv, 'text/csv;charset=utf-8')
  }

  async function shareJson() {
    const payload = { ...data, exportedAt: new Date().toISOString() }
    const file = new File([JSON.stringify(payload, null, 2)], `${fileBaseName()}.json`, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'Colletta Civita Young', text: `Colletta ${data.voucherCode}`, files: [file] })
    } else {
      exportJson()
      alert('Condivisione diretta non disponibile: ho scaricato il file JSON da inviare.')
    }
  }

  async function shareSummary() {
    const text = `Colletta ${data.beneficiaryName || 'Civita Young'}\nPartecipanti: ${data.contributions.length}\nTotale raccolto: ${money(total)}${data.collectorName ? `\nResponsabile: ${data.collectorName}` : ''}`
    if (navigator.share) await navigator.share({ title: 'Riepilogo colletta', text })
    else {
      await navigator.clipboard.writeText(text)
      alert('Riepilogo copiato negli appunti.')
    }
  }

  function fileBaseName() {
    const name = (data.beneficiaryName || 'civita-young').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return `colletta-${name || 'civita-young'}-${Math.round(total)}-euro`
  }

  function toggleClosed() {
    setData((current) => ({ ...current, closed: !current.closed, closedAt: !current.closed ? new Date().toISOString() : undefined }))
  }

  function resetAll() {
    if (!confirm('Cancellare questa colletta dal dispositivo?')) return
    setData(emptyData)
  }

  async function importVoucherSeed(file: File) {
    try {
      const payload = await readJsonFile(file) as Partial<CollectionData> & { type?: string }
      if (payload.type !== 'civita-young-voucher-seed') {
        alert('Questo non sembra un file dati buono creato dal programma madre.')
        return
      }
      const hasContributions = data.contributions.length > 0
      if (hasContributions && !confirm('Hai gia partecipanti inseriti. Vuoi cambiare i dati del buono mantenendo la lista attuale?')) return
      setData((current) => ({
        ...current,
        voucherCode: payload.voucherCode || current.voucherCode,
        beneficiaryName: payload.beneficiaryName || current.beneficiaryName,
        occasion: payload.occasion || current.occasion,
        title: payload.title || current.title,
        issueDate: payload.issueDate || current.issueDate,
        notes: payload.notes || current.notes,
      }))
    } catch {
      alert('File dati buono non valido.')
    }
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <img
            className="h-12 w-12 rounded-2xl object-cover shadow-md"
            src="./civita-young-logo.png"
            alt="Logo Civita Young"
          />
          <div>
            <h1 className="text-lg font-black text-night">Civita Young</h1>
            <p className="text-xs font-bold text-slate-500">Colletta buono compleanno</p>
            <p className="text-[11px] font-black text-teal-700">Versione 3 - colletta rapida</p>
          </div>
          <div className="ml-auto rounded-2xl bg-night px-3 py-2 text-right text-white">
            <p className="text-[10px] font-black uppercase text-gold">Totale</p>
            <p className="text-sm font-black">{money(total)}</p>
          </div>
        </div>
      </header>

      <main className="page space-y-4">
        <section className="card space-y-3">
          <h2 className="text-xl font-black text-night">Dati del buono</h2>
          <label className="btn-secondary w-full cursor-pointer">
            Importa dati buono dal responsabile
            <input
              className="hidden"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) importVoucherSeed(file)
                event.currentTarget.value = ''
              }}
            />
          </label>
          <Field label="Codice buono"><input placeholder="Es. CY-2026-001" value={data.voucherCode} onChange={(e) => updateInfo('voucherCode', e.target.value.toUpperCase())} /></Field>
          <Field label="Beneficiario"><input placeholder="Nome e cognome" value={data.beneficiaryName} onChange={(e) => updateInfo('beneficiaryName', e.target.value)} /></Field>
          <Field label="Responsabile colletta"><input placeholder="Nome di chi raccoglie" value={data.collectorName || ''} onChange={(e) => updateInfo('collectorName', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Occasione"><input value={data.occasion} onChange={(e) => updateInfo('occasion', e.target.value)} /></Field>
            <Field label="Data"><input type="date" value={data.issueDate} onChange={(e) => updateInfo('issueDate', e.target.value)} /></Field>
          </div>
          <Field label="Note"><textarea value={data.notes} onChange={(e) => updateInfo('notes', e.target.value)} placeholder="Note interne sulla colletta" /></Field>
          <button className={data.closed ? 'btn-secondary w-full' : 'btn-primary w-full'} onClick={toggleClosed}>
            {data.closed ? 'Riapri colletta' : 'Chiudi colletta'}
          </button>
          {data.closed && <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Colletta chiusa: le modifiche sono bloccate per evitare errori.</p>}
        </section>

        <section className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-night">Partecipanti</h2>
            <div className="rounded-2xl bg-night px-4 py-2 text-right text-white">
              <p className="text-[10px] font-black uppercase text-gold">Totale</p>
              <p className="font-black">{money(total)}</p>
            </div>
          </div>
          <Field label="Nome partecipante"><input value={form.contributorName} onChange={(e) => setForm({ ...form, contributorName: e.target.value })} placeholder="Es. Luca" /></Field>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-secondary" onClick={() => setForm({ ...form, amount: 5 })}>5 euro</button>
            <button className="btn-secondary" onClick={() => setForm({ ...form, amount: 10 })}>10 euro</button>
            <button className="btn-secondary" onClick={() => setForm({ ...form, amount: 0 })}>Altro</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Importo"><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
            <Field label="Data"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          </div>
          <Field label="Metodo pagamento">
            <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}>
              <option value="contanti">contanti</option>
              <option value="bonifico">bonifico</option>
              <option value="altro">altro</option>
            </select>
          </Field>
          <Field label="Note"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <button className="btn-primary w-full" onClick={addContribution}>Aggiungi partecipante</button>
        </section>

        <section className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-night">Elenco</h2>
            <span className="badge bg-teal-100 text-teal-800">{data.contributions.length} persone</span>
          </div>
          <input placeholder="Cerca partecipante..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="space-y-2">
            {filtered.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{item.contributorName}</p>
                    <p className="text-sm text-slate-500">{item.date} - {item.paymentMethod}</p>
                    {item.notes && <p className="text-sm">{item.notes}</p>}
                  </div>
                  <p className="font-black text-emerald-700">{money(item.amount)}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="btn-secondary" onClick={() => editAmount(item.id, item.amount)}>Modifica importo</button>
                  <button className="btn-danger" onClick={() => removeContribution(item.id)}>Elimina</button>
                </div>
              </article>
            ))}
            {filtered.length === 0 && <p className="text-sm text-slate-500">Nessun partecipante inserito.</p>}
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="text-xl font-black text-night">Consegna dati</h2>
          <p className="text-sm text-slate-500">A fine colletta esporta il JSON e invialo al responsabile. Il programma madre lo importera nel buono corrispondente.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <button className="btn-primary" onClick={shareJson}>Condividi</button>
            <button className="btn-secondary" onClick={exportJson}>Esporta JSON</button>
            <button className="btn-secondary" onClick={exportCsv}>Esporta CSV</button>
            <button className="btn-secondary" onClick={shareSummary}>Riepilogo WhatsApp</button>
          </div>
          <button className="btn-danger w-full" onClick={resetAll}>Cancella colletta</button>
        </section>
      </main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="field-label">{label}</span>{children}</label>
}

export default App
