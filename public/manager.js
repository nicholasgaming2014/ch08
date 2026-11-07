// ch08 manager — football match simulation
// Pre-loaded players, match engine, team selection and pitch visualization.

// ========== PRE-LOADED PLAYERS ==========
// [name, pos, ovr, pac, sho, pas, dri, def, phy]
const _BP = [
  // Goalkeepers
  ['T. Courtois', 'GK', 90, 50, 15, 55, 28, 88, 85],
  ['G. Donnarumma', 'GK', 88, 48, 12, 45, 25, 86, 82],
  ['Alisson', 'GK', 89, 50, 14, 60, 30, 87, 84],
  ['Ederson', 'GK', 88, 50, 16, 70, 32, 84, 80],
  ['J. Oblak', 'GK', 88, 46, 10, 42, 22, 88, 86],
  // Centre-backs
  ['V. van Dijk', 'CB', 89, 72, 48, 68, 55, 90, 86],
  ['R. Dias', 'CB', 87, 58, 42, 65, 52, 87, 82],
  ['W. Saliba', 'CB', 86, 74, 38, 62, 58, 86, 80],
  ['R. Araujo', 'CB', 85, 78, 35, 55, 48, 85, 84],
  ['Marquinhos', 'CB', 85, 68, 42, 66, 60, 86, 78],
  ['A. Bastoni', 'CB', 86, 62, 40, 72, 62, 84, 76],
  ['D. Upamecano', 'CB', 84, 82, 42, 55, 52, 82, 86],
  ['A. Konaté', 'CB', 84, 80, 35, 52, 48, 84, 86],
  // Full-backs
  ['A. Davies', 'LB', 84, 96, 55, 72, 80, 70, 76],
  ['A. Robertson', 'LB', 84, 80, 50, 80, 72, 76, 78],
  ['T. Hernandez', 'LB', 85, 88, 68, 70, 76, 68, 82],
  ['T. Alexander-Arnold', 'RB', 87, 72, 62, 90, 78, 70, 66],
  ['A. Hakimi', 'RB', 85, 90, 60, 72, 76, 68, 78],
  ['J. Cancelo', 'RB', 84, 82, 58, 82, 84, 68, 70],
  // Defensive midfielders
  ['Rodri', 'CDM', 90, 58, 68, 82, 78, 86, 80],
  ['D. Rice', 'CDM', 87, 68, 62, 76, 72, 86, 82],
  ['Casemiro', 'CDM', 84, 60, 58, 68, 58, 82, 84],
  // Central midfielders
  ['J. Bellingham', 'CM', 89, 76, 82, 78, 80, 72, 82],
  ['L. Modric', 'CM', 87, 68, 72, 88, 88, 62, 60],
  ['Pedri', 'CM', 87, 70, 65, 86, 90, 64, 62],
  ['F. Valverde', 'CM', 87, 86, 74, 78, 78, 78, 80],
  ['N. Barella', 'CM', 86, 78, 76, 80, 78, 74, 76],
  ['B. Silva', 'CM', 87, 66, 70, 84, 90, 62, 60],
  ['F. de Jong', 'CM', 85, 72, 55, 84, 88, 74, 68],
  // Attacking midfielders
  ['K. De Bruyne', 'CAM', 91, 72, 86, 93, 88, 58, 74],
  ['Bruno Fernandes', 'CAM', 86, 68, 84, 86, 82, 50, 70],
  ['M. Ødegaard', 'CAM', 88, 62, 78, 88, 90, 42, 58],
  // Left wingers
  ['Vinicius Jr', 'LW', 90, 95, 82, 78, 92, 28, 68],
  ['Son Heung-min', 'LW', 87, 88, 86, 78, 84, 38, 68],
  ['R. Leão', 'LW', 86, 92, 76, 70, 88, 32, 72],
  ['M. Rashford', 'LW', 84, 92, 78, 62, 82, 38, 74],
  // Right wingers
  ['M. Salah', 'RW', 89, 88, 87, 82, 86, 42, 72],
  ['B. Saka', 'RW', 87, 84, 78, 82, 86, 52, 62],
  ['O. Dembélé', 'RW', 86, 90, 72, 78, 90, 32, 56],
  ['Raphinha', 'RW', 85, 82, 78, 76, 84, 42, 66],
  // Strikers
  ['K. Mbappé', 'ST', 91, 97, 89, 80, 88, 36, 76],
  ['E. Haaland', 'ST', 91, 88, 93, 65, 78, 42, 88],
  ['H. Kane', 'ST', 88, 62, 91, 82, 74, 52, 78],
  ['R. Lewandowski', 'ST', 87, 58, 90, 76, 78, 42, 76],
  ['Lautaro Martínez', 'ST', 87, 82, 86, 68, 80, 36, 78],
  ['V. Osimhen', 'ST', 86, 90, 84, 55, 72, 28, 82],
  ['A. Isak', 'ST', 85, 88, 82, 68, 78, 34, 72],
  ['Darwin Núñez', 'ST', 84, 90, 82, 55, 72, 28, 78],
  // Second strikers / forwards
  ['A. Griezmann', 'CF', 85, 70, 82, 80, 82, 56, 70],
  ['J. Álvarez', 'CF', 84, 78, 78, 72, 80, 52, 72],
];

const BUILTIN_PLAYERS = _BP.map(([name, position, overall, pace, shooting, passing, dribbling, defending, physical], i) => ({
  id: `bp${String(i).padStart(3, '0')}`,
  name, position, overall, pace, shooting, passing, dribbling, defending, physical,
  photo: '', builtin: true,
}));

// ========== CONSTANTS ==========

const POS_GROUPS = {
  GK: ['GK'],
  DEF: ['CB', 'LB', 'RB'],
  MID: ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  ATT: ['LW', 'RW', 'ST', 'CF'],
};

