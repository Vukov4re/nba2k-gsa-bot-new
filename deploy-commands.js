import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder().setName('setup2k').setDescription('Erstellt die Serverstruktur für NBA 2K GSA').toJSON(),
  new SlashCommandBuilder().setName('setuproles').setDescription('Erstellt Rollen-Buttons (Plattform, Land, Position)').toJSON(),
  new SlashCommandBuilder()
  .setName('postrules')
  .setDescription('Postet die Regel-Embed in #📜│regeln')
  .toJSON(),
];

const rest = new REST({ version: '10' }).setToken((process.env.DISCORD_TOKEN || '').trim());

async function main() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash-Commands (guild) registriert.');
  } catch (err) {
    console.error('❌ Fehler beim Registrieren der Commands:', err);
    process.exit(1);
  }
}
main();
