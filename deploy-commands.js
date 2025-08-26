// deploy-commands.js
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

// --- ENV ---
const TOKEN     = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
const CLIENT_ID = (process.env.CLIENT_ID || '').trim();
const GUILD_ID  = (process.env.GUILD_ID  || '').trim();

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ Fehlende ENV Variablen. Benötigt: DISCORD_TOKEN (oder TOKEN), CLIENT_ID, GUILD_ID');
  process.exit(1);
}

// --- COMMANDS ---
const commands = [];

// Bestehend: /setup2k
commands.push(
  new SlashCommandBuilder()
    .setName('setup2k')
    .setDescription('Postet die Rollen-Auswahl (Plattform, Position, Spielstil, Länder – Länder schalten frei).')
);

// Neu: /setuplfg (nur Kanal + Hinweis)
commands.push(
  new SlashCommandBuilder()
    .setName('setuplfg')
    .setDescription('Erstellt/prüft den 🔎│squad-suche Kanal (idempotent).')
);

// Neu: /lfg (leichte Version)
commands.push(
  new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Erstellt eine Squad-Suche (leicht).')
    .addStringOption(o =>
      o.setName('modus').setDescription('Park / Rec / Pro-Am / MyTeam').setRequired(true)
        .addChoices(
          { name: 'Park', value: 'Park' },
          { name: 'Rec', value: 'Rec' },
          { name: 'Pro-Am', value: 'Pro-Am' },
          { name: 'MyTeam', value: 'MyTeam' },
        ))
    .addStringOption(o =>
      o.setName('plattform').setDescription('PS5 / Xbox / PC').setRequired(true)
        .addChoices(
          { name: 'PS5', value: 'PS5' },
          { name: 'Xbox', value: 'Xbox' },
          { name: 'PC', value: 'PC' },
        ))
    .addStringOption(o =>
      o.setName('positionen').setDescription('z. B. „PG, C“').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('slots').setDescription('Mitspieler (1–5)').setRequired(true).setMinValue(1).setMaxValue(5)
    )
);

// --- REGISTER ---
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function main() {
  console.log(`🔁 Registriere Slash-Commands (guild: ${GUILD_ID})…`);
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log('✅ Slash-Commands registriert.');
}

main().catch((e) => {
  console.error('❌ Fehler beim Registrieren:', e);
  process.exit(1);
});
