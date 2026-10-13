import { useState } from 'react'
import { fileUrl, openFile } from '../unlock.js'

/** Photo attachments — decrypted only when asked for. */
export default function Photos({ ids, files, label }) {
  const [urls, setUrls] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    try { setUrls(await Promise.all(ids.map((id) => fileUrl(files[id])))) }
    catch (err) { alert(err.message) }
    setBusy(false)
  }

  if (!ids.length) return null
  return (
    <div className="photos">
      <div className="photos-head">
        <span>{label} ({ids.length})</span>
        {!urls && <button className="gm" onClick={load} disabled={busy}>{busy ? 'Decrypting…' : 'Show photos'}</button>}
      </div>
      {urls && (
        <div className="photo-grid">
          {ids.map((id, i) => (
            <button key={id} onClick={() => openFile(files[id])} aria-label={`Open ${files[id].name}`}>
              <img src={urls[i]} alt={files[id].name} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
