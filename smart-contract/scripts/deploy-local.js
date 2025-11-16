async function main() {
  console.log("🚀 Deploying WalletFlagger contract locally...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📦 Deploying contracts with the account:", deployer.address);
  console.log("💰 Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const WalletFlagger = await ethers.getContractFactory("WalletFlagger");
  const walletFlagger = await WalletFlagger.deploy();
  
  console.log("⏳ Waiting for deployment...");
  await walletFlagger.waitForDeployment();
  
  console.log("✅ WalletFlagger deployed to:", await walletFlagger.getAddress());
  
  // Test some functions
  console.log("🧪 Testing contract functions...");
  
  // Flag a wallet
  await walletFlagger.flagWallet("0x742d35Cc6634C0532925a3b844Bc454e4438f44e", 20, "Test flag");
  console.log("✅ Wallet flagged successfully");
  
  // Check if wallet is flagged
  const isFlagged = await walletFlagger.isWalletFlagged("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
  console.log(`📊 Wallet flagged status: ${isFlagged}`);
  
  // Get active flagged count
  const count = await walletFlagger.getActiveFlaggedCount();
  console.log(`📊 Active flagged wallets count: ${count}`);
  
  console.log("🎉 Deployment and testing completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });