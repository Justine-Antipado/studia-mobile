# course-detail tab components

One file per `course-detail-screen.tsx` segmented tab (Stream, Lessons, Tasks, Grades, People),
split out to keep the screen file under 250 lines. Each tab owns its own hook call and renders
through `ListState` for loading/error/empty.
