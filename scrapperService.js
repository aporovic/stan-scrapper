const camelCase = require("lodash/camelCase");
const puppeteer = require("puppeteer");
const chromium = require("chromium");

const PageProvider = require("./PageProvider");

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

const parseItemPage = async (item) => {
  const pageInstance = await pageProvider.getInstance();
  await pageInstance.instance.goto(item.url);

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
  item.kvadrata = !isNaN(item.kvadrata) ? Number(item.kvadrata) : item.kvadrata;
  pageProvider.releaseInstance(pageInstance);
  //const numCijena = cijena.replace(/\D/g, "");
  //const normalized = fieldValue.match(/(\d+(,|\.\d+)?)+/)?.[0].replace('.', ',');
};

const loadPage = async () => {
  try {
    let url = firstPage;
    const browser = await (process.env.USE_LOCAL_CHROMIUM == "true"
      ? puppeteer.launch({
          headless: true,
          executablePath: chromium.path,
        })
      : puppeteer.launch());
    const page = await browser.newPage();
    while (url) {
      const start = new Date();
      await page.goto(url);

      const items = await page.$$(".articles > div a");
      let parsedItems = [];
      console.log(`Items count: ${items.length}`);
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
          console.log(
            "Load page:",
            index,
            ((new Date() - start) / 1000).toFixed(2)
          );
          return;
        })
      );

      await Promise.all(parsedItems.map((item) => parseItemPage(item)));
      stanovi = stanovi.concat(parsedItems);

      const pageNumIndex = url.lastIndexOf("=") + 1;
      const pageNum = parseInt(url.substring(pageNumIndex));
      url = `${url.substring(0, pageNumIndex)}${pageNum + 1}`;
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
  var items = await loadPage();
  console.log(items.length);
  console.log((new Date() - start) / 1000 / 60);
  return items;
}

module.exports = { collectData };
