import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { StatCard, Spinner } from '../../components/ui'

export default function HodDashboard() {
  const { school } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function load() {
      const [teachers, students, subjects, tasks] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('subjects').select('id', { count: 'exact', head: true })
          .eq('term', school.active_term).eq('year', school.active_year),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      ])
      setStats({
        teachers: teachers.count ?? 0,
        students: students.count ?? 0,
        subjects: subjects.count ?? 0,
        tasks: tasks.count ?? 0,
      })
    }
    if (school) load()
  }, [school])

  return (
    <Layout>
      <PageHeader
        title={`Welcome back 👋`}
        subtitle={`${school?.name} — Term ${school?.active_term}, ${school?.active_year}`}
      />

      {!stats ? <Spinner className="py-20" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatCard label="Teachers"       value={stats.teachers} icon="👩‍🏫" color="purple" />
            <StatCard label="Students"       value={stats.students} icon="🎓"   color="blue"   />
            <StatCard label="Subjects (term)" value={stats.subjects} icon="📚"   color="green"  />
            <StatCard label="Active tasks"   value={stats.tasks}    icon="📋"   color="amber"  />
          </div>

          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Quick actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { to: '/hod/teachers', icon: '👩‍🏫', label: 'Manage teachers',  desc: 'Create accounts, assign to subjects' },
              { to: '/hod/students', icon: '🎓',   label: 'Manage students',  desc: 'Enroll students, manage enrollments' },
              { to: '/hod/subjects', icon: '📚',   label: 'Manage subjects',  desc: 'Create subjects, assign teachers & students' },
              { to: '/hod/reports',  icon: '📄',   label: 'Generate reports', desc: 'Review grades and publish report cards' },
              { to: '/hod/notices',  icon: '📣',   label: 'Post notice',      desc: 'Broadcast to all students & teachers' },
            ].map(item => (
              <Link key={item.to} to={item.to} className="card p-5 hover:shadow-md transition-shadow group">
                <div className="text-2xl mb-3">{item.icon}</div>
                <p className="font-semibold text-gray-800 group-hover:text-brand-600 transition-colors">{item.label}</p>
                <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}
