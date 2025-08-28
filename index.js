// index.js – NBA2K DACH Bot (Rollen + REP + Media + LFG Light)
import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events,
  ChannelType, PermissionFlagsBits, PermissionsBitField,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder
} from 'discord.js';


/* ================== Client ================== */
const TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
if (!TOKEN) {
  console.error('❌ ENV fehlt: DISCORD_TOKEN oder TOKEN');
  process.exit(1);
}
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,   // Welcome & Rollen
    GatewayIntentBits.GuildMessages,  // REP-Screenshot & LFG
  ],
});

/* ================== Helpers ================== */
async function ensureRole(guild, name) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) role = await guild.roles.create({ name, mentionable: false });
  return role;
}
async function ensureCategory(guild, name) {
  let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
  if (!cat) cat = await guild.channels.create({ name, type: ChannelType.GuildCategory });
  return cat;
}
async function ensureText(guild, name, parentId = null) {
  let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name);
  if (!ch) ch = await guild.channels.create({ name, type: ChannelType.GuildText, parent: parentId || undefined });
  return ch;
}
async function lockReadOnly(channel, guild, me) {
  try {
    const canManage = me.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels);
    if (!canManage) return;
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, AddReactions: false });
  } catch {}
}

/* ================== Inhalte ================== */
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
    .setFooter({ text: 'NBA2K DACH Community • Be fair. Be team.' })
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

/* ================== Rollen-Setup ================== */
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
  await channel.send({
    content: '**Plattform wählen:**',
    components: [buildButtonsRow(
      [{ id: 'ps5', label: 'PS5', emoji: '🎮' }, { id: 'xbox', label: 'Xbox', emoji: '🎮' }, { id: 'pc', label: 'PC', emoji: '💻' }],
      'platform'
    )],
  });
  await channel.send({
    content: '**Build-Position wählen:**',
    components: [buildButtonsRow(
      [{ id: 'pg', label: 'PG', emoji: '🏀' }, { id: 'sg', label: 'SG', emoji: '🏀' }, { id: 'sf', label: 'SF', emoji: '🏀' }, { id: 'pf', label: 'PF', emoji: '🏀' }, { id: 'c', label: 'C', emoji: '🏀' }],
      'position'
    )],
  });
  await channel.send({
    content: '**Spielstil/Modus wählen:**',
    components: [buildButtonsRow(
      [{ id: 'casual', label: 'Casual', emoji: '😎' }, { id: 'comp', label: 'Comp/Pro-Am', emoji: '🏆' }, { id: 'mycareer', label: 'MyCareer', emoji: '⏳' }, { id: 'parkrec', label: 'Park/Rec', emoji: '🌆' }, { id: 'myteam', label: 'MyTeam', emoji: '🃏' }],
      'style'
    )],
  });

  const countryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('country:de').setLabel('Deutschland').setStyle(ButtonStyle.Primary).setEmoji('🇩🇪'),
    new ButtonBuilder().setCustomId('country:ch').setLabel('Schweiz').setStyle(ButtonStyle.Primary).setEmoji('🇨🇭'),
    new ButtonBuilder().setCustomId('country:at').setLabel('Österreich').setStyle(ButtonStyle.Primary).setEmoji('🇦🇹'),
  );
  await channel.send({ content: '**Land wählen (Pflicht für Freischaltung):**', components: [countryRow] });
}

async function createInfoAndButtons(guild, targetChannel) {
  const me = await guild.members.fetchMe();
  const info = await ensureCategory(guild, '📢 Info & Regeln');
  const chRules = await ensureText(guild, '📜│regeln', info.id);
  const chNews  = await ensureText(guild, '📢│ankündigungen', info.id);

  await lockReadOnly(chRules, guild, me);
  await lockReadOnly(chNews, guild, me);

  try { await chRules.send({ embeds: [buildRulesEmbed()] }); } catch {}
  try { await chNews.send(buildAnnouncementsText()); } catch {}

  // Basis-Rollen vorbereiten
  await ensureRole(guild, 'Mitglied');
  for (const r of ['PS5', 'Xbox', 'PC', 'Deutschland', 'Schweiz', 'Österreich', 'PG', 'SG', 'SF', 'PF', 'C', 'Casual', 'Comp/Pro-Am', 'MyCareer', 'Park/Rec', 'MyTeam']) {
    await ensureRole(guild, r);
  }

  // Buttons posten
  await postRoleMessage(targetChannel);
}

