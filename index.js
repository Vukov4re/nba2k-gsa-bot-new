// index.js
import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events,
  ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, PermissionsBitField
} from 'discord.js';

import { BASE_ROLES, BUTTON_LABELS, REP, VERIFY_TEXT, MEDIA_TEXT } from './config/roles.js';

// ================= Onboarding Einstellungen =================
const REMIND_FIRST_MIN = 30;     // 30 Min nach Beitritt DM
const REMIND_REPEAT_HOURS = 24;  // danach alle 24h DM
const ROLE_ACCESS_NAME = 'Mitglied';
const ROLE_BLOCK_NAME  = 'Ohne Rolle';
const TEMPLATE_ROLE = process.env.TEMPLATE_ROLE || 'REP-Vorlage';

// ================= Client =================
const TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
if (!TOKEN) { console.error('❌ Missing DISCORD_TOKEN/TOKEN'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,   // Privileged → im Dev-Portal aktivieren
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent  // Privileged → im Dev-Portal aktivieren
  ],
});

// ================= Helpers: Roles/Channels/Messages =================
async function ensureRole(guild, name) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) role = await guild.roles.create({ name });
  return role;
}
async function ensureCategory(guild, name) {
  let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
  if (!cat) cat = await guild.channels.create({ name, type: ChannelType.GuildCategory });
  return cat;
}
async function ensureTextInCategory(guild, name, parent) {
  let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name);
  if (!ch) ch = await guild.channels.create({ name, type: ChannelType.GuildText, parent: parent?.id });
  else if (parent && ch.parentId !== parent.id) await ch.setParent(parent.id).catch(() => {});
  return ch;
}
async function lockReadOnly(channel, guild, me) {
  try {
    if (!me.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) return;
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, AddReactions: false });
  } catch {}
}

/** Upsert: pin + Marker, sucht Pins + letzte 100 Nachrichten, keine Duplikate */
async function upsertBotMessage(channel, { content, embeds, components, marker }) {
  const pins = await channel.messages.fetchPinned().catch(() => null);
  const inPins = pins?.find(m => m.author?.id === channel.client.user.id && (m.content?.includes(marker) || m.embeds?.[0]?.footer?.text?.includes?.(marker)));

  let existing = inPins;
  if (!existing) {
    const fetched = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    existing = fetched?.find(m => m.author?.id === channel.client.user.id && m.content?.includes(marker));
  }

  const payload = {};
  if (content) payload.content = `${content}\n\n${marker}`;
  if (embeds) payload.embeds = embeds;
  if (components) payload.components = components;

  if (existing) return existing.edit(payload);
  const msg = await channel.send(payload);
  try { await msg.pin(); } catch {}
  return msg;
}

// ================= Embeds/Texte =================
function buildRulesEmbed() {
  return new EmbedBuilder()
    .setColor(0xDC143C)
    .setTitle('📜 Regeln – NBA2K DACH Community')
    .setDescription([
      '**Bitte haltet euch an diese Punkte:**',
      '1) **Respekt** – kein Toxic/Hate',
      '2) **Kein Spam/Promo** – Werbung nur mit Staff-Okay',
      '3) **Richtig posten** – passende Kanäle nutzen',
      '4) **Inhalte** – kein NSFW/Illegal/Leaks',
      '5) **Fairplay** – keine Cheats/Glitches',
      '6) **Namen/Avatare** – nichts Anstößiges',
      '7) **Mods/Admins** – Anweisungen befolgen',
      '⚠️ Sanktionen: Hinweis → Verwarnung → Timeout → Kick/Ban'
    ].join('\n'))
    .setFooter({ text: '[[BOT_RULES_V1]]' })
    .setTimestamp();
}
function buildAnnouncementsText() {
  return [
    'Willkommen im **#ankündigungen**-Kanal 📢',
    'Updates der Community: Turniere, Bot-Änderungen, Events.',
    'Klicke oben auf **„Folgen“**, um nichts zu verpassen.',
    'Nur Team/Mods posten hier.'
  ].join('\n');
}

// ================= Setup-Funktionen =================
async function postRoleMessage(channel) {
  // Plattformen
  await upsertBotMessage(channel, {
    content: '**Plattform wählen:**',
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('platform:ps5').setLabel(BUTTON_LABELS.platforms[0] || 'PS5').setStyle(ButtonStyle.Secondary).setEmoji('🎮'),
      new ButtonBuilder().setCustomId('platform:xbox').setLabel(BUTTON_LABELS.platforms[1] || 'Xbox').setStyle(ButtonStyle.Secondary).setEmoji('🎮'),
      new ButtonBuilder().setCustomId('platform:pc').setLabel(BUTTON_LABELS.platforms[2] || 'PC').setStyle(ButtonStyle.Secondary).setEmoji('💻'),
    )],
    marker: '[[BOT_ROLES_PLATFORM_V1]]'
  });

  // Positionen
  const posRow = new ActionRowBuilder();
  (BUTTON_LABELS.positions || BASE_ROLES.positions).forEach((p, idx) => {
    const id = (BASE_ROLES.positions[idx] || p).toLowerCase();
    posRow.addComponents(new ButtonBuilder().setCustomId(`position:${id}`).setLabel(p).setStyle(ButtonStyle.Secondary).setEmoji('🏀'));
  });
  await upsertBotMessage(channel, {
    content: '**Build-Position wählen:**',
    components: [posRow],
    marker: '[[BOT_ROLES_POSITION_V1]]'
  });

  // Styles
  const styleRow = new ActionRowBuilder();
  (BUTTON_LABELS.styles || BASE_ROLES.styles).forEach((s, idx) => {
    const id = (BASE_ROLES.styles[idx] || s).toLowerCase().replace(/[^\w]/g,'');
    styleRow.addComponents(new ButtonBuilder().setCustomId(`style:${id}`).setLabel(s).setStyle(ButtonStyle.Secondary).setEmoji('🧩'));
  });
  await upsertBotMessage(channel, {
    content: '**Spielstil/Modus wählen:**',
    components: [styleRow],
    marker: '[[BOT_ROLES_STYLE_V1]]'
  });

  // Länder (Pflicht)
  const cs = (BUTTON_LABELS.countries || BASE_ROLES.countries);
  const countryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('country:de').setLabel(cs[0] || 'Deutschland').setStyle(ButtonStyle.Primary).setEmoji('🇩🇪'),
    new ButtonBuilder().setCustomId('country:ch').setLabel(cs[1] || 'Schweiz').setStyle(ButtonStyle.Primary).setEmoji('🇨🇭'),
    new ButtonBuilder().setCustomId('country:at').setLabel(cs[2] || 'Österreich').setStyle(ButtonStyle.Primary).setEmoji('🇦🇹'),
  );
  await upsertBotMessage(channel, {
    content: '**Land wählen (Pflicht für Freischaltung):**',
    components: [countryRow],
    marker: '[[BOT_ROLES_COUNTRY_V1]]'
  });
}

async function createInfoAndButtons(guild) {
  const me = await guild.members.fetchMe();
  const infoCat = await ensureCategory(guild, BASE_ROLES.categoryInfo);
  const chRules  = await ensureTextInCategory(guild, BASE_ROLES.channelRules, infoCat);
  const chNews   = await ensureTextInCategory(guild, BASE_ROLES.channelNews,  infoCat);
  const chRoles  = await ensureTextInCategory(guild, BASE_ROLES.channelRoles, infoCat);
  const chVerify = await ensureTextInCategory(guild, BASE_ROLES.channelVerify,infoCat);

  await lockReadOnly(chRules, guild, me);
  await lockReadOnly(chNews,  guild, me);

  await upsertBotMessage(chRules, { embeds: [buildRulesEmbed()], marker: '[[BOT_RULES_V1]]' });
  await upsertBotMessage(chNews,  { content: buildAnnouncementsText(), marker: '[[BOT_NEWS_V1]]' });

  await ensureRole(guild, ROLE_ACCESS_NAME);
  await ensureRole(guild, ROLE_BLOCK_NAME);
  for (const r of [...BASE_ROLES.platforms, ...BASE_ROLES.countries, ...BASE_ROLES.positions, ...BASE_ROLES.styles]) {
    await ensureRole(guild, r);
  }

  await postRoleMessage(chRoles);

  await upsertBotMessage(chVerify, { content: VERIFY_TEXT, marker: '[[BOT_REP_VERIFY_INFO_V1]]' });

  return { chRoles, chVerify };
}

