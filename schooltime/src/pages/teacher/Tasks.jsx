import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Modal, Alert, Field, Spinner, Empty, Table, TR, TD } from '../../components/ui'

const blankQ = (type) => ({
  _id: Math.random().toString(36).slice(2),
  question_type: type,
  question_text: '',
  options: type === 'mcq' ? [
    { id: 'a', text: '', is_correct: false },
    { id: 'b', text: '', is_correct: false },
    { id: 'c', text: '', is_correct: false },
    { id: 'd', text: '', is_correct: false },
  ] : null,
  correct_answer: type === 'true_false' ? 'true' : '',
  marks: 1,
  marking_guide: '',
})

export default function TeacherTasks() {
  const { profile, school } = useAuth()
  const [params]            = useSearchParams()
  const navigate            = useNavigate()
  const [subjects, setSubjects] = useState([])
  const [activeSubject, setActiveSubject] = useState(params.get('subject') ?? '')
  const [tasks, setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert]   = useState(null)

  // Task form state
  const [title, setTitle]           = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueAt, setDueAt]           = useState('')
  const [taskType, setTaskType]     = useState('mixed')
  const [questions, setQuestions]   = useState([])

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
      if (!activeSubject && data?.length) setActiveSubject(data[0].id)
    }
    if (profile && school) loadSubjects()
  }, [profile, school])

  useEffect(() => {
    if (!activeSubject) { setLoading(false); return }
    loadTasks()
  }, [activeSubject])

  async function loadTasks() {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('subject_id', activeSubject)
      .order('created_at', { ascending: false })
    setTasks(data ?? [])
    setLoading(false)
  }

  function addQuestion(type) {
    setQuestions(q => [...q, blankQ(type)])
  }

  function updateQ(idx, field, value) {
    setQuestions(qs => qs.map((q, i) => i !== idx ? q : { ...q, [field]: value }))
  }

  function updateOption(qIdx, optId, field, value) {
    setQuestions(qs => qs.map((q, i) => {
      if (i !== qIdx) return q
      const opts = q.options.map(o => {
        if (o.id !== optId) return field === 'is_correct' ? { ...o, is_correct: false } : o
        return { ...o, [field]: value }
      })
      return { ...q, options: opts, correct_answer: field === 'is_correct' && value ? optId : q.correct_answer }
    }))
  }

  function removeQ(idx) {
    setQuestions(qs => qs.filter((_, i) => i !== idx))
  }

  async function saveTask(status = 'draft') {
    if (!title || !dueAt || !activeSubject) {
      setAlert({ type: 'error', msg: 'Title, due date and subject are required.' })
      return
    }
    if (questions.length === 0) {
      setAlert({ type: 'error', msg: 'Add at least one question.' })
      return
    }
    setSaving(true)
    const totalMarks = questions.reduce((s, q) => s + Number(q.marks), 0)

    const { data: task, error: tErr } = await supabase.from('tasks').insert({
      subject_id:   activeSubject,
      title,
      instructions,
      task_type:    taskType,
      total_marks:  totalMarks,
      due_at:       dueAt,
      status,
    }).select().single()

    if (tErr) { setAlert({ type: 'error', msg: tErr.message }); setSaving(false); return }

    const qRows = questions.map((q, i) => ({
      task_id:        task.id,
      order_index:    i,
      question_type:  q.question_type,
      question_text:  q.question_text,
      options:        q.options,
      correct_answer: q.correct_answer,
      marks:          Number(q.marks),
      marking_guide:  q.marking_guide || null,
    }))

    const { error: qErr } = await supabase.from('questions').insert(qRows)
    if (qErr) { setAlert({ type: 'error', msg: qErr.message }); setSaving(false); return }

    setModal(false)
    setTitle(''); setInstructions(''); setDueAt(''); setQuestions([])
    setSaving(false)
    loadTasks()
  }

  async function publishTask(id) {
    await supabase.from('tasks').update({ status: 'published' }).eq('id', id)
    loadTasks()
  }

  async function closeTask(id) {
    await supabase.from('tasks').update({ status: 'closed' }).eq('id', id)
    loadTasks()
  }

  const statusBadge = { draft: 'badge-gray', published: 'badge-green', closed: 'badge-amber' }
  const currentSub  = subjects.find(s => s.id === activeSubject)

  return (
    <Layout>
      <PageHeader
        title="Tasks"
        subtitle="Create and manage homework tasks"
        action={<button className="btn-primary" onClick={() => { setAlert(null); setModal(true) }}>+ New task</button>}
      />

      {/* Subject tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {subjects.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSubject(s.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
              ${activeSubject === s.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}
          >
            {s.name} <span className="opacity-60 ml-1">{s.form_level}</span>
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? <Spinner className="py-16" /> : (
          <Table
            cols={['Title', 'Type', 'Marks', 'Due', 'Status', 'Actions']}
            empty={!tasks.length && <Empty icon="📋" title="No tasks yet" message="Create your first task for this subject." />}
          >
            {tasks.map(t => (
              <TR key={t.id}>
                <TD>
                  <Link to={`/teacher/tasks/${t.id}`} className="font-medium text-brand-600 hover:underline">
                    {t.title}
                  </Link>
                </TD>
                <TD><span className="badge-purple capitalize">{t.task_type}</span></TD>
                <TD>{t.total_marks}</TD>
                <TD>{new Date(t.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</TD>
                <TD><span className={statusBadge[t.status] ?? 'badge-gray'}>{t.status}</span></TD>
                <TD>
                  <div className="flex gap-2">
                    {t.status === 'draft' && (
                      <button onClick={() => publishTask(t.id)} className="text-xs text-green-600 hover:underline font-medium">Publish</button>
                    )}
                    {t.status === 'published' && (
                      <button onClick={() => closeTask(t.id)} className="text-xs text-amber-600 hover:underline font-medium">Close</button>
                    )}
                    <Link to={`/teacher/tasks/${t.id}`} className="text-xs text-brand-600 hover:underline font-medium">
                      {t.status === 'draft' ? 'Edit' : 'Mark'}
                    </Link>
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
        )}
      </div>

      {/* Task builder modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Create new task" size="xl">
        {alert && <Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} />}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Task title *">
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 4 Review" />
          </Field>
          <Field label="Due date & time *">
            <input type="datetime-local" className="input" value={dueAt} onChange={e => setDueAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Instructions (shown to students before they start)">
          <textarea className="input h-20 resize-none" value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Optional instructions, context, or rules for this task…" />
        </Field>

        {/* Questions */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Questions ({questions.length}) — Total: {questions.reduce((s, q) => s + Number(q.marks), 0)} marks</h3>
            <div className="flex gap-2">
              <button onClick={() => addQuestion('mcq')}        className="btn-secondary text-xs py-1">+ MCQ</button>
              <button onClick={() => addQuestion('true_false')} className="btn-secondary text-xs py-1">+ True/False</button>
              <button onClick={() => addQuestion('essay')}      className="btn-secondary text-xs py-1">+ Essay</button>
            </div>
          </div>

          <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
            {questions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                Add questions using the buttons above.
              </p>
            )}
            {questions.map((q, idx) => (
              <div key={q._id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center gap-3 mb-3">
                  <span className="badge-purple capitalize">{q.question_type === 'true_false' ? 'True / False' : q.question_type === 'mcq' ? 'Multiple choice' : 'Essay'}</span>
                  <span className="text-xs text-gray-400">Q{idx + 1}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <label className="text-xs text-gray-500">Marks:</label>
                    <input type="number" min="1" className="input w-16 py-1 text-xs" value={q.marks} onChange={e => updateQ(idx, 'marks', e.target.value)} />
                    <button onClick={() => removeQ(idx)} className="text-gray-300 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>

                <textarea
                  className="input text-sm h-16 resize-none mb-3"
                  placeholder="Question text…"
                  value={q.question_text}
                  onChange={e => updateQ(idx, 'question_text', e.target.value)}
                />

                {q.question_type === 'mcq' && (
                  <div className="space-y-2">
                    {q.options.map(opt => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input type="radio" name={`correct-${q._id}`} checked={q.correct_answer === opt.id}
                          onChange={() => updateOption(idx, opt.id, 'is_correct', true)} className="accent-brand-600" />
                        <span className="text-xs font-medium text-gray-500 w-5">{opt.id.toUpperCase()}.</span>
                        <input className="input text-sm py-1 flex-1" placeholder={`Option ${opt.id.toUpperCase()}`}
                          value={opt.text} onChange={e => updateOption(idx, opt.id, 'text', e.target.value)} />
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 mt-1">Select the radio button next to the correct answer.</p>
                  </div>
                )}

                {q.question_type === 'true_false' && (
                  <div className="flex gap-4">
                    {['true','false'].map(v => (
                      <label key={v} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name={`tf-${q._id}`} value={v}
                          checked={q.correct_answer === v}
                          onChange={() => updateQ(idx, 'correct_answer', v)} className="accent-brand-600" />
                        <span className="text-sm font-medium capitalize">{v}</span>
                      </label>
                    ))}
                    <span className="text-xs text-gray-400 ml-2 self-center">Select the correct answer</span>
                  </div>
                )}

                {q.question_type === 'essay' && (
                  <textarea
                    className="input text-sm h-16 resize-none"
                    placeholder="Marking guide (private — only you see this)…"
                    value={q.marking_guide}
                    onChange={e => updateQ(idx, 'marking_guide', e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
          <button className="btn-secondary" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn-secondary" onClick={() => saveTask('draft')} disabled={saving}>Save draft</button>
          <button className="btn-primary"   onClick={() => saveTask('published')} disabled={saving}>{saving ? 'Publishing…' : '🚀 Publish task'}</button>
        </div>
      </Modal>
    </Layout>
  )
}
