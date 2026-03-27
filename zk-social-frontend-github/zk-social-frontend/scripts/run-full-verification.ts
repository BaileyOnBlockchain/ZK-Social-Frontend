import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Run full test suite and generate JSON report
 * Executes Hardhat tests against configured network
 */

interface TestReport {
  timestamp: string;
  network: string;
  results: { passed: number; failed: number; skipped: number; total: number };
  features: {
    semaphore: boolean;
    token: boolean;
    staking: boolean;
    tipping: boolean;
    moderation: boolean;
  };
  contractAddresses: {
    semaphore: string;
    privNetSemaphore: string;
    privToken: string;
    stakingVault: string;
    ezklVerifier: string;
  };
  output: string;
}

async function runFullVerification() {
  console.log("🧪 Starting Full Verification Suite...\n");

  const network = process.env.NETWORK || "baseSepolia";
  const testFile = "test/PrivNetFullFlow.test.ts";

  const contractAddresses = {
    semaphore:        process.env.SEMAPHORE_ADDRESS        || "0x0000000000000000000000000000000000000000",
    privNetSemaphore: process.env.PRIVNET_SEMAPHORE_ADDRESS || "0x0000000000000000000000000000000000000000",
    privToken:        process.env.PRIV_TOKEN_ADDRESS        || "0x0000000000000000000000000000000000000000",
    stakingVault:     process.env.STAKING_VAULT_ADDRESS     || "0x0000000000000000000000000000000000000000",
    ezklVerifier:     process.env.EZKL_VERIFIER_ADDRESS     || "0x0000000000000000000000000000000000000000",
  };

  console.log("📋 Contract Addresses:");
  Object.entries(contractAddresses).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
  console.log();

  if (!process.env.PRIVATE_KEY) {
    console.error("❌ Error: PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  try {
    console.log(`🔍 Running tests on ${network}...\n`);

    const output = execSync(`npx hardhat test ${testFile} --network ${network}`, {
      encoding: "utf-8",
      stdio: "pipe",
      env: { ...process.env },
    });

    console.log(output);

    const passed  = parseInt(output.match(/(\d+)\s+passing/)?.[1]  ?? "0");
    const failed  = parseInt(output.match(/(\d+)\s+failing/)?.[1]  ?? "0");
    const skipped = parseInt(output.match(/(\d+)\s+pending/)?.[1]  ?? "0");

    const report: TestReport = {
      timestamp: new Date().toISOString(),
      network,
      results: { passed, failed, skipped, total: passed + failed + skipped },
      features: {
        semaphore:  output.includes("Anonymous post successful"),
        token:      output.includes("Transferred") && output.includes("PRIV"),
        staking:    output.includes("staked") && output.includes("PRIV"),
        tipping:    output.includes("tipping") || output.includes("Transferred"),
        moderation: output.includes("EZKL") || output.includes("moderation"),
      },
      contractAddresses,
      output,
    };

    const reportPath = path.join(process.cwd(), "test-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("\n📊 Test Report Generated:");
    console.log(`   ✅ Passed:  ${passed}`);
    console.log(`   ❌ Failed:  ${failed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📄 Report:  ${reportPath}\n`);

    console.log("🎯 Feature Status:");
    console.log(`   ${report.features.semaphore  ? "✅" : "❌"} Semaphore Posts`);
    console.log(`   ${report.features.token      ? "✅" : "❌"} PRIV Token`);
    console.log(`   ${report.features.staking    ? "✅" : "❌"} Staking`);
    console.log(`   ${report.features.tipping    ? "✅" : "⏭️ "} Tipping`);
    console.log(`   ${report.features.moderation ? "✅" : "⏭️ "} AI Moderation\n`);

    if (failed === 0) {
      console.log("🎉 All tests passed!\n");
      process.exit(0);
    } else {
      console.error(`❌ ${failed} test(s) failed.\n`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Test execution failed:", error.message || error);

    const report: TestReport = {
      timestamp: new Date().toISOString(),
      network,
      results: { passed: 0, failed: 1, skipped: 0, total: 1 },
      features: { semaphore: false, token: false, staking: false, tipping: false, moderation: false },
      contractAddresses,
      output: error.message || String(error),
    };

    fs.writeFileSync(path.join(process.cwd(), "test-report.json"), JSON.stringify(report, null, 2));
    process.exit(1);
  }
}

if (require.main === module) {
  runFullVerification().catch(console.error);
}

export { runFullVerification };
