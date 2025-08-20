import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events,
  ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, PermissionsBitField
} from 'discord.js';

// Token aus DISCORD_TOKEN oder TOKEN
const TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
const TEMPLATE_ROLE = process.env.TEMPLATE_ROLE || 'REP-Vorlage';

if (!TOKEN) {
  console.error('❌ Missing DISCORD_TOKEN/TOKEN');
  process.exit(1);
}

// Client mit Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages, // für auto-Reply im Verifizierungskanal
    GatewayIntentBits.MessageContent  // optional, falls du Text prüfen willst
  ],
});

/* ---------- Helpers (Allgemein) ---------- */
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
    const canManage = me.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels);
    if (!canManage) return;
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, AddReactions: false });
  } catch {}
}

/* ---------- Upsert für Nachrichten (verhindert Dopplungen) ---------- */
async function upsertBotMessage(channel, { content, embeds, components, marker }) {
  // 1) Pins durchsuchen (bleiben länger sichtbar)
  const pins = await channel.messages.fetchPinned().catch(() => null);
  const inPins = pins?.find(m => m.author?.id === channel.client.user.id && (m.content?.includes(marker) || m.embeds?.[0]?.footer?.text?.includes?.(marker)));

  // 2) Neuere Nachrichten durchsuchen (erweitert auf 100)
  let existing = inPins;
  if (!existing) {
    const fetched = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    existing = fetched?.find(m => m.author?.id === channel.client.user.id && m.content?.includes(marker));
  }

  const payload = {};
  if (content) payload.content = `${content}\n\n${marker}`;
  if (embeds) payload.embeds = embeds;
  if (components) payload.components = components;

  if (existing) {
    return existing.edit(payload);
  } else {
    const msg = await channel.send(payload);
    try { await msg.pin(); } catch {}
    return msg;
  }
}

/* ---------- Embeds für /setup2k ---------- */
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
    .setFooter({ text: 'NBA2K DACH Community • Be fair. Be team.  [[BOT_RULES_V1]]' }) // Marker zusätzlich in Footer
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

/* ---------- Struktur (für /setup2k) ---------- */
async function createInfoAndButtons(guild) {
  const me = await guild.members.fetchMe();

  // Kategorie & festen Kanäle sicherstellen
  const infoCat = await ensureCategory(guild, '📢 Info & Regeln');
  const chRules = await ensureTextInCategory(guild, '📜│regeln', infoCat);
  const chNews  = await ensureTextInCategory(guild, '📢│ankündigungen', infoCat);

  // Rolle-zuweisen & Verifizierung als eigene Kanäle (außerhalb oder unter Info-Kat, wie du willst)
  const chRoles = await ensureTextInCategory(guild, '🎯│rolle-zuweisen', infoCat);
  const chVerify = await ensureTextInCategory(guild, '🧾│rep-verifizierung', infoCat);

  // Schreibschutz für Regeln/News
  await lockReadOnly(chRules, guild, me);
  await lockReadOnly(chNews, guild, me);

  // Regeln & News upserten
  await upsertBotMessage(chRules, {
    embeds: [buildRulesEmbed()],
    marker: '[[BOT_RULES_V1]]'
  });
  await upsertBotMessage(chNews, {
    content: buildAnnouncementsText(),
    marker: '[[BOT_NEWS_V1]]'
  });

  // Standard-Rollen sicherstellen
  await ensureRole(guild, 'Mitglied');
  for (const r of ['PS5','Xbox','PC','Deutschland','Schweiz','Österreich','PG','SG','SF','PF','C','Casual','Comp/Pro-Am','MyCareer','Park/Rec','MyTeam']) {
    await ensureRole(guild, r);
  }

  // Rollen-Buttons in genau diesem Kanal upserten
  await postRoleMessage(chRoles);

  // Verifizierungs-Hinweis in genau diesem Kanal upserten
  await upsertBotMessage(chVerify, {
    content:
      '📌 **So bekommst du deinen REP-Rang:**\n' +
      '1) Poste hier einen **Screenshot** deines aktuellen REP.\n' +
      '2) Ein Mod prüft und setzt deinen Rang mit `/rep`.\n' +
      '3) Bei Upgrade später einfach wieder Screenshot posten.\n\n' +
      'ℹ️ Mods: `/rep user:@Name rank:<Rookie|Pro|All-Star|Superstar|Elite|Legend> level:<1–5>`',
    marker: '[[BOT_REP_VERIFY_INFO_V1]]'
  });

  return { chRules, chNews, chRoles, chVerify };
}

function buildButtonsRow(items, prefix) {
  const row = new ActionRowBuilder();
  for (const { id, label, emoji } of items) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${prefix}:${id}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emoji)
    );
  }
  return row;
}

