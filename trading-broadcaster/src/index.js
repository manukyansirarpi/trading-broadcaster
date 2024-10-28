import WebSocket from "ws";
import axios from "axios";

const symbolAPIUrl = "http://localhost:3000/api/symbols";

const providersPerConsumer = new Map(); //Key: Consumer WebSocket, Value: Map of providers that holds the connected data providers (host) and the symbols they are subscribed to for that provider.

// [websocket: Map ---> host: [Array of symbols]]

const latestPrices = new Map();

createTradingBroadcastServer();

function createTradingBroadcastServer() {
  const tradingBroadcastServer = new WebSocket.Server({
    port: 9000,
  });

  tradingBroadcastServer.on("connection", (consumerWebSocket) => {
    consumerWebSocket.on("message", async (message) => {
      const parsedMessage = JSON.parse(message);
      console.log("Consumer message came: ", parsedMessage);
      try {
        switch (parsedMessage.action) {
          case "add-provider":
            await handleAddProviderForConsumer(
              consumerWebSocket,
              parsedMessage
            );
            break;
          case "clear-providers":
            handleClearProvidersForConsumer(consumerWebSocket);
            break;
          case "clear-prices":
            handleClearPricesForConsumer(consumerWebSocket);
            break;
          default:
            consumerWebSocket.send(
              JSON.stringify({
                status: "not processed",
                message: "Unknown action",
              })
            );
        }
      } catch (error) {
        console.error("Error processing message: ", error);
        consumerWebSocket.send(
          JSON.stringify({ status: "not processed", message: error.message })
        );
      }
    });

    consumerWebSocket.on("close", () => {
      console.log("Consumer disconnected");
      handleClearProvidersForConsumer(consumerWebSocket);
    });
  });

  return tradingBroadcastServer;
}

async function handleAddProviderForConsumer(consumerWebSocket, message) {
  const { host, symbols } = message;

  if (!host || !Array.isArray(symbols)) {
    return consumerWebSocket.send(
      JSON.stringify({
        status: "not processed",
        message: "Invalid host or symbols",
      })
    );
  }

  try {
    const validSymbols = await getValidSymbols(symbols);
    console.log("validSymbols: ", validSymbols);
    if (validSymbols.length === 0) {
      return ws.send(
        JSON.stringify({
          status: "not processed",
          message: "No valid symbols found",
        })
      );
    }

    if (!providersPerConsumer.has(consumerWebSocket)) {
      providersPerConsumer.set(consumerWebSocket, new Map());
    }

    const consumerProviders = providersPerConsumer.get(consumerWebSocket);

    if (!consumerProviders.has(host)) {
      const providerWebSocket = new WebSocket(host);
      consumerProviders.set(host, {
        providerWebSocket,
        symbols: new Set(),
      });

      providerWebSocket.on("message", (data) =>
        handleProviderMessage(consumerWebSocket, host, data)
      );
      providerWebSocket.on("close", () => consumerProviders.delete(host));
      providerWebSocket.on("error", (err) =>
        console.error(`Error from provider ${host}: `, err)
      );
    }

    const providerInfo = consumerProviders.get(host);
    validSymbols.forEach((symbol) => providerInfo.symbols.add(symbol));

    consumerWebSocket.send(
      JSON.stringify({ status: "processed", message: `Connected to ${host}` })
    );
  } catch (error) {
    consumerWebSocket.send(
      JSON.stringify({
        status: "not processed",
        message: `Error connecting to ${host}`,
      })
    );
  }
}

function handleClearProvidersForConsumer(consumerWebSocket) {
  const consumerProviders = providersPerConsumer.get(consumerWebSocket);

  if (consumerProviders) {
    consumerProviders.forEach((provider) => {
      provider.providerWebSocket.close();
    });
    consumerProviders.delete(consumerWebSocket);
    consumerWebSocket.send(JSON.stringify({ status: "processed" }));
  } else {
    consumerWebSocket.send(JSON.stringify({ status: "processed" }));
  }
}

function handleClearPricesForConsumer(consumerWebSocket) {
  latestPrices.delete(consumerWebSocket);
  consumerWebSocket.send(JSON.stringify({ status: "processed" }));
}

async function getValidSymbols(symbols) {
  try {
    const response = await axios.get(symbolAPIUrl);
    const validSymbols = response.data.map((symbolData) => symbolData.id);
    return symbols.filter((symbol) => validSymbols.includes(symbol));
  } catch (error) {
    console.error("Error fetching symbols from Symbol API: ", error);
    return [];
  }
}

function handleProviderMessage(consumerWebSocket, host, data) {
  try {
    const trade = JSON.parse(data);
    console.log("data came from data provider : ", trade);

    const consumerProviders = providersPerConsumer.get(consumerWebSocket);
    const providerInfo = consumerProviders.get(host);

    if (!providerInfo || !providerInfo.symbols.has(trade.symbol)) {
      return; // Ignore trades for symbols not subscribed by the consumer
    }

    const consumerPrices = latestPrices.get(consumerWebSocket) || new Map();
    console.log("consumerPrices: ", consumerPrices);
    const lastTrade = consumerPrices.get(trade.symbol);

    // Only send the trade if it is the latest
    if (!lastTrade || trade.timestamp > lastTrade.timestamp) {
      consumerPrices.set(trade.symbol, trade);
      latestPrices.set(consumerWebSocket, consumerPrices);
      consumerWebSocket.send(JSON.stringify(trade));
    }
  } catch (error) {
    console.error("not processed", error);
  }
}
