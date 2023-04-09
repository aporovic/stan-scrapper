const CosmosClient = require("@azure/cosmos").CosmosClient;
const dbConfig = require("./dbConfig");

const { endpoint, key, databaseId, containerId } = dbConfig;

const options = {
  endpoint: endpoint,
  key: key,
  userAgentSuffix: "stanScrapper",
};

const client = new CosmosClient(options);

async function writeItem(item) {
  const { dbItem } = await client
    .database(databaseId)
    .container(containerId)
    .items.upsert(item);
  console.log(`Created item with id:\n${item.id}\n`);
}

async function getStanovi() {
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.pk="stanovi"',
  };

  const { resources: results } = await client
    .database(databaseId)
    .container(containerId)
    .items.query(querySpec)
    .fetchAll();

  return results;
}

async function queryContainer() {
  console.log(`Querying container:\n${config.container.id}`);

  // query to return all children in a family
  // Including the partition key value of country in the WHERE filter results in a more efficient query
  const querySpec = {
    query:
      "SELECT VALUE r.children FROM root r WHERE r.partitionKey = @country",
    parameters: [
      {
        name: "@country",
        value: "USA",
      },
    ],
  };

  const { resources: results } = await client
    .database(databaseId)
    .container(containerId)
    .items.query(querySpec)
    .fetchAll();
  for (var queryResult of results) {
    let resultString = JSON.stringify(queryResult);
    console.log(`\tQuery returned ${resultString}\n`);
  }
}

async function replaceItem(item) {
  console.log(`Replacing item:\n${item.id}\n`);
  const { dbItem } = await client
    .database(databaseId)
    .container(containerId)
    .item(item.id, item.pk)
    .replace(item);
}

module.exports = { writeItem, getStanovi, replaceItem };
