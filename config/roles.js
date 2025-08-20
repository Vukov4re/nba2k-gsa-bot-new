// config/roles.js

export const BASE_ROLES = {
  platforms: ['PS5', 'Xbox', 'PC'],
  countries: ['Deutschland', 'Schweiz', 'Österreich'],
  positions: ['PG', 'SG', 'SF', 'PF', 'C'],
  styles: ['Casual', 'Comp/Pro-Am', 'MyCareer', 'Park/Rec', 'MyTeam'],

  accessRole: 'Mitglied',

  categoryInfo: '📢 Info & Regeln',
  channelRules: '📜│regeln',
  channelNews: '📢│ankündigungen',
  channelRoles: '🎯│rolle-zuweisen',
  channelVerify: '🧾│rep-verifizierung',
};

export const BUTTON_LABELS = {
  platforms: ['PS5', 'Xbox', 'PC'],
  positions: ['PG', 'SG', 'SF', 'PF', 'C'],
  styles: ['Casual', 'Comp/Pro-Am', 'MyCareer', 'Park/Rec', 'MyTeam'],
  countries: ['Deutschland', 'Schweiz', 'Österreich'],
};

export const REP = {
  display: {
    rookie: 'Rookie',
    pro: 'Starter',                     // angepasst
    'all-star': 'All-Star (Reserve)',   // angepasst
    superstar: 'Superstar (Reserve)',   // angepasst
    elite: 'Veteran',                   // angepasst
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

  makeRoleName(rankKey, level) {
    const display = this.display[rankKey] || rankKey;
    const emoji = this.emojis[rankKey] || '';
    return `${emoji} ${display} ${level}`.trim();
  }
};

export const VERIFY_TEXT =
  '📌 **So bekommst du deinen REP-Rang:**\n' +
  '1) Poste hier einen **Screenshot** deines aktuellen REP.\n' +
  '2) Ein Mod prüft und setzt deinen Rang mit `/rep`.\n' +
  '3) Bei Upgrade später einfach wieder Screenshot posten.\n\n' +
  'ℹ️ Mods: `/rep user:@Name rank:<Rookie|Starter|All-Star (Reserve)|Superstar (Reserve)|Veteran|Legend> level:<1–5>`';
