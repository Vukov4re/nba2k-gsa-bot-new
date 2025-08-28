// index.js — Haupt-Bot (ESM / discord.js v14)
import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Events,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import { BASE_ROLES, BUTTON_LABELS, REP, VERIFY_TEXT, MEDIA_TEXT } from './config/roles.js';

/* =========================
   Konfiguration / Konstanten
   ========================= */
const TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
if (!TOKEN) {
  console.error('❌ ENV DISCORD_TOKEN/TOKEN fehlt.');
  process.exit(1);
}

// Kanal-/Rollen-Namen (so wie bei dir)
const NAMES = {
  categoryInfo: '📢 Info & Regeln',
  channelRules: '📜│regeln',
  channelNews: '📢│ankündigungen',
  channelWelcome: '👋│willkommen',
  channelRoles: '🎯│rolle-zuweisen',
  channelVerify: '🧾│rep-verifizierung',

  mediaClips: '📹│clips',
  mediaFullMatches: '🎥│full-matches',
  mediaFotos: '📸│fotos',

  roleAccess: BASE_ROLES.accessRole || 'Mitglied',
  roleBlocked: 'Ohne Rolle',
};

// Reminder-Einstellungen (optional, klein gehalten)
const REMIND_FIRST_MIN = 30;
const REMIND_REPEAT_HOURS = 24;

/* =============
   Discord Client
   ============= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,   // Dev-Portal: "Server Members Intent" aktivieren
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Dev-Portal: "Message Content Intent" aktivieren
  ],
});

/* ===============
   Hilfsfunktionen
   =============== */
function findTextChannel(guild, needle) {
  const n = needle.toLowerCase();
  return guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && c.name.toLowerCase().includes(n)
  ) || null;
}

async function ensureRole(guild, name) {
  let r = guild.roles.cache.find(x => x.name === name);
  if (!r) r = await guild.roles.create({ name }).catch(() => null);
  return r;
}

/** fügt Nachricht an oder editiert (Marker), optional pin */
async function upsertMessage(channel, { content, embed, embeds, components, marker, pin }) {
  const fetched = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  let existing = fetched?.find(
    m => m.author?.id === channel.client.user.id && (m.content?.includes(marker) || m.embeds?.[0]?.footer?.text?.includes?.(marker))
  );

  const payload = {};
  if (content) payload.content = `${content}\n\n${marker}`;
  if (embed && !embeds) payload.embeds = [embed];
  if (embeds) payload.embeds = embeds;
  if (components) payload.components = components;

  let msg;
  if (existing) {
    msg = await existing.edit(payload).catch(() => null);
  } else {
    msg = await channel.send(payload).catch(() => null);
    if (pin && msg) await msg.pin().catch(() => {});
  }
  return msg;
}

/* ===========================
   Willkommen + Button (Join)
   =========================== */
