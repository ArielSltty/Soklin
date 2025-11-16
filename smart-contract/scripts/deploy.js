// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying WalletFlagger contract to Somnia Testnet...");
  console.log("📋 Network: Somnia Testnet");
  console.log("🔗 Chain ID: 50312");
  console.log("🌐 RPC URL: https://dream-rpc.somnia.network/");
  console.log("🔍 Explorer: https://shannon-explorer.somnia.network/");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deploying with account: ${deployer.address}`);
  console.log(`💰 Account balance: ${hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address))} STT`);

  // Deploy contract
  const WalletFlagger = await hre.ethers.getContractFactory("WalletFlagger");
  const walletFlagger = await WalletFlagger.deploy();

  console.log("⏳ Waiting for deployment transaction...");
  await walletFlagger.waitForDeployment();
  const address = await walletFlagger.getAddress();

  console.log("✅ WalletFlagger deployed successfully!");
  console.log("📄 Contract address:", address);
  console.log("🔗 Transaction hash:", walletFlagger.deploymentTransaction().hash);

  // Wait for block confirmations
  if (hre.network.name === "somniaTestnet") {
    console.log("⏳ Waiting for block confirmations...");
    await walletFlagger.deploymentTransaction().wait(3);
    
    console.log("📝 Verification ready for:", address);
    console.log("🌐 Check contract on explorer: https://shannon-explorer.somnia.network/address/" + address);
  }

  // Save deployment info to file
  const deploymentInfo = {
    network: "Somnia Testnet",
    chainId: 50312,
    contract: "WalletFlagger",
    address: address,
    deployer: deployer.address,
    transactionHash: walletFlagger.deploymentTransaction().hash,
    timestamp: new Date().toISOString(),
    explorer: `https://shannon-explorer.somnia.network/address/${address}`
  };

  const fs = require('fs');
  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to: deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });