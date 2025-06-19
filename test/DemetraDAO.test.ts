import { expect } from "chai";
import { ethers } from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";

describe("DemetraDAO", function () {
  let dao: any;
  let admin: any, addr1: any, addr2: any;
  const tokenPrice = ethers.parseEther("1"); // BigInt
  const maxSupply = ethers.parseEther("1000000");

  beforeEach(async function () {
    [admin, addr1, addr2] = await ethers.getSigners();

    const DemetraDAO = await ethers.getContractFactory("DemetraDAO");
    dao = await DemetraDAO.deploy(
      "DemetraToken",
      "DMT",
      tokenPrice,
      maxSupply,
      admin.address
    );
  });

  it("should allow token purchase and add member", async function () {
    const purchaseAmount = ethers.parseEther("1"); // 1 token in wei
    const valueToSend = purchaseAmount * tokenPrice; // valore ETH da pagare

    await dao.connect(addr1).purchaseTokens({ value: valueToSend });

    const memberInfo = await dao.getMemberInfo(addr1.address);
    expect(memberInfo.isActive).to.be.true;
    expect(memberInfo.tokensOwned).to.equal(purchaseAmount);
  });

  it("should revert proposal creation for non-member", async function () {
    // addr1 non ha token -> non è membro
    await expect(
      dao.connect(addr1).createProposal("Title", "Description", 0, 0, [])
    ).to.be.revertedWith("DemetraDAO: only members can create proposals");
  });

  it("should revert proposal creation without enough tokens", async function () {
    // Prima compra un token per diventare membro ma con pochi token
    const tokensToBuy = 1n; // quantità insufficiente per proporre
    await dao
      .connect(addr1)
      .purchaseTokens({ value: tokenPrice * tokensToBuy });

    // Ora addr1 è membro ma con pochi token
    await expect(
      dao.connect(addr1).createProposal("Title", "Description", 0, 0, [])
    ).to.be.revertedWith("DemetraDAO: insufficient tokens to propose");
  });
});
