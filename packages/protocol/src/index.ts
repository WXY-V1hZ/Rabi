import { z } from "zod";

const callIdSchema = z.string().min(1).max(128);

export const toolRequestSchema = z.strictObject({
    id: callIdSchema,
    tool: z.literal("get_current_time"),
});

export const toolResultSchema = z.strictObject({
    id: callIdSchema,
    time: z.iso.datetime({ offset: true }).max(64),
});
