import { ConfigService } from "@nestjs/config";
import * as dotenv from "dotenv"
dotenv.config();

export const IsDev = (configService: ConfigService)=> {
  return configService.getOrThrow("NODE_ENV") === "development";
}

export const IsDevEnv = process.env.NODE_ENV === "development";