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
      this.browserPromise =
        process.env.USE_LOCAL_CHROMIUM == "true"
          ? puppeteer.launch({
              headless: true,
              executablePath: chromium.path,
            })
          : puppeteer.launch();
    }
    return this.browserPromise;
  }

  async getInstance() {
    return new Promise(async (resolve) => {
      if (!this.browser) {
        this.browser = await this.getBrowser();
      }
      if (instanceNum < this.instanceLimit) {
        instanceNum++;
        this.instances.push({
          instance: await this.browser.newPage(),
          used: true,
          index: this.instances.length,
        });
        resolve(this.instances[this.instances.length - 1]);
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

  releaseInstance(index) {
    instanceNum--;
    const pendingResolveFn = this.pending.pop();
    if (pendingResolveFn) {
      pendingResolveFn(this.instances[index]);
    } else {
      this.instances[index].used = false;
    }
  }
}

module.exports = PageProvider;
