import "@fastify/jwt";
import "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string; role: "MANAGER" | "ACCOUNTANT" };
    user: { userId: string; role: "MANAGER" | "ACCOUNTANT" };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
  }
}
