import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Modal, Table, TR, TD, Alert, Field, Spinner, Empty } from '../../components/ui'

const BLANK = { full_name: '', id_number: '', email: '', phone: '', password: '' }

export default function Teachers() {
  const { school } = useAuth()
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(BLANK)
  const [saving, setSaving]     = useState(false)
  const [alert, setAlert]       = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'teacher')
      .order('full_name')
    setTeachers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.full_name || !form.id_number || !form.email || !form.password) {
      setAlert({ type: 'error', msg: 'Name, staff ID, email and password are required.' })
      return
    }
    setSaving(true)
    setAlert(null)

    // Create Supabase auth user
    const { data: authData, error: authErr } = await supabase.auth.admin
      ? { data: null, error: { message: 'Use service role for admin actions' } }
      // Fall back to signUp (works client-side; teacher gets email confirmation)
      : await supabase.auth.signUp({ email: form.email, password: form.password, options: { emailRedirectTo: window.location.origin } })

    // Since we can't use admin API from client, we use an RPC approach
    const { data: userId, error: rpcErr } = await supabase.rpc('create_user_account', {
      p_email:    form.email,
      p_password: form.password,
      p_role:     'teacher',
      p_school_id: school.id,
      p_full_name: form.full_name,
      p_id_number: form.id_number,
      p_phone:    form.phone || null,
    })

    if (rpcErr) {
      setAlert({ type: 'error', msg: rpcErr.message })
      setSaving(false)
      return
    }

    setAlert({ type: 'success', msg: `Teacher "${form.full_name}" created successfully.` })
    setForm(BLANK)
    setModal(false)
    load()
    setSaving(false)
  }

  async function toggleActive(teacher) {
    await supabase.from('profiles').update({ is_active: !teacher.is_active }).eq('id', teacher.id)
    load()
  }

  return (
    <Layout>
      <PageHeader
        title="Teachers"
        subtitle="Create teacher accounts and manage access"
        action={<button className="btn-primary" onClick={() => { setForm(BLANK); setAlert(null); setModal(true) }}>+ Add teacher</button>}
      />

      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

      <div className="card">
        {loading ? <Spinner className="py-16" /> : (
          <Table
            cols={['Name', 'Staff ID', 'Phone', 'Status', 'Actions']}
            empty={!teachers.length && <Empty icon="👩‍🏫" title="No teachers yet" message="Add a teacher to get started." />}
          >
            {teachers.map(t => (
              <TR key={t.id}>
                <TD><span className="font-medium">{t.full_name}</span></TD>
                <TD><span className="badge-gray">{t.id_number}</span></TD>
                <TD>{t.phone ?? '—'}</TD>
                <TD>
                  <span className={t.is_active ? 'badge-green' : 'badge-red'}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </TD>
                <TD>
                  <button
                    onClick={() => toggleActive(t)}
                    className="text-xs text-gray-500 hover:text-gray-800 underline"
                  >
                    {t.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </TD>
              </TR>
            ))}
          </Table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add new teacher">
        {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}
        <div className="space-y-0">
          <Field label="Full name *"><input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Keabetswe Moeti" /></Field>
          <Field label="Staff ID *"><input className="input" value={form.id_number} onChange={e => set('id_number', e.target.value)} placeholder="e.g. TCH-001" /></Field>
          <Field label="Email address *"><input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="teacher@school.ac.bw" /></Field>
          <Field label="Phone number"><input type="tel" className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+267 7X XXX XXX" /></Field>
          <Field label="Temporary password *"><input type="password" className="input" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters" /></Field>
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create teacher'}</button>
        </div>
      </Modal>
    </Layout>
  )
}
