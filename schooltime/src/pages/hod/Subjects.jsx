import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Modal, Table, TR, TD, Alert, Field, Spinner, Empty } from '../../components/ui'

export default function Subjects() {
  const { school } = useAuth()
  const [subjects, setSubjects]   = useState([])
  const [teachers, setTeachers]   = useState([])
  const [students, setStudents]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)       // create subject
  const [enrollModal, setEnrollModal] = useState(null)    // { subject }
  const [form, setForm]           = useState({ name: '', form_level: '', teacher_id: '' })
  const [saving, setSaving]       = useState(false)
  const [alert, setAlert]         = useState(null)
  const [enrollSaving, setEnrollSaving] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState([])
  const [enrolledIds, setEnrolledIds] = useState([])

  async function load() {
    setLoading(true)
    const [subRes, tchRes, stuRes] = await Promise.all([
      supabase.from('subjects')
        .select('*, profiles(full_name)')
        .eq('term', school.active_term)
        .eq('year', school.active_year)
        .order('form_level').order('name'),
      supabase.from('profiles').select('id, full_name').eq('role', 'teacher').eq('is_active', true).order('full_name'),
      supabase.from('profiles').select('id, full_name, form_level').eq('role', 'student').eq('is_active', true).order('form_level').order('full_name'),
    ])
    setSubjects(subRes.data ?? [])
    setTeachers(tchRes.data ?? [])
    setStudents(stuRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { if (school) load() }, [school])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function createSubject() {
    if (!form.name || !form.form_level) {
      setAlert({ type: 'error', msg: 'Subject name and form level are required.' })
      return
    }
    if (!school || !school.id) {
      setAlert({ type: 'error', msg: 'No school configuration found. Cannot create subject.' })
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('subjects').insert({
        school_id:  school.id,
        name:       form.name,
        form_level: form.form_level,
        teacher_id: form.teacher_id || null,
        term:       school.active_term,
        year:       school.active_year,
      })
      if (error) {
        setAlert({ type: 'error', msg: error.message })
      } else {
        setModal(false)
        setForm({ name: '', form_level: '', teacher_id: '' })
        load()
      }
    } catch (err) {
      setAlert({ type: 'error', msg: err.message || 'An error occurred.' })
    } finally {
      setSaving(false)
    }
  }

  async function openEnroll(subject) {
    const { data } = await supabase
      .from('subject_enrollments')
      .select('student_id')
      .eq('subject_id', subject.id)
    const ids = (data ?? []).map(r => r.student_id)
    setEnrolledIds(ids)
    setSelectedStudents(ids)
    setEnrollModal(subject)
  }

  function toggleStudent(id) {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function saveEnrollments() {
    if (!enrollModal) return
    setEnrollSaving(true)
    const toAdd    = selectedStudents.filter(id => !enrolledIds.includes(id))
    const toRemove = enrolledIds.filter(id => !selectedStudents.includes(id))

    const ops = []
    if (toAdd.length)
      ops.push(supabase.from('subject_enrollments').insert(toAdd.map(id => ({ subject_id: enrollModal.id, student_id: id }))))
    if (toRemove.length)
      ops.push(supabase.from('subject_enrollments').delete().eq('subject_id', enrollModal.id).in('student_id', toRemove))

    await Promise.all(ops)
    setEnrollModal(null)
    setEnrollSaving(false)
    load()
  }

  async function assignTeacher(subjectId, teacherId) {
    await supabase.from('subjects').update({ teacher_id: teacherId || null }).eq('id', subjectId)
    load()
  }

  const formLevels = [...new Set(students.map(s => s.form_level).filter(Boolean))].sort()
  const subjectStudents = enrollModal
    ? students.filter(s => !enrollModal.form_level || s.form_level === enrollModal.form_level)
    : []

  return (
    <Layout>
      <PageHeader
        title="Subjects"
        subtitle={`Term ${school?.active_term}, ${school?.active_year}`}
        action={<button className="btn-primary" onClick={() => { setAlert(null); setModal(true) }}>+ New subject</button>}
      />

      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

      <div className="card">
        {loading ? <Spinner className="py-16" /> : (
          <Table
            cols={['Subject', 'Form', 'Teacher', 'Enrolled', 'Actions']}
            empty={!subjects.length && <Empty icon="📚" title="No subjects yet" message="Create your first subject for this term." />}
          >
            {subjects.map(sub => {
              const enrollCount = sub.enrollment_count ?? '—'
              return (
                <TR key={sub.id}>
                  <TD><span className="font-medium">{sub.name}</span></TD>
                  <TD><span className="badge-blue">{sub.form_level}</span></TD>
                  <TD>
                    <select
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                      value={sub.teacher_id ?? ''}
                      onChange={e => assignTeacher(sub.id, e.target.value)}
                    >
                      <option value="">— Unassigned —</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  </TD>
                  <TD className="text-gray-500 text-sm">
                    <button onClick={() => openEnroll(sub)} className="text-brand-600 hover:underline font-medium">
                      Manage enrollment
                    </button>
                  </TD>
                  <TD>
                    <button onClick={() => openEnroll(sub)} className="btn-secondary text-xs py-1 px-3">
                      Enroll students
                    </button>
                  </TD>
                </TR>
              )
            })}
          </Table>
        )}
      </div>

      {/* Create subject modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Create new subject">
        {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}
        <Field label="Subject name *">
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Mathematics" />
        </Field>
        <Field label="Form level *">
          <select className="input" value={form.form_level} onChange={e => set('form_level', e.target.value)}>
            <option value="">Select form</option>
            {['Form 1','Form 2','Form 3','Form 4','Form 5'].map(f => <option key={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Assign teacher (optional)">
          <select className="input" value={form.teacher_id} onChange={e => set('teacher_id', e.target.value)}>
            <option value="">— Assign later —</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-3 mt-4">
          <button className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={createSubject} disabled={saving}>{saving ? 'Creating…' : 'Create subject'}</button>
        </div>
      </Modal>

      {/* Enroll students modal */}
      <Modal open={!!enrollModal} onClose={() => setEnrollModal(null)} title={`Enroll students — ${enrollModal?.name}`} size="lg">
        <p className="text-sm text-gray-500 mb-4">
          Showing {enrollModal?.form_level} students. Check the box to enroll.
        </p>
        <div className="space-y-1 max-h-96 overflow-y-auto border border-gray-100 rounded-lg p-3">
          {subjectStudents.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No students in {enrollModal?.form_level} yet.</p>
          )}
          {subjectStudents.map(s => (
            <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedStudents.includes(s.id)}
                onChange={() => toggleStudent(s.id)}
                className="w-4 h-4 accent-brand-600"
              />
              <span className="text-sm font-medium text-gray-800">{s.full_name}</span>
              <span className="badge-gray ml-auto">{s.form_level}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-400">{selectedStudents.length} selected</span>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setEnrollModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveEnrollments} disabled={enrollSaving}>
              {enrollSaving ? 'Saving…' : 'Save enrollment'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
