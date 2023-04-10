const camelCase = require("lodash/camelCase");
const puppeteer = require("puppeteer-extra");
const chromium = require("chromium");

const PageProvider = require("./PageProvider");
const ResourceManager = require("./resource-menager");

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const firstPage =
  "https://olx.ba/pretraga?attr=102%280-65%29&category_id=23&price_to=170000&canton=9&cities=&listing_type=sell&page=1";
const fileName = "stanovi.csv";

const webFieldsNames = [
  "Sprat",
  "Vrsta grijanja",
  "Namješten?",
  "Adresa",
  "Godina izgradnje",
  "Kvadrata",
];

let stanovi = [];

const propName = (f) => camelCase(f).replace(/\W/g, "");

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const pageProvider = new PageProvider(3);

const getField = async (page, text) => {
  try {
    const label = await page.waitForSelector(`text/${text}`, { timeout: 1000 });
    const row = (await label.$x(".."))[0];
    const value = await getText(await row.$("td:nth-of-type(2)"));
    return value;
  } catch (e) {
    return "";
  }
};

const getText = async (el) => {
  return el && (await (await el.getProperty("textContent")).jsonValue()).trim();
};

const parseItemPage = async (item, index) => {
  const pageInstance = await pageProvider.getInstance();

  let delayTime = 1000;

  const run = async () => {
    try {
      await pageInstance.instance.goto(item.url, {
        waitUntil: "networkidle0",
        timeout: 60000,
      });
      await pageInstance.instance.waitForSelector(".section-title");

      await Promise.all(
        webFieldsNames.map(async (fieldLabel) => {
          const value = await getField(pageInstance.instance, fieldLabel);
          const prop = propName(fieldLabel);
          item[prop] = value;
        })
      );
      const pills = await Promise.all(
        (await pageInstance.instance.$$(".btn-pill")).map(getText)
      );
      item.lokacija = pills.length < 6 ? pills[0] : pills[2];
      item.stanje = pills.length < 6 ? pills[1] : pills[3];
      item.kvadrata = !isNaN(item.kvadrata)
        ? Number(item.kvadrata)
        : item.kvadrata;
      pageProvider.releaseInstance(pageInstance);
      //const numCijena = cijena.replace(/\D/g, "");
      //const normalized = fieldValue.match(/(\d+(,|\.\d+)?)+/)?.[0].replace('.', ',');
      console.log(`Item ${index + 1} fetched`);
      return true;
    } catch (e) {
      if (!e.message.includes("Navigation timeout")) {
        throw e;
      }
      return false;
    }
  };
  let successful = false;
  do {
    successful = await run();
    if (!successful) {
      delayTime *= 2;
      console.log(
        `Instance ${pageInstance.index} item ${item.id} delayed for ${delayTime}ms`
      );
      await delay(delayTime);
    }
  } while (!successful);
};

const loadPage = async (resourceManager) => {
  try {
    let url = firstPage;
    const page = await resourceManager.createPage();

    while (url) {
      const start = new Date();
      await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
      await page.waitForSelector(".articles");

      const items = await page.$$(".articles > div a");
      // let source = await page.content();
      let parsedItems = [];
      await Promise.all(
        items.map(async (item, index) => {
          const itemUrl = await (await item.getProperty("href")).jsonValue();
          const id = itemUrl.substring(
            itemUrl.lastIndexOf("l") + 2,
            itemUrl.length - 1
          );
          const podaci = await item.$(".content-wrap");

          //const element_property = await (await podaci.getProperty('innerHTML')).jsonValue();

          const naslov = await getText(
            await podaci.$("div:nth-of-type(1) > h1")
          );
          let cijena = await getText(
            await podaci.$("div:nth-of-type(3) .smaller")
          );
          cijena = cijena.toLowerCase().includes("dogovor")
            ? cijena
            : cijena.replace(/\D/g, "");
          cijena = !isNaN(cijena) ? Number(cijena) : cijena;

          parsedItems.push({ id, naslov, cijena, url: itemUrl });
          return;
        })
      );

      console.log(`Items to fetch ${parsedItems.length}`);
      await Promise.all(parsedItems.map(parseItemPage));
      stanovi = stanovi.concat(parsedItems);

      const pageNumIndex = url.lastIndexOf("=") + 1;
      const pageNum = parseInt(url.substring(pageNumIndex));
      url = `${url.substring(0, pageNumIndex)}${pageNum + 1}`;
      console.log(`Next page: ${pageNum + 1}`);
      if (items.length === 0) {
        break;
      }
      await delay(10000);
    }
    return stanovi;
  } catch (error) {
    throw error;
  }
};

async function collectData() {
  const start = new Date();
  var resourceManager = new ResourceManager(true);
  await resourceManager.init();
  var items = await loadPage(resourceManager);
  console.log(items.length);
  console.log((new Date() - start) / 1000 / 60);
  return items;
}

module.exports = { collectData };
