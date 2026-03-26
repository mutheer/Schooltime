import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = {
  hod: [
    { to: '/hod',           label: 'Dashboard',  icon: '🏠' },
    { to: '/hod/teachers',  label: 'Teachers',   icon: '👩‍🏫' },
    { to: '/hod/students',  label: 'Students',   icon: '🎓' },
    { to: '/hod/subjects',  label: 'Subjects',   icon: '📚' },
    { to: '/hod/reports',   label: 'Reports',    icon: '📄' },
    { to: '/hod/notices',   label: 'Notices',    icon: '📣' },
  ],
  teacher: [
    { to: '/teacher',             label: 'Dashboard',   icon: '🏠' },
    { to: '/teacher/tasks',       label: 'Tasks',       icon: '📋' },
    { to: '/teacher/grades',      label: 'Grades',      icon: '✏️' },
    { to: '/teacher/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { to: '/teacher/notices',     label: 'Notices',     icon: '📣' },
  ],
  student: [
    { to: '/student',             label: 'Dashboard',   icon: '🏠' },
    { to: '/student/tasks',       label: 'My Tasks',    icon: '📋' },
    { to: '/student/grades',      label: 'Grades',      icon: '📊' },
    { to: '/student/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { to: '/student/portfolio',   label: 'Portfolio',   icon: '🏅' },
  ],
}

export default function Sidebar() {
  const { profile, school, signOut } = useAuth()
  const items = navItems[profile?.role] ?? []
  const [open, setOpen] = useState(false)

  const roleLabel = { hod: 'Head of Dept.', teacher: 'Teacher', student: 'Student' }

  const SidebarContent = () => (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-100 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎓</span>
          <div>
            <p className="text-base font-bold text-brand-700 leading-none">SchoolTime</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[130px]">{school?.name ?? '—'}</p>
          </div>
        </div>
        {/* Close button (mobile only) */}
        <button
          className="lg:hidden p-1 rounded-md text-gray-500 hover:bg-gray-100"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split('/').length === 2}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive
                 ? 'bg-brand-50 text-brand-700'
                 : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
            {profile?.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-gray-800 truncate">{profile?.full_name}</p>
            <p className="text-xs text-gray-400">{roleLabel[profile?.role]}</p>
          </div>
        </div>
        <button onClick={signOut} className="btn-ghost w-full text-xs justify-start gap-2 text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-brand-700">SchoolTime</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Desktop sidebar - always visible */}
      <div className="hidden lg:flex">
        <SidebarContent />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  )
}