async function postRoleMessage(channel) {
  await upsertBotMessage(channel, {
    content: '**Plattform wählen:**',
    components: [buildButtonsRow(
      [{id:'ps5',label:'PS5',emoji:'🎮'},{id:'xbox',label:'Xbox',emoji:'🎮'},{id:'pc',label:'PC',emoji:'💻'}],
      'platform'
    )],
    marker: '[[BOT_ROLES_PLATFORM_V1]]'
  });

  await upsertBotMessage(channel, {
    content: '**Build-Position wählen:**',
    components: [buildButtonsRow(
      [{id:'pg',label:'PG',emoji:'🏀'},{id:'sg',label:'SG',emoji:'🏀'},{id:'sf',label:'SF',emoji:'🏀'},{id:'pf',label:'PF',emoji:'🏀'},{id:'c',label:'C',emoji:'🏀'}],
      'position'
    )],
    marker: '[[BOT_ROLES_POSITION_V1]]'
  });

  await upsertBotMessage(channel, {
    content: '**Spielstil/Modus wählen:**',
    components: [buildButtonsRow(
      [{id:'casual',label:'Casual',emoji:'😎'},{id:'comp',label:'Comp/Pro-Am',emoji:'🏆'},{id:'mycareer',label:'MyCareer',emoji:'⏳'},{id:'parkrec',label:'Park/Rec',emoji:'🌆'},{id:'myteam',label:'MyTeam',emoji:'🃏'}],
      'style'
    )],
    marker: '[[BOT_ROLES_STYLE_V1]]'
  });

  const countryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('country:de').setLabel('Deutschland').setStyle(ButtonStyle.Primary).setEmoji('🇩🇪'),
    new ButtonBuilder().setCustomId('country:ch').setLabel('Schweiz').setStyle(ButtonStyle.Primary).setEmoji('🇨🇭'),
    new ButtonBuilder().setCustomId('country:at').setLabel('Österreich').setStyle(ButtonStyle.Primary).setEmoji('🇦🇹'),
  );

  await upsertBotMessage(channel, {
    content: '**Land wählen (Pflicht für Freischaltung):**',
    components: [countryRow],
    marker: '[[BOT_ROLES_COUNTRY_V1]]'
  });
}

/* ---------- Mapping für Buttons ---------- */
function mapCustomIdToRoleName(customId) {
  const [prefix, id] = customId.split(':');
  if (prefix === 'platform') return id === 'pc' ? 'PC' : id.toUpperCase();
  if (prefix === 'position') return id.toUpperCase();
  if (prefix === 'style') {
    if (id === 'casual') return 'Casual';
    if (id === 'comp') return 'Comp/Pro-Am';
    if (id === 'mycareer') return 'MyCareer';
    if (id === 'parkrec') return 'Park/Rec';
    if (id === 'myteam') return 'MyTeam';
  }
  if (prefix === 'country') {
    if (id === 'de') return 'Deutschland';
    if (id === 'ch') return 'Schweiz';
    if (id === 'at') return 'Österreich';
  }
  return null;
}

/* ---------- REP-System ---------- */
const EMOJI_BY_RANK = {
  'rookie': '🟢',
  'pro': '🔵',
  'all-star': '🟣',
  'superstar': '🟠',
  'elite': '🔴',
  'legend': '🟡'
};
const RANK_ORDER = ['rookie','pro','all-star','superstar','elite','legend'];
const LEVELS = [1,2,3,4,5];

const normRank = (t) => t.trim().toLowerCase()
  .replaceAll('all star', 'all-star')
  .replaceAll('allstar', 'all-star');

const capitalize = (s) => s.split('-').map(p => p.charAt(0).toUpperCase()+p.slice(1)).join('-');

const makeRoleName = (rankKey, level) => `${EMOJI_BY_RANK[rankKey]} ${capitalize(rankKey)} ${level}`;

const findRoleByRankLevel = (guild, rankKey, level) => {
  const hyphen = `${capitalize(rankKey)} ${level}`;
  const space  = `${capitalize(rankKey).replace('-', ' ')} ${level}`;
  return guild.roles.cache.find(r => r.name.endsWith(hyphen) || r.name.endsWith(space)) || null;
};

const isRepRoleName = (name) =>
  RANK_ORDER.some(r =>
    LEVELS.some(lv =>
      name.endsWith(`${capitalize(r)} ${lv}`) || name.endsWith(`${capitalize(r).replace('-', ' ')} ${lv}`)
    )
  );

const removeAllRepRoles = async (member) => {
  const toRemove = member.roles.cache.filter(r => isRepRoleName(r.name));
  if (toRemove.size) {
    await member.roles.remove([...toRemove.values()], 'REP update (only one active REP role)');
  }
};

/* ---------- Events ---------- */
client.once('ready', () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: 'NBA 2K DACH • /setup2k' }], status: 'online' });
});

