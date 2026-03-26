import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { StatCard, Spinner } from '../../components/ui'

export default function StudentDashboard() {
  const { profile, school } = useAuth()
  const [pending, setPending]   = useState([])
  const [notices, setNotices]   = useState([])
  const [stats, setStats]       = useState({ subjects: 0, submitted: 0, avgScore: null })
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      // Get enrolled subjects
      const { data: enr } = await supabase
        .from('subject_enrollments')
        .select('subject_id, subjects(id, name, form_level)')
        .eq('student_id', profile.id)
      const subIds = (enr ?? []).map(e => e.subject_id)

      // Get published tasks for enrolled subjects
      const { data: allTasks } = subIds.length
        ? await supabase.from('tasks').select('id, title, due_at, total_marks, subject_id, subjects(name)').in('subject_id', subIds).eq('status', 'published').order('due_at')
        : { data: [] }

      // Get student's submissions
      const { data: subs } = await supabase
        .from('submissions')
        .select('task_id, status, total_score')
        .eq('student_id', profile.id)

      const submittedSet = new Set((subs ?? []).filter(s => s.status === 'submitted').map(s => s.task_id))
      const pendingTasks = (allTasks ?? []).filter(t => !submittedSet.has(t.id) && new Date(t.due_at) >= new Date())

      // Avg score
      const scored = (subs ?? []).filter(s => s.total_score !== null)
      const avgScore = scored.length ? Math.round(scored.reduce((a, s) => a + s.total_score, 0) / scored.length) : null

      // Notices
      const { data: noteData } = await supabase
        .from('notices')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5)

      setPending(pendingTasks.slice(0, 5))
      setNotices(noteData ?? [])
      setStats({ subjects: subIds.length, submitted: submittedSet.size, avgScore })
      setLoading(false)
    }
    if (profile && school) load()
  }, [profile, school])

  return (
    <Layout>
      <PageHeader
        title={`Hello, ${profile?.full_name?.split(' ')[0]} 👋`}
        subtitle={`${school?.name} · Term ${school?.active_term}, ${school?.active_year}`}
      />

      {loading ? <Spinner className="py-20" /> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
            <StatCard label="My subjects"   value={stats.subjects}                                    icon="📚" color="blue"   />
            <StatCard label="Tasks done"    value={stats.submitted}                                   icon="✅" color="green"  />
            <StatCard label="Avg score"     value={stats.avgScore !== null ? `${stats.avgScore}` : '—'} icon="📊" color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending tasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Pending tasks</h2>
                <Link to="/student/tasks" className="text-xs text-brand-600 hover:underline">View all →</Link>
              </div>
              {pending.length === 0
                ? <div className="card p-6 text-center text-sm text-gray-400">🎉 You're all caught up!</div>
                : (
                  <div className="space-y-2">
                    {pending.map(t => {
                      const due  = new Date(t.due_at)
                      const diff = Math.ceil((due - new Date()) / 86400000)
                      return (
                        <Link key={t.id} to={`/student/tasks/${t.id}`} className="card p-4 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
                          <div>
                            <p className="font-medium text-gray-800">{t.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{t.subjects?.name} · {t.total_marks} marks</p>
                          </div>
                          <span className={`badge shrink-0 ${diff <= 1 ? 'badge-red' : diff <= 3 ? 'badge-amber' : 'badge-green'}`}>
                            {diff === 0 ? 'Due today' : diff === 1 ? 'Due tomorrow' : `${diff} days`}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                )
              }
            </div>

            {/* Notices */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Noticeboard</h2>
              {notices.length === 0
                ? <div className="card p-6 text-center text-sm text-gray-400">No announcements.</div>
                : (
                  <div className="space-y-2">
                    {notices.map(n => (
                      <div key={n.id} className={`card p-4 ${n.pinned ? 'border-brand-200 bg-brand-50/20' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {n.pinned && <span className="text-xs">📌</span>}
                          <p className="font-medium text-gray-800 text-sm">{n.title}</p>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{n.body}</p>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
