import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Layout, { PageHeader } from '../../components/Layout'
import { Spinner, Empty } from '../../components/ui'

// ── Grades ─────────────────────────────────────────────────────────────────────
export function StudentGrades() {
  const { profile, school } = useAuth()
  const [grades, setGrades]     = useState([])
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [gRes, rRes] = await Promise.all([
        supabase.from('grades').select('*, subjects(name)').eq('student_id', profile.id).eq('year', school.active_year).order('term'),
        supabase.from('report_cards').select('*').eq('student_id', profile.id).order('year', { ascending: false }).order('term', { ascending: false }),
      ])
      setGrades(gRes.data ?? [])
      setReports(rRes.data ?? [])
      setLoading(false)
    }
    if (profile && school) load()
  }, [profile, school])

  const termGrades = grades.reduce((acc, g) => {
    const key = `Term ${g.term}`
    if (!acc[key]) acc[key] = []
    acc[key].push(g)
    return acc
  }, {})

  return (
    <Layout>
      <PageHeader title="My Grades" subtitle={`Academic year ${school?.active_year}`} />
      {loading ? <Spinner className="py-16" /> : (
        <>
          {Object.keys(termGrades).length === 0 && (
            <Empty icon="📊" title="No grades yet" message="Your grades will appear here as teachers enter them." />
          )}

          {Object.entries(termGrades).map(([term, gs]) => (
            <div key={term} className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{term}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {gs.map(g => (
                  <div key={g.id} className="card p-4">
                    <p className="text-xs text-gray-400 mb-1">{g.subjects?.name}</p>
                    <p className="text-2xl font-bold text-gray-900">{g.final_grade ?? '—'}</p>
                    {g.teacher_comment && <p className="text-xs text-gray-500 mt-2 italic">"{g.teacher_comment}"</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {reports.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Report cards</h2>
              <div className="space-y-3">
                {reports.filter(r => r.published_at).map(r => (
                  <div key={r.id} className="card p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Term {r.term}, {r.year} Report Card</p>
                      {r.hod_comment && <p className="text-xs text-gray-500 mt-1 italic">"{r.hod_comment}"</p>}
                    </div>
                    <span className="badge-green">Published</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}

// ── Leaderboard ────────────────────────────────────────────────────────────────
export function StudentLeaderboard() {
  const { profile, school } = useAuth()
  const [subjects, setSubjects] = useState([])
  const [activeSubject, setActiveSubject] = useState(null)
  const [board, setBoard]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSubjects() {
      const { data: enr } = await supabase
        .from('subject_enrollments')
        .select('subject_id, subjects(id, name, form_level)')
        .eq('student_id', profile.id)
      const subs = (enr ?? []).map(e => e.subjects).filter(Boolean)
      setSubjects(subs)
      if (subs.length) setActiveSubject(subs[0])
    }
    if (profile && school) loadSubjects()
  }, [profile, school])

  useEffect(() => {
    if (!activeSubject) return
    setLoading(true)
    supabase.from('subject_leaderboard').select('*').eq('subject_id', activeSubject.id).order('rank')
      .then(({ data }) => { setBoard(data ?? []); setLoading(false) })
  }, [activeSubject])

  const myEntry   = board.find(e => e.student_id === profile.id)
  const topThree  = board.slice(0, 3)
  const medal = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`

  return (
    <Layout>
      <PageHeader title="Leaderboard" subtitle="Your ranking in each subject" />

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {subjects.map(s => (
          <button key={s.id} onClick={() => setActiveSubject(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
              ${activeSubject?.id === s.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}
          >{s.name}</button>
        ))}
      </div>

      {loading ? <Spinner className="py-16" /> : (
        board.length === 0
          ? <Empty icon="🏆" title="No data yet" message="Rankings appear once tasks are submitted and marked." />
          : (
            <>
              {/* My rank card */}
              {myEntry && (
                <div className="card p-5 mb-6 bg-gradient-to-r from-brand-50 to-white border-brand-200">
                  <p className="text-xs text-brand-600 font-semibold uppercase tracking-wide mb-1">Your position</p>
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-black text-brand-700">{medal(myEntry.rank)}</span>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{myEntry.score_pct}%</p>
                      <p className="text-xs text-gray-500">{myEntry.total_earned} / {myEntry.total_possible} marks from closed tasks</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Top 3 */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Top 3</h3>
                  <p className="text-xs text-gray-400">Full list visible to teachers</p>
                </div>
                {topThree.map(e => (
                  <div key={e.student_id} className={`px-5 py-4 flex items-center gap-4 border-b border-gray-50 last:border-0 ${e.student_id === profile.id ? 'bg-brand-50/30' : ''}`}>
                    <span className="text-xl w-8">{medal(e.rank)}</span>
                    <p className="flex-1 font-medium text-gray-800">{e.full_name}{e.student_id === profile.id ? ' (you)' : ''}</p>
                    <span className={`font-bold ${e.score_pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>{e.score_pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )
      )}
    </Layout>
  )
}

// ── Portfolio ──────────────────────────────────────────────────────────────────
export function StudentPortfolio() {
  const { profile, school } = useAuth()
  const [history, setHistory] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [gRes, rRes] = await Promise.all([
        supabase.from('grades').select('*, subjects(name, form_level)').eq('student_id', profile.id).order('year', { ascending: false }).order('term', { ascending: false }),
        supabase.from('report_cards').select('*').eq('student_id', profile.id).not('published_at', 'is', null).order('year', { ascending: false }).order('term', { ascending: false }),
      ])
      // Group by year + term
      const grouped = {}
      for (const g of gRes.data ?? []) {
        const key = `${g.year}-T${g.term}`
        if (!grouped[key]) grouped[key] = { year: g.year, term: g.term, grades: [] }
        grouped[key].grades.push(g)
      }
      setHistory(Object.values(grouped).sort((a, b) => b.year - a.year || b.term - a.term))
      setReports(rRes.data ?? [])
      setLoading(false)
    }
    if (profile) load()
  }, [profile])

  const avg = (grades) => {
    const nums = grades.map(g => parseFloat(g.final_grade)).filter(n => !isNaN(n))
    return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null
  }

  return (
    <Layout>
      <PageHeader
        title="My Portfolio"
        subtitle="Your complete academic record"
      />

      {loading ? <Spinner className="py-16" /> : (
        history.length === 0
          ? <Empty icon="🏅" title="Portfolio is empty" message="Your academic record will grow here each term." />
          : (
            <div className="relative pl-8">
              {/* Timeline line */}
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />

              <div className="space-y-8">
                {history.map(entry => {
                  const report = reports.find(r => r.term === entry.term && r.year === entry.year)
                  const termAvg = avg(entry.grades)
                  return (
                    <div key={`${entry.year}-${entry.term}`} className="relative">
                      {/* Dot */}
                      <div className="absolute -left-8 top-1 w-4 h-4 rounded-full bg-brand-500 border-2 border-white shadow" />
                      <div className="card p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <h3 className="font-bold text-gray-900">Term {entry.term}, {entry.year}</h3>
                            {termAvg !== null && (
                              <p className="text-xs text-gray-500 mt-0.5">Average: <strong>{termAvg}%</strong></p>
                            )}
                          </div>
                          {report && <span className="badge-green">Report published</span>}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {entry.grades.map(g => (
                            <div key={g.id} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                              <p className="text-xs text-gray-400">{g.subjects?.name}</p>
                              <p className="font-bold text-gray-800">{g.final_grade ?? '—'}</p>
                            </div>
                          ))}
                        </div>
                        {report?.hod_comment && (
                          <div className="mt-3 text-xs text-gray-500 italic bg-brand-50 px-3 py-2 rounded-lg">
                            HOD: "{report.hod_comment}"
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
      )}
    </Layout>
  )
}
