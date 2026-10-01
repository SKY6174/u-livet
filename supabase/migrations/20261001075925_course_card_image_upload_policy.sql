begin;

alter policy life_course_covers_staff_upload on storage.objects
with check (
  bucket_id = 'life-course-covers' and
  exists (
    select 1 from public.life_course_guides guide
    where guide.id = split_part(storage.objects.name, '/', 2)
      and guide.org_id::text = split_part(storage.objects.name, '/', 1)
      and array_length(string_to_array(storage.objects.name, '/'), 1) = 3
      and split_part(storage.objects.name, '/', 3) ~ '^[a-f0-9-]{36}\.(jpg|png|webp)$'
      and life_private.course_guide_staff(guide.org_id)
  )
);

commit;