// Slash-Commands
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'setup2k') {
      // Rechte-Check (global): Kanäle verwalten + im Ziel später senden
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
        return i.reply({ content: '⛔ Nur Admins dürfen /setup2k ausführen.', ephemeral: true });
      }
      if (!i.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return i.reply({ content: '⛔ Mir fehlt **Kanäle verwalten** (für Setup).', ephemeral: true });
      }

      if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
      const { chRoles, chVerify } = await createInfoAndButtons(i.guild);

      return i.editReply(`✅ Setup aktualisiert.\n• Rollen-Buttons in ${chRoles}\n• Verifizierung in ${chVerify}`);
    }

    if (i.commandName === 'create_rep_roles') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
        return i.reply({ content: '⛔ Dir fehlt **Administrator**.', ephemeral: true });
      }
      const guild = i.guild;
      const template = guild.roles.cache.find(r => r.name === TEMPLATE_ROLE);
      if (!template) {
        return i.reply({ content: `⚠️ Vorlage-Rolle **${TEMPLATE_ROLE}** nicht gefunden.`, ephemeral: true });
      }
      await i.deferReply({ ephemeral: true });
      let created = 0;
      for (const r of RANK_ORDER) {
        for (const lv of LEVELS) {
          if (findRoleByRankLevel(guild, r, lv)) continue;
          await guild.roles.create({
            name: makeRoleName(r, lv),
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
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return i.reply({ content: '⛔ Dir fehlt **Manage Roles**.', ephemeral: true });
      }
      const user = i.options.getMember('user');
      const rankKey = normRank(i.options.getString('rank'));
      const level = parseInt(i.options.getString('level'), 10);

      if (!user) return i.reply({ content: '❌ User nicht gefunden.', ephemeral: true });
      if (!RANK_ORDER.includes(rankKey)) return i.reply({ content: '❌ Unbekannter Rang.', ephemeral: true });
      if (!LEVELS.includes(level)) return i.reply({ content: '❌ Stufe muss 1–5 sein.', ephemeral: true });

      const role = findRoleByRankLevel(i.guild, rankKey, level);
      if (!role) {
        return i.reply({ content: `⚠️ Rolle **${capitalize(rankKey)} ${level}** existiert nicht. Führe zuerst /create_rep_roles aus.`, ephemeral: true });
      }
      if (i.guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
        return i.reply({ content: '❌ Meine Bot-Rolle steht **unter** der Zielrolle.', ephemeral: true });
      }

      await i.deferReply({ ephemeral: true });
      await removeAllRepRoles(user);
      await user.roles.add(role, `Set REP to ${role.name}`);
      return i.editReply(`✅ ${user} ist jetzt **${role.name}**. (Andere REP-Rollen entfernt)`);
    }

    if (i.commandName === 'repclear') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return i.reply({ content: '⛔ Dir fehlt **Manage Roles**.', ephemeral: true });
      }
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

// Button-Interaktionen
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.isButton()) return;
    const [prefix] = i.customId.split(':');
    if (prefix === 'goto') {
      const roleChannel = i.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name.includes('rolle-zuweisen'));
      return i.reply({ content: roleChannel ? `➡ Bitte wähle hier: ${roleChannel}` : '❌ Rollen-Kanal nicht gefunden.', flags: 64 });
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
    if (prefix === 'country') {
      const access = await ensureRole(i.guild, 'Mitglied');
      await member.roles.add(access).catch(() => {});
      const block = i.guild.roles.cache.find(r => r.name.toLowerCase().includes('ohne') && r.name.toLowerCase().includes('rolle'));
      if (block) await member.roles.remove(block).catch(() => {});
      return i.reply({ content: `✅ **${roleName}** gesetzt. Du bist freigeschaltet!\nWähle optional noch weitere Rollen.`, flags: 64 });
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

    // Kanalname enthält "rep-verifiz" oder "rep-verfiz" (Tippfehler-tolerant)
    const name = msg.channel.name.toLowerCase();
    if (!(name.includes('rep-verifiz'))) return;

    // Nur reagieren, wenn ein Attachment oder Bild-Link dabei ist
    const hasAttachment = msg.attachments?.size > 0;
    const hasImageUrl = /(https?:\/\/\S+\.(png|jpe?g|gif|webp))/i.test(msg.content || '');
    if (!hasAttachment && !hasImageUrl) return;

    await msg.reply(
      '✅ **Screenshot erhalten!** Ein Mod prüft deinen REP und setzt dir die passende Rolle.\n' +
      'ℹ️ Mods: `/rep user:@Name rank:<Rookie|Pro|All-Star|Superstar|Elite|Legend> level:<1–5>`'
    ).catch(() => {});
  } catch (e) {
    console.error('verify auto-reply error:', e);
  }
});

client.login(TOKEN);
