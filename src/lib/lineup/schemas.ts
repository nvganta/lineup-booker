import { z } from "zod";

export const lineupRequestSchema = z.object({
  concept: z.string().min(3, "Describe your concept or cuisine."),
  location: z.string().min(3, "Add your address."),
  regularsLove: z.string().min(3, "Tell us what regulars love."),
});

export type LineupRequest = z.infer<typeof lineupRequestSchema>;
