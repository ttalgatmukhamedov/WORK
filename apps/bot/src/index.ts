import { Bot, InlineKeyboard } from "grammy";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL;

if (!token || !webAppUrl) {
  throw new Error("Нужно указать BOT_TOKEN и WEBAPP_URL в .env");
}

// Минимальный бот, который ведет пользователя в мини-приложение
const bot = new Bot(token);

const keyboard = new InlineKeyboard().webApp("Открыть CRM", webAppUrl);

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Добро пожаловать в Союз CRM. Нажмите кнопку ниже, чтобы открыть мини-приложение.",
    { reply_markup: keyboard }
  );
});

bot.on("message", async (ctx) => {
  await ctx.reply("Для работы используйте кнопку ниже.", { reply_markup: keyboard });
});

bot.start();
