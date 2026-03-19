import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Modal, Alert, Spinner, Empty, Table, TR, TD } from '../../components/ui'

export default function TaskDetail() {
  const { id }         = useParams()
  const { profile }    = useAuth()
  const navigate       = useNavigate()
  const [task, setTask]           = useState(null)
  const [questions, setQuestions] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [enrolled, setEnrolled]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [marking, setMarking]     = useState(null) // { submission, answers }
  const [scores, setScores]       = useState({})   // { answerId: { score, comment } }
  const [savingMark, setSavingMark] = useState(false)
  const [alert, setAlert]         = useState(null)

  async function load() {
    setLoading(true)
    const [taskRes, qRes, subRes] = await Promise.all([
      supabase.from('tasks').select('*, subjects(name, form_level)').eq('id', id).single(),
      supabase.from('questions').select('*').eq('task_id', id).order('order_index'),
      supabase.from('submissions')
        .select('*, profiles(full_name, id_number), answers(*)')
        .eq('task_id', id)
        .order('submitted_at'),
    ])
    setTask(taskRes.data)
    setQuestions(qRes.data ?? [])
    setSubmissions(subRes.data ?? [])

    // Get enrolled students for this subject
    if (taskRes.data) {
      const { data: enr } = await supabase
        .from('subject_enrollments')
        .select('profiles(id, full_name, id_number)')
        .eq('subject_id', taskRes.data.subject_id)
      setEnrolled((enr ?? []).map(e => e.profiles))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function openMarking(sub) {
    const init = {}
    for (const a of sub.answers ?? []) {
      init[a.id] = { score: a.score ?? '', comment: a.teacher_comment ?? '' }
    }
    setScores(init)
    setMarking(sub)
    setAlert(null)
  }

  async function saveMark() {
    setSavingMark(true)
    const essayQIds = new Set(questions.filter(q => q.question_type === 'essay').map(q => q.id))
    const updates   = []
    for (const a of marking.answers ?? []) {
      if (!essayQIds.has(a.question_id)) continue
      const s = scores[a.id]
      if (s === undefined) continue
      updates.push(
        supabase.from('answers').update({
          score:           Number(s.score),
          teacher_comment: s.comment || null,
          marked_at:       new Date().toISOString(),
          marked_by:       profile.id,
        }).eq('id', a.id)
      )
    }
    await Promise.all(updates)
    setSavingMark(false)
    setMarking(null)
    load()
  }

  const submittedIds = new Set(submissions.filter(s => s.status === 'submitted').map(s => s.student_id))
  const notSubmitted = enrolled.filter(s => !submittedIds.has(s.id))
  const essayQs      = questions.filter(q => q.question_type === 'essay')
  const needsMarking = (sub) => {
    if (!essayQs.length) return false
    return (sub.answers ?? []).some(a => {
      const q = questions.find(q => q.id === a.question_id)
      return q?.question_type === 'essay' && a.score === null
    })
  }

  if (loading) return <Layout><Spinner className="py-20" /></Layout>
  if (!task)   return <Layout><p className="text-gray-500 mt-10">Task not found.</p></Layout>

  return (
    <Layout>
      <PageHeader
        title={task.title}
        subtitle={`${task.subjects?.name} · ${task.subjects?.form_level} · ${task.total_marks} marks`}
        action={<button className="btn-ghost" onClick={() => navigate(-1)}>← Back</button>}
      />

      {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{submissions.filter(s => s.status === 'submitted').length}</p>
          <p className="text-xs text-gray-500 mt-1">Submitted</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{notSubmitted.length}</p>
          <p className="text-xs text-gray-500 mt-1">Not submitted</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{submissions.filter(needsMarking).length}</p>
          <p className="text-xs text-gray-500 mt-1">Needs marking</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Submissions</h2>
        </div>
        <Table
          cols={['Student', 'Submitted', 'Score', 'Status', 'Action']}
          empty={!submissions.length && <Empty icon="📭" title="No submissions yet" message="Students will appear here once they submit." />}
        >
          {submissions.map(sub => {
            const nm = needsMarking(sub)
            return (
              <TR key={sub.id}>
                <TD>
                  <span className="font-medium">{sub.profiles?.full_name}</span>
                  <span className="text-xs text-gray-400 ml-2">{sub.profiles?.id_number}</span>
                </TD>
                <TD className="text-gray-500 text-xs">
                  {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </TD>
                <TD>
                  {sub.total_score !== null
                    ? <span className="font-semibold">{sub.total_score}/{task.total_marks}</span>
                    : <span className="badge-amber">Pending</span>
                  }
                </TD>
                <TD>
                  {nm
                    ? <span className="badge-amber">Needs marking</span>
                    : sub.status === 'submitted'
                      ? <span className="badge-green">Marked</span>
                      : <span className="badge-gray">In progress</span>
                  }
                </TD>
                <TD>
                  {sub.status === 'submitted' && (
                    <button onClick={() => openMarking(sub)} className="btn-secondary text-xs py-1 px-3">
                      {nm ? '✏️ Mark' : '👁 Review'}
                    </button>
                  )}
                </TD>
              </TR>
            )
          })}
        </Table>

        {notSubmitted.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Not submitted ({notSubmitted.length})</p>
            <div className="flex flex-wrap gap-2">
              {notSubmitted.map(s => (
                <span key={s.id} className="badge-red">{s.full_name}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Marking modal */}
      <Modal open={!!marking} onClose={() => setMarking(null)} title={`Marking — ${marking?.profiles?.full_name}`} size="xl">
        {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}
        <div className="space-y-5">
          {questions.map((q, i) => {
            const answer = (marking?.answers ?? []).find(a => a.question_id === q.id)
            return (
              <div key={q.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <p className="text-sm font-medium text-gray-800">Q{i+1}. {q.question_text}</p>
                  <span className="badge-gray shrink-0">{q.marks} mk{q.marks !== 1 ? 's' : ''}</span>
                </div>

                {q.question_type !== 'essay' ? (
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-sm px-3 py-1 rounded-lg font-medium
                      ${answer?.score === q.marks ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      Student answered: <strong>{answer?.selected_option ?? '—'}</strong>
                    </span>
                    <span className="text-xs text-gray-400">Correct: {q.correct_answer}</span>
                    <span className="ml-auto text-sm font-semibold">{answer?.score ?? 0}/{q.marks}</span>
                  </div>
                ) : (
                  <div>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mb-3 min-h-[60px]">
                      {answer?.response_text || <span className="text-gray-400 italic">No response</span>}
                    </div>
                    {q.marking_guide && (
                      <p className="text-xs text-gray-400 mb-3 bg-amber-50 px-3 py-2 rounded-lg">
                        <strong>Guide:</strong> {q.marking_guide}
                      </p>
                    )}
                    <div className="flex gap-3 items-end">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Score (out of {q.marks})</label>
                        <input
                          type="number" min="0" max={q.marks}
                          className="input w-24"
                          value={scores[answer?.id]?.score ?? ''}
                          onChange={e => setScores(s => ({ ...s, [answer?.id]: { ...s[answer?.id], score: e.target.value } }))}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">Comment (optional)</label>
                        <input
                          className="input"
                          placeholder="Feedback for the student…"
                          value={scores[answer?.id]?.comment ?? ''}
                          onChange={e => setScores(s => ({ ...s, [answer?.id]: { ...s[answer?.id], comment: e.target.value } }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
          <button className="btn-secondary" onClick={() => setMarking(null)}>Close</button>
          {essayQs.length > 0 && (
            <button className="btn-primary" onClick={saveMark} disabled={savingMark}>
              {savingMark ? 'Saving…' : '✅ Save marks'}
            </button>
          )}
        </div>
      </Modal>
    </Layout>
  )
}
