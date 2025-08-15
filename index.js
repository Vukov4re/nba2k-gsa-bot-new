import 'dotenv/config';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, Client, GatewayIntentBits, PermissionFlagsBits
} from 'discord.js';
import { EmbedBuilder } from 'discord.js';

// Minimal-Intents (keine privilegierten Intents nötig)
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const TOKEN = (process.env.DISCORD_TOKEN || '').trim();

// ---------- Helpers ----------
async function ensureCategory(guild, name) {
  let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
  if (!cat) cat = await guild.channels.create({ name, type: ChannelType.GuildCategory });
  return cat;
}

async function ensureText(guild, name, parent) {
  let ch = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && c.name === name && c.parentId === parent.id
  );
  if (!ch) ch = await guild.channels.create({ name, type: ChannelType.GuildText, parent: parent.id });
  return ch;
}

async function ensureVoice(guild, name, parent) {
  let ch = guild.channels.cache.find(
    c => c.type === ChannelType.GuildVoice && c.name === name && c.parentId === parent.id
  );
  if (!ch) ch = await guild.channels.create({ name, type: ChannelType.GuildVoice, parent: parent.id });
  return ch;
}

async function ensureRole(guild, name) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) role = await guild.roles.create({ name });
  return role;
}

// Sperrt Kanal für @everyone (read-only), aber crasht nicht bei fehlenden Rechten
async function lockReadOnly(channel, guild, me) {
  try {
    const canManage = me.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels);
    if (!canManage) {
      console.warn(`⚠️ Überspringe Lock für #${channel.name}: keine ManageChannels-Rechte`);
      return;
    }
    const everyone = guild.roles.everyone;
    await channel.permissionOverwrites.edit(everyone, {
      SendMessages: false,
      AddReactions: false,
    });
    console.log(`🔒 Kanal gesperrt: #${channel.name}`);
  } catch (err) {
    if (err?.code === 50013) {
      console.warn(`⚠️ Missing Permissions bei #${channel.name} – übersprungen.`);
    } else {
      console.error(`❌ Fehler beim Sperren von #${channel.name}:`, err);
    }
  }
}

// ---------- Struktur ----------
async function createStructure(guild) {
  const me = await guild.members.fetchMe();

  const info   = await ensureCategory(guild, '📢 Info & Regeln');
  const allg   = await ensureCategory(guild, '💬 Allgemein');
  const search = await ensureCategory(guild, '🎮 Teammate-Suche');
  const voice  = await ensureCategory(guild, '🔊 Voice');
  const events = await ensureCategory(guild, '🏆 Events');

  const chRules = await ensureText(guild, '📜│regeln', info);
  const chNews  = await ensureText(guild, '📢│ankündigungen', info);
  await ensureText(guild, '🎯│willkommen', info);

  await ensureText(guild, '💬│chat', allg);
  await ensureText(guild, '🏀│nba2k-news', allg);
  await ensureText(guild, '📸│build-galerie', allg);
  await ensureText(guild, '❓│hilfe-fragen', allg);

  await ensureText(guild, '🎮│ps5-suche', search);
  await ensureText(guild, '🎮│xbox-suche', search);
  await ensureText(guild, '🎮│pc-suche', search);
  await ensureText(guild, '🏆│pro-am-suche', search);
  await ensureText(guild, '🏟│rec-park-suche', search);

  await ensureVoice(guild, '🎙│Lobby', voice);
  await ensureVoice(guild, '🎙│Rec Match', voice);
  await ensureVoice(guild, '🎙│Pro-Am Match', voice);

  await ensureText(guild, '📅│turniere', events);
  await ensureText(guild, '🎥│highlight-clips', events);

  await lockReadOnly(chRules, guild, me);
  await lockReadOnly(chNews, guild, me);
}

// ---------- Rollen/Buttons ----------
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
  // Plattform
  await channel.send({
    content: '**Plattform wählen**:',
    components: [
      buildButtonsRow(
        [
          { id: 'ps5',  label: 'PS5',  emoji: '🎮' },
          { id: 'xbox', label: 'Xbox', emoji: '🎮' },
          { id: 'pc',   label: 'PC',   emoji: '💻' },
        ],
        'platform'
      ),
    ],
  });

  // Länder
  await channel.send({
    content: '**Land wählen**:',
    components: [
      buildButtonsRow(
        [
          { id: 'de', label: 'Deutschland', emoji: '🇩🇪' },
          { id: 'ch', label: 'Schweiz',     emoji: '🇨🇭' },
          { id: 'at', label: 'Österreich',  emoji: '🇦🇹' },
        ],
        'country'
      ),
    ],
  });

  // Position
  await channel.send({
    content: '**Build-Position wählen**:',
    components: [
      buildButtonsRow(
        [
          { id: 'pg', label: 'PG', emoji: '🏀' },
          { id: 'sg', label: 'SG', emoji: '🏀' },
          { id: 'sf', label: 'SF', emoji: '🏀' },
          { id: 'pf', label: 'PF', emoji: '🏀' },
          { id: 'c',  label: 'C',  emoji: '🏀' },
        ],
        'position'
      ),
    ],
  });

  // Spielstil / Modus (inkl. MyTeam)
  await channel.send({
    content: '**Spielstil/Modus wählen**:',
    components: [
      buildButtonsRow(
        [
          { id: 'casual',   label: 'Casual',       emoji: '😎' },
          { id: 'comp',     label: 'Comp/Pro-Am',  emoji: '🏆' },
          { id: 'mycareer', label: 'MyCareer',     emoji: '⏳' },
          { id: 'parkrec',  label: 'Park/Rec',     emoji: '🌆' },
          { id: 'myteam',   label: 'MyTeam',       emoji: '🃏' }, // NEU
        ],
        'style'
      ),
    ],
  });
}

