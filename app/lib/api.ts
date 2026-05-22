import { supabase } from "./supabase";
import { todayDateOnly } from "./date";

// --- Types (same as legacy) ---

export type User = {
  id: string;
  email: string;
  name: string | null;
};

export type Habit = {
  id: string;
  title: string;
  note: string;
  intervalDays: number;
  nextDueDate: string;
  startDate: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastDoneDate: string | null;
  lastAction: string | null;
  lastActionDate: string | null;
  tag: string | null;
  icon: string | null;
};

export type HabitEvent = {
  id: string;
  action: "done" | "push" | "skip";
  actionDate: string;
  fromDueDate: string | null;
  toDueDate: string | null;
  createdAt: string;
};

export type StatsSummary = {
  today: string;
  counts: {
    active: number;
    archived: number;
    dueToday: number;
    overdue: number;
    upcoming: number;
  };
  recentEvents: Array<
    HabitEvent & {
      habit: { id: string; title: string };
    }
  >;
};

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(args: { status: number; code: string; details?: unknown }) {
    super(args.code);
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
  }
}

// --- Helpers ---

function mapHabit(row: Record<string, unknown>): Habit {
  return {
    id: row.id as string,
    title: row.title as string,
    note: row.note as string,
    intervalDays: row.interval_days as number,
    nextDueDate: row.next_due_date as string,
    startDate: row.start_date as string,
    archived: Boolean(row.archived),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastDoneDate: (row.last_done_date as string) ?? null,
    lastAction: (row.last_action as string) ?? null,
    lastActionDate: (row.last_action_date as string) ?? null,
    tag: (row.tag_name as string) ?? null,
    icon: (row.icon as string) ?? null,
  };
}

function mapEvent(row: Record<string, unknown>): HabitEvent {
  return {
    id: row.id as string,
    action: row.action as "done" | "push" | "skip",
    actionDate: row.action_date as string,
    fromDueDate: (row.from_due_date as string) ?? null,
    toDueDate: (row.to_due_date as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// --- Auth ---

export async function register(args: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ user: User }> {
  const { data, error } = await supabase.auth.signUp({
    email: args.email,
    password: args.password,
    options: { data: { name: args.name ?? "" } },
  });
  if (error) {
    if (error.message.includes("already registered")) {
      throw new ApiError({ status: 409, code: "EMAIL_IN_USE" });
    }
    throw new ApiError({ status: 400, code: error.message });
  }
  const profile = await getProfile(data.user!.id);
  return { user: profile };
}

export async function login(args: { email: string; password: string }): Promise<{ user: User }> {
  const { data, error } = await supabase.auth.signInWithPassword(args);
  if (error) {
    throw new ApiError({ status: 401, code: "INVALID_CREDENTIALS" });
  }
  const profile = await getProfile(data.user.id);
  return { user: profile };
}

export async function logout(): Promise<{ ok: boolean }> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new ApiError({ status: 500, code: error.message });
  return { ok: true };
}

async function getProfile(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, name")
    .eq("id", userId)
    .single();
  if (error) {
    // Fallback: get email from auth
    const { data: userData } = await supabase.auth.getUser();
    return {
      id: userId,
      email: userData.user?.email ?? "",
      name: null,
    };
  }
  return {
    id: data.id,
    email: data.email,
    name: data.name,
  };
}

export async function me(): Promise<{ user: User }> {
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();
  if (error || !authUser) {
    throw new ApiError({ status: 401, code: "UNAUTHORIZED" });
  }
  const profile = await getProfile(authUser.id);
  return { user: profile };
}

export async function updateName(name: string): Promise<{ user: User }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const { error } = await supabase
    .from("profiles")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", authUser.id);
  if (error) throw new ApiError({ status: 500, code: error.message });

  const profile = await getProfile(authUser.id);
  return { user: profile };
}

export async function updateEmail(email: string): Promise<{ user: User }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    if (error.message.includes("already registered")) {
      throw new ApiError({ status: 409, code: "EMAIL_IN_USE" });
    }
    throw new ApiError({ status: 400, code: error.message });
  }

  // Also update profiles table email
  await supabase
    .from("profiles")
    .update({ email: email.toLowerCase(), updated_at: new Date().toISOString() })
    .eq("id", authUser.id);

  const profile = await getProfile(authUser.id);
  return { user: profile };
}

