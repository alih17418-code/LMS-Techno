import { Router } from "express";
import { eq, desc, gte, lte, and, type SQL } from "drizzle-orm";
import { db, budgetEntriesTable } from "@workspace/db";

const router = Router();

async function getRunningBalance(): Promise<number> {
  const entries = await db.select().from(budgetEntriesTable).orderBy(budgetEntriesTable.createdAt);
  return entries.reduce((bal, e) => {
    const amt = parseFloat(e.amount as string);
    return e.type === "income" ? bal + amt : bal - amt;
  }, 0);
}

// GET /budget
router.get("/budget", async (req, res) => {
  const { type, month, year } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (type) conditions.push(eq(budgetEntriesTable.type, type));

  let entries = await db
    .select()
    .from(budgetEntriesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(budgetEntriesTable.createdAt));

  if (month && year) {
    entries = entries.filter((e) => {
      const d = new Date(e.entryDate);
      return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
    });
  } else if (year) {
    entries = entries.filter((e) => new Date(e.entryDate).getFullYear() === Number(year));
  }

  return res.json(entries.map(toEntry));
});

// POST /budget
router.post("/budget", async (req, res) => {
  const { type, amount, description, category } = req.body;
  if (!type || !amount || !description) {
    return res.status(400).json({ error: "type, amount, description are required" });
  }
  if (!["income", "expense"].includes(type)) {
    return res.status(400).json({ error: "type must be income or expense" });
  }

  const currentBalance = await getRunningBalance();
  const amt = parseFloat(String(amount));
  const newBalance = type === "income" ? currentBalance + amt : currentBalance - amt;

  const [entry] = await db
    .insert(budgetEntriesTable)
    .values({
      type: String(type),
      amount: String(amt),
      description: String(description).trim(),
      category: category ? String(category).trim() : null,
      balanceAfter: String(newBalance),
    })
    .returning();

  return res.status(201).json(toEntry(entry));
});

// DELETE /budget/:id
router.delete("/budget/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(budgetEntriesTable).where(eq(budgetEntriesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Entry not found" });
  await db.delete(budgetEntriesTable).where(eq(budgetEntriesTable.id, id));
  return res.status(204).send();
});

// GET /budget/summary
router.get("/budget/summary", async (req, res) => {
  const all = await db.select().from(budgetEntriesTable).orderBy(budgetEntriesTable.createdAt);
  let totalIncome = 0, totalExpense = 0;
  for (const e of all) {
    const amt = parseFloat(e.amount as string);
    if (e.type === "income") totalIncome += amt;
    else totalExpense += amt;
  }
  const balance = totalIncome - totalExpense;
  return res.json({ totalIncome, totalExpense, balance, entryCount: all.length });
});

function toEntry(e: typeof budgetEntriesTable.$inferSelect) {
  return {
    id: e.id,
    type: e.type,
    amount: parseFloat(e.amount as string),
    description: e.description,
    category: e.category ?? undefined,
    entryDate: e.entryDate.toISOString(),
    balanceAfter: parseFloat(e.balanceAfter as string),
    createdAt: e.createdAt.toISOString(),
  };
}

export default router;
