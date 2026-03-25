-- ==============================================================================
-- 1. MOCK DATA REMOVAL
-- This will delete all mock records but KEEP the 'schools' table and any 'hod' users.
-- ==============================================================================

DELETE FROM answers;
DELETE FROM submissions;
DELETE FROM questions;
DELETE FROM tasks;
DELETE FROM subject_enrollments;
DELETE FROM subjects;
DELETE FROM notices;
DELETE FROM profiles WHERE role != 'hod';

-- ==============================================================================
-- 2. ENABLE ROW-LEVEL SECURITY (RLS)
-- If RLS was already enabled, this is safe to run again.
-- ==============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- Helper function to quickly determine user role
-- (Drops first to avoid return type mismatch errors if it already existed)
DROP FUNCTION IF EXISTS get_user_role();
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;


-- ==============================================================================
-- 3. APPLY SECURITY POLICIES (INDUSTRY-GRADE RBAC)
-- ==============================================================================

-- Drop existing policies if any (to avoid "policy already exists" errors when re-running)
DO $$ DECLARE
    r record;
BEGIN
    FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

--------------------------------------------------------------------------------
-- PROFILES
--------------------------------------------------------------------------------
CREATE POLICY "Public profiles are viewable by everyone in the system"
ON profiles FOR SELECT USING (true); -- Alternatively, restrict by school_id

CREATE POLICY "HOD can do everything on profiles"
ON profiles FOR ALL USING (get_user_role() = 'hod');

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE USING (auth.uid() = id);

--------------------------------------------------------------------------------
-- SUBJECTS
--------------------------------------------------------------------------------
CREATE POLICY "Subjects viewable by all"
ON subjects FOR SELECT USING (true);

CREATE POLICY "HOD can do everything on subjects"
ON subjects FOR ALL USING (get_user_role() = 'hod');

--------------------------------------------------------------------------------
-- SUBJECT ENROLLMENTS
--------------------------------------------------------------------------------
CREATE POLICY "Enrollments viewable by all"
ON subject_enrollments FOR SELECT USING (true);

CREATE POLICY "HOD can do everything on enrollments"
ON subject_enrollments FOR ALL USING (get_user_role() = 'hod');

--------------------------------------------------------------------------------
-- TASKS
--------------------------------------------------------------------------------
CREATE POLICY "Tasks viewable by all users"
ON tasks FOR SELECT USING (true);

CREATE POLICY "HOD can do everything on tasks"
ON tasks FOR ALL USING (get_user_role() = 'hod');

CREATE POLICY "Teachers can create/update tasks for their subjects"
ON tasks FOR ALL USING (
  get_user_role() = 'teacher' AND 
  EXISTS (SELECT 1 FROM subjects WHERE id = tasks.subject_id AND teacher_id = auth.uid())
);

--------------------------------------------------------------------------------
-- QUESTIONS
--------------------------------------------------------------------------------
CREATE POLICY "Questions viewable by all"
ON questions FOR SELECT USING (true);

CREATE POLICY "HOD can do everything on questions"
ON questions FOR ALL USING (get_user_role() = 'hod');

CREATE POLICY "Teachers can manage questions for their tasks"
ON questions FOR ALL USING (
  get_user_role() = 'teacher' AND 
  EXISTS (
    SELECT 1 FROM tasks 
    JOIN subjects ON tasks.subject_id = subjects.id 
    WHERE tasks.id = questions.task_id AND subjects.teacher_id = auth.uid()
  )
);

--------------------------------------------------------------------------------
-- SUBMISSIONS
--------------------------------------------------------------------------------
CREATE POLICY "HOD can view all submissions"
ON submissions FOR SELECT USING (get_user_role() = 'hod');

CREATE POLICY "Teachers can view and update submissions for their tasks"
ON submissions FOR ALL USING (
  get_user_role() = 'teacher' AND 
  EXISTS (
    SELECT 1 FROM tasks 
    JOIN subjects ON tasks.subject_id = subjects.id 
    WHERE tasks.id = submissions.task_id AND subjects.teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view and create their own submissions"
ON submissions FOR ALL USING (
  auth.uid() = student_id
);

--------------------------------------------------------------------------------
-- ANSWERS
--------------------------------------------------------------------------------
CREATE POLICY "HOD can view all answers"
ON answers FOR SELECT USING (get_user_role() = 'hod');

CREATE POLICY "Teachers can view and grade answers for their tasks"
ON answers FOR ALL USING (
  get_user_role() = 'teacher' AND 
  EXISTS (
    SELECT 1 FROM submissions
    JOIN tasks ON submissions.task_id = tasks.id 
    JOIN subjects ON tasks.subject_id = subjects.id 
    WHERE submissions.id = answers.submission_id AND subjects.teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view and create their own answers"
ON answers FOR ALL USING (
  EXISTS (SELECT 1 FROM submissions WHERE id = answers.submission_id AND student_id = auth.uid())
);

--------------------------------------------------------------------------------
-- NOTICES
--------------------------------------------------------------------------------
CREATE POLICY "Notices viewable by all"
ON notices FOR SELECT USING (true);

CREATE POLICY "HOD can manage notices"
ON notices FOR ALL USING (get_user_role() = 'hod');

CREATE POLICY "Teachers can also post notices"
ON notices FOR ALL USING (get_user_role() = 'teacher');

-- End of Script
