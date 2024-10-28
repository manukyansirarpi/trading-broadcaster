import _ from "./_";
// /////////////////////////////////////////////////////////////////////////////
// PLEASE DO NOT MODIFY, RENAME OR REMOVE ANY OF THE CODE ABOVE.
// YOU CAN ADD YOUR OWN CODE TO THIS FILE OR MODIFY THE CODE BELOW TO CHANGE THE MESSAGES SENT FROM THE DATA PROVIDER.
// /////////////////////////////////////////////////////////////////////////////

import WebSocket from "ws";

const messagesConfig = {
  timeToWaitBeforeSendingFirstMessage: 1000,
  timeToWaitBeforeSendingNewMessage: 500,
  numberOfIterations: 1,
  messages: [
    {
      symbol: "a631dc6c-ee85-458d-80d7-50018aedfbad",
      price: 10.58,
      quantity: 500,
      timestampDifference: 0,
    },
    {
      symbol: "9e8bff74-50cd-4d80-900c-b5ce3bf371ee",
      price: 18.58,
      quantity: 1500,
      timestampDifference: 1,
    },
    {
      symbol: "a631dc6c-ee85-458d-80d7-50018aedfbad",
      price: 11.0,
      quantity: 1000,
      timestampDifference: -500,
    },
    {
      symbol: "a631dc6c-ee85-458d-80d7-50018aedfbad",
      price: 15.0,
      quantity: 500,
      timestampDifference: 2,
    },
    {
      symbol: "4",
      price: 9.0,
      quantity: 1000,
      timestampDifference: 3,
    },
  ],
};

(async () => {
  let dataProviderServer;
  try {
    const port = 9001;

    dataProviderServer = await configureDataProvider(port, messagesConfig);
  } catch (e) {
    dataProviderServer.close();
    console.log(e.message);
  }
})();

function configureDataProvider(port, messagesConfig) {
  const dataProviderServer = new WebSocket.Server({ port });

  dataProviderServer.on("error", console.error);

  dataProviderServer.on("connection", async function (client) {
    console.log("connected");

    client.on("error", console.error);

    client.on("message", async function (msg) {
      const data = JSON.parse(msg);
      console.log("message received: ", data);
    });

    client.on("close", function () {
      console.log("client disconnected");
    });

    if (messagesConfig) {
      delay(messagesConfig.timeToWaitBeforeSendingFirstMessage || 5000);

      await sendData(messagesConfig, dataProviderServer);
      console.log("finished sending data");
    }
  });

  return dataProviderServer;
}

async function sendData(messagesConfig, server) {
  const messagesToSend = messagesConfig.messages;
  let now = Date.now();
  for (
    let index = 0;
    index < messagesToSend.length * messagesConfig.numberOfIterations;
    index++
  ) {
    if (index % messagesToSend.length === 0) {
      now = Date.now();
    }

    const data = messagesToSend[index % messagesToSend.length];
    const dataToSend = {
      symbol: data.symbol,
      price: data.price,
      quantity: data.quantity,
      timestamp: now + data.timestampDifference,
    };

    dispatchMessageToAllClients(dataToSend, server);
    console.log("message sent: ", dataToSend, Date.now());

    await delay(messagesConfig.timeToWaitBeforeSendingNewMessage);
  }
}

function dispatchMessageToAllClients(message, server) {
  server.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
