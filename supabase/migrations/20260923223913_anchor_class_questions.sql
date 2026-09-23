begin;

create table life_private.class_questions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.life_offerings(id),
  learner_id uuid not null references public.life_people(id),
  visibility text not null check (visibility in ('PRIVATE', 'COURSE')),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  answer_text text check (answer_text is null or length(trim(answer_text)) between 1 and 5000),
  answered_by uuid references public.life_people(id),
  answered_at timestamptz,
  check ((answer_text is null and answered_by is null and answered_at is null)
    or (answer_text is not null and answered_by is not null and answered_at is not null))
);
create index class_questions_offering_recent on life_private.class_questions(offering_id, created_at desc, id);
create index class_questions_learner_recent on life_private.class_questions(learner_id, offering_id, created_at desc);
create index class_questions_unanswered on life_private.class_questions(offering_id, created_at desc) where answer_text is null;
alter table life_private.class_questions enable row level security;
revoke all on life_private.class_questions from public, anon, authenticated, service_role;

create function life_private.class_questions_for(f uuid)
returns table(id uuid, offering_id uuid, body text, visibility text, created_at timestamptz,
  answer_text text, answered_at timestamptz, author_label text, is_mine boolean)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := life_private.person_id(); teacher boolean := life_private.teaches(f);
begin
  if actor is null or not (teacher or life_private.enrolled(f)) then
    raise exception 'FORBIDDEN';
  end if;
  return query
    select q.id, q.offering_id, q.body, q.visibility, q.created_at, q.answer_text, q.answered_at,
      case when teacher then p.name when q.learner_id = actor then '내 질문' else '수강생' end,
      q.learner_id = actor
    from life_private.class_questions q
    join public.life_people p on p.id = q.learner_id
    where q.offering_id = f and (teacher or q.learner_id = actor or q.visibility = 'COURSE')
    order by q.created_at desc, q.id desc;
end $$;

create function life_private.ask_class_question(f uuid, question_body text, question_visibility text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := life_private.person_id(); result uuid; org uuid;
begin
  if actor is null or not life_private.enrolled(f) then raise exception 'FORBIDDEN'; end if;
  if question_body is null or length(trim(question_body)) not between 1 and 2000
    or question_visibility is null or question_visibility not in ('PRIVATE', 'COURSE') then raise exception 'INVALID_INPUT'; end if;
  select o.org_id into org from public.life_offerings o where o.id = f;
  if org is null then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.life_people where id = actor for update;
  if (select count(*) from life_private.class_questions q
      where q.offering_id = f and q.learner_id = actor and q.created_at > now() - interval '1 hour') >= 10
    then raise exception 'RATE_LIMITED'; end if;
  insert into life_private.class_questions(offering_id, learner_id, visibility, body)
    values(f, actor, question_visibility, trim(question_body)) returning id into result;
  insert into public.life_audit_events(org_id, actor_id, action, entity_id)
    values(org, actor, 'CLASS_QUESTION_ASKED', result);
  return result;
end $$;

create function life_private.answer_class_question(qid uuid, answer_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := life_private.person_id(); question life_private.class_questions; org uuid;
begin
  select * into question from life_private.class_questions where id = qid for update;
  if question.id is null or actor is null or not life_private.teaches(question.offering_id)
    then raise exception 'FORBIDDEN'; end if;
  if answer_body is null or length(trim(answer_body)) not between 1 and 5000
    then raise exception 'INVALID_INPUT'; end if;
  select o.org_id into org from public.life_offerings o where o.id = question.offering_id;
  update life_private.class_questions set answer_text = trim(answer_body),
    answered_by = actor, answered_at = now() where id = qid;
  insert into public.life_audit_events(org_id, actor_id, action, entity_id)
    values(org, actor, case when question.answer_text is null then 'CLASS_QUESTION_ANSWERED' else 'CLASS_ANSWER_UPDATED' end, qid);
  return question.offering_id;
end $$;

create function life_private.instructor_home_summary()
returns table(offering_id uuid, learner_count bigint, ended_sessions bigint,
  attendance_records bigint, unanswered_questions bigint)
language sql stable security definer set search_path = '' as $$
  select o.id,
    (select count(*) from public.life_enrollments e where e.offering_id = o.id and e.status = 'ACTIVE'),
    (select count(*) from public.life_class_sessions s
      where s.offering_id = o.id and s.status = 'SCHEDULED' and s.ends_at <= now()),
    (select count(*) from public.life_attendance a
      join public.life_class_sessions s on s.id = a.session_id
      where s.offering_id = o.id and s.status = 'SCHEDULED' and s.ends_at <= now()),
    (select count(*) from life_private.class_questions q where q.offering_id = o.id and q.answer_text is null)
  from public.life_offering_instructors i
  join public.life_offerings o on o.id = i.offering_id
  where i.person_id = life_private.person_id()
    and (i.valid_until is null or i.valid_until > now())
    and life_private.has_role(o.org_id, 'INSTRUCTOR')
  order by o.starts_on desc, o.id;
$$;

create function public.life_class_questions(f uuid)
returns table(id uuid, offering_id uuid, body text, visibility text, created_at timestamptz,
  answer_text text, answered_at timestamptz, author_label text, is_mine boolean)
language sql stable security invoker set search_path = '' as $$
  select * from life_private.class_questions_for(f)
$$;
create function public.life_ask_class_question(f uuid, question_body text, question_visibility text)
returns uuid language sql security invoker set search_path = '' as $$
  select life_private.ask_class_question(f, question_body, question_visibility)
$$;
create function public.life_answer_class_question(qid uuid, answer_body text)
returns uuid language sql security invoker set search_path = '' as $$
  select life_private.answer_class_question(qid, answer_body)
$$;
create function public.life_instructor_home_summary()
returns table(offering_id uuid, learner_count bigint, ended_sessions bigint,
  attendance_records bigint, unanswered_questions bigint)
language sql stable security invoker set search_path = '' as $$
  select * from life_private.instructor_home_summary()
$$;

revoke execute on function life_private.class_questions_for(uuid),
  life_private.ask_class_question(uuid,text,text), life_private.answer_class_question(uuid,text),
  life_private.instructor_home_summary() from public, anon, authenticated;
grant execute on function life_private.class_questions_for(uuid),
  life_private.ask_class_question(uuid,text,text), life_private.answer_class_question(uuid,text),
  life_private.instructor_home_summary() to authenticated;
revoke execute on function public.life_class_questions(uuid),
  public.life_ask_class_question(uuid,text,text), public.life_answer_class_question(uuid,text),
  public.life_instructor_home_summary() from public, anon, authenticated;
grant execute on function public.life_class_questions(uuid),
  public.life_ask_class_question(uuid,text,text), public.life_answer_class_question(uuid,text),
  public.life_instructor_home_summary() to authenticated;
notify pgrst, 'reload schema';
commit;