const FORMATIONS = {
  '4-3-3': [
    { slot: 'GK',  x: 0.50, y: 0.92 },
    { slot: 'LB',  x: 0.12, y: 0.72 },
    { slot: 'CB',  x: 0.35, y: 0.78 },
    { slot: 'CB',  x: 0.65, y: 0.78 },
    { slot: 'RB',  x: 0.88, y: 0.72 },
    { slot: 'CM',  x: 0.25, y: 0.52 },
    { slot: 'CM',  x: 0.50, y: 0.48 },
    { slot: 'CM',  x: 0.75, y: 0.52 },
    { slot: 'LW',  x: 0.12, y: 0.25 },
    { slot: 'ST',  x: 0.50, y: 0.15 },
    { slot: 'RW',  x: 0.88, y: 0.25 },
  ],
  '4-4-2': [
    { slot: 'GK',  x: 0.50, y: 0.92 },
    { slot: 'LB',  x: 0.12, y: 0.72 },
    { slot: 'CB',  x: 0.35, y: 0.78 },
    { slot: 'CB',  x: 0.65, y: 0.78 },
    { slot: 'RB',  x: 0.88, y: 0.72 },
    { slot: 'LM',  x: 0.12, y: 0.48 },
    { slot: 'CM',  x: 0.38, y: 0.52 },
    { slot: 'CM',  x: 0.62, y: 0.52 },
    { slot: 'RM',  x: 0.88, y: 0.48 },
    { slot: 'ST',  x: 0.38, y: 0.18 },
    { slot: 'ST',  x: 0.62, y: 0.18 },
  ],
  '4-2-3-1': [
    { slot: 'GK',  x: 0.50, y: 0.92 },
    { slot: 'LB',  x: 0.12, y: 0.72 },
    { slot: 'CB',  x: 0.35, y: 0.78 },
    { slot: 'CB',  x: 0.65, y: 0.78 },
    { slot: 'RB',  x: 0.88, y: 0.72 },
    { slot: 'CDM', x: 0.38, y: 0.56 },
    { slot: 'CDM', x: 0.62, y: 0.56 },
    { slot: 'LW',  x: 0.15, y: 0.32 },
    { slot: 'CAM', x: 0.50, y: 0.35 },
    { slot: 'RW',  x: 0.85, y: 0.32 },
    { slot: 'ST',  x: 0.50, y: 0.15 },
  ],
  '3-5-2': [
    { slot: 'GK',  x: 0.50, y: 0.92 },
    { slot: 'CB',  x: 0.22, y: 0.76 },
    { slot: 'CB',  x: 0.50, y: 0.80 },
    { slot: 'CB',  x: 0.78, y: 0.76 },
    { slot: 'LB',  x: 0.08, y: 0.52 },
    { slot: 'CM',  x: 0.30, y: 0.52 },
    { slot: 'CDM', x: 0.50, y: 0.56 },
    { slot: 'CM',  x: 0.70, y: 0.52 },
    { slot: 'RB',  x: 0.92, y: 0.52 },
    { slot: 'ST',  x: 0.38, y: 0.18 },
    { slot: 'ST',  x: 0.62, y: 0.18 },
  ],
  '4-1-2-1-2': [
    { slot: 'GK',  x: 0.50, y: 0.92 },
    { slot: 'LB',  x: 0.12, y: 0.72 },
    { slot: 'CB',  x: 0.35, y: 0.78 },
    { slot: 'CB',  x: 0.65, y: 0.78 },
    { slot: 'RB',  x: 0.88, y: 0.72 },
    { slot: 'CDM', x: 0.50, y: 0.58 },
    { slot: 'CM',  x: 0.30, y: 0.44 },
    { slot: 'CM',  x: 0.70, y: 0.44 },
    { slot: 'CAM', x: 0.50, y: 0.32 },
    { slot: 'ST',  x: 0.38, y: 0.15 },
    { slot: 'ST',  x: 0.62, y: 0.15 },
  ],
};

const FORMATION_NAMES = Object.keys(FORMATIONS);

const SLOT_COMPAT = {
  GK:  ['GK'],
  LB:  ['LB', 'CB', 'LW', 'LM', 'CDM'],
  CB:  ['CB', 'CDM', 'LB', 'RB'],
  RB:  ['RB', 'CB', 'RW', 'RM', 'CDM'],
  CDM: ['CDM', 'CM', 'CB'],
  CM:  ['CM', 'CDM', 'CAM', 'LM', 'RM'],
  CAM: ['CAM', 'CM', 'CF', 'ST'],
  LM:  ['LM', 'LW', 'CM', 'LB'],
  RM:  ['RM', 'RW', 'CM', 'RB'],
  LW:  ['LW', 'LM', 'ST', 'CF', 'CAM'],
  RW:  ['RW', 'RM', 'ST', 'CF', 'CAM'],
  ST:  ['ST', 'CF', 'LW', 'RW', 'CAM'],
};

const CARD_COLORS = {
  legend: { bg: ['#1a1a2e', '#16213e'], text: '#e0c868', name: '#fff' },
  gold:   { bg: ['#c6a338', '#8b6914'], text: '#1a1000', name: '#1a1000' },
  silver: { bg: ['#b8b8b8', '#707070'], text: '#111', name: '#111' },
  bronze: { bg: ['#a5694e', '#6b3a20'], text: '#fff', name: '#fff' },
};

function cardTier(overall) {
  if (overall >= 90) return 'legend';
  if (overall >= 85) return 'gold';
  if (overall >= 80) return 'silver';
  return 'bronze';
}

// ========== STATE ==========

let mgrState = 'select';
let homeSquad = [];   // array of 11 slots: each null or a player object
let awaySquad = [];
let homeName = 'Home';
let awayName = 'Away';
let homeFormation = '4-3-3';
let awayFormation = '4-3-3';
let selectingTeam = 'home';
let posFilter = 'ALL';
let allPlayers = [...BUILTIN_PLAYERS];
let customPlayers = [];
let matchHistory = [];
let currentMatch = null;
let matchAnimFrame = null;
let matchTimer = null;
let matchSpeed = 1;
let dragPlayer = null;
let dragCard = null;

// ========== MATCH ENGINE ==========

function teamStrength(players, area) {
  const fns = {
    attack: p => (p.shooting * 2.5 + p.dribbling * 1.5 + p.pace) / 5,
    midfield: p => (p.passing * 2 + p.dribbling * 1.5 + p.physical * 0.5) / 4,
    defense: p => (p.defending * 2.5 + p.physical * 1.5 + p.pace * 0.5) / 4.5,
    goalkeeper: p => (p.defending * 3 + p.physical * 2 + p.pace * 0.5) / 5.5,
  };
  const relevance = {
    attack:  { ST: 1, CF: 0.9, LW: 0.9, RW: 0.9, CAM: 0.7, CM: 0.3, LM: 0.6, RM: 0.6 },
    midfield:{ CM: 1, CAM: 0.9, CDM: 0.9, LM: 0.8, RM: 0.8, LW: 0.3, RW: 0.3, CF: 0.3, ST: 0.1 },
    defense: { CB: 1, LB: 0.9, RB: 0.9, CDM: 0.7, CM: 0.3, GK: 0.1 },
  };
  if (area === 'goalkeeper') {
    const gk = players.find(p => p.position === 'GK');
    return gk ? fns.goalkeeper(gk) : 30;
  }
  const rel = relevance[area] || {};
  let total = 0, wt = 0;
  players.forEach(p => {
    const r = rel[p.position] || 0.05;
    total += fns[area](p) * r;
    wt += r;
  });
  return wt > 0 ? total / wt : 40;
}

