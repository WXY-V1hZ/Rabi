import { z } from "zod";

const callIdSchema = z.string().min(1).max(128);

// 两端在消息入口校验这些 Schema；strictObject 同时拒绝协议之外的字段。
export const toolRequestSchema = z.strictObject({
    id: callIdSchema,
    tool: z.literal("get_current_time"),
});

export const toolResultSchema = z.strictObject({
    id: callIdSchema,
    time: z.iso.datetime({ offset: true }).max(64),
});

export type ToolRequest = z.infer<typeof toolRequestSchema>;
export type ToolResult = z.infer<typeof toolResultSchema>;
