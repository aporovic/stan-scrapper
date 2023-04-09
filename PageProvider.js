const puppeteer = require("puppeteer");
const chromium = require("chromium");

let instanceNum = 0;
class PageProvider {
  constructor(inum) {
    this.instanceLimit = inum;
    this.instances = [];
    this.pending = [];
    this.browserPromise = null;
  }

  async getBrowser() {
    if (!this.browserPromise) {
      this.browserPromise = await (process.env.USE_LOCAL_CHROMIUM == "true"
        ? puppeteer.launch({
            headless: true,
            executablePath: chromium.path,
          })
        : puppeteer.launch());
    }
    return this.browserPromise;
  }

  async getInstance() {
    return new Promise(async (resolve) => {
      if (!this.browser) {
        this.browser = await this.getBrowser();
      }
      if (
        instanceNum < this.instanceLimit &&
        this.instances.length < this.instanceLimit
      ) {
        instanceNum++;
        const instance = {
          instance: await this.browser.newPage(),
          used: true,
        };
        this.instances.push(instance);
        instance.index = this.instances.length - 1;
        resolve(instance);
        return;
      }
      const instance = this.instances.find((instance) => !instance.used);
      if (instance) {
        instance.used = true;
        resolve(instance);
        return;
      } else {
        this.pending.push(resolve);
      }
    });
  }

  releaseInstance(instance) {
    instanceNum--;
    const pendingResolveFn = this.pending.pop();
    if (pendingResolveFn) {
      pendingResolveFn(instance);
    } else {
      instance.used = false;
    }
  }
}

module.exports = PageProvider;
