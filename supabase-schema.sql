-- Profiles table (maps to legacy users table)
-- Supabase Auth handles authentication, this is the app-level profile
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  api_key TEXT,
  api_key_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tags table (exact match to legacy)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_name ON tags(user_id, name);

-- Habits table (exact match to legacy)
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  interval_days INTEGER NOT NULL DEFAULT 1 CHECK (interval_days >= 1),
  next_due_date TEXT NOT NULL,
  start_date TEXT NOT NULL DEFAULT '',
  archived BOOLEAN NOT NULL DEFAULT false,
  tag_id UUID REFERENCES tags(id) ON DELETE SET NULL,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habit events table (exact match to legacy)
CREATE TABLE IF NOT EXISTS habit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('done', 'push', 'skip')),
  action_date TEXT NOT NULL,
  from_due_date TEXT,
  to_due_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (exact match to legacy)
CREATE INDEX IF NOT EXISTS idx_habits_user_archived ON habits(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_habits_user_due ON habits(user_id, next_due_date);
CREATE INDEX IF NOT EXISTS idx_events_habit_date ON habit_events(habit_id, action_date);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON habit_events(user_id, action_date);

-- Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: auto-update email on auth email change
CREATE OR REPLACE FUNCTION handle_email_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET email = NEW.email, updated_at = now() WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_email_changed ON auth.users;
CREATE TRIGGER on_auth_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION handle_email_change();

-- RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_events ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/update their own
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Tags: full CRUD for own tags
CREATE POLICY "Users can CRUD own tags"
  ON tags FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Habits: full CRUD for own habits
CREATE POLICY "Users can CRUD own habits"
  ON habits FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Habit events: full CRUD for own events
CREATE POLICY "Users can CRUD own events"
  ON habit_events FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- RPC: apply_habit_action (core check-in logic)
CREATE OR REPLACE FUNCTION apply_habit_action(
  p_habit_id UUID,
  p_action TEXT,
  p_action_date DATE DEFAULT NULL
)
RETURNS habits AS $$
DECLARE
  v_habit habits%ROWTYPE;
  v_today DATE := COALESCE(p_action_date, (now() AT TIME ZONE 'UTC' + INTERVAL '8 hours')::date);
  v_from_due DATE;
  v_to_due DATE;
  v_last_done DATE;
BEGIN
  SELECT * INTO v_habit FROM habits WHERE id = p_habit_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_habit.archived THEN RAISE EXCEPTION 'HABIT_ARCHIVED'; END IF;
  IF v_habit.interval_days < 1 THEN RAISE EXCEPTION 'INVALID_INTERVAL'; END IF;

  v_from_due := v_habit.next_due_date;

  CASE p_action
    WHEN 'push' THEN
      v_to_due := v_today + 1;
    WHEN 'skip' THEN
      v_to_due := v_from_due;
      WHILE v_to_due < v_today LOOP
        v_to_due := v_to_due + v_habit.interval_days;
      END LOOP;
    WHEN 'done' THEN
      SELECT MAX(action_date) INTO v_last_done
      FROM habit_events
      WHERE habit_id = p_habit_id AND action = 'done';
      v_to_due := GREATEST(COALESCE(v_last_done, v_today), v_today)
                  + GREATEST(v_habit.interval_days, 1);
  END CASE;

  -- Delete existing event for today and insert new
  DELETE FROM habit_events
  WHERE habit_id = p_habit_id AND action_date = v_today AND user_id = auth.uid();

  INSERT INTO habit_events (user_id, habit_id, action, action_date, from_due_date, to_due_date)
  VALUES (auth.uid(), p_habit_id, p_action, v_today, v_from_due, v_to_due);

  UPDATE habits SET next_due_date = v_to_due, updated_at = now()
  WHERE id = p_habit_id
  RETURNING * INTO v_habit;

  RETURN v_habit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_stats_summary
CREATE OR REPLACE FUNCTION get_stats_summary(p_today DATE DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_today DATE := COALESCE(p_today, (now() AT TIME ZONE 'UTC' + INTERVAL '8 hours')::date);
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'today', v_today,
    'counts', json_build_object(
      'active', (SELECT count(*) FROM habits WHERE user_id = auth.uid() AND archived = false),
      'archived', (SELECT count(*) FROM habits WHERE user_id = auth.uid() AND archived = true),
      'dueToday', (SELECT count(*) FROM habits WHERE user_id = auth.uid() AND archived = false AND next_due_date = v_today),
      'overdue', (SELECT count(*) FROM habits WHERE user_id = auth.uid() AND archived = false AND next_due_date < v_today),
      'upcoming', (SELECT count(*) FROM habits WHERE user_id = auth.uid() AND archived = false AND next_due_date > v_today)
    ),
    'recentEvents', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', he.id,
        'action', he.action,
        'actionDate', he.action_date,
        'fromDueDate', he.from_due_date,
        'toDueDate', he.to_due_date,
        'createdAt', he.created_at,
        'habit', json_build_object('id', h.id, 'title', h.title)
      )), '[]'::json)
      FROM habit_events he
      JOIN habits h ON h.id = he.habit_id
      WHERE he.user_id = auth.uid()
      ORDER BY he.created_at DESC LIMIT 20
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: manual_done (atomic backfill check-in for past dates)
CREATE OR REPLACE FUNCTION manual_done(
  p_habit_id UUID,
  p_action_date DATE
)
RETURNS habits AS $$
DECLARE
  v_habit habits%ROWTYPE;
  v_today DATE := (now() AT TIME ZONE 'UTC' + INTERVAL '8 hours')::date;
  v_new_due DATE;
  v_existing_id UUID;
