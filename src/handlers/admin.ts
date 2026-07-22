import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDomainStorage } from "../domain-store.js";
import { DEFAULT_CATEGORIES } from "../types.js";

registerMainMenuItem({ label: "⚙️ Admin", data: "admin:dashboard", order: 90 });

function isAdmin(ctx: Ctx): boolean {
  const adminIds = process.env.ADMIN_IDS;
  if (!adminIds) return false;
  const ids = adminIds.split(",").map((s) => s.trim());
  return ids.includes(String(ctx.from?.id));
}

const composer = new Composer<Ctx>();

composer.callbackQuery("admin:dashboard", async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.answerCallbackQuery({ text: "Admin access required." });
    return;
  }
  await ctx.answerCallbackQuery();
  const store = getDomainStorage();
  const pending = await store.listPendingContactRequests();

  const lines = ["⚙️ Admin Dashboard"];
  if (pending.length > 0) {
    lines.push(`\n📬 ${pending.length} pending message${pending.length === 1 ? "" : "s"} to review`);
  } else {
    lines.push("\nNo pending messages.");
  }

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add architect", "admin:add_arch")],
      [inlineButton("📋 Manage architects", "admin:list_arch")],
      [inlineButton("📬 Review messages", "admin:review_contacts")],
      [inlineButton("🏷️ Manage categories", "admin:categories")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

// ── Add architect flow ──

composer.callbackQuery("admin:add_arch", async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  if (ctx.session) {
    ctx.session.step = "admin_awaiting_name";
    ctx.session.flowData = {};
  }
  await ctx.reply("Enter the architect's name:", {
    reply_markup: { force_reply: true, input_field_placeholder: "Architect name…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (!isAdmin(ctx) || ctx.session?.step !== "admin_awaiting_name") return next();
  const name = ctx.message.text.trim();
  if (name.length < 2) { await ctx.reply("Name too short — try again."); return; }
  ctx.session.step = "admin_awaiting_headline";
  ctx.session.flowData = { ...ctx.session.flowData, name };
  await ctx.reply("Enter their headline (e.g. \"Full-stack bot developer\"):", {
    reply_markup: { force_reply: true, input_field_placeholder: "Headline…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (!isAdmin(ctx) || ctx.session?.step !== "admin_awaiting_headline") return next();
  const headline = ctx.message.text.trim();
  if (headline.length < 2) { await ctx.reply("Headline too short — try again."); return; }
  ctx.session.step = "admin_awaiting_bio";
  ctx.session.flowData = { ...ctx.session.flowData, headline };
  await ctx.reply("Enter their bio (short description of expertise):", {
    reply_markup: { force_reply: true, input_field_placeholder: "Bio…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (!isAdmin(ctx) || ctx.session?.step !== "admin_awaiting_bio") return next();
  const bio = ctx.message.text.trim();
  if (bio.length < 5) { await ctx.reply("Bio too short — try again."); return; }
  ctx.session.step = "admin_awaiting_categories";
  ctx.session.flowData = { ...ctx.session.flowData, bio };

  let categories = await getDomainStorage().getCategories();
  if (categories.length === 0) {
    categories = [...DEFAULT_CATEGORIES];
    await getDomainStorage().setCategories(categories);
  }

  const rows = categories.map((cat) => [inlineButton(cat, `admin:setcat:${cat}`)]);
  await ctx.reply("Select categories (tap one at a time, then tap Done):", {
    reply_markup: inlineKeyboard([...rows, [inlineButton("Done", "admin:cats_done")]]),
  });
});

composer.callbackQuery(/^admin:setcat:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  const cat = ctx.match![1];
  if (!ctx.session?.flowData) return;
  const selected = ctx.session.flowData.selectedCategories
    ? ctx.session.flowData.selectedCategories.split(",")
    : [];
  if (!selected.includes(cat)) selected.push(cat);
  ctx.session.flowData.selectedCategories = selected.join(",");
  await ctx.answerCallbackQuery({ text: `Added: ${cat}`, show_alert: false });
});

composer.callbackQuery("admin:cats_done", async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  if (!ctx.session?.flowData) return;

  const selectedCats = ctx.session.flowData.selectedCategories
    ? ctx.session.flowData.selectedCategories.split(",")
    : [];

  if (selectedCats.length === 0) {
    await ctx.reply("Select at least one category.");
    return;
  }

  ctx.session.step = "admin_awaiting_skills";
  ctx.session.flowData = { ...ctx.session.flowData, categories: selectedCats.join(",") };
  await ctx.reply("Enter their skills (comma-separated, e.g. \"grammY, Node.js, Redis\"):", {
    reply_markup: { force_reply: true, input_field_placeholder: "Skills…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (!isAdmin(ctx) || ctx.session?.step !== "admin_awaiting_skills") return next();
  const skills = ctx.message.text.split(",").map((s) => s.trim()).filter(Boolean);
  ctx.session.step = "admin_awaiting_location";
  ctx.session.flowData = { ...ctx.session.flowData, skills: skills.join(",") };
  await ctx.reply("Enter their location (or tap Skip):", {
    reply_markup: inlineKeyboard([[inlineButton("Skip", "admin:skip_location")]]),
  });
});

composer.callbackQuery("admin:skip_location", async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  if (!ctx.session) return;
  ctx.session.step = "admin_awaiting_rate";
  await ctx.reply("Enter their rate (e.g. \"$50/hr\" or \"Free consultation\"):", {
    reply_markup: inlineKeyboard([[inlineButton("Skip", "admin:skip_rate")]]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (!isAdmin(ctx) || ctx.session?.step !== "admin_awaiting_location") return next();
  const location = ctx.message.text.trim();
  ctx.session.flowData = { ...ctx.session.flowData, location };
  ctx.session.step = "admin_awaiting_rate";
  await ctx.reply("Enter their rate (e.g. \"$50/hr\" or \"Free consultation\"):", {
    reply_markup: inlineKeyboard([[inlineButton("Skip", "admin:skip_rate")]]),
  });
});

composer.callbackQuery("admin:skip_rate", async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  if (!ctx.session) return;
  ctx.session.step = "admin_awaiting_portfolio";
  await ctx.reply("Enter portfolio links (comma-separated, or tap Skip):", {
    reply_markup: inlineKeyboard([[inlineButton("Skip", "admin:skip_portfolio")]]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (!isAdmin(ctx) || ctx.session?.step !== "admin_awaiting_rate") return next();
  const rate = ctx.message.text.trim();
  ctx.session.flowData = { ...ctx.session.flowData, rate };
  ctx.session.step = "admin_awaiting_portfolio";
  await ctx.reply("Enter portfolio links (comma-separated, or tap Skip):", {
    reply_markup: inlineKeyboard([[inlineButton("Skip", "admin:skip_portfolio")]]),
  });
});

composer.callbackQuery("admin:skip_portfolio", async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  if (!ctx.session) return;
  ctx.session.step = "admin_awaiting_telegram";
  await ctx.reply("Enter their Telegram handle (without @, or tap Skip):", {
    reply_markup: inlineKeyboard([[inlineButton("Skip", "admin:skip_telegram")]]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (!isAdmin(ctx) || ctx.session?.step !== "admin_awaiting_portfolio") return next();
  const links = ctx.message.text.split(",").map((s) => s.trim()).filter(Boolean);
  ctx.session.flowData = { ...ctx.session.flowData, portfolioLinks: links.join(",") };
  ctx.session.step = "admin_awaiting_telegram";
  await ctx.reply("Enter their Telegram handle (without @, or tap Skip):", {
    reply_markup: inlineKeyboard([[inlineButton("Skip", "admin:skip_telegram")]]),
  });
});

composer.callbackQuery("admin:skip_telegram", async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  await saveArchitect(ctx);
});

composer.on("message:text", async (ctx, next) => {
  if (!isAdmin(ctx) || ctx.session?.step !== "admin_awaiting_telegram") return next();
  const handle = ctx.message.text.trim().replace(/^@/, "");
  ctx.session.flowData = { ...ctx.session.flowData, telegramHandle: handle };
  await saveArchitect(ctx);
});

async function saveArchitect(ctx: Ctx) {
  if (!ctx.session?.flowData) return;
  const fd = ctx.session.flowData;
  ctx.session.step = "idle";
  ctx.session.flowData = undefined;

  const store = getDomainStorage();
  const id = `arch_${Date.now()}`;
  await store.setArchitect({
    id,
    name: fd.name ?? "Unknown",
    headline: fd.headline ?? "",
    bio: fd.bio ?? "",
    categories: fd.categories ? fd.categories.split(",") : [],
    skills: fd.skills ? fd.skills.split(",") : [],
    location: fd.location || undefined,
    rate: fd.rate || undefined,
    portfolioLinks: fd.portfolioLinks ? fd.portfolioLinks.split(",") : [],
    telegramHandle: fd.telegramHandle || undefined,
    published: true,
    createdAt: Date.now(),
  });

  await ctx.reply(`✅ Architect "${fd.name}" added and published!`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Dashboard", "admin:dashboard")]]),
  });
}

// ── List architects ──

composer.callbackQuery("admin:list_arch", async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  const store = getDomainStorage();
  const all = await store.listArchitects();

  if (all.length === 0) {
    await ctx.editMessageText("No architects yet.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add one", "admin:add_arch")],
        [inlineButton("⬅️ Dashboard", "admin:dashboard")],
      ]),
    });
    return;
  }

  const rows = all.map((a) => [
    inlineButton(`${a.published ? "✅" : "🔒"} ${a.name}`, `admin:arch:${a.id}`),
  ]);

  await ctx.editMessageText(`Architects (${all.length}):`, {
    reply_markup: inlineKeyboard([...rows, [inlineButton("⬅️ Dashboard", "admin:dashboard")]]),
  });
});

composer.callbackQuery(/^admin:arch:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  const id = ctx.match![1];
  const store = getDomainStorage();
  const a = await store.getArchitect(id);
  if (!a) {
    await ctx.editMessageText("Architect not found.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Dashboard", "admin:dashboard")]]),
    });
    return;
  }

  const status = a.published ? "Published" : "Unpublished";
  const lines = [
    `*${a.name}* — ${status}`,
    a.headline,
    "",
    a.bio,
    `Categories: ${a.categories.join(", ") || "none"}`,
    `Skills: ${a.skills.join(", ") || "none"}`,
  ];

  await ctx.editMessageText(lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: inlineKeyboard([
      [inlineButton(
        a.published ? "🔒 Unpublish" : "✅ Publish",
        `admin:toggle:${a.id}`,
      )],
      [inlineButton("🗑 Delete", `admin:delete:${a.id}`)],
      [inlineButton("⬅️ Back", "admin:list_arch")],
    ]),
  });
});

composer.callbackQuery(/^admin:toggle:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  const id = ctx.match![1];
  const store = getDomainStorage();
  const a = await store.getArchitect(id);
  if (!a) return;
  a.published = !a.published;
  await store.setArchitect(a);
  await ctx.answerCallbackQuery({ text: a.published ? "Published" : "Unpublished" });

  const status = a.published ? "Published" : "Unpublished";
  const lines = [
    `*${a.name}* — ${status}`,
    a.headline,
    "",
    a.bio,
    `Categories: ${a.categories.join(", ") || "none"}`,
    `Skills: ${a.skills.join(", ") || "none"}`,
  ];

  await ctx.editMessageText(lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: inlineKeyboard([
      [inlineButton(
        a.published ? "🔒 Unpublish" : "✅ Publish",
        `admin:toggle:${a.id}`,
      )],
      [inlineButton("🗑 Delete", `admin:delete:${a.id}`)],
      [inlineButton("⬅️ Back", "admin:list_arch")],
    ]),
  });
});

