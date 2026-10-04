import { drizzle } from "drizzle-orm/postgres-js";
import Pg from "pg";
import * as schema from "@/drizzle/schema";

const client = new Pg.Client(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });