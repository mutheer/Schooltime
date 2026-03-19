import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { StatCard, Spinner } from '../../components/ui'

export default function TeacherDashboard() {
  const { profile, school } = useAuth()
  const [subjects, setSubjects] = useState([])
  const [stats, setStats]       = useState({ tasks: 0, pending: 0 })
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { data: subs } = await supabase
        .from('subjects')
        .select('id, name, form_level')
        .eq('teacher_id', profile.id)
        .eq('term', school.active_term)
        .eq('year', school.active_year)

      const subIds = (subs ?? []).map(s => s.id)

      let taskCount = 0, pendingCount = 0
      if (subIds.length) {
        const { count: tc } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).in('subject_id', subIds).eq('status', 'published')
        const { count: pc } = await supabase.from('submissions').select('id', { count: 'exact', head: true }).in('task_id',
          (await supabase.from('tasks').select('id').in('subject_id', subIds).eq('status', 'published')).data?.map(t => t.id) ?? []
        ).eq('status', 'submitted').is('total_score', null)
        taskCount    = tc ?? 0
        pendingCount = pc ?? 0
      }

      setSubjects(subs ?? [])
      setStats({ tasks: taskCount, pending: pendingCount })
      setLoading(false)
    }
    if (profile && school) load()
  }, [profile, school])

  return (
    <Layout>
      <PageHeader
        title={`Hello, ${profile?.full_name?.split(' ')[0]} 👋`}
        subtitle={`Term ${school?.active_term}, ${school?.active_year}`}
      />

      {loading ? <Spinner className="py-20" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            <StatCard label="My subjects"      value={subjects.length} icon="📚" color="blue"   />
            <StatCard label="Active tasks"     value={stats.tasks}     icon="📋" color="green"  />
            <StatCard label="Pending marking"  value={stats.pending}   icon="✏️" color="amber"  />
          </div>

          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">My subjects this term</h2>
          {subjects.length === 0
            ? <p className="text-sm text-gray-400">You have no subjects assigned this term. Contact your HOD.</p>
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.map(s => (
                  <Link key={s.id} to={`/teacher/tasks?subject=${s.id}`} className="card p-5 hover:shadow-md transition-shadow group">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-2xl">📚</span>
                      <span className="badge-blue">{s.form_level}</span>
                    </div>
                    <p className="font-semibold text-gray-800 group-hover:text-brand-600 transition-colors">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-1">View tasks & submissions →</p>
                  </Link>
                ))}
              </div>
            )
          }
        </>
      )}
    </Layout>
  )
}
