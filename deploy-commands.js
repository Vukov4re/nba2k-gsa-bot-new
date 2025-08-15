import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('setup2k')
    .setDescription('Erstellt die NBA 2K GSA Serverstruktur')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('setuproles')
    .setDescription('Erstellt Auto-Rollen-Nachrichten (Plattform, Land, Build-Position)')
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function main() {
  try {
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log('Slash-Commands (Guild) registriert.');
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log('Slash-Commands (global) registriert.');
    }
  } catch (err) {
    console.error('Fehler beim Registrieren der Commands:', err);
    process.exit(1);
  }
}

main();