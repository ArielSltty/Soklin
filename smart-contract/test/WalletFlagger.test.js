const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WalletFlagger", function () {
  let walletFlagger;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const WalletFlagger = await ethers.getContractFactory("WalletFlagger");
    walletFlagger = await WalletFlagger.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await walletFlagger.owner()).to.equal(owner.address);
    });
  });

  describe("Wallet flagging", function () {
    it("Should allow flagging a wallet", async function () {
      const reputationScore = 20;
      const reason = "Suspicious activity";
      
      await walletFlagger.flagWallet(addr1.address, reputationScore, reason);
      
      const flagInfo = await walletFlagger.getWalletFlag(addr1.address);
      expect(flagInfo.isFlagged).to.equal(true);
      expect(flagInfo.reputationScore).to.equal(reputationScore);
    });

    it("Should correctly identify flagged wallets", async function () {
      const reputationScore = 20;
      const reason = "Suspicious activity";
      
      await walletFlagger.flagWallet(addr1.address, reputationScore, reason);
      
      // Check isWalletFlagged returns true for flagged wallet
      const isFlagged = await walletFlagger.isWalletFlagged(addr1.address);
      expect(isFlagged).to.equal(true);
      
      // Check isWalletFlagged returns false for non-flagged wallet
      const isNotFlagged = await walletFlagger.isWalletFlagged(addr2.address);
      expect(isNotFlagged).to.equal(false);
    });

    it("Should correctly count active flagged wallets", async function () {
      // Initially should be 0
      expect(await walletFlagger.getActiveFlaggedCount()).to.equal(0);
      
      // Add a flagged wallet
      await walletFlagger.flagWallet(addr1.address, 20, "Suspicious activity");
      
      // Should now be 1
      expect(await walletFlagger.getActiveFlaggedCount()).to.equal(1);
      
      // Add another flagged wallet
      await walletFlagger.flagWallet(addr2.address, 30, "Fraudulent activity");
      
      // Should now be 2
      expect(await walletFlagger.getActiveFlaggedCount()).to.equal(2);
    });
  });
});