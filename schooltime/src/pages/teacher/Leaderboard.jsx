import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Spinner, Empty } from '../../components/ui'

export default function TeacherLeaderboard() {
  const { profile, school } = useAuth()
  const [subjects, setSubjects]     = useState([])
  const [activeSubject, setActiveSubject] = useState(null)
  const [board, setBoard]           = useState([])
  const [loading, setLoading]       = useState(true)

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
    loadBoard()
  }, [activeSubject])

  async function loadBoard() {
    setLoading(true)
    const { data } = await supabase
      .from('subject_leaderboard')
      .select('*')
      .eq('subject_id', activeSubject.id)
      .order('rank')
    setBoard(data ?? [])
    setLoading(false)
  }

  const medal = (rank) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

  return (
    <Layout>
      <PageHeader title="Leaderboard" subtitle="Live subject rankings based on task scores" />

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
        board.length === 0
          ? <Empty icon="🏆" title="No data yet" message="Rankings appear once students submit and tasks are marked." />
          : (
            <div className="card overflow-hidden">
              {/* Top 3 podium */}
              {board.slice(0, 3).length > 0 && (
                <div className="flex items-end justify-center gap-3 sm:gap-4 p-6 sm:p-8 bg-gradient-to-br from-brand-50 to-white border-b border-gray-100">
                  {[board[1], board[0], board[2]].filter(Boolean).map((entry, i) => {
                    const heights = [28, 36, 24]
                    const h = heights[i]
                    return (
                      <div key={entry.student_id} className="flex flex-col items-center gap-2">
                        <span className="text-2xl">{medal(entry.rank)}</span>
                        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-brand-100 flex items-center justify-center text-base sm:text-xl font-bold text-brand-700">
                          {entry.full_name.split(' ').map(n => n[0]).slice(0,2).join('')}
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-gray-800 text-center leading-tight">{entry.full_name.split(' ')[0]}</p>
                        <p className="text-base sm:text-lg font-bold text-brand-600">{entry.score_pct}%</p>
                        <div className={`bg-brand-600 rounded-t-lg w-12 sm:w-16`} style={{ height: `${h * 2}px` }} />
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Full list */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">Rank</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Marks earned</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.map(entry => (
                      <tr key={entry.student_id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-5 py-3">
                          <span className="text-lg">{medal(entry.rank) ?? <span className="text-gray-400 font-semibold text-sm">#{entry.rank}</span>}</span>
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-800">{entry.full_name}</p>
                          <p className="text-xs text-gray-400">{entry.form_level}</p>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{entry.total_earned} / {entry.total_possible}</td>
                        <td className="px-5 py-3">
                          <span className={`font-bold ${entry.score_pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>{entry.score_pct}%</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 sm:w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(entry.score_pct, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
      )}
    </Layout>
  )
}
