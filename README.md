# External Components

Nowadays, when web developers want to add a third-party tool to their website, they usually add some JavaScript snippet that loads a remote resource. This can potentially be very problemtic, for multiple reasons:

- **Performance**: It is slow. Every tool requires another network request, and much more than one. The code is then executed in the browser, which can block the main thread and slow down interacting with the website itself.
- **Security**: It is dangerous. The tool runs in the browser and so it has unlimited access to everything in the page. It can steal information, hijack the visitor or change the page in an undesired way.
- **Privacy**: Because the browser has to fetch all tools, every single vendor gets access to the visitor IP address and User Agent. It's impossible to prevent sending this information. Also, tools can collect information using JavaScript without any restrictions, and the web developer can do very little to restrict that.

An External Components is a JavaScript module that defines how a certain third-party tool works in a website. It contains all of the assets required for the tool to function, and it allows the tool to subscribe to different events, to update the DOM as well as to introduce server-side logic.

Tools that provide an External Component can earn from multiple capabilities:

- **Same domain**: Serve assets from the same domain as the website itself, for faster and more secure execution
- **Website-wide events system**: Hook to a pre-existing events system that the website uses for tracking events - no need to define tool specific API
- **Server logic**: Provide server-side logic on the same domain as the website, including proxying a different server, serving static assets or generating dynamic responses, reducing the load on the tool's servers
- **Server-side rendered widgets and embeds**: Easily extend the capabilities of the website with widgets and embeds that are performant and secure
- **Reliable client events**: Subscribe to client-side events in a cross-platform reliable way
- **Pre-Page-Rendering Actions**: Run server-side actions that read or write a website page, before the browser started rendering it
- **Integrated Consent Manager support**: Easier integration in a consent-aware environment

## Concepts

External Components can be used with any compliant External Components Manager (ECM). Example ECMs are Cloudflare Zaraz and the open-source EC-Web server, which serves as an implementation reference.

It is the responsbility of the ECM to implement the External Components APIs, and to provide an interface for website owners to set their settings or configure their events.

## Manifest

Every External Component includes a `manifest.json`. The manifest file includes information that the ECM uses when presenting the tool to the website owners.

```json
{
  "name": "ExampleTool",
  "description": "ExampleTool is a great tool for X and Y!",
  "namespace": "example",
  "icon": "assets/icon.svg",
  "fields": {
    "accountId": {
      "displayName": "Account ID",
      "helpText": "You can find the ID in the top of the ExampleTool dashboard.",
      "displayWidget": "text",
      "validations": [
        {
          "required": true
        },
        {
          "type": "number"
        }
      ]
    }
  },
  "allowCustomFields": true,
  "permissions": [
    {
      "permission": "provideEmbed",
      "explanation": "ExampleTool provides an embed you can use in your website",
      "required": true
    },
    {
      "permission": "clientFetch",
      "explanation": "ExampleTool uses cookies to attribute sessions more accurately",
      "required": false
    }
  ]
}
```

| Field               | Description                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `name`              | User facing name of the tool                                                                                  |
| `description`       | User facing description of the tool                                                                           |
| `namespace`         | A namespace string that the ECM should serve server-side endpoints for the tool                   |
| `icon`              | Path to an SVG icon that will be displayed with the tool                                                      |
| `fields`            | An object describing the fields the ECM should ask for when configuring an event for the tool |
| `allowCustomFields` | Whether or not users should be allowed to send custom fields to the tool                                      |
| `permissions`       | Array of permissions the tool requires for its operation                                                      |

## Permissions

The following table describes the permissions that a tool can ask for when being added to a website.

| Permission           | Required for                                                                |
| -------------------- | --------------------------------------------------------------------------- |
| client_kv            | `client.set`, `client.get`                                                  |
| client_ext_kv        | `client.get` when getting a key from another tool                           |
| run_client_js        | `client.execute`                                                            |
| client_fetch         | `client.fetch`                                                              |
| run_scoped_client_js |                                                                             |
| serve_static         | `serveStatic`                                                               |
| server_functions     | `proxy`, `route`                                                            |
| read_page            |                                                                             |
| provide_embed        | `provideEmbed`                                                              |
| provide_widget       | `provideWidget`                                                             |
| hook_user_events     | events: `event`                                                             |
| hook_browser_events  | events: `pageview`, `historyChange`, `DOMChange`, `click`, `scroll`, `time` |

