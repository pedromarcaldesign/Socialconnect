import { describe, it, expect } from "vitest";
import { zonedToUtc, partsInZone } from "@/lib/time";

describe("zonedToUtc", () => {
  it("converte hora de Lisboa no verão (UTC+1)", () => {
    expect(zonedToUtc({ date: "2026-07-01", time: "09:30" }, "Europe/Lisbon")?.toISOString()).toBe("2026-07-01T08:30:00.000Z");
  });
  it("converte hora de Lisboa no inverno (UTC+0)", () => {
    expect(zonedToUtc({ date: "2026-12-01", time: "09:30" }, "Europe/Lisbon")?.toISOString()).toBe("2026-12-01T09:30:00.000Z");
  });
  it("rejeita a hora que não existe no salto de março", () => {
    expect(zonedToUtc({ date: "2026-03-29", time: "01:30" }, "Europe/Lisbon")).toBeNull();
  });
  it("na hora ambígua de outubro usa a primeira ocorrência", () => {
    expect(zonedToUtc({ date: "2026-10-25", time: "01:30" }, "Europe/Lisbon")?.toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });
  it("funciona noutros fusos (Açores, Madeira, São Paulo)", () => {
    expect(zonedToUtc({ date: "2026-12-01", time: "09:00" }, "Atlantic/Azores")?.toISOString()).toBe("2026-12-01T10:00:00.000Z");
    expect(zonedToUtc({ date: "2026-12-01", time: "09:00" }, "America/Sao_Paulo")?.toISOString()).toBe("2026-12-01T12:00:00.000Z");
  });
  it("ida e volta", () => {
    const d = new Date("2026-05-10T17:45:00Z");
    expect(zonedToUtc(partsInZone(d, "Europe/Lisbon"), "Europe/Lisbon")?.getTime()).toBe(d.getTime());
  });
  it("rejeita lixo", () => {
    expect(zonedToUtc({ date: "2026-13-01", time: "09:00" }, "Europe/Lisbon")).toBeNull();
    expect(zonedToUtc({ date: "ontem", time: "9h" }, "Europe/Lisbon")).toBeNull();
  });
});
