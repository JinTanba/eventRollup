# Ethereum New layer?

In EVM, emitted logs are stored as part of the transaction receipt in the receipt tree (Patricia Merkle Trie). The root hash of this receipt tree is included in the block header, thereby perpetuating the logs as immutable data on the blockchain.

Since log operations are overwhelmingly cheaper compared to storage operations, we might consider the following approach:
`Output logs on-chain, analyze these logs off-chain to generate state, and return it on-chain. Generate state by rolling up logs.`

This allows for the construction of Dapps that can execute each transaction cheaply and quickly. For example, if migrating an existing game on-chain requires storage operations for all actions, it might be economically unfeasible. However, using this idea could potentially make it viable.

However, until recently, this was one of those ideas whose feasibility was considered out of the question for obvious reasons. That is, it is impossible to agree on the results of an off-chain analysis, there was no basis for being sure that the one doing the analysis would commit all the logs to the on-chain without forgetting something.

I was sincerely hoping that there was some way to move the process of parsing the logs on-chain, or that there was a way to expose that process, and lo and behold, I found a great method.

### 😭Chainlink had that!!!!
###### I've always thought that chainlink was great, but I guess it's true.😘
#  Eventrollup 
1. Event-based state changes
2. Off-chain processing and on-chain verification
3. Ensuring reliability using Chainlink
4. Efficient verification (proof) mechanism

## Key Components
### 1. IClient Interface
This interface defines the standard for contracts integrating with the system. By adhering to this, developers can easily incorporate this mechanism into their own projects.
```solidity
interface IClient {
    struct FunctionArgs {
        bytes[] bytesArgs;
        uint256 fromBlockNumber;
        string eventSig;
    }
    function commit(bytes32 stateHash,address sender) external returns(bool);
    function proof(bool isValid, address sender, uint256 toBlocknumber) external returns(bool);
    function getArgs(bytes memory encodedParams) external returns(FunctionArgs memory);
    function getOriginalRollupCode() external returns(string memory);
    function stateHash() external returns(bytes32);
}
```

### 2. LogRollup Contract
This contract is responsible for integration with Chainlink Functions and verifies the results of off-chain processing.
```solidity
contract LogRollup is FunctionsClient, ConfirmedOwner {
    // ... (omitted)
    function exec(
        bytes memory encryptedSecretsUrls,
        address _client,
        bytes memory params
    ) external returns(bytes32) {
        // ... (implementation details)
    }
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        Schema.Promise memory _promise = Storage._stack(requestId);
        (bool isValid) = abi.decode(response, (bool));
        IClient(_promise.clientAddress).proof(isValid, _promise.miner);
        emit Response(requestId, response, err);
    }
}
```

### 3. Client Contract (Example: LErc721)
This contract implements IClient and corresponds to a specific use case (in this case, NFT).
```solidity
contract LErc721 is ERC721URIStorage, Ownable, IClient {
    // ... (omitted)
    function requestMint(address to, string memory tokenURI) public {
        emit MintRequested(to, tokenURI);
    }
    function applyVerifiedState(MintRequest[] memory verifiedRequests) external onlyRollupOperator {
        // ... (implementation details)
    }
    function proof(bool isValid, address sender) external override returns(bool) {
        require(msg.sender == rollupAddress, "Only rollup can call proof");
        isStateValid = isValid;
        return true;
    }
}
```

## Implementation Flow
1. **Event Emission**: The client contract emits an event representing a state change.
   Example: `emit MintRequested(to, tokenURI);`
2. **Off-chain Processing**: Collect and process the emitted events. Calculate the hash of the results.
3. **State Hash Commitment**: Record the calculated hash on-chain through the `commit` function.
   ```solidity
   function commit(bytes32 _stateHash, address sender) external override returns(bool) {
       require(msg.sender == owner(), 'only owner');
       currentStateHash = _stateHash;
       isStateValid = false;
       return true;
   }
   ```
4. **Chainlink Functions Execution**: Call the `exec` function of the `LogRollup` contract, using Chainlink Functions to verify the results of off-chain processing.
5. **Verification (Proof)**: Receive the results from Chainlink Functions and record the verification results through the `proof` function.
   ```solidity
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        Schema.Promise memory _promise = Storage._stack(requestId);
        (uint256 isValidAsBlockNumber) = abi.decode(response, (uint256));
        bool isValid = isValidAsBlockNumber > 0 ? true : false;
        IClient(_promise.clientAddress).proof(isValid, _promise.miner, isValidAsBlockNumber);
        emit Response(requestId, response, err);
    }
   ```
6. **Result Application**: If verification is successful, apply the state changes through the `applyVerifiedState` function.
   ```solidity
   function applyVerifiedState(MintRequest[] memory verifiedRequests) external onlyRollupOperator {
       require(isStateValid, "State not verified");
       bytes32 calculatedStateHash = keccak256(abi.encode(verifiedRequests));
       require(calculatedStateHash == currentStateHash, "Data mismatch");
       // ... (apply state changes)
   }
   ```
