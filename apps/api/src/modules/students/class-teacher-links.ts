import { Prisma } from '@prisma/client';

/**
 * A `class_teachers` row is a teacher's access to a class: as its class teacher
 * (isClassTeacher) or because they teach a subject there (a TeacherSubject).
 * A non-class-teacher row with no subject in the class is a leftover that
 * still lists the class in the teacher's app and lets them post to it, so
 * these helpers never leave one behind.
 */
type Tx = Prisma.TransactionClient;

/** True when the teacher teaches at least one subject in the class. */
async function teachesIn(tx: Tx, classId: string, teacherId: string) {
  const n = await tx.teacherSubject.count({ where: { classId, teacherId } });
  return n > 0;
}

/**
 * The teacher stops being class teacher of the class: they stay linked as a
 * co-teacher only while they teach a subject there.
 */
export async function releaseClassTeacher(
  tx: Tx,
  classId: string,
  teacherId: string,
) {
  if (await teachesIn(tx, classId, teacherId)) {
    await tx.classTeacher.updateMany({
      where: { classId, teacherId },
      data: { isClassTeacher: false },
    });
  } else {
    await tx.classTeacher.deleteMany({ where: { classId, teacherId } });
  }
}

/** Releases every current class teacher of the class except `keepTeacherId`. */
export async function releaseOtherClassTeachers(
  tx: Tx,
  classId: string,
  keepTeacherId: string,
) {
  const others = await tx.classTeacher.findMany({
    where: { classId, isClassTeacher: true, teacherId: { not: keepTeacherId } },
    select: { teacherId: true },
  });
  for (const o of others) await releaseClassTeacher(tx, classId, o.teacherId);
}
