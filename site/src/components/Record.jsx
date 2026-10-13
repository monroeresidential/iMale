import { useEffect, useMemo, useState } from 'react'
import EmailModal from './EmailModal.jsx'
import Photos from './Photos.jsx'
import { openFile } from '../unlock.js'

const html = (s) => ({ __html: s })

const SIDE_LABEL = {
  tenant: 'Tenant', monroe: 'Monroe Residential', gc: '3F Construction',
  design: 'Architect', other: 'Broker',
}
const FILTERS = [
  ['key', 'Key messages'],
  ['all', 'All messages'],
  ['tenant', 'From the tenant'],
  ['monroe', 'From Monroe'],
  ['plans', 'With plans or documents'],
  ['meetings', 'Meetings'],
]

const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export default function Record({ content, onLock }) {
  const { meta, metrics, keydates, meetings, plans, photos, phases, events, files, footer } = content
  const [filter, setFilter] = useState('key')
  const [openId, setOpenId] = useState(null)

  const shown = useMemo(() => {
    switch (filter) {
      case 'key': return events.filter((e) => e.key)
      case 'tenant': return events.filter((e) => e.side === 'tenant')
      case 'monroe': return events.filter((e) => e.side !== 'tenant')
      case 'plans': return events.filter((e) => e.tags.includes('plan'))
      case 'meetings': return events.filter((e) => e.tags.includes('meeting'))
      default: return events
    }
  }, [events, filter])

  // Opening from a meeting/plan/key-date link should page through the whole record.
  const [navSet, setNavSet] = useState(null)
  const list = navSet || shown
  const openIdx = list.findIndex((e) => e.id === openId)
  const openFromRecord = (id) => { setNavSet(null); setOpenId(id) }
  const openFromAnywhere = (id) => { setNavSet(events); setOpenId(id) }

  // Deep links: #<email id> opens that email (also after unlocking), and the hash
  // follows whichever email is open so its address can be copied and shared.
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(location.hash.slice(1))
      if (events.some((e) => e.id === id)) openFromAnywhere(id)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [events])
  useEffect(() => {
    const want = openId ? `#${openId}` : ''
    if (location.hash !== want) history.replaceState(null, '', want || location.pathname + location.search)
  }, [openId])

  return (
    <div className="wrap">
      <div className="topbar">
        <button className="lockbtn" onClick={onLock}>Lock this record</button>
      </div>

      <header className="tb">
        <div className="tb-top">
          <h1>{meta.project}<span>{meta.subtitle}</span></h1>
          <div className="stamp">{meta.stamp}</div>
        </div>
        <dl className="fields">
          {meta.fields.map(([k, v]) => (
            <div className="field" key={k}>
              <dt>{k}</dt>
              <dd dangerouslySetInnerHTML={html(v)} />
            </div>
          ))}
        </dl>
      </header>

      <p className="lede" dangerouslySetInnerHTML={html(meta.lede)} />

      <div className="metrics">
        {metrics.map(([n, l, warn]) => (
          <div className="metric" key={l}>
            <div className={warn ? 'n warn' : 'n'}>{n}</div>
            <div className="l">{l}</div>
          </div>
        ))}
      </div>

      <section>
        <div className="sec-head">
          <h2>When the tenant was told, and what followed</h2>
          <div className="note">Each line opens the email</div>
        </div>
        <ol className="keydates">
          {keydates.map(([d, t, id]) => (
            <li key={id}>
              <button onClick={() => openFromAnywhere(id)}>
                <span className="d">{d}</span>
                <span className="t">{t}</span>
                <span className="go" aria-hidden="true">→</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="sec-head">
          <h2>Meetings with the tenant</h2>
          <div className="note">{meetings.length} meetings, calls and site tours, dated from the scheduling emails</div>
        </div>
        <div className="rolewrap">
          <table className="roles meetings">
            <thead>
              <tr><th>Date</th><th>Where</th><th>Purpose</th><th>Attendees</th><th /></tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.date + m.where}>
                  <td>{m.date}<span className="addr">{m.wd} {m.time}</span></td>
                  <td>{m.where}</td>
                  <td>{m.what}</td>
                  <td>{m.who}</td>
                  <td><button className="gm" onClick={() => openFromAnywhere(m.ref)}>Email</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="sec-head">
          <h2>Floor plans and documents sent to the tenant</h2>
          <div className="note">Click a document to decrypt and open it</div>
        </div>
        <div className="plans">
          {plans.map((p) => {
            const f = files[p.file]
            return (
              <div className="plan" key={p.file + p.ref}>
                <button className="planopen" onClick={() => openFile(f)}>
                  <span className="pd">{p.date}</span>
                  <span className="pl">{p.label}</span>
                  <span className="pf">{f.name} · {kb(f.size)}</span>
                </button>
                <button className="gm" onClick={() => openFromAnywhere(p.ref)}>Covering email</button>
              </div>
            )
          })}
        </div>
        <Photos ids={photos} files={files} label={content.photosLabel} />
      </section>

      <section>
        <div className="sec-head">
          <h2>The correspondence</h2>
          <div className="note">{events.length} emails, every one reproduced in full</div>
        </div>

        <div className="filters" role="group" aria-label="Filter the record">
          {FILTERS.map(([key, label]) => (
            <button key={key} className="chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
          <span className="count">{shown.length} of {events.length} shown</span>
        </div>

        {phases.map((ph, pi) => {
          const evs = shown.filter((e) => e.phase === pi)
          if (!evs.length) return null
          return (
            <div key={pi}>
              <div className="phase">
                <span className="num">PART {String(pi + 1).padStart(2, '0')}</span>
                <h3>{ph.title}</h3>
                <span className="rng">{ph.range}</span>
              </div>
              {evs.map((e) => (
                <article className={`ev side-${e.side}${e.key ? '' : ' minor'}${e.tags.includes('notice') ? ' notice' : ''}`} key={e.id}>
                  <div className="when">
                    <span className="dd">{e.dateLabel}</span>
                    <span>{e.wd} {e.time}</span>
                  </div>
                  <div className="evbody">
                    <span className="who"><span className="dot" />{e.actor} · {SIDE_LABEL[e.side]}</span>
                    <h4>{e.head}</h4>
                    {e.body && <p className="txt">{e.body}</p>}
                    <div className="meta">
                      <button className="gm" onClick={() => openFromRecord(e.id)}>Read the email</button>
                      <span className="subj">{e.subject}</span>
                      {e.att.length > 0 && (
                        <span className="att"><b>Attached:</b> {e.att.map((id) => files[id].name).join(', ')}</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )
        })}
      </section>

      <footer>
        {footer.map((p, i) => <p key={i} dangerouslySetInnerHTML={html(p)} />)}
      </footer>

      {openIdx >= 0 && (
        <EmailModal
          event={list[openIdx]}
          files={files}
          sideLabel={SIDE_LABEL[list[openIdx].side]}
          index={openIdx}
          total={list.length}
          onClose={() => setOpenId(null)}
          onPrev={openIdx > 0 ? () => setOpenId(list[openIdx - 1].id) : null}
          onNext={openIdx < list.length - 1 ? () => setOpenId(list[openIdx + 1].id) : null}
        />
      )}
    </div>
  )
}
