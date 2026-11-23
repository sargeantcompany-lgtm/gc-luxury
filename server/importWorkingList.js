require("dotenv").config();
const fs = require("fs");
const { pool } = require("./db");
const {
  importWorkingListContacts,
  parseWorkingListBuffer,
  summarizeWorkingListContacts,
} = require("./workingListImport");

const args = process.argv.slice(2);
const filePath = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");
const skipSchema = args.includes("--skip-schema");

function printSummary({ contacts, skipped, sourceRows }) {
  const summary = summarizeWorkingListContacts(contacts);
  console.log(`Rows read: ${sourceRows}`);
  console.log(`Address/mobile contacts prepared: ${contacts.length}`);
  console.log(`Rows skipped without an owner or mobile: ${skipped}`);
  console.log(`Separate suburb categories (10+): ${summary.groups.filter((group) => group.key !== "__small__").length}`);
  summary.groups.forEach((group) => console.log(`${group.label}: ${group.count}`));
}

async function main() {
  if (!filePath) {
    throw new Error('Usage: npm run import-working-list -- "path\\to\\owners.csv" [--dry-run] [--skip-schema]');
  }

  const result = parseWorkingListBuffer(fs.readFileSync(filePath));
  printSummary(result);
  if (dryRun) return;

  const imported = await importWorkingListContacts(result.contacts, { ensureSchema: !skipSchema });
  console.log(`Imported or updated ${imported} address/mobile contact entries.`);
}

main()
  .catch((error) => {
    console.error("Working List import failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
