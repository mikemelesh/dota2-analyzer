export function parseTowerStatus(bits: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 11; i++) {
    out.push((bits >> i) & 1);
  }
  return out;
}

export function parseBuildingState(state: number): { radiant: number[]; dire: number[] } {
  const radBits = state & 0x7ff;
  const direBits = (state >> 11) & 0x7ff;
  return {
    radiant: parseTowerStatus(radBits),
    dire: parseTowerStatus(direBits),
  };
}

export function parseMatchTowers(radiant?: number, dire?: number): { radiant: number[]; dire: number[] } {
  return {
    radiant: radiant != null ? parseTowerStatus(radiant) : Array(11).fill(1),
    dire: dire != null ? parseTowerStatus(dire) : Array(11).fill(1),
  };
}