export async function updatePassword(password: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new ApiError({ status: 400, code: error.message });
  return { ok: true };
}

// --- API Key ---

export type ApiKeyInfo = {
  hasKey: boolean;
  apiKey: string | null;
  createdAt: string | null;
};

export type ApiKeyGenerated = {
  apiKey: string;
  createdAt: string;
};

export async function getApiKey(): Promise<ApiKeyInfo> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const { data, error } = await supabase
    .from("profiles")
    .select("api_key, api_key_created_at")
    .eq("id", authUser.id)
    .single();
  if (error) throw new ApiError({ status: 500, code: error.message });

  if (!data.api_key) {
    return { hasKey: false, apiKey: null, createdAt: null };
  }

  const key = data.api_key as string;
  const masked = key.slice(0, 7) + "****" + key.slice(-4);
  return {
    hasKey: true,
    apiKey: masked,
    createdAt: data.api_key_created_at,
  };
}

export async function generateApiKey(): Promise<ApiKeyGenerated> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const apiKey =
    "mh_" +
    crypto
      .getRandomValues(new Uint8Array(32))
      .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({ api_key: apiKey, api_key_created_at: now, updated_at: now })
    .eq("id", authUser.id);
  if (error) throw new ApiError({ status: 500, code: error.message });

  return { apiKey, createdAt: now };
}

// --- Habits ---

export async function listHabits(args?: { archived?: boolean }): Promise<{ habits: Habit[] }> {
  const archived = args?.archived ? true : false;

  const { data, error } = await supabase.rpc("list_habits", { p_archived: archived });
  if (error) throw new ApiError({ status: 500, code: error.message });

  const habits = (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    note: row.note as string,
    intervalDays: row.intervalDays as number,
    nextDueDate: String(row.nextDueDate),
    startDate: row.startDate ? String(row.startDate) : "",
    archived: row.archived as boolean,
    icon: (row.icon as string) ?? null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    tag: (row.tag as string) ?? null,
    lastDoneDate: (row.lastDoneDate as string) ?? null,
    lastAction: (row.lastAction as string) ?? null,
    lastActionDate: (row.lastActionDate as string) ?? null,
  }));

  return { habits };
}

export async function getHabit(id: string): Promise<{ habit: Habit }> {
  const { data, error } = await supabase.rpc("get_habit_detail", { p_habit_id: id });
  if (error || !data) {
    throw new ApiError({ status: 404, code: "NOT_FOUND" });
  }

  const row = data as Record<string, unknown>;
  const habit: Habit = {
    id: row.id as string,
    title: row.title as string,
    note: row.note as string,
    intervalDays: row.intervalDays as number,
    nextDueDate: String(row.nextDueDate),
    startDate: row.startDate ? String(row.startDate) : "",
    archived: row.archived as boolean,
    icon: (row.icon as string) ?? null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    tag: (row.tag as string) ?? null,
    lastDoneDate: (row.lastDoneDate as string) ?? null,
    lastAction: (row.lastAction as string) ?? null,
    lastActionDate: (row.lastActionDate as string) ?? null,
  };

  return { habit };
}

export async function createHabit(args: {
  title: string;
  note?: string;
  intervalDays?: number;
  startDate?: string;
  tag?: string;
  icon?: string;
}): Promise<{ habit: Habit }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const today = todayDateOnly();

  // Resolve tag name to tag_id
  let tagId: string | null = null;
  if (args.tag && args.tag.trim()) {
    const { data: existingTag } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", authUser.id)
      .eq("name", args.tag.trim())
      .maybeSingle();
    tagId = existingTag?.id ?? null;
  }

  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: authUser.id,
      title: args.title,
      note: args.note ?? "",
      interval_days: args.intervalDays ?? 1,
      next_due_date: args.startDate || today,
      start_date: args.startDate || "",
      tag_id: tagId,
      icon: args.icon ?? null,
    })
    .select("*, tags(name)")
    .single();

  if (error) throw new ApiError({ status: 500, code: error.message });

  const habit = mapHabit(data as Record<string, unknown>);
  habit.tag = (data as Record<string, unknown>).tags
    ? (((data as Record<string, unknown>).tags as Record<string, unknown>).name as string)
    : null;
  return { habit };
}