## API Overview

### Server functionality

External Components provides a couple of methods that allow a tool to introduce server-side functionality:

#### `proxy`

Create a reverse proxy from some path to another server. It can be used in order to access the tool vendor servers without the browser needing to send a request to a different domain.

```js
manager.proxy("/api", "api.example.com");
```

For a tool that uses the namespace `example`, the above code will map `domain.com/cdn-cgi/zaraz/example/api/*` to `api.example.com`. For example, a request to `domain.com/cdn-cgi/zaraz/example/api/hello` will be proxied, server-side, to `api.example.com/hello`.

In the case of proxying static assets, you can use the third optional argument to force caching:

```js
manager.proxy("/assets", "assets.example.com", { cache: "always" });
```

The third argument is optional and defaults to:

```js
{
  cache: "auto"; // `never`, `always`, or `auto`. `auto` will cache based on the cache-control header of the responses.
}
```

#### `serveStatic`

Serve static assets.

```js
manager.serveStatic("public", "assets");
```

The tool will provide a directory with it static assets under `public`, and it will be available under the same domain. In the above example, the tool's `public` directory will be exposed under `domain.com/cdn-cgi/zaraz/example/assets`.

#### `route`

Define custom server-side logic. These will run without a proxy, making them faster and more reliable.

```js
manager.route("/ping", (request) => {
  return new Response(204);
});
```

The above will map respond with a 204 code to all requests under `domain.com/cdn-cgi/zaraz/example/ping`.

### Events

#### Pageview

```js
manager.addEventListener("pageview", async (event) => {
  const { context, client, page } = event;

  // Send server-side request
  fetch("https://example.com/collect", {
    method: "POST",
    data: {
      url: context.system.page.url.href,
      title: context.system.page.title,
    },
  });
});
```

The above will send a server-side request to `example.com/collect` whenever the a new page loads, with the URL and the page title as payload.

#### Single Page Application navigation

The `historyChange` event is called whenever the page changes in a Single Page Application, by mean of `history.pushState` or `history.replaceState`. Tools can automatically trigger an action when this event occurs using an Event Listener.

```js
manager.addEventListener("historyChange", async (event) => {
  const { context, client, page } = event;

  // Send server-side request
  fetch("https://example.com/collect", {
    method: "POST",
    data: {
      url: context.system.page.url.href,
      title: context.system.page.title,
    },
  });
});
```

The above will send a server-side request to `example.com/collect` whenever the page changes in a Single Page Application, with the URL and the page title as payload.

#### User-configured events

Users can configure events using a site-wide [Events API](https://developers.cloudflare.com/zaraz/web-api), and then map these events to different tools. A tool can register to listen to events and then define the way it will be processed.

```js
manager.addEventListener("event", async ({ context, client }) => {
  // Send server-side request
  fetch("https://example.com/collect", {
    method: "POST",
    data: {
      ip: context.system.device.ip,
      eventName: context.eventName,
    },
  });

  // Check that the client is a browser
  if (client.type === "browser") {
    client.set("example-uuid", uuidv4());
    client.fetch(
      `https://example.com/collectFromBrowser?dt=${system.page.title}`
    );
  }
});
```

In the above example, when the tool receives an event it will do multiple things: (1) Make a server-side post request to /collect endpoint, with the visitor IP and the event name. If the visitor is using a normal web browser (e.g. not using the mobile SDK), the tool will also set a client key (e.g. cookie) named `example-uuid` to a random UUIDv4 string, and it ask the browser to make a client-side fetch request with the page title.

#### DOM Change

### Embeds and Widgets

External Components can provide embeds (elements pre-placed by the website owner using a placeholder) and widgets (floating elements).

#### Embed support

To place an embed in the page, the website owner includes a placeholder `div` element. For example, a Twitter embed could look like this:

```html
<div
  data-zaraz-embed="twitter-example"
  data-dark-theme
  data-tweet-id="1488098745438855172"
