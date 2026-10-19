import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual, hkdfSync } from "node:crypto";
import { env } from "@/lib/env";

function key(purpose: "enc" | "sign"): Buffer {
  const master = Buffer.from(env.appSecret(), "base64");
  if (master.length < 32) throw new Error("APP_SECRET tem de ter pelo menos 32 bytes em base64");
  return Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), `purepixel:${purpose}`, 32));
}

// AES-256-GCM: iv(12) | tag(16) | dados, em base64
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("enc"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key("enc"), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

export function sign(value: string): string {
  return createHmac("sha256", key("sign")).update(value).digest("base64url");
}

export function verify(value: string, signature: string): boolean {
  const expected = Buffer.from(sign(value));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