async function sendWelcomeWithButton(member) {
  const guild = member.guild;
  const welcome = findTextChannel(guild, 'willkommen');
  const rolesCh = findTextChannel(guild, 'rolle-zuweisen');
  if (!welcome) return;

  // Duplikate vermeiden
  const recent = await welcome.messages.fetch({ limit: 20 }).catch(() => null);
  const already = recent?.find(m =>
    m.author?.id === guild.members.me.id && m.content?.includes(`[[WLC:${member.id}]]`)
  );
  if (already) return;

  const roleMention = rolesCh ? `<#${rolesCh.id}>` : '`#rolle-zuweisen`';

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`👋 Willkommen ${member.user.username}!`)
    .setDescription(
      `Schön, dass du in der **${guild.name}** gelandet bist!\n\n` +
      `➡ Bitte wähle zuerst dein **Land** in ${roleMention}, um freigeschaltet zu werden.\n` +
      `Danach kannst du Plattform, Position & Spielstil hinzufügen.\n\n` +
      `NBA2K DACH Community`
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: 'NBA2K DACH Community' });

  const row = rolesCh ? new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('→ Rollen auswählen')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${guild.id}/${rolesCh.id}`)
  ) : null;

  await welcome.send({
    content: `[[WLC:${member.id}]]`,
    embeds: [embed],
    components: row ? [row] : [],
  }).catch(() => {});
}

/* ============================
   Rollen-Auswahl /setup2k
   ============================ */
/** baut Button-Reihen für eine Liste */
function buildButtonsRow(group, labels) {
  const rows = [];
  const chunk = (arr, size) => arr.reduce((r, v, i) => (i % size ? r[r.length - 1].push(v) : r.push([v]), r), []);
  const chunks = chunk(labels, 5);
  for (const line of chunks) {
    const row = new ActionRowBuilder();
    for (const label of line) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role:${group}:${label}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }
  return rows;
}

/** postet/editiert das Rollen-Board im #rolle-zuweisen */
async function postRolesBoard(guild) {
  const ch = findTextChannel(guild, 'rolle-zuweisen');
  if (!ch) throw new Error('Rollenkanal nicht gefunden.');

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Rollen wählen')
    .setDescription(
      `Plattform, Position & Spielstil wählen.\n` +
      `**Wichtig:** **Land** zuerst wählen (Pflicht) – erst dann wirst du freigeschaltet.\n\n` +
      `• Plattform → **ein oder mehrere**\n` +
      `• Position → **mehrere möglich**\n` +
      `• Spielstil/Modus → **mehrere möglich**\n` +
      `• Land (Pflicht) → **genau eins**\n`
    )
    .setFooter({ text: '[[ROLES_BOARD]]' });

  const components = [
    ...buildButtonsRow('platform', BUTTON_LABELS.platforms || BASE_ROLES.platforms),
    ...buildButtonsRow('position', BUTTON_LABELS.positions || BASE_ROLES.positions),
    ...buildButtonsRow('style', BUTTON_LABELS.styles || BASE_ROLES.styles),
    ...buildButtonsRow('country', BUTTON_LABELS.countries || BASE_ROLES.countries),
  ];

  await upsertMessage(ch, {
    content: 'Rollen-Auswahl',
    embed,
    components,
    marker: '[[ROLES_BOARD]]',
    pin: false,
  });
}

/** Button-Handler: Rollen vergeben/entfernen */
async function handleRoleButton(i) {
  if (!i.customId?.startsWith('role:')) return false;
  const [, group, value] = i.customId.split(':'); // role:group:value
  const guild = i.guild;
  const member = await guild.members.fetch(i.user.id).catch(() => null);
  if (!member) return true;

  // Stelle sicher, dass es die Zielrolle gibt
  const targetRole = await ensureRole(guild, value);

  // Gruppen-Logik
  if (group === 'country') {
    // genau EINE: alle anderen Länder entfernen
    for (const name of BASE_ROLES.countries) {
      const r = guild.roles.cache.find(x => x.name === name);
      if (r && member.roles.cache.has(r.id) && r.id !== targetRole.id) {
        await member.roles.remove(r).catch(() => {});
      }
    }
    await member.roles.add(targetRole).catch(() => {});

    // Zugriff freigeben: Mitglied + Ohne Rolle entfernen
    const access = await ensureRole(guild, NAMES.roleAccess);
    await member.roles.add(access).catch(() => {});
    const blocked = guild.roles.cache.find(r => r.name === NAMES.roleBlocked);
    if (blocked) await member.roles.remove(blocked).catch(() => {});
    await i.reply({ content: `✅ Land gesetzt: **${value}**. Du bist freigeschaltet.`, ephemeral: true });
  } else if (group === 'platform' || group === 'position' || group === 'style') {
    // toggle
    if (member.roles.cache.has(targetRole.id)) {
      await member.roles.remove(targetRole).catch(() => {});
      await i.reply({ content: `➖ Rolle entfernt: **${value}**`, ephemeral: true });
    } else {
      await member.roles.add(targetRole).catch(() => {});
      await i.reply({ content: `➕ Rolle hinzugefügt: **${value}**`, ephemeral: true });
    }
  } else {
    await i.reply({ content: '❔ Unbekannte Rollen-Gruppe.', ephemeral: true });
  }
  return true;
}

/* ==========================
   REP-System (Rollenstufen)
   ========================== */
function allRepRoleNames() {
  const arr = [];
  const rankKeys = Object.keys(REP.display);
  for (const rk of rankKeys) {
    for (const lvl of REP.levels) arr.push(REP.makeRoleName(rk, lvl));
  }
  return arr;
}
function repRoleName(rankKey, level) {
  return REP.makeRoleName(rankKey, level);
}

/** /create_rep_roles – legt alle REP-Rollen an (1-5) */
async function createAllRepRoles(guild) {
  let created = 0;
  for (const rk of Object.keys(REP.display)) {
    for (const lvl of REP.levels) {
      const name = repRoleName(rk, lvl);
      if (!guild.roles.cache.find(r => r.name === name)) {
        await guild.roles.create({ name }).catch(() => null);
        created++;
      }
    }
  }
  return created;
}

/** /rep – setzt REP Rolle (ersetzt alte REP) */
async function setRepRole(guild, member, rankKey, level) {
  const name = repRoleName(rankKey, level);
  const dest = await ensureRole(guild, name);

  // alle anderen REP-Rollen entfernen
  for (const n of allRepRoleNames()) {
    const r = guild.roles.cache.find(x => x.name === n);
    if (r && member.roles.cache.has(r.id) && r.id !== dest.id) {
      await member.roles.remove(r).catch(() => {});
    }
  }
  await member.roles.add(dest).catch(() => {});
}

/* =========================
   /setuprep & /setupmedia
   ========================= */
async function postRepVerifyBoard(guild) {
  const ch = findTextChannel(guild, 'rep-verifizierung');
  if (!ch) throw new Error('rep-verifizierung Kanal fehlt.');
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('🧾 REP-Verifizierung')
    .setDescription(VERIFY_TEXT)
    .setFooter({ text: '[[REP_BOARD]]' });

  await upsertMessage(ch, {
    content: 'Infos zur REP-Verifizierung',
    embed,
    marker: '[[REP_BOARD]]',
    pin: true,
  });
}

async function postMediaBoards(guild) {
  const clips = findTextChannel(guild, 'clips');
  const full = findTextChannel(guild, 'full-matches');
  const fotos = findTextChannel(guild, 'fotos');

  const mk = async (ch, title, desc, marker) => {
    if (!ch) return;
    const embed = new EmbedBuilder().setColor(0x95a5a6).setTitle(title).setDescription(desc).setFooter({ text: marker });
    await upsertMessage(ch, { content: title, embed, marker, pin: true });
  };

  await mk(clips, '🎬 Clips posten', MEDIA_TEXT?.clips || 'Poste kurze Highlights/Clips.');
  await mk(full, '🎞 Full Matches', MEDIA_TEXT?.full || 'Poste ganze Matches. Spoiler wenn nötig.');
  await mk(fotos, '📸 Fotos', MEDIA_TEXT?.photos || 'Zeig Builds, Statlines, Memes zum Spiel.');
}

/* ==================================
   Auto-Antwort im REP-Kanal (Screenshot)
   ================================== */
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (msg.author.bot || !msg.guild) return;
    const chName = msg.channel?.name?.toLowerCase?.() || '';
    if (!chName.includes('rep-verifizierung')) return;
    if (!msg.attachments?.size) return;

    const isImg = [...msg.attachments.values()].some(a => (a.contentType || '').startsWith('image/'));
    if (!isImg) return;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Screenshot erhalten!')
      .setDescription(
        `Ein Mod prüft deinen REP und setzt dir die passende Rolle.\n` +
        `ℹ️ Mods: \`/rep user:@Name rank:<${Object.values(REP.display).join('|')}> level:<1–5>\``
      );
    await msg.reply({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error('MessageCreate error:', err);
  }
});

