-- Run against the isolated local verification database only; fixtures roll back.
begin;
do $$ begin
  assert current_database() like 'life_%test%', 'isolated test database required';
  assert (select count(*) from public.life_course_guides)=16, '16 source rows';
  assert (select sum(capacity) from public.life_course_guides)=244, 'actual row capacity total';
  assert (select sum(teaching_hours) from public.life_course_guides)=541, 'actual row hours total';
  assert (select count(certificate) from public.life_course_guides)=12, '12 certificates, 4 unrecorded';
  assert (select count(*) from public.life_course_guides where academy='라이프케어 아카데미')=6, 'six life care';
  assert (select count(*) from public.life_course_guides where academy='로컬창업 아카데미')=6, 'six local business';
  assert (select count(*) from public.life_course_guides where academy='팝업 아카데미')=4, 'four popup';
end $$;
insert into public.life_course_guides(id,year,sort_order,name,academy,summary,mode,capacity,teaching_hours,period_label,time_label,location)
values('test-private-guide',2027,1,'비공개 자료','검증','비공개 설명','OFFLINE',1,1,'미정','미정','미정');
set local role anon;
do $$ begin
  assert (select count(*) from public.life_course_guides)=16, 'anon published-only read';
  assert (select count(*) from public.life_course_guides where id='test-private-guide')=0, 'unpublished detail denied';
  assert (select certificate from public.life_course_guides where id='2026-silver-food')='시니어요리지도사', 'certificate row mapping';
  assert (select period_label from public.life_course_guides where id='2026-manual-therapy')='2026년 12월 예정', 'do not invent unknown dates';
  assert (select period_label from public.life_course_guides where id='2026-pet-behavior')='2026.10.02–11.27', 'second revised schedule';
  begin
    update public.life_course_guides set published=true where id='test-private-guide';
    assert false, 'anon update allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.life_course_guides where id='2026-manual-therapy';
    assert false, 'anon delete allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  assert (select count(*) from public.life_course_guides)=16, 'authenticated published-only read';
  assert not has_table_privilege(current_user,'public.life_course_guides','INSERT'), 'no insert grant';
  begin
    update public.life_course_guides set name='forged' where id='2026-manual-therapy';
    assert false, 'authenticated update allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.life_course_guides where id='2026-manual-therapy';
    assert false, 'authenticated delete allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.life_course_guides set published=false where id='2026-manual-therapy';
set local role anon;
do $$ begin
  assert (select count(*) from public.life_course_guides)=15, 'revoked guide disappears';
end $$;
reset role;
rollback;
select 'PASS 20 course guide data/access assertions' as result;
