// deploy-commands.js
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';


const TOKEN = (process.env.DISCORD_TOKEN || process.env.TOKEN || '').trim();
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;


if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
console.error('❌ Missing env: DISCORD_TOKEN, CLIENT_ID, or GUILD_ID');
process.exit(1);
}


const commands = [
new SlashCommandBuilder()
.setName('setup2k')
.setDescription('Server-Struktur & Rollen-Auswahl einrichten (idempotent).'),


new SlashCommandBuilder()
.setName('create_rep_roles')
.setDescription('Erstellt alle REP-Rollen von Rookie 1–5 bis Legend 1–5.'),


new SlashCommandBuilder()
.setName('rep')
.setDescription('Setzt einem User eine REP-Rolle und entfernt andere.')
.addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
.addStringOption(opt => opt.setName('rank').setDescription('Rang (rookie, pro, all-star, superstar, elite, legend)').setRequired(true))
.addStringOption(opt => opt.setName('level').setDescription('Level 1–5').setRequired(true)),


new SlashCommandBuilder()
.setName('repclear')
.setDescription('Entfernt alle REP-Rollen von einem User.')
.addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
].map(cmd => cmd.toJSON());


const rest = new REST({ version: '10' }).setToken(TOKEN);


(async () => {
try {
console.log('🔄 Deploying commands...');
await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
console.log('✅ Slash commands deployed!');
} catch (err) {
console.error('❌ Error deploying commands:', err);
}
})();
