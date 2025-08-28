// deploy-commands.js (Hauptbot)

import 'dotenv/config';
import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { REP } from './config/roles.js';

// ---------- ENV ----------
const TOKEN     = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
const CLIENT_ID = (process.env.CLIENT_ID || '').trim();
const GUILD_ID  = (process.env.GUILD_ID || '').trim();

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ ENV fehlt: DISCORD_TOKEN/TOKEN, CLIENT_ID, GUILD_ID');
  process.exit(1);
}

// ---------- Choices ----------
const RANKS  = Object.keys(REP.display).map(k => ({ name: REP.display[k], value: k }));
const LEVELS = REP.levels.map(n => ({ name: String(n), value: String(n) }));

// ---------- Commands ----------
const commands = [

  // Admin-only
  new SlashCommandBuilder()
    .setName('setup2k')
    .setDescription('Postet/aktualisiert Regeln & Rollen-Buttons (idempotent).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('setuprep')
    .setDescription('Richtet nur den REP-Verifizierungskanal ein (idempotent).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('setupmedia')
    .setDescription('Richtet Clips- und Full-Matches-Kanäle ein (idempotent).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('create_rep_roles')
    .setDescription('Erstellt alle REP-Rollen (Rookie 1–5 … Legend 1–5).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  // /announce (Admin-only)
  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Poste eine Ankündigung mit @everyone (nur Admins).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Zielkanal für die Ankündigung')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('titel')
        .setDescription('Titel der Ankündigung')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('nachricht')
        .setDescription('Inhalt der Ankündigung')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('emoji')
        .setDescription('Optionales Emoji vor dem Titel')
        .setRequired(false)
    ),

  // Moderation (ManageRoles)
  new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Setzt die REP-Rolle eines Users (alte REP-Rollen werden entfernt).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('Ziel-User').setRequired(true)),

].map(c => c.toJSON());

// ---------- Deploy ----------
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🔁 Registriere Slash-Commands (Guild)…');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash-Commands registriert für Guild:', GUILD_ID);
    process.exit(0);
  } catch (e) {
    console.error('❌ Deploy-Fehler:', e);
    process.exit(1);
  }
})();