BEGIN
  SELECT * INTO v_habit FROM habits WHERE id = p_habit_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_habit.archived THEN RAISE EXCEPTION 'HABIT_ARCHIVED'; END IF;
  IF v_habit.interval_days < 1 THEN RAISE EXCEPTION 'INVALID_INTERVAL'; END IF;

  IF p_action_date > v_today THEN RAISE EXCEPTION 'FUTURE_DATE'; END IF;
  IF v_habit.start_date != '' AND p_action_date < v_habit.start_date::date THEN
    RAISE EXCEPTION 'BEFORE_START_DATE';
  END IF;

  SELECT id INTO v_existing_id FROM habit_events
  WHERE habit_id = p_habit_id AND action_date = p_action_date AND action = 'done';
  IF v_existing_id IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_DONE'; END IF;

  v_new_due := p_action_date + GREATEST(v_habit.interval_days, 1);

  INSERT INTO habit_events (user_id, habit_id, action, action_date, from_due_date, to_due_date)
  VALUES (auth.uid(), p_habit_id, 'done', p_action_date, v_habit.next_due_date, v_new_due::text);

  IF v_new_due > v_habit.next_due_date::date THEN
    UPDATE habits SET next_due_date = v_new_due::text, updated_at = now()
    WHERE id = p_habit_id;
  END IF;

  SELECT * INTO v_habit FROM habits WHERE id = p_habit_id;
  RETURN v_habit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: list_habits
CREATE OR REPLACE FUNCTION list_habits(p_archived BOOLEAN)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(sub) INTO v_result
  FROM (
    SELECT json_build_object(
      'id', h.id,
      'title', h.title,
      'note', h.note,
      'intervalDays', h.interval_days,
      'nextDueDate', h.next_due_date,
      'startDate', h.start_date,
      'archived', h.archived,
      'icon', h.icon,
      'createdAt', h.created_at,
      'updatedAt', h.updated_at,
      'tag', t.name,
      'lastDoneDate', last_done.last_done_date,
      'lastAction', last_evt.last_action,
      'lastActionDate', last_evt.last_action_date
    ) as sub
    FROM habits h
    LEFT JOIN tags t ON t.id = h.tag_id
    LEFT JOIN LATERAL (
      SELECT he.action AS last_action, he.action_date AS last_action_date
      FROM habit_events he
      WHERE he.habit_id = h.id
      ORDER BY he.created_at DESC LIMIT 1
    ) last_evt ON true
    LEFT JOIN LATERAL (
      SELECT he.action_date AS last_done_date
      FROM habit_events he
      WHERE he.habit_id = h.id AND he.action = 'done'
      ORDER BY he.action_date DESC LIMIT 1
    ) last_done ON true
    WHERE h.user_id = auth.uid() AND h.archived = p_archived
    ORDER BY h.next_due_date ASC
  ) ordered;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_habit_detail
CREATE OR REPLACE FUNCTION get_habit_detail(p_habit_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'id', h.id,
    'title', h.title,
    'note', h.note,
    'intervalDays', h.interval_days,
    'nextDueDate', h.next_due_date,
    'startDate', h.start_date,
    'archived', h.archived,
    'icon', h.icon,
    'createdAt', h.created_at,
    'updatedAt', h.updated_at,
    'tag', t.name,
    'lastDoneDate', last_done.last_done_date,
    'lastAction', last_evt.last_action,
    'lastActionDate', last_evt.last_action_date
  ) INTO v_result
  FROM habits h
  LEFT JOIN tags t ON t.id = h.tag_id
  LEFT JOIN LATERAL (
    SELECT he.action AS last_action, he.action_date AS last_action_date
    FROM habit_events he
    WHERE he.habit_id = h.id
    ORDER BY he.created_at DESC LIMIT 1
  ) last_evt ON true
  LEFT JOIN LATERAL (
    SELECT he.action_date AS last_done_date
    FROM habit_events he
    WHERE he.habit_id = h.id AND he.action = 'done'
    ORDER BY he.action_date DESC LIMIT 1
  ) last_done ON true
  WHERE h.id = p_habit_id AND h.user_id = auth.uid();

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
