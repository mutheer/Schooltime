import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Modal, Table, TR, TD, Alert, Field, Spinner, Empty } from '../../components/ui'

const BLANK = { full_name: '', id_number: '', email: '', phone: '', parent_phone: '', form_level: '', password: '' }

export default function Students() {
  const { school } = useAuth()
  const [students, setStudents] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(BLANK)
  const [saving, setSaving]     = useState(false)
  const [alert, setAlert]       = useState(null)
  const [search, setSearch]     = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('form_level').order('full_name')
    setStudents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.id_number.toLowerCase().includes(search.toLowerCase()) ||
    (s.form_level ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.full_name || !form.id_number || !form.email || !form.password || !form.form_level) {
      setAlert({ type: 'error', msg: 'Name, student ID, form level, email and password are all required.' })
      return
    }
    if (!school || !school.id) {
      setAlert({ type: 'error', msg: 'No school configuration found for your account. Please consult system administrator.' })
      return
    }
    setSaving(true)
    setAlert(null)

    try {
      const { data: userId, error } = await supabase.rpc('create_user_account', {
        p_email:        form.email,
        p_password:     form.password,
        p_role:         'student',
        p_school_id:    school.id,
        p_full_name:    form.full_name,
        p_id_number:    form.id_number,
        p_phone:        form.phone || null,
        p_parent_phone: form.parent_phone || null,
        p_form_level:   form.form_level,
      })

      if (error) {
        setAlert({ type: 'error', msg: error.message })
      } else {
        setAlert({ type: 'success', msg: `Student "${form.full_name}" added.` })
        setForm(BLANK)
        setModal(false)
        load()
      }
    } catch (err) {
      setAlert({ type: 'error', msg: err.message || 'An unexpected error occurred.' })
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(student) {
    await supabase.from('profiles').update({ is_active: !student.is_active }).eq('id', student.id)
    load()
  }

  const forms = [...new Set(students.map(s => s.form_level).filter(Boolean))].sort()

  return (
    <Layout>
      <PageHeader
        title="Students"
        subtitle={`${students.length} student${students.length !== 1 ? 's' : ''} enrolled`}
        action={<button className="btn-primary" onClick={() => { setForm(BLANK); setAlert(null); setModal(true) }}>+ Add student</button>}
      />

      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

      <div className="mb-4 flex gap-3">
        <input
          className="input w-full sm:max-w-xs"
          placeholder="Search name, ID, form…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {loading ? <Spinner className="py-16" /> : (
          <Table
            cols={['Name', 'Student ID', 'Form', 'Parent phone', 'Status', '']}
            empty={!filtered.length && <Empty icon="🎓" title="No students found" message={search ? 'Try a different search.' : 'Add your first student to get started.'} />}
          >
            {filtered.map(s => (
              <TR key={s.id}>
                <TD><span className="font-medium">{s.full_name}</span></TD>
                <TD><span className="badge-gray">{s.id_number}</span></TD>
                <TD>{s.form_level ?? '—'}</TD>
                <TD className="text-gray-400">{s.parent_phone ?? '—'}</TD>
                <TD><span className={s.is_active ? 'badge-green' : 'badge-red'}>{s.is_active ? 'Active' : 'Inactive'}</span></TD>
                <TD>
                  <button onClick={() => toggleActive(s)} className="text-xs text-gray-400 hover:text-gray-700 underline">
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </TD>
              </TR>
            ))}
          </Table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add new student">
        {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}
        <Field label="Full name *"><input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Thabo Sithole" /></Field>
        <Field label="Student ID *"><input className="input" value={form.id_number} onChange={e => set('id_number', e.target.value)} placeholder="e.g. 2025-001" /></Field>
        <Field label="Form level *">
          <select className="input" value={form.form_level} onChange={e => set('form_level', e.target.value)}>
            <option value="">Select form</option>
            {['Form 1','Form 2','Form 3','Form 4','Form 5'].map(f => <option key={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Email address *"><input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="student@school.ac.bw" /></Field>
        <Field label="Student phone (optional)"><input type="tel" className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+267 7X XXX XXX" /></Field>
        <Field label="Parent / guardian phone (for SMS)"><input type="tel" className="input" value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} placeholder="+267 7X XXX XXX" /></Field>
        <Field label="Temporary password *"><input type="password" className="input" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters" /></Field>
        <div className="flex justify-end gap-3 mt-2">
          <button className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Adding…' : 'Add student'}</button>
        </div>
      </Modal>
    </Layout>
  )
}
