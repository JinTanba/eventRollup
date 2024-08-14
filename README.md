# Ethereum New layer?

In EVM, emitted logs are stored as part of the transaction receipt in the receipt tree (Patricia Merkle Trie). The root hash of this receipt tree is included in the block header, thereby perpetuating the logs as immutable data on the blockchain.

Since log operations are overwhelmingly cheaper compared to storage operations, we might consider the following approach:
`Output logs on-chain, analyze these logs off-chain to generate state, and return it on-chain. Generate state by rolling up logs.`

This allows for the construction of Dapps that can execute each transaction cheaply and quickly. For example, if migrating an existing game on-chain requires storage operations for all actions, it might be economically unfeasible. However, using this idea could potentially make it viable.

However, until recently, this was one of those ideas whose feasibility was considered out of the question for obvious reasons. That is, it is impossible to agree on the results of an off-chain analysis, there was no basis for being sure that the one doing the analysis would commit all the logs to the on-chain without forgetting something.

I was sincerely hoping that there was some way to move the process of parsing the logs on-chain, or that there was a way to expose that process, and lo and behold, I found a great method.

### 😭Chainlink had that!!!!
###### I've always thought that chainlink was great, but I guess it's true.😘