async function ensureRoles(guild) {
  // Plattform
  await ensureRole(guild, 'PS5');
  await ensureRole(guild, 'Xbox');
  await ensureRole(guild, 'PC');

  // Länder
  await ensureRole(guild, 'Deutschland');
  await ensureRole(guild, 'Schweiz');
  await ensureRole(guild, 'Österreich');

  // Positionen
  await ensureRole(guild, 'PG');
  await ensureRole(guild, 'SG');
  await ensureRole(guild, 'SF');
  await ensureRole(guild, 'PF');
  await ensureRole(guild, 'C');

  // Spielstil / Modus (inkl. MyTeam)
  await ensureRole(guild, 'Casual');
  await ensureRole(guild, 'Comp/Pro-Am');
  await ensureRole(guild, 'MyCareer');
  await ensureRole(guild, 'Park/Rec');
  await ensureRole(guild, 'MyTeam'); // NEU
}

function mapCustomIdToRoleName(customId) {
  const [prefix, id] = customId.split(':');
  if (prefix === 'platform') {
    if (id === 'ps5')  return 'PS5';
    if (id === 'xbox') return 'Xbox';
    if (id === 'pc')   return 'PC';
  }
  if (prefix === 'country') {
    if (id === 'de') return 'Deutschland';
    if (id === 'ch') return 'Schweiz';
    if (id === 'at') return 'Österreich';
  }
  if (prefix === 'position') {
    if (id === 'pg') return 'PG';
    if (id === 'sg') return 'SG';
    if (id === 'sf') return 'SF';
    if (id === 'pf') return 'PF';
    if (id === 'c')  return 'C';
  }
  if (prefix === 'style') {
    if (id === 'casual')   return 'Casual';
    if (id === 'comp')     return 'Comp/Pro-Am';
    if (id === 'mycareer') return 'MyCareer';
    if (id === 'parkrec')  return 'Park/Rec';
    if (id === 'myteam')   return 'MyTeam';
  }
  return null;
}

// ---------- Bot Events ----------
client.once('ready', () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
  // Präsenz setzen (sichtbar in Mitgliederliste)
  client.user.setPresence({
    activities: [{ name: 'NBA 2K GSA • /setuproles' }],
    status: 'online',
  });
});

client.on('interactionCreate', async (i) => {
  try {
    // Buttons: sofortige, kurze Antwort
    if (i.isButton()) {
      const roleName = mapCustomIdToRoleName(i.customId);
      if (!roleName) return i.reply({ content: 'Unbekannter Button.', flags: 64 });

      const role = i.guild.roles.cache.find(r => r.name === roleName);
      const member = i.member; // ohne GuildMembers-Intent
      if (!role) return i.reply({ content: `Rolle **${roleName}** existiert nicht.`, flags: 64 });

      const hasRole = member.roles.cache.has(role.id);
      if (hasRole) {
        await member.roles.remove(role);
        return i.reply({ content: `❎ Rolle **${roleName}** entfernt.`, flags: 64 });
      } else {
        await member.roles.add(role);
        return i.reply({ content: `✅ Rolle **${roleName}** hinzugefügt.`, flags: 64 });
      }
    }

    // Nur Slash-Commands ab hier
    if (!i.isChatInputCommand()) return;

    // Sofort bestätigen → verhindert „App reagiert nicht“
    if (!i.deferred && !i.replied) {
      await i.deferReply({ ephemeral: true });
    }

    if (i.commandName === 'setup2k') {
      await createStructure(i.guild);
      return i.editReply('✅ Struktur fertig!');
    }

    if (i.commandName === 'setuproles') {
      const parent      = await ensureCategory(i.guild, '📢 Info & Regeln');
      const roleChannel = await ensureText(i.guild, '🧩│rolle-zuweisen', parent);

      // Schreibrechte im Rollenkanal absichern
      const me = await i.guild.members.fetchMe();
      await roleChannel.permissionOverwrites
        .edit(i.guild.roles.everyone, { SendMessages: true })
        .catch(() => {});
      await roleChannel.permissionOverwrites
        .edit(me.roles.highest, { SendMessages: true, ManageChannels: true })
        .catch(() => {});

      await ensureRoles(i.guild);
      await postRoleMessage(roleChannel);
      return i.editReply('✅ Rollen & Buttons sind bereit in **#🧩│rolle-zuweisen**.');
    }

    await i.editReply('❓ Unbekannter Befehl.');
  } catch (err) {
    console.error('interactionCreate error:', err);
    try {
      if (i.deferred || i.replied) {
        await i.editReply('❌ Fehler bei der Ausführung.');
      } else {
        await i.reply({ content: '❌ Fehler bei der Ausführung.', flags: 64 });
      }
    } catch {}
  }
});

// Extra-Logs
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));
process.on('uncaughtException', (e) => console.error('uncaughtException:', e));

// Start
client.login(TOKEN);