async function setupMediaOnly(guild) {
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error('Mir fehlt Kanäle verwalten');

  const cat = await ensureCategory(guild, BASE_ROLES.categoryMedia);
  const chClips = await ensureTextInCategory(guild, BASE_ROLES.channelClips,  cat);
  const chVods  = await ensureTextInCategory(guild, BASE_ROLES.channelVods,   cat);
  const chFotos = await ensureTextInCategory(guild, BASE_ROLES.channelPhotos, cat);

  try { await chClips.setRateLimitPerUser(BASE_ROLES.clipsSlowmodeSeconds ?? 60); } catch {}
  try { await chVods.permissionOverwrites.edit(guild.roles.everyone, { AttachFiles: false }); } catch {}

  await upsertBotMessage(chClips, { content: MEDIA_TEXT.clips, marker: '[[BOT_CLIPS_RULES_V1]]' });
  await upsertBotMessage(chVods,  { content: MEDIA_TEXT.vods,  marker: '[[BOT_VODS_RULES_V1]]' });

  await upsertBotMessage(chFotos, {
    content:
      '📌 **Fotos (NBA 2K)**\n' +
      '• Erlaubt: Gameplay-/Stat-/Build-Screens, Setups\n' +
      '• Keine Videos (→ #clips / #full-matches)\n' +
      '• Bitte Modus • Plattform • Build • REP dazuschreiben',
    marker: '[[BOT_PHOTOS_RULES_V1]]'
  });

  return { chClips, chVods, chFotos };
}

// ================= Mapping Buttons → Rollennamen =================
function mapCustomIdToRoleName(customId) {
  const [prefix, raw] = customId.split(':');

  if (prefix === 'platform') {
    const map = { ps5: BASE_ROLES.platforms[0], xbox: BASE_ROLES.platforms[1], pc: BASE_ROLES.platforms[2] };
    return map[raw];
  }
  if (prefix === 'position') {
    const idx = ['pg','sg','sf','pf','c'].indexOf(raw.toLowerCase());
    return BASE_ROLES.positions[idx] || BUTTON_LABELS.positions[idx];
  }
  if (prefix === 'style') {
    const norm = raw.toLowerCase();
    const base = BASE_ROLES.styles.map(s => s.toLowerCase().replace(/[^\w]/g,''));
    const idx = base.indexOf(norm);
    return BASE_ROLES.styles[idx] || BUTTON_LABELS.styles[idx];
  }
  if (prefix === 'country') {
    if (raw === 'de') return BASE_ROLES.countries[0];
    if (raw === 'ch') return BASE_ROLES.countries[1];
    if (raw === 'at') return BASE_ROLES.countries[2];
  }
  return null;
}

// ================= REP Helpers =================
const RANK_KEYS = Object.keys(REP.display);
const LEVELS = REP.levels;
const normRank = (t) => t.trim().toLowerCase().replaceAll('all star','all-star').replaceAll('allstar','all-star');

const findRoleByRankLevel = (guild, rankKey, level) => {
  const expected  = REP.makeRoleName(rankKey, level);
  const display   = `${REP.display[rankKey]} ${level}`;
  const displaySp = `${REP.display[rankKey].replace('-', ' ')} ${level}`;
  return guild.roles.cache.find(r => r.name === expected || r.name.endsWith(display) || r.name.endsWith(displaySp)) || null;
};

