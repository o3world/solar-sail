import { HubSpotClient } from './hubspotClient.ts';
import { parse } from "https://deno.land/std/flags/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
import * as Colors from 'https://deno.land/std@0.103.0/fmt/colors.ts';

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

const { HAPI_KEY_SOURCE, HAPI_KEY_DESTINATION } = config();

if (HAPI_KEY_DESTINATION && HAPI_KEY_SOURCE) {
  solarSailCli();
} else {
  console.error(
    Colors.red('A .env file with HAPI_KEY_DESTINATION and HAPI_KEY_SOURCE not found, please add it to your current directory.')
  );
}
