// Stat tables for the fc/fifa page. Shared by the server (to clean saved values),
// the admin page (to build the entry forms) and the public page (to build the tables).
//
// Field types: text, choice, bool, int, rating (0–10), pct (0–100).
// `total` fields add up across seasons; `average` fields are averaged, weighted by `weight`.
const FC_SCHEMA = {
  proClubs: {
    title: 'pro clubs',
    required: 'player',
    weight: 'matches',
    fields: [
      { key: 'game', label: 'game', type: 'choice', options: ['FC24', 'FC25', 'FC26'] },
      { key: 'player', label: 'player', type: 'text' },
      { key: 'me', label: 'this is me', type: 'bool' },
      { key: 'position', label: 'position', short: 'pos', type: 'text' },
      { key: 'matches', label: 'matches', short: 'mp', type: 'int', total: true },
      { key: 'goals', label: 'goals', type: 'int', total: true },
      { key: 'assists', label: 'assists', type: 'int', total: true },
      { key: 'rating', label: 'avg rating', short: 'rating', type: 'rating', average: true },
      { key: 'motm', label: 'man of the match', short: 'motm', type: 'int', total: true },
      { key: 'cleanSheets', label: 'clean sheets', short: 'cs', type: 'int', total: true },
      { key: 'passPct', label: 'pass %', type: 'pct', average: true },
      { key: 'shotPct', label: 'shot %', type: 'pct', average: true },
      { key: 'tackles', label: 'tackles', type: 'int', total: true },
      { key: 'redCards', label: 'red cards', short: 'reds', type: 'int', total: true },
    ],
  },
  careerSeasons: {
    title: 'southampton seasons',
    required: 'season',
    fields: [
      { key: 'season', label: 'season', type: 'text', placeholder: '2024/25' },
      { key: 'competition', label: 'league', type: 'text', placeholder: 'Premier League' },
      { key: 'finish', label: 'league finish', short: 'pos', type: 'int' },
      { key: 'wins', label: 'wins', short: 'w', type: 'int' },
      { key: 'draws', label: 'draws', short: 'd', type: 'int' },
      { key: 'losses', label: 'losses', short: 'l', type: 'int' },
      { key: 'goalsFor', label: 'goals for', short: 'gf', type: 'int' },
      { key: 'goalsAgainst', label: 'goals against', short: 'ga', type: 'int' },
      { key: 'points', label: 'points', short: 'pts', type: 'int' },
    ],
  },
  careerPlayers: {
    title: 'southampton players',
    required: 'player',
    weight: 'apps',
    fields: [
      { key: 'season', label: 'season', type: 'text', placeholder: '2024/25' },
      { key: 'player', label: 'player', type: 'text' },
      { key: 'position', label: 'position', short: 'pos', type: 'text' },
      { key: 'apps', label: 'appearances', short: 'apps', type: 'int', total: true },
      { key: 'goals', label: 'goals', type: 'int', total: true },
      { key: 'assists', label: 'assists', type: 'int', total: true },
      { key: 'rating', label: 'avg rating', short: 'rating', type: 'rating', average: true },
      { key: 'cleanSheets', label: 'clean sheets', short: 'cs', type: 'int', total: true },
    ],
  },
  trophies: {
    title: 'trophies',
    required: 'name',
    fields: [
      { key: 'season', label: 'season', type: 'text', placeholder: '2024/25' },
      { key: 'name', label: 'trophy', type: 'text', placeholder: 'FA Cup' },
    ],
  },
};

if (typeof module !== 'undefined') module.exports = FC_SCHEMA;