const isRepRoleName = (name) =>
  RANK_KEYS.some(rk =>
    LEVELS.some(lv => {
      const expected  = REP.makeRoleName(rk, lv);
      const display   = `${REP.display[rk]} ${lv}`;
      const displaySp = `${REP.display[rk].replace('-', ' ')} ${lv}`;
      return name === expected || name.endsWith(display) || name.endsWith(displaySp);
    })
  );

const removeAllRepRoles = async (member) => {
  const toRemove = member.roles.cache.filter(r => isRepRoleName(r.name));
  if (toRemove.size) await member.roles.remove([...toRemove.values()], 'REP update (only one active REP role)');
};

// ================= Onboarding: DM-Reminder Loop =================
async function scheduleReminderLoop(guild, userId, first = false) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const isMember = member.roles.cache.some(r => r.name === ROLE_ACCESS_NAME);
    if (isMember) return;

    const roleChannel = guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name.includes('rolle-zuweisen'));
    const text = first
      ? `👋 Willkommen auf **${guild.name}**! Bitte wähle dein **Land** in ${roleChannel ?? '#rolle-zuweisen'}, um alle Kanäle freizuschalten.`
      : `⏰ Erinnerung: Wähle bitte dein **Land** in ${roleChannel ?? '#rolle-zuweisen'}, damit du die Rolle **${ROLE_ACCESS_NAME}** erhältst.`;

    await member.send(text).catch(() => {});
    setTimeout(() => scheduleReminderLoop(guild, userId, false), REMIND_REPEAT_HOURS * 60 * 60 * 1000);
  } catch (e) {
    console.error('reminder loop error:', e);
  }
}

// ================= Welcome Embed + Button =================
async function sendWelcomeWithButton(member) {
  const guild = member.guild;

  const welcome = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildText && ch.name.toLowerCase().includes('willkommen')
  );
  const roleChannel = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildText && ch.name.toLowerCase().includes('rolle-zuweisen')
  );
  if (!welcome) return;

  // Duplikate vermeiden
  const recent = await welcome.messages.fetch({ limit: 20 }).catch(() => null);
  const already = recent?.find(m =>
    m.author?.id === guild.members.me.id &&
    m.content?.includes(`[[WLC:${member.id}]]`)
  );
  if (already) return;

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`👋 Willkommen ${member.user.username}!`)
    .setDescription(
      `Schön, dass du in der **${guild.name}** gelandet bist!\n\n` +
      `➡ Bitte wähle zuerst dein **Land** in ${roleChannel ?? '#rolle-zuweisen'}, um freigeschaltet zu werden.\n` +
      `Danach kannst du Plattform, Position & Spielstil hinzufügen.`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: 'NBA2K DACH Community' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('goto:roles')
      .setLabel('→ Rollen auswählen')
      .setStyle(ButtonStyle.Primary)
  );

  await welcome.send({
    content: `[[WLC:${member.id}]]`,
    embeds: [embed],
    components: [row]
  }).catch(() => {});
}

// ================= Countdown: einmalig in #ankündigungen posten =================
async function postReleaseCountdown(guild) {
  const releaseTimestamp = 1756490400; // 29.08.2025 18:00 MESZ
  const channel = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildText && ch.name.includes('ankündigungen')
  );
  if (!channel) return;

  // ✅ Marker gegen Doppelposts
  const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const already = recent?.find(m =>
    m.author?.id === guild.members.me.id &&
    m.content?.includes('[[COUNTDOWN_2K26]]')
  );
  if (already) return;

  const embed = new EmbedBuilder()
    .setColor(0x1d428a) // NBA Blau
    .setTitle('🏀 NBA2K26 Release Countdown')
    .setDescription(
      `📢 Offizieller Release: <t:${releaseTimestamp}:F>\n\n` +
      `⏳ **Countdown:** <t:${releaseTimestamp}:R>\n\n` +
      `🔥 Macht euch bereit für das nächste Kapitel in NBA2K!`
    )
    .setFooter({ text: 'NBA2K DACH Community' })
    .setThumbnail('https://upload.wikimedia.org/wikipedia/en/6/6f/NBA_2K_series_logo.png');

  await channel.send({
    content: '[[COUNTDOWN_2K26]]',
    embeds: [embed]
  }).catch(() => {});
}

