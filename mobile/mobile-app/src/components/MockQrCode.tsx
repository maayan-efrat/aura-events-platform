import { View, StyleSheet } from "react-native";

const GRID_SIZE = 10;

/** Deterministic pseudo-random pattern seeded from the registration id — purely a visual mockup, not a scannable code. */
function buildPattern(seed: string): boolean[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const cells: boolean[] = [];
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    cells.push((hash >> 16) % 2 === 0);
  }
  return cells;
}

export function MockQrCode({ seed, size = 220 }: { seed: string; size?: number }) {
  const cells = buildPattern(seed);
  const cellSize = size / GRID_SIZE;

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {cells.map((filled, index) => (
        <View
          key={index}
          style={{
            position: "absolute",
            top: Math.floor(index / GRID_SIZE) * cellSize,
            left: (index % GRID_SIZE) * cellSize,
            width: cellSize,
            height: cellSize,
            backgroundColor: filled ? "#09090b" : "transparent",
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 8,
    alignSelf: "center",
  },
});
