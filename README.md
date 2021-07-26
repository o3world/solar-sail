### Solr Sail CLI

Created to help sync hubspot production to Dev's Sandboxes

### Requirements

1. Install [Deno](https://deno.land/#installation)
2. Create a `.env` file
3. Add `HAPI_KEY_DESTINATION`, API key generated on *Dev's Sandbox* account
4. Add `HAPI_KEY_SOURCE`, API key generated on *Production* account
5. Compile into executable with [Compilation command](https://github.com/o3world/solar-sail#compilation-command) below

### Example Commands

* `./solar pages`: Sync all pages.
* `./solar hubdb`: Sync all tables in hubdb.
* `./solar blogs`: Sync all Blogs and Blog Posts.

### Compilation command

`deno compile --output solar --allow-net --allow-read --allow-write ./main.ts`