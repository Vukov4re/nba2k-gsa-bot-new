// index.js (stabil, ohne disallowed intents)
import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events,
  ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder
} from 'discord.js';

// Token aus DISCORD_TOKEN oder TOKEN
const TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();

// Nur erlaubte Intents: Guilds + GuildMembers (für Welcome)
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
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
async function ensureText(guild, name, parent) {
  let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name && c.parentId === parent.id);
  if (!ch) ch = await guild.channels.create({ name, type: ChannelType.GuildText, parent: parent.id });
  return ch;
}
async function lockReadOnly(channel, guild, me) {
  try {
    const canManage = me.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels);
    if (!canManage) return;
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, AddReactions: false });
  } catch {}
}

/* ---------- Inhalte ---------- */
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

/* ---------- Struktur (nur für /setup2k) ---------- */
async function createInfoAndButtons(guild, targetChannel) {
  const me = await guild.members.fetchMe();
  const info = await ensureCategory(guild, '📢 Info & Regeln');
  const chRules = await ensureText(guild, '📜│regeln', info);
  const chNews  = await ensureText(guild, '📢│ankündigungen', info);

  await lockReadOnly(chRules, guild, me);
  await lockReadOnly(chNews, guild, me);

  try { await chRules.send({ embeds: [buildRulesEmbed()] }); } catch {}
  try { await chNews.send(buildAnnouncementsText()); } catch {}

  // Rollen vorbereiten
  await ensureRole(guild, 'Mitglied');
  for (const r of ['PS5','Xbox','PC','Deutschland','Schweiz','Österreich','PG','SG','SF','PF','C','Casual','Comp/Pro-Am','MyCareer','Park/Rec','MyTeam']) {
    await ensureRole(guild, r);
  }

  // Buttons posten
  await postRoleMessage(targetChannel);
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
  await channel.send({
    content: '**Plattform wählen:**',
    components: [buildButtonsRow(
      [{id:'ps5',label:'PS5',emoji:'🎮'},{id:'xbox',label:'Xbox',emoji:'🎮'},{id:'pc',label:'PC',emoji:'💻'}],
      'platform'
    )],
  });
  await channel.send({
    content: '**Build-Position wählen:**',
    components: [buildButtonsRow(
      [{id:'pg',label:'PG',emoji:'🏀'},{id:'sg',label:'SG',emoji:'🏀'},{id:'sf',label:'SF',emoji:'🏀'},{id:'pf',label:'PF',emoji:'🏀'},{id:'c',label:'C',emoji:'🏀'}],
      'position'
    )],
  });
  await channel.send({
    content: '**Spielstil/Modus wählen:**',
    components: [buildButtonsRow(
      [{id:'casual',label:'Casual',emoji:'😎'},{id:'comp',label:'Comp/Pro-Am',emoji:'🏆'},{id:'mycareer',label:'MyCareer',emoji:'⏳'},{id:'parkrec',label:'Park/Rec',emoji:'🌆'},{id:'myteam',label:'MyTeam',emoji:'🃏'}],
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

/* ---------- Mapping ---------- */
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

/* ---------- Events ---------- */
client.once('ready', () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: 'NBA 2K DACH • /setup2k' }], status: 'online' });
});

// Slash-Command /setup2k
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.isChatInputCommand()) return;
    if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });

    if (i.commandName === 'setup2k') {
      await createInfoAndButtons(i.guild, i.channel);
      return i.editReply('✅ Rollen-Auswahl & Infos wurden gepostet.');
    }

    return i.editReply('❓ Unbekannter Befehl.');
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
      return i.reply({
        content: `✅ **${roleName}** gesetzt. Du bist freigeschaltet!\nWähle optional noch **Plattform**, **Position** & **Spielstil**.`,
        flags: 64
      });
    }

    return i.reply({ content: `✅ Rolle **${roleName}** hinzugefügt.`, flags: 64 });
  } catch (err) {
    console.error('interaction (button) error:', err);
    try { await i.reply({ content: '❌ Fehler bei der Ausführung.', flags: 64 }); } catch {}
  }
});

// Willkommensnachricht
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const welcome = member.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name.includes('willkommen'));
    if (!welcome) return;
    const roleChannel = member.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name.includes('rolle-zuweisen'));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('goto:roles').setLabel('➡ Rollen auswählen').setStyle(ButtonStyle.Primary)
    );

    await welcome.send({
      content:
        `👋 Willkommen ${member} in der **NBA2K DACH Community**!\n` +
        `Bitte wähle zuerst dein **Land** in ${roleChannel ? `${roleChannel}` : '#rolle-zuweisen'}, um freigeschaltet zu werden.\n` +
        `Danach kannst du Plattform, Position & Spielstil hinzufügen.`,
      components: [row]
    });
  } catch (err) {
    console.error('guildMemberAdd error:', err);
  }
});

client.login(TOKEN);