/* ================== Mapping Rollen-Buttons ================== */
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

/* ================== REP Rollen-Konzept ================== */
const REP = {
  display: {
    rookie: 'Rookie',
    pro: 'Starter',
    'all-star': 'All-Star (Reserve)',
    superstar: 'Superstar (Reserve)',
    elite: 'Veteran',
    legend: 'Legend'
  },
  levels: [1, 2, 3, 4, 5],
  makeName(key, level) { return `${this.display[key]} ${level}`; }
};
async function findOrCreateRoleByName(guild, name) {
  let r = guild.roles.cache.find(x => x.name === name);
  if (!r) r = await guild.roles.create({ name, mentionable: false });
  return r;
}

/* ================== LFG (leichte Version) ================== */
function buildLfgRow(messageId, locked = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lfg:join:${messageId}`).setLabel('Beitreten').setStyle(ButtonStyle.Success).setDisabled(locked),
    new ButtonBuilder().setCustomId(`lfg:leave:${messageId}`).setLabel('Verlassen').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`lfg:close:${messageId}`).setLabel('Squad auflösen').setStyle(ButtonStyle.Danger),
  );
}

/* ================== Ready ================== */
client.once('ready', () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: 'NBA 2K DACH • /setup2k' }], status: 'online' });
});

/* ================== Welcome ================== */
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const welcome = member.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name.toLowerCase().includes('willkommen'));
    if (!welcome) return;
    const roleChannel = member.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name.toLowerCase().includes('rolle-zuweisen'));

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`👋 Willkommen ${member.user.username}!`)
      .setDescription(
        `Schön, dass du in der **NBA2K DACH Community** gelandet bist!\n\n` +
        `→ Bitte wähle zuerst dein **Land** in ${roleChannel ? `${roleChannel}` : '#rolle-zuweisen'}, um freigeschaltet zu werden.\n` +
        `Danach kannst du Plattform, Position & Spielstil hinzufügen.`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setFooter({ text: 'NBA2K DACH Community' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('goto:roles').setLabel('→ Rollen auswählen').setStyle(ButtonStyle.Primary)
    );

    await welcome.send({ content: '[[WLC:' + Date.now() + ']]', embeds: [embed], components: [row] });
  } catch (err) {
    console.error('guildMemberAdd error:', err);
  }
});

/* ================== REP Screenshot Auto-Reply ================== */
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (!msg.guild || msg.author.bot) return;

    if (msg.channel.type === ChannelType.GuildText &&
        msg.channel.name.toLowerCase().includes('rep-verifizierung')) {
      if (msg.attachments.size > 0) {
        const isImage = [...msg.attachments.values()].some(a => (a.contentType || '').startsWith('image/'));
        if (isImage) {
          await msg.reply(
            '✅ **Screenshot erhalten!** Ein Mod prüft deinen REP und setzt dir die passende Rolle.\n' +
            'ℹ️ Mods: `/rep user:@Name rank:<Rookie|Pro|All-Star|Superstar|Elite|Legend> level:<1–5>`'
          );
        }
      }
    }
  } catch (err) {
    console.error('MessageCreate error:', err);
  }
});

/* ================== Slash Commands ================== */
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.isChatInputCommand()) return;

    // /setup2k
    if (i.commandName === 'setup2k') {
      await i.deferReply({ ephemeral: true });
      await createInfoAndButtons(i.guild, i.channel);
      return i.editReply('✅ Rollen-Auswahl & Infos wurden gepostet.');
    }

    // /setuplfg
    if (i.commandName === 'setuplfg') {
      await i.deferReply({ ephemeral: true });

      const infoCat = await ensureCategory(i.guild, '📢 Info & Regeln');
      let lfg = i.guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === '🔎│squad-suche');
      if (!lfg) lfg = await i.guild.channels.create({ name: '🔎│squad-suche', type: ChannelType.GuildText, parent: infoCat.id });

      const pin =
        '📌 **So nutzt du die Squad-Suche**\n' +
        '• **/lfg** posten (Modus, Plattform, Slots, Positionen)\n' +
        '• Mit **Beitreten/Verlassen** Buttons verwalten\n' +
        '• Wenn voll → im Voice verabreden & später **Auflösen** klicken\n' +
        '• Seid respektvoll & kein Spam';

      const recent = await lfg.messages.fetch({ limit: 20 }).catch(() => null);
      const mine = recent?.find(m => m.author?.id === i.guild.members.me.id && m.content?.includes('[[LFG_PIN]]'));
      if (mine) await mine.edit(`${pin}\n\n[[LFG_PIN]]`); else await lfg.send(`${pin}\n\n[[LFG_PIN]]`);

      return i.editReply(`✅ LFG Kanal bereit: ${lfg}`);
    }

 
   // ----- /lfg -----
if (i.commandName === 'lfg') {
  const mode = i.options.getString('modus', true);
  const platform = i.options.getString('plattform', true);
  const positions = i.options.getString('positionen', true);
  const slots = i.options.getInteger('slots', true);
  const crossplay = i.options.getBoolean('crossplay') ?? false;
  let squadName = i.options.getString('squad_name')?.trim();

  // Fallback: wenn kein Name eingegeben → nimm den ersten aus dem Pool
  if (!squadName) {
    squadName = NAME_POOL[ Math.floor(Math.random() * NAME_POOL.length) ];
  }

  const joined = [i.user.id];

  const embed = new EmbedBuilder()
    .setColor(0x00A86B)
    .setTitle(`🔎 ${squadName} – ${mode} (${platform})`)
    .setDescription(
      `**Gesucht:** ${positions}\n` +
      `**Slots:** ${joined.length}/${slots}\n` +
      `**Crossplay:** ${crossplay ? '✅' : '❌'}\n` +
      `👤 **Host:** <@${i.user.id}>`
    )
    .addFields({ name: 'Teilnehmer', value: joined.map(id => `• <@${id}>`).join('\n') })
    .setFooter({ text: `[[LFG_STATE:${JSON.stringify({ author: i.user.id, slots, joined, crossplay, name: squadName })}]]` })
    .setTimestamp();

  const post = await i.channel.send({ embeds: [embed], components: [buildLfgRow('pending', false)] });
  await post.edit({ components: [buildLfgRow(post.id, false)] });

  return i.reply({ content: `✅ Squad erstellt: ${post.url}`, ephemeral: true });
}
// ===== Autocomplete für /lfg squad_name =====
client.on(Events.InteractionCreate, async (i) => {
  if (!i.isAutocomplete()) return;
  if (i.commandName !== 'lfg') return;

  const focused = i.options.getFocused(true);
  if (focused.name !== 'squad_name') return;

  const q = (focused.value || '').toLowerCase();
  // einfache Filterung nach Eingabe, max. 25 Vorschläge
  const suggestions = NAME_POOL
    .filter(n => n.toLowerCase().includes(q))
    .slice(0, 25)
    .map(n => ({ name: n, value: n }));

  try {
    await i.respond(suggestions.length ? suggestions : [{ name: 'z. B. "Squad Mamba"', value: 'Squad Mamba' }]);
  } catch { /* ignore */ }
});


    // /setuprep
    if (i.commandName === 'setuprep') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins.', ephemeral: true });

      await i.deferReply({ ephemeral: true });

      const cat = await ensureCategory(i.guild, '📢 Info & Regeln');
      const ch  = await ensureText(i.guild, '🧾│rep-verifizierung', cat.id);

      const pin = [
        '🧾 **REP-Verifizierung**',
        '1) Poste einen **Screenshot** deines aktuellen REP.',
        '2) Ein Mod prüft und setzt deinen Rang mit **/rep**.',
        '3) Bei Upgrade später einfach wieder Screenshot posten.',
        'Ränge: Rookie / Starter / All-Star (Reserve) / Superstar (Reserve) / Veteran / Legend (Level 1–5).'
      ].join('\n');

      const recent = await ch.messages.fetch({ limit: 20 }).catch(() => null);
      const old = recent?.find(m => m.author?.id === i.guild.members.me.id && m.content?.includes('[[REP_PIN]]'));
      if (old) await old.edit(`${pin}\n\n[[REP_PIN]]`); else await ch.send(`${pin}\n\n[[REP_PIN]]`);

      return i.editReply(`✅ REP-Verifizierung eingerichtet: ${ch}`);
    }

    // /setupmedia
    if (i.commandName === 'setupmedia') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins.', ephemeral: true });

      await i.deferReply({ ephemeral: true });

      const cat = await ensureCategory(i.guild, '🎥 Media');
      const clips = await ensureText(i.guild, '🎬│clips', cat.id);
      const full  = await ensureText(i.guild, '📺│full-matches', cat.id);
      const fotos = await ensureText(i.guild, '📷│fotos', cat.id);

      const makePin = (kind) => [
        `📌 **${kind} Regeln**`,
        '• Nur NBA2K Gameplay/Highlights.',
        '• Keine Beleidigungen, kein Spam.',
        '• Sinnvolle Titel/Beschreibung verwenden.'
      ].join('\n');

      const upsert = async (channel, marker) => {
        const r = await channel.messages.fetch({ limit: 20 }).catch(() => null);
        const old = r?.find(m => m.author?.id === i.guild.members.me.id && m.content?.includes(marker));
        if (old) await old.edit(`${makePin(channel.name)}\n\n${marker}`);
        else await channel.send(`${makePin(channel.name)}\n\n${marker}`);
      };

      await upsert(clips, '[[MEDIA_CLIPS]]');
      await upsert(full , '[[MEDIA_FULL]]');
      await upsert(fotos, '[[MEDIA_FOTOS]]');

      return i.editReply(`✅ Media-Kanäle bereit: ${clips} ${full} ${fotos}`);
    }

    // /create_rep_roles
    if (i.commandName === 'create_rep_roles') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return i.reply({ content: '⛔ Nur Admins.', ephemeral: true });

      await i.deferReply({ ephemeral: true });

      let count = 0;
      for (const key of Object.keys(REP.display)) {
        for (const lvl of REP.levels) {
          const name = REP.makeName(key, lvl);
          await findOrCreateRoleByName(i.guild, name);
          count++;
        }
      }
      return i.editReply(`✅ REP-Rollen sichergestellt: ${count} Rollen.`);
    }

    // /rep
    if (i.commandName === 'rep') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageRoles))
        return i.reply({ content: '⛔ Nur Mods dürfen /rep.', ephemeral: true });

      const user = i.options.getUser('user', true);
      const key  = i.options.getString('rank', true);
      const lvl  = i.options.getString('level', true);

      await i.deferReply({ ephemeral: true });

      const member = await i.guild.members.fetch(user.id).catch(() => null);
      if (!member) return i.editReply('❌ Nutzer nicht gefunden.');

      const names = [];
      for (const k of Object.keys(REP.display)) for (const L of REP.levels) names.push(REP.makeName(k, L));
      const remove = member.roles.cache.filter(r => names.includes(r.name));
      for (const r of remove.values()) await member.roles.remove(r).catch(() => {});

      const target = await findOrCreateRoleByName(i.guild, REP.makeName(key, lvl));
      await member.roles.add(target).catch(() => {});

      return i.editReply(`✅ ${member} → **${target.name}** gesetzt.`);
    }

    // /repclear
    if (i.commandName === 'repclear') {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageRoles))
        return i.reply({ content: '⛔ Nur Mods dürfen /repclear.', ephemeral: true });

      const user = i.options.getUser('user', true);
      await i.deferReply({ ephemeral: true });

      const member = await i.guild.members.fetch(user.id).catch(() => null);
      if (!member) return i.editReply('❌ Nutzer nicht gefunden.');

      const names = [];
      for (const k of Object.keys(REP.display)) for (const L of REP.levels) names.push(REP.makeName(k, L));
      const remove = member.roles.cache.filter(r => names.includes(r.name));
      for (const r of remove.values()) await member.roles.remove(r).catch(() => {});

      return i.editReply(`✅ Alle REP-Rollen bei ${member} entfernt.`);
    }

  } catch (err) {
    console.error('interaction (command) error:', err);
    try { (i.deferred ? i.editReply : i.reply)({ content: '❌ Fehler bei der Ausführung.', ephemeral: true }); } catch {}
  }
});

/* ================== Buttons (Rollen + LFG) ================== */
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.isButton()) return;

    const [prefix] = i.customId.split(':');

    // Schnellzugriff aus Welcome
    if (prefix === 'goto') {
      const roleChannel = i.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name.toLowerCase().includes('rolle-zuweisen'));
      return i.reply({ content: roleChannel ? `➡ Bitte wähle hier: ${roleChannel}` : '❌ Rollen-Kanal nicht gefunden.', ephemeral: true });
    }

    // Rollen-Buttons
    const roleName = mapCustomIdToRoleName(i.customId);
    if (roleName) {
      if (prefix === 'country') {
        // Land auswählen → freischalten + Direktlink zur REP-Verifizierung
        const accessRole = await ensureRole(i.guild, 'Mitglied');
        const role = await ensureRole(i.guild, roleName);

        // optional: nur 1 Land
        const countryNames = ['Deutschland', 'Schweiz', 'Österreich'];
        const toRemove = i.member.roles.cache.filter(r => countryNames.includes(r.name) && r.id !== role.id);
        for (const r of toRemove.values()) await i.member.roles.remove(r).catch(() => {});

        await i.member.roles.add(role).catch(() => {});
        await i.member.roles.add(accessRole).catch(() => {});

        // „Ohne Rolle“ entfernen
        const blocker = i.guild.roles.cache.find(r => r.name.toLowerCase().includes('ohne') && r.name.toLowerCase().includes('rolle'));
        if (blocker) await i.member.roles.remove(blocker).catch(() => {});

        // Direktlink zur REP-Verifizierung
        const verifyCh = i.guild.channels.cache.find(
          ch => ch.type === ChannelType.GuildText && ch.name.toLowerCase().includes('rep-verifizierung')
        );

        const components = [];
        if (verifyCh) {
          components.push(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel('🧾 Zum REP-Check')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${i.guild.id}/${verifyCh.id}`)
            )
          );
        }

        return i.reply({
          content:
            `✅ **${roleName}** gesetzt – du bist freigeschaltet!\n` +
            (verifyCh
              ? `Möchtest du direkt deinen **REP verifizieren**?`
              : `Tipp: Richte danach deinen **REP** im Kanal *🧾│rep-verifizierung* ein.`),
          components,
          ephemeral: true
        });
      }

      // Andere Gruppen: Toggle (pro Gruppe max. 1)
      let role = i.guild.roles.cache.find(r => r.name === roleName);
      if (!role) role = await i.guild.roles.create({ name: roleName });

      const groups = {
        platform: ['PS5', 'Xbox', 'PC'],
        position: ['PG', 'SG', 'SF', 'PF', 'C'],
        style: ['Casual', 'Comp/Pro-Am', 'MyCareer', 'Park/Rec', 'MyTeam'],
      };
      const groupNames = groups[prefix] || [];
      const remove = i.member.roles.cache.filter(r => groupNames.includes(r.name) && r.id !== role.id);
      for (const r of remove.values()) await i.member.roles.remove(r).catch(() => {});

      const hasRole = i.member.roles.cache.has(role.id);
      if (hasRole) {
        await i.member.roles.remove(role);
        return i.reply({ content: `❎ Rolle **${roleName}** entfernt.`, ephemeral: true });
      } else {
        await i.member.roles.add(role);
        return i.reply({ content: `✅ Rolle **${roleName}** hinzugefügt.`, ephemeral: true });
      }
    }

    // LFG Buttons
    if (prefix === 'lfg') {
      const [, action, msgId] = i.customId.split(':');

      const msg = await i.channel.messages.fetch(msgId).catch(() => null);
      if (!msg) return i.reply({ content: '❌ LFG-Beitrag nicht gefunden.', ephemeral: true });

      const emb = msg.embeds?.[0];
      const footer = emb?.footer?.text || '';
      const m = footer.match(/\[\[LFG_STATE:(.+)\]\]/);
      if (!m) return i.reply({ content: '❌ LFG Zustand fehlt.', ephemeral: true });

      let state;
      try { state = JSON.parse(m[1]); } catch { return i.reply({ content: '❌ LFG Zustand defekt.', ephemeral: true }); }

      const joined = new Set(state.joined || []);
      const author = state.author;
      const slots = state.slots;

      if (action === 'join') {
        if (joined.has(i.user.id)) return i.reply({ content: 'Du bist schon drin.', ephemeral: true });
        if (joined.size >= slots) return i.reply({ content: 'Squad ist voll.', ephemeral: true });
        joined.add(i.user.id);
      }
      if (action === 'leave') {
        if (!joined.has(i.user.id)) return i.reply({ content: 'Du bist hier nicht eingetragen.', ephemeral: true });
        joined.delete(i.user.id);
      }
      if (action === 'close') {
        const isHost = i.user.id === author || i.memberPermissions.has(PermissionsBitField.Flags.ManageMessages);
        if (!isHost) return i.reply({ content: 'Nur Host/Mods dürfen schließen.', ephemeral: true });

        const closed = EmbedBuilder.from(emb)
          .setColor(0x888888)
          .setTitle(emb.title.replace('🔎', '🔒 [AUFGELÖST]'))
          .setFooter({ text: '[[LFG_STATE:CLOSED]]' });

        await msg.edit({ embeds: [closed], components: [] });
        return i.reply({ content: '🔒 Squad aufgelöst.', ephemeral: true });
      }

      // Embed updaten
      const newList = [...joined];
      const updated = EmbedBuilder.from(emb);
      const fields = updated.data.fields || [];
      const idx = fields.findIndex(f => f.name === 'Teilnehmer');
      const value = newList.length ? newList.map(id => `• <@${id}>`).join('\n') : '— noch frei —';

      if (idx >= 0) fields[idx].value = value;
      else fields.push({ name: 'Teilnehmer', value });

      updated.setFields(fields);
      updated.setDescription(updated.data.description.replace(/Slots:\s*\d+\/\d+/, `Slots: ${newList.length}/${slots}`));
      updated.setFooter({ text: `[[LFG_STATE:${JSON.stringify({ author, slots, joined: newList })}]]` });

      await msg.edit({ embeds: [updated], components: [buildLfgRow(msg.id, newList.length >= slots)] });
      return i.reply({ content: action === 'join' ? '✅ Beigetreten.' : '✅ Verlassen.', ephemeral: true });
    }

  } catch (err) {
    console.error('interaction (button) error:', err);
    try { await i.reply({ content: '❌ Fehler bei der Ausführung.', ephemeral: true }); } catch {}
  }
});

/* ================== Start ================== */
client.login(TOKEN);
