import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

// === Token holen & prüfen ===
const raw = process.env.DISCORD_TOKEN ?? '';
const token = raw.trim(); // entfernt unsichtbare Spaces/Zeilenumbrüche

function mask(s, keep = 6) {
  if (!s) return '<empty>';
  if (s.length <= keep * 2) return s.replace(/./g, '•');
  return s.slice(0, keep) + '…' + s.slice(-keep);
}

const diagnostics = {
  present: !!raw,
  length: token.length,
  dotCount: (token.match(/\./g) || []).length,
  hasSpaces: /\s/.test(token),
  startsWithBotPrefix: token.startsWith('Bot '), // darf NICHT so sein!
  maskedPreview: mask(token),
};

console.log('🔎 TOKEN-DIAGNOSTIK:', diagnostics);

// **HARTE VALIDIERUNG** (Discord-Bot-Token hat 2 Punkte)
if (!diagnostics.present) {
  console.error('❌ Kein DISCORD_TOKEN gesetzt (Railway Variables).');
  process.exit(1);
}
if (diagnostics.startsWithBotPrefix) {
  console.error('❌ DISCORD_TOKEN darf NICHT mit "Bot " anfangen. Nur den reinen Token eintragen.');
  process.exit(1);
}
if (diagnostics.dotCount !== 2) {
  console.error('❌ Token-Format falsch: Ein gültiger Bot-Token hat GENAU zwei Punkte (a.b.c).');
  process.exit(1);
}
if (diagnostics.hasSpaces) {
  console.error('❌ Token enthält Leerzeichen/Zeilenumbrüche. Bitte in Railway ohne Extra-Zeichen eintragen.');
  process.exit(1);
}

// === Wenn wir hier ankommen, versuchen wir Login ===
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
});

client.login(token).catch((err) => {
  console.error('❌ Login-Fehler:', err);
  process.exit(1);
});
