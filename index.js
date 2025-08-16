// index.js
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // wichtig für Join-Event
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Hilfsfunktion für Read-Only-Kanäle
async function lockReadOnly(channel, guild) {
  const everyoneRole = guild.roles.everyone;
  try {
    await channel.permissionOverwrites.edit(everyoneRole, {
      SendMessages: false,
      AddReactions: false,
    });
  } catch (err) {
    console.warn(`⚠️ Konnte Channel nicht sperren: ${channel.name}`, err.message);
  }
}

// Struktur (optional bei Setup-Command)
async function createStructure(guild) {
  // Regeln-Kanal
  const rules = await guild.channels.create({
    name: '📜│regeln',
    type: ChannelType.GuildText,
  });
  await lockReadOnly(rules, guild);
  await rules.send(
    '**Regeln der NBA2K DACH Community**\n' +
    '1. Respektvoller Umgang\n' +
    '2. Kein Spam, keine Werbung\n' +
    '3. Cheating/Glitches sind verboten\n' +
    '4. NSFW & toxisches Verhalten verboten\n' +
    '5. Folge den Anweisungen des Teams\n\n' +
    '✅ Mit dem Beitreten des Servers stimmst du den Regeln zu.'
  );

  // Ankündigungen
  const news = await guild.channels.create({
    name: '📢│ankündigungen',
    type: ChannelType.GuildText,
  });
  await lockReadOnly(news, guild);
  await news.send(
    '**Willkommen in der NBA2K DACH Community!**\n\n' +
    'Hier findest du alle offiziellen Ankündigungen, News und Updates rund um unseren Server und NBA2K.'
  );

  // Rollen-Zuweisen
  const roles = await guild.channels.create({
    name: '🧩│rolle-zuweisen',
    type: ChannelType.GuildText,
  });
  return { rules, news, roles };
}

// Setup-Command
client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName === 'setup2k') {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('platform:ps5').setLabel('🎮 PS5').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('platform:xbox').setLabel('🎮 Xbox').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('platform:pc').setLabel('💻 PC').setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('build:pg').setLabel('🏀 PG').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('build:sg').setLabel('🏀 SG').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('build:sf').setLabel('🏀 SF').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('build:pf').setLabel('🏀 PF').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('build:c').setLabel('🏀 C').setStyle(ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mode:casual').setLabel('😎 Casual').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mode:comp').setLabel('🏆 Comp/Pro-Am').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mode:mycareer').setLabel('⏳ MyCareer').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mode:park').setLabel('👥 Park/Rec').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mode:myteam').setLabel('📊 MyTeam').setStyle(ButtonStyle.Secondary),
    );

    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('country:de').setLabel('🇩🇪 Deutschland').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('country:ch').setLabel('🇨🇭 Schweiz').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('country:at').setLabel('🇦🇹 Österreich').setStyle(ButtonStyle.Primary),
    );

    await i.reply({
      content:
        '**Plattform wählen:**\n' +
        '**Build-Position wählen:**\n' +
        '**Spielstil/Modus wählen:**\n' +
        '**Land wählen (Pflicht für Freischaltung):**',
      components: [row1, row2, row3, row4],
    });
  }
});

// Button-Handler
client.on(Events.InteractionCreate, async (i) => {
  if (!i.isButton()) return;
  const [type, value] = i.customId.split(':');

  // Weiterleitung zu Rollen-Kanal
  if (type === 'goto') {
    const roleChannel = i.guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildText && ch.name.includes('rolle-zuweisen')
    );
    return i.reply({
      content: `➡ Bitte wähle zuerst dein **Land** hier: ${roleChannel}`,
      flags: 64,
    });
  }

  let roleName = '';
  if (type === 'platform') roleName = value.toUpperCase();
  if (type === 'build') roleName = value.toUpperCase();
  if (type === 'mode') {
    if (value === 'casual') roleName = 'Casual';
    if (value === 'comp') roleName = 'Comp/Pro-Am';
    if (value === 'mycareer') roleName = 'MyCareer';
    if (value === 'park') roleName = 'Park/Rec';
    if (value === 'myteam') roleName = 'MyTeam';
  }
  if (type === 'country') {
    if (value === 'de') roleName = 'Deutschland';
    if (value === 'ch') roleName = 'Schweiz';
    if (value === 'at') roleName = 'Österreich';
  }

  if (!roleName) return;

  let role = i.guild.roles.cache.find((r) => r.name === roleName);
  if (!role) role = await i.guild.roles.create({ name: roleName, mentionable: true });

  await i.member.roles.add(role);

  // Extra: Mitglied-Rolle nach Länderwahl
  if (type === 'country') {
    let memberRole = i.guild.roles.cache.find((r) => r.name === 'Mitglied');
    if (!memberRole) memberRole = await i.guild.roles.create({ name: 'Mitglied' });
    await i.member.roles.add(memberRole);
  }

  await i.reply({ content: `✅ Rolle **${roleName}** hinzugefügt!`, flags: 64 });
});

// Willkommen bei Join
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const welcome = member.guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildText && ch.name.includes('willkommen')
    );
    if (!welcome) return;

    const roleChannel = member.guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildText && ch.name.includes('rolle-zuweisen')
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('goto:roles')
        .setLabel('➡ Rollen auswählen')
        .setStyle(ButtonStyle.Primary)
    );

    await welcome.send({
      content:
        `👋 Willkommen ${member} in der **NBA2K DACH Community**!\n` +
        `Bitte wähle zuerst dein **Land** in ${roleChannel}, um freigeschaltet zu werden.\n` +
        `Danach kannst du Plattform, Position & Spielstil wählen.`,
      components: [row],
    });
  } catch (e) {
    console.warn('⚠️ Konnte Willkommensnachricht nicht senden:', e?.message || e);
  }
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Eingeloggt als ${c.user.tag}`);
});

client.login(TOKEN);