composer.callbackQuery(/^admin:delete:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  const id = ctx.match![1];
  const store = getDomainStorage();
  await store.deleteArchitect(id);
  await ctx.editMessageText("Architect deleted.", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Dashboard", "admin:dashboard")]]),
  });
});

// ── Review contact messages ──

composer.callbackQuery("admin:review_contacts", async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  const store = getDomainStorage();
  const pending = await store.listPendingContactRequests();

  if (pending.length === 0) {
    await ctx.editMessageText("No pending messages to review.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Dashboard", "admin:dashboard")]]),
    });
    return;
  }

  const first = pending[0];
  const architect = await store.getArchitect(first.targetArchitectId);
  const archName = architect?.name ?? "Unknown";

  const lines = [
    `📬 Message from ${first.senderName}:`,
    "",
    `"${first.message}"`,
    "",
    `→ To: ${archName}`,
    first.contactInfo ? `Contact: ${first.contactInfo}` : "",
  ].filter(Boolean);

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton("✅ Forwarded", `admin:forward:${first.id}`)],
      [inlineButton("🗑 Redact", `admin:redact:${first.id}`)],
    ]),
  });
});

composer.callbackQuery(/^admin:forward:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  const id = ctx.match![1];
  const store = getDomainStorage();
  await store.markContactForwarded(id);
  await ctx.answerCallbackQuery({ text: "Marked as forwarded" });
  // Show next pending
  const pending = await store.listPendingContactRequests();
  if (pending.length === 0) {
    await ctx.editMessageText("All messages reviewed!", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Dashboard", "admin:dashboard")]]),
    });
  } else {
    const first = pending[0];
    const architect = await store.getArchitect(first.targetArchitectId);
    await ctx.editMessageText(
      `📬 Message from ${first.senderName}:\n\n"${first.message}"\n\n→ To: ${architect?.name ?? "Unknown"}`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("✅ Forwarded", `admin:forward:${first.id}`)],
          [inlineButton("🗑 Redact", `admin:redact:${first.id}`)],
        ]),
      },
    );
  }
});

