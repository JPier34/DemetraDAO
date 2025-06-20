const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumberish, parseUnits, formatEther, BigNumber } = require("ethers");

// Import dei chai matchers per Hardhat
require("@nomicfoundation/hardhat-chai-matchers");

describe("DemetraDAO - Test 0 (preliminare): Setup e Deploy", function () {
  let demetraDAO: {
    connect(addr1: { address: any }): unknown;
    waitForDeployment: () => any;
    getAddress: () => any;
    tokenPrice: () => any;
    maxTotalSupply: () => any;
    tokenSaleActive: () => any;
    DEFAULT_ADMIN_ROLE: () => any;
    ADMIN_ROLE: () => any;
    TREASURER_ROLE: () => any;
    PROPOSER_ROLE: () => any;
    hasRole: (arg0: any, arg1: any) => any;
    getDAOStats: () => any;
    isMember: (arg0: any) => any;
    getMemberInfo: (arg0: any) => any;
    demetraToken: () => any;
    proposalManager: () => any;
    votingStrategies: () => any;
    calculateTokenCost: (arg0: any) => any;
    MIN_PURCHASE: () => any;
    MAX_PURCHASE: () => any;
    purchaseTokens: (arg0: { value: any }) => any;
  };
  let owner: { address: any }, addr1: { address: any }, addr2, addrs;

  // Parametri di configurazione per il deploy
  const TOKEN_NAME = "Demetra Token";
  const TOKEN_SYMBOL = "DMT";
  const TOKEN_PRICE = ethers.parseEther("0.001"); // 0.001 ETH per token
  const MAX_TOTAL_SUPPLY = ethers.parseEther("1000000"); // 1M token max

  beforeEach(async function () {
    // Ottieni gli accounts di test
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Prima di deployare DemetraDAO, dobbiamo creare i mock dei contratti dipendenti
    // o assumere che questi contratti esistano e siano funzionanti

    // Deploy del contratto DemetraDAO
    const DemetraDAO = await ethers.getContractFactory("DemetraDAO");
    demetraDAO = await DemetraDAO.deploy(
      TOKEN_NAME,
      TOKEN_SYMBOL,
      TOKEN_PRICE,
      MAX_TOTAL_SUPPLY,
      owner.address
    );

    await demetraDAO.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Dovrebbe deployare correttamente con i parametri giusti", async function () {
      // Verifica che il contratto sia stato deployato
      const contractAddress = await demetraDAO.getAddress();
      expect(contractAddress).to.not.equal(ethers.ZeroAddress);
      expect(ethers.isAddress(contractAddress)).to.be.true;

      // Verifica i parametri di configurazione
      expect(await demetraDAO.tokenPrice()).to.equal(TOKEN_PRICE);
      expect(await demetraDAO.maxTotalSupply()).to.equal(MAX_TOTAL_SUPPLY);
      expect(await demetraDAO.tokenSaleActive()).to.be.true;
    });

    it("Dovrebbe impostare correttamente i ruoli dell'admin", async function () {
      const DEFAULT_ADMIN_ROLE = await demetraDAO.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await demetraDAO.ADMIN_ROLE();
      const TREASURER_ROLE = await demetraDAO.TREASURER_ROLE();
      const PROPOSER_ROLE = await demetraDAO.PROPOSER_ROLE();

      // Verifica che l'owner abbia tutti i ruoli
      expect(await demetraDAO.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be
        .true;
      expect(await demetraDAO.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await demetraDAO.hasRole(TREASURER_ROLE, owner.address)).to.be
        .true;
      expect(await demetraDAO.hasRole(PROPOSER_ROLE, owner.address)).to.be.true;
    });

    it("Dovrebbe inizializzare correttamente le statistiche", async function () {
      const stats = await demetraDAO.getDAOStats();

      // Verifica statistiche iniziali (nota: usiamo Number() per convertire BigInt)
      expect(Number(stats._totalMembers)).to.equal(1); // Solo l'admin
      expect(Number(stats._totalProposalsCreated)).to.equal(0);
      expect(Number(stats._totalVotesCast)).to.equal(0);
      expect(Number(stats._totalFundsRaised)).to.equal(0);
      expect(Number(stats._treasuryBalance)).to.equal(0);
      expect(stats._tokenSaleActive).to.be.true;
    });

    it("Dovrebbe aggiungere l'admin come primo membro", async function () {
      // Verifica che l'admin sia un membro
      expect(await demetraDAO.isMember(owner.address)).to.be.true;

      // Verifica i dettagli del membro admin
      const memberInfo = await demetraDAO.getMemberInfo(owner.address);
      expect(memberInfo.isActive).to.be.true;
      expect(Number(memberInfo.tokensOwned)).to.equal(0); // Admin inizia con 0 token
      expect(Number(memberInfo.proposalsCreated)).to.equal(0);
      expect(Number(memberInfo.votesParticipated)).to.equal(0);
    });

    it("Dovrebbe deployare correttamente i contratti collegati", async function () {
      // Verifica che i contratti collegati siano stati deployati
      const demetraTokenAddress = await demetraDAO.demetraToken();
      const proposalManagerAddress = await demetraDAO.proposalManager();
      const votingStrategiesAddress = await demetraDAO.votingStrategies();

      expect(ethers.isAddress(demetraTokenAddress)).to.be.true;
      expect(ethers.isAddress(proposalManagerAddress)).to.be.true;
      expect(ethers.isAddress(votingStrategiesAddress)).to.be.true;

      // Verifica che non siano indirizzi zero
      expect(demetraTokenAddress).to.not.equal(ethers.ZeroAddress);
      expect(proposalManagerAddress).to.not.equal(ethers.ZeroAddress);
      expect(votingStrategiesAddress).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Validation dei parametri del costruttore", function () {
    it("Dovrebbe fallire se il prezzo del token è zero", async function () {
      const DemetraDAO = await ethers.getContractFactory("DemetraDAO");

      await expect(
        DemetraDAO.deploy(
          TOKEN_NAME,
          TOKEN_SYMBOL,
          0, // Prezzo zero
          MAX_TOTAL_SUPPLY,
          owner.address
        )
      ).to.be.revertedWith("DemetraDAO: token price must be positive");
    });

    it("Dovrebbe fallire se la supply massima è zero", async function () {
      const DemetraDAO = await ethers.getContractFactory("DemetraDAO");

      await expect(
        DemetraDAO.deploy(
          TOKEN_NAME,
          TOKEN_SYMBOL,
          TOKEN_PRICE,
          0, // Supply zero
          owner.address
        )
      ).to.be.revertedWith("DemetraDAO: max supply must be positive");
    });

    it("Dovrebbe fallire se l'admin è l'indirizzo zero", async function () {
      const DemetraDAO = await ethers.getContractFactory("DemetraDAO");

      await expect(
        DemetraDAO.deploy(
          TOKEN_NAME,
          TOKEN_SYMBOL,
          TOKEN_PRICE,
          MAX_TOTAL_SUPPLY,
          ethers.ZeroAddress // Admin zero
        )
      ).to.be.revertedWith("DemetraDAO: admin cannot be zero address");
    });
  });

  describe("Funzioni di utilità", function () {
    it("Dovrebbe calcolare correttamente il costo dei token", async function () {
      const tokenAmount = ethers.toBigInt(100); // 100 token
      // Il costo dovrebbe essere: 100 token * 0.001 ETH/token = 0.1 ETH
      const expectedCost = ethers.parseEther("0.1");
      const calculatedCost = await demetraDAO.calculateTokenCost(tokenAmount);
      expect(calculatedCost).to.equal(expectedCost);
    });

    it("Dovrebbe restituire le costanti corrette", async function () {
      expect(await demetraDAO.MIN_PURCHASE()).to.equal(ethers.parseEther("1"));
      expect(await demetraDAO.MAX_PURCHASE()).to.equal(
        ethers.parseEther("10000")
      );
    });
  });

  // Test: 1: Acquisto di azioni e aggiunta di nuovi membri
  describe("Token Purchase", function () {
    it("Dovrebbe permettere l'acquisto di token e aggiungere un nuovo membro", async function () {
      const minPurchaseRaw = await demetraDAO.MIN_PURCHASE();
      const tokenPriceRaw = await demetraDAO.tokenPrice();

      const minPurchase = BigInt(minPurchaseRaw.toString());
      const tokenPrice = BigInt(tokenPriceRaw.toString());

      const cost = (minPurchase * tokenPrice) / 10n ** 18n;

      console.log("MIN_PURCHASE:", minPurchase.toString());
      console.log("TOKEN_PRICE:", tokenPrice.toString());
      console.log("Cost in wei:", cost.toString());
      console.log("Cost in ETH:", formatEther(cost));

      await expect(
        (demetraDAO.connect(addr1) as typeof demetraDAO).purchaseTokens({
          value: cost,
        })
      )
        .to.emit(demetraDAO, "TokensPurchased")
        .withArgs(addr1.address, minPurchaseRaw, cost);

      expect(await demetraDAO.isMember(addr1.address)).to.be.true;

      const memberInfo = await demetraDAO.getMemberInfo(addr1.address);
      expect(memberInfo.isActive).to.be.true;
      expect(memberInfo.proposalsCreated).to.equal(0);
      expect(memberInfo.votesParticipated).to.equal(0);
      expect(memberInfo.tokensOwned).to.equal(minPurchaseRaw);
    });
  });
});
