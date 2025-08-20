import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events,
  ChannelType, PermissionFlagsBitField, // NOTE: diese BitField-Klasse
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, PermissionsBitField
} from 'discord.js';
import { BASE_ROLES, BUTTON_LABELS, REP, VERIFY_TEXT } from './config/roles.js';

// Token
const TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
const TEMPLATE_ROLE = process.env.TEMPLATE_ROLE || 'REP-Vorlage';

if (!TOKEN) {
  console.error('❌ Missing DISCORD_TOKEN/TOKEN');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

/* ---------- Helpers ---------- */
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
    const canManage = me.permissionsIn(channel).has(PermissionFlagsBitField.Flags.ManageChannels);
    if (!canManage) return;
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, AddReactions: false });
  } catch {}
}
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

/* ---------- Embeds ---------- */
function buildRulesEmbed() {
  return new EmbedBuilder()
    .setColor(0xDC143C)
    .setTitle('📜 Regeln – NBA2K DACH Community')
    .setDescription([
      '**Willkommen! Bitte halte dich an diese Regeln, damit es für alle angenehm bleibt.**',
      '',
      '1️⃣ **Respekt & Umgangston** — kein Toxic/Hassrede',
      '2️⃣ **Kein Spam/Flood** — Werbung nur mit Genehmigung',
      '3️⃣ **Team-Suche & Builds** — passende Kanäle nutzen',
      '4️⃣ **Voice-Chat** — kein Trollen, ggf. Push-to-Talk',
      '5️⃣ **Inhalte** — keine illegalen/NSFW/Urheberrechtsverstöße',
      '6️⃣ **Namen & Avatare** — nichts Unangemessenes',
      '7️⃣ **Admins & Mods** — Anweisungen befolgen',
      '8️⃣ **Fairplay** — kein Cheating/Glitches',
      '',
      '⚠️ Verstöße: Verwarnung, Mute, Kick oder Bann. Viel Spaß! 🏀🇩🇪🇨🇭🇦🇹'
    ].join('\n'))
    .setFooter({ text: 'NBA2K DACH Community • Be fair. Be team.  [[BOT_RULES_V1]]' })
    .setTimestamp();
}
function buildAnnouncementsText() {
  return [
    'Willkommen im **#ankündigungen**-Kanal 📢',
    'Updates der **NBA2K DACH Community**:',
    '• Turniere • Bot-Updates • Community-Events • Regeländerungen',
    '',
    '📲 Tipp: Klicke oben auf „Folgen“, um nichts zu verpassen!',
    '👀 Nur Admins/Mods können hier posten.'
  ].join('\n');
}

/* ---------- Setup-Funktionen ---------- */
async function createInfoAndButtons(guild) {
  const me = await guild.members.fetchMe();
  const infoCat = await ensureCategory(guild, BASE_ROLES.categoryInfo);
  const chRules = await ensureTextInCategory(guild, BASE_ROLES.channelRules, infoCat);
  const chNews  = await ensureTextInCategory(guild, BASE_ROLES.channelNews,  infoCat);
  const chRoles = await ensureTextInCategory(guild, BASE_ROLES.channelRoles, infoCat);
  const chVerify= await ensureTextInCategory(guild, BASE_ROLES.channelVerify,infoCat);

  await lockReadOnly(chRules, guild, me);
  await lockReadOnly(chNews,  guild, me);

  await upsertBotMessage(chRules, { embeds: [buildRulesEmbed()], marker: '[[BOT_RULES_V1]]' });
  await upsertBotMessage(chNews,  { content: buildAnnouncementsText(),  marker: '[[BOT_NEWS_V1]]' });

  // Rollen sicherstellen
  await ensureRole(guild, BASE_ROLES.accessRole);
  for (const r of [...BASE_ROLES.platforms, ...BASE_ROLES.countries, ...BASE_ROLES.positions, ...BASE_ROLES.styles]) {
    await ensureRole(guild, r);
  }

  // Buttons in Rollen-Kanal
  await postRoleMessage(chRoles);

  // Verifizierungs-Hinweis
  await upsertBotMessage(chVerify, { content: VERIFY_TEXT, marker: '[[BOT_REP_VERIFY_INFO_V1]]' });

  return { chRoles, chVerify };
}

