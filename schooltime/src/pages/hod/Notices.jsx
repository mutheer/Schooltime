import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Modal, Alert, Field, Spinner, Empty } from '../../components/ui'

export default function HodNotices() {
  const { profile, school } = useAuth()
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState({ title: '', body: '', pinned: false })
  const [saving, setSaving]   = useState(false)
  const [alert, setAlert]     = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('notices')
      .select('*, profiles(full_name)')
      .is('subject_id', null)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setNotices(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!form.title || !form.body) {
      setAlert({ type: 'error', msg: 'Title and body are required.' })
      return
    }
    setSaving(true)
    const { error } = await supabase.from('notices').insert({
      school_id: school.id,
      author_id: profile.id,
      title:     form.title,
      body:      form.body,
      pinned:    form.pinned,
    })
    if (error) setAlert({ type: 'error', msg: error.message })
    else { setModal(false); setForm({ title: '', body: '', pinned: false }); load() }
    setSaving(false)
  }

  async function deleteNotice(id) {
    await supabase.from('notices').delete().eq('id', id)
    load()
  }

  return (
    <Layout>
      <PageHeader
        title="Noticeboard"
        subtitle="School-wide announcements"
        action={<button className="btn-primary" onClick={() => { setAlert(null); setModal(true) }}>+ Post notice</button>}
      />

      {loading ? <Spinner className="py-16" /> : (
        notices.length === 0
          ? <Empty icon="📣" title="No notices posted" message="Post your first school-wide announcement." />
          : (
            <div className="space-y-3">
              {notices.map(n => (
                <div key={n.id} className={`card p-5 ${n.pinned ? 'border-brand-200 bg-brand-50/30' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {n.pinned && <span className="badge-blue">📌 Pinned</span>}
                        <h3 className="font-semibold text-gray-900">{n.title}</h3>
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{n.body}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        By {n.profiles?.full_name} · {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteNotice(n.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                      title="Delete notice"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Post school notice">
        {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}
        <Field label="Title *"><input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. End of term exams timetable" /></Field>
        <Field label="Message *">
          <textarea className="input h-32 resize-none" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your announcement here…" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4 cursor-pointer">
          <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} className="w-4 h-4 accent-brand-600" />
          Pin this notice (shows at the top)
        </label>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Posting…' : 'Post notice'}</button>
        </div>
      </Modal>
    </Layout>
  )
}
