import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import crypto from "crypto";

dotenv.config();

type Role = "MANAGER" | "ACCOUNTANT";
type TaskStatus = "NEW" | "IN_PROGRESS" | "DONE";

const prisma = new PrismaClient();

const envSchema = z.object({
  DATABASE_URL: z.string(),
  BOT_TOKEN: z.string().default(""),
  JWT_SECRET: z.string(),
  CORS_ORIGIN: z.string().default("*"),
  MANAGER_TG_ID: z.string().default(""),
  ACCOUNTANT_TG_ID: z.string().default(""),
  AUTO_CREATE_ACCOUNTANT: z.string().default("false"),
  DEV_BYPASS_TOKEN: z.string().default(""),
  NODE_ENV: z.string().default("development"),
  PORT: z.string().default("3000")
});

const env = envSchema.parse(process.env);

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = env.CORS_ORIGIN.split(",").map((s) => s.trim());
    if (allowed.includes("*") || allowed.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error("CORS запрещен"), false);
  }
});

await app.register(jwt, { secret: env.JWT_SECRET });

app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "UNAUTHORIZED" });
  }
});

// Проверка подписи initData согласно документации Telegram WebApp
function verifyTelegramInitData(initData: string, botToken: string): boolean {
  if (!botToken) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return calculatedHash === hash;
}

// Назначение роли по Telegram ID или fallback-правилу
function resolveRole(tgId: string): Role | null {
  if (env.MANAGER_TG_ID && tgId === env.MANAGER_TG_ID) return "MANAGER";
  if (env.ACCOUNTANT_TG_ID && tgId === env.ACCOUNTANT_TG_ID) return "ACCOUNTANT";
  if (env.AUTO_CREATE_ACCOUNTANT === "true") return "ACCOUNTANT";
  return null;
}

app.get("/health", async () => ({ ok: true }));

// Авторизация через Telegram WebApp initData
app.post("/auth/telegram", async (request, reply) => {
  const bodySchema = z.object({ initData: z.string() });
  const { initData } = bodySchema.parse(request.body);

  const isValid = verifyTelegramInitData(initData, env.BOT_TOKEN);
  if (!isValid) {
    return reply.code(401).send({ error: "INVALID_INIT_DATA" });
  }

  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");
  if (!userRaw) {
    return reply.code(400).send({ error: "NO_USER" });
  }

  const tgUser = JSON.parse(userRaw) as {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };

  const tgId = String(tgUser.id);
  const name = `${tgUser.first_name ?? ""} ${tgUser.last_name ?? ""}`.trim() || tgUser.username || "Пользователь";

  let user = await prisma.user.findUnique({ where: { tgId } });
  if (!user) {
    const role = resolveRole(tgId);
    if (!role) {
      return reply.code(403).send({ error: "ROLE_NOT_ALLOWED" });
    }
    user = await prisma.user.create({ data: { tgId, name, role } });
  }

  const token = app.jwt.sign({ userId: user.id, role: user.role as Role });
  return { token, user };
});

// DEV обход для локальной разработки
app.post("/auth/dev", async (request, reply) => {
  const bodySchema = z.object({
    token: z.string(),
    tgId: z.string(),
    role: z.enum(["MANAGER", "ACCOUNTANT"]),
    name: z.string().default("Dev User")
  });
  const { token, tgId, role, name } = bodySchema.parse(request.body);

  if (!env.DEV_BYPASS_TOKEN || token !== env.DEV_BYPASS_TOKEN) {
    return reply.code(401).send({ error: "DEV_BYPASS_DENIED" });
  }

  let user = await prisma.user.findUnique({ where: { tgId } });
  if (!user) {
    user = await prisma.user.create({ data: { tgId, name, role: role as Role } });
  }

  const jwtToken = app.jwt.sign({ userId: user.id, role: user.role as Role });
  return { token: jwtToken, user };
});

app.get("/me", { preHandler: app.authenticate }, async (request) => {
  const userId = request.user.userId;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return { user };
});

app.get("/users", { preHandler: app.authenticate }, async (request, reply) => {
  if (request.user.role !== "MANAGER") {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }

  const role = (request.query as { role?: string }).role as Role | undefined;
  const users = await prisma.user.findMany({
    where: role ? { role } : undefined,
    select: { id: true, name: true, role: true }
  });

  return { users };
});

app.get("/tasks", { preHandler: app.authenticate }, async (request) => {
  const where = request.user.role === "MANAGER"
    ? {}
    : { assignedToId: request.user.userId };

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } }, assignedTo: { select: { name: true } } }
  });
  return { tasks };
});

app.post("/tasks", { preHandler: app.authenticate }, async (request, reply) => {
  if (request.user.role !== "MANAGER") {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }

  const bodySchema = z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    assignedToId: z.string().optional(),
    dueDate: z.string().optional()
  });
  const { title, description, assignedToId, dueDate } = bodySchema.parse(request.body);

  let assigneeId = assignedToId;
  if (!assigneeId) {
    const accountant = await prisma.user.findFirst({ where: { role: "ACCOUNTANT" } });
    if (!accountant) {
      return reply.code(400).send({ error: "NO_ACCOUNTANT" });
    }
    assigneeId = accountant.id;
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      createdById: request.user.userId,
      assignedToId: assigneeId
    }
  });

  return { task };
});

app.patch("/tasks/:id/status", { preHandler: app.authenticate }, async (request, reply) => {
  const bodySchema = z.object({ status: z.enum(["NEW", "IN_PROGRESS", "DONE"]) });
  const { status } = bodySchema.parse(request.body);
  const { id } = request.params as { id: string };

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return reply.code(404).send({ error: "NOT_FOUND" });

  const isManager = request.user.role === "MANAGER";
  const isAssignee = task.assignedToId === request.user.userId;
  if (!isManager && !isAssignee) {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }

  const updated = await prisma.task.update({ where: { id }, data: { status: status as TaskStatus } });
  return { task: updated };
});

app.get("/firms", { preHandler: app.authenticate }, async () => {
  const firms = await prisma.firm.findMany({ orderBy: { createdAt: "desc" } });
  return { firms };
});

app.post("/firms", { preHandler: app.authenticate }, async (request, reply) => {
  if (request.user.role !== "MANAGER") {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }

  const bodySchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional()
  });
  const data = bodySchema.parse(request.body);

  const firm = await prisma.firm.create({ data });
  return { firm };
});

app.put("/firms/:id", { preHandler: app.authenticate }, async (request, reply) => {
  if (request.user.role !== "MANAGER") {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }

  const bodySchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional()
  });
  const data = bodySchema.parse(request.body);
  const { id } = request.params as { id: string };

  const firm = await prisma.firm.update({ where: { id }, data });
  return { firm };
});

app.delete("/firms/:id", { preHandler: app.authenticate }, async (request, reply) => {
  if (request.user.role !== "MANAGER") {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }

  const { id } = request.params as { id: string };
  await prisma.firm.delete({ where: { id } });
  return { ok: true };
});

const port = Number(env.PORT || "3000");
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`Server running on http://localhost:${port}`);
});
