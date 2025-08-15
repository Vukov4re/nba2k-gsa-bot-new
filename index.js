import 'dotenv/config';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, Client, GatewayIntentBits
} from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// Helper-Funktionen
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
async function ensureVoice(guild, name, parent) {
  let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === name && c.parentId === parent.id);
  if (!ch) ch = await guild.channels.create({ name, type: ChannelType.GuildVoice, parent: parent.id });
  return ch;
}
async function ensureRole(guild, name) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) role = await guild.roles.create({ name });
  return role;
}
async function lockReadOnly(channel, guild) {
  const everyone = guild.roles.everyone;
  await channel.permissionOverwrites.edit(everyone, {
    SendMessages: false,
    AddReactions: false
  });
}

// Struktur erstellen
async function createStructure(guild) {
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

  await lockReadOnly(chRules, guild);
  await lockReadOnly(chNews, guild);
}

// Rollen
function buildButtonsRow(items, prefix) {
  const row = new ActionRowBuilder();
  for (const { id, label, emoji } of items) {
    row.addComponents(new ButtonBuilder()
      .setCustomId(`${prefix}:${id}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emoji));
  }
  return row;
}
async function postRoleMessage(channel) {
  await channel.send({
    content: '**Plattform wählen**:',
    components: [buildButtonsRow([
      { id: 'ps5', label: 'PS5', emoji: '🎮' },
      { id: 'xbox', label: 'Xbox', emoji: '🎮' },
      { id: 'pc', label: 'PC', emoji: '💻' }
    ], 'platform')]
  });

  await channel.send({
    content: '**Land wählen**:',
    components: [buildButtonsRow([
      { id: 'de', label: 'Deutschland', emoji: '🇩🇪' },
      { id: 'ch', label: 'Schweiz', emoji: '🇨🇭' },
      { id: 'at', label: 'Österreich', emoji: '🇦🇹' }
    ], 'country')]
  });

  await channel.send({
    content: '**Build-Position wählen**:',
    components: [buildButtonsRow([
      { id: 'pg', label: 'PG', emoji: '🏀' },
      { id: 'sg', label: 'SG', emoji: '🏀' },
      { id: 'sf', label: 'SF', emoji: '🏀' },
      { id: 'pf', label: 'PF', emoji: '🏀' },
      { id: 'c',  label: 'C',  emoji: '🏀' }
    ], 'position')]
  });
}
async function ensureRoles(guild) {
  await ensureRole(guild, 'PS5'); await ensureRole(guild, 'Xbox'); await ensureRole(guild, 'PC');
  await ensureRole(guild, 'Deutschland'); await ensureRole(guild, 'Schweiz'); await ensureRole(guild, 'Österreich');
  await ensureRole(guild, 'PG'); await ensureRole(guild, 'SG'); await ensureRole(guild, 'SF'); await ensureRole(guild, 'PF'); await ensureRole(guild, 'C');
}
function mapCustomIdToRoleName(customId) {
  const [p, id] = customId.split(':');
  if (p === 'platform') return id === 'ps5' ? 'PS5' : id === 'xbox' ? 'Xbox' : id === 'pc' ? 'PC' : null;
  if (p === 'country')  return id === 'de' ? 'Deutschland' : id === 'ch' ? 'Schweiz' : id === 'at' ? 'Österreich' : null;
  if (p === 'position') return ['pg','sg','sf','pf','c'].includes(id) ? id.toUpperCase() : null;
  return null;
}

// Events
client.once('ready', () => console.log(`✅ Eingeloggt als ${client.user.tag}`));

client.on('interactionCreate', async (i) => {
  try {
    if (i.isChatInputCommand()) {
      if (i.commandName === 'setup2k') {
        await i.reply({ content: 'Erstelle Struktur…', ephemeral: true });
        await createStructure(i.guild);
        await i.followUp({ content: '✅ Struktur fertig!', ephemeral: true });
        return;
      }
      if (i.commandName === 'setuproles') {
        await i.reply({ content: 'Lege Rollen & Buttons an…', ephemeral: true });
        const parent = await ensureCategory(i.guild, '📢 Info & Regeln');
        const roleChannel = await ensureText(i.guild, '🧩│rolle-zuweisen', parent);
        await ensureRoles(i.guild);
        await postRoleMessage(roleChannel);
        await i.followUp({ content: '✅ Rollen-Buttons stehen in **#🧩│rolle-zuweisen**.', ephemeral: true });
        return;
      }
    }
    if (i.isButton()) {
      const roleName = mapCustomIdToRoleName(i.customId);
      if (!roleName) return i.reply({ content: 'Unbekannter Button.', ephemeral: true });
      const role = i.guild.roles.cache.find(r => r.name === roleName);
      const member = await i.guild.members.fetch(i.user.id);
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        await i.reply({ content: `❎ Rolle ${roleName} entfernt.`, ephemeral: true });
      } else {
        await member.roles.add(role);
        await i.reply({ content: `✅ Rolle ${roleName} hinzugefügt.`, ephemeral: true });
      }
    }
  } catch (err) {
    console.error('Fehler in interactionCreate:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);
