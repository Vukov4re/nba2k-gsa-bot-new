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

const RANKS = [
  { name: 'Rookie', value: 'rookie' },
  { name: 'Pro', value: 'pro' },
  { name: 'All-Star', value: 'all-star' },
  { name: 'Superstar', value: 'superstar' },
  { name: 'Elite', value: 'elite' },
  { name: 'Legend', value: 'legend' }
];
const LEVELS = [1,2,3,4,5].map(n => ({ name: String(n), value: String(n) }));

// --- COMMANDS ---
const commands = [
  // dein bestehender Setup-Command
  new SlashCommandBuilder()
    .setName('setup2k')
    .setDescription('Postet die Rollen-Auswahl (Plattform, Position, Spielstil, Länder – Länder schalten frei).'),

  // neue REP-Commands
  new SlashCommandBuilder()
    .setName('create_rep_roles')
    .setDescription('Erstellt alle 30 REP-Rollen (Rookie 1–5 … Legend 1–5) nach Vorlage-Rolle.'),

  new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Setzt die REP-Rolle eines Users (andere REP-Rollen werden entfernt).')
    .addUserOption(o => o.setName('user').setDescription('Ziel-User').setRequired(true))
    .addStringOption(o => {
      o.setName('rank').setDescription('Rang').setRequired(true);
      RANKS.forEach(r => o.addChoices(r));
      return o;
    })
    .addStringOption(o => {
      o.setName('level').setDescription('Stufe (1–5)').setRequired(true);
      LEVELS.forEach(l => o.addChoices(l));
      return o;
    }),

  new SlashCommandBuilder()
    .setName('repclear')
    .setDescription('Entfernt alle REP-Rollen eines Users.')
    .addUserOption(o => o.setName('user').setDescription('Ziel-User').setRequired(true)),
].map(c => c.toJSON());

// --- REGISTER ---
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function main() {
  try {
    console.log('🔁 Registriere Slash-Commands (guild)…');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash-Commands registriert für Guild:', GUILD_ID);
  } catch (e) {
    console.error('❌ Deploy-Fehler:', e);
    process.exit(1);
  }
}

main();
