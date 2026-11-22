// students-repository.ts — roster per class (submitted / pending / progress are computed by the database).
import type { Result } from "@/core/data/errors/app-error";
import { RemoteClassStudentRepository } from "@/features/instructor/data/students-remote";
import type { ClassStudent } from "@/features/instructor/types/instructor";

export interface ClassStudentRepository {
  listByClass(classId: string): Promise<Result<ClassStudent[]>>;
  get(classId: string, studentId: string): Promise<Result<ClassStudent | null>>;
  remove(classId: string, studentId: string): Promise<Result<void>>;
}

export const classStudentRepository: ClassStudentRepository = new RemoteClassStudentRepository();
