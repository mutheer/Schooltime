import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Modal, Alert, Field, Spinner, Empty } from '../../components/ui'

export default function TeacherNotices() {
  const { profile, school } = useAuth()
  const [subjects, setSubjects] = useState([])
  const [notices, setNotices]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ title: '', body: '', subject_id: '' })
  const [saving, setSaving]     = useState(false)
  const [alert, setAlert]       = useState(null)

  async function load() {
    setLoading(true)
    const { data: subs } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('teacher_id', profile.id)
      .eq('term', school.active_term)
      .eq('year', school.active_year)
    setSubjects(subs ?? [])

    const subIds = (subs ?? []).map(s => s.id)
    const { data } = await supabase
      .from('notices')
      .select('*, profiles(full_name), subjects(name)')
      .or(subIds.length ? `subject_id.in.(${subIds.join(',')}),subject_id.is.null` : 'subject_id.is.null')
      .order('created_at', { ascending: false })
    setNotices(data ?? [])
    setLoading(false)
  }

  useEffect(() => { if (profile && school) load() }, [profile, school])

  async function save() {
    if (!form.title || !form.body) {
      setAlert({ type: 'error', msg: 'Title and body are required.' })
      return
    }
    setSaving(true)
    const { error } = await supabase.from('notices').insert({
      school_id:  school.id,
      author_id:  profile.id,
      subject_id: form.subject_id || null,
      title:      form.title,
      body:       form.body,
    })
    if (error) setAlert({ type: 'error', msg: error.message })
    else { setModal(false); setForm({ title: '', body: '', subject_id: '' }); load() }
    setSaving(false)
  }

  return (
    <Layout>
      <PageHeader
        title="Notices"
        subtitle="School-wide and subject announcements"
        action={<button className="btn-primary" onClick={() => { setAlert(null); setModal(true) }}>+ Post notice</button>}
      />

      {loading ? <Spinner className="py-16" /> : (
        notices.length === 0
          ? <Empty icon="📣" title="No notices" message="Nothing posted yet." />
          : (
            <div className="space-y-3">
              {notices.map(n => (
                <div key={n.id} className={`card p-5 ${n.pinned ? 'border-brand-200' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {n.pinned && <span className="badge-blue">📌 Pinned</span>}
                    {n.subjects && <span className="badge-purple">{n.subjects.name}</span>}
                    {!n.subject_id && <span className="badge-gray">School-wide</span>}
                    <h3 className="font-semibold text-gray-900">{n.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    By {n.profiles?.full_name} · {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          )
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Post notice">
        {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}
        <Field label="Subject (leave blank for class-wide)">
          <select className="input" value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}>
            <option value="">All my classes</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Title *"><input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Reminder: assignment due Friday" /></Field>
        <Field label="Message *">
          <textarea className="input h-28 resize-none" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Your announcement…" />
        </Field>
        <div className="flex justify-end gap-3 mt-2">
          <button className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Posting…' : 'Post notice'}</button>
        </div>
      </Modal>
    </Layout>
  )
}
