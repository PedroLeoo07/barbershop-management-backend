import { runSeeds } from './001_initial_data';

async function main() {
  try {
    await runSeeds();
    process.exit(0);
  } catch (error) {
    console.error('Failed to run seeds:', error);
    process.exit(1);
  }
}

main();