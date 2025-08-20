import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { REP } from './config/roles.js';

const TOKEN    = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
const CLIENT_ID = (process.env.CLIENT_ID || '').trim();
const GUILD_ID  = (process.env.GUILD_ID  || '').trim();

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ ENV fehlt: DISCORD_TOKEN (oder TOKEN), CLIENT_ID, GUILD_ID');
  process.exit(1);
}

const RANKS = Object.keys(REP.display).map(k => ({ name: REP.display[k], value: k }));
const LEVELS = REP.levels.map(n => ({ name: String(n), value: String(n) }));

const commands = [
  new SlashCommandBuilder()
    .setName('setup2k')
    .setDescription('Postet/aktualisiert Regeln & Rollen-Buttons (idempotent).'),

  new SlashCommandBuilder()
    .setName('setuprep')
    .setDescription('Richtet nur den REP-Verifizierungskanal ein (idempotent).'),

  new SlashCommandBuilder()
    .setName('create_rep_roles')
    .setDescription('Erstellt alle REP-Rollen (Rookie 1–5 … Legend 1–5) nach Vorlage.'),

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

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🔁 Registriere Slash-Commands (guild)…');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash-Commands registriert für Guild:', GUILD_ID);
    process.exit(0);
  } catch (e) {
    console.error('❌ Deploy-Fehler:', e);
    process.exit(1);
  }
})();
