import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDomainStorage } from "../domain-store.js";
import { DEFAULT_CATEGORIES } from "../types.js";

registerMainMenuItem({ label: "Browse Categories", data: "browse:categories", order: 10 });

const composer = new Composer<Ctx>();

composer.callbackQuery("browse:categories", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getDomainStorage();
  let categories = await store.getCategories();
  if (categories.length === 0) {
    categories = [...DEFAULT_CATEGORIES];
    await store.setCategories(categories);
  }

  const rows = categories.map((cat) => [
    inlineButton(cat, `cat:${cat}`),
  ]);

  await ctx.editMessageText("Pick a category to browse architects:", {
    reply_markup: inlineKeyboard([...rows, [inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

composer.callbackQuery(/^cat:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const category = ctx.match![1];
  const store = getDomainStorage();
  const architects = await store.listArchitectsByCategory(category);

  if (architects.length === 0) {
    await ctx.editMessageText(
      `No architects in "${category}" yet — check back soon.`,
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to categories", "browse:categories")]]) },
    );
    return;
  }

  const rows = architects.map((a) => [
    inlineButton(a.name, `arch:${a.id}`),
  ]);

  await ctx.editMessageText(`Architects in "${category}":`, {
    reply_markup: inlineKeyboard([
      ...rows,
      [inlineButton("⬅️ Back to categories", "browse:categories")],
    ]),
  });
});

composer.callbackQuery(/^arch:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = ctx.match![1];
  const store = getDomainStorage();
  const architect = await store.getArchitect(id);

  if (!architect || !architect.published) {
    await ctx.editMessageText("This profile is no longer available.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const lines = [
    `*${architect.name}*`,
    architect.headline,
    "",
    architect.bio,
  ];

  if (architect.categories.length > 0) {
    lines.push("", `Categories: ${architect.categories.join(", ")}`);
  }
  if (architect.skills.length > 0) {
    lines.push(`Skills: ${architect.skills.join(", ")}`);
  }
  if (architect.location) {
    lines.push(`Location: ${architect.location}`);
  }
  if (architect.rate) {
    lines.push(`Rate: ${architect.rate}`);
  }
  if (architect.portfolioLinks.length > 0) {
    lines.push(`Portfolio: ${architect.portfolioLinks.join(", ")}`);
  }
  if (architect.telegramHandle) {
    lines.push(`Telegram: @${architect.telegramHandle}`);
  }

  await ctx.editMessageText(lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: inlineKeyboard([
      [inlineButton("✉️ Contact this architect", `contact:init:${architect.id}`)],
      [inlineButton("⬅️ Back to category", `cat:${architect.categories[0] ?? "Other"}`)],
    ]),
  });
});

export default composer;