composer.callbackQuery(/^admin:redact:(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  const id = ctx.match![1];
  const store = getDomainStorage();
  await store.markContactForwarded(id); // mark as handled (redacted)
  await ctx.answerCallbackQuery({ text: "Message redacted" });
  const pending = await store.listPendingContactRequests();
  if (pending.length === 0) {
    await ctx.editMessageText("All messages reviewed!", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Dashboard", "admin:dashboard")]]),
    });
  } else {
    const first = pending[0];
    const architect = await store.getArchitect(first.targetArchitectId);
    await ctx.editMessageText(
      `📬 Message from ${first.senderName}:\n\n"${first.message}"\n\n→ To: ${architect?.name ?? "Unknown"}`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("✅ Forwarded", `admin:forward:${first.id}`)],
          [inlineButton("🗑 Redact", `admin:redact:${first.id}`)],
        ]),
      },
    );
  }
});

composer.callbackQuery("admin:next_contact", async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  // Just re-trigger review — it will show the first pending
  const store = getDomainStorage();
  const pending = await store.listPendingContactRequests();
  if (pending.length === 0) {
    await ctx.editMessageText("All messages reviewed!", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Dashboard", "admin:dashboard")]]),
    });
    return;
  }
  const first = pending[0];
  const architect = await store.getArchitect(first.targetArchitectId);
  await ctx.editMessageText(
    `📬 Message from ${first.senderName}:\n\n"${first.message}"\n\n→ To: ${architect?.name ?? "Unknown"}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("✅ Forwarded", `admin:forward:${first.id}`)],
        [inlineButton("🗑 Redact", `admin:redact:${first.id}`)],
      ]),
    },
  );
});

// ── Manage categories ──

composer.callbackQuery("admin:categories", async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  const store = getDomainStorage();
  let categories = await store.getCategories();
  if (categories.length === 0) {
    categories = [...DEFAULT_CATEGORIES];
    await store.setCategories(categories);
  }
  await ctx.editMessageText(
    `Current categories:\n${categories.map((c) => `• ${c}`).join("\n")}\n\nTo add a category, type its name:`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add category", "admin:add_cat")],
        [inlineButton("⬅️ Dashboard", "admin:dashboard")],
      ]),
    },
  );
});

composer.callbackQuery("admin:add_cat", async (ctx) => {
  if (!isAdmin(ctx)) { await ctx.answerCallbackQuery({ text: "Admin access required." }); return; }
  await ctx.answerCallbackQuery();
  if (ctx.session) ctx.session.step = "admin_awaiting_new_cat";
  await ctx.reply("Type the new category name:", {
    reply_markup: { force_reply: true, input_field_placeholder: "Category name…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (!isAdmin(ctx) || ctx.session?.step !== "admin_awaiting_new_cat") return next();
  const cat = ctx.message.text.trim();
  if (cat.length < 2) { await ctx.reply("Category name too short."); return; }
  ctx.session.step = "idle";
  const store = getDomainStorage();
  const cats = await store.getCategories();
  if (cats.includes(cat)) {
    await ctx.reply(`"${cat}" already exists.`, {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Dashboard", "admin:dashboard")]]),
    });
    return;
  }
  cats.push(cat);
  await store.setCategories(cats);
  await ctx.reply(`✅ Added category "${cat}".`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Dashboard", "admin:dashboard")]]),
  });
});

export default composer;
