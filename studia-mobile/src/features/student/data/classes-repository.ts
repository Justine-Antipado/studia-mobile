// classes-repository.ts — student view. Joining/leaving edits class_enrollments, so the instructor
// roster and student count change too. Progress is derived from the assignments this student has turned in.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteClassRepository } from "@/features/student/data/classes-remote";
import type { Person, StudentClass } from "@/features/student/types/student";

export interface ClassRepository {
  list(): Promise<Result<StudentClass[]>>;
  get(id: string): Promise<Result<StudentClass | null>>;
  joinByCode(code: string): Promise<Result<StudentClass>>;
  leave(id: string): Promise<Result<void>>;
  /** Everyone else enrolled in the class (People tab). */
  classmates(id: string): Promise<Result<Person[]>>;
}

export const classRepository: ClassRepository = new RemoteClassRepository();