async function setupRepOnly(guild) {
  const infoCat = await ensureCategory(guild, BASE_ROLES.categoryInfo);
  const chVerify= await ensureTextInCategory(guild, BASE_ROLES.channelVerify, infoCat);
  await upsertBotMessage(chVerify, { content: VERIFY_TEXT, marker: '[[BOT_REP_VERIFY_INFO_V1]]' });
  return chVerify;
}

/* ---------- Buttons ---------- */
function buildButtonsRow(items, prefix) {
  const row = new ActionRowBuilder();
  for (const { id, label, emoji } of items) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`${prefix}:${id}`).setLabel(label).setStyle(ButtonStyle.Secondary).setEmoji(emoji)
    );
  }
  return row;
}
async function postRoleMessage(channel) {
  // Plattform
  await upsertBotMessage(channel, {
    content: '**Plattform wählen:**',
    components: [buildButtonsRow(
      [
        { id: 'ps5',  label: BUTTON_LABELS.platforms[0] || 'PS5',  emoji: '🎮' },
        { id: 'xbox', label: BUTTON_LABELS.platforms[1] || 'Xbox', emoji: '🎮' },
        { id: 'pc',   label: BUTTON_LABELS.platforms[2] || 'PC',   emoji: '💻'  },
      ],
      'platform'
    )],
    marker: '[[BOT_ROLES_PLATFORM_V1]]'
  });

  // Position
  await upsertBotMessage(channel, {
    content: '**Build-Position wählen:**',
    components: [buildButtonsRow(
      (BUTTON_LABELS.positions || BASE_ROLES.positions).map((p, idx) => ({
        id: (BASE_ROLES.positions[idx] || p).toLowerCase(),
        label: p, emoji: '🏀'
      })),
      'position'
    )],
    marker: '[[BOT_ROLES_POSITION_V1]]'
  });

  // Style
  await upsertBotMessage(channel, {
    content: '**Spielstil/Modus wählen:**',
    components: [buildButtonsRow(
      (BUTTON_LABELS.styles || BASE_ROLES.styles).map((s, idx) => ({
        id: (BASE_ROLES.styles[idx] || s).toLowerCase().replace(/[^\w]/g,''),
        label: s, emoji: '🧩'
      })),
      'style'
    )],
    marker: '[[BOT_ROLES_STYLE_V1]]'
  });

  // Länder
  const countries = (BUTTON_LABELS.countries || BASE_ROLES.countries);
  const countryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('country:de').setLabel(countries[0] || 'Deutschland').setStyle(ButtonStyle.Primary).setEmoji('🇩🇪'),
    new ButtonBuilder().setCustomId('country:ch').setLabel(countries[1] || 'Schweiz').setStyle(ButtonStyle.Primary).setEmoji('🇨🇭'),
    new ButtonBuilder().setCustomId('country:at').setLabel(countries[2] || 'Österreich').setStyle(ButtonStyle.Primary).setEmoji('🇦🇹'),
  );
  await upsertBotMessage(channel, {
    content: '**Land wählen (Pflicht für Freischaltung):**',
    components: [countryRow],
    marker: '[[BOT_ROLES_COUNTRY_V1]]'
  });
}

/* ---------- Mapping Buttons → Rollennamen aus Config ---------- */
function mapCustomIdToRoleName(customId) {
  const [prefix, raw] = customId.split(':');

  if (prefix === 'platform') {
    const map = { ps5: BASE_ROLES.platforms[0], xbox: BASE_ROLES.platforms[1], pc: BASE_ROLES.platforms[2] };
    return map[raw];
  }

  if (prefix === 'position') {
    // raw = 'pg' | 'sg' | ...
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

/* ---------- REP Helpers ---------- */
const RANK_KEYS = Object.keys(REP.display);
const LEVELS = REP.levels;

const normRank = (t) => t.trim().toLowerCase().replaceAll('all star','all-star').replaceAll('allstar','all-star');

const findRoleByRankLevel = (guild, rankKey, level) => {
  // akzeptiere beide Schreibweisen im Server (mit/ohne Emoji, mit/ohne Bindestrich)
  const expected = REP.makeRoleName(rankKey, level);
  const display   = `${REP.display[rankKey]} ${level}`;
  const displaySp = `${REP.display[rankKey].replace('-', ' ')} ${level}`;
  return guild.roles.cache.find(r =>
    r.name === expected || r.name.endsWith(display) || r.name.endsWith(displaySp)
  ) || null;
};

const isRepRoleName = (name) =>
  RANK_KEYS.some(rk =>
    LEVELS.some(lv => {
      const expected = REP.makeRoleName(rk, lv);
      const display   = `${REP.display[rk]} ${lv}`;
      const displaySp = `${REP.display[rk].replace('-', ' ')} ${lv}`;
      return name === expected || name.endsWith(display) || name.endsWith(displaySp);
    })
  );

const removeAllRepRoles = async (member) => {
  const toRemove = member.roles.cache.filter(r => isRepRoleName(r.name));
  if (toRemove.size) await member.roles.remove([...toRemove.values()], 'REP update (only one active REP role)');
};

/* ---------- Events ---------- */
client.once('ready', () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: 'NBA 2K DACH • /setup2k' }], status: 'online' });
});

