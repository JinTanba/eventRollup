// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IClient {
    struct FunctionArgs {
        bytes[] bytesArgs;
        uint256 fromBlockNumber;
        string eventSig;
    }
    function commit(bytes32 stateHash,address sender) external returns(bool);
    function proof(bool isValid, address sender) external returns(bool);
    function getArgs(bytes memory encodedParams) external returns(FunctionArgs memory);
    function getOriginalRollupCode() external returns(string memory);
    function stateHash() external returns(bytes32);
}


contract EventErc721 is ERC721URIStorage, Ownable, IClient {
    using Strings for uint256;
    bytes32 internal currentStateHash;
    uint256 public lastProcessedBlock;
    address public rollupOperator;
    bool public isStateValid;
    uint256 public nextTokenId;

    struct MintRequest {
        address to;
        string tokenURI;
    }

    event MintRequested(address indexed to, string tokenURI);
    event TokenMinted(address indexed to, uint256 indexed tokenId, string uri);

    constructor(string memory name, string memory symbol, address rollup) ERC721(name, symbol) Ownable(msg.sender) {
        rollupOperator = rollup;
        lastProcessedBlock = block.number;
        nextTokenId = 1; // Start token IDs from 1
    }

    modifier onlyRollupOperator() {
        require(msg.sender == rollupOperator, "Caller is not the rollup operator");
        _;
    }

    function setRollupOperator(address newOperator) external onlyOwner {
        rollupOperator = newOperator;
    }

    function requestMint(address to, string memory tokenURI) public {
        // require(whiteList[to], "PermissionError");
        emit MintRequested(to, tokenURI);
    }

    //offchain
    //
    function commit(bytes32 _stateHash, address sender) external override returns(bool) {
        require(msg.sender == owner(), 'only owner');
        currentStateHash = _stateHash;
        isStateValid = false;
        return true;
    }

    function proof(bool isValid, address sender) external override returns(bool) {
        isStateValid = isValid;
        return sender == address(0);
    }

    function applyVerifiedState(MintRequest[] memory verifiedRequests) external onlyRollupOperator {
            require(isStateValid, "State not verified");

            bytes32 calculatedStateHash = keccak256(abi.encode(verifiedRequests));
            require(calculatedStateHash == currentStateHash, "Provided data does not match the committed state hash");

            uint256 batchSize = verifiedRequests.length;
            uint256 startTokenId = nextTokenId;

            _batchMint(verifiedRequests, startTokenId);

            nextTokenId += batchSize;
            isStateValid = false;
    }

    function _batchMint(MintRequest[] memory requests, uint256 startTokenId) internal {
        uint256 len = requests.length;
        for (uint256 i = 0; i < len; i++) {
            uint256 tokenId = startTokenId + i;
            address to = requests[i].to;
            string memory uri = requests[i].tokenURI;

            _safeMint(to, tokenId);
            
            _setTokenURI(tokenId, uri);

            emit TokenMinted(to, tokenId, uri);
        }
    }

    function getArgs(bytes memory encodedParams) external view override returns(FunctionArgs memory) {
        bytes[] memory ba = new bytes[](0);
        return FunctionArgs({
            bytesArgs: ba,
            fromBlockNumber: lastProcessedBlock,
            eventSig: "event MintRequested(address indexed to, string tokenURI)"
        });
    }


    function getOriginalRollupCode() external pure override returns(string memory) {
        // Return the JavaScript code for log processing if needed
        return "";
    }

    function stateHash() external view override returns(bytes32) {
        return currentStateHash;
    }
}