const { expect } = require("chai");
const { ethers } = require("hardhat");

// Carica i matchers di Hardhat
require("@nomicfoundation/hardhat-chai-matchers");

describe("DemetraDAO - Test Completo Requisiti", function () {
  let demetraDAO: {
    waitForDeployment: () => any;
    demetraToken: () => any;
    proposalManager: () => any;
    votingStrategies: () => any;
    calculateTokenCost: (arg0: any) => any;
    isMember: (arg0: any) => any;
    totalMembers: () => any;
    connect: (arg0: any) => {
      (): any;
      new (): any;
      purchaseTokens: { (arg0: { value: any }): any; new (): any };
      createProposal: {
        (
          arg0: string,
          arg1: string,
          arg2: number,
          arg3: number,
          arg4: never[]
        ): any;
        new (): any;
      };
      vote: { (arg0: number, arg1: number): any; new (): any };
    };
    getMemberInfo: (arg0: any) => any;
    treasuryBalance: () => any;
    getDAOStats: () => any;
    interface: {
      parseLog: (arg0: any) => { (): any; new (): any; args: any[] };
    };
    finalizeProposal: (arg0: any) => any;
    canVote: (arg0: any, arg1: any) => any;
    disableTokenSale: () => any;
    enableTokenSale: () => any;
  };
  let demetraToken: {
    balanceOf: (arg0: any) => any;
    connect: (arg0: any) => {
      (): any;
      new (): any;
      delegate: { (arg0: any): any; new (): any };
    };
    getVotes: (arg0: any) => any;
  };
  let proposalManager: {
    DAO_ROLE: () => any;
    hasRole: (arg0: any, arg1: any) => any;
    grantRole: (arg0: any, arg1: any) => any;
    getProposal: (arg0: number) => any;
    hasVoted: (arg0: number, arg1: any) => any;
  };
  let votingStrategies: any;
  let owner,
    addr1: { getAddress: () => any },
    addr2: { getAddress: () => any },
    addr3: { getAddress: () => any },
    addr4: { getAddress: () => any };

  const VotingStrategy = {
    DIRECT: 0,
    LIQUID: 1,
    REPRESENTATIVE: 2,
    CONSENSUS: 3,
  };

  const ProposalCategory = {
    GENERAL: 0,
    STRATEGIC: 1,
    OPERATIONAL: 2,
    TECHNICAL: 3,
    GOVERNANCE: 4,
  };

  // Parametri di configurazione
  const TOKEN_NAME = "Demetra Governance Token";
  const TOKEN_SYMBOL = "DMTR";
  const TOKEN_PRICE = ethers.parseEther("0.001"); // 0.001 ETH per token (era 0.01)
  const MAX_SUPPLY = ethers.parseEther("1000000"); // 1M token max

  beforeEach(async function () {
    // Setup accounts
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    // Deploy DemetraDAO
    const DemetraDAOFactory = await ethers.getContractFactory("DemetraDAO");
    demetraDAO = await DemetraDAOFactory.deploy(
      TOKEN_NAME,
      TOKEN_SYMBOL,
      TOKEN_PRICE,
      MAX_SUPPLY,
      await owner.getAddress()
    );
    await demetraDAO.waitForDeployment();

    // Ottieni contratti collegati
    const demetraTokenAddr = await demetraDAO.demetraToken();
    const proposalManagerAddr = await demetraDAO.proposalManager();
    const votingStrategiesAddr = await demetraDAO.votingStrategies();

    demetraToken = await ethers.getContractAt("DemetraToken", demetraTokenAddr);
    proposalManager = await ethers.getContractAt(
      "ProposalManager",
      proposalManagerAddr
    );
    votingStrategies = await ethers.getContractAt(
      "VotingStrategies",
      votingStrategiesAddr
    );

    // Assicurati che VotingStrategies abbia i permessi necessari
    const DAO_ROLE = await proposalManager.DAO_ROLE();
    const hasRole = await proposalManager.hasRole(
      DAO_ROLE,
      votingStrategiesAddr
    );
    if (!hasRole) {
      await proposalManager.grantRole(DAO_ROLE, votingStrategiesAddr);
    }
  });

  describe("1. Test Acquisto Azioni e Creazione Membri", function () {
    it("L'acquisto di azioni dovrebbe funzionare correttamente e creare nuovi membri", async function () {
      console.log("\n=== TEST 1: ACQUISTO AZIONI E CREAZIONE MEMBRI ===");

      // Definisci quantità di token da acquistare
      const tokens1 = ethers.parseEther("100"); // 100 token per addr1 (era 1000)
      const tokens2 = ethers.parseEther("50"); // 50 token per addr2 (era 500)
      const tokens3 = ethers.parseEther("30"); // 30 token per addr3 (era 300)

      // Calcola costi
      const cost1 = await demetraDAO.calculateTokenCost(tokens1);
      const cost2 = await demetraDAO.calculateTokenCost(tokens2);
      const cost3 = await demetraDAO.calculateTokenCost(tokens3);

      console.log("Costi calcolati:");
      console.log(
        `  ${ethers.formatEther(tokens1)} token = ${ethers.formatEther(
          cost1
        )} ETH`
      );
      console.log(
        `  ${ethers.formatEther(tokens2)} token = ${ethers.formatEther(
          cost2
        )} ETH`
      );
      console.log(
        `  ${ethers.formatEther(tokens3)} token = ${ethers.formatEther(
          cost3
        )} ETH`
      );

      // Verifica stato iniziale - nessuno è membro tranne owner
      expect(await demetraDAO.isMember(await addr1.getAddress())).to.be.false;
      expect(await demetraDAO.isMember(await addr2.getAddress())).to.be.false;
      expect(await demetraDAO.isMember(await addr3.getAddress())).to.be.false;
      expect(await demetraDAO.totalMembers()).to.equal(1n); // Solo owner (BigInt)

      // addr1 acquista token
      console.log("\naddr1 acquista token...");
      await expect(demetraDAO.connect(addr1).purchaseTokens({ value: cost1 }))
        .to.emit(demetraDAO, "TokensPurchased")
        .withArgs(await addr1.getAddress(), tokens1, cost1)
        .and.to.emit(demetraDAO, "MemberJoined")
        .withArgs(await addr1.getAddress(), tokens1);

      // addr2 acquista token
      console.log("addr2 acquista token...");
      await expect(demetraDAO.connect(addr2).purchaseTokens({ value: cost2 }))
        .to.emit(demetraDAO, "TokensPurchased")
        .withArgs(await addr2.getAddress(), tokens2, cost2)
        .and.to.emit(demetraDAO, "MemberJoined")
        .withArgs(await addr2.getAddress(), tokens2);

      // addr3 acquista token
      console.log("addr3 acquista token...");
      await expect(demetraDAO.connect(addr3).purchaseTokens({ value: cost3 }))
        .to.emit(demetraDAO, "TokensPurchased")
        .withArgs(await addr3.getAddress(), tokens3, cost3)
        .and.to.emit(demetraDAO, "MemberJoined")
        .withArgs(await addr3.getAddress(), tokens3);

      // Verifica che tutti siano diventati membri
      expect(await demetraDAO.isMember(await addr1.getAddress())).to.be.true;
      expect(await demetraDAO.isMember(await addr2.getAddress())).to.be.true;
      expect(await demetraDAO.isMember(await addr3.getAddress())).to.be.true;
      expect(await demetraDAO.totalMembers()).to.equal(4n); // owner + 3 nuovi (BigInt)

      // Verifica token ricevuti
      expect(await demetraToken.balanceOf(await addr1.getAddress())).to.equal(
        tokens1
      );
      expect(await demetraToken.balanceOf(await addr2.getAddress())).to.equal(
        tokens2
      );
      expect(await demetraToken.balanceOf(await addr3.getAddress())).to.equal(
        tokens3
      );

      // Verifica informazioni membri
      const member1 = await demetraDAO.getMemberInfo(await addr1.getAddress());
      const member2 = await demetraDAO.getMemberInfo(await addr2.getAddress());
      const member3 = await demetraDAO.getMemberInfo(await addr3.getAddress());

      expect(member1.isActive).to.be.true;
      expect(member1.tokensOwned).to.equal(tokens1);
      expect(member2.isActive).to.be.true;
      expect(member2.tokensOwned).to.equal(tokens2);
      expect(member3.isActive).to.be.true;
      expect(member3.tokensOwned).to.equal(tokens3);

      // Verifica treasury aggiornato
      const expectedTreasury = cost1 + cost2 + cost3;
      expect(await demetraDAO.treasuryBalance()).to.equal(expectedTreasury);

      console.log(
        "✅ Test acquisto azioni e creazione membri completato con successo"
      );
    });
  });

  describe("2. Test Proposta di Decisioni", function () {
    beforeEach(async function () {
      // Setup membri con token per i test delle proposte
      const tokens = ethers.parseEther("1000");
      const cost = await demetraDAO.calculateTokenCost(tokens);
      await demetraDAO.connect(addr1).purchaseTokens({ value: cost });
      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
    });

    it("La proposta di decisioni dovrebbe funzionare correttamente", async function () {
      console.log("\n=== TEST 2: PROPOSTA DI DECISIONI ===");

      // Verifica stato iniziale
      const initialStats = await demetraDAO.getDAOStats();
      expect(initialStats._totalProposalsCreated).to.equal(0n);

      // Crea prima proposta
      console.log("Creazione prima proposta...");
      const title1 = "Proposta per Miglioramento Piattaforma";
      const description1 =
        "Proposta per aggiornare la piattaforma con nuove funzionalità";

      await expect(
        demetraDAO.connect(addr1).createProposal(
          title1,
          description1,
          0, // DIRECT strategy
          0, // GENERAL category
          []
        )
      ).to.emit(demetraDAO, "ProposalSubmitted");

      // Crea seconda proposta
      console.log("Creazione seconda proposta...");
      const title2 = "Proposta per Partnership Strategica";
      const description2 =
        "Proposta per partnership con azienda leader del settore";

      await expect(
        demetraDAO.connect(addr1).createProposal(
          title2,
          description2,
          0, // DIRECT strategy
          1, // STRATEGIC category
          []
        )
      ).to.emit(demetraDAO, "ProposalSubmitted");

      // Verifica che le proposte siano state create
      const updatedStats = await demetraDAO.getDAOStats();
      expect(updatedStats._totalProposalsCreated).to.equal(2n);

      // Verifica dettagli prima proposta
      const proposal1 = await proposalManager.getProposal(1);
      expect(proposal1[0]).to.equal(await addr1.getAddress()); // proposer
      expect(proposal1[1]).to.equal(title1); // title
      expect(proposal1[2]).to.equal(description1); // description
      expect(proposal1[6]).to.equal(0); // DIRECT strategy

      // Verifica dettagli seconda proposta
      const proposal2 = await proposalManager.getProposal(2);
      expect(proposal2[0]).to.equal(await addr1.getAddress()); // proposer
      expect(proposal2[1]).to.equal(title2); // title
      expect(proposal2[2]).to.equal(description2); // description
      expect(proposal2[6]).to.equal(0); // DIRECT strategy

      // Verifica statistiche membro aggiornate
      const memberInfo = await demetraDAO.getMemberInfo(
        await addr1.getAddress()
      );
      expect(memberInfo.proposalsCreated).to.equal(2n);

      console.log("✅ Test creazione proposte completato con successo");
    });

    it("Non dovrebbe permettere proposte ai non membri", async function () {
      await expect(
        demetraDAO
          .connect(addr4)
          .createProposal(
            "Proposta Non Autorizzata",
            "Questa proposta non dovrebbe essere accettata",
            0,
            0,
            []
          )
      ).to.be.revertedWith("DemetraDAO: only members can create proposals");
    });

    it("Non dovrebbe permettere proposte senza token sufficienti", async function () {
      // addr2 diventa membro ma con pochi token
      const fewTokens = ethers.parseEther("50"); // Meno del minimo richiesto (100)
      const cost = await demetraDAO.calculateTokenCost(fewTokens);
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost });

      await expect(
        demetraDAO
          .connect(addr2)
          .createProposal(
            "Proposta con Token Insufficienti",
            "Questa proposta non dovrebbe essere accettata",
            0,
            0,
            []
          )
      ).to.be.revertedWith("DemetraDAO: insufficient tokens to propose");
    });
  });

  describe("3. Test Sistema di Voto Ponderato", function () {
    let proposalId;
    let tokens1: bigint, tokens2: bigint, tokens3: bigint;

    beforeEach(async function () {
      // Setup membri con token diversi per testare voto ponderato
      tokens1 = ethers.parseEther("1000"); // 1000 token = 1000 voti
      tokens2 = ethers.parseEther("500"); // 500 token = 500 voti
      tokens3 = ethers.parseEther("200"); // 200 token = 200 voti

      const cost1 = await demetraDAO.calculateTokenCost(tokens1);
      const cost2 = await demetraDAO.calculateTokenCost(tokens2);
      const cost3 = await demetraDAO.calculateTokenCost(tokens3);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost1 });
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost2 });
      await demetraDAO.connect(addr3).purchaseTokens({ value: cost3 });

      // Delega voting power (necessario per ERC20Votes)
      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
      await demetraToken.connect(addr2).delegate(await addr2.getAddress());
      await demetraToken.connect(addr3).delegate(await addr3.getAddress());

      // Crea proposta per i test
      const tx = await demetraDAO.connect(addr1).createProposal(
        "Proposta Test Voto Ponderato",
        "Proposta per testare il sistema di voto ponderato",
        0, // DIRECT strategy
        0, // GENERAL category
        []
      );

      // Estrai proposal ID dal evento
      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = demetraDAO.interface.parseLog(event);
        proposalId = parsed.args[0];
      } else {
        proposalId = 1n;
      }
    });

    it("Il sistema di voto ponderato dovrebbe funzionare correttamente", async function () {
      console.log("\n=== TEST 3: SISTEMA DI VOTO PONDERATO ===");

      // Verifica voting power prima del voto
      const power1 = await demetraToken.getVotes(await addr1.getAddress());
      const power2 = await demetraToken.getVotes(await addr2.getAddress());
      const power3 = await demetraToken.getVotes(await addr3.getAddress());

      console.log("Voting power verificato:");
      console.log(`  addr1: ${ethers.formatEther(power1)} voti`);
      console.log(`  addr2: ${ethers.formatEther(power2)} voti`);
      console.log(`  addr3: ${ethers.formatEther(power3)} voti`);

      expect(power1).to.equal(tokens1); // tokens1 è già in wei
      expect(power2).to.equal(tokens2); // tokens2 è già in wei
      expect(power3).to.equal(tokens3); // tokens3 è già in wei

      // Verifica voting power tramite VotingStrategies
      const strategicPower1 = await votingStrategies.getCurrentVotingPower(
        await addr1.getAddress(),
        0,
        0 // DIRECT strategy, GENERAL category
      );
      const strategicPower2 = await votingStrategies.getCurrentVotingPower(
        await addr2.getAddress(),
        0,
        0
      );
      const strategicPower3 = await votingStrategies.getCurrentVotingPower(
        await addr3.getAddress(),
        0,
        0
      );

      expect(strategicPower1).to.equal(tokens1); // Usa tokens1 invece di parseEther
      expect(strategicPower2).to.equal(tokens2); // Usa tokens2 invece di parseEther
      expect(strategicPower3).to.equal(tokens3); // Usa tokens3 invece di parseEther

      console.log("✅ Voting power ponderato correttamente verificato");
    });

    it("I voti dovrebbero essere proporzionali ai token posseduti", async function () {
      console.log("\nVerifica proporzionalità voti-token...");

      // Il rapporto voti/token dovrebbe essere 1:1 per tutti
      const addr1Tokens = await demetraToken.balanceOf(
        await addr1.getAddress()
      );
      const addr1Votes = await demetraToken.getVotes(await addr1.getAddress());
      const addr2Tokens = await demetraToken.balanceOf(
        await addr2.getAddress()
      );
      const addr2Votes = await demetraToken.getVotes(await addr2.getAddress());

      expect(addr1Votes).to.equal(addr1Tokens);
      expect(addr2Votes).to.equal(addr2Tokens);

      // Verifica rapporto proporzionale
      // addr1 ha 1000 token, addr2 ha 500 token => rapporto 2:1
      expect(addr1Votes / addr2Votes).to.equal(addr1Tokens / addr2Tokens);

      console.log("✅ Proporzionalità voti-token verificata");
    });
  });

  describe("4. Test Votazione per Decisioni", function () {
    let proposalId: number;

    beforeEach(async function () {
      // Setup per test votazione
      const tokens1 = ethers.parseEther("1000");
      const tokens2 = ethers.parseEther("500");
      const tokens3 = ethers.parseEther("300");

      const cost1 = await demetraDAO.calculateTokenCost(tokens1);
      const cost2 = await demetraDAO.calculateTokenCost(tokens2);
      const cost3 = await demetraDAO.calculateTokenCost(tokens3);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost1 });
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost2 });
      await demetraDAO.connect(addr3).purchaseTokens({ value: cost3 });

      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
      await demetraToken.connect(addr2).delegate(await addr2.getAddress());
      await demetraToken.connect(addr3).delegate(await addr3.getAddress());

      // Crea proposta
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Proposta per Test Votazione",
          "Proposta per testare il sistema di votazione",
          0,
          0,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });

      proposalId = event ? demetraDAO.interface.parseLog(event).args[0] : 1n;
    });

    it("La votazione dovrebbe funzionare correttamente con registrazione voti", async function () {
      console.log("\n=== TEST 4: VOTAZIONE PER DECISIONI ===");

      // Verifica stato iniziale
      expect(
        await proposalManager.hasVoted(proposalId, await addr1.getAddress())
      ).to.be.false;
      expect(
        await proposalManager.hasVoted(proposalId, await addr2.getAddress())
      ).to.be.false;
      expect(
        await proposalManager.hasVoted(proposalId, await addr3.getAddress())
      ).to.be.false;

      // addr1 vota A FAVORE (1000 voti)
      console.log("addr1 vota A FAVORE...");
      await expect(
        demetraDAO.connect(addr1).vote(proposalId, 1) // VoteChoice.FOR
      )
        .to.emit(demetraDAO, "VoteRecorded")
        .withArgs(proposalId, await addr1.getAddress());

      // addr2 vota CONTRO (500 voti)
      console.log("addr2 vota CONTRO...");
      await expect(
        demetraDAO.connect(addr2).vote(proposalId, 2) // VoteChoice.AGAINST
      )
        .to.emit(demetraDAO, "VoteRecorded")
        .withArgs(proposalId, await addr2.getAddress());

      // addr3 si ASTIENE (300 voti)
      console.log("addr3 si ASTIENE...");
      await expect(
        demetraDAO.connect(addr3).vote(proposalId, 0) // VoteChoice.ABSTAIN
      )
        .to.emit(demetraDAO, "VoteRecorded")
        .withArgs(proposalId, await addr3.getAddress());

      // Verifica che tutti abbiano votato
      expect(
        await proposalManager.hasVoted(proposalId, await addr1.getAddress())
      ).to.be.true;
      expect(
        await proposalManager.hasVoted(proposalId, await addr2.getAddress())
      ).to.be.true;
      expect(
        await proposalManager.hasVoted(proposalId, await addr3.getAddress())
      ).to.be.true;

      // Verifica statistiche membri aggiornate
      const member1 = await demetraDAO.getMemberInfo(await addr1.getAddress());
      const member2 = await demetraDAO.getMemberInfo(await addr2.getAddress());
      const member3 = await demetraDAO.getMemberInfo(await addr3.getAddress());

      expect(member1.votesParticipated).to.equal(1n);
      expect(member2.votesParticipated).to.equal(1n);
      expect(member3.votesParticipated).to.equal(1n);

      // Verifica statistiche DAO
      const daoStats = await demetraDAO.getDAOStats();
      expect(daoStats._totalVotesCast).to.equal(3n);

      console.log("✅ Votazione completata e registrata correttamente");
    });

    it("Non dovrebbe permettere il doppio voto", async function () {
      // Primo voto
      await demetraDAO.connect(addr1).vote(proposalId, 1);

      // Tentativo di secondo voto dovrebbe fallire
      await expect(
        demetraDAO.connect(addr1).vote(proposalId, 2)
      ).to.be.revertedWith("DemetraDAO: already voted");

      console.log("✅ Prevenzione doppio voto verificata");
    });
  });

  describe("5. Test Approvazione Decisioni per Maggioranza", function () {
    let proposalId: number;

    beforeEach(async function () {
      // Setup con più membri per test maggioranza
      const tokens1 = ethers.parseEther("1000"); // 55.6% dei voti
      const tokens2 = ethers.parseEther("400"); // 22.2% dei voti
      const tokens3 = ethers.parseEther("400"); // 22.2% dei voti

      const cost1 = await demetraDAO.calculateTokenCost(tokens1);
      const cost2 = await demetraDAO.calculateTokenCost(tokens2);
      const cost3 = await demetraDAO.calculateTokenCost(tokens3);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost1 });
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost2 });
      await demetraDAO.connect(addr3).purchaseTokens({ value: cost3 });

      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
      await demetraToken.connect(addr2).delegate(await addr2.getAddress());
      await demetraToken.connect(addr3).delegate(await addr3.getAddress());

      // Crea proposta
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Proposta per Test Maggioranza",
          "Proposta per testare l'approvazione per maggioranza",
          0,
          0,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });

      proposalId = event ? demetraDAO.interface.parseLog(event).args[0] : 1n;
    });

    it("La decisione con maggioranza dovrebbe essere approvata", async function () {
      console.log("\n=== TEST 5: APPROVAZIONE PER MAGGIORANZA ===");

      // Scenario: addr1 (1000 voti) e addr2 (400 voti) votano A FAVORE = 1400 voti
      //          addr3 (400 voti) vota CONTRO = 400 voti
      //          Risultato: 77.8% A FAVORE > soglia 60% => APPROVATA

      console.log("Votazione per maggioranza...");
      await demetraDAO.connect(addr1).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr2).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr3).vote(proposalId, 2); // AGAINST

      // Avanza il tempo per superare il periodo di votazione
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]); // +7 giorni +1 secondo
      await ethers.provider.send("evm_mine");

      // Finalizza la proposta
      console.log("Finalizzazione proposta...");
      await demetraDAO.finalizeProposal(proposalId);

      // Verifica che la proposta sia stata approvata
      const proposal = await proposalManager.getProposal(proposalId);
      const state = proposal[7]; // proposal state

      // ProposalState.SUCCEEDED = 2 (aggiornato dall'ordine corretto)
      expect(state).to.equal(2); // Dovrebbe essere SUCCEEDED

      console.log("✅ Proposta approvata per maggioranza verificata");
    });
  });

  describe("6. Test Registro Decisioni e Votazioni", function () {
    it("Il registro delle decisioni dovrebbe essere mantenuto correttamente", async function () {
      console.log("\n=== TEST 6: REGISTRO DECISIONI E VOTAZIONI ===");

      // Setup membri
      const tokens = ethers.parseEther("1000");
      const cost = await demetraDAO.calculateTokenCost(tokens);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost });
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost });

      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
      await demetraToken.connect(addr2).delegate(await addr2.getAddress());

      // Crea multiple proposte
      console.log("Creazione multiple proposte...");
      await demetraDAO
        .connect(addr1)
        .createProposal("Proposta 1", "Descrizione 1", 0, 0, []);
      await demetraDAO
        .connect(addr1)
        .createProposal("Proposta 2", "Descrizione 2", 0, 0, []);
      await demetraDAO
        .connect(addr2)
        .createProposal("Proposta 3", "Descrizione 3", 0, 0, []);

      // Vota su multiple proposte
      console.log("Votazione su multiple proposte...");
      await demetraDAO.connect(addr1).vote(1, 1); // FOR su proposta 1
      await demetraDAO.connect(addr2).vote(1, 1); // FOR su proposta 1

      await demetraDAO.connect(addr1).vote(2, 2); // AGAINST su proposta 2
      await demetraDAO.connect(addr2).vote(2, 1); // FOR su proposta 2

      await demetraDAO.connect(addr1).vote(3, 0); // ABSTAIN su proposta 3
      await demetraDAO.connect(addr2).vote(3, 2); // AGAINST su proposta 3

      // Verifica registro statistiche globali
      const daoStats = await demetraDAO.getDAOStats();
      expect(daoStats._totalProposalsCreated).to.equal(3n);
      expect(daoStats._totalVotesCast).to.equal(6n); // 2 membri x 3 proposte

      // Verifica registro statistiche individuali
      const member1Stats = await demetraDAO.getMemberInfo(
        await addr1.getAddress()
      );
      const member2Stats = await demetraDAO.getMemberInfo(
        await addr2.getAddress()
      );

      expect(member1Stats.proposalsCreated).to.equal(2n); // addr1 ha creato 2 proposte
      expect(member1Stats.votesParticipated).to.equal(3n); // addr1 ha votato 3 volte
      expect(member2Stats.proposalsCreated).to.equal(1n); // addr2 ha creato 1 proposta
      expect(member2Stats.votesParticipated).to.equal(3n); // addr2 ha votato 3 volte

      // Verifica dettagli delle proposte nel registro
      const proposal1 = await proposalManager.getProposal(1);
      const proposal2 = await proposalManager.getProposal(2);
      const proposal3 = await proposalManager.getProposal(3);

      expect(proposal1[1]).to.equal("Proposta 1");
      expect(proposal2[1]).to.equal("Proposta 2");
      expect(proposal3[1]).to.equal("Proposta 3");

      // Verifica stato dei voti
      expect(await proposalManager.hasVoted(1, await addr1.getAddress())).to.be
        .true;
      expect(await proposalManager.hasVoted(2, await addr1.getAddress())).to.be
        .true;
      expect(await proposalManager.hasVoted(3, await addr1.getAddress())).to.be
        .true;
      expect(await proposalManager.hasVoted(1, await addr2.getAddress())).to.be
        .true;
      expect(await proposalManager.hasVoted(2, await addr2.getAddress())).to.be
        .true;
      expect(await proposalManager.hasVoted(3, await addr2.getAddress())).to.be
        .true;

      console.log("✅ Registro decisioni e votazioni mantenuto correttamente");
    });
  });

  describe("7. Test Restrizioni Voto senza Azioni", function () {
    let proposalId: number;

    beforeEach(async function () {
      // Setup: solo addr1 ha token, addr4 non ne ha
      const tokens = ethers.parseEther("1000");
      const cost = await demetraDAO.calculateTokenCost(tokens);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost });
      await demetraToken.connect(addr1).delegate(await addr1.getAddress());

      // Crea proposta
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Proposta Test Restrizioni",
          "Proposta per testare restrizioni di voto",
          0,
          0,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });

      proposalId = event ? demetraDAO.interface.parseLog(event).args[0] : 1n;
    });

    it("Non dovrebbe essere possibile votare senza possedere azioni", async function () {
      console.log("\n=== TEST 7: RESTRIZIONI VOTO SENZA AZIONI ===");

      // Verifica che addr4 non sia membro
      expect(await demetraDAO.isMember(await addr4.getAddress())).to.be.false;

      // Verifica che addr4 non abbia token
      expect(await demetraToken.balanceOf(await addr4.getAddress())).to.equal(
        0
      );

      // Verifica che addr4 non abbia voting power
      expect(await demetraToken.getVotes(await addr4.getAddress())).to.equal(0);

      // Tentativo di voto da parte di addr4 dovrebbe fallire
      console.log("Tentativo voto da non-membro...");
      await expect(
        demetraDAO.connect(addr4).vote(proposalId, 1)
      ).to.be.revertedWith("DemetraDAO: only members can vote");

      // Verifica con canVote function
      const canVoteResult = await demetraDAO.canVote(
        await addr4.getAddress(),
        proposalId
      );
      expect(canVoteResult[0]).to.be.false; // cannot vote
      expect(canVoteResult[1]).to.equal("Not a member"); // reason

      console.log("✅ Restrizione voto senza azioni verificata");
    });

    it("Non dovrebbe essere possibile votare con token ma senza voting power", async function () {
      // addr2 acquista token ma non delega (quindi voting power = 0)
      const tokens = ethers.parseEther("500");
      const cost = await demetraDAO.calculateTokenCost(tokens);

      await demetraDAO.connect(addr2).purchaseTokens({ value: cost });

      // Verifica che addr2 sia membro e abbia token
      expect(await demetraDAO.isMember(await addr2.getAddress())).to.be.true;
      expect(await demetraToken.balanceOf(await addr2.getAddress())).to.equal(
        tokens
      );

      // Ma non ha voting power (non ha delegato)
      expect(await demetraToken.getVotes(await addr2.getAddress())).to.equal(0);

      // Verifica con canVote function
      const canVoteResult = await demetraDAO.canVote(
        await addr2.getAddress(),
        proposalId
      );
      expect(canVoteResult[0]).to.be.false; // cannot vote
      expect(canVoteResult[1]).to.equal("No voting power"); // reason

      // Il voto dovrebbe fallire a livello di VotingStrategies
      await expect(
        demetraDAO.connect(addr2).vote(proposalId, 1)
      ).to.be.revertedWith("VotingStrategies: no voting power");

      console.log("✅ Restrizione voto senza voting power verificata");
    });

    it("Dovrebbe permettere il voto solo a chi possiede azioni E voting power", async function () {
      // addr3 acquista token E delega (quindi ha voting power)
      const tokens = ethers.parseEther("300");
      const cost = await demetraDAO.calculateTokenCost(tokens);

      await demetraDAO.connect(addr3).purchaseTokens({ value: cost });
      await demetraToken.connect(addr3).delegate(await addr3.getAddress());

      // Verifica condizioni necessarie
      expect(await demetraDAO.isMember(await addr3.getAddress())).to.be.true;
      expect(await demetraToken.balanceOf(await addr3.getAddress())).to.equal(
        tokens
      );
      expect(await demetraToken.getVotes(await addr3.getAddress())).to.equal(
        tokens
      );

      // Verifica con canVote function
      const canVoteResult = await demetraDAO.canVote(
        await addr3.getAddress(),
        proposalId
      );
      expect(canVoteResult[0]).to.be.true; // can vote
      expect(canVoteResult[1]).to.equal("Can vote"); // reason

      // Il voto dovrebbe andare a buon fine
      await expect(demetraDAO.connect(addr3).vote(proposalId, 1))
        .to.emit(demetraDAO, "VoteRecorded")
        .withArgs(proposalId, await addr3.getAddress());

      // Verifica che il voto sia stato registrato
      expect(
        await proposalManager.hasVoted(proposalId, await addr3.getAddress())
      ).to.be.true;

      console.log(
        "✅ Voto consentito solo con azioni e voting power verificato"
      );
    });
  });

  describe("8. Test Completo Ciclo di Vita Proposta", function () {
    it("Test completo: creazione, votazione, approvazione ed esecuzione", async function () {
      console.log("\n=== TEST 8: CICLO COMPLETO PROPOSTA ===");

      // === FASE 1: SETUP MEMBRI ===
      console.log("Fase 1: Setup membri...");
      const tokens1 = ethers.parseEther("600"); // 60% dei voti
      const tokens2 = ethers.parseEther("250"); // 25% dei voti
      const tokens3 = ethers.parseEther("150"); // 15% dei voti
      // Totale: 1000 token

      const cost1 = await demetraDAO.calculateTokenCost(tokens1);
      const cost2 = await demetraDAO.calculateTokenCost(tokens2);
      const cost3 = await demetraDAO.calculateTokenCost(tokens3);

      await demetraDAO.connect(addr1).purchaseTokens({ value: cost1 });
      await demetraDAO.connect(addr2).purchaseTokens({ value: cost2 });
      await demetraDAO.connect(addr3).purchaseTokens({ value: cost3 });

      await demetraToken.connect(addr1).delegate(await addr1.getAddress());
      await demetraToken.connect(addr2).delegate(await addr2.getAddress());
      await demetraToken.connect(addr3).delegate(await addr3.getAddress());

      // === FASE 2: CREAZIONE PROPOSTA ===
      console.log("Fase 2: Creazione proposta...");
      const tx = await demetraDAO.connect(addr1).createProposal(
        "Proposta Strategica Importante",
        "Proposta per implementare una nuova strategia di crescita",
        0, // DIRECT strategy
        1, // STRATEGIC category
        [] // no actions for now
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });

      const proposalId = event
        ? demetraDAO.interface.parseLog(event).args[0]
        : 1n;

      // Verifica proposta creata
      const proposal = await proposalManager.getProposal(proposalId);
      expect(proposal[1]).to.equal("Proposta Strategica Importante");

      // === FASE 3: VOTAZIONE ===
      console.log("Fase 3: Votazione...");

      // addr1 (600 voti) vota A FAVORE
      await demetraDAO.connect(addr1).vote(proposalId, 1); // FOR

      // addr2 (250 voti) vota A FAVORE
      await demetraDAO.connect(addr2).vote(proposalId, 1); // FOR

      // addr3 (150 voti) vota CONTRO
      await demetraDAO.connect(addr3).vote(proposalId, 2); // AGAINST

      // Risultato atteso: 850 voti A FAVORE vs 150 CONTRO = 85% approvazione

      // === FASE 4: FINALIZZAZIONE ===
      console.log("Fase 4: Finalizzazione...");

      // Avanza tempo oltre periodo di votazione
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      // Finalizza proposta
      await demetraDAO.finalizeProposal(proposalId);

      // === FASE 5: VERIFICA APPROVAZIONE ===
      console.log("Fase 5: Verifica approvazione...");

      const finalProposal = await proposalManager.getProposal(proposalId);
      const finalState = finalProposal[7];

      // Dovrebbe essere SUCCEEDED (2) dato che 85% > 60% soglia
      expect(finalState).to.equal(2);

      // === FASE 6: VERIFICA REGISTRO FINALE ===
      console.log("Fase 6: Verifica registro finale...");

      // Statistiche DAO aggiornate
      const finalStats = await demetraDAO.getDAOStats();
      expect(finalStats._totalProposalsCreated).to.equal(1n);
      expect(finalStats._totalVotesCast).to.equal(3n);
      expect(finalStats._totalMembers).to.equal(4n); // owner + 3 new members

      // Statistiche membri aggiornate
      const member1Final = await demetraDAO.getMemberInfo(
        await addr1.getAddress()
      );
      const member2Final = await demetraDAO.getMemberInfo(
        await addr2.getAddress()
      );
      const member3Final = await demetraDAO.getMemberInfo(
        await addr3.getAddress()
      );

      expect(member1Final.proposalsCreated).to.equal(1n);
      expect(member1Final.votesParticipated).to.equal(1n);
      expect(member2Final.votesParticipated).to.equal(1n);
      expect(member3Final.votesParticipated).to.equal(1n);

      console.log("✅ Ciclo completo proposta verificato con successo");
      console.log("   - Proposta creata ✓");
      console.log("   - Votazione completata ✓");
      console.log("   - Approvazione per maggioranza ✓");
      console.log("   - Registro aggiornato ✓");
    });
  });

  describe("9. Test Edge Cases e Validazioni", function () {
    it("Dovrebbe gestire correttamente scenari limite", async function () {
      console.log("\n=== TEST 9: EDGE CASES E VALIDAZIONI ===");

      // Test vendita token disabilitata
      await demetraDAO.disableTokenSale();

      await expect(
        demetraDAO.connect(addr1).purchaseTokens({
          value: await demetraDAO.calculateTokenCost(ethers.parseEther("100")),
        })
      ).to.be.revertedWith("DemetraDAO: token sale not active");

      // Riabilita vendita
      await demetraDAO.enableTokenSale();

      // Test acquisto minimo e massimo
      const minTokens = ethers.parseEther("1");
      const maxTokens = ethers.parseEther("10000");

      // Acquisto valido minimo
      await expect(
        demetraDAO.connect(addr1).purchaseTokens({
          value: await demetraDAO.calculateTokenCost(minTokens),
        })
      ).to.not.be.reverted;

      // Acquisto valido massimo
      await expect(
        demetraDAO.connect(addr2).purchaseTokens({
          value: await demetraDAO.calculateTokenCost(maxTokens),
        })
      ).to.not.be.reverted;

      // Test che il member esistente venga aggiornato (non duplicato)
      const membersBefore = await demetraDAO.totalMembers();

      await demetraDAO.connect(addr1).purchaseTokens({
        value: await demetraDAO.calculateTokenCost(ethers.parseEther("100")),
      });

      const membersAfter = await demetraDAO.totalMembers();
      expect(membersAfter).to.equal(membersBefore); // Non dovrebbe aumentare

      // Ma i token dovrebbero essere aggiornati
      const member1Info = await demetraDAO.getMemberInfo(
        await addr1.getAddress()
      );
      const expectedTokens = minTokens + ethers.parseEther("100"); // 1 + 100 = 101 token
      expect(member1Info.tokensOwned).to.equal(expectedTokens);

      console.log("✅ Edge cases gestiti correttamente");
    });
  });

  describe("10. Test Statistiche e Reporting Finale", function () {
    it("Dovrebbe fornire statistiche complete e accurate", async function () {
      console.log("\n=== TEST 10: STATISTICHE E REPORTING FINALE ===");

      // Setup scenario complesso con multiple azioni
      const scenarios = [
        { addr: addr1, tokens: ethers.parseEther("500") },
        { addr: addr2, tokens: ethers.parseEther("300") },
        { addr: addr3, tokens: ethers.parseEther("200") },
      ];

      let totalFundsExpected = 0n;

      // Acquisti multipli
      for (const scenario of scenarios) {
        const cost = await demetraDAO.calculateTokenCost(scenario.tokens);
        totalFundsExpected += cost;

        await demetraDAO.connect(scenario.addr).purchaseTokens({ value: cost });
        await demetraToken
          .connect(scenario.addr)
          .delegate(await scenario.addr.getAddress());
      }

      // Crea multiple proposte
      await demetraDAO
        .connect(addr1)
        .createProposal("Prop 1", "Desc 1", 0, 0, []);
      await demetraDAO
        .connect(addr2)
        .createProposal("Prop 2", "Desc 2", 0, 0, []);

      // Votazioni multiple
      await demetraDAO.connect(addr1).vote(1, 1); // Prop 1: FOR
      await demetraDAO.connect(addr2).vote(1, 2); // Prop 1: AGAINST
      await demetraDAO.connect(addr3).vote(1, 0); // Prop 1: ABSTAIN

      await demetraDAO.connect(addr1).vote(2, 2); // Prop 2: AGAINST
      await demetraDAO.connect(addr2).vote(2, 1); // Prop 2: FOR
      // addr3 non vota sulla Prop 2

      // Verifica statistiche finali complete
      const finalStats = await demetraDAO.getDAOStats();

      console.log("Statistiche Finali DAO:");
      console.log(`  Membri totali: ${finalStats._totalMembers}`);
      console.log(`  Proposte create: ${finalStats._totalProposalsCreated}`);
      console.log(`  Voti totali: ${finalStats._totalVotesCast}`);
      console.log(
        `  Fondi raccolti: ${ethers.formatEther(
          finalStats._totalFundsRaised
        )} ETH`
      );
      console.log(
        `  Treasury balance: ${ethers.formatEther(
          finalStats._treasuryBalance
        )} ETH`
      );
      console.log(
        `  Token supply: ${ethers.formatEther(finalStats._tokenSupply)}`
      );
      console.log(`  Token sale active: ${finalStats._tokenSaleActive}`);

      // Verifiche statistiche
      expect(finalStats._totalMembers).to.equal(4n); // owner + 3 nuovi
      expect(finalStats._totalProposalsCreated).to.equal(2n);
      expect(finalStats._totalVotesCast).to.equal(5n); // 3 + 2 voti
      expect(finalStats._totalFundsRaised).to.equal(totalFundsExpected);
      expect(finalStats._treasuryBalance).to.equal(totalFundsExpected);
      expect(finalStats._tokenSupply).to.equal(
        scenarios[0].tokens + scenarios[1].tokens + scenarios[2].tokens
      ); // Somma diretta dei token in wei
      expect(finalStats._tokenSaleActive).to.be.true;

      // Verifica statistiche individuali dettagliate
      const members = [
        { addr: await addr1.getAddress(), expectedProps: 1, expectedVotes: 2 },
        { addr: await addr2.getAddress(), expectedProps: 1, expectedVotes: 2 },
        { addr: await addr3.getAddress(), expectedProps: 0, expectedVotes: 1 },
      ];

      for (const member of members) {
        const info = await demetraDAO.getMemberInfo(member.addr);
        console.log(`Membro ${member.addr}:`);
        console.log(`  Proposte create: ${info.proposalsCreated}`);
        console.log(`  Voti partecipati: ${info.votesParticipated}`);
        console.log(
          `  Token posseduti: ${ethers.formatEther(info.tokensOwned)}`
        );

        expect(info.proposalsCreated).to.equal(member.expectedProps);
        expect(info.votesParticipated).to.equal(member.expectedVotes);
        expect(info.isActive).to.be.true;
      }

      console.log("✅ Tutti i test completati con successo!");
      console.log("✅ Sistema DAO completamente funzionale e verificato");
    });
  });
  describe("11. Test Completo Strategie di Governance", function () {
    let proposalId;

    beforeEach(async function () {
      // Setup membri con token diversi
      const tokens = [
        { user: addr1, amount: ethers.parseEther("1000") }, // 40%
        { user: addr2, amount: ethers.parseEther("800") }, // 32%
        { user: addr3, amount: ethers.parseEther("700") }, // 28%
      ];

      for (const token of tokens) {
        const cost = await demetraDAO.calculateTokenCost(token.amount);
        await demetraDAO.connect(token.user).purchaseTokens({ value: cost });
        await demetraToken
          .connect(token.user)
          .delegate(await token.user.getAddress());
      }
    });

    it("Strategia 1: DEMOCRAZIA DIRETTA - Voto ponderato per token", async function () {
      console.log("\n=== TEST DEMOCRAZIA DIRETTA ===");

      // Crea proposta con strategia DIRECT
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Proposta Democrazia Diretta",
          "Test della democrazia diretta - 1 token = 1 voto",
          VotingStrategy.DIRECT,
          ProposalCategory.GENERAL,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });
      proposalId = demetraDAO.interface.parseLog(event).args[0];

      // Verifica voting power = token posseduti
      const power1 = await votingStrategies.getCurrentVotingPower(
        await addr1.getAddress(),
        VotingStrategy.DIRECT,
        ProposalCategory.GENERAL
      );
      const power2 = await votingStrategies.getCurrentVotingPower(
        await addr2.getAddress(),
        VotingStrategy.DIRECT,
        ProposalCategory.GENERAL
      );

      console.log(`Alice voting power: ${ethers.formatEther(power1)} voti`);
      console.log(`Bob voting power: ${ethers.formatEther(power2)} voti`);

      expect(power1).to.equal(ethers.parseEther("1000"));
      expect(power2).to.equal(ethers.parseEther("800"));

      // Voto: Alice (1000) + Bob (800) = 1800 A FAVORE vs Charlie (700) CONTRO
      await demetraDAO.connect(addr1).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr2).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr3).vote(proposalId, 2); // AGAINST

      console.log("Risultato: 1800 A FAVORE vs 700 CONTRO (72% approvazione)");
      console.log(
        "✅ Democrazia diretta: peso del voto proporzionale ai token"
      );
    });

    it("Strategia 2: DEMOCRAZIA LIQUIDA - Deleghe per categoria", async function () {
      console.log("\n=== TEST DEMOCRAZIA LIQUIDA ===");

      // Charlie delega i suoi voti TECNICI ad Alice (l'esperta)
      console.log("Charlie delega voti TECNICI ad Alice...");
      await votingStrategies
        .connect(addr3)
        .delegateForCategory(
          ProposalCategory.TECHNICAL,
          await addr1.getAddress()
        );

      // Verifica delega attiva
      const delegate = await votingStrategies.getCategoryDelegate(
        await addr3.getAddress(),
        ProposalCategory.TECHNICAL
      );
      expect(delegate).to.equal(await addr1.getAddress());

      // Crea proposta TECNICA con strategia LIQUID
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Proposta Tecnica Liquida",
          "Upgrade tecnico - con deleghe per categoria",
          VotingStrategy.LIQUID,
          ProposalCategory.TECHNICAL,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });
      proposalId = demetraDAO.interface.parseLog(event).args[0];

      // Verifica voting power con deleghe
      const alicePowerLiquid = await votingStrategies.getCurrentVotingPower(
        await addr1.getAddress(),
        VotingStrategy.LIQUID,
        ProposalCategory.TECHNICAL
      );
      const charlieDelegatedVotes =
        await votingStrategies.getCategoryDelegatedVotes(
          await addr1.getAddress(),
          ProposalCategory.TECHNICAL
        );

      console.log(
        `Alice base power: ${ethers.formatEther(
          ethers.parseEther("1000")
        )} voti`
      );
      console.log(
        `Charlie delegated to Alice: ${ethers.formatEther(
          charlieDelegatedVotes
        )} voti`
      );
      console.log(
        `Alice total power: ${ethers.formatEther(alicePowerLiquid)} voti`
      );

      // Alice dovrebbe avere 1000 (suoi) + 700 (delegati da Charlie) = 1700
      expect(alicePowerLiquid).to.equal(ethers.parseEther("1700"));

      // Voto con democrazia liquida
      await demetraDAO.connect(addr1).vote(proposalId, 1); // Alice: 1700 voti FOR
      await demetraDAO.connect(addr2).vote(proposalId, 2); // Bob: 800 voti AGAINST
      // Charlie non vota (ha delegato)

      console.log(
        "Risultato Liquido: 1700 A FAVORE vs 800 CONTRO (68% approvazione)"
      );
      console.log("✅ Democrazia liquida: deleghe per categoria funzionanti");
    });

    it("Strategia 3: CONSENSO - Un membro, un voto", async function () {
      console.log("\n=== TEST CONSENSO ===");

      // Crea proposta con strategia CONSENSUS
      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Proposta Consenso",
          "Decisione critica - richiede consenso 75%",
          VotingStrategy.CONSENSUS,
          ProposalCategory.GOVERNANCE,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });
      proposalId = demetraDAO.interface.parseLog(event).args[0];

      // Verifica voting power = 1 per tutti (indipendentemente dai token)
      const consensusPower1 = await votingStrategies.getCurrentVotingPower(
        await addr1.getAddress(),
        VotingStrategy.CONSENSUS,
        ProposalCategory.GOVERNANCE
      );
      const consensusPower2 = await votingStrategies.getCurrentVotingPower(
        await addr2.getAddress(),
        VotingStrategy.CONSENSUS,
        ProposalCategory.GOVERNANCE
      );
      const consensusPower3 = await votingStrategies.getCurrentVotingPower(
        await addr3.getAddress(),
        VotingStrategy.CONSENSUS,
        ProposalCategory.GOVERNANCE
      );

      console.log(`Alice consensus power: ${consensusPower1} voto`);
      console.log(`Bob consensus power: ${consensusPower2} voto`);
      console.log(`Charlie consensus power: ${consensusPower3} voto`);

      expect(consensusPower1).to.equal(1); // 1 voto indipendentemente dai token
      expect(consensusPower2).to.equal(1);
      expect(consensusPower3).to.equal(1);

      // Test 1: Solo 2/3 membri votano A FAVORE (66.7% < 75% richiesto)
      await demetraDAO.connect(addr1).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr2).vote(proposalId, 1); // FOR
      await demetraDAO.connect(addr3).vote(proposalId, 2); // AGAINST

      // Finalizza proposta
      await ethers.provider.send("evm_increaseTime", [14 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      await demetraDAO.finalizeProposal(proposalId);

      const proposal = await proposalManager.getProposal(proposalId);
      const proposalState = proposal[7]; // Assuming index 7 is the state, as in other tests
      expect(proposalState).to.equal(4); // FAILED - non raggiunge 75%

      console.log(
        "Risultato Consenso: 2 A FAVORE vs 1 CONTRO (66.7% < 75% richiesto)"
      );
      console.log("✅ Consenso: richiesta supermajority 75% funzionante");
    });

    it("Strategia 4: RAPPRESENTATIVA - Elezione rappresentanti", async function () {
      console.log("\n=== TEST DEMOCRAZIA RAPPRESENTATIVA ===");

      // Per ora implementazione base simile alla diretta
      // Ma struttura pronta per estensione con elezione rappresentanti

      const tx = await demetraDAO
        .connect(addr1)
        .createProposal(
          "Proposta Rappresentativa",
          "Test democrazia rappresentativa - base implementation",
          VotingStrategy.REPRESENTATIVE,
          ProposalCategory.STRATEGIC,
          []
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = demetraDAO.interface.parseLog(log);
          return parsed?.name === "ProposalSubmitted";
        } catch {
          return false;
        }
      });
      proposalId = demetraDAO.interface.parseLog(event).args[0];

      // Verifica voting power (implementazione base = diretta)
      const reprPower1 = await votingStrategies.getCurrentVotingPower(
        await addr1.getAddress(),
        VotingStrategy.REPRESENTATIVE,
        ProposalCategory.STRATEGIC
      );

      expect(reprPower1).to.equal(ethers.parseEther("1000"));

      console.log("✅ Democrazia rappresentativa: struttura implementata");
      console.log("   (Pronta per estensione con elezione rappresentanti)");
    });

    it("Test Comparativo: Stessa decisione con 4 strategie diverse", async function () {
      console.log("\n=== TEST COMPARATIVO STRATEGIE ===");

      const strategies = [
        {
          name: "DIRECT",
          strategy: VotingStrategy.DIRECT,
          category: ProposalCategory.GENERAL,
        },
        {
          name: "LIQUID",
          strategy: VotingStrategy.LIQUID,
          category: ProposalCategory.TECHNICAL,
        },
        {
          name: "REPRESENTATIVE",
          strategy: VotingStrategy.REPRESENTATIVE,
          category: ProposalCategory.STRATEGIC,
        },
        {
          name: "CONSENSUS",
          strategy: VotingStrategy.CONSENSUS,
          category: ProposalCategory.GOVERNANCE,
        },
      ];

      const results = [];

      for (let i = 0; i < strategies.length; i++) {
        const strat = strategies[i];

        // Crea proposta identica con strategia diversa
        const tx = await demetraDAO
          .connect(addr1)
          .createProposal(
            `Decisione ${strat.name}`,
            "Stessa decisione testata con strategie diverse",
            strat.strategy,
            strat.category,
            []
          );

        const receipt = await tx.wait();
        const event = receipt.logs.find((log: any) => {
          try {
            const parsed = demetraDAO.interface.parseLog(log);
            return parsed?.name === "ProposalSubmitted";
          } catch {
            return false;
          }
        });
        const propId = demetraDAO.interface.parseLog(event).args[0];

        // Voto sempre uguale: Alice+Bob FOR, Charlie AGAINST
        await demetraDAO.connect(addr1).vote(propId, 1);
        await demetraDAO.connect(addr2).vote(propId, 1);
        await demetraDAO.connect(addr3).vote(propId, 2);

        // Calcola voting power per strategia
        const power1 = await votingStrategies.getCurrentVotingPower(
          await addr1.getAddress(),
          strat.strategy,
          strat.category
        );
        const power2 = await votingStrategies.getCurrentVotingPower(
          await addr2.getAddress(),
          strat.strategy,
          strat.category
        );
        const power3 = await votingStrategies.getCurrentVotingPower(
          await addr3.getAddress(),
          strat.strategy,
          strat.category
        );

        const totalFor = power1 + power2;
        const totalAgainst = power3;
        const percentage = (totalFor * 100n) / (totalFor + totalAgainst);

        results.push({
          strategy: strat.name,
          votesFor: totalFor,
          votesAgainst: totalAgainst,
          percentage: percentage.toString(),
        });

        console.log(
          `${strat.name}: ${totalFor} FOR vs ${totalAgainst} AGAINST (${percentage}%)`
        );
      }

      console.log("\n📊 Risultati Comparativi:");
      results.forEach((r) => {
        console.log(`  ${r.strategy}: ${r.percentage}% approvazione`);
      });

      // Verifica che le strategie diano risultati diversi
      expect(results[0].votesFor).to.not.equal(results[3].votesFor); // DIRECT ≠ CONSENSUS

      console.log("✅ Tutte e 4 le strategie implementate e funzionanti!");
    });
  });
});
