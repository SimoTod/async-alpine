var __defProp = Object.defineProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/module.js
__export(exports, {
  default: () => AsyncAlpine
});

// src/core/strategies/event.js
var event = (component) => {
  return new Promise((resolve) => {
    window.addEventListener("async-alpine:load", (e) => {
      if (e.detail.id !== component.id)
        return;
      resolve();
    });
  });
};
var event_default = event;

// src/core/strategies/idle.js
var idle = () => {
  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(resolve);
    } else {
      setTimeout(resolve, 200);
    }
  });
};
var idle_default = idle;

// src/core/strategies/media.js
var media = (requirement) => {
  return new Promise((resolve) => {
    const queryStart = requirement.indexOf("(");
    const query = requirement.slice(queryStart);
    const mediaQuery = window.matchMedia(query);
    if (mediaQuery.matches) {
      resolve();
    } else {
      mediaQuery.addEventListener("change", resolve, { once: true });
    }
  });
};
var media_default = media;

// src/core/strategies/visible.js
var visible = (component, requirement) => {
  return new Promise((resolve) => {
    let rootMargin = "0px 0px 0px 0px";
    if (requirement.indexOf("(") !== -1) {
      const rootMarginStart = requirement.indexOf("(") + 1;
      rootMargin = requirement.slice(rootMarginStart, -1);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        resolve();
      }
    }, { rootMargin });
    observer.observe(component.el);
  });
};
var visible_default = visible;

// src/core/async-alpine.js
var AsyncAlpine = {
  Alpine: null,
  _options: {
    prefix: "ax-",
    alpinePrefix: "x-",
    root: "load",
    inline: "load-src",
    defaultStrategy: "immediate"
  },
  _data: {},
  _realIndex: -1,
  get _index() {
    return this._realIndex++;
  },
  init(Alpine, opts = {}) {
    this.Alpine = Alpine;
    this._options = {
      ...this._options,
      ...opts
    };
    return this;
  },
  start() {
    this._processInline();
    this._setupComponents();
    this._mutations();
    return this;
  },
  data(name, download = false) {
    this._data[name] = {
      loaded: false,
      download
    };
    return this;
  },
  _processInline() {
    const inlineComponents = document.querySelectorAll(`[${this._options.prefix}${this._options.inline}]`);
    for (const component of inlineComponents) {
      this._inlineElement(component);
    }
  },
  _inlineElement(component) {
    const xData = component.getAttribute(`${this._options.alpinePrefix}data`);
    let srcUrl = component.getAttribute(`${this._options.prefix}${this._options.inline}`);
    if (!xData || !srcUrl)
      return;
    const absoluteReg = new RegExp("^(?:[a-z+]+:)?//", "i");
    if (!absoluteReg.test(srcUrl)) {
      srcUrl = new URL(srcUrl, document.baseURI).href;
    }
    const name = this._parseName(xData);
    if (!this._data[name])
      this.data(name);
    this._data[name].download = () => import(
      /* @vite-ignore */
      /* webpackIgnore: true */
      srcUrl
    );
  },
  _setupComponents() {
    const components = document.querySelectorAll(`[${this._options.prefix}${this._options.root}]`);
    for (let component of components) {
      this._setupComponent(component);
    }
  },
  _setupComponent(component) {
    const xData = component.getAttribute(`${this._options.alpinePrefix}data`);
    if (!xData)
      return;
    component.setAttribute(`${this._options.alpinePrefix}ignore`, "");
    const name = this._parseName(xData);
    const strategy = component.getAttribute(`${this._options.prefix}${this._options.root}`) || this._options.defaultStrategy;
    this._componentStrategy({
      name,
      strategy,
      el: component,
      id: component.id || this._index
    });
  },
  async _componentStrategy(component) {
    const requirements = component.strategy.split("|").map((requirement) => requirement.trim()).filter((requirement) => requirement !== "immediate").filter((requirement) => requirement !== "eager");
    if (!requirements.length) {
      await this._download(component.name);
      this._activate(component);
      return;
    }
    let promises = [];
    for (let requirement of requirements) {
      if (requirement === "idle") {
        promises.push(idle_default());
        continue;
      }
      if (requirement.startsWith("visible")) {
        promises.push(visible_default(component, requirement));
        continue;
      }
      if (requirement.startsWith("media")) {
        promises.push(media_default(requirement));
        continue;
      }
      if (requirement === "event") {
        promises.push(event_default(component));
      }
    }
    Promise.all(promises).then(async () => {
      await this._download(component.name);
      this._activate(component);
    });
  },
  async _download(name) {
    if (this._data[name].loaded)
      return;
    const module2 = await this._getModule(name);
    this.Alpine.data(name, module2);
    this._data[name].loaded = true;
  },
  async _getModule(name) {
    if (!this._data[name])
      return;
    const module2 = await this._data[name].download();
    if (typeof module2 === "function")
      return module2;
    let whichExport = module2[name] || module2.default || Object.values(module2)[0] || false;
    return whichExport;
  },
  _activate(component) {
    component.el.removeAttribute(`${this._options.alpinePrefix}ignore`);
    component.el._x_ignore = false;
    this.Alpine.initTree(component.el);
  },
  _mutations() {
    const observer = new MutationObserver((entries) => {
      for (const entry of entries) {
        if (!entry.addedNodes)
          continue;
        for (const node of entry.addedNodes) {
          if (node.nodeType !== 1)
            continue;
          if (node.hasAttribute(`${this._options.prefix}${this._options.root}`)) {
            this._mutationEl(node);
          }
          const childComponents = node.querySelectorAll(`[${this._options.prefix}${this._options.root}]`);
          childComponents.forEach((el) => this._mutationEl(el));
        }
      }
    });
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true
    });
  },
  _mutationEl(el) {
    if (el.hasAttribute(`${this._options.prefix}${this._options.inline}`)) {
      this._inlineElement(el);
    }
    this._setupComponent(el);
  },
  _parseName(attribute) {
    return attribute.split("(")[0];
  }
};