// ================= Events =================
client.once('ready', async () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: 'NBA 2K DACH • /setup2k' }], status: 'online' });

  // Countdown automatisch in Ankündigungen posten (einmalig)
  for (const [, guild] of client.guilds.cache) {
    await postReleaseCountdown(guild);
  }
});

// Slash-Commands
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.isChatInputCommand()) return;

    // /setup2k – ganze Info-Struktur + Buttons + Verify-Text
    if (i.commandName === 'setup2k') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins dürfen /setup2k ausführen.', ephemeral: true });
      if (!i.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels))
        return i.reply({ content: '⛔ Mir fehlt **Kanäle verwalten**.', ephemeral: true });

      if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
      const { chRoles, chVerify } = await createInfoAndButtons(i.guild);
      try { await setupMediaOnly(i.guild); } catch {}
      return i.editReply(`✅ Setup aktualisiert.\n• Rollen-Buttons in ${chRoles}\n• Verifizierung in ${chVerify}`);
    }

    // /setuprep – nur Verifizierungskanal
    if (i.commandName === 'setuprep') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins dürfen /setuprep ausführen.', ephemeral: true });
      if (!i.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels))
        return i.reply({ content: '⛔ Mir fehlt **Kanäle verwalten**.', ephemeral: true });

      if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
      const infoCat  = await ensureCategory(i.guild, BASE_ROLES.categoryInfo);
      const chVerify = await ensureTextInCategory(i.guild, BASE_ROLES.channelVerify, infoCat);
      await upsertBotMessage(chVerify, { content: VERIFY_TEXT, marker: '[[BOT_REP_VERIFY_INFO_V1]]' });
      return i.editReply(`✅ REP-Verifizierungskanal eingerichtet: ${chVerify}`);
    }

    // /setupmedia – Clips/VODs/Fotos
    if (i.commandName === 'setupmedia') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins dürfen /setupmedia ausführen.', ephemeral: true });
      if (!i.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels))
        return i.reply({ content: '⛔ Mir fehlt **Kanäle verwalten**.', ephemeral: true });

      if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
      const { chClips, chVods, chFotos } = await setupMediaOnly(i.guild);
      return i.editReply(`✅ Media eingerichtet:\n• Clips: ${chClips}\n• Full-Matches: ${chVods}\n• Fotos: ${chFotos}`);
    }

    // /create_rep_roles – 30 REP-Rollen erzeugen
    if (i.commandName === 'create_rep_roles') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Dir fehlt **Administrator**.', ephemeral: true });

      const guild = i.guild;
      const template = guild.roles.cache.find(r => r.name === TEMPLATE_ROLE);
      if (!template) return i.reply({ content: `⚠️ Vorlage-Rolle **${TEMPLATE_ROLE}** nicht gefunden.`, ephemeral: true });

      if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
      let created = 0;
      for (const rk of RANK_KEYS) {
        for (const lv of LEVELS) {
          if (findRoleByRankLevel(guild, rk, lv)) continue;
          await guild.roles.create({
            name: REP.makeRoleName(rk, lv),
            permissions: template.permissions,
            color: template.color,
            hoist: true,
            reason: 'NBA2K25 REP setup'
          });
          created++;
        }
      }
      return i.editReply(`✅ REP-Rollen erstellt. Neu: **${created}**.`);
    }

    // /rep – Rolle setzen
    if (i.commandName === 'rep') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageRoles))
        return i.reply({ content: '⛔ Dir fehlt **Manage Roles**.', ephemeral: true });

      const user = i.options.getMember('user');
      const rankKey = normRank(i.options.getString('rank'));
      const level = parseInt(i.options.getString('level'), 10);

      if (!user) return i.reply({ content: '❌ User nicht gefunden.', ephemeral: true });
      if (!RANK_KEYS.includes(rankKey)) return i.reply({ content: '❌ Unbekannter Rang.', ephemeral: true });
      if (!LEVELS.includes(level)) return i.reply({ content: '❌ Stufe muss 1–5 sein.', ephemeral: true });

      const role = findRoleByRankLevel(i.guild, rankKey, level);
      if (!role) return i.reply({ content: `⚠️ Rolle **${REP.display[rankKey]} ${level}** existiert nicht. Erst /create_rep_roles ausführen.`, ephemeral: true });
      if (i.guild.members.me.roles.highest.comparePositionTo(role) <= 0)
        return i.reply({ content: '❌ Meine Bot-Rolle steht **unter** der Zielrolle.', ephemeral: true });

      if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
      await removeAllRepRoles(user);
      await user.roles.add(role, `Set REP to ${role.name}`);
      return i.editReply(`✅ ${user} ist jetzt **${role.name}**. (Andere REP-Rollen entfernt)`);
    }

    // /repclear – alle REP-Rollen entfernen
    if (i.commandName === 'repclear') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageRoles))
        return i.reply({ content: '⛔ Dir fehlt **Manage Roles**.', ephemeral: true });
      const user = i.options.getMember('user');
      if (!user) return i.reply({ content: '❌ User nicht gefunden.', ephemeral: true });
      await removeAllRepRoles(user);
      return i.reply({ content: `🧹 Alle REP-Rollen bei ${user} entfernt.`, ephemeral: true });
    }

  } catch (err) {
    console.error('interaction (command) error:', err);
    try { (i.deferred ? i.editReply : i.reply)({ content: '❌ Fehler bei der Ausführung.', ephemeral: true }); } catch {}
  }
});

