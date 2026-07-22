import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getDomainStorage } from "../domain-store.js";

registerMainMenuItem({ label: "Contact Architect", data: "contact:init", order: 30 });

const composer = new Composer<Ctx>();

// Entry: user taps "Contact Architect" from main menu
composer.callbackQuery("contact:init", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getDomainStorage();
  const architects = await store.listPublishedArchitects();

  if (architects.length === 0) {
    await ctx.editMessageText("No architects available yet — check back soon.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const rows = architects.map((a) => [
    inlineButton(a.name, `contact:pick:${a.id}`),
  ]);

  await ctx.editMessageText("Select an architect to contact:", {
    reply_markup: inlineKeyboard([...rows, [inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

// Entry: user taps "Contact this architect" from a profile card
composer.callbackQuery(/^contact:init:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const architectId = ctx.match![1];
  const store = getDomainStorage();
  const architect = await store.getArchitect(architectId);

  if (!architect || !architect.published) {
    await ctx.editMessageText("This profile is no longer available.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  if (ctx.session) {
    ctx.session.step = "awaiting_contact_msg";
    ctx.session.flowData = { architectId };
  }

  await ctx.reply(
    `You're about to contact *${architect.name}*.\n\nType your message — introduce yourself and describe what you need:`,
    {
      parse_mode: "Markdown",
      reply_markup: { force_reply: true, input_field_placeholder: "Your message…" },
    },
  );
});

// Architect selection from the contact list
composer.callbackQuery(/^contact:pick:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const architectId = ctx.match![1];
  const store = getDomainStorage();
  const architect = await store.getArchitect(architectId);

  if (!architect || !architect.published) {
    await ctx.editMessageText("This profile is no longer available.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  if (ctx.session) {
    ctx.session.step = "awaiting_contact_msg";
    ctx.session.flowData = { architectId };
  }

  await ctx.reply(
    `You're about to contact *${architect.name}*.\n\nType your message — introduce yourself and describe what you need:`,
    {
      parse_mode: "Markdown",
      reply_markup: { force_reply: true, input_field_placeholder: "Your message…" },
    },
  );
});

// Step 1: receive the contact message
composer.on("message:text", async (ctx, next) => {
  if (ctx.session?.step !== "awaiting_contact_msg") return next();

  const message = ctx.message.text.trim();
  if (message.length < 5) {
    await ctx.reply("Please write a longer message so the architect knows how to help.");
    return;
  }

  const architectId = ctx.session.flowData?.architectId;
  if (!architectId) {
    ctx.session.step = "idle";
    await ctx.reply("Something went wrong — let's start over.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  ctx.session.step = "awaiting_contact_info";
  ctx.session.flowData = { ...ctx.session.flowData, message };
  await ctx.reply(
    "Got it. Now optionally share your contact info (email, Telegram handle, or phone) so the architect can reach you, or tap Skip:",
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Skip", "contact:skip_info")],
      ]),
    },
  );
});

// Step 2: receive optional contact info
composer.on("message:text", async (ctx, next) => {
  if (ctx.session?.step !== "awaiting_contact_info") return next();

  const contactInfo = ctx.message.text.trim();
  const flowData = ctx.session.flowData ?? {};
  const architectId = flowData.architectId;
  const message = flowData.message;

  if (!architectId || !message) {
    ctx.session.step = "idle";
    ctx.session.flowData = undefined;
    await ctx.reply("Something went wrong — let's start over.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  ctx.session.step = "idle";
  ctx.session.flowData = undefined;

  const store = getDomainStorage();
  const architect = await store.getArchitect(architectId);
  if (!architect || !architect.published) {
    await ctx.reply("That architect is no longer available.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const contactId = `ct_${Date.now()}_${ctx.from.id}`;
  await store.addContactRequest({
    id: contactId,
    senderUserId: ctx.from.id,
    senderName: ctx.from.first_name,
    message,
    contactInfo: contactInfo || undefined,
    targetArchitectId: architectId,
    timestamp: Date.now(),
    forwarded: false,
  });

  // Notify architect if they have a Telegram handle
  if (architect.telegramHandle) {
    try {
      await ctx.api.sendMessage(
        `@${architect.telegramHandle}`,
        `📬 New inquiry from ${ctx.from.first_name}:\n\n"${message}"${contactInfo ? `\n\nContact: ${contactInfo}` : ""}`,
      );
    } catch {
      // Architect may not have started the bot — that's okay
    }
  }

  await ctx.reply(
    `Your message has been sent to ${architect.name}! They'll get back to you soon.`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

// User skips contact info
composer.callbackQuery("contact:skip_info", async (ctx) => {
  await ctx.answerCallbackQuery();
  const flowData = ctx.session?.flowData;
  const architectId = flowData?.architectId;
  const message = flowData?.message;

  if (!architectId || !message || !ctx.session) {
    await ctx.editMessageText("Something went wrong — let's start over.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  ctx.session.step = "idle";
  ctx.session.flowData = undefined;

  const store = getDomainStorage();
  const architect = await store.getArchitect(architectId);
  if (!architect || !architect.published) {
    await ctx.editMessageText("That architect is no longer available.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const contactId = `ct_${Date.now()}_${ctx.from.id}`;
  await store.addContactRequest({
    id: contactId,
    senderUserId: ctx.from.id,
    senderName: ctx.from.first_name,
    message,
    targetArchitectId: architectId,
    timestamp: Date.now(),
    forwarded: false,
  });

  if (architect.telegramHandle) {
    try {
      await ctx.api.sendMessage(
        `@${architect.telegramHandle}`,
        `📬 New inquiry from ${ctx.from.first_name}:\n\n"${message}"`,
      );
    } catch {
      // Architect may not have started the bot
    }
  }

  await ctx.editMessageText(
    `Your message has been sent to ${architect.name}! They'll get back to you soon.`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

export default composer;
