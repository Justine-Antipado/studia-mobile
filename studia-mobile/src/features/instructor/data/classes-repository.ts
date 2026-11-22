// classes-repository.ts — instructor view. Only classes this instructor owns are listed.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteInstructorClassRepository } from "@/features/instructor/data/classes-remote";
import type { InstructorClass } from "@/features/instructor/types/instructor";

export interface InstructorClassRepository {
  list(): Promise<Result<InstructorClass[]>>;
  get(id: string): Promise<Result<InstructorClass | null>>;
  create(input: { title: string; section: string; code: string }): Promise<Result<InstructorClass>>;
  archive(id: string, archived: boolean): Promise<Result<void>>;
  remove(id: string): Promise<Result<void>>;
}

export const instructorClassRepository: InstructorClassRepository = new RemoteInstructorClassRepository();
