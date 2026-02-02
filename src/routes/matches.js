import { Router } from "express";
import {
  createMatchSchema,
  listMatchesQuerySchema,
} from "../validation/matches.js";
import { to } from "lyney";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/match-status.js";
import { desc } from "drizzle-orm";

export const matchRouter = Router();

const MAX_LIMIT = 100;

matchRouter.get("/", async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid query", detail: JSON.stringify(parsed.error) });
  }

  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  const [err, data] = await to(
    db.select().from(matches).orderBy(desc(matches.createdAt)).limit(limit),
  );

  if (err) {
    return res.status(500).json({
      error: "Failed to list matches.",
      detail: JSON.stringify(parsed.error),
    });
  }

  res.json({ data });
});

matchRouter.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);
  const {
    data: { startTime, endTime, homeScore, awayScore },
  } = parsed;

  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", detail: JSON.stringify(parsed.error) });
  }

  const [err, event] = await to(
    db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime),
      })
      .returning(),
  );

  if (err) {
    return res
      .status(500)
      .json({ error: "Failed to create match.", detail: JSON.stringify(err) });
  }

  res.status(201).json({ data: event });
});