function pickPlayer(players, area) {
  const weights = {
    attack:     { ST: 5, CF: 4, LW: 4, RW: 4, CAM: 3, CM: 1, LM: 2, RM: 2 },
    defense:    { CB: 5, LB: 3, RB: 3, CDM: 4, CM: 2, GK: 0.5 },
    midfield:   { CM: 5, CAM: 4, CDM: 4, LM: 3, RM: 3, LW: 1, RW: 1 },
    goalkeeper: { GK: 10 },
  };
  const w = weights[area] || {};
  let total = 0;
  const weighted = players.map(p => {
    const wt = w[p.position] || 0.3;
    total += wt;
    return { player: p, weight: wt };
  });
  let r = Math.random() * total;
  for (const c of weighted) {
    r -= c.weight;
    if (r <= 0) return c.player;
  }
  return players[0];
}

function createMatch(home, away) {
  const stoppageTime = Math.floor(Math.random() * 5) + 1;
  return {
    home: { name: home.name, players: home.players, score: 0 },
    away: { name: away.name, players: away.players, score: 0 },
    minute: 0,
    events: [],
    possession: { home: 50, away: 50 },
    stoppageTime,
    finished: false,
    ball: { x: 0.5, y: 0.5 },
    stats: { home: { shots: 0, shotsOnTarget: 0, fouls: 0, corners: 0, yellowCards: 0, redCards: 0 },
             away: { shots: 0, shotsOnTarget: 0, fouls: 0, corners: 0, yellowCards: 0, redCards: 0 } },
  };
}

function simulateMinute(match) {
  const { home, away } = match;
  const homeMid = teamStrength(home.players, 'midfield');
  const awayMid = teamStrength(away.players, 'midfield');
  const homePos = homeMid / (homeMid + awayMid);
  match.possession.home = Math.round(homePos * 100);
  match.possession.away = 100 - match.possession.home;

  const attSide = Math.random() < homePos ? 'home' : 'away';
  const defSide = attSide === 'home' ? 'away' : 'home';
  const attTeam = match[attSide];
  const defTeam = match[defSide];

  if (Math.random() > 0.16) return null;

  const attStr = teamStrength(attTeam.players, 'attack');
  const defStr = teamStrength(defTeam.players, 'defense');
  const gkStr = teamStrength(defTeam.players, 'goalkeeper');
  const roll = Math.random();

  if (roll < 0.40) {
    const attacker = pickPlayer(attTeam.players, 'attack');
    match.stats[attSide].shots++;
    const onTarget = Math.random() < (attStr / (attStr + defStr * 0.8)) * 0.65;
    if (onTarget) {
      match.stats[attSide].shotsOnTarget++;
      const goalChance = (attStr / (attStr + gkStr * 1.6)) * 0.42;
      if (Math.random() < goalChance) {
        attTeam.score++;
        const ev = { minute: match.minute, type: 'goal', team: attSide, player: attacker.name };
        match.events.push(ev);
        return ev;
      } else {
        const gk = pickPlayer(defTeam.players, 'goalkeeper');
        const ev = { minute: match.minute, type: 'save', team: defSide, player: gk.name, attacker: attacker.name, attTeam: attSide };
        match.events.push(ev);
        return ev;
      }
    } else {
      const ev = { minute: match.minute, type: 'miss', team: attSide, player: attacker.name };
      match.events.push(ev);
      return ev;
    }
  } else if (roll < 0.62) {
    const fouler = pickPlayer(defTeam.players, 'defense');
    const fouled = pickPlayer(attTeam.players, 'attack');
    match.stats[defSide].fouls++;
    let card = null;
    const cardRoll = Math.random();
    if (cardRoll < 0.04) { card = 'red'; match.stats[defSide].redCards++; }
    else if (cardRoll < 0.22) { card = 'yellow'; match.stats[defSide].yellowCards++; }
    const ev = { minute: match.minute, type: 'foul', team: defSide, player: fouler.name, fouled: fouled.name, card };
    match.events.push(ev);
    return ev;
  } else if (roll < 0.78) {
    match.stats[attSide].corners++;
    const ev = { minute: match.minute, type: 'corner', team: attSide };
    match.events.push(ev);
    return ev;
  } else if (roll < 0.90) {
    const player = pickPlayer(attTeam.players, 'attack');
    const ev = { minute: match.minute, type: 'offside', team: attSide, player: player.name };
    match.events.push(ev);
    return ev;
  } else {
    const ev = { minute: match.minute, type: 'freekick', team: attSide };
    match.events.push(ev);
    return ev;
  }
}

// ========== COMMENTARY ==========

function commentaryText(ev, match) {
  const teamName = match[ev.team]?.name || ev.team;
  const otherName = match[ev.team === 'home' ? 'away' : 'home']?.name || '';
  switch (ev.type) {
    case 'goal': return `GOAL! ${ev.player} scores for ${teamName}!`;
    case 'save': return `${ev.player} saves! ${ev.attacker} denied.`;
    case 'miss': return `${ev.player} shoots wide for ${teamName}.`;
    case 'foul': {
      let text = `Foul by ${ev.player}.`;
      if (ev.card === 'yellow') text += ' Yellow card!';
      if (ev.card === 'red') text += ' RED CARD!';
      return text;
    }
    case 'corner': return `Corner kick to ${teamName}.`;
    case 'offside': return `${ev.player} caught offside.`;
    case 'freekick': return `Free kick to ${teamName}.`;
    case 'kickoff': return 'And we\'re underway!';
    case 'halftime': return `Half time. ${match.home.name} ${match.home.score} - ${match.away.score} ${match.away.name}`;
    case 'fulltime': return `Full time! ${match.home.name} ${match.home.score} - ${match.away.score} ${match.away.name}`;
    default: return '';
  }
}

// ========== PITCH RENDERER ==========

let pitchPositions = new Map();
let pitchTargets = new Map();
let ballPos = { x: 0.5, y: 0.5 };
let ballTarget = { x: 0.5, y: 0.5 };

function initPositions(match) {
  pitchPositions.clear();
  pitchTargets.clear();
  const placeTeam = (team, side, formationName) => {
    const formation = getFormation(formationName);
    const assigned = assignFormation(team.players, formationName);
    assigned.forEach((player, i) => {
      const slot = formation[i];
      let x = slot.x, y = slot.y;
      if (side === 'away') { x = 1 - x; y = 1 - y; }
      const key = side + '_' + i;
      pitchPositions.set(key, { x, y });
      pitchTargets.set(key, { x, y });
    });
  };
  placeTeam(match.home, 'home', match.homeFormation || '4-3-3');
  placeTeam(match.away, 'away', match.awayFormation || '4-3-3');
  ballPos = { x: 0.5, y: 0.5 };
  ballTarget = { x: 0.5, y: 0.5 };
}

