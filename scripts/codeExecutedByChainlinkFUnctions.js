const ethers = await import("npm:ethers@6.10.0");

class FunctionsJsonRpcProvider extends ethers.JsonRpcProvider {
  constructor(url) {
    super(url);
    this.url = url;
  }
  async _send(payload) {
    try {
      let resp = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return resp.json();
    } catch (error) {
      console.error('Error at _send:', error);
      return Functions.encodeString("2");
    }
  }
}

const fromBlockNumber = args[0];
const eventSig = args[1];
const l3 = args[2];
const rpcUrl = 'https://base-sepolia.g.alchemy.com/v2/k3Dvibh6qSOCk1KkssKyZub9r6AuK1qy';

try {
  const { logs, typeInfo, length } = await getLogs();
  console.log("Logs: ", logs);
  console.log("Type Info: ", typeInfo);

  const encodedData = new ethers.AbiCoder().encode([`tuple(${typeInfo.join(',')})[]`], [logs]);
  console.log("encodedData: ", encodedData);
  const hash = ethers.keccak256(encodedData);
  console.log("hash: ", hash);

  const l3contract = new ethers.Contract(l3, ["function stateHash() view external returns(bytes32)"], new FunctionsJsonRpcProvider(rpcUrl));

  const stateHash = await l3contract.stateHash();
  console.log("hash created here: ", hash);
  console.log("stateHash: ", stateHash);
  const valid = hash === stateHash;
  const encodedBool = new ethers.AbiCoder().encode(['bool'], [valid]);
  return ethers.getBytes(encodedBool);

} catch (error) {
  handleErrors(error, { logs, length });
}

async function getLogs() {
  const API_KEY = secrets.BASE_SCAN_API_KEY ? secrets.BASE_SCAN_API_KEY : "";
  const CONTRACT_ADDRESS = l3;
  const START_BLOCK = fromBlockNumber;
  const END_BLOCK = 'latest';
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
      const length = response.data.result.length;
      console.log("Length: ", length);
      const eventArgs = response.data.result.map(log => iface.parseLog({ topics: log.topics, data: log.data }).args);
      const typeInfo = paramList.map(param => param.type);
      return { logs: eventArgs, typeInfo, length };
    } else {
      throw new Error(`Error making request: ${response.data.message}`);
    }
  } catch (error) {
    console.error('Error in getLogs:', error);
    return Functions.encodeString("5");
  }
}

function handleErrors(error, context) {
  if (context.logs && context.length) {
    console.error('Error at step 3:', error);
    return Functions.encodeString(`3: ${JSON.stringify(context.logs)} ${context.length}`);
  } else if (context.logs) {
    console.error('Error at step 4:', error);
    return Functions.encodeString(`4: ${error}`);
  } else {
    console.error('Error at step 1:', error);
    return Functions.encodeString(`1: ${error}`);
  }
}
