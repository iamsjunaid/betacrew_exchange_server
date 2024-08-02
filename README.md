
# BetaCrew Exchange Client

This project is a Node.js client application designed to interact with the BetaCrew mock exchange server. The client requests and receives stock ticker data from the server, ensures no data packets are missing, and generates a JSON file containing all received data.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Code Explanation](#code-explanation)
- [License](#license)

## Requirements

- Node.js v16.17.0 or higher

## Installation

1. Clone the repository:

    ```sh
    git clone https://github.com/iamsjunaid/betacrew_exchange_server
    cd betacrew_exchange_client
    ```

2. Install dependencies:

    ```sh
    npm install
    ```

## Usage

1. Start the BetaCrew exchange server:

    ```sh
    cd betacrew_exchange_server
    node main.js
    ```

2. Start the client:

    ```sh
    cd betacrew_client
    node client.js
    ```

3. Check the generated `output.json` file in the `betacrew_client` directory.

## Project Structure

```plaintext
betacrew_exchange_client/
├── betacrew_exchange_server/  # Contains server files
├── betacrew_client/           # Contains client files
│   ├── client.js              # Main client application
│   ├── package.json           # Project dependencies and scripts
│   ├── package-lock.json      # Detailed tree of dependencies
│   ├── README.md              # Project documentation
│   └── output.json            # Generated output (after running client.js)
```

## Code Explanation

### client.js

- **Module Imports**

    ```javascript
    const net = require('net');
    const fs = require('fs');
    ```

- **Initial Setup**

    Define server address, port, and initialize data structures:

    ```javascript
    const port = 3000;
    const host = 'localhost';

    const receivedPackets = {};
    let missingSequences = [];

    const client = new net.Socket();
    ```

- **Connecting to the Server**

    Connect to the server and request all packets:

    ```javascript
    client.connect(port, host, () => {
      console.log('Connected to server');
      const buffer = Buffer.alloc(2);
      buffer.writeUInt8(1, 0); // Call type 1: Stream All Packets
      buffer.writeUInt8(0, 1);
      client.write(buffer);
    });
    ```

- **Handling Incoming Data**

    Process and log received data:

    ```javascript
    client.on('data', (data) => {
      console.log('Data received from server:', data);
      processReceivedData(data);
      if (missingSequences.length === 0) {
        client.end();
      }
    });
    ```

- **Processing Received Data**

    Extract and store packet details:

    ```javascript
    function processReceivedData(data) {
      console.log('Processing received data...');
      for (let i = 0; i < data.length; i += 17) {
        const symbol = data.slice(i, i + 4).toString('ascii');
        const buySell = data.slice(i + 4, i + 5).toString('ascii');
        const quantity = data.readInt32BE(i + 5);
        const price = data.readInt32BE(i + 9);
        const sequence = data.readInt32BE(i + 13);

        receivedPackets[sequence] = { symbol, buySell, quantity, price, sequence };
        console.log(`Packet received: ${JSON.stringify(receivedPackets[sequence])}`);
      }
    }
    ```

- **Handling Connection Closure**

    Identify missing sequences and request them:

    ```javascript
    client.on('close', () => {
      console.log('Connection closed');
      identifyMissingSequences();
      console.log('Missing sequences:', missingSequences);
      requestMissingPackets();
    });
    ```

- **Identifying Missing Sequences**

    Find gaps in received packet sequences:

    ```javascript
    function identifyMissingSequences() {
      console.log('Identifying missing sequences...');
      const sequences = Object.keys(receivedPackets).map(seq => parseInt(seq)).sort((a, b) => a - b);
      for (let i = 0; i < sequences.length - 1; i++) {
        for (let j = sequences[i] + 1; j < sequences[i + 1]; j++) {
          missingSequences.push(j);
        }
      }
    }
    ```

- **Requesting Missing Packets**

    Request and process any missing packets:

    ```javascript
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
    ```

- **Generating JSON Output**

    Write the received data to `output.json`:

    ```javascript
    function generateJSONOutput() {
      console.log('Generating JSON output...');
      const output = Object.values(receivedPackets);
      fs.writeFileSync('output.json', JSON.stringify(output, null, 2));
      console.log('Output JSON generated');
      client.destroy();
    }
    ```
