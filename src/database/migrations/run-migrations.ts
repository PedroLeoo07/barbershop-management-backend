import { runMigrations } from './001_create_tables';

async function main() {
  try {
    await runMigrations();
    process.exit(0);
  } catch (error) {
    console.error('Failed to run migrations:', error);
    process.exit(1);
  }
}

main();