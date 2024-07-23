# LayerN + 1, Event&Oracle rollup
## システム概要
このシステムは、ブロックチェーンのスケーラビリティを向上させるための新しいアプローチです。主な特徴は以下の通りです：
1. イベントベースの状態変更
2. オフチェーン処理とオンチェーン検証
3. Chainlink Functionsを利用した信頼性の確保
4. 効率的な検証（proof）メカニズム

## 主要コンポーネント
### 1. IClientインターフェース
このインターフェースは、システムと統合するコントラクトの標準を定義します。
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

### 2. LogRollupコントラクト
このコントラクトは、Chainlink Functionsとの統合を担当し、オフチェーン処理の結果を検証します。
```solidity
contract LogRollup is FunctionsClient, ConfirmedOwner {
    // ... (省略)
    function exec(
        bytes memory encryptedSecretsUrls,
        address _client,
        bytes memory params
    ) external returns(bytes32) {
        // ... (実装詳細)
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

### 3. クライアントコントラクト（例：LErc721）
IClientを実装し、特定のユースケース（この場合はNFT）に対応するコントラクトです。
```solidity
contract LErc721 is ERC721URIStorage, Ownable, IClient {
    // ... (省略)
    function requestMint(address to, string memory tokenURI) public {
        emit MintRequested(to, tokenURI);
    }
    function applyVerifiedState(MintRequest[] memory verifiedRequests) external onlyRollupOperator {
        // ... (実装詳細)
    }
    function proof(bool isValid, address sender) external override returns(bool) {
        require(msg.sender == rollupAddress, "Only rollup can call proof");
        isStateValid = isValid;
        return true;
    }
}
```

## 実装フロー
1. **イベント発行**: クライアントコントラクトで状態変更を表すイベントを発行します。
   例：`emit MintRequested(to, tokenURI);`
2. **オフチェーン処理**: 発行されたイベントを収集し、処理します。結果のハッシュを計算します。
3. **ステートハッシュのコミット**: 計算されたハッシュを`commit`関数を通じてオンチェーンに記録します。
   ```solidity
   function commit(bytes32 _stateHash, address sender) external override returns(bool) {
       require(msg.sender == owner(), 'only owner');
       currentStateHash = _stateHash;
       isStateValid = false;
       return true;
   }
   ```
4. **Chainlink Functions実行**: `LogRollup`コントラクトの`exec`関数を呼び出し、Chainlink Functionsを使用してオフチェーン処理の結果を検証します。
5. **検証（Proof）**: Chainlink Functionsの結果を受け取り、`proof`関数を通じて検証結果を記録します。
   ```solidity
   function proof(bool isValid, address sender) external override returns(bool) {
       require(msg.sender == rollupAddress, "Only rollup can call proof");
       isStateValid = isValid;
       return true;
   }
   ```
6. **結果の適用**: 検証が成功したら、`applyVerifiedState`関数を通じて状態変更を適用します。
   ```solidity
   function applyVerifiedState(MintRequest[] memory verifiedRequests) external onlyRollupOperator {
       require(isStateValid, "State not verified");
       bytes32 calculatedStateHash = keccak256(abi.encode(verifiedRequests));
       require(calculatedStateHash == currentStateHash, "Data mismatch");
       // ... (状態変更の適用)
   }
   ```

