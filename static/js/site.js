"use strict";

(function () {
  var SEARCH_DELAY = 150;
  var SEARCH_MAX_ITEMS = 10;
  var searchIndex;
  var searchIndexPromise;
  var searchTimer;
  var searchTrigger;

  function createIcon(name) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    var sprite = document.querySelector(".dt-icon use");
    var spriteUrl = sprite ? sprite.getAttribute("href").split("#")[0] : "/icons/deep-thought.svg";

    svg.classList.add("dt-icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    use.setAttribute("href", spriteUrl + "#" + name);
    svg.appendChild(use);
    return svg;
  }

  function setIconName(container, name) {
    var use = container && container.querySelector(".dt-icon use");
    if (!use) {
      return;
    }
    var currentHref = use.getAttribute("href");
    var spriteUrl = currentHref ? currentHref.split("#")[0] : "/icons/deep-thought.svg";
    use.setAttribute("href", spriteUrl + "#" + name);
  }

  function debounceSearch(callback) {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(callback, SEARCH_DELAY);
  }

  function makeTeaser(body, terms) {
    var normalizedBody = body.replace(/\s+/g, " ").trim();
    var lowerBody = normalizedBody.toLowerCase();
    var matchIndex = -1;

    terms.some(function (term) {
      matchIndex = lowerBody.indexOf(term.toLowerCase());
      return matchIndex >= 0;
    });

    if (matchIndex < 0) {
      return normalizedBody.slice(0, 180) + (normalizedBody.length > 180 ? "…" : "");
    }

    var start = Math.max(0, matchIndex - 80);
    var end = Math.min(normalizedBody.length, matchIndex + 100);
    return (start > 0 ? "…" : "") + normalizedBody.slice(start, end) +
      (end < normalizedBody.length ? "…" : "");
  }

  function createSearchResult(item, terms) {
    var listItem = document.createElement("li");
    var article = document.createElement("article");
    var heading = document.createElement("h3");
    var titleLink = document.createElement("a");
    var teaser = document.createElement("p");
    var readLink = document.createElement("a");
    var readContext = document.createElement("span");

    article.classList.add("box");
    heading.classList.add("title", "is-5");
    titleLink.href = item.ref;
    titleLink.textContent = item.doc.title;
    heading.appendChild(titleLink);

    teaser.classList.add("search-result__teaser");
    teaser.textContent = makeTeaser(item.doc.body, terms);

    readLink.href = item.ref;
    readLink.classList.add("search-result__link");
    readLink.appendChild(document.createTextNode("Read More "));
    readContext.classList.add("visually-hidden");
    readContext.textContent = "about " + item.doc.title;
    readLink.appendChild(readContext);
    readLink.appendChild(createIcon("arrow-right"));

    article.appendChild(heading);
    article.appendChild(teaser);
    article.appendChild(readLink);
    listItem.appendChild(article);
    return listItem;
  }

  function updateSearch() {
    var input = document.getElementById("search");
    var resultsList = document.getElementById("search-results");
    var status = document.getElementById("search-status");
    var term = input.value.trim();

    resultsList.replaceChildren();
    if (!term) {
      status.textContent = "Enter a search term.";
      return;
    }

    if (!searchIndex) {
      status.textContent = "Search is unavailable.";
      return;
    }

    var results = searchIndex.search(term, {
      bool: "AND",
      fields: {
        title: { boost: 2 },
        body: { boost: 1 }
      }
    });
    var displayedResults = results.slice(0, SEARCH_MAX_ITEMS);

    displayedResults.forEach(function (item) {
      resultsList.appendChild(createSearchResult(item, term.split(/\s+/)));
    });

    if (results.length === 0) {
      status.textContent = "No results found for “" + term + "”.";
    } else {
      status.textContent = results.length + (results.length === 1 ? " result" : " results") +
        " found for “" + term + "”." +
        (results.length > SEARCH_MAX_ITEMS ? " Showing the first " + SEARCH_MAX_ITEMS + "." : "");
    }
  }

  function initializeSearch() {
    var dialog = document.getElementById("search-dialog");
    var openButton = document.getElementById("nav-search");
    var closeButton = document.getElementById("search-close");
    var input = document.getElementById("search");

    if (!dialog || !openButton || !closeButton || !input) {
      return;
    }

    function loadSearchIndex() {
      if (searchIndex || searchIndexPromise) {
        return searchIndexPromise || Promise.resolve(searchIndex);
      }
      var status = document.getElementById("search-status");
      status.textContent = "Loading search…";
      searchIndexPromise = window.fetch(openButton.dataset.searchIndexUrl, {
        credentials: "same-origin"
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Search index request failed.");
          }
          return response.json();
        })
        .then(function (serializedIndex) {
          searchIndex = elasticlunr.Index.load(serializedIndex);
          status.textContent = "Enter a search term.";
          if (input.value.trim()) {
            updateSearch();
          }
          return searchIndex;
        })
        .catch(function () {
          status.textContent = "Search is unavailable.";
          return null;
        });
      return searchIndexPromise;
    }

    openButton.addEventListener("click", function () {
      searchTrigger = openButton;
      dialog.showModal();
      input.focus();
      input.select();
      loadSearchIndex();
    });

    closeButton.addEventListener("click", function () {
      dialog.close();
    });

    dialog.addEventListener("click", function (event) {
      if (event.target !== dialog) {
        return;
      }
      var bounds = dialog.getBoundingClientRect();
      var inside = event.clientX >= bounds.left && event.clientX <= bounds.right &&
        event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      if (!inside) {
        dialog.close();
      }
    });

    dialog.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close();
      }
    });

    dialog.addEventListener("close", function () {
      if (searchTrigger && document.contains(searchTrigger)) {
        searchTrigger.focus();
      }
    });

    input.addEventListener("input", function () {
      debounceSearch(updateSearch);
    });
  }

  function initializeNavigation() {
    var toggle = document.getElementById("nav-menu-toggle");
    var menu = document.getElementById("navMenu");

    if (toggle && menu) {
      toggle.addEventListener("click", function () {
        var expanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!expanded));
        toggle.setAttribute("aria-label", expanded ? "Open navigation menu" : "Close navigation menu");
        toggle.classList.toggle("is-active", !expanded);
        menu.classList.toggle("is-active", !expanded);
      });
    }

    var currentUrl = new URL(window.location.href);
    var currentPath = currentUrl.pathname.replace(/\/+$/, "") || "/";
    document.querySelectorAll("#navMenu a.navbar-item").forEach(function (link) {
      var linkUrl = new URL(link.href, window.location.href);
      var linkPath = linkUrl.pathname.replace(/\/+$/, "") || "/";
      var isHome = linkPath === "/";
      var matches = currentUrl.origin === linkUrl.origin &&
        (isHome
          ? currentPath === "/"
          : currentPath === linkPath ||
            currentPath.startsWith(linkPath + "/"));
      if (matches) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      }
    });
  }

  function initializeScrollableCodeBlocks() {
    var codeBlocks = Array.from(document.querySelectorAll("pre.giallo"));
    if (codeBlocks.length === 0) {
      return;
    }

    function updateFocusableState() {
      codeBlocks.forEach(function (codeBlock) {
        var isScrollable = codeBlock.scrollWidth > codeBlock.clientWidth;
        if (isScrollable && !codeBlock.hasAttribute("tabindex")) {
          codeBlock.tabIndex = 0;
          codeBlock.dataset.scrollFocus = "true";
        } else if (!isScrollable && codeBlock.dataset.scrollFocus === "true") {
          codeBlock.removeAttribute("tabindex");
          delete codeBlock.dataset.scrollFocus;
        }
      });
    }

    updateFocusableState();
    window.addEventListener("resize", updateFocusableState);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateFocusableState);
    }
  }

  function initializeTheme() {
    var root = document.documentElement;
    var toggle = document.getElementById("theme-toggle");
    var colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    var configuredDefault = root.dataset.themeDefault;
    var storedTheme;

    try {
      storedTheme = window.localStorage.getItem("theme");
    } catch (error) {
      storedTheme = null;
    }

    if (!["system", "light", "dark"].includes(configuredDefault)) {
      configuredDefault = "system";
    }

    function selectedTheme() {
      return storedTheme || configuredDefault;
    }

    function isDark() {
      var selected = selectedTheme();
      return selected === "dark" || (selected === "system" && colorScheme.matches);
    }

    function applyTheme() {
      var dark = isDark();
      var lightHighlighting = document.getElementById("giallo-light");
      var darkHighlighting = document.getElementById("giallo-dark");
      root.dataset.theme = dark ? "dark" : "light";
      if (lightHighlighting && darkHighlighting) {
        lightHighlighting.media = dark ? "not all" : "all";
        darkHighlighting.media = dark ? "all" : "not all";
      }
      if (toggle) {
        toggle.setAttribute("aria-pressed", String(dark));
        toggle.setAttribute("aria-label", dark ? "Use light theme" : "Use dark theme");
        setIconName(toggle, dark ? "sun" : "moon");
      }
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        storedTheme = isDark() ? "light" : "dark";
        try {
          window.localStorage.setItem("theme", storedTheme);
        } catch (error) {
          // The selected theme still applies for this page when storage is unavailable.
        }
        applyTheme();
      });
    }

    colorScheme.addEventListener("change", function () {
      if (selectedTheme() === "system") {
        applyTheme();
      }
    });
    applyTheme();
  }

  function initializeAnalytics() {
    var analyticsScript = document.querySelector("[data-google-analytics-id]");
    if (!analyticsScript) {
      return;
    }

    var analyticsId = analyticsScript.dataset.googleAnalyticsId;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", analyticsId);
  }

  function initializeTableOfContents() {
    var links = Array.from(document.querySelectorAll(".toc"));
    if (links.length === 0 || !("IntersectionObserver" in window)) {
      return;
    }

    var byId = new Map();
    links.forEach(function (link) {
      var id;
      try {
        id = decodeURIComponent(new URL(link.href).hash.slice(1));
      } catch (error) {
        return;
      }
      var heading = document.getElementById(id);
      if (heading) {
        byId.set(id, link);
      }
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (link) {
            link.classList.remove("is-active");
            link.removeAttribute("aria-current");
          });
          var current = byId.get(entry.target.id);
          if (current) {
            current.classList.add("is-active");
            current.setAttribute("aria-current", "location");
          }
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });

    byId.forEach(function (_link, id) {
      observer.observe(document.getElementById(id));
    });
  }

  function initializeComments() {
    var container = document.querySelector(
      "#disqus_thread[data-disqus-shortname][data-page-url][data-page-identifier]"
    );
    if (!container) {
      return;
    }

    var shortname = container.dataset.disqusShortname;
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(shortname)) {
      return;
    }

    window.disqus_config = function () {
      this.page.url = container.dataset.pageUrl;
      this.page.identifier = container.dataset.pageIdentifier;
    };

    var script = document.createElement("script");
    script.src = "https://" + shortname + ".disqus.com/embed.js";
    script.dataset.timestamp = String(Date.now());
    script.async = true;
    document.head.appendChild(script);
  }

  function initializeMermaid() {
    if (!window.mermaid || typeof window.mermaid.initialize !== "function") {
      return;
    }
    document.querySelectorAll(".mermaid[data-diagram]").forEach(function (element) {
      element.textContent = element.dataset.diagram;
    });
    window.mermaid.initialize({ startOnLoad: true });
  }

  function initializeCharts() {
    if (typeof chartXkcd === "undefined") {
      return;
    }
    document.querySelectorAll(".chart[data-chart]").forEach(function (element, index) {
      try {
        var chart = JSON.parse(element.dataset.chart);
        var type = chart.type;
        delete chart.type;
        element.id = "chart-" + index;
        new chartXkcd[type](element, chart);
      } catch (error) {
        element.insertAdjacentText("afterend", "Chart could not be rendered.");
      }
    });
  }

  function initializeGalleries() {
    if (!window.Galleria || typeof window.Galleria.run !== "function") {
      return;
    }
    document.querySelectorAll(".galleria[data-images]").forEach(function (element, index) {
      try {
        var data = JSON.parse(element.dataset.images);
        element.id = "galleria-" + index;
        data.images.forEach(function (image) {
          var link = document.createElement("a");
          var picture = document.createElement("img");
          link.href = image.src;
          picture.src = image.src;
          picture.alt = image.alt || image.description || image.title || "";
          picture.loading = "lazy";
          picture.decoding = "async";
          picture.dataset.title = image.title || "";
          picture.dataset.description = image.description || "";
          if (
            Number.isInteger(image.width) && image.width > 0 &&
            Number.isInteger(image.height) && image.height > 0
          ) {
            picture.width = image.width;
            picture.height = image.height;
          }
          link.appendChild(picture);
          element.appendChild(link);
        });
        window.Galleria.run("#" + element.id);
      } catch (error) {
        element.textContent = "Gallery could not be rendered.";
      }
    });
  }

  function initializeMaps() {
    if (typeof mapboxgl === "undefined") {
      return;
    }
    document.querySelectorAll(".map[data-mapbox-token]").forEach(function (element, index) {
      try {
        var geojson = JSON.parse(element.dataset.geojson);
        var center = [0, 0];
        element.id = "map-" + index;
        mapboxgl.accessToken = element.dataset.mapboxToken;

        var map = new mapboxgl.Map({
          container: element.id,
          style: "mapbox://styles/mapbox/light-v10",
          center: [-96, 37.8],
          zoom: Number(element.dataset.zoom)
        });
        map.addControl(new mapboxgl.NavigationControl());

        geojson.features.forEach(function (marker) {
          center[0] += marker.geometry.coordinates[0];
          center[1] += marker.geometry.coordinates[1];

          var popupContent = document.createElement("div");
          var title = document.createElement("h3");
          var description = document.createElement("p");
          var properties = marker.properties || {};
          title.textContent = properties.title || "";
          description.textContent = properties.description || "";
          popupContent.appendChild(title);
          popupContent.appendChild(description);

          new mapboxgl.Marker()
            .setLngLat(marker.geometry.coordinates)
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupContent))
            .addTo(map);
        });

        if (geojson.features.length > 0) {
          map.setCenter([
            center[0] / geojson.features.length,
            center[1] / geojson.features.length
          ]);
        }
      } catch (error) {
        element.textContent = "Map could not be rendered.";
      }
    });
  }

  function initializeMath() {
    if (window.katex && typeof window.katex.render === "function") {
      document.querySelectorAll(".katex-source[data-katex]").forEach(function (element) {
        window.katex.render(element.dataset.katex, element, {
          displayMode: element.dataset.display === "true",
          throwOnError: false
        });
      });
    }
    if (typeof window.renderMathInElement !== "function") {
      return;
    }
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true }
      ]
    });
  }

  function initialize() {
    initializeTheme();
    initializeNavigation();
    initializeScrollableCodeBlocks();
    initializeSearch();
    initializeAnalytics();
    initializeTableOfContents();
    initializeComments();
    initializeMermaid();
    initializeCharts();
    initializeGalleries();
    initializeMaps();
    initializeMath();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
}());