export async function updateHabit(
  id: string,
  args: Partial<{
    title: string;
    note: string;
    intervalDays: number;
    startDate: string;
    archived: number | boolean;
    tag: string;
    icon: string;
  }>
): Promise<{ habit: Habit }> {
  const updates: Record<string, unknown> = {};
  if (args.title !== undefined) updates.title = args.title;
  if (args.note !== undefined) updates.note = args.note;
  if (args.intervalDays !== undefined) updates.interval_days = args.intervalDays;
  if (args.startDate !== undefined) updates.start_date = args.startDate;
  if (args.archived !== undefined)
    updates.archived = typeof args.archived === "number" ? Boolean(args.archived) : args.archived;
  if (args.icon !== undefined) updates.icon = args.icon;
  updates.updated_at = new Date().toISOString();

  // Handle tag resolution
  if (args.tag !== undefined) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) {
      if (args.tag.trim() === "") {
        updates.tag_id = null;
      } else {
        const { data: existingTag } = await supabase
          .from("tags")
          .select("id")
          .eq("user_id", authUser.id)
          .eq("name", args.tag.trim())
          .maybeSingle();
        updates.tag_id = existingTag?.id ?? null;
      }
    }
  }

  const { data, error } = await supabase
    .from("habits")
    .update(updates)
    .eq("id", id)
    .select("*, tags(name)")
    .single();

  if (error) {
    throw new ApiError({ status: 404, code: "NOT_FOUND" });
  }

  const habit = mapHabit(data as Record<string, unknown>);
  habit.tag = (data as Record<string, unknown>).tags
    ? (((data as Record<string, unknown>).tags as Record<string, unknown>).name as string)
    : null;
  return { habit };
}

export async function deleteHabit(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) throw new ApiError({ status: 500, code: error.message });
  return { ok: true };
}

// --- Habit Actions (RPC) ---

export async function habitDone(id: string): Promise<{ habit: Habit }> {
  return applyAction(id, "done");
}

export async function habitPush(id: string): Promise<{ habit: Habit }> {
  return applyAction(id, "push");
}

export async function habitSkip(id: string): Promise<{ habit: Habit }> {
  return applyAction(id, "skip");
}

async function applyAction(
  habitId: string,
  action: "done" | "push" | "skip"
): Promise<{ habit: Habit }> {
  const { error } = await supabase.rpc("apply_habit_action", {
    p_habit_id: habitId,
    p_action: action,
  });

  if (error) {
    if (error.message.includes("NOT_FOUND")) {
      throw new ApiError({ status: 404, code: "NOT_FOUND" });
    }
    if (error.message.includes("HABIT_ARCHIVED")) {
      throw new ApiError({ status: 400, code: "HABIT_ARCHIVED" });
    }
    throw new ApiError({ status: 500, code: error.message });
  }

  // Fetch the full habit with tag name
  return getHabit(habitId);
}

// --- Habit Events ---

export async function habitEvents(id: string): Promise<{ events: HabitEvent[] }> {
  const { data, error } = await supabase
    .from("habit_events")
    .select("*")
    .eq("habit_id", id)
    .order("created_at", { ascending: false });

  if (error) throw new ApiError({ status: 500, code: error.message });
  return { events: (data ?? []).map((r) => mapEvent(r as Record<string, unknown>)) };
}

