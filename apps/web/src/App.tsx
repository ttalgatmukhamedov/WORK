import React, { useEffect, useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Moon,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sun,
  UserCircle2
} from "lucide-react";
import { apiRequest } from "./api";
import { getTelegram } from "./telegram";
import type { Firm, Task, User } from "./types";

const emptyTaskForm = { title: "", description: "", dueDate: "", assignedToId: "" };
const emptyFirmForm = { name: "", description: "", phone: "", email: "" };

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("theme") as "light" | "dark") || "light";
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }
  const [tasks, setTasks] = useState<Task[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [accountants, setAccountants] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"tasks" | "firms">("tasks");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [firmForm, setFirmForm] = useState(emptyFirmForm);
  const [editingFirmId, setEditingFirmId] = useState<string | null>(null);

  const [devToken, setDevToken] = useState("");
  const [devTgId, setDevTgId] = useState("123456");
  const [devRole, setDevRole] = useState<"MANAGER" | "ACCOUNTANT">("MANAGER");

  const isManager = user?.role === "MANAGER";

  const statusLabel = useMemo(
    () => ({
      NEW: "Новая",
      IN_PROGRESS: "В работе",
      DONE: "Выполнена"
    }),
    []
  );

  // Инициализация Telegram WebApp, если открыт из Telegram
  useEffect(() => {
    const tg = getTelegram();
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadAll();
  }, [token]);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const me = await apiRequest<{ user: User }>("/me", auth());
      setUser(me.user);
      const tasksRes = await apiRequest<{ tasks: Task[] }>("/tasks", auth());
      setTasks(tasksRes.tasks);
      const firmsRes = await apiRequest<{ firms: Firm[] }>("/firms", auth());
      setFirms(firmsRes.firms);
      if (me.user.role === "MANAGER") {
        const usersRes = await apiRequest<{ users: User[] }>("/users?role=ACCOUNTANT", auth());
        setAccountants(usersRes.users);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  function auth(options: RequestInit = {}) {
    return {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    } as RequestInit;
  }

  function extractError(err: unknown) {
    if (err instanceof Error) return err.message;
    return "Неизвестная ошибка";
  }

  // Авторизация через Telegram initData
  async function loginTelegram() {
    const tg = getTelegram();
    if (!tg?.initData) {
      setError("initData не найден. Откройте приложение через Telegram.");
      return;
    }

    try {
      setLoading(true);
      const res = await apiRequest<{ token: string; user: User }>("/auth/telegram", {
        method: "POST",
        body: JSON.stringify({ initData: tg.initData })
      });
      localStorage.setItem("token", res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  // DEV авторизация для локальной разработки
  async function loginDev() {
    try {
      setLoading(true);
      const res = await apiRequest<{ token: string; user: User }>("/auth/dev", {
        method: "POST",
        body: JSON.stringify({ token: devToken, tgId: devTgId, role: devRole, name: "Dev User" })
      });
      localStorage.setItem("token", res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setTasks([]);
    setFirms([]);
    setAccountants([]);
  }

  // Создание задачи руководителем
  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    try {
      setLoading(true);
      await apiRequest("/tasks", {
        ...auth({ method: "POST" }),
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description || undefined,
          assignedToId: taskForm.assignedToId || undefined,
          dueDate: taskForm.dueDate || undefined
        })
      });
      setTaskForm(emptyTaskForm);
      await loadAll();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  // Обновление статуса задачи
  async function updateTaskStatus(id: string, status: Task["status"]) {
    try {
      setLoading(true);
      await apiRequest(`/tasks/${id}/status`, {
        ...auth({ method: "PATCH" }),
        body: JSON.stringify({ status })
      });
      await loadAll();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  // Создание новой фирмы
  async function createFirm(e: React.FormEvent) {
    e.preventDefault();
    if (!firmForm.name.trim()) return;
    try {
      setLoading(true);
      await apiRequest("/firms", {
        ...auth({ method: "POST" }),
        body: JSON.stringify({
          name: firmForm.name,
          description: firmForm.description || undefined,
          phone: firmForm.phone || undefined,
          email: firmForm.email || undefined
        })
      });
      setFirmForm(emptyFirmForm);
      await loadAll();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  // Редактирование фирмы
  async function updateFirm(id: string, data: Partial<Firm>) {
    try {
      setLoading(true);
      await apiRequest(`/firms/${id}`, {
        ...auth({ method: "PUT" }),
        body: JSON.stringify(data)
      });
      setEditingFirmId(null);
      await loadAll();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  // Удаление фирмы
  async function deleteFirm(id: string) {
    if (!confirm("Удалить фирму?")) return;
    try {
      setLoading(true);
      await apiRequest(`/firms/${id}`, { ...auth({ method: "DELETE" }) });
      await loadAll();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="shell">
        <header className="top">
          <div className="brand">
            <ShieldCheck />
            <div>
              <div className="title">Союз CRM</div>
              <div className="subtitle">Минималистичная CRM для охранного агентства</div>
            </div>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title={theme === "light" ? "Тёмная тема" : "Светлая тема"}>
            {theme === "light" ? <Moon /> : <Sun />}
          </button>
        </header>

        <section className="panel">
          <h2>Вход через Telegram</h2>
          <p>Откройте приложение через кнопку бота. Если вы уже внутри Telegram, нажмите вход.</p>
          <button className="primary" onClick={loginTelegram} disabled={loading}>
            Войти
          </button>
          <div className="divider" />
          <h3>DEV вход (локальная разработка)</h3>
          <div className="grid-2">
            <label className="field">
              <span>DEV токен</span>
              <input value={devToken} onChange={(e) => setDevToken(e.target.value)} placeholder="dev-token" />
            </label>
            <label className="field">
              <span>Telegram ID</span>
              <input value={devTgId} onChange={(e) => setDevTgId(e.target.value)} />
            </label>
            <label className="field">
              <span>Роль</span>
              <select value={devRole} onChange={(e) => setDevRole(e.target.value as any)}>
                <option value="MANAGER">Руководитель</option>
                <option value="ACCOUNTANT">Бухгалтер</option>
              </select>
            </label>
          </div>
          <button className="ghost" onClick={loginDev} disabled={loading}>
            DEV вход
          </button>
          {error && <div className="error">{error}</div>}
        </section>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <ShieldCheck />
          <div>
            <div className="title">Союз CRM</div>
            <div className="subtitle">Охранное агентство</div>
          </div>
        </div>
        <div className="user">
          <UserCircle2 />
          <div>
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{isManager ? "Руководитель" : "Бухгалтер"}</div>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title={theme === "light" ? "Тёмная тема" : "Светлая тема"}>
            {theme === "light" ? <Moon /> : <Sun />}
          </button>
          <button className="icon" onClick={logout} title="Выход">
            <LogOut />
          </button>
        </div>
      </header>

      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <Tabs.List className="tabs">
          <Tabs.Trigger className="tab" value="tasks">
            <ClipboardList />
            Задачи
          </Tabs.Trigger>
          <Tabs.Trigger className="tab" value="firms">
            <BriefcaseBusiness />
            Фирмы
          </Tabs.Trigger>
          <button className="ghost" onClick={loadAll} disabled={loading}>
            <RefreshCcw />
            Обновить
          </button>
        </Tabs.List>

        {error && <div className="error">{error}</div>}

        <Tabs.Content value="tasks">
          <section className="panel">
          <div className="panel-head">
            <h2>Задачи</h2>
            <div className="muted">Всего: {tasks.length}</div>
          </div>

          {isManager && (
            <form className="form" onSubmit={createTask}>
              <div className="form-title">
                <Plus />
                Новая задача
              </div>
              <label className="field">
                <span>Название</span>
                <input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((s) => ({ ...s, title: e.target.value }))}
                  placeholder="Например: Сдать отчет за февраль"
                />
              </label>
              <label className="field">
                <span>Описание</span>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Дополнительные детали"
                />
              </label>
              <div className="grid-2">
                <label className="field">
                  <span>Срок</span>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm((s) => ({ ...s, dueDate: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Ответственный</span>
                  <select
                    value={taskForm.assignedToId}
                    onChange={(e) => setTaskForm((s) => ({ ...s, assignedToId: e.target.value }))}
                  >
                    <option value="">Авто: первый бухгалтер</option>
                    {accountants.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="primary" type="submit" disabled={loading}>
                Создать задачу
              </button>
            </form>
          )}

          <div className="list">
            {tasks.length === 0 && <div className="empty">Задач пока нет.</div>}
            {tasks.map((task) => (
              <div className="card" key={task.id}>
                <div className="card-head">
                  <div>
                    <div className="card-title">{task.title}</div>
                    <div className="muted">
                      Создал: {task.createdBy.name} · Ответственный: {task.assignedTo.name}
                    </div>
                  </div>
                  <div className={`status ${task.status.toLowerCase()}`}>{statusLabel[task.status]}</div>
                </div>
                {task.description && <div className="card-body">{task.description}</div>}
                <div className="card-foot">
                  <div className="muted">
                    {task.dueDate ? `Срок: ${task.dueDate.slice(0, 10)}` : "Без срока"}
                  </div>
                  <select
                    value={task.status}
                    onChange={(e) => updateTaskStatus(task.id, e.target.value as Task["status"])}
                  >
                    <option value="NEW">Новая</option>
                    <option value="IN_PROGRESS">В работе</option>
                    <option value="DONE">Выполнена</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>
        </Tabs.Content>

        <Tabs.Content value="firms">
          <section className="panel">
          <div className="panel-head">
            <h2>Фирмы-партнеры</h2>
            <div className="muted">Всего: {firms.length}</div>
          </div>

          {isManager && (
            <form className="form" onSubmit={createFirm}>
              <div className="form-title">
                <Plus />
                Новая фирма
              </div>
              <label className="field">
                <span>Название</span>
                <input
                  value={firmForm.name}
                  onChange={(e) => setFirmForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="ООО "
                />
              </label>
              <label className="field">
                <span>Описание</span>
                <textarea
                  value={firmForm.description}
                  onChange={(e) => setFirmForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Краткое описание"
                />
              </label>
              <div className="grid-2">
                <label className="field">
                  <span>Телефон</span>
                  <input
                    value={firmForm.phone}
                    onChange={(e) => setFirmForm((s) => ({ ...s, phone: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={firmForm.email}
                    onChange={(e) => setFirmForm((s) => ({ ...s, email: e.target.value }))}
                  />
                </label>
              </div>
              <button className="primary" type="submit" disabled={loading}>
                Добавить фирму
              </button>
            </form>
          )}

          <div className="list">
            {firms.length === 0 && <div className="empty">Фирм пока нет.</div>}
            {firms.map((firm) => {
              const editing = editingFirmId === firm.id;
              return (
                <div className="card" key={firm.id}>
                  {!editing ? (
                    <>
                      <div className="card-head">
                        <div>
                          <div className="card-title">{firm.name}</div>
                          <div className="muted">Создана: {firm.createdAt.slice(0, 10)}</div>
                        </div>
                        {isManager && (
                          <button className="ghost" onClick={() => setEditingFirmId(firm.id)}>
                            Редактировать
                          </button>
                        )}
                      </div>
                      {firm.description && <div className="card-body">{firm.description}</div>}
                      <div className="card-foot">
                        <div className="muted">
                          {firm.phone || "—"} · {firm.email || "—"}
                        </div>
                        {isManager && (
                          <button className="danger" onClick={() => deleteFirm(firm.id)}>
                            Удалить
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="edit">
                      <label className="field">
                        <span>Название</span>
                        <input
                          defaultValue={firm.name}
                          onChange={(e) =>
                            setFirms((prev) =>
                              prev.map((f) => (f.id === firm.id ? { ...f, name: e.target.value } : f))
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Описание</span>
                        <textarea
                          defaultValue={firm.description ?? ""}
                          onChange={(e) =>
                            setFirms((prev) =>
                              prev.map((f) => (f.id === firm.id ? { ...f, description: e.target.value } : f))
                            )
                          }
                        />
                      </label>
                      <div className="grid-2">
                        <label className="field">
                          <span>Телефон</span>
                          <input
                            defaultValue={firm.phone ?? ""}
                            onChange={(e) =>
                              setFirms((prev) =>
                                prev.map((f) => (f.id === firm.id ? { ...f, phone: e.target.value } : f))
                              )
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Email</span>
                          <input
                            defaultValue={firm.email ?? ""}
                            onChange={(e) =>
                              setFirms((prev) =>
                                prev.map((f) => (f.id === firm.id ? { ...f, email: e.target.value } : f))
                              )
                            }
                          />
                        </label>
                      </div>
                      <div className="row">
                        <button
                          className="primary"
                          onClick={() => {
                            const current = firms.find((f) => f.id === firm.id);
                            if (!current) return;
                            updateFirm(firm.id, {
                              name: current.name,
                              description: current.description ?? "",
                              phone: current.phone ?? "",
                              email: current.email ?? ""
                            });
                          }}
                        >
                          Сохранить
                        </button>
                        <button className="ghost" onClick={() => setEditingFirmId(null)}>
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        </Tabs.Content>
      </Tabs.Root>

      <footer className="footer">
        <CheckCircle2 />
        <span>Все изменения сохраняются мгновенно.</span>
      </footer>
    </div>
  );
}
