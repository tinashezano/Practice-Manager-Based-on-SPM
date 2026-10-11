import { PageHeader } from "@/components/ui";
import { TaskWorkspace, type TaskSearchParams } from "@/components/tasks/task-workspace";
import { requirePermission } from "@/lib/session";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<TaskSearchParams> }) {
  const user = await requirePermission("tasks.work");
  return (
    <TaskWorkspace
      user={user}
      searchParams={await searchParams}
      header={(newTask) => <PageHeader title="Tasks" subtitle="Every task, grouped by client. Click a task to open it." actions={newTask} />}
    />
  );
}
