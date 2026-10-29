import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { firstJsonObject, JsonParseError, parseJson } from "../src/lib/json";

const S = z.object({ a: z.number(), b: z.object({ c: z.string() }) });

describe("parseJson", () => {
  it("strips code fences", async () => {
    expect(await parseJson('```json\n{"a":1,"b":{"c":"x"}}\n```', S)).toEqual({ a: 1, b: { c: "x" } });
  });
  it("ignores leading and trailing prose", async () => {
    expect(await parseJson('Sure! Here it is: {"a":2,"b":{"c":"y"}} Hope that helps.', S)).toEqual({ a: 2, b: { c: "y" } });
  });
  it("handles nested braces and braces inside strings", async () => {
    const text = '{"a":3,"b":{"c":"has } and { inside"}} {"a":9}';
    expect(firstJsonObject(text)).toBe('{"a":3,"b":{"c":"has } and { inside"}}');
    expect((await parseJson(text, S)).b.c).toBe("has } and { inside");
  });
  it("strips <think> blocks", async () => {
    expect(await parseJson('<think>{"a":0}</think>{"a":4,"b":{"c":"z"}}', S)).toEqual({ a: 4, b: { c: "z" } });
  });
  it("tolerates trailing commas", async () => {
    expect(await parseJson('{"a":5,"b":{"c":"q",},}', S)).toEqual({ a: 5, b: { c: "q" } });
  });
  it("calls repair once on invalid JSON and validates the result", async () => {
    const repair = vi.fn().mockResolvedValue('{"a":6,"b":{"c":"fixed"}}');
    expect(await parseJson("{a: 6, b: oops", S, repair)).toEqual({ a: 6, b: { c: "fixed" } });
    expect(repair).toHaveBeenCalledTimes(1);
  });
  it("calls repair on schema mismatch", async () => {
    const repair = vi.fn().mockResolvedValue('{"a":7,"b":{"c":"ok"}}');
    await parseJson('{"a":"seven"}', S, repair);
    expect(repair.mock.calls[0]![1]).toMatch(/a|b/);
  });
  it("throws a typed error when repair also fails", async () => {
    const repair = vi.fn().mockResolvedValue("still not json");
    await expect(parseJson("nope", S, repair)).rejects.toBeInstanceOf(JsonParseError);
    expect(repair).toHaveBeenCalledTimes(1);
  });
  it("throws without repair", async () => {
    await expect(parseJson("nope", S)).rejects.toBeInstanceOf(JsonParseError);
  });
});