function updatePositions(match, event) {
  const attShift = 0.04;
  const driftRange = 0.02;
  const attSide = event?.team || (Math.random() < 0.5 ? 'home' : 'away');

  ['home', 'away'].forEach(side => {
    const formation = getFormation(side === 'home' ? (match.homeFormation || '4-3-3') : (match.awayFormation || '4-3-3'));
    const isAtt = side === attSide || (event?.attTeam === side);
    for (let i = 0; i < 11; i++) {
      const key = side + '_' + i;
      const slot = formation[i];
      let x = slot.x, y = slot.y;
      if (side === 'away') { x = 1 - x; y = 1 - y; }
      const shift = isAtt ? -attShift : attShift;
      const yTarget = side === 'home' ? y + shift : y - shift;
      const dx = (Math.random() - 0.5) * driftRange * 2;
      const dy = (Math.random() - 0.5) * driftRange * 2;
      pitchTargets.set(key, {
        x: Math.max(0.03, Math.min(0.97, x + dx)),
        y: Math.max(0.03, Math.min(0.97, yTarget + dy)),
      });
    }
  });

  if (event) {
    const side = event.team;
    if (event.type === 'goal' || event.type === 'miss') {
      ballTarget = side === 'home' ? { x: 0.5 + (Math.random() - 0.5) * 0.3, y: 0.05 } : { x: 0.5 + (Math.random() - 0.5) * 0.3, y: 0.95 };
    } else if (event.type === 'save') {
      const goalSide = event.attTeam === 'home' ? 'away' : 'home';
      ballTarget = goalSide === 'away' ? { x: 0.5, y: 0.05 } : { x: 0.5, y: 0.95 };
    } else if (event.type === 'corner') {
      const endY = side === 'home' ? 0.02 : 0.98;
      ballTarget = { x: Math.random() < 0.5 ? 0.02 : 0.98, y: endY };
    } else {
      ballTarget = { x: 0.5 + (Math.random() - 0.5) * 0.4, y: 0.5 + (Math.random() - 0.5) * 0.4 };
    }
  } else {
    ballTarget = { x: 0.5 + (Math.random() - 0.5) * 0.5, y: 0.5 + (Math.random() - 0.5) * 0.5 };
  }
}

function lerpPositions() {
  const t = 0.06;
  pitchPositions.forEach((pos, key) => {
    const target = pitchTargets.get(key);
    if (target) {
      pos.x += (target.x - pos.x) * t;
      pos.y += (target.y - pos.y) * t;
    }
  });
  ballPos.x += (ballTarget.x - ballPos.x) * t * 1.5;
  ballPos.y += (ballTarget.y - ballPos.y) * t * 1.5;
}

