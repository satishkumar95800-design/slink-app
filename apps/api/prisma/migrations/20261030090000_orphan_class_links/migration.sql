-- Replacing a class teacher used to demote the old one to a hidden co-teacher
-- even when they taught no subject in that class. Those links showed the class
-- in the teacher's app and still let them post to it. Remove them: a teacher
-- stays linked to a class only as its class teacher or while they teach a
-- subject there.
DELETE FROM "class_teachers" ct
WHERE NOT ct."is_class_teacher"
  AND NOT EXISTS (
    SELECT 1 FROM "teacher_subjects" ts
    WHERE ts."teacher_id" = ct."teacher_id" AND ts."class_id" = ct."class_id"
  );