// Buttons (Rollen & Navigation)
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.isButton()) return;
    const [prefix] = i.customId.split(':');

    if (prefix === 'goto') {
      const [, target] = i.customId.split(':');
      if (target === 'roles') {
        const roleChannel = i.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name.toLowerCase().includes('rolle-zuweisen'));
        return i.reply({ content: roleChannel ? `➡ Bitte wähle hier: ${roleChannel}` : '❌ Rollen-Kanal nicht gefunden.', flags: 64 });
      }
      if (target === 'repverify') {
        const repChannel = i.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name.toLowerCase().includes('rep-verifiz'));
        return i.reply({ content: repChannel ? `➡ Hier geht’s zur **REP-Verifizierung**: ${repChannel}` : '❌ Verifizierungskanal nicht gefunden.', flags: 64 });
      }
      return;
    }

    const roleName = mapCustomIdToRoleName(i.customId);
    if (!roleName) return i.reply({ content: 'Unbekannter Button.', flags: 64 });

    let role = i.guild.roles.cache.find(r => r.name === roleName);
    if (!role) role = await i.guild.roles.create({ name: roleName });

    const member = i.member;
    const hasRole = member.roles.cache.has(role.id);

    if (hasRole) {
      await member.roles.remove(role);
      return i.reply({ content: `❎ Rolle **${roleName}** entfernt.`, flags: 64 });
    }

    await member.roles.add(role);

    const [btnPrefix] = i.customId.split(':');
    if (btnPrefix === 'country') {
      const access = await ensureRole(i.guild, ROLE_ACCESS_NAME);
      await member.roles.add(access).catch(() => {});
      const block = i.guild.roles.cache.find(r => r.name.toLowerCase().includes('ohne') && r.name.toLowerCase().includes('rolle'));
      if (block) await member.roles.remove(block).catch(() => {});
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('goto:repverify').setLabel('➡ Zur REP-Verifizierung').setStyle(ButtonStyle.Primary)
      );
      return i.reply({ content: `✅ **${roleName}** gesetzt. Du bist freigeschaltet!\nHol dir jetzt deinen **REP-Rang** über den Button unten.`, components: [row], flags: 64 });
    }

    return i.reply({ content: `✅ Rolle **${roleName}** hinzugefügt.`, flags: 64 });
  } catch (err) {
    console.error('interaction (button) error:', err);
    try { await i.reply({ content: '❌ Fehler bei der Ausführung.', flags: 64 }); } catch {}
  }
});

