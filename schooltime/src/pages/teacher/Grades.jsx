import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Alert, Spinner, Empty } from '../../components/ui'

export default function TeacherGrades() {
  const { profile, school } = useAuth()
  const [subjects, setSubjects]   = useState([])
  const [activeSubject, setActiveSubject] = useState(null)
  const [students, setStudents]   = useState([])
  const [grades, setGrades]       = useState({})   // studentId → { final_grade, teacher_comment }
  const [taskAvgs, setTaskAvgs]   = useState({})   // studentId → avg score %
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [alert, setAlert]         = useState(null)

  useEffect(() => {
    async function loadSubjects() {
      const { data } = await supabase
        .from('subjects')
        .select('id, name, form_level')
        .eq('teacher_id', profile.id)
        .eq('term', school.active_term)
        .eq('year', school.active_year)
        .order('name')
      setSubjects(data ?? [])
      if (data?.length) setActiveSubject(data[0])
    }
    if (profile && school) loadSubjects()
  }, [profile, school])

  useEffect(() => {
    if (!activeSubject) return
    loadGrades()
  }, [activeSubject])

  async function loadGrades() {
    setLoading(true)
    const [enrRes, gradeRes, taskRes, subRes] = await Promise.all([
      supabase.from('subject_enrollments')
        .select('profiles(id, full_name, id_number)')
        .eq('subject_id', activeSubject.id),
      supabase.from('grades')
        .select('*')
        .eq('subject_id', activeSubject.id)
        .eq('term', school.active_term)
        .eq('year', school.active_year),
      supabase.from('tasks').select('id, total_marks').eq('subject_id', activeSubject.id).eq('status', 'closed'),
      supabase.from('submissions').select('student_id, total_score, task_id').eq('status', 'submitted'),
    ])

    const studs = (enrRes.data ?? []).map(e => e.profiles).filter(Boolean)
    setStudents(studs)

    const gradeMap = {}
    for (const g of gradeRes.data ?? []) {
      gradeMap[g.student_id] = { final_grade: g.final_grade ?? '', teacher_comment: g.teacher_comment ?? '', locked: g.locked }
    }
    setGrades(gradeMap)

    // Compute task-based averages
    const taskIds  = new Set((taskRes.data ?? []).map(t => t.id))
    const markMap  = {}
    for (const t of taskRes.data ?? []) markMap[t.id] = t.total_marks
    const avgMap   = {}
    for (const s of studs) {
      const subs = (subRes.data ?? []).filter(r => r.student_id === s.id && taskIds.has(r.task_id))
      const totalPossible = subs.reduce((sum, r) => sum + (markMap[r.task_id] ?? 0), 0)
      const totalEarned   = subs.reduce((sum, r) => sum + (r.total_score ?? 0), 0)
      avgMap[s.id] = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null
    }
    setTaskAvgs(avgMap)
    setLoading(false)
  }

  function updateGrade(studentId, field, value) {
    if (grades[studentId]?.locked) return
    setGrades(g => ({ ...g, [studentId]: { ...g[studentId], [field]: value } }))
  }

  async function saveAll() {
    setSaving(true)
    const ops = []
    for (const s of students) {
      const g = grades[s.id]
      if (!g || g.locked) continue
      ops.push(
        supabase.from('grades').upsert({
          subject_id:      activeSubject.id,
          student_id:      s.id,
          term:            school.active_term,
          year:            school.active_year,
          final_grade:     g.final_grade || null,
          teacher_comment: g.teacher_comment || null,
        }, { onConflict: 'subject_id,student_id' })
      )
    }
    const results = await Promise.all(ops)
    const err = results.find(r => r.error)
    if (err) setAlert({ type: 'error', msg: err.error.message })
    else setAlert({ type: 'success', msg: 'Grades saved.' })
    setSaving(false)
  }

  const anyLocked = Object.values(grades).some(g => g?.locked)

  return (
    <Layout>
      <PageHeader
        title="Grade book"
        subtitle="Enter final term grades for each student"
        action={
          !anyLocked
            ? <button className="btn-primary" onClick={saveAll} disabled={saving}>{saving ? 'Saving…' : '💾 Save all grades'}</button>
            : <span className="badge-amber px-3 py-1.5">Term locked by HOD</span>
        }
      />

      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

      {/* Subject tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {subjects.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSubject(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
              ${activeSubject?.id === s.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {loading ? <Spinner className="py-16" /> : (
        students.length === 0
          ? <Empty icon="🎓" title="No students enrolled" message="Ask your HOD to enroll students in this subject." />
          : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Task avg</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Final grade</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => {
                      const g      = grades[s.id] ?? {}
                      const avg    = taskAvgs[s.id]
                      const locked = g.locked
                      return (
                        <tr key={s.id} className="border-b border-gray-50">
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-800">{s.full_name}</p>
                            <p className="text-xs text-gray-400">{s.id_number}</p>
                          </td>
                          <td className="px-5 py-3">
                            {avg !== null
                              ? <span className={`font-semibold ${avg >= 50 ? 'text-green-600' : 'text-red-500'}`}>{avg}%</span>
                              : <span className="text-gray-400 text-xs">No tasks</span>
                            }
                          </td>
                          <td className="px-5 py-3">
                            <input
                              className="input w-28"
                              placeholder={avg !== null ? `e.g. ${avg}%` : 'e.g. 75%'}
                              value={g.final_grade ?? ''}
                              onChange={e => updateGrade(s.id, 'final_grade', e.target.value)}
                              disabled={locked}
                            />
                          </td>
                          <td className="px-5 py-3">
                            <input
                              className="input"
                              placeholder="Optional comment…"
                              value={g.teacher_comment ?? ''}
                              onChange={e => updateGrade(s.id, 'teacher_comment', e.target.value)}
                              disabled={locked}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {!anyLocked && (
                <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
                  <button className="btn-primary" onClick={saveAll} disabled={saving}>{saving ? 'Saving…' : '💾 Save all grades'}</button>
                </div>
              )}
            </div>
          )
      )}
    </Layout>
  )
}
