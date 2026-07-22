# Bot Architect Marketplace — Bot specification

**Archetype:** commerce

**Voice:** professional and approachable — write every user-facing message, button label, error, and empty state in this voice.

A public, searchable marketplace connecting clients with verified bot architects. Admins manage architect profiles (categories, bios, portfolios) while visitors browse, filter, and send direct contact requests without needing accounts. Architects receive notifications via Telegram, and admins moderate all interactions for quality control.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- bot architects
- potential clients
- marketplace admins

## Success criteria

- Clients can discover and contact architects via category/search
- Admins can manage profiles and moderate messages
- Architects receive real-time notifications for new inquiries

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with browsing/search options
- **Browse Categories** (button, actor: user, callback: browse:categories) — View architect listings by curated category
- **Search Architects** (button, actor: user, callback: search:keywords) — Find architects using keyword search
- **Contact Architect** (button, actor: user, callback: contact:init) — Open contact form with selected architect
  - inputs: message text, optional contact info
  - outputs: notification to architect, moderation copy to admins

## Flows

### Visitor browsing
_Trigger:_ /start

1. Show main menu
2. Select browse/search
3. Display filtered architect cards
4. View profile details
5. Send contact request

_Data touched:_ architect_profiles, contact_requests

### Admin moderation
_Trigger:_ admin:dashboard

1. View pending profiles
2. Edit profile fields
3. Publish/unpublish status
4. Review contact messages
5. Redact/forward messages

_Data touched:_ architect_profiles, contact_requests, admin_actions

### Contact workflow
_Trigger:_ contact:init

1. Select architect
2. Enter message
3. Submit form
4. Send DM to architect
5. Copy to admin moderation queue

_Data touched:_ contact_requests, notifications

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **architect_profile** _(retention: persistent)_ — Verified architect information
  - fields: name, headline, categories, location, rate, bio, skills, portfolio_links, telegram_handle
- **contact_request** _(retention: persistent)_ — Client-initiated inquiry
  - fields: sender_message, contact_info, target_architect, timestamp
- **admin_action** _(retention: persistent)_ — Moderation history
  - fields: action_type, admin_id, target_profile, timestamp

## Integrations

- **Telegram** (required) — Bot API messaging and notifications
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Admin-only commands for profile management
- Moderation dashboard for contact requests
- Category list configuration

## Notifications

- Direct message to architect when contacted
- Admin alerts for new profiles/messages
- Moderation status updates

## Permissions & privacy

- Admin-only profile management
- All contact messages copied to moderation
- Optional location/rate fields for privacy control

## Edge cases

- No results from search/filter
- Invalid contact form submissions
- Architect notifications failing delivery

## Required tests

- End-to-end contact request flow with moderation
- Category filtering accuracy
- Admin dashboard CRUD operations

## Assumptions

- Admins handle all architect onboarding
- Categories use seeded list + 'Other'
- No client account system