function drawPitch(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  canvas.width = cw * ratio;
  canvas.height = ch * ratio;
  ctx.scale(ratio, ratio);

  ctx.fillStyle = '#0d1a0d';
  ctx.fillRect(0, 0, cw, ch);

  const pad = 12;
  const pw = cw - pad * 2;
  const ph = ch - pad * 2;
  const px = pad;
  const py = pad;

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;

  // Touchline
  ctx.strokeRect(px, py, pw, ph);
  // Halfway
  ctx.beginPath();
  ctx.moveTo(px, py + ph / 2);
  ctx.lineTo(px + pw, py + ph / 2);
  ctx.stroke();
  // Center circle
  ctx.beginPath();
  ctx.arc(px + pw / 2, py + ph / 2, ph * 0.1, 0, Math.PI * 2);
  ctx.stroke();
  // Center spot
  ctx.beginPath();
  ctx.arc(px + pw / 2, py + ph / 2, 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();
  // Penalty areas
  const paW = pw * 0.4;
  const paH = ph * 0.15;
  ctx.strokeRect(px + (pw - paW) / 2, py, paW, paH);
  ctx.strokeRect(px + (pw - paW) / 2, py + ph - paH, paW, paH);
  // Goal areas
  const gaW = pw * 0.2;
  const gaH = ph * 0.06;
  ctx.strokeRect(px + (pw - gaW) / 2, py, gaW, gaH);
  ctx.strokeRect(px + (pw - gaW) / 2, py + ph - gaH, gaW, gaH);

  // Players
  const r = Math.max(6, Math.min(10, pw * 0.018));
  pitchPositions.forEach((pos, key) => {
    const isHome = key.startsWith('home');
    const cx = px + pos.x * pw;
    const cy = py + pos.y * ph;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = isHome ? '#fff' : '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = isHome ? '#ccc' : '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Ball
  const bx = px + ballPos.x * pw;
  const by = px + ballPos.y * ph;
  ctx.beginPath();
  ctx.arc(bx, by, Math.max(3, r * 0.5), 0, Math.PI * 2);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ========== FORMATION ASSIGNMENT ==========

function getFormation(name) {
  return FORMATIONS[name] || FORMATIONS['4-3-3'];
}

function assignFormation(players, formationName) {
  const formation = getFormation(formationName || '4-3-3');
  const slots = formation.map(s => ({ ...s, assigned: null }));
  const unassigned = [...players];

  for (let pass = 0; pass < 2; pass++) {
    for (const slot of slots) {
      if (slot.assigned) continue;
      const compat = SLOT_COMPAT[slot.slot] || [slot.slot];
      const idx = unassigned.findIndex(p => (pass === 0 ? p.position === compat[0] : compat.includes(p.position)));
      if (idx >= 0) {
        slot.assigned = unassigned.splice(idx, 1)[0];
      }
    }
  }
  for (const slot of slots) {
    if (!slot.assigned && unassigned.length) slot.assigned = unassigned.shift();
  }
  return slots.map(s => s.assigned).filter(Boolean);
}

function filledCount(squad) {
  return squad.filter(Boolean).length;
}

function squadPlayers(squad) {
  return squad.filter(Boolean);
}

// ========== UI HELPERS ==========

function el(tag, cls, children) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (typeof children === 'string') node.textContent = children;
  else if (Array.isArray(children)) children.forEach(c => c && node.append(c));
  else if (children) node.append(children);
  return node;
}

function btn(text, cls, handler) {
  const b = el('button', cls, text);
  b.type = 'button';
  if (handler) b.addEventListener('click', handler);
  return b;
}

// ========== PLAYER CARD ==========

function renderCard(player, options = {}) {
  const { selected, onClick, small } = options;
  const tier = cardTier(player.overall);
  const colors = CARD_COLORS[tier];

  const card = el('div', `mgr-card tier-${tier}${selected ? ' selected' : ''}${small ? ' small' : ''}`);
  card.dataset.id = player.id;

  const header = el('div', 'card-header');
  const ovr = el('span', 'card-ovr', String(player.overall));
  const pos = el('span', 'card-pos', player.position);
  header.append(ovr, pos);

  const photoDiv = el('div', 'card-photo');
  if (player.photo) {
    const img = document.createElement('img');
    img.src = player.photo;
    img.alt = '';
    img.loading = 'lazy';
    photoDiv.append(img);
  } else {
    photoDiv.classList.add('silhouette');
  }

  const name = el('div', 'card-name', player.name);

  const stats = el('div', 'card-stats');
  const statData = [
    ['PAC', player.pace], ['SHO', player.shooting], ['PAS', player.passing],
    ['DRI', player.dribbling], ['DEF', player.defending], ['PHY', player.physical],
  ];
  statData.forEach(([label, value]) => {
    const s = el('div', 'card-stat');
    s.append(el('span', 'stat-val', String(value)), el('span', 'stat-label', label));
    stats.append(s);
  });

  card.append(header, photoDiv, name, stats);
  if (onClick) card.addEventListener('click', () => onClick(player));
  card.style.cursor = onClick ? 'pointer' : 'default';
  return card;
}

// ========== HORIZONTAL PITCH (SELECTION) ==========

function renderSelectionPitch() {
  const container = el('div', 'mgr-pitch-select');
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 800 440');
  svg.setAttribute('aria-label', 'Formation pitch');
  svg.classList.add('mgr-pitch-svg');

  const pad = 20;
  const pw = 760, ph = 400;

  // Pitch background
  const bg = document.createElementNS(svgNS, 'rect');
  Object.entries({ x: 0, y: 0, width: 800, height: 440, rx: 12, fill: '#0d1a0d' }).forEach(([k,v]) => bg.setAttribute(k,v));
  svg.append(bg);

  // Touchline
  const touchline = document.createElementNS(svgNS, 'rect');
  Object.entries({ x: pad, y: pad, width: pw, height: ph, fill: 'none', stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1.5 }).forEach(([k,v]) => touchline.setAttribute(k,v));
  svg.append(touchline);

  // Halfway line (vertical)
  const half = document.createElementNS(svgNS, 'line');
  Object.entries({ x1: 400, y1: pad, x2: 400, y2: pad + ph, stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1.5 }).forEach(([k,v]) => half.setAttribute(k,v));
  svg.append(half);

  // Center circle
  const cc = document.createElementNS(svgNS, 'circle');
  Object.entries({ cx: 400, cy: pad + ph/2, r: 50, fill: 'none', stroke: 'rgba(255,255,255,0.12)', 'stroke-width': 1.5 }).forEach(([k,v]) => cc.setAttribute(k,v));
  svg.append(cc);

  // Center spot
  const cs = document.createElementNS(svgNS, 'circle');
  Object.entries({ cx: 400, cy: pad + ph/2, r: 3, fill: 'rgba(255,255,255,0.25)' }).forEach(([k,v]) => cs.setAttribute(k,v));
  svg.append(cs);

  // Penalty areas (horizontal: left & right)
  const paH2 = ph * 0.4, paW2 = pw * 0.12;
  const gaH2 = ph * 0.2, gaW2 = pw * 0.05;
  // Left
  const paL = document.createElementNS(svgNS, 'rect');
  Object.entries({ x: pad, y: pad + (ph - paH2)/2, width: paW2, height: paH2, fill: 'none', stroke: 'rgba(255,255,255,0.15)', 'stroke-width': 1 }).forEach(([k,v]) => paL.setAttribute(k,v));
  svg.append(paL);
  const gaL = document.createElementNS(svgNS, 'rect');
  Object.entries({ x: pad, y: pad + (ph - gaH2)/2, width: gaW2, height: gaH2, fill: 'none', stroke: 'rgba(255,255,255,0.15)', 'stroke-width': 1 }).forEach(([k,v]) => gaL.setAttribute(k,v));
  svg.append(gaL);
  // Right
  const paR = document.createElementNS(svgNS, 'rect');
  Object.entries({ x: pad + pw - paW2, y: pad + (ph - paH2)/2, width: paW2, height: paH2, fill: 'none', stroke: 'rgba(255,255,255,0.15)', 'stroke-width': 1 }).forEach(([k,v]) => paR.setAttribute(k,v));
  svg.append(paR);
  const gaR = document.createElementNS(svgNS, 'rect');
  Object.entries({ x: pad + pw - gaW2, y: pad + (ph - gaH2)/2, width: gaW2, height: gaH2, fill: 'none', stroke: 'rgba(255,255,255,0.15)', 'stroke-width': 1 }).forEach(([k,v]) => gaR.setAttribute(k,v));
  svg.append(gaR);

  // Home team labels
  const homeLabel = document.createElementNS(svgNS, 'text');
  Object.entries({ x: 200, y: 16, 'text-anchor': 'middle', fill: '#fff', 'font-size': 13, 'font-family': 'Inter, sans-serif', 'font-weight': 600, opacity: 0.5 }).forEach(([k,v]) => homeLabel.setAttribute(k,v));
  homeLabel.textContent = (homeName || 'Home').toUpperCase();
  svg.append(homeLabel);

  const awayLabel = document.createElementNS(svgNS, 'text');
  Object.entries({ x: 600, y: 16, 'text-anchor': 'middle', fill: '#3b82f6', 'font-size': 13, 'font-family': 'Inter, sans-serif', 'font-weight': 600, opacity: 0.5 }).forEach(([k,v]) => awayLabel.setAttribute(k,v));
  awayLabel.textContent = (awayName || 'Away').toUpperCase();
  svg.append(awayLabel);

  // Draw slots for both teams
  const drawSlots = (formation, squad, side, color) => {
    formation.forEach((slot, i) => {
      let sx, sy;
      if (side === 'home') {
        sx = pad + (1 - slot.y) * (pw / 2 - 10);
        sy = pad + slot.x * ph;
      } else {
        sx = 400 + slot.y * (pw / 2 - 10);
        sy = pad + (1 - slot.x) * ph;
      }

      const player = squad[i] || null;
      const g = document.createElementNS(svgNS, 'g');
      g.classList.add('pitch-slot');
      g.dataset.side = side;
      g.dataset.index = i;

      const circle = document.createElementNS(svgNS, 'circle');
      if (player) {
        Object.entries({ cx: sx, cy: sy, r: 18, fill: color, stroke: 'rgba(0,0,0,0.4)', 'stroke-width': 2 }).forEach(([k,v]) => circle.setAttribute(k,v));
      } else {
        Object.entries({ cx: sx, cy: sy, r: 18, fill: 'rgba(255,255,255,0.05)', stroke: 'rgba(255,255,255,0.25)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }).forEach(([k,v]) => circle.setAttribute(k,v));
      }
      g.append(circle);

      // Drop zone (invisible, larger)
      const drop = document.createElementNS(svgNS, 'circle');
      Object.entries({ cx: sx, cy: sy, r: 28, fill: 'transparent', 'pointer-events': 'all' }).forEach(([k,v]) => drop.setAttribute(k,v));
      g.append(drop);

      if (player) {
        const name = document.createElementNS(svgNS, 'text');
        Object.entries({ x: sx, y: sy + 30, 'text-anchor': 'middle', fill: '#ccc', 'font-size': 10, 'font-family': 'Inter, sans-serif', 'pointer-events': 'none' }).forEach(([k,v]) => name.setAttribute(k,v));
        name.textContent = player.name.split(' ').pop();
        g.append(name);

        const ovr = document.createElementNS(svgNS, 'text');
        Object.entries({ x: sx, y: sy + 5, 'text-anchor': 'middle', fill: side === 'home' ? '#000' : '#fff', 'font-size': 14, 'font-weight': 700, 'font-family': 'Inter, sans-serif', 'pointer-events': 'none' }).forEach(([k,v]) => ovr.setAttribute(k,v));
        ovr.textContent = player.overall;
        g.append(ovr);

        // Click to remove
        g.style.cursor = 'pointer';
        g.addEventListener('click', () => {
          squad[i] = null;
          renderTeamSelection();
        });
      } else {
        const label = document.createElementNS(svgNS, 'text');
        Object.entries({ x: sx, y: sy + 4, 'text-anchor': 'middle', fill: 'rgba(255,255,255,0.35)', 'font-size': 11, 'font-family': 'Inter, sans-serif', 'pointer-events': 'none' }).forEach(([k,v]) => label.setAttribute(k,v));
        label.textContent = slot.slot;
        g.append(label);
      }

      svg.append(g);
    });
  };

  drawSlots(getFormation(homeFormation), homeSquad, 'home', '#fff');
  drawSlots(getFormation(awayFormation), awaySquad, 'away', '#3b82f6');

  // Drop handling on SVG
  svg.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  svg.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragPlayer) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 440 / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let bestDist = Infinity, bestSide = null, bestIdx = -1;
    const checkSlots = (formation, squad, side) => {
      formation.forEach((slot, i) => {
        let sx, sy;
        if (side === 'home') {
          sx = pad + (1 - slot.y) * (pw / 2 - 10);
          sy = pad + slot.x * ph;
        } else {
          sx = 400 + slot.y * (pw / 2 - 10);
          sy = pad + (1 - slot.x) * ph;
        }
        const d = Math.hypot(mx - sx, my - sy);
        if (d < 40 && d < bestDist && !squad[i]) {
          bestDist = d; bestSide = side; bestIdx = i;
        }
      });
    };
    checkSlots(getFormation(homeFormation), homeSquad, 'home');
    checkSlots(getFormation(awayFormation), awaySquad, 'away');

    if (bestSide && bestIdx >= 0) {
      // Remove from any other slot first
      removePlayerFromSquads(dragPlayer.id);
      if (bestSide === 'home') homeSquad[bestIdx] = dragPlayer;
      else awaySquad[bestIdx] = dragPlayer;
    }
    dragPlayer = null;
    dragCard = null;
    renderTeamSelection();
  });

  container.append(svg);
  return container;
}

function removePlayerFromSquads(playerId) {
  for (let i = 0; i < homeSquad.length; i++) {
    if (homeSquad[i] && homeSquad[i].id === playerId) homeSquad[i] = null;
  }
  for (let i = 0; i < awaySquad.length; i++) {
    if (awaySquad[i] && awaySquad[i].id === playerId) awaySquad[i] = null;
  }
}

function ensureSquadSize(squad, size) {
  while (squad.length < size) squad.push(null);
  if (squad.length > size) {
    const extra = squad.splice(size);
    extra.forEach(p => { /* dropped */ });
  }
}

// ========== TEAM SELECTION UI ==========

function renderTeamSelection() {
  ensureSquadSize(homeSquad, getFormation(homeFormation).length);
  ensureSquadSize(awaySquad, getFormation(awayFormation).length);

  const container = document.querySelector('.mgr-content');
  container.innerHTML = '';

  const topBar = el('div', 'mgr-top-bar');
  topBar.append(
    btn('new match', 'mgr-tab active', () => { mgrState = 'select'; renderManager(); }),
    btn('match history', 'mgr-tab', () => { mgrState = 'history'; renderManager(); })
  );
  container.append(topBar);

  // Team names row
  const namesRow = el('div', 'mgr-names-row');
  const homeInput = document.createElement('input');
  homeInput.type = 'text';
  homeInput.className = 'mgr-name-input';
  homeInput.value = homeName;
  homeInput.placeholder = 'Home Team';
  homeInput.maxLength = 30;
  homeInput.addEventListener('input', () => { homeName = homeInput.value; });

  const vs = el('span', 'mgr-vs', 'vs');

  const awayInput = document.createElement('input');
  awayInput.type = 'text';
  awayInput.className = 'mgr-name-input away';
  awayInput.value = awayName;
  awayInput.placeholder = 'Away Team';
  awayInput.maxLength = 30;
  awayInput.addEventListener('input', () => { awayName = awayInput.value; });

  namesRow.append(homeInput, vs, awayInput);
  container.append(namesRow);

  // Formation selectors
  const formRow = el('div', 'mgr-formation-selectors');

  const homeFormSel = document.createElement('select');
  homeFormSel.className = 'mgr-formation-select';
  FORMATION_NAMES.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    if (f === homeFormation) opt.selected = true;
    homeFormSel.append(opt);
  });
  homeFormSel.addEventListener('change', () => {
    homeFormation = homeFormSel.value;
    const old = homeSquad.filter(Boolean);
    homeSquad = [];
    ensureSquadSize(homeSquad, getFormation(homeFormation).length);
    old.forEach((p, i) => { if (i < homeSquad.length) homeSquad[i] = p; });
    renderTeamSelection();
  });

  const homeCount = el('span', 'mgr-count', `${filledCount(homeSquad)}/11`);

  const awayFormSel = document.createElement('select');
  awayFormSel.className = 'mgr-formation-select away';
  FORMATION_NAMES.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    if (f === awayFormation) opt.selected = true;
    awayFormSel.append(opt);
  });
  awayFormSel.addEventListener('change', () => {
    awayFormation = awayFormSel.value;
    const old = awaySquad.filter(Boolean);
    awaySquad = [];
    ensureSquadSize(awaySquad, getFormation(awayFormation).length);
    old.forEach((p, i) => { if (i < awaySquad.length) awaySquad[i] = p; });
    renderTeamSelection();
  });

  const awayCount = el('span', 'mgr-count', `${filledCount(awaySquad)}/11`);

  formRow.append(homeFormSel, homeCount, el('span', 'mgr-form-spacer'), awayCount, awayFormSel);
  container.append(formRow);

  // Horizontal pitch with both teams
  container.append(renderSelectionPitch());

  // Hint
  container.append(el('p', 'mgr-hint', 'Drag cards onto slots, or click a card then click a slot. Click a filled slot to remove.'));

  // Filter pills
  const filters = el('div', 'mgr-filters');
  ['ALL', 'GK', 'DEF', 'MID', 'ATT'].forEach(f => {
    filters.append(btn(f, `filter-pill${posFilter === f ? ' active' : ''}`, () => { posFilter = f; renderTeamSelection(); }));
  });
  container.append(filters);

  // Player card grid
  const grid = el('div', 'mgr-card-grid');
  const usedIds = new Set();
  homeSquad.forEach(p => { if (p) usedIds.add(p.id); });
  awaySquad.forEach(p => { if (p) usedIds.add(p.id); });

  let filtered = allPlayers.filter(p => {
    if (posFilter !== 'ALL') {
      const group = POS_GROUPS[posFilter] || [];
      if (!group.includes(p.position)) return false;
    }
    return true;
  });
  filtered.sort((a, b) => b.overall - a.overall);

  filtered.forEach(p => {
    const isUsed = usedIds.has(p.id);
    const card = renderCard(p, {
      selected: isUsed,
      onClick: () => {
        if (isUsed) {
          removePlayerFromSquads(p.id);
          renderTeamSelection();
          return;
        }
        // Click-to-assign: find first empty slot on the active team
        const squad = selectingTeam === 'home' ? homeSquad : awaySquad;
        const emptyIdx = squad.findIndex(s => s === null);
        if (emptyIdx >= 0) {
          squad[emptyIdx] = p;
          renderTeamSelection();
        }
      },
    });

    // Drag support
    if (!isUsed) {
      card.draggable = true;
      card.addEventListener('dragstart', e => {
        dragPlayer = p;
        dragCard = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', p.id);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        dragPlayer = null;
        dragCard = null;
      });
    }

    grid.append(card);
  });
  container.append(grid);

  // Team toggle (for click-to-assign)
  const teamToggle = el('div', 'mgr-team-toggle');
  teamToggle.append(el('span', 'mgr-toggle-label', 'Click assigns to:'));
  teamToggle.append(
    btn('Home', `filter-pill${selectingTeam === 'home' ? ' active' : ''}`, () => { selectingTeam = 'home'; document.querySelectorAll('.mgr-team-toggle .filter-pill').forEach((b, i) => b.classList.toggle('active', i === 0)); }),
    btn('Away', `filter-pill away-pill${selectingTeam === 'away' ? ' active' : ''}`, () => { selectingTeam = 'away'; document.querySelectorAll('.mgr-team-toggle .filter-pill').forEach((b, i) => b.classList.toggle('active', i === 1)); })
  );
  container.append(teamToggle);

  // Start match button
  const canStart = filledCount(homeSquad) === 11 && filledCount(awaySquad) === 11;
  const startBtn = btn('start match', `button mgr-start${canStart ? '' : ' disabled'}`, canStart ? startMatch : null);
  if (!canStart) startBtn.disabled = true;
  container.append(startBtn);
}

