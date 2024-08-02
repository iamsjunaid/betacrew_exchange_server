const net = require("net");
const fs = require("fs");

const port = 3000;
const host = "localhost"; // Adjust if server is on a different host

const receivedPackets = {};
let missingSequences = [];

const client = new net.Socket();

client.connect(port, host, () => {
  console.log("Connected to server");
  const buffer = Buffer.alloc(2);
  buffer.writeUInt8(1, 0); // Call type 1: Stream All Packets
  buffer.writeUInt8(0, 1);
  client.write(buffer);
});

client.on("data", (data) => {
  console.log("Data received from server:", data);
  processReceivedData(data);
  // In case the second 'data' event is not triggered:
  if (missingSequences.length === 0) {
    client.end();
  }
});

client.on("close", () => {
  console.log("Connection closed");
  identifyMissingSequences();
  console.log("Missing sequences:", missingSequences);
  requestMissingPackets();
});

function processReceivedData(data) {
  console.log("Processing received data...");
  for (let i = 0; i < data.length; i += 17) {
    const symbol = data.slice(i, i + 4).toString("ascii");
    const buySell = data.slice(i + 4, i + 5).toString("ascii");
    const quantity = data.readInt32BE(i + 5);
    const price = data.readInt32BE(i + 9);
    const sequence = data.readInt32BE(i + 13);

    receivedPackets[sequence] = { symbol, buySell, quantity, price, sequence };
    console.log(
      `Packet received: ${JSON.stringify(receivedPackets[sequence])}`
    );
  }
}

function identifyMissingSequences() {
  console.log("Identifying missing sequences...");
  const sequences = Object.keys(receivedPackets)
    .map((seq) => parseInt(seq))
    .sort((a, b) => a - b);
  for (let i = 0; i < sequences.length - 1; i++) {
    for (let j = sequences[i] + 1; j < sequences[i + 1]; j++) {
      missingSequences.push(j);
    }
  }
}

function requestMissingPackets() {
  if (missingSequences.length > 0) {
    requestNextMissingPacket();
  } else {
    generateJSONOutput();
  }
}

function requestNextMissingPacket() {
  if (missingSequences.length > 0) {
    const sequence = missingSequences.shift();
    console.log(`Requesting missing packet with sequence: ${sequence}`);
    const buffer = Buffer.alloc(2);
    buffer.writeUInt8(2, 0); // Call type 2: Resend Packet
    buffer.writeUInt8(sequence, 1);
    client.write(buffer);
  } else {
    generateJSONOutput();
  }
}

client.on("data", (data) => {
  processReceivedData(data);
  if (missingSequences.length > 0) {
    requestNextMissingPacket();
  } else {
    generateJSONOutput();
  }
});

function generateJSONOutput() {
  console.log("Generating JSON output...");
  const output = Object.values(receivedPackets);
  fs.writeFileSync("output.json", JSON.stringify(output, null, 2));
  console.log("Output JSON generated");
  client.destroy();
}
