### Solr Sail CLI

Created to help sync hubspot production to Dev's Sandboxes

### Requirements

1. Install [Deno](https://deno.land/#installation)
2. Create a `.env` file
3. Add `HAPI_KEY_DESTINATION`, API key generated on *Dev's Sandbox* account
4. Add `HAPI_KEY_SOURCE`, API key generated on *Production* account
5. Install Solar [Installation command](https://github.com/o3world/solar-sail#installation-command) below

### Example Commands

* `solar --pages=sync`: Sync all pages.
* `solar --hubdb=sync`: Sync all tables in hubdb.
* `solar --blogs=sync`: Sync all Blogs and Blog Posts.
* `solar --blogs=delete`: Delete all Blogs along with Blog Posts
* `solar --templates=sync`: Sync all templates.
* `solar --all=sync`: Sync all Pages, HubDB Tables and Blogs

### Installation command

`deno install -n solar --allow-net --allow-env --allow-read --allow-write --no-check -f https://raw.githubusercontent.com/o3world/solar-sail/main/solar.bundle.ts`

To reinstall:

`deno install -n solar --reload --allow-net --allow-env --allow-read --allow-write --no-check -f https://raw.githubusercontent.com/o3world/solar-sail/main/solar.bundle.ts`


### Bundling

`deno bundle main.ts > solar.bundle.ts`

### Debugging

* Make sure you've exported the PATH variable so the deno bin is visible to your terminal.
