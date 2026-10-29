import type { ZodType } from "zod";
import { models } from "./config";
import type { RepairFn } from "./json";
import { callModel } from "./llm";
import { jsonSchemaOf, type TraceEntry } from "./schemas";

/** A RepairFn that asks MODEL_FAST to rewrite broken output as valid JSON. */
export function modelRepair(schema: ZodType, trace: TraceEntry[]): RepairFn {
  return async (badText, error) => {
    const js = jsonSchemaOf(schema);
    delete js.$schema;
    const { content } = await callModel({
      step: "repair",
      model: models.fast,
      trace,
      temperature: 0,
      thinking: false,
      maxTokens: 4000,
      responseSchema: schema,
      messages: [
        {
          role: "system",
          content: `Return only valid JSON matching this schema. Keep every value from the input; do not invent data. Use null where a value is missing.\nSCHEMA: ${JSON.stringify(js)}`,
        },
        { role: "user", content: `Validation error: ${error}\n\nINPUT:\n${badText.slice(0, 12000)}` },
      ],
    });
    return content;
  };
}
