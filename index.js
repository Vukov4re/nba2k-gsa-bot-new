import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events,
  ChannelType, PermissionFlagsBits, PermissionsBitField,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';

import {
  LFG_CHANNEL_NAME,
  LFG_VOICE_CATEGORY_NAME,
  LFG_DEFAULT_TTL_MIN,
  SQUAD_NAME_POOL
} from './config/squads.js';

import {
  BASE_ROLES, BUTTON_LABELS, REP, VERIFY_TEXT
} from './config/roles.js';

/* ===================== Client ===================== */
const TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
if (!TOKEN) { console.error('❌ Missing DISCORD_TOKEN/TOKEN'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,   // Privileged: im Dev-Portal aktivieren
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent  // Privileged: im Dev-Portal aktivieren
  ],
});

/* ===================== Utils ===================== */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function ensureTextChannel(guild, name, parentId=null) {
  let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name);
  if (!ch) ch = await guild.channels.create({ name, type: ChannelType.GuildText, parent: parentId || undefined });
  return ch;
}
async function ensureCategory(guild, name) {
  let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
  if (!cat) cat = await guild.channels.create({ name, type: ChannelType.GuildCategory });
  return cat;
}
async function findOrCreateRole(guild, name) {
  let r = guild.roles.cache.find(x => x.name === name);
  if (!r) r = await guild.roles.create({ name, mentionable: false });
  return r;
}

