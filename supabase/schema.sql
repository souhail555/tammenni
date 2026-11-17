-- طمّنّي — Supabase schema
-- Paste this whole file into Supabase Dashboard → SQL Editor → Run.
-- Also enable: Authentication → Sign In / Providers → "Allow anonymous sign-ins".

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ───────────── Tables ─────────────
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  elder_name text not null,
  deadline_hour int not null default 11 check (deadline_hour between 0 and 23),
  tz text not null default 'UTC',
  last_missed_alert date,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  circle_id uuid not null references public.circles on delete cascade,
  user_id uuid not null default auth.uid(),
  role text not null check (role in ('elder', 'family')),
  name text,
  push_token text,
  primary key (circle_id, user_id)
);

create table if not exists public.meds (
  id text primary key,
  circle_id uuid not null references public.circles on delete cascade,
  name text not null,
  hour int not null,
  minute int not null
);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  circle_id uuid not null references public.circles on delete cascade,
  type text not null check (type in ('checkin', 'med', 'sos', 'missed')),
  med_id text,
  med_name text,
  at timestamptz not null default now(),
  user_id uuid default auth.uid()
);
create index if not exists events_circle_at on public.events (circle_id, at desc);

-- ───────────── Security (RLS) ─────────────
create or replace function public.is_member(c uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where circle_id = c and user_id = auth.uid());
$$;

alter table public.circles enable row level security;
alter table public.members enable row level security;
alter table public.meds    enable row level security;
alter table public.events  enable row level security;

drop policy if exists circles_read on public.circles;
create policy circles_read on public.circles for select using (public.is_member(id));
drop policy if exists circles_update on public.circles;
create policy circles_update on public.circles for update using (public.is_member(id));

drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (public.is_member(circle_id));
drop policy if exists members_update_self on public.members;
create policy members_update_self on public.members for update using (user_id = auth.uid());

drop policy if exists meds_all on public.meds;
create policy meds_all on public.meds for all
  using (public.is_member(circle_id)) with check (public.is_member(circle_id));

drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (public.is_member(circle_id));
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert
  with check (public.is_member(circle_id) and user_id = auth.uid() and type <> 'missed');

-- ───────────── Create / join a family circle ─────────────
create or replace function public.create_circle(p_elder_name text, p_deadline int, p_tz text)
returns table (circle_id uuid, code text)
language plpgsql security definer set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  new_code text;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from circles c where c.code = new_code);
  end loop;
  insert into circles (code, elder_name, deadline_hour, tz)
    values (new_code, p_elder_name, p_deadline, coalesce(nullif(p_tz, ''), 'UTC'))
    returning id into new_id;
  insert into members (circle_id, user_id, role, name) values (new_id, auth.uid(), 'elder', p_elder_name);
  return query select new_id, new_code;
end $$;

create or replace function public.join_circle(p_code text, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into cid from circles where code = upper(trim(p_code));
  if cid is null then raise exception 'bad code'; end if;
  insert into members (circle_id, user_id, role, name) values (cid, auth.uid(), 'family', p_name)
    on conflict (circle_id, user_id) do nothing;
  return cid;
end $$;

grant execute on function public.create_circle(text, int, text) to authenticated;
grant execute on function public.join_circle(text, text) to authenticated;

-- ───────────── Push notifications to family (Expo push service) ─────────────
create or replace function public.push_family(p_circle uuid, p_title text, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
declare msgs jsonb;
begin
  select jsonb_agg(jsonb_build_object(
           'to', push_token, 'title', p_title, 'body', p_body,
           'sound', 'default', 'priority', 'high', 'channelId', 'reminders'))
    into msgs
    from members
   where circle_id = p_circle and role = 'family' and push_token is not null;
  if msgs is null then return; end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := msgs,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end $$;
revoke execute on function public.push_family(uuid, text, text) from public, anon, authenticated;

create or replace function public.on_event_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select elder_name into who from circles where id = new.circle_id;
  if new.type = 'checkin' then
    perform push_family(new.circle_id, '✅ ' || who || ' بخير', 'طمّن العيلة هلّق 💚');
  elsif new.type = 'sos' then
    perform push_family(new.circle_id, '🚨 ' || who || ' بحاجة مساعدة!', 'اكبس واتصل فيه فوراً');
  elsif new.type = 'med' then
    perform push_family(new.circle_id, '💊 ' || who || ' أخد دواه', coalesce(new.med_name, ''));
  elsif new.type = 'missed' then
    perform push_family(new.circle_id, '⚠️ ' || who || ' لسّا ما طمّن اليوم', 'جرّب تتصل فيه');
  end if;
  return new;
end $$;

drop trigger if exists events_push on public.events;
create trigger events_push after insert on public.events
  for each row execute function public.on_event_insert();

-- ───────────── Missed check-in watcher (runs every 10 minutes) ─────────────
create or replace function public.check_missed() returns void
language plpgsql security definer set search_path = public as $$
declare c record; today date;
begin
  for c in select * from circles loop
    today := (now() at time zone c.tz)::date;
    continue when (now() at time zone c.tz)::time < make_time(c.deadline_hour, 0, 0);
    continue when c.last_missed_alert = today;
    continue when (c.created_at at time zone c.tz)::date = today; -- not on the first day
    continue when exists (
      select 1 from events e
       where e.circle_id = c.id and e.type = 'checkin'
         and (e.at at time zone c.tz)::date = today);
    insert into events (circle_id, type, user_id) values (c.id, 'missed', c.created_by);
    update circles set last_missed_alert = today where id = c.id;
  end loop;
end $$;
revoke execute on function public.check_missed() from public, anon, authenticated;

select cron.unschedule('tammenni-missed') where exists (select 1 from cron.job where jobname = 'tammenni-missed');
select cron.schedule('tammenni-missed', '*/10 * * * *', 'select public.check_missed()');

-- ───────────── Live updates for the family dashboard ─────────────
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;
