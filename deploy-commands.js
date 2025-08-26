// deploy-commands.js (ESM)
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

// ==== deine Commands hier definieren ====
const commands = [];

// Beispiel (füge hier ALLE deine Commands ein)
commands.push(new SlashCommandBuilder().setName('setup2k').setDescription('Richtet Info & Rollen ein.'));
commands.push(new SlashCommandBuilder().setName('setuprep').setDescription('Richtet den REP-Verifizierungskanal ein.'));
commands.push(new SlashCommandBuilder().setName('setupmedia').setDescription('Richtet Clips/Full-Matches/Fotos ein.'));
commands.push(new SlashCommandBuilder().setName('setuplfg').setDescription('Erstellt/prüft den 🔎│squad-suche Kanal.'));
commands.push(
  new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Erstellt eine Squad-Suche.')
    .addStringOption(o => o.setName('modus').setDescription('Park / Rec / Pro-Am / MyTeam').setRequired(true)
      .addChoices({name:'Park',value:'Park'},{name:'Rec',value:'Rec'},{name:'Pro-Am',value:'Pro-Am'},{name:'MyTeam',value:'MyTeam'}))
    .addStringOption(o => o.setName('plattform').setDescription('PS5 / Xbox / PC').setRequired(true)
      .addChoices({name:'PS5',value:'PS5'},{name:'Xbox',value:'Xbox'},{name:'PC',value:'PC'}))
    .addStringOption(o => o.setName('positionen').setDescription('z. B. „PG, C“').setRequired(true))
    .addIntegerOption(o => o.setName('slots').setDescription('Mitspieleranzahl').setMinValue(1).setMaxValue(5).setRequired(true))
    .addStringOption(o => o.setName('notiz').setDescription('Badges/REP/Region').setRequired(false))
    .addIntegerOption(o => o.setName('ttl_minutes').setDescription('Ablaufzeit (Minuten, Standard 120)').setMinValue(15).setMaxValue(1440).setRequired(false))
);

// ==== ab hier nichts ändern ====
const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // <-- nur 1 Guild (Testserver)

if (!token || !clientId || !guildId) {
  console.error('Missing DISCORD_TOKEN/CLIENT_ID/GUILD_ID'); process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`📤 Registriere Guild-Commands für GUILD_ID=${guildId} …`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands.map(c => c.toJSON()),
    });
    console.log(`✅ Fertig. (${commands.length} Commands)`);
  } catch (error) {
    console.error('❌ Deploy-Fehler:', error);
    process.exit(1);
  }
})();
