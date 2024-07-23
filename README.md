# ⛓️ LayerN + 1 || Event&Oracle rollup ⛓️
1. Event-based state changes
2. Off-chain processing and on-chain verification
3. Ensuring reliability using Chainlink Functions
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
    function commit(bytes32 stateHash, address sender) external returns(bool);
    function proof(bool isValid, address sender) external returns(bool);
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
   function proof(bool isValid, address sender) external override returns(bool) {
       require(msg.sender == rollupAddress, "Only rollup can call proof");
       isStateValid = isValid;
       return true;
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