/* ===================== LFG Helpers ===================== */
function readStateFromEmbed(msg) {
  const footer = msg.embeds?.[0]?.footer?.text || '';
  const m = footer.match(/\[\[LFG:(.+)\]\]/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}
function writeStateToEmbed(embed, state) {
  embed.setFooter({ text: `[[LFG:${JSON.stringify(state)}]]` });
  return embed;
}
async function ensureLfgChannel(guild) {
  return ensureTextChannel(guild, LFG_CHANNEL_NAME);
}
async function ensureVoiceCategory(guild) {
  return ensureCategory(guild, LFG_VOICE_CATEGORY_NAME);
}
function renderLfgEmbed({ name, author, mode, platform, crossplay, positions, slots, joinedIds }) {
  const full = joinedIds.length >= slots;
  const title = full
    ? `🔒 [VOLL] ${name} – ${mode} (${platform}${crossplay ? ' • Crossplay' : ''})`
    : `🔎 ${name} – ${mode} (${platform}${crossplay ? ' • Crossplay' : ''})`;

  const desc = [
    `**Gesucht:** ${positions}`,
    `**Slots:** ${joinedIds.length}/${slots}`,
    `👤 **Host:** <@${author}>`
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(full ? 0x888888 : 0x00A86B)
    .setTitle(title)
    .setDescription(desc)
    .setTimestamp();

  embed.addFields({
    name: 'Teilnehmer',
    value: joinedIds.length ? joinedIds.map(id => `• <@${id}>`).join('\n') : '— noch frei —'
  });

  return embed;
}
function buildLfgRow(messageId, locked) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lfg:join:${messageId}`).setLabel('Beitreten').setStyle(ButtonStyle.Success).setDisabled(locked),
    new ButtonBuilder().setCustomId(`lfg:leave:${messageId}`).setLabel('Verlassen').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`lfg:close:${messageId}`).setLabel('Squad auflösen').setStyle(ButtonStyle.Danger)
  );
}
function isSquadNameTaken(guild, name) {
  return !!guild.roles.cache.find(r => r.name === name);
}
function normSquadName(input) {
  if (!input) return '';
  const s = input.trim();
  return s.toLowerCase().startsWith('squad ') ? s : `Squad ${s}`;
}
function isNameAllowed(name) {
  return SQUAD_NAME_POOL.includes(name);
}
async function reserveSquadName(guild, name) {
  return guild.roles.create({ name, hoist: false, mentionable: false, reason: 'LFG Squad' });
}
async function freeSquadResources(guild, state) {
  try {
    if (state.roleId) await guild.roles.delete(state.roleId).catch(() => {});
    if (state.voiceId) {
      const v = guild.channels.cache.get(state.voiceId);
      if (v) await v.delete().catch(() => {});
    }
  } catch {}
}
async function createPrivateVoiceIfFull(guild, state) {
  if (state.voiceId) return state;
  const cat = await ensureVoiceCategory(guild);
  const role = guild.roles.cache.get(state.roleId);
  if (!role) return state;

  const everyone = guild.roles.everyone;
  const voice = await guild.channels.create({
    name: state.name,
    type: ChannelType.GuildVoice,
    parent: cat.id,
    userLimit: state.slots,
    permissionOverwrites: [
      { id: everyone, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
      { id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }
    ]
  });

  state.voiceId = voice.id;
  return state;
}

/* ===================== Ready ===================== */
client.once('ready', () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: '🔎 /lfg – Squad-Suche' }], status: 'online' });
});

/* ===================== Autocomplete (squad_name) ===================== */
client.on(Events.InteractionCreate, async (i) => {
  if (!i.isAutocomplete()) return;
  try {
    if (i.commandName !== 'lfg' || i.options.getFocused(true).name !== 'squad_name') return;
    const q = (i.options.getFocused() || '').toLowerCase();
    const free = SQUAD_NAME_POOL.filter(n => !isSquadNameTaken(i.guild, n));
    const filtered = free.filter(n => n.toLowerCase().includes(q)).slice(0, 25);
    await i.respond(filtered.map(n => ({ name: n, value: n })));
  } catch {}
});

/* ===================== Slash Commands ===================== */
client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return;

  try {
    /* ---------- /setup2k ---------- */
    if (i.commandName === 'setup2k') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins dürfen /setup2k ausführen.', ephemeral: true });

      await i.deferReply({ ephemeral: true });

      // Kategorie & Kanäle
      const cat = await ensureCategory(i.guild, BASE_ROLES.categoryInfo);
      const chRules = await ensureTextChannel(i.guild, BASE_ROLES.channelRules, cat.id);
      const chNews  = await ensureTextChannel(i.guild, BASE_ROLES.channelNews,  cat.id);
      const chRoles = await ensureTextChannel(i.guild, BASE_ROLES.channelRoles, cat.id);

      // Rollen-Buttons vorbereiten
      const groups = [
        { key: 'platforms', label: 'Plattform', list: BUTTON_LABELS.platforms },
        { key: 'positions', label: 'Position',  list: BUTTON_LABELS.positions },
        { key: 'styles',    label: 'Spielstil', list: BUTTON_LABELS.styles },
        { key: 'countries', label: 'Land',      list: BUTTON_LABELS.countries },
      ];

      const rows = [];
      for (const g of groups) {
        // max 5 Buttons pro Reihe
        const chunk = (arr, n=5) => arr.reduce((a,_,i)=> (i%n? a[a.length-1].push(arr[i]):a.push([arr[i]]), a),[]);
        rows.push(...chunk(g.list).map(part => {
          const row = new ActionRowBuilder();
          row.addComponents(...part.map(v =>
            new ButtonBuilder()
              .setCustomId(`r:set:${g.key}:${v}`)
              .setLabel(v)
              .setStyle(ButtonStyle.Primary)
          ));
          return row;
        }));
      }
      // Clear-Button
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('r:clearall').setLabel('Alle Auswahl-Rollen entfernen').setStyle(ButtonStyle.Secondary)
      ));

      const text =
        '🎯 **Rollen auswählen**\n' +
        '• Wähle **Plattform, Position, Spielstil, Land** per Buttons unten.\n' +
        `• Nach der ersten Auswahl erhältst du automatisch die Rolle **${BASE_ROLES.accessRole}**.\n` +
        '• Deine Auswahl kannst du jederzeit ändern – pro Gruppe maximal **1 Rolle**.\n\n' +
        '_(Tipp: Danach kannst du im Kanal **🧾│rep-verifizierung** deinen 2K-REP eintragen lassen.)_';

      // vorhandene Bot-Nachricht upserten
      const recent = await chRoles.messages.fetch({ limit: 20 }).catch(()=>null);
      const old = recent?.find(m => m.author?.id === i.guild.members.me.id && m.content?.includes('[[ROLES_MSG]]'));
      if (old) {
        await old.edit({ content: `${text}\n\n[[ROLES_MSG]]`, components: rows });
      } else {
        await chRoles.send({ content: `${text}\n\n[[ROLES_MSG]]`, components: rows });
      }

      await i.editReply(`✅ Fertig: ${chRules} ${chNews} ${chRoles}`);
      return;
    }

    /* ---------- /setuprep ---------- */
    if (i.commandName === 'setuprep') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins dürfen /setuprep ausführen.', ephemeral: true });

      await i.deferReply({ ephemeral: true });

      const cat = await ensureCategory(i.guild, BASE_ROLES.categoryInfo);
      const chVerify = await ensureTextChannel(i.guild, BASE_ROLES.channelVerify, cat.id);

      const pinText = [
        '🧾 **REP-Verifizierung**',
        '1) Poste einen **Screenshot** deines aktuellen REP.',
        '2) Ein Mod prüft und setzt deinen Rang mit **/rep**.',
        '3) Bei Upgrade später einfach wieder Screenshot posten.',
        'ℹ️ Ränge: Rookie / Starter / All-Star (Reserve) / Superstar (Reserve) / Veteran / Legend (je Level 1–5).'
      ].join('\n');

      // upsert & pin marker
      const recent = await chVerify.messages.fetch({ limit: 20 }).catch(()=>null);
      const old = recent?.find(m => m.author?.id === i.guild.members.me.id && m.content?.includes('[[REP_PIN]]'));
      if (old) await old.edit(`${pinText}\n\n[[REP_PIN]]`); else await chVerify.send(`${pinText}\n\n[[REP_PIN]]`);

      await i.editReply(`✅ REP-Verifizierung eingerichtet: ${chVerify}`);
      return;
    }

    /* ---------- /setupmedia ---------- */
    if (i.commandName === 'setupmedia') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins dürfen /setupmedia ausführen.', ephemeral: true });

      await i.deferReply({ ephemeral: true });

      const cat = await ensureCategory(i.guild, '🎥 Media');
      const clips = await ensureTextChannel(i.guild, '🎬│clips', cat.id);
      const full  = await ensureTextChannel(i.guild, '📺│full-matches', cat.id);
      const fotos = await ensureTextChannel(i.guild, '📷│fotos', cat.id);

      const makePin = (kind) => [
        `📌 **${kind} Regeln**`,
        '• Nur NBA2K Content (Gameplay, Highlights).',
        '• Keine Beleidigungen, kein Spam.',
        '• Achtet auf sinnvolle Titel/Beschreibung.'
      ].join('\n');

      const upsertPin = async (channel, marker) => {
        const r = await channel.messages.fetch({ limit: 20 }).catch(()=>null);
        const old = r?.find(m => m.author?.id === i.guild.members.me.id && m.content?.includes(marker));
        if (old) await old.edit(`${makePin(channel.name)}\n\n${marker}`);
        else await channel.send(`${makePin(channel.name)}\n\n${marker}`);
      };

      await upsertPin(clips, '[[MEDIA_CLIPS]]');
      await upsertPin(full,  '[[MEDIA_FULL]]');
      await upsertPin(fotos, '[[MEDIA_FOTOS]]');

      await i.editReply(`✅ Media-Kanäle: ${clips} ${full} ${fotos}`);
      return;
    }

    /* ---------- /create_rep_roles ---------- */
    if (i.commandName === 'create_rep_roles') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins.', ephemeral: true });

      await i.deferReply({ ephemeral: true });

      const created = [];
      for (const key of Object.keys(REP.display)) {
        for (const lvl of REP.levels) {
          const name = REP.makeRoleName(key, lvl);
          const r = await findOrCreateRole(i.guild, name);
          created.push(r.name);
        }
      }
      await i.editReply(`✅ REP-Rollen sichergestellt (${created.length}).`);
      return;
    }

    /* ---------- /rep ---------- */
    if (i.commandName === 'rep') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageRoles))
        return i.reply({ content: '⛔ Nur Mods dürfen /rep.', ephemeral: true });

      const user = i.options.getUser('user', true);
      const rankKey = i.options.getString('rank', true);
      const level = i.options.getString('level', true);

      await i.deferReply({ ephemeral: true });
      const member = await i.guild.members.fetch(user.id).catch(()=>null);
      if (!member) return i.editReply('❌ Nutzer nicht gefunden.');

      // alte REP-Rollen entfernen
      const repRoleNames = [];
      for (const key of Object.keys(REP.display)) {
        for (const lvl of REP.levels) repRoleNames.push(REP.makeRoleName(key, lvl));
      }
      const toRemove = member.roles.cache.filter(r => repRoleNames.includes(r.name));
      for (const r of toRemove.values()) await member.roles.remove(r).catch(()=>{});

      // neue Rolle sicherstellen und vergeben
      const targetName = REP.makeRoleName(rankKey, level);
      const target = await findOrCreateRole(i.guild, targetName);
      await member.roles.add(target).catch(()=>{});

      await i.editReply(`✅ ${member} → **${target.name}** gesetzt (alte REP-Rollen entfernt).`);
      return;
    }

    /* ---------- /repclear ---------- */
    if (i.commandName === 'repclear') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageRoles))
        return i.reply({ content: '⛔ Nur Mods dürfen /repclear.', ephemeral: true });

      const user = i.options.getUser('user', true);
      await i.deferReply({ ephemeral: true });
      const member = await i.guild.members.fetch(user.id).catch(()=>null);
      if (!member) return i.editReply('❌ Nutzer nicht gefunden.');

      const repRoleNames = [];
      for (const key of Object.keys(REP.display)) {
        for (const lvl of REP.levels) repRoleNames.push(REP.makeRoleName(key, lvl));
      }
      const toRemove = member.roles.cache.filter(r => repRoleNames.includes(r.name));
      for (const r of toRemove.values()) await member.roles.remove(r).catch(()=>{});

      await i.editReply(`✅ REP-Rollen bei ${member} entfernt.`);
      return;
    }

    /* ---------- /setuplfg ---------- */
    if (i.commandName === 'setuplfg') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins dürfen /setuplfg ausführen.', ephemeral: true });

      await i.deferReply({ ephemeral: true });
      const ch = await ensureLfgChannel(i.guild);

      const pinText = [
        '📌 **So funktioniert die Squad-Suche**',
        '• **/lfg**: Modus, Plattform, Slots',
        '• **Optional**:',
        '  – **squad_name**: freien Namen aus der Liste wählen (Autocomplete, z. B. „Squad Mamba“)',
        '  – **crossplay**: PS5/Xbox gemeinsam zulassen (✅/❌)',
        '• **Beitreten/Verlassen** per Button',
        '• Wenn **voll** → [VOLL], **privater Voice** in „🎤 Squads“ + **privater Thread**',
        '• **Auflösen**: Host/Mods beenden den Squad (Rolle/Voice wird gelöscht, Thread archiviert)',
        `• Standard-Ablauf: **${LFG_DEFAULT_TTL_MIN} Minuten**`,
        '• Bitte respektvoll bleiben, kein Spam'
      ].join('\n');

      const recent = await ch.messages.fetch({ limit: 20 }).catch(() => null);
      const already = recent?.find(m => m.author?.id === i.guild.members.me.id && m.content?.includes('[[LFG_PIN]]'));
      if (already) await already.edit(`${pinText}\n\n[[LFG_PIN]]`); else await ch.send(`${pinText}\n\n[[LFG_PIN]]`);

      return i.editReply(`✅ LFG-Kanal eingerichtet: ${ch}`);
    }

    /* ---------- /lfg ---------- */
    if (i.commandName === 'lfg') {
      const mode = i.options.getString('modus', true);
      const platform = i.options.getString('plattform', true);
      const crossplay = i.options.getBoolean('crossplay') ?? false;
      const positions = i.options.getString('positionen', true);
      const slots = i.options.getInteger('slots', true);
      const note = i.options.getString('notiz') || '';
      const ttlMin = i.options.getInteger('ttl_minutes') ?? LFG_DEFAULT_TTL_MIN;

      const raw = i.options.getString('squad_name') || '';
      let name = raw ? normSquadName(raw) : '';
      if (name) {
        if (!isNameAllowed(name)) return i.reply({ content: `❌ **${name}** ist kein erlaubter Squad-Name.`, ephemeral: true });
        if (isSquadNameTaken(i.guild, name)) return i.reply({ content: `❌ **${name}** ist bereits vergeben.`, ephemeral: true });
      } else {
        name = SQUAD_NAME_POOL.find(n => !isSquadNameTaken(i.guild, n));
        if (!name) return i.reply({ content: '❌ Alle Squad-Namen sind aktuell vergeben. Bitte später erneut versuchen.', ephemeral: true });
      }

      await i.deferReply({ ephemeral: true });

      const role = await reserveSquadName(i.guild, name);
      const host = await i.guild.members.fetch(i.user.id).catch(() => null);
      if (host) await host.roles.add(role).catch(() => {});

      const ch = await ensureLfgChannel(i.guild);
      const joined = [i.user.id];

      const base = { name, author: i.user.id, mode, platform, crossplay, positions, slots };
      const embed = renderLfgEmbed({ ...base, joinedIds: joined });
      const state = { ...base, joined, roleId: role.id, voiceId: null, threadId: null, ttlMin };

      writeStateToEmbed(embed, state);

      const post = await ch.send({ embeds: [embed], components: [buildLfgRow('pending', false)] });
      await post.edit({ components: [buildLfgRow(post.id, false)] });

      // öffentlicher Thread solange nicht voll
      const thread = await post.startThread({ name: `[${mode}] ${name} chat`, autoArchiveDuration: 1440 }).catch(() => null);
      state.threadId = thread?.id || null;
      const upd = renderLfgEmbed({ ...base, joinedIds: joined });
      writeStateToEmbed(upd, state);
      await post.edit({ embeds: [upd] });

      await i.editReply(`✅ **${name}** ist live: ${post.url}${thread ? ` (Thread: ${thread})` : ''}${note ? `\n📝 ${note}` : ''}`);

      // TTL Ablauf
      setTimeout(async () => {
        try {
          const msg = await ch.messages.fetch(post.id).catch(() => null);
          if (!msg) return;
          const cur = readStateFromEmbed(msg);
          if (!cur) return;

          const emb = renderLfgEmbed({ ...cur, joinedIds: cur.joined });
          emb.setColor(0x777777).setTitle(`⏲️ [ABGELAUFEN] ${cur.name} – ${cur.mode} (${cur.platform}${cur.crossplay ? ' • Crossplay' : ''})`);
          writeStateToEmbed(emb, cur);
          await msg.edit({ embeds: [emb], components: [buildLfgRow(post.id, true)] });

          if (cur.threadId) {
            const thr = i.guild.channels.cache.get(cur.threadId);
            await thr?.setArchived(true).catch(() => {});
            await thr?.setLocked(true).catch(() => {});
          }
          await freeSquadResources(i.guild, cur);
        } catch {}
      }, ttlMin * 60 * 1000);

      return;
    }

  } catch (err) {
    console.error('interaction (command) error:', err);
    try { (i.deferred ? i.editReply : i.reply)({ content: '❌ Fehler bei der Ausführung.', ephemeral: true }); } catch {}
  }
});

/* ===================== Buttons (Rollen & LFG) ===================== */
client.on(Events.InteractionCreate, async (i) => {
  if (!i.isButton()) return;

  try {
    const id = i.customId;

    /* ----- Rollen-Buttons ----- */
    if (id === 'r:clearall') {
      const groups = ['platforms','positions','styles','countries'];
      const allNames = groups.flatMap(k => BUTTON_LABELS[k]);
      const toRemove = i.member.roles.cache.filter(r => allNames.includes(r.name));
      for (const r of toRemove.values()) await i.member.roles.remove(r).catch(()=>{});
      return i.reply({ content: '✅ Deine Auswahl-Rollen wurden entfernt.', ephemeral: true });
    }
    if (id.startsWith('r:set:')) {
      const [, , group, value] = id.split(':'); // r:set:group:value
      if (!BUTTON_LABELS[group] || !BUTTON_LABELS[group].includes(value)) {
        return i.reply({ content: '❌ Ungültige Auswahl.', ephemeral: true });
      }
      // pro Gruppe nur 1 Rolle
      const groupNames = BUTTON_LABELS[group];
      const remove = i.member.roles.cache.filter(r => groupNames.includes(r.name));
      for (const r of remove.values()) await i.member.roles.remove(r).catch(()=>{});
      const role = await findOrCreateRole(i.guild, value);
      await i.member.roles.add(role).catch(()=>{});

      // Zugang geben
      if (BASE_ROLES.accessRole) {
        const access = await findOrCreateRole(i.guild, BASE_ROLES.accessRole);
        await i.member.roles.add(access).catch(()=>{});
      }
      return i.reply({ content: `✅ Rolle gesetzt: **${value}**`, ephemeral: true });
    }

    /* ----- LFG-Buttons ----- */
    if (!id.startsWith('lfg:')) return;

    const [, action, msgId] = id.split(':');
    const msg = await i.channel.messages.fetch(msgId).catch(() => null);
    if (!msg) return i.reply({ content: '❌ LFG-Beitrag nicht gefunden.', flags: 64 });

    const state = readStateFromEmbed(msg);
    if (!state) return i.reply({ content: '❌ Ungültiger LFG-Status.', flags: 64 });

    const guild = i.guild;
    const role = guild.roles.cache.get(state.roleId);
    const member = i.member;
    const isHost = i.user.id === state.author;
    const isMod = i.memberPermissions.has(PermissionsBitField.Flags.ManageMessages);

    const joined = new Set(state.joined || []);
    const isFull = joined.size >= state.slots;

    if (action === 'join') {
      if (joined.has(i.user.id)) return i.reply({ content: 'Du bist bereits in diesem Squad.', flags: 64 });
      if (isFull) return i.reply({ content: 'Dieser Squad ist bereits voll.', flags: 64 });
      joined.add(i.user.id);
      if (role) await member.roles.add(role).catch(() => {});
    }
    if (action === 'leave') {
      if (!joined.has(i.user.id)) return i.reply({ content: 'Du bist in diesem Squad nicht eingetragen.', flags: 64 });
      joined.delete(i.user.id);
      if (role) await member.roles.remove(role).catch(() => {});
    }
    if (action === 'close') {
      if (!isHost && !isMod) return i.reply({ content: 'Nur der Ersteller oder Mods dürfen auflösen.', flags: 64 });

      const emb = renderLfgEmbed({ ...state, joinedIds: [...joined] })
        .setColor(0x888888)
        .setTitle(`🔒 [AUFGELÖST] ${state.name} – ${state.mode} (${state.platform}${state.crossplay ? ' • Crossplay' : ''})`);
      writeStateToEmbed(emb, state);
      await msg.edit({ embeds: [emb], components: [buildLfgRow(msg.id, true)] });

      if (state.threadId) {
        const thr = guild.channels.cache.get(state.threadId);
        await thr?.setArchived(true).catch(() => {});
        await thr?.setLocked(true).catch(() => {});
      }
      await freeSquadResources(guild, state);
      return i.reply({ content: '🔒 Squad aufgelöst.', flags: 64 });
    }

    // bei "voll" → privaten Voice & privaten Thread
    const newState = { ...state, joined: [...joined] };
    const nowFull = newState.joined.length >= newState.slots;

    if (nowFull && !state.voiceId) {
      await createPrivateVoiceIfFull(guild, newState);

      const privThread = await i.channel.threads.create({
        name: `[${newState.mode}] ${newState.name} private`,
        autoArchiveDuration: 1440,
        type: ChannelType.PrivateThread
      }).catch(() => null);

      if (privThread) {
        newState.threadId = privThread.id;
        for (const uid of newState.joined) {
          await privThread.members.add(uid).catch(() => {});
        }
      }
      if (state.threadId) {
        const old = guild.channels.cache.get(state.threadId);
        await old?.setArchived(true).catch(() => {});
        await old?.setLocked(true).catch(() => {});
      }
    }

    const emb = renderLfgEmbed({ ...newState, joinedIds: newState.joined });
    writeStateToEmbed(emb, newState);
    await msg.edit({ embeds: [emb], components: [buildLfgRow(msg.id, newState.joined.length >= newState.slots)] });

    return i.reply({ content: (action === 'join' ? '✅ Beigetreten.' : '✅ Verlassen.'), flags: 64 });

  } catch (err) {
    console.error('interaction (button) error:', err);
    try { await i.reply({ content: '❌ Fehler bei der Ausführung.', flags: 64 }); } catch {}
  }
});

/* ===================== Nachrichten-Hooks (REP-Channel) ===================== */
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (!msg.guild || msg.author.bot) return;
    // Wenn im REP-Verify Channel ein Bild gepostet wird → kurze Bestätigung
    if (msg.channel.name === BASE_ROLES.channelVerify.replace(/^[^a-zA-Z0-9]+/, '')) return; // falls Prefix-Emoji abweicht, kannst du den Check anpassen
    if (msg.channel.name === BASE_ROLES.channelVerify) {
      if (msg.attachments.size > 0) {
        const isImage = [...msg.attachments.values()].some(a => (a.contentType||'').startsWith('image/'));
        if (isImage) {
          await msg.reply('✅ Danke! Ein Moderator prüft deinen Screenshot und setzt deinen REP mit **/rep**.');
        }
      }
    }
  } catch {}
});

/* ===================== Start ===================== */
client.login(TOKEN);
