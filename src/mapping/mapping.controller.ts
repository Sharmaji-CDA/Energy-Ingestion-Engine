import { Body, Controller, Post } from "@nestjs/common";
import { z } from "zod";
import { MappingService } from "./mapping.service";

const mappingSchema = z.object({
  vehicleId: z.string().min(1),
  meterId: z.string().min(1)
});

@Controller("/v1/mappings")
export class MappingController {
  constructor(private readonly mappings: MappingService) {}

  @Post()
  async upsert(@Body() body: any) {
    const parsed = mappingSchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, message: "Invalid mapping payload", issues: parsed.error.flatten() };
    }
    await this.mappings.upsertMapping(parsed.data.vehicleId, parsed.data.meterId);
    return { success: true };
  }
}
