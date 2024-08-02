const net = require("net");
const fs = require("fs");

const port = 3000;
const host = "localhost"; // Adjust if server is on a different host

const receivedPackets = {};
let missingSequences = [];
let dataBuffer = Buffer.alloc(0);

const client = new net.Socket();

client.connect(port, host, () => {
  console.log("Connected to server");
  const buffer = Buffer.alloc(2);
  buffer.writeUInt8(1, 0); // Call type 1: Stream All Packets
  buffer.writeUInt8(0, 1);
  client.write(buffer);
});

client.on("data", (data) => {
  dataBuffer = Buffer.concat([dataBuffer, data]);

  // Process data packets
  while (dataBuffer.length >= 17) {
    const packet = dataBuffer.slice(0, 17);
    processReceivedData(packet);
    dataBuffer = dataBuffer.slice(17);
  }
});

client.on("end", () => {
  console.log("Connection closed");
  identifyMissingSequences();
  if (missingSequences.length > 0) {
    requestMissingPackets();
  } else {
    generateJSONOutput();
  }
});

client.on("error", (err) => {
  console.error("Error:", err);
});

function processReceivedData(data) {
  const symbol = data.slice(0, 4).toString("ascii").trim();
  const buySell = data.slice(4, 5).toString("ascii").trim();
  const quantity = data.readInt32BE(5);
  const price = data.readInt32BE(9);
  const sequence = data.readInt32BE(13);

  receivedPackets[sequence] = { symbol, buySell, quantity, price, sequence };
  console.log(`Packet received: ${JSON.stringify(receivedPackets[sequence])}`);
}

function identifyMissingSequences() {
  const sequences = Object.keys(receivedPackets)
    .map(Number)
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

    // Create a new socket for requesting missing packets
    const requestClient = new net.Socket();

    requestClient.connect(port, host, () => {
      requestClient.write(buffer);
    });

    requestClient.on("data", (data) => {
      processReceivedData(data);
      requestClient.end(); // Close the request socket after receiving data
    });

    requestClient.on("end", () => {
      if (missingSequences.length > 0) {
        requestNextMissingPacket();
      } else {
        generateJSONOutput();
      }
    });

    requestClient.on("error", (err) => {
      console.error("Error in request client:", err);
    });
  } else {
    generateJSONOutput();
  }
}

function generateJSONOutput() {
  console.log("Generating JSON output...");
  const output = Object.values(receivedPackets);
  fs.writeFileSync("output.json", JSON.stringify(output, null, 2));
  console.log("Output JSON generated");
}