// ========== MATCH SIMULATION UI ==========

function startMatch() {
  matchSpeed = 1;
  currentMatch = createMatch(
    { name: homeName || 'Home', players: squadPlayers(homeSquad) },
    { name: awayName || 'Away', players: squadPlayers(awaySquad) }
  );
  currentMatch.homeFormation = homeFormation;
  currentMatch.awayFormation = awayFormation;
  mgrState = 'match';
  renderMatchView();
  initPositions(currentMatch);
  runMatch();
}

function renderMatchView() {
  const container = document.querySelector('.mgr-content');
  container.innerHTML = '';

  const match = currentMatch;

  // Scoreboard
  const scoreboard = el('div', 'mgr-scoreboard');
  const homeEl = el('span', 'mgr-team-name home', match.home.name);
  const scoreEl = el('span', 'mgr-score', `${match.home.score} : ${match.away.score}`);
  const awayEl = el('span', 'mgr-team-name away', match.away.name);
  scoreboard.append(homeEl, scoreEl, awayEl);

  const infoRow = el('div', 'mgr-info-row');
  const minuteEl = el('span', 'mgr-minute', match.minute > 0 ? `${match.minute}'` : 'kick off');
  const speedBtns = el('div', 'mgr-speed');
  [1, 2, 5].forEach(s => {
    speedBtns.append(btn(`${s}x`, `filter-pill${matchSpeed === s ? ' active' : ''}`, () => { matchSpeed = s; renderMatchViewUpdate(); }));
  });
  infoRow.append(minuteEl, speedBtns);
  container.append(scoreboard, infoRow);

  // Pitch canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'mgr-pitch';
  container.append(canvas);

  // Possession bar
  const possBar = el('div', 'mgr-possession');
  const possHome = el('div', 'mgr-poss-fill home');
  possHome.style.width = match.possession.home + '%';
  const possLabel = el('div', 'mgr-poss-label');
  possLabel.append(el('span', '', `${match.possession.home}%`), el('span', 'mgr-poss-text', 'possession'), el('span', '', `${match.possession.away}%`));
  possBar.append(possHome);
  container.append(possBar, possLabel);

  // Commentary feed
  const feed = el('div', 'mgr-commentary');
  feed.id = 'mgr-commentary';
  container.append(feed);

  // Start animation
  if (matchAnimFrame) cancelAnimationFrame(matchAnimFrame);
  function animate() {
    lerpPositions();
    drawPitch(canvas);
    matchAnimFrame = requestAnimationFrame(animate);
  }
  matchAnimFrame = requestAnimationFrame(animate);
}

