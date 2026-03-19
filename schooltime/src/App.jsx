import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Spinner } from './components/ui'
import Login from './pages/Login'

// HOD pages
import HodDashboard from './pages/hod/Dashboard'
import Teachers     from './pages/hod/Teachers'
import Students     from './pages/hod/Students'
import Subjects     from './pages/hod/Subjects'
import Reports      from './pages/hod/Reports'
import HodNotices   from './pages/hod/Notices'

// Teacher pages
import TeacherDashboard  from './pages/teacher/Dashboard'
import TeacherTasks      from './pages/teacher/Tasks'
import TaskDetail        from './pages/teacher/TaskDetail'
import TeacherGrades     from './pages/teacher/Grades'
import TeacherLeaderboard from './pages/teacher/Leaderboard'
import TeacherNotices    from './pages/teacher/Notices'

// Student pages
import StudentDashboard from './pages/student/Dashboard'
import { StudentTaskList, StudentTaskAttempt } from './pages/student/Tasks'
import { StudentGrades, StudentLeaderboard, StudentPortfolio } from './pages/student/StudentPages'

function RoleRoute({ role, children }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== role) return <Navigate to={`/${profile.role}`} replace />
  return children
}

function AuthRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>
  if (!profile) return <Navigate to="/login" replace />
  return <Navigate to={`/${profile.role}`} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/"     element={<AuthRedirect />} />

          {/* HOD routes */}
          <Route path="/hod"           element={<RoleRoute role="hod"><HodDashboard /></RoleRoute>} />
          <Route path="/hod/teachers"  element={<RoleRoute role="hod"><Teachers /></RoleRoute>} />
          <Route path="/hod/students"  element={<RoleRoute role="hod"><Students /></RoleRoute>} />
          <Route path="/hod/subjects"  element={<RoleRoute role="hod"><Subjects /></RoleRoute>} />
          <Route path="/hod/reports"   element={<RoleRoute role="hod"><Reports /></RoleRoute>} />
          <Route path="/hod/notices"   element={<RoleRoute role="hod"><HodNotices /></RoleRoute>} />

          {/* Teacher routes */}
          <Route path="/teacher"              element={<RoleRoute role="teacher"><TeacherDashboard /></RoleRoute>} />
          <Route path="/teacher/tasks"        element={<RoleRoute role="teacher"><TeacherTasks /></RoleRoute>} />
          <Route path="/teacher/tasks/:id"    element={<RoleRoute role="teacher"><TaskDetail /></RoleRoute>} />
          <Route path="/teacher/grades"       element={<RoleRoute role="teacher"><TeacherGrades /></RoleRoute>} />
          <Route path="/teacher/leaderboard"  element={<RoleRoute role="teacher"><TeacherLeaderboard /></RoleRoute>} />
          <Route path="/teacher/notices"      element={<RoleRoute role="teacher"><TeacherNotices /></RoleRoute>} />

          {/* Student routes */}
          <Route path="/student"              element={<RoleRoute role="student"><StudentDashboard /></RoleRoute>} />
          <Route path="/student/tasks"        element={<RoleRoute role="student"><StudentTaskList /></RoleRoute>} />
          <Route path="/student/tasks/:id"    element={<RoleRoute role="student"><StudentTaskAttempt /></RoleRoute>} />
          <Route path="/student/grades"       element={<RoleRoute role="student"><StudentGrades /></RoleRoute>} />
          <Route path="/student/leaderboard"  element={<RoleRoute role="student"><StudentLeaderboard /></RoleRoute>} />
          <Route path="/student/portfolio"    element={<RoleRoute role="student"><StudentPortfolio /></RoleRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