// Slash Commands
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'setup2k') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins dürfen /setup2k ausführen.', ephemeral: true });
      if (!i.guild.members.me.permissions.has(PermissionFlagsBitField.Flags.ManageChannels))
        return i.reply({ content: '⛔ Mir fehlt **Kanäle verwalten**.', ephemeral: true });

      if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
      const { chRoles, chVerify } = await createInfoAndButtons(i.guild);
      return i.editReply(`✅ Setup aktualisiert.\n• Rollen-Buttons in ${chRoles}\n• Verifizierung in ${chVerify}`);
    }

    if (i.commandName === 'setuprep') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins dürfen /setuprep ausführen.', ephemeral: true });
      if (!i.guild.members.me.permissions.has(PermissionFlagsBitField.Flags.ManageChannels))
        return i.reply({ content: '⛔ Mir fehlt **Kanäle verwalten**.', ephemeral: true });

      if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
      const chVerify = await setupRepOnly(i.guild);
      return i.editReply(`✅ REP-Verifizierungskanal eingerichtet: ${chVerify}`);
    }

    if (i.commandName === 'create_rep_roles') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Dir fehlt **Administrator**.', ephemeral: true });

      const guild = i.guild;
      const template = guild.roles.cache.find(r => r.name === TEMPLATE_ROLE);
      if (!template) return i.reply({ content: `⚠️ Vorlage-Rolle **${TEMPLATE_ROLE}** nicht gefunden.`, ephemeral: true });

      await i.deferReply({ ephemeral: true });
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

      await i.deferReply({ ephemeral: true });
      await removeAllRepRoles(user);
      await user.roles.add(role, `Set REP to ${role.name}`);
      return i.editReply(`✅ ${user} ist jetzt **${role.name}**. (Andere REP-Rollen entfernt)`);
    }

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

// Button-Interaktionen (Roles)
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.isButton()) return;
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

    if (i.customId.startsWith('country:')) {
      const access = await ensureRole(i.guild, BASE_ROLES.accessRole);
      await member.roles.add(access).catch(() => {});
      return i.reply({ content: `✅ **${roleName}** gesetzt. Du bist freigeschaltet!`, flags: 64 });
    }
    return i.reply({ content: `✅ Rolle **${roleName}** hinzugefügt.`, flags: 64 });
  } catch (err) {
    console.error('interaction (button) error:', err);
    try { await i.reply({ content: '❌ Fehler bei der Ausführung.', flags: 64 }); } catch {}
  }
});

/* ---------- Auto-Reply im Verifizierungskanal ---------- */
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (msg.author.bot) return;
    if (msg.channel.type !== ChannelType.GuildText) return;
    const name = msg.channel.name.toLowerCase();
    const verifyName = BASE_ROLES.channelVerify.toLowerCase().replace(/[^\w]/g,'');
    if (!name.replace(/[^\w]/g,'').includes(verifyName)) return;

    const hasAttachment = msg.attachments?.size > 0;
    const hasImageUrl = /(https?:\/\/\S+\.(png|jpe?g|gif|webp))/i.test(msg.content || '');
    if (!hasAttachment && !hasImageUrl) return;

    await msg.reply('✅ **Screenshot erhalten!** Ein Mod prüft deinen REP und setzt dir die passende Rolle.\n' +
      'ℹ️ Mods: `/rep user:@Name rank:<Rookie|Pro|All-Star|Superstar|Elite|Legend> level:<1–5>`'
    ).catch(() => {});
  } catch (e) {
    console.error('verify auto-reply error:', e);
  }
});

client.once('ready', () => console.log('✅ Bot bereit'));
client.login(TOKEN);