function renderMatchViewUpdate() {
  const match = currentMatch;
  const minuteEl = document.querySelector('.mgr-minute');
  if (minuteEl) minuteEl.textContent = match.minute > 0 ? `${match.minute}'` : 'kick off';

  const scoreEl = document.querySelector('.mgr-score');
  if (scoreEl) scoreEl.textContent = `${match.home.score} : ${match.away.score}`;

  const possHome = document.querySelector('.mgr-poss-fill.home');
  if (possHome) possHome.style.width = match.possession.home + '%';

  const possLabel = document.querySelector('.mgr-poss-label');
  if (possLabel) {
    const spans = possLabel.querySelectorAll('span');
    if (spans[0]) spans[0].textContent = match.possession.home + '%';
    if (spans[2]) spans[2].textContent = match.possession.away + '%';
  }

  document.querySelectorAll('.mgr-speed .filter-pill').forEach((b, i) => {
    const s = [1, 2, 5][i];
    b.classList.toggle('active', matchSpeed === s);
  });
}

function addCommentary(text, type) {
  const feed = document.getElementById('mgr-commentary');
  if (!feed) return;
  const line = el('div', `mgr-comment${type === 'goal' ? ' goal' : type === 'halftime' || type === 'fulltime' ? ' break' : ''}`);
  line.textContent = text;
  feed.prepend(line);
}

