module.exports = {
  ci: {
    collect: {
      startServerCommand: "node tests/server.js",
      startServerReadyPattern: "DeepThought test server listening",
      url: [
        "http://127.0.0.1:4173/",
        "http://127.0.0.1:4173/posts/post-0/",
        "http://127.0.0.1:4173/docs/"
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: "--headless=new --no-sandbox"
      }
    },
    assert: {
      assertions: {
        "categories:accessibility": ["error", { "minScore": 1 }],
        "categories:best-practices": ["error", { "minScore": 1 }],
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 1 }],
        "is-crawlable": ["error", { "minScore": 1 }],
        "meta-description": ["error", { "minScore": 1 }],
        "image-alt": ["error", { "minScore": 1 }],
        "canonical": ["error", { "minScore": 1 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "total-byte-weight": ["error", { "maxNumericValue": 256000 }],
        "unused-css-rules": ["error", { "maxNumericValue": 100 }]
      }
    },
    upload: {
      target: "temporary-public-storage"
    }
  }
};
