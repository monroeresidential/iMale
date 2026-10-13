import { useEffect, useState } from 'react'
import Gate from './components/Gate.jsx'
import Record from './components/Record.jsx'
import { unlockFromSession, lock } from './unlock.js'

export default function App() {
  const [content, setContent] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let live = true
    unlockFromSession()
      .then((c) => { if (live && c) setContent(c) })
      .catch(() => {})
      .finally(() => { if (live) setChecking(false) })
    return () => { live = false }
  }, [])

  if (checking) return null
  if (!content) return <Gate onUnlock={setContent} />

  return (
    <Record
      content={content}
      onLock={() => { lock(); setContent(null) }}
    />
  )
}