async function runMatch() {
  const match = currentMatch;
  addCommentary('And we\'re underway!', 'kickoff');

  const delay = () => new Promise(r => {
    matchTimer = setTimeout(r, [2000, 1000, 400][Math.min(2, matchSpeed - 1)] || 1000);
  });

  for (let minute = 1; minute <= 90 + match.stoppageTime; minute++) {
    if (mgrState !== 'match') return;
    match.minute = minute;

    if (minute === 46) {
      addCommentary(commentaryText({ type: 'halftime' }, match), 'halftime');
      await delay();
    }

    const event = simulateMinute(match);
    updatePositions(match, event);
    renderMatchViewUpdate();

    if (event) {
      const text = `${event.minute}' — ${commentaryText(event, match)}`;
      addCommentary(text, event.type);
    }

    await delay();
  }

  match.finished = true;
  addCommentary(commentaryText({ type: 'fulltime' }, match), 'fulltime');
  renderMatchViewUpdate();
  if (matchAnimFrame) cancelAnimationFrame(matchAnimFrame);

  showMatchResult(match);
}

function showMatchResult(match) {
  const container = document.querySelector('.mgr-content');
  if (!container) return;

  // Keep the existing elements and add result overlay
  const result = el('div', 'mgr-result');
  result.append(el('h2', 'mgr-result-title', 'full time'));
  result.append(el('div', 'mgr-result-score', `${match.home.name}  ${match.home.score} - ${match.away.score}  ${match.away.name}`));

  const statsGrid = el('div', 'mgr-result-stats');
  const addStat = (label, h, a) => {
    statsGrid.append(el('span', 'stat-home', String(h)), el('span', 'stat-label', label), el('span', 'stat-away', String(a)));
  };
  addStat('shots', match.stats.home.shots, match.stats.away.shots);
  addStat('on target', match.stats.home.shotsOnTarget, match.stats.away.shotsOnTarget);
  addStat('possession', match.possession.home + '%', match.possession.away + '%');
  addStat('fouls', match.stats.home.fouls, match.stats.away.fouls);
  addStat('corners', match.stats.home.corners, match.stats.away.corners);
  addStat('yellow cards', match.stats.home.yellowCards, match.stats.away.yellowCards);
  addStat('red cards', match.stats.home.redCards, match.stats.away.redCards);
  result.append(statsGrid);

  const btnRow = el('div', 'button-row');
  btnRow.append(
    btn('save result', 'button', async () => {
      try {
        const historyEntry = {
          date: new Date().toISOString(),
          homeTeam: match.home.name,
          awayTeam: match.away.name,
          homeScore: match.home.score,
          awayScore: match.away.score,
          homePlayers: match.home.players.map(p => p.name),
          awayPlayers: match.away.players.map(p => p.name),
          events: match.events,
          stats: match.stats,
          possession: match.possession,
        };
        const resp = await fetch('/api/admin/manager/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ch08-admin' },
          body: JSON.stringify(historyEntry),
        });
        if (resp.ok) {
          const data = await resp.json();
          matchHistory = data.manager?.history || [];
          btnRow.querySelector('.button').textContent = 'saved ✓';
          btnRow.querySelector('.button').disabled = true;
        } else if (resp.status === 401) {
          btnRow.querySelector('.button').textContent = 'log in to save';
          btnRow.querySelector('.button').disabled = true;
        }
      } catch {}
    }),
    btn('play again', 'button secondary', () => {
      homeSquad = new Array(getFormation(homeFormation).length).fill(null);
      awaySquad = new Array(getFormation(awayFormation).length).fill(null);
      mgrState = 'select';
      renderManager();
    }),
    btn('rematch', 'button secondary', () => {
      mgrState = 'select';
      startMatch();
    })
  );
  result.append(btnRow);
  container.append(result);
}

// ========== MATCH HISTORY UI ==========

function renderMatchHistory() {
  const container = document.querySelector('.mgr-content');
  container.innerHTML = '';

  const topBar = el('div', 'mgr-top-bar');
  topBar.append(
    btn('new match', 'mgr-tab', () => { mgrState = 'select'; renderManager(); }),
    btn('match history', 'mgr-tab active', () => {})
  );
  container.append(topBar);

  if (!matchHistory.length) {
    container.append(el('p', 'empty-note', 'no matches played yet'));
    return;
  }

  const list = el('div', 'mgr-history');
  matchHistory.slice().reverse().forEach(m => {
    const row = el('div', 'mgr-history-row');
    const date = new Date(m.date);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    row.append(
      el('span', 'hist-date', dateStr),
      el('span', 'hist-home', m.homeTeam),
      el('span', 'hist-score', `${m.homeScore} - ${m.awayScore}`),
      el('span', 'hist-away', m.awayTeam)
    );
    list.append(row);
  });
  container.append(list);
}

// ========== MAIN RENDER ==========

function renderManager() {
  if (matchTimer) { clearTimeout(matchTimer); matchTimer = null; }
  if (matchAnimFrame) { cancelAnimationFrame(matchAnimFrame); matchAnimFrame = null; }

  switch (mgrState) {
    case 'select': renderTeamSelection(); break;
    case 'match': renderMatchView(); break;
    case 'history': renderMatchHistory(); break;
  }
}

function initManager(managerData) {
  customPlayers = managerData?.players || [];
  matchHistory = managerData?.history || [];
  allPlayers = [...BUILTIN_PLAYERS, ...customPlayers.map(p => ({ ...p, builtin: false }))];
  homeSquad = new Array(getFormation(homeFormation).length).fill(null);
  awaySquad = new Array(getFormation(awayFormation).length).fill(null);
  renderManager();
}