export async function habitManualDone(id: string, actionDate: string): Promise<{ habit: Habit }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  // Validate: get habit first
  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("*")
    .eq("id", id)
    .eq("user_id", authUser.id)
    .single();

  if (habitError || !habit) {
    throw new ApiError({ status: 404, code: "NOT_FOUND" });
  }
  if (habit.archived) {
    throw new ApiError({ status: 400, code: "HABIT_ARCHIVED" });
  }

  const today = todayDateOnly();
  if (actionDate > today) {
    throw new ApiError({ status: 400, code: "FUTURE_DATE" });
  }
  if (habit.start_date && actionDate < habit.start_date) {
    throw new ApiError({ status: 400, code: "BEFORE_START_DATE" });
  }

  // Check if already done on that date
  const { data: existing } = await supabase
    .from("habit_events")
    .select("id")
    .eq("habit_id", id)
    .eq("action_date", actionDate)
    .eq("action", "done")
    .maybeSingle();

  if (existing) {
    throw new ApiError({ status: 409, code: "ALREADY_DONE" });
  }

  // Calculate new next_due_date
  const interval = habit.interval_days || 1;
  const newDueDate = addDays(actionDate, interval);

  const fromDueDate = habit.next_due_date;

  await supabase.from("habit_events").insert({
    user_id: authUser.id,
    habit_id: id,
    action: "done",
    action_date: actionDate,
    from_due_date: fromDueDate,
    to_due_date: newDueDate,
  });

  // Update next_due_date only if newDueDate is further out
  if (newDueDate > habit.next_due_date) {
    await supabase
      .from("habits")
      .update({ next_due_date: newDueDate, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  return getHabit(id);
}

export async function habitDeleteEvent(
  habitId: string,
  eventId: string
): Promise<{ habit: Habit }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  // Get the event to delete
  const { data: event, error: eventError } = await supabase
    .from("habit_events")
    .select("*")
    .eq("id", eventId)
    .eq("habit_id", habitId)
    .eq("user_id", authUser.id)
    .single();

  if (eventError || !event) {
    throw new ApiError({ status: 404, code: "NOT_FOUND" });
  }

  // Delete the event
  const { error: deleteError } = await supabase.from("habit_events").delete().eq("id", eventId);

  if (deleteError) throw new ApiError({ status: 500, code: deleteError.message });

  // Recalculate next_due_date for done/push actions
  if (event.action === "done" || event.action === "push") {
    await recalculateNextDueDate(habitId);
  }

  return getHabit(habitId);
}

async function recalculateNextDueDate(habitId: string): Promise<void> {
  const { data: habit } = await supabase
    .from("habits")
    .select("interval_days, start_date")
    .eq("id", habitId)
    .single();

  if (!habit) return;

  const interval = habit.interval_days || 1;
  const today = todayDateOnly();

  // Get the latest done event
  const { data: lastDone } = await supabase
    .from("habit_events")
    .select("action_date")
    .eq("habit_id", habitId)
    .eq("action", "done")
    .order("action_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let newDueDate: string;
  if (lastDone) {
    newDueDate = addDays(lastDone.action_date, interval);
    if (newDueDate < today) newDueDate = today;
  } else {
    // No done events, use start_date or today
    newDueDate = habit.start_date || today;
    if (newDueDate < today) newDueDate = today;
  }

  await supabase
    .from("habits")
    .update({ next_due_date: newDueDate, updated_at: new Date().toISOString() })
    .eq("id", habitId);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// --- Tags ---

export async function listTags(): Promise<{
  tags: { id: string; name: string; habit_count: number }[];
}> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const { data, error } = await supabase
    .from("tags")
    .select("id, name, habits(count)")
    .eq("user_id", authUser.id)
    .order("name");

  if (error) throw new ApiError({ status: 500, code: error.message });

  const tags = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    habit_count: (row.habits as Array<{ count: number }>)[0]?.count ?? 0,
  }));

  return { tags };
}

export async function createTag(args: {
  name: string;
}): Promise<{ tag: { id: string; name: string } }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const { data, error } = await supabase
    .from("tags")
    .insert({ user_id: authUser.id, name: args.name.trim() })
    .select()
    .single();

  if (error) {
    if (error.message.includes("unique") || error.message.includes("duplicate")) {
      throw new ApiError({ status: 409, code: "TAG_NAME_EXISTS" });
    }
    throw new ApiError({ status: 500, code: error.message });
  }

  return { tag: { id: data.id, name: data.name } };
}

export async function renameTag(
  id: string,
  name: string
): Promise<{ tag: { id: string; name: string } }> {
  const { error } = await supabase.from("tags").update({ name: name.trim() }).eq("id", id);

  if (error) {
    if (error.message.includes("unique") || error.message.includes("duplicate")) {
      throw new ApiError({ status: 409, code: "TAG_NAME_EXISTS" });
    }
    if (error.message.includes("not found") || error.code === "PGRST116") {
      throw new ApiError({ status: 404, code: "NOT_FOUND" });
    }
    throw new ApiError({ status: 500, code: error.message });
  }

  return { tag: { id, name: name.trim() } };
}

export async function deleteTag(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) {
    if (error.code === "PGRST116") {
      throw new ApiError({ status: 404, code: "NOT_FOUND" });
    }
    throw new ApiError({ status: 500, code: error.message });
  }
  return { ok: true };
}

