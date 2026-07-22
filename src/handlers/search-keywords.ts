import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDomainStorage } from "../domain-store.js";

registerMainMenuItem({ label: "Search Architects", data: "search:keywords", order: 20 });

const composer = new Composer<Ctx>();

composer.callbackQuery("search:keywords", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.session) ctx.session.step = "awaiting_search";
  await ctx.reply("Type a keyword to search for architects (e.g. \"ecommerce\", \"Python\", \"booking\"):", {
    reply_markup: { force_reply: true, input_field_placeholder: "Search keyword…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session?.step !== "awaiting_search") return next();

  const query = ctx.message.text.trim();
  if (query.length < 2) {
    await ctx.reply("Please enter at least 2 characters to search.");
    return;
  }

  ctx.session.step = "idle";
  const store = getDomainStorage();
  const results = await store.searchArchitects(query);

  if (results.length === 0) {
    await ctx.reply(`No architects found for "${query}". Try different keywords?`, {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const rows = results.map((a) => [
    inlineButton(`${a.name} — ${a.headline}`, `arch:${a.id}`),
  ]);

  await ctx.reply(`Found ${results.length} architect${results.length === 1 ? "" : "s"} for "${query}":`, {
    reply_markup: inlineKeyboard([...rows, [inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
