const ethers = await import("npm:ethers@6.10.0");
let fromBlockNumber, eventSig, l3, toBlockNumber;
try {
  fromBlockNumber = args[0];
  eventSig = args[1];
  l3 = args[2];
  toBlockNumber = args[3];
} catch (error) {
  console.error('Error in _ln1:', error);
  return Functions.encodeString(`1. ${error}`);
}

const rpcUrl = 'https://base-sepolia.g.alchemy.com/v2/k3Dvibh6qSOCk1KkssKyZub9r6AuK1qy';

try {
  const { logs, typeInfo } = await getLogs();
  console.log("Logs: ", logs);
  console.log("Type Info: ", typeInfo);
  console.log("Latest Log Block Number: ", toBlockNumber);
  const abiEncoder = ethers.AbiCoder.defaultAbiCoder()
  const encodedData = abiEncoder.encode([`tuple(${typeInfo.join(',')})[]`], [logs]);
  console.log("encodedData: ", encodedData);
  const hash = ethers.keccak256(encodedData);
  const encodedResult = abiEncoder.encode(["bytes32"], [hash]);
  return ethers.getBytes(encodedResult);
} catch (error) {
  console.error('Error in _ln1:', error);
  return Functions.encodeString(`2. ${error}`);
}

async function getLogs() {
  const API_KEY = secrets.BASE_SCAN_API_KEY ? secrets.BASE_SCAN_API_KEY : "";
  const CONTRACT_ADDRESS = l3;
  const START_BLOCK = fromBlockNumber;
  const END_BLOCK = toBlockNumber;
  const BASE_URL = 'https://api-sepolia.basescan.org/api';

  try {
    const eventDeclaration = eventSig.match(/event\s+(\w+)\s*\((.*?)\)/);
    if (!eventDeclaration) {
      throw new Error("Invalid event declaration");
    }
    const [, eventName, params] = eventDeclaration;

    const paramList = params.split(',').map(param => {
      const [type, name] = param.trim().split(' ');
      return { type: type.replace('indexed', '').trim(), name: name || '', indexed: param.includes('indexed') };
    });

    const eventSignature = `${eventName}(${paramList.map(p => p.type).join(',')})`;
    console.log("Event Signature:", eventSignature);

    const TOPIC = ethers.id(eventSignature);
    console.log("TOPIC:", TOPIC);

    const response = await Functions.makeHttpRequest({
      url: BASE_URL,
      method: 'GET',
      params: {
        module: 'logs',
        action: 'getLogs',
        fromBlock: START_BLOCK,
        toBlock: END_BLOCK,
        address: CONTRACT_ADDRESS,
        topic0: TOPIC,
        apikey: API_KEY
      },
      responseType: 'json'
    });

    if (response.status === 200 && response.data.status === '1') {
      const iface = new ethers.Interface([eventSig]);
      const eventArgs = response.data.result.map(log => iface.parseLog({ topics: log.topics, data: log.data }).args);
      const typeInfo = paramList.map(param => param.type);
      // Get the latest block number from the logs
      return { logs: eventArgs, typeInfo };
    } else {
      throw new Error(`Error making request: ${response.data.message}`);
    }
  } catch (error) {
    console.error('Error in getLogs:', error);
    return Functions.encodeString("5");
  }
}
