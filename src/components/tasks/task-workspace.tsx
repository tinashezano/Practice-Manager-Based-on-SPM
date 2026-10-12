import { db } from "@/lib/db";
import { addDays, monthGridRange, startOfWeek, TIMELINE_DAYS, todayISO } from "@/lib/dates";
import { can } from "@/lib/permissions";
import type { requireUser } from "@/lib/session";
import { canEditTask } from "@/lib/task-access";
import { getTaskDetail, listTasks, taskListInclude, taskWhere, type TaskFilters } from "@/lib/task-queries";
import { NewTaskButton } from "./new-task-button";
import { TaskBoard } from "./task-board";
import { TaskCalendar } from "./task-calendar";
import { TaskList } from "./task-list";
import { TaskPanel } from "./task-panel";
import { TaskTimeline } from "./task-timeline";
import { TaskToolbar } from "./task-toolbar";

export type TaskSearchParams = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

/**
 * The full task experience (toolbar, four views, side panel), driven by URL
 * params. Used on /tasks and, locked to one client, on the client page.
 */
export async function TaskWorkspace({
  user,
  searchParams,
  clientId,
  dealId,
  header,
}: {
  user: Awaited<ReturnType<typeof requireUser>>;
  searchParams: TaskSearchParams;
  /** Lock the workspace to a single client. */
  clientId?: string;
  /** Lock the workspace to a single lead (deal). */
  dealId?: string;
  header?: (newTaskButton: React.ReactNode) => React.ReactNode;
}) {
  const view = str(searchParams.view) ?? "list";
  const assigneeParam = str(searchParams.assignee);
  const status = (str(searchParams.status) ?? "open") as TaskFilters["status"];
  const filters: TaskFilters = {
    clientId: dealId ? undefined : (clientId ?? str(searchParams.client)),
    dealId,
    projectId: str(searchParams.project),
    assigneeId: assigneeParam === "me" ? user.id : assigneeParam,
    status,
    q: str(searchParams.q),
  };
  const today = todayISO();

  const [staff, clients, projects, resources] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.client.findMany({ where: { status: { not: "INACTIVE" } }, select: { id: true, name: true }, orderBy: [{ isInternal: "desc" }, { name: "asc" }] }),
    db.project.findMany({ where: { status: { not: "COMPLETED" } }, select: { id: true, name: true, clientId: true }, orderBy: { name: "asc" } }),
    db.resource.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  let body: React.ReactNode;
  if (view === "calendar") {
    const monthParam = str(searchParams.month);
    const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7);
    const { start, end } = monthGridRange(month);
    const [tasks, unscheduled] = await Promise.all([
      listTasks({ ...filters, from: start, to: end }),
      db.task.findMany({ where: { ...taskWhere({ ...filters, status: "open" }), dueDate: null }, include: taskListInclude, take: 100 }),
    ]);
    body = <TaskCalendar tasks={tasks.filter((t) => t.dueDate)} unscheduled={unscheduled} month={month} />;
  } else if (view === "timeline") {
    const fromParam = str(searchParams.from);
    const from = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : addDays(startOfWeek(today), -7);
    const [tasks, undated] = await Promise.all([
      listTasks({ ...filters, from, to: addDays(from, TIMELINE_DAYS - 1) }),
      db.task.count({ where: { ...taskWhere(filters), startDate: null, dueDate: null } }),
    ]);
    body = <TaskTimeline tasks={tasks} from={from} undated={undated} />;
  } else {
    const tasks = await listTasks(filters);
    body = view === "board" ? <TaskBoard tasks={tasks} showDone={status !== "open"} /> : <TaskList tasks={tasks} showClients={!clientId && !dealId} emptyText={dealId ? "No tasks for this lead yet." : undefined} />;
  }

  const taskId = str(searchParams.task);
  const detail = taskId ? await getTaskDetail(taskId) : null;
  let panel: React.ReactNode = null;
  if (detail) {
    const manager = can(user.role, "tasks.manageAll");
    const canDelete = manager || detail.createdById === user.id || (!!detail.parent && (await canEditTask(user, detail.parent.id)));
    panel = (
      <TaskPanel
        task={detail}
        staff={staff}
        projects={projects.filter((p) => p.clientId === detail.clientId)}
        resources={resources.map((r) => ({ id: r.id, name: r.title }))}
        canEdit={await canEditTask(user, detail.id)}
        canDelete={canDelete}
      />
    );
  }

  const newTask = (
    <NewTaskButton clients={clients} projects={projects} staff={staff} currentUserId={user.id} defaultClientId={clientId ?? filters.clientId} />
  );

  return (
    <>
      {header?.(newTask)}
      <TaskToolbar clients={clients} staff={staff} showClientFilter={!clientId && !dealId} />
      {body}
      {panel}
    </>
  );
}