// --- Stats ---

export async function summary(): Promise<StatsSummary> {
  const { data, error } = await supabase.rpc("get_stats_summary");
  if (error) throw new ApiError({ status: 500, code: error.message });
  return data as unknown as StatsSummary;
}

// --- Export/Import ---

export async function exportHabits(): Promise<Blob> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const [habitsRes, eventsRes] = await Promise.all([
    supabase.from("habits").select("*").eq("user_id", authUser.id),
    supabase.from("habit_events").select("*").eq("user_id", authUser.id),
  ]);

  const habits = (habitsRes.data ?? []).map((h) => ({
    id: h.id,
    title: h.title,
    note: h.note,
    intervalDays: h.interval_days,
    nextDueDate: h.next_due_date,
    startDate: h.start_date,
    archived: Boolean(h.archived),
    icon: h.icon,
    createdAt: h.created_at,
    updatedAt: h.updated_at,
    tagName: null as string | null,
  }));

  // Resolve tag names
  for (const h of habits) {
    if (h.id) {
      const { data: habitWithTags } = await supabase
        .from("habits")
        .select("tags(name)")
        .eq("id", h.id)
        .single();
      if (habitWithTags?.tags) {
        h.tagName = (habitWithTags.tags as unknown as Record<string, unknown>).name as string;
      }
    }
  }

  const events = (eventsRes.data ?? []).map((e) => ({
    id: e.id,
    habitId: e.habit_id,
    action: e.action,
    actionDate: e.action_date,
    fromDueDate: e.from_due_date,
    toDueDate: e.to_due_date,
    createdAt: e.created_at,
  }));

  const exportData = { version: 1, habits, events };
  return new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
}

export async function importHabits(
  data: unknown
): Promise<{ imported: { habits: number; events: number } }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new ApiError({ status: 401, code: "UNAUTHORIZED" });

  const body = data as {
    version?: number;
    habits?: Array<Record<string, unknown>>;
    events?: Array<Record<string, unknown>>;
  };

  if (!body || body.version !== 1 || !Array.isArray(body.habits) || !Array.isArray(body.events)) {
    throw new ApiError({
      status: 400,
      code: "INVALID_FORMAT",
      details: "无效的 JSON 格式，需要 version=1、habits 和 events 数组",
    });
  }

  // Create tag map
  const tagMap = new Map<string, string>();
  for (const h of body.habits) {
    const tagName = h.tagName as string | undefined;
    if (tagName && !tagMap.has(tagName)) {
      const { data: existingTag } = await supabase
        .from("tags")
        .select("id")
        .eq("user_id", authUser.id)
        .eq("name", tagName)
        .maybeSingle();

      if (existingTag) {
        tagMap.set(tagName, existingTag.id);
      } else {
        const { data: newTag } = await supabase
          .from("tags")
          .insert({ user_id: authUser.id, name: tagName })
          .select()
          .single();
        if (newTag) tagMap.set(tagName, newTag.id);
      }
    }
  }

  // Insert habits
  const habitIds = new Set<string>();
  for (const h of body.habits) {
    const tagId = h.tagName ? (tagMap.get(h.tagName as string) ?? null) : null;
    const { error } = await supabase.from("habits").insert({
      id: h.id as string,
      user_id: authUser.id,
      title: h.title as string,
      note: h.note as string,
      interval_days: h.intervalDays as number,
      next_due_date: h.nextDueDate as string,
      start_date: h.startDate as string,
      archived: h.archived as boolean,
      tag_id: tagId,
      icon: h.icon as string | null,
      created_at: h.createdAt as string,
      updated_at: h.updatedAt as string,
    });
    if (!error) habitIds.add(h.id as string);
  }

  // Insert events
  let eventCount = 0;
  for (const e of body.events) {
    if (!habitIds.has(e.habitId as string)) continue;
    const { error } = await supabase.from("habit_events").insert({
      id: e.id as string,
      user_id: authUser.id,
      habit_id: e.habitId as string,
      action: e.action as string,
      action_date: e.actionDate as string,
      from_due_date: e.fromDueDate as string | null,
      to_due_date: e.toDueDate as string | null,
      created_at: e.createdAt as string,
    });
    if (!error) eventCount++;
  }

  return { imported: { habits: habitIds.size, events: eventCount } };
}