// Auto-Reply im Verifizierungskanal (Screenshot erkannt)
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (msg.author.bot) return;
    if (msg.channel.type !== ChannelType.GuildText) return;

    const name = msg.channel.name.toLowerCase();
    if (!(name.includes('rep-verifiz'))) return;

    const hasAttachment = msg.attachments?.size > 0;
    const hasImageUrl = /(https?:\/\/\S+\.(png|jpe?g|gif|webp))/i.test(msg.content || '');
    if (!hasAttachment && !hasImageUrl) return;

    await msg.reply(
      '✅ **Screenshot erhalten!** Ein Mod prüft deinen REP und setzt dir die passende Rolle.\n' +
      'ℹ️ Mods: `/rep user:@Name rank:<Rookie|Starter|All-Star (Reserve)|Superstar (Reserve)|Veteran|Legend> level:<1–5>`'
    ).catch(() => {});
  } catch (e) {
    console.error('verify auto-reply error:', e);
  }
});

// VOD-Kanal: Dateiuploads abräumen (nur Links)
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (msg.author.bot) return;
    if (msg.channel.type !== ChannelType.GuildText) return;

    const vodName = BASE_ROLES.channelVods.toLowerCase().replace(/[^\w]/g,'');
    const chanMatch = msg.channel.name.toLowerCase().replace(/[^\w]/g,'').includes(vodName);
    if (!chanMatch) return;

    if (msg.attachments?.size > 0) {
      await msg.delete().catch(() => {});
      const warn = await msg.channel.send(`${msg.member}, bitte **nur Links** posten – Datei-Uploads sind in ${msg.channel} deaktiviert.`).catch(() => null);
      if (warn) setTimeout(() => warn.delete().catch(() => {}), 10000);
    }
  } catch (e) {
    console.error('vod auto-mod error:', e);
  }
});

// Fotos-Kanal: nur Bilder
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (msg.author.bot) return;
    if (msg.channel.type !== ChannelType.GuildText) return;

    const photosName = (BASE_ROLES.channelPhotos || '📷│fotos').toLowerCase().replace(/[^\w]/g,'');
    const chanOk = msg.channel.name.toLowerCase().replace(/[^\w]/g,'').includes(photosName);
    if (!chanOk) return;

    const hasImgAttach = [...msg.attachments.values()].some(a => (a.contentType || '').startsWith('image/'));
    const hasImgLink = /(https?:\/\/\S+\.(png|jpe?g|gif|webp))/i.test(msg.content || '');
    const hasNonImageAttach = msg.attachments.size > 0 && !hasImgAttach;

    if (hasNonImageAttach || (!hasImgAttach && !hasImgLink)) {
      await msg.delete().catch(() => {});
      const warn = await msg.channel.send(
        `${msg.member}, **nur NBA 2K-Bilder/Screenshots** sind in ${msg.channel} erlaubt. ` +
        `Für Videos nutze bitte **#${BASE_ROLES.channelClips}** oder **#${BASE_ROLES.channelVods}**.`
      ).catch(() => null);
      if (warn) setTimeout(() => warn.delete().catch(() => {}), 10000);
    }
  } catch (e) {
    console.error('photos auto-mod error:', e);
  }
});

// Onboarding – „Ohne Rolle“, Welcome-Embed + Reminder-Loop
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const guild = member.guild;

    const noRole = await ensureRole(guild, ROLE_BLOCK_NAME);
    await member.roles.add(noRole).catch(() => {});

    await sendWelcomeWithButton(member);

    setTimeout(() => scheduleReminderLoop(guild, member.id, true), REMIND_FIRST_MIN * 60 * 1000);

  } catch (err) {
    console.error('guildMemberAdd error:', err);
  }
});

client.login(TOKEN);
