// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./rollup.sol";


contract EventDrivenErc721 is ERC721URIStorage, Ownable, IClient {
    using Strings for uint256;
    bytes32 public currentStateHash;
    uint256 public lastProcessedBlock;
    address public rollupOperator;
    bool public isStateValid;
    uint256 public nextTokenId;
    bytes32 public lastRequestId;

    struct MintRequest {
        address to;
        string tokenURI;
    }

    event MintRequested(address indexed to, string tokenURI);
    event TokenMinted(address indexed to, uint256 indexed tokenId, string uri);

    constructor(string memory name, string memory symbol, address _rollup) ERC721(name, symbol) Ownable(msg.sender) {
        rollupOperator = _rollup;
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

    function proofCallback(bytes32 stateHash, bytes32 requestId) external returns(bool) {
        require(msg.sender == rollupOperator, "wrong sender");
        require(lastRequestId == requestId, "wrong request");
        currentStateHash = stateHash;
        delete lastRequestId;
        return true;
    }

    function rollup(bytes memory encryptedSecretsUrls, uint256 sendAmount) external {
        uint256 _currentBlockNumber = block.number;
        bytes32 requestId = LogRollup(rollupOperator).exec(
            encryptedSecretsUrls,
            getArgs(_currentBlockNumber),
            sendAmount,
            address(this),
            msg.sender
        );
        // _minign();
        lastRequestId = requestId;
        lastProcessedBlock = block.number;
    }

    function applyVerifiedState(MintRequest[] memory verifiedRequests) external {
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

    function getArgs(uint256 currentBlockNumber) public view returns(Schema.FunctionArgs memory) {
        bytes[] memory ba = new bytes[](0);
        return Schema.FunctionArgs({
            bytesArgs: ba,
            fromBlockNumber: lastProcessedBlock,
            toBlockNumber:currentBlockNumber,
            eventSig: "event MintRequested(address indexed to, string tokenURI)"
        });
    }

}
