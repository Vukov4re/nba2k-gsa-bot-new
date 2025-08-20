// config/roles.js
// 👉 Hier nur Namen/Emojis/Text anpassen – der Rest vom Code nutzt diese Werte automatisch.

export const BASE_ROLES = {
  // Rollen, die beim /setup2k sichergestellt werden
  platforms: ['PS5', 'Xbox', 'PC'],
  countries: ['Deutschland', 'Schweiz', 'Österreich'],
  positions: ['PG', 'SG', 'SF', 'PF', 'C'],
  styles: ['Casual', 'Comp/Pro-Am', 'MyCareer', 'Park/Rec', 'MyTeam'],

  // Pflicht-Rolle nach Verifizierung
  accessRole: 'Mitglied',

  // Kanal-Namen (falls du umbenennen willst)
  categoryInfo: '📢 Info & Regeln',
  channelRules: '📜│regeln',
  channelNews: '📢│ankündigungen',
  channelRoles: '🎯│rolle-zuweisen',
  channelVerify: '🧾│rep-verifizierung',
};

// Anzeige-Labels der Buttons (falls du von den Rollennamen abweichen willst)
export const BUTTON_LABELS = {
  platforms: ['PS5', 'Xbox', 'PC'],
  positions: ['PG', 'SG', 'SF', 'PF', 'C'],
  styles: ['Casual', 'Comp/Pro-Am', 'MyCareer', 'Park/Rec', 'MyTeam'],
  countries: ['Deutschland', 'Schweiz', 'Österreich'],
};

// REP-Ränge (Anzeige + Emoji)
export const REP = {
  display: {
    rookie: 'Rookie',
    pro: 'Pro',
    'all-star': 'All-Star',
    superstar: 'Superstar',
    elite: 'Elite',
    legend: 'Legend',
  },
  emojis: {
    rookie: '🟢',
    pro: '🔵',
    'all-star': '🟣',
    superstar: '🟠',
    elite: '🔴',
    legend: '🟡',
  },
  levels: [1, 2, 3, 4, 5],

  /**
   * 🔧 Wie die REP-Rollennamen gebaut werden.
   * Du kannst das Muster anpassen, z. B. ohne Emoji:
   *    return `${display} ${level}`;
   * oder deutsch:
   *    return `${display} Stufe ${level}`;
   */
  makeRoleName(rankKey, level) {
    const display = this.display[rankKey] || rankKey;
    const emoji = this.emojis[rankKey] || '';
    return `${emoji} ${display} ${level}`.trim();
  }
};

// Text für die Verifizierungs-Anleitung
export const VERIFY_TEXT =
  '📌 **So bekommst du deinen REP-Rang:**\n' +
  '1) Poste hier einen **Screenshot** deines aktuellen REP.\n' +
  '2) Ein Mod prüft und setzt deinen Rang mit `/rep`.\n' +
  '3) Bei Upgrade später einfach wieder Screenshot posten.\n\n' +
  'ℹ️ Mods: `/rep user:@Name rank:<Rookie|Pro|All-Star|Superstar|Elite|Legend> level:<1–5>`';
