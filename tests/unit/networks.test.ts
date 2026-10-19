import { describe, it, expect } from "vitest";
import { validateTarget, countHashtags, captionFor, defaultFormat } from "@/lib/networks";

describe("validateTarget", () => {
  it("aceita um post IG normal", () => {
    expect(validateTarget({ network: "instagram", format: "feed", text: "Olá #hotel", mediaCount: 1 })).toEqual([]);
  });
  it("IG sem imagem falha", () => {
    expect(validateTarget({ network: "instagram", format: "feed", text: "x", mediaCount: 0 })).toHaveLength(1);
  });
  it("IG texto acima de 2200", () => {
    expect(validateTarget({ network: "instagram", format: "feed", text: "a".repeat(2201), mediaCount: 1 })[0]).toMatch(/2201/);
  });
  it("carrossel precisa de 2 a 10", () => {
    expect(validateTarget({ network: "instagram", format: "carousel", text: "", mediaCount: 1 })).toHaveLength(1);
    expect(validateTarget({ network: "instagram", format: "carousel", text: "", mediaCount: 11 })).toHaveLength(1);
    expect(validateTarget({ network: "instagram", format: "carousel", text: "", mediaCount: 10 })).toEqual([]);
  });
  it("mais de 30 hashtags no IG", () => {
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
    expect(validateTarget({ network: "instagram", format: "feed", text: tags, mediaCount: 1 })).toHaveLength(1);
  });
  it("FB aceita só texto, recusa vazio", () => {
    expect(validateTarget({ network: "facebook", format: "feed", text: "Bom dia", mediaCount: 0 })).toEqual([]);
    expect(validateTarget({ network: "facebook", format: "feed", text: "  ", mediaCount: 0 })).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("conta hashtags com acentos", () => expect(countHashtags("#verão #Lisboa e#não #x_1")).toBe(3));
  it("override vazio usa o texto base", () => {
    expect(captionFor("base", "  ")).toBe("base");
    expect(captionFor("base", "outro")).toBe("outro");
  });
  it("formato por omissão", () => {
    expect(defaultFormat("instagram", 3)).toBe("carousel");
    expect(defaultFormat("facebook", 3)).toBe("feed");
  });
});
