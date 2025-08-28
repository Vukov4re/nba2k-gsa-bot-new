// deploy-commands.js (ESM)
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [];

/* ---------- Admin/Setup ---------- */
commands.push(new SlashCommandBuilder().setName('setup2k').setDescription('Richtet Info & Rollen ein (idempotent).'));
commands.push(new SlashCommandBuilder().setName('setuprep').setDescription('Richtet den REP-Verifizierungskanal ein (idempotent).'));
commands.push(new SlashCommandBuilder().setName('setupmedia').setDescription('Richtet Clips / Full-Matches / Fotos ein (idempotent).'));

/* ---------- REP ---------- */
commands.push(
  new SlashCommandBuilder()
    .setName('create_rep_roles')
    .setDescription('Erstellt alle REP-Rollen (Rookie/Starter/All-Star/Superstar/Veteran/Legend × 1–5).')
);
commands.push(
  new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Setzt eine REP-Rolle für einen Nutzer (entfernt andere REP-Rollen automatisch).')
    .addUserOption(o => o.setName('user').setDescription('Zielnutzer').setRequired(true))
    .addStringOption(o => o.setName('rank').setDescription('Rang').setRequired(true)
      .addChoices(
        { name: 'Rookie', value: 'rookie' },
        { name: 'Starter', value: 'pro' },
        { name: 'All-Star (Reserve)', value: 'all-star' },
        { name: 'Superstar (Reserve)', value: 'superstar' },
        { name: 'Veteran', value: 'elite' },
        { name: 'Legend', value: 'legend' },
      ))
    .addStringOption(o => o.setName('level').setDescription('Stufe 1–5').setRequired(true)
      .addChoices(
        { name: '1', value: '1' }, { name: '2', value: '2' }, { name: '3', value: '3' },
        { name: '4', value: '4' }, { name: '5', value: '5' },
      ))
);
commands.push(
  new SlashCommandBuilder()
    .setName('repclear')
    .setDescription('Entfernt alle REP-Rollen eines Nutzers.')
    .addUserOption(o => o.setName('user').setDescription('Zielnutzer').setRequired(true))
);

/* ---------- LFG / Squad-Suche ---------- */
commands.push(new SlashCommandBuilder().setName('setuplfg').setDescription('Erstellt/prüft den 🔎│squad-suche Kanal (idempotent).'));

commands.push(
  new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Erstellt eine Squad-Suche mit Buttons.')
    // required zuerst:
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
    .addStringOption(o => o.setName('positionen').setDescription('z. B. „PG, C“').setRequired(true))
    .addIntegerOption(o => o.setName('slots').setDescription('Mitspieler (1–5)').setRequired(true).setMinValue(1).setMaxValue(5))
    // optional danach:
    .addBooleanOption(o => o.setName('crossplay').setDescription('Crossplay PS5/Xbox erlauben?').setRequired(false))
    .addStringOption(o => o.setName('squad_name').setDescription('Wunschname (z. B. "Squad Mamba")').setRequired(false).setAutocomplete(true))
    .addStringOption(o => o.setName('notiz').setDescription('Badges/REP/Region (optional)').setRequired(false))
    .addIntegerOption(o => o.setName('ttl_minutes').setDescription('Ablaufzeit in Minuten (Standard 120)').setRequired(false).setMinValue(15).setMaxValue(1440))
);

/* ---------- Deploy-Logik ---------- */
const token   = process.env.DISCORD_TOKEN || process.env.TOKEN;
const clientId= process.env.CLIENT_ID;
const scope   = (process.env.DEPLOY_SCOPE || 'guild').toLowerCase(); // 'guild' | 'global'
const guildId = process.env.GUILD_ID || '';
const guildIdsCsv = process.env.GUILD_IDS || '';
const WIPE_GLOBAL = (process.env.WIPE_GLOBAL || 'false').toLowerCase() === 'true';

if (!token || !clientId) { console.error('❌ Missing DISCORD_TOKEN/CLIENT_ID'); process.exit(1); }
const rest = new REST({ version: '10' }).setToken(token);

async function deployGuild(gid) {
  console.log(`📤 Guild-Deploy → ${gid}`);
  const body = commands.map(c => c.toJSON());
  await rest.put(Routes.applicationGuildCommands(clientId, gid), { body });
  console.log(`✅ Guild OK (${body.length} cmds)`);
}

async function deployGlobal() {
  const body = WIPE_GLOBAL ? [] : commands.map(c => c.toJSON());
  console.log(`🌍 Global-Deploy (${WIPE_GLOBAL ? 'WIPE' : body.length + ' cmds'})`);
  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log('✅ Global OK');
}

(async () => {
  try {
    if (scope === 'global') return void await deployGlobal();
    const ids = [];
    if (guildIdsCsv.trim()) ids.push(...guildIdsCsv.split(',').map(s => s.trim()).filter(Boolean));
    if (guildId && !ids.includes(guildId)) ids.push(guildId);
    if (ids.length === 0) { console.error('❌ DEPLOY_SCOPE=guild aber keine GUILD_ID/GUILD_IDS gesetzt.'); process.exit(1); }
    for (const gid of ids) await deployGuild(gid);
  } catch (e) {
    console.error('❌ Deploy-Fehler:', e);
    process.exit(1);
  }
})();
