import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILY_ORDER } from "./planner-logic";

// The family hues are read straight out of styles.css, so this test guards
// the colours that actually ship rather than a copy that could drift.
const css = readFileSync("src/styles.css", "utf-8");
const families = Object.fromEntries([...css.matchAll(/--family-([a-z]+): (#[0-9a-f]{6})/g)].map((m) => [m[1]!, m[2]!]));

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}: (#[0-9a-f]{6})`));
  if (!match) throw new Error(`--${name} not found in styles.css`);
  return match[1]!;
}

// The state colours a family strip sits beside on a card.
const STATE_COLOURS = { rust: token("rust"), amber: token("amber"), moss: token("moss"), gold: token("gold") };

type Rgb = [number, number, number];
type Matrix = [Rgb, Rgb, Rgb];

// Machado, Oliveira & Fernandes (2009), severity 1.0, applied to linear RGB.
const CVD: Record<string, Matrix> = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

function linearRgb(hex: string): Rgb {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [channel(0), channel(1), channel(2)];
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(linearRgb(a)), luminance(linearRgb(b))].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

function simulate(rgb: Rgb, m: Matrix): Rgb {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return m.map((row) => clamp(row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])) as Rgb;
}

// Linear sRGB → XYZ → CIELAB, D65 white.
function toLab([r, g, b]: Rgb): Rgb {
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a: string, b: string, m?: Matrix): number {
  const [la, lb] = [linearRgb(a), linearRgb(b)].map((rgb) => toLab(m ? simulate(rgb, m) : rgb));
  return Math.hypot(la![0] - lb![0], la![1] - lb![1], la![2] - lb![2]);
}

describe("family palette", () => {
  it("defines exactly one token per family", () => {
    expect(Object.keys(families).sort()).toEqual([...FAMILY_ORDER].sort());
  });

  const hues = FAMILY_ORDER.filter((f) => f !== "neutral");

  it("keeps every hue at least 3:1 against white", () => {
    for (const family of hues) {
      const ratio = contrast(families[family]!, "#ffffff");
      expect(ratio, `${family} ${families[family]} is ${ratio.toFixed(2)}:1 on white`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps every hue apart from the other families and the state colours, in each vision type", () => {
    const failures: string[] = [];
    const seen = new Set<string>();
    for (const a of hues) {
      const others: [string, string][] = [
        ...FAMILY_ORDER.filter((f) => f !== a).map((f): [string, string] => [f, families[f]!]),
        ...Object.entries(STATE_COLOURS),
      ];
      for (const [b, hexB] of others) {
        const key = [a, b].sort().join("/");
        if (seen.has(key)) continue;
        seen.add(key);
        const normal = deltaE(families[a]!, hexB);
        if (normal < 20) failures.push(`${a} vs ${b}, normal vision: ΔE ${normal.toFixed(1)} < 20`);
        for (const [vision, matrix] of Object.entries(CVD)) {
          const simulated = deltaE(families[a]!, hexB, matrix);
          if (simulated < 10) failures.push(`${a} vs ${b}, ${vision}: ΔE ${simulated.toFixed(1)} < 10`);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });

  it("can fail: two near-identical indigos are under the threshold", () => {
    expect(deltaE("#1f2f86", "#27358f")).toBeLessThan(20);
  });
});