></div>
```

Inside the External Component, the embed will be defined like in this example:

```js
manager.registerEmbed("twitter-example", ({ element }) => {
  const color = element.attributes["dark-theme"] ? "light" : "dark";
  const tweetId = element.attributes["tweet-id"];
  const tweet = manager.useCache(
    "tweet-" + tweetId,
    await(await fetch("https://api.twitter.com/tweet/" + tweetId)).json()
  );

  element.render(
    manager.useCache(
      "widget",
      pug.compile("templates/widget.pug", { tweet, color })
    )
  );
});
```

In the above example, the tool defined an embed called `twitter-example`. It checks for some HTML attributes on the placeholder element, makes a request to a remote API, caches it, and then renders the new element instead the placeholder using the [Pug templating engine](https://pugjs.org/). Note the Pug templating system isn't a part of the External Component API - a tool can choose to use whatever templating engine it wants, as long as it responds with valid HTML code.

#### Widget support

Floating widgets are not replacing an element, instead, they are appended to the `<body>` tag of the page. Inside the External Component, a floating tweet widget will be defined like this:

```js
manager.registerWidget("floatingTweet", ({ element }) => {
  const tweetId = element.attributes["tweet-id"];
  const tweet = manager.useCache(
    "tweet-" + tweetId,
    await(await fetch("https://api.twitter.com/tweet/" + tweetId)).json()
  );

  element.render(
    manager.useCache(
      "widget",
      pug.compile("templates/floating-widget.pug", { tweet })
    )
  );
});
```

In the above example, the tool defined a widget called `floatingTweet`. It reads the tweet ID from the `settings` object, and then uses the same method as the embed to fetch from an API and render its HTML code.

### Storage

#### `set`

Save a variable to a KV storage.

```js
manager.set("message", "hello world");
```

#### `get`

Get a variable from KV storage.

```js
manager.get("message", "hello world");
```

### Caching

#### `useCache`

The `useCache` method is used to provide tools with an abstract layer of caching that easy to use. The method takes 3 arguments - `name`, `function` and `expiry`. When used, `useCache` will use the data from the cache if it exists, and if the expiry time did not pass. If it cannot use the cache, `useCache` will run the function and cache it for next time.

```js
manager.useCache(
  `widget-${tweet.id}`,
  pug.compile("templates/floating-widget.pug", { tweet }),
  60
);
```

In the above example the template will only be rerendered using Pug if the cache doesn't already have the rendered template saved, or if it has been more than 60 seconds since the time it was cached.

#### `invalidateCache`

Used when a tool needs to forcefully remove a cached item.

```js
manager.route("/invalidate", (request) => {
  manager.invalidateCache("some_cached_item");
  return new Response(204);
});
```

The above example can be used by a tool to remotely wipe a cached item, for example when it wants the website to re-fetch data from the tool vendor API.

### Client Functions

#### `client.fetch`

Make a `fetch` request from the client.

```js
client.fetch("https://example.com/collect");
```

The above will send a fetch request from the client to the resource specified.

#### `client.set`

Save a value on the client. In a normal web browser, this would translate into a cookie, or a localStorage/sessionStorage item.

```js
client.set("uuid", uuidv4(), { scope: "infinite" });
```

The above will save a UUIDv4 string under a key called `uuid`, readable by this tool only. The ECM will attempt to make this key persist infintely.

The third argument is an optional object with these defaults:

```js
{
  "scope": "page", // "page", "session", "infinite"
  "expiry": null // `null`, Date object or lifetime in milliseconds
}
```

#### `client.get`

Get the value of a key that was set using `client.set`.

```js
client.get("uuid");
```

As keys are scoped to each tool, a tool can also explicitly ask for getting the value of a key from another tool:

```js
client.get("uuid", "facebook-pixel");
```

#### `client.return`

Return a value to the client so that it can use it.

```js
manager.addEventListener("event", async ({ context, payload, client }) => {
  if (context.eventName === "multiply") {
    client.return(context.x * context.y);
  }
});
```

On the browser, the website can access this result using:

```js
const value = await manager.track("multiply", { x: 21, y: 2 });
const result = value.return["exampleTool"]; // = 42
```


#### `client.execute`

Run client-side JS code in the client.

```js
manager.addEventListener("event", async ({ context, payload, client }) => {
  client.eval("console.log('Hello World');")
});
```

This would make the browser print "Hello World" to the console.
