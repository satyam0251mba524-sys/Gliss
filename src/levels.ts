export interface Position {
  row: number;
  col: number;
}

export interface Level {
  id: number;
  name: string;
  par: number;
  grid: string[];
}

export const LEVELS: Level[] = [
  {
    id: 1,
    name: 'First Drift',
    par: 3,
    grid: [
      '...S#',
      '...#.',
      '.....',
      '...#.',
      '...G#',
    ],
  },
  {
    id: 2,
    name: 'Cornerstone',
    par: 4,
    grid: [
      'S#..#',
      '...##',
      '.....',
      '#....',
      'G....',
    ],
  },
  {
    id: 3,
    name: 'Crosswind',
    par: 5,
    grid: [
      '#..#G.',
      '......',
      '.....#',
      '..S#.#',
      '#.....',
      '......',
    ],
  },
  {
    id: 4,
    name: 'Inner Loop',
    par: 6,
    grid: [
      '.#....',
      '..G#..',
      '..#...',
      '..S.#.',
      '..#..#',
      '....#.',
    ],
  },
  {
    id: 5,
    name: 'Switchback',
    par: 7,
    grid: [
      '#..#..',
      '#..G..',
      '.##...',
      'S..##.',
      '...#..',
      '......',
    ],
  },
  {
    id: 6,
    name: 'Ricochet',
    par: 8,
    grid: [
      '.....#.',
      '.#....G',
      '.#.....',
      '..S.#..',
      '....#.#',
      '###....',
      '.......',
    ],
  },
  {
    id: 7,
    name: 'Anchor',
    par: 9,
    grid: [
      '...#.#.',
      '.....S.',
      '.....#.',
      '.#.....',
      '#.G#...',
      '...#...',
      '..###..',
    ],
  },
  {
    id: 8,
    name: 'Pinball',
    par: 10,
    grid: [
      '.S#...#',
      '.......',
      '#...#.G',
      '..#..#.',
      '.....##',
      '.......',
      '...#.##',
    ],
  },
  {
    id: 9,
    name: 'Open Vault',
    par: 11,
    grid: [
      '...##...',
      '#...#.##',
      '..#...G.',
      '...#....',
      '........',
      '........',
      '..##....',
      '.S#....#',
    ],
  },
  {
    id: 10,
    name: 'Long Glide',
    par: 12,
    grid: [
      'S.......',
      '.....#.#',
      '...#....',
      '##.....#',
      '.#....##',
      '#.#..#..',
      '....#...',
      '..G#....',
    ],
  },
];

export function parseLevel(level: Level): {
  size: number;
  start: Position;
  goal: Position;
  walls: boolean[][];
} {
  const size = level.grid.length;
  let start: Position = { row: 0, col: 0 };
  let goal: Position = { row: 0, col: 0 };
  const walls: boolean[][] = [];

  for (let r = 0; r < size; r++) {
    const rowWalls: boolean[] = [];
    for (let c = 0; c < size; c++) {
      const ch = level.grid[r][c];
      if (ch === 'S') start = { row: r, col: c };
      if (ch === 'G') goal = { row: r, col: c };
      rowWalls.push(ch === '#');
    }
    walls.push(rowWalls);
  }

  return { size, start, goal, walls };
}

export function slidePosition(
  pos: Position,
  dr: number,
  dc: number,
  walls: boolean[][]
): Position {
  const size = walls.length;
  let r = pos.row;
  let c = pos.col;

  while (
    r + dr >= 0 &&
    r + dr < size &&
    c + dc >= 0 &&
    c + dc < size &&
    !walls[r + dr][c + dc]
  ) {
    r += dr;
    c += dc;
  }

  return { row: r, col: c };
}
