const puppeteer = require("puppeteer-extra");
const chromium = require("chromium");

const ResourceManager = require("./resource-menager");

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

let instanceNum = 0;
class PageProvider {
  constructor(inum) {
    this.instanceLimit = inum;
    this.instances = [];
    this.pending = [];
    this.browserPromise = null;
    this.resourceManager = new ResourceManager(true);
  }

  async getBrowser() {
    if (!this.browserPromise) {
      this.browserPromise = this.resourceManager.init();
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
          instance: await this.resourceManager.createPage(),
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
