const puppeteer = require("puppeteer-extra");
const randomUseragent = require("random-useragent");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const chromium = require("chromium");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36";
puppeteer.use(StealthPlugin());

function ResourceManager(loadImages) {
  let browser = null;
  const _this = this;
  let retries = 0;
  let isReleased = false;

  this.init = async () => {
    isReleased = false;
    retries = 0;
    browser = await runBrowser();
  };

  this.release = async () => {
    isReleased = true;
    if (browser) await browser.close();
  };

  this.createPage = async () => {
    if (!browser) browser = await runBrowser();
    return await createPage(browser);
  };

  async function runBrowser() {
    const options = {
      headless: true,
      devtools: false,
      ignoreHTTPSErrors: true,
      slowMo: 0,
      args: [
        "--disable-gpu",
        "--no-sandbox",
        "--no-zygote",
        "--disable-setuid-sandbox",
        "--disable-accelerated-2d-canvas",
        "--disable-dev-shm-usage",
        "--proxy-server='direct://'",
        "--proxy-bypass-list=*",
      ],
    };

    if (process.env.USE_LOCAL_CHROMIUM == "true") {
      options.executablePath = chromium.path;
    }

    const bw = await puppeteer.launch(options);

    bw.on("disconnected", async () => {
      if (isReleased) return;
      console.log("BROWSER CRASH");
      if (retries <= 3) {
        retries += 1;
        if (browser && browser.process() != null)
          browser.process().kill("SIGINT");
        await _this.init();
      } else {
        throw "===================== BROWSER crashed more than 3 times";
      }
    });

    return bw;
  }

  async function createPage(browser) {
    const userAgent = randomUseragent.getRandom();
    const UA = userAgent || USER_AGENT;
    const page = await browser.newPage();
    await page.setViewport({
      width: 1920 + Math.floor(Math.random() * 100),
      height: 3000 + Math.floor(Math.random() * 100),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: false,
      isMobile: false,
    });
    await page.setUserAgent(UA);
    await page.setJavaScriptEnabled(true);
    await page.setDefaultNavigationTimeout(0);
    if (!loadImages) {
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (
          req.resourceType() == "stylesheet" ||
          req.resourceType() == "font" ||
          req.resourceType() == "image"
        ) {
          req.abort();
        } else {
          req.continue();
        }
      });
    }

    await page.evaluateOnNewDocument(() => {
      //pass webdriver check
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    await page.evaluateOnNewDocument(() => {
      //pass chrome check
      window.chrome = {
        runtime: {},
        // etc.
      };
    });

    await page.evaluateOnNewDocument(() => {
      //pass plugins check
      const originalQuery = window.navigator.permissions.query;
      return (window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters));
    });

    await page.evaluateOnNewDocument(() => {
      // Overwrite the `plugins` property to use a custom getter.
      Object.defineProperty(navigator, "plugins", {
        // This just needs to have `length > 0` for the current test,
        // but we could mock the plugins too if necessary.
        get: () => [1, 2, 3, 4, 5],
      });
    });

    await page.evaluateOnNewDocument(() => {
      // Overwrite the `plugins` property to use a custom getter.
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
    });

    return page;
  }
}

module.exports = ResourceManager;
