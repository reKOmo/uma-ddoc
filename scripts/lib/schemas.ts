import { z } from 'zod';

// A zod schema as a JSON Schema file (schemas/<name>), its own name as $id.
export function jsonSchema(schema: z.ZodType, name: string): Record<string, unknown> {
  const { $schema, title, description, ...rest } = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  return { $schema, $id: name, title, description, ...rest };
}

export const schemaText = (schema: z.ZodType, name: string) => `${JSON.stringify(jsonSchema(schema, name), null, 2)}\n`;
