// deploy-commands.js
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

// --- ENV ---
const TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
const CLIENT_ID = (process.env.CLIENT_ID || '').trim();
const GUILD_ID  = (process.env.GUILD_ID  || '').trim();

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ Fehlende ENV Variablen. Benötigt: DISCORD_TOKEN (oder TOKEN), CLIENT_ID, GUILD_ID');
  process.exit(1);
}

// --- COMMANDS ---
const commands = [
  new SlashCommandBuilder()
    .setName('setup2k')
    .setDescription('Postet die Rollen-Auswahl (Plattform, Position, Spielstil, Länder – Länder schalten frei).')
    .toJSON(),
];

// --- REGISTER ---
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function main() {
  console.log('🔁 Registriere Slash-Commands (guild)…');
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log('✅ Slash-Commands registriert für Guild:', GUILD_ID);
}

main().catch((e) => {
  console.error('❌ Fehler beim Registrieren:', e);
  process.exit(1);
});
