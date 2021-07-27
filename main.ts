import { HubSpotClient } from './hubspotClient.ts';
import { parse } from "https://deno.land/std/flags/mod.ts";

async function solarSailCli(): Promise<void> {
  const args = parse(Deno.args);

  const client = new HubSpotClient();

  if (args?.pages == 'sync') {
    client.syncPages('content/api/v2/pages');
  }

  if (args?.hubdb == 'sync') {
    client.syncHubDb('hubdb/api/v2/tables');
  }

  if (args?.blogs == 'sync') {
    client.syncBlogPosts('content/api/v2/blog-posts');
  }

  if (args?.blogs == 'delete') {
    client.deleteBlogs();
  }
}

solarSailCli();