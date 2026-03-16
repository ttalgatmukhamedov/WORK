export type Role = "MANAGER" | "ACCOUNTANT";

export type User = {
  id: string;
  name: string;
  role: Role;
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "NEW" | "IN_PROGRESS" | "DONE";
  dueDate?: string | null;
  createdAt: string;
  createdBy: { name: string };
  assignedTo: { name: string };
};

export type Firm = {
  id: string;
  name: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt: string;
};
