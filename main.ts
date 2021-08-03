import { HubSpotClient } from './hubspotClient.ts';
import { parse } from "https://deno.land/std/flags/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
import * as Colors from 'https://deno.land/std@0.103.0/fmt/colors.ts';

async function solarSailCli(): Promise<void> {
  const args = parse(Deno.args);

  const client = new HubSpotClient();

  const isForbidden = await client.isForbidden();

  if (isForbidden) {
    console.log(Colors.red('Your DESTINATION api key is pointing to the wrong enviroment. Make sure its your own sandbox API key'));
    return;
  }

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

  if (args?.templates == 'sync') {
    client.syncTemplates('content/api/v2/templates');
  }

  if (args?.all == 'sync') {
    client.syncTemplates('content/api/v2/templates');
    client.syncPages('content/api/v2/pages');
    client.syncHubDb('hubdb/api/v2/tables');
    client.syncBlogPosts('content/api/v2/blog-posts');
  }
}

const { HAPI_KEY_SOURCE, HAPI_KEY_DESTINATION } = config({ safe: true });

if (HAPI_KEY_DESTINATION && HAPI_KEY_SOURCE) {
  solarSailCli();
} else {
  console.error(
    Colors.red('A .env file with HAPI_KEY_DESTINATION and HAPI_KEY_SOURCE not found, please add it to your current directory.')
  );
}
