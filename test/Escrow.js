const { expect } = require("chai");
const { ethers } = require("hardhat");

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), "ether");
};

describe("Escrow", () => {
  let buyer, seller, inspector, lender;
  let realEstate, escrow;

  beforeEach(async () => {
    [buyer, seller, inspector, lender] = await ethers.getSigners();

    // deploy Real Estate
    const RealEstate = await ethers.getContractFactory("RealEstate");
    realEstate = await RealEstate.deploy();

    // mint
    let transaction = await realEstate
      .connect(seller)
      .mint(
        "https://ipfs.io/ipfs/QmQUozrHLAusXDxrvsESJ3PYB3rUeUuBAvVWw6nop2uu7c/1.png",
      );
    transaction.wait();

    const EsCrow = await ethers.getContractFactory("Escrow");
    escrow = await EsCrow.deploy(
      realEstate.address,
      seller.address,
      inspector.address,
      lender.address,
    );

    // approve
    transaction = await realEstate.connect(seller).approve(escrow.address, 1);
    await transaction.wait();

    // list property
    transaction = await escrow
      .connect(seller)
      .list(1, buyer.address, tokens(10), tokens(5));
    await transaction.wait();
  });

  describe("Deployment", () => {
    it("returns NFT address", async () => {
      const result = await escrow.nftAddress();
      expect(result).to.be.equal(realEstate.address);
    });

    it("returns seller", async () => {
      const result = await escrow.seller();
      expect(result).to.be.equal(seller.address);
    });

    it("returns inspector", async () => {
      const result = await escrow.inspector();
      expect(result).to.be.equal(inspector.address);
    });

    it("returns lender", async () => {
      const result = await escrow.lender();
      expect(result).to.be.equal(lender.address);
    });
  });

  describe("Listing", () => {
    it("Updates as listed", async () => {
      const result = await escrow.isListed(1);
      expect(result).to.be.equal(true);
    });

    it("Updates ownership", async () => {
      expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address);
    });

    it("Returns buyer", async () => {
      const result = await escrow.buyer(1);
      expect(result).to.be.equal(buyer.address);
    });

    it("Returns purchase price", async () => {
      const result = await escrow.purchasePrice(1);
      expect(result).to.be.equal(tokens(10));
    });

    it("Returns purchase price", async () => {
      const result = await escrow.escrowAmount(1);
      expect(result).to.be.equal(tokens(5));
    });

    it("Updates ownership", async () => {
      expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address);
    });
  });

  describe("Deposit", () => {
    it("Updates contract balance", async () => {
      const tx = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) });
      await tx.wait();
      const result = await escrow.getBalance();
      expect(result).to.be.equal(tokens(5));
    });
  });

  describe("Inspection", () => {
    it("Updates inspection status", async () => {
      const tx = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true);
      await tx.wait();
      const result = await escrow.inspectionPassed(1);
      expect(result).to.be.equal(true);
    });
  });

  describe("Approval", () => {
    it("Updates approvals status", async () => {
      let tx = await escrow.connect(buyer).approveSale(1);
      await tx.wait();

      tx = await escrow.connect(seller).approveSale(1);
      await tx.wait();

      tx = await escrow.connect(lender).approveSale(1);
      await tx.wait();

      expect(await escrow.approval(1, buyer.address)).to.be.equal(true);
      expect(await escrow.approval(1, seller.address)).to.be.equal(true);
      expect(await escrow.approval(1, lender.address)).to.be.equal(true);
    });
  });

  describe("Finalize Sale", async () => {
    beforeEach(async () => {
      let tx = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) });
      await tx.wait();

      tx = await escrow.connect(inspector).updateInspectionStatus(1, true);
      await tx.wait();

      tx = await escrow.connect(buyer).approveSale(1);
      await tx.wait();
      tx = await escrow.connect(seller).approveSale(1);
      await tx.wait();
      tx = await escrow.connect(lender).approveSale(1);
      await tx.wait();

      await lender.sendTransaction({ to: escrow.address, value: tokens(5) });

      tx = await escrow.connect(seller).finalizeSale(1);
      await tx.wait();
    });

    it("Updates balance", async () => {
      expect(await escrow.getBalance()).to.be.equal(0);
    });

    it("Updates ownership", async () => {
      expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address);
    });
  });
});