/* ==================================
   Slash Commands Handler
   ================================== */
client.on(Events.InteractionCreate, async (i) => {
  try {
    // Buttons (Rollen)
    if (i.isButton()) {
      const handled = await handleRoleButton(i);
      if (handled) return;
    }

    if (!i.isChatInputCommand()) return;

    // ===== /setup2k =====
    if (i.commandName === 'setup2k') {
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
        return i.reply({ content: '❌ Nur Admins/Mods.', ephemeral: true });
      await i.deferReply({ ephemeral: true });

      await postRolesBoard(i.guild);
      await i.editReply('✅ Rollen-Board aktualisiert.');
    }

    // ===== /setuprep =====
    else if (i.commandName === 'setuprep') {
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
        return i.reply({ content: '❌ Nur Admins/Mods.', ephemeral: true });
      await i.deferReply({ ephemeral: true });

      await postRepVerifyBoard(i.guild);
      await i.editReply('✅ REP-Verifizierung eingerichtet.');
    }

    // ===== /setupmedia =====
    else if (i.commandName === 'setupmedia') {
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
        return i.reply({ content: '❌ Nur Admins/Mods.', ephemeral: true });
      await i.deferReply({ ephemeral: true });

      await postMediaBoards(i.guild);
      await i.editReply('✅ Media-Kanäle eingerichtet.');
    }

    // ===== /create_rep_roles =====
    else if (i.commandName === 'create_rep_roles') {
      if (!i.memberPermissions?.has(PermissionFlagsBits.Administrator))
        return i.reply({ content: '❌ Nur Admins.', ephemeral: true });
      await i.deferReply({ ephemeral: true });

      const n = await createAllRepRoles(i.guild);
      await i.editReply(`✅ REP-Rollen erstellt. Neu: **${n}**.`);
    }

    // ===== /rep =====
    else if (i.commandName === 'rep') {
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageRoles))
        return i.reply({ content: '❌ Nur Mods.', ephemeral: true });
      await i.deferReply({ ephemeral: true });

      const user = i.options.getMember('user', true);
      const rank = i.options.getString('rank', true);    // Schlüssel wie in REP.display key
      const level = i.options.getInteger('level', true); // 1..5

      await setRepRole(i.guild, user, rank, level);
      await i.editReply(`✅ REP gesetzt: **${REP.display[rank]} ${level}** für ${user}.`);
    }

    // ===== /repclear =====
    else if (i.commandName === 'repclear') {
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageRoles))
        return i.reply({ content: '❌ Nur Mods.', ephemeral: true });
      await i.deferReply({ ephemeral: true });

      const user = i.options.getMember('user', true);
      for (const n of allRepRoleNames()) {
        const r = i.guild.roles.cache.find(x => x.name === n);
        if (r && user.roles.cache.has(r.id)) await user.roles.remove(r).catch(() => {});
      }
      await i.editReply(`✅ REP-Rollen für ${user} entfernt.`);
    }

    // ===== /announce =====
    else if (i.commandName === 'announce') {
      if (!i.memberPermissions?.has(PermissionFlagsBits.Administrator))
        return i.reply({ content: '❌ Nur Admins.', ephemeral: true });

      await i.deferReply({ ephemeral: true });
      const ch    = i.options.getChannel('channel', true);
      const title = i.options.getString('titel', true);
      const body  = i.options.getString('nachricht', true);
      const emoji = i.options.getString('emoji') || '📢';

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${title}`)
        .setDescription(`${body}\n\n@everyone`)
        .setColor(0xff0000)
        .setTimestamp();

      const sent = await ch.send({ content: '@everyone', embeds: [embed] });
      await sent.pin().catch(() => {});
      await i.editReply(`✅ Ankündigung in ${ch} gepostet und angepinnt.`);
    }

  } catch (err) {
    console.error('interaction error:', err);
    try { await i.reply({ content: '❌ Fehler bei der Ausführung.', ephemeral: true }); } catch {}
  }
});

/* ==================================
   Onboarding – Rolle & Welcome
   ================================== */
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const noRole = await ensureRole(member.guild, NAMES.roleBlocked);
    await member.roles.add(noRole).catch(() => {});
    await sendWelcomeWithButton(member);

    // kleiner Reminder nach 30 Min (nur wenn noch ohne "Mitglied")
    setTimeout(async () => {
      try {
        const access = member.guild.roles.cache.find(r => r.name === NAMES.roleAccess);
        if (!access) return;
        const fresh = await member.guild.members.fetch(member.id).catch(() => null);
        if (fresh && !fresh.roles.cache.has(access.id)) {
          await fresh.send(
            `👋 Denk an die Rollen-Auswahl in **${member.guild.name}**. ` +
            `Wähle zuerst dein **Land** in #rolle-zuweisen, dann Plattform/Position/Spielstil.`
          ).catch(() => {});
        }
      } catch {}
    }, REMIND_FIRST_MIN * 60 * 1000);

  } catch (err) {
    console.error('guildMemberAdd error:', err);
  }
});

/* ===== Ready ===== */
client.once(Events.ClientReady, () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: 'NBA2K DACH • /setup2k' }], status: 'online' });
});

/* ===== Login ===== */
client.login(TOKEN);
