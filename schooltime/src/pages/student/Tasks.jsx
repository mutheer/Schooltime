import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Alert, Spinner, Empty } from '../../components/ui'

// ── Task List ──────────────────────────────────────────────────────────────────
export function StudentTaskList() {
  const { profile } = useAuth()
  const [tasks, setTasks]   = useState([])
  const [subs, setSubs]     = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: enr } = await supabase
        .from('subject_enrollments')
        .select('subject_id')
        .eq('student_id', profile.id)
      const subIds = (enr ?? []).map(e => e.subject_id)

      if (!subIds.length) { setLoading(false); return }

      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*, subjects(name, form_level)')
        .in('subject_id', subIds)
        .in('status', ['published', 'closed'])
        .order('due_at', { ascending: false })

      const { data: subData } = await supabase
        .from('submissions')
        .select('task_id, status, total_score')
        .eq('student_id', profile.id)

      const subMap = {}
      for (const s of subData ?? []) subMap[s.task_id] = s

      setTasks(allTasks ?? [])
      setSubs(subMap)
      setLoading(false)
    }
    if (profile) load()
  }, [profile])

  const statusBadge = (task) => {
    const sub = subs[task.id]
    if (!sub) return task.status === 'closed' ? <span className="badge-red">Missed</span> : <span className="badge-amber">Pending</span>
    if (sub.status === 'in_progress') return <span className="badge-amber">In progress</span>
    if (sub.total_score === null)     return <span className="badge-blue">Submitted</span>
    return <span className="badge-green">Marked ✓</span>
  }

  return (
    <Layout>
      <PageHeader title="My Tasks" subtitle="All homework tasks across your subjects" />
      {loading ? <Spinner className="py-16" /> : (
        tasks.length === 0
          ? <Empty icon="📋" title="No tasks yet" message="Your teachers haven't posted any tasks yet." />
          : (
            <div className="space-y-3">
              {tasks.map(t => {
                const sub   = subs[t.id]
                const score = sub?.total_score
                const due   = new Date(t.due_at)
                const overdue = due < new Date() && t.status === 'published'
                return (
                  <Link key={t.id} to={`/student/tasks/${t.id}`} className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge-purple capitalize">{t.task_type}</span>
                        <span className="text-xs text-gray-400">{t.subjects?.name}</span>
                      </div>
                      <p className="font-semibold text-gray-800">{t.title}</p>
                      <p className={`text-xs mt-1 ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                        Due: {due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {overdue && ' · Overdue'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {statusBadge(t)}
                      {score !== null && score !== undefined && (
                        <p className="text-sm font-bold text-gray-800 mt-1">{score}/{t.total_marks}</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )
      )}
    </Layout>
  )
}

// ── Task Attempt ───────────────────────────────────────────────────────────────
export function StudentTaskAttempt() {
  const { id }      = useParams()
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [task, setTask]         = useState(null)
  const [questions, setQuestions] = useState([])
  const [submission, setSubmission] = useState(null)
  const [answers, setAnswers]   = useState({})   // qId → { selected_option, response_text }
  const [savedAnswers, setSavedAnswers] = useState({}) // qId → answer row
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert]       = useState(null)

  async function load() {
    setLoading(true)
    const [taskRes, qRes] = await Promise.all([
      supabase.from('tasks').select('*, subjects(name)').eq('id', id).single(),
      supabase.from('questions').select('id, order_index, question_type, question_text, options, marks').eq('task_id', id).order('order_index'),
    ])
    setTask(taskRes.data)
    const qs = qRes.data ?? []
    setQuestions(qs)

    // Get or create submission
    let { data: sub } = await supabase.from('submissions').select('*, answers(*)').eq('task_id', id).eq('student_id', profile.id).maybeSingle()
    if (!sub) {
      const { data: newSub } = await supabase.from('submissions').insert({ task_id: id, student_id: profile.id }).select('*, answers(*)').single()
      sub = newSub
    }
    setSubmission(sub)

    // Prefill answers
    const aMap = {}
    const initAnswers = {}
    for (const a of sub?.answers ?? []) {
      aMap[a.question_id] = a
      initAnswers[a.question_id] = { selected_option: a.selected_option ?? '', response_text: a.response_text ?? '' }
    }
    setSavedAnswers(aMap)
    setAnswers(initAnswers)
    setLoading(false)
  }

  useEffect(() => { if (profile) load() }, [id, profile])

  function setAnswer(qId, field, value) {
    setAnswers(a => ({ ...a, [qId]: { ...a[qId], [field]: value } }))
  }

  async function submitTask() {
    setSubmitting(true)
    setAlert(null)

    // Upsert all answers
    const upserts = questions.map(q => {
      const a = answers[q.id] ?? {}
      return {
        submission_id:   submission.id,
        question_id:     q.id,
        selected_option: a.selected_option || null,
        response_text:   a.response_text   || null,
      }
    })

    const { error: ansErr } = await supabase.from('answers').upsert(upserts, { onConflict: 'submission_id,question_id' })
    if (ansErr) { setAlert({ type: 'error', msg: ansErr.message }); setSubmitting(false); return }

    // Mark as submitted
    const { error: subErr } = await supabase.from('submissions').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', submission.id)
    if (subErr) { setAlert({ type: 'error', msg: subErr.message }); setSubmitting(false); return }

    navigate('/student/tasks')
  }

  const submitted = submission?.status === 'submitted'
  const pastDue   = task && new Date(task.due_at) < new Date()

  if (loading) return <Layout><Spinner className="py-20" /></Layout>
  if (!task)   return <Layout><p className="text-gray-500 mt-10">Task not found.</p></Layout>

  return (
    <Layout>
      <PageHeader
        title={task.title}
        subtitle={`${task.subjects?.name} · ${task.total_marks} marks · Due ${new Date(task.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
        action={<button className="btn-ghost" onClick={() => navigate(-1)}>← Back</button>}
      />

      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-800">
          ✅ <strong>Submitted.</strong> {submission.total_score !== null ? `Your score: ${submission.total_score}/${task.total_marks}` : 'Awaiting marking for essay questions.'}
        </div>
      )}

      {task.instructions && (
        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Instructions</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.instructions}</p>
        </div>
      )}

      <div className="space-y-5 mb-8">
        {questions.map((q, i) => {
          const ans     = answers[q.id] ?? {}
          const savedA  = savedAnswers[q.id]
          return (
            <div key={q.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <p className="text-sm font-semibold text-gray-800">Q{i+1}. {q.question_text}</p>
                <span className="badge-gray shrink-0">{q.marks} mk{q.marks !== 1 ? 's' : ''}</span>
              </div>

              {q.question_type === 'mcq' && (
                <div className="space-y-2">
                  {(q.options ?? []).map(opt => {
                    const isSelected = ans.selected_option === opt.id
                    const wasCorrect = submitted && savedA?.score !== null && opt.id === savedA?.selected_option
                    return (
                      <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                        ${isSelected ? 'border-brand-400 bg-brand-50' : 'border-gray-100 hover:border-gray-300'}
                        ${submitted ? 'pointer-events-none' : ''}`}>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt.id}
                          checked={isSelected}
                          onChange={() => setAnswer(q.id, 'selected_option', opt.id)}
                          disabled={submitted}
                          className="accent-brand-600"
                        />
                        <span className="text-xs font-bold text-gray-500 w-5">{opt.id.toUpperCase()}.</span>
                        <span className="text-sm text-gray-700">{opt.text}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {q.question_type === 'true_false' && (
                <div className="flex gap-4">
                  {['true', 'false'].map(v => (
                    <label key={v} className={`flex items-center gap-2 px-5 py-3 rounded-xl border cursor-pointer transition-colors capitalize
                      ${ans.selected_option === v ? 'border-brand-400 bg-brand-50' : 'border-gray-100 hover:border-gray-300'}
                      ${submitted ? 'pointer-events-none' : ''}`}>
                      <input
                        type="radio"
                        name={`tf-${q.id}`}
                        value={v}
                        checked={ans.selected_option === v}
                        onChange={() => setAnswer(q.id, 'selected_option', v)}
                        disabled={submitted}
                        className="accent-brand-600"
                      />
                      <span className="text-sm font-medium">{v.charAt(0).toUpperCase() + v.slice(1)}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.question_type === 'essay' && (
                <div>
                  <textarea
                    className="input h-32 resize-none text-sm"
                    placeholder="Write your answer here…"
                    value={ans.response_text ?? ''}
                    onChange={e => setAnswer(q.id, 'response_text', e.target.value)}
                    disabled={submitted}
                  />
                  {submitted && savedA?.teacher_comment && (
                    <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-800">
                      <strong>Teacher comment:</strong> {savedA.teacher_comment}
                    </div>
                  )}
                  {submitted && savedA?.score !== null && (
                    <p className="text-xs text-gray-500 mt-1">Score: <strong>{savedA.score}/{q.marks}</strong></p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!submitted && (
        <div className="flex justify-end gap-3">
          <button
            className="btn-primary px-8"
            onClick={submitTask}
            disabled={submitting || pastDue}
          >
            {submitting ? 'Submitting…' : pastDue ? 'Past due date' : '📤 Submit task'}
          </button>
        </div>
      )}
    </Layout>
  )
}
