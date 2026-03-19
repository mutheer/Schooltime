import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Modal, Table, TR, TD, Alert, Field, Spinner, Empty, StatCard } from '../../components/ui'

export default function Reports() {
  const { school } = useAuth()
  const [students, setStudents]   = useState([])
  const [grades, setGrades]       = useState({})       // { student_id: [grade rows] }
  const [reports, setReports]     = useState({})       // { student_id: report_card }
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)     // student being previewed
  const [hodComment, setHodComment] = useState('')
  const [saving, setSaving]       = useState(false)
  const [alert, setAlert]         = useState(null)
  const [termLocked, setTermLocked] = useState(false)

  async function load() {
    setLoading(true)
    const { data: studs } = await supabase
      .from('profiles')
      .select('id, full_name, form_level, id_number')
      .eq('role', 'student')
      .eq('is_active', true)
      .order('form_level').order('full_name')

    const { data: gradeRows } = await supabase
      .from('grades')
      .select('*, subjects(name)')
      .eq('term', school.active_term)
      .eq('year', school.active_year)

    const { data: reportRows } = await supabase
      .from('report_cards')
      .select('*')
      .eq('term', school.active_term)
      .eq('year', school.active_year)

    // Check if any grade is locked
    const anyLocked = (gradeRows ?? []).some(g => g.locked)
    setTermLocked(anyLocked)

    // Group by student
    const gradeMap = {}
    for (const g of gradeRows ?? []) {
      if (!gradeMap[g.student_id]) gradeMap[g.student_id] = []
      gradeMap[g.student_id].push(g)
    }
    const reportMap = {}
    for (const r of reportRows ?? []) {
      reportMap[r.student_id] = r
    }

    setStudents(studs ?? [])
    setGrades(gradeMap)
    setReports(reportMap)
    setLoading(false)
  }

  useEffect(() => { if (school) load() }, [school])

  async function lockTerm() {
    // Lock all grades for this term
    await supabase.from('grades')
      .update({ locked: true })
      .eq('term', school.active_term)
      .eq('year', school.active_year)
    setTermLocked(true)
    setAlert({ type: 'success', msg: 'Term locked. Teachers can no longer edit grades.' })
  }

  async function publishReport(student) {
    setSaving(true)
    const existing = reports[student.id]
    const payload = {
      student_id:  student.id,
      school_id:   school.id,
      term:        school.active_term,
      year:        school.active_year,
      hod_comment: hodComment,
      published_at: new Date().toISOString(),
    }
    let error
    if (existing) {
      ({ error } = await supabase.from('report_cards').update(payload).eq('id', existing.id))
    } else {
      ({ error } = await supabase.from('report_cards').insert(payload))
    }
    if (error) setAlert({ type: 'error', msg: error.message })
    else {
      setAlert({ type: 'success', msg: `Report card published for ${student.full_name}.` })
      setSelected(null)
    }
    setSaving(false)
    load()
  }

  const published = Object.keys(reports).length
  const total     = students.length

  return (
    <Layout>
      <PageHeader
        title="Report cards"
        subtitle={`Term ${school?.active_term}, ${school?.active_year}`}
        action={
          !termLocked
            ? <button className="btn-danger" onClick={lockTerm}>🔒 Lock term grades</button>
            : <span className="badge-amber px-3 py-1.5">Term locked</span>
        }
      />

      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

      {!termLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <strong>Before publishing:</strong> lock the term first to prevent teachers from editing grades further. Once locked, you can publish individual report cards.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total students" value={total}              icon="🎓" color="blue"  />
        <StatCard label="Reports published" value={published}       icon="📄" color="green" />
        <StatCard label="Pending publish"  value={total - published} icon="⏳" color="amber" />
      </div>

      <div className="card">
        {loading ? <Spinner className="py-16" /> : (
          <Table
            cols={['Student', 'Form', 'Subjects graded', 'Status', 'Action']}
            empty={!students.length && <Empty icon="📄" title="No students" message="Add students first." />}
          >
            {students.map(s => {
              const sGrades   = grades[s.id] ?? []
              const report    = reports[s.id]
              const published = !!report?.published_at
              return (
                <TR key={s.id}>
                  <TD><span className="font-medium">{s.full_name}</span><br /><span className="text-xs text-gray-400">{s.id_number}</span></TD>
                  <TD><span className="badge-blue">{s.form_level}</span></TD>
                  <TD>
                    <span className="text-sm">{sGrades.length} subject{sGrades.length !== 1 ? 's' : ''}</span>
                    {sGrades.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {sGrades.map(g => (
                          <span key={g.id} className="badge-gray">{g.subjects?.name}: <strong>{g.final_grade ?? '—'}</strong></span>
                        ))}
                      </div>
                    )}
                  </TD>
                  <TD>
                    {published
                      ? <span className="badge-green">Published</span>
                      : <span className="badge-amber">Pending</span>
                    }
                  </TD>
                  <TD>
                    <button
                      onClick={() => { setSelected(s); setHodComment(report?.hod_comment ?? '') }}
                      className="btn-secondary text-xs py-1 px-3"
                      disabled={!termLocked}
                    >
                      {published ? 'Re-publish' : 'Publish'}
                    </button>
                  </TD>
                </TR>
              )
            })}
          </Table>
        )}
      </div>

      {/* Publish modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Publish report — ${selected?.full_name}`} size="lg">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Subject grades</h3>
          {(grades[selected?.id] ?? []).length === 0
            ? <p className="text-sm text-gray-400">No grades entered yet.</p>
            : (
              <div className="grid grid-cols-2 gap-2">
                {(grades[selected?.id] ?? []).map(g => (
                  <div key={g.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-700">{g.subjects?.name}</span>
                    <span className="font-bold text-gray-900">{g.final_grade ?? '—'}</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
        <Field label="HOD comment (optional)">
          <textarea
            className="input h-24 resize-none"
            placeholder="Overall performance, conduct, or remarks…"
            value={hodComment}
            onChange={e => setHodComment(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-3 mt-2">
          <button className="btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
          <button className="btn-primary" onClick={() => publishReport(selected)} disabled={saving}>
            {saving ? 'Publishing…' : '📄 Publish report card'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
