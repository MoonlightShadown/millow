//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IERC721 {
    function transferFrom(address _from, address _to, uint256 _id) external;
}

contract Escrow {
    address public nftAddress;
    address payable public seller;
    address public inspector;
    address public lender;

    modifier onlyBuyer(uint256 _nftID) {
        require(msg.sender == buyer[_nftID], "Only buyer can call this method");
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller, "Only seller can call this method");
        _;
    }

    modifier onlyInspector() {
        require(msg.sender == inspector, "Only inspector can call this method");
        _;
    }

    mapping(uint256 => bool) public isListed; // nftId => isListed
    mapping(uint256 => uint256) public purchasePrice; // nftId => price
    mapping(uint256 => uint256) public escrowAmount; // nftId => escrowAmount
    mapping(uint256 => address) public buyer; // nftId => buyer's address
    mapping(uint256 => bool) public inspectionPassed; // nftId => inspection status
    mapping(uint256 => mapping(address => bool)) public approval; // nftId => approvers => status

    constructor(address _nftAddress, address payable _seller, address _inspector, address _lender) {
        nftAddress = _nftAddress;
        seller = _seller;
        inspector = _inspector;
        lender = _lender;
    }

    function list(uint256 _nftId, address _buyer, uint256 _purchasePrice, uint256 _escrowAmount) public {
        IERC721(nftAddress).transferFrom(msg.sender, address(this), _nftId);
        isListed[_nftId] = true;
        purchasePrice[_nftId] = _purchasePrice;
        escrowAmount[_nftId] = _escrowAmount;
        buyer[_nftId] = _buyer;
    }

    // put under contract (only buyer - payable escrow)
    function depositEarnest(uint256 _nftID) public payable onlyBuyer(_nftID) {
        require(msg.value >= escrowAmount[_nftID]);
    }

    // update inspection status (only inspector)
    function updateInspectionStatus(uint256 _nftID, bool _passed) public onlyInspector {
        inspectionPassed[_nftID] = _passed;
    }

    function approveSale(uint256 _nftID) public {
        approval[_nftID][msg.sender] = true;
    }

    // finalize sale
    // => require inspection status (add more items here, like appraisal)
    // => require sale to authorized
    // => require funds to obe the correct amount
    // => transfer NFT to Buyer
    // => transfer Funds to Seller
    function finalizeSale(uint256 _nftID) public {
        require(inspectionPassed[_nftID]);
        require(approval[_nftID][buyer[_nftID]]);
        require(approval[_nftID][seller]);
        require(approval[_nftID][lender]);
        require(address(this).balance >= purchasePrice[_nftID]);
        // changes NFT's status
        isListed[_nftID] = false;
        // transfer amount to the seller
        (bool success, ) = payable(seller).call{value: address(this).balance}("");
        require(success);
        // transfer the NFT's ownership
        IERC721(nftAddress).transferFrom(address(this), buyer[_nftID], _nftID);
    }

    // cancle sale (handle earnest deposit)
    // -> if inspection status is not approved, then refund, otherwise send to seller
    function cancleSale(uint256 _nftID) public {}

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
