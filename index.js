import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

// === Token holen & säubern ===
const rawToken = process.env.DISCORD_TOKEN ?? '';
const token = rawToken.trim();

// Token-Preview maskieren (nur für Log)
function mask(str, keep = 4) {
  if (!str) return '<leer>';
  if (str.length <= keep * 2) return str.replace(/./g, '•');
  return str.slice(0, keep) + '…' + str.slice(-keep);
}

const diagnostics = {
  gesetzt: !!rawToken,
  länge: token.length,
  punktAnzahl: (token.match(/\./g) || []).length,
  hatLeerzeichen: /\s/.test(token),
  startetMitBot: token.startsWith('Bot '),
  vorschau: mask(token)
};

console.log('🔍 TOKEN-DIAGNOSE:', diagnostics);

// === Validierungen ===
if (!diagnostics.gesetzt) {
  console.error('❌ Kein DISCORD_TOKEN gesetzt. In Railway unter Variables hinzufügen.');
  process.exit(1);
}
if (diagnostics.startetMitBot) {
  console.error('❌ Token darf NICHT mit "Bot " beginnen – nur den reinen Token eintragen.');
  process.exit(1);
}
if (diagnostics.punktAnzahl !== 2) {
  console.error('❌ Falsches Token-Format – es muss genau 2 Punkte haben (a.b.c).');
  process.exit(1);
}
if (diagnostics.hatLeerzeichen) {
  console.error('❌ Token enthält Leerzeichen oder Zeilenumbrüche. Bitte ohne Extras eintragen.');
  process.exit(1);
}

// === Bot starten ===
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
});

client.login(token).catch(err => {
  console.error('❌ Login-Fehler:', err);
  process.exit(1);
});
